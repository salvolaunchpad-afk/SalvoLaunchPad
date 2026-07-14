// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SalvoToken} from "./SalvoToken.sol";

/// @title Salvo — the launchpad where everyone fires at once
/// @notice Port of the Salvo Solana program to Robinhood Chain (EVM).
///
/// Lifecycle per token:
///   Salvo (2-min batch auction, one clearing price for every committer)
///     -> Live (virtual-reserve bonding curve trading)
///     -> Graduated (same contract flips to a real-reserve pool; the
///        protocol is the only LP, so liquidity is locked by construction
///        and the fee split keeps paying stakers forever).
///
/// Fees: 1% of ETH notional on every trade, split between the token's
/// creator and the protocol treasury (shares owner-tunable; a further
/// holder-facing mechanic may claim a slice later). Flat launch fee and
/// graduation fee on top. All fee payouts are pull-based (credited to
/// `owed`, withdrawn via withdraw()) so no recipient can grief trades by
/// reverting.
contract Salvo {
    // ── Config (owner-tunable) ─────────────────────────────────────────
    address public owner;
    address public treasury;

    uint256 public feeBps = 100; // 1%
    uint256 public creatorShareBps = 5_000; // of the fee; protocol gets the rest
    uint256 public launchFee = 0.0005 ether;
    uint256 public migrationFee = 0.05 ether;
    uint256 public salvoDuration = 120;
    uint256 public salvoWalletCap = 0.05 ether;
    uint256 public salvoGlobalCap = 1.25 ether;
    uint256 public graduationEth = 2.8 ether;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 public constant CURVE_SUPPLY = 800_000_000e18;
    uint256 public constant LP_RESERVE = TOTAL_SUPPLY - CURVE_SUPPLY;
    uint256 public constant VIRTUAL_ETH = 1 ether;
    uint256 public constant VIRTUAL_TOKENS = 1_073_000_000e18;

    // ── Per-launch state ───────────────────────────────────────────────
    enum Phase {
        None,
        Salvo,
        Live,
        Graduated
    }

    struct Launch {
        address creator;
        uint64 createdAt;
        uint64 salvoEndsAt;
        Phase phase;
        bool settled;
        // Bonding curve (virtual reserves while Live).
        uint256 virtualEth;
        uint256 virtualTokens;
        uint256 realEth;
        uint256 realTokens;
        // Salvo batch auction.
        uint256 salvoTotalEth;
        uint256 salvoTokensPool;
        uint256 distributedIdx;
        // Post-graduation pool (real reserves, protocol is the only LP).
        uint256 poolEth;
        uint256 poolTokens;
        /// Lifetime fees earned by the creator, for display.
        uint256 lifetimeCreatorFees;
        string uri;
    }

    mapping(address => Launch) public launches;
    mapping(address => address[]) private _committers;
    mapping(address => mapping(address => uint256)) public commits;

    /// Pull-payment ledger: creator fees and protocol fees accumulate
    /// here until withdraw().
    mapping(address => uint256) public owed;

    address[] public allTokens;

    // ── Events ─────────────────────────────────────────────────────────
    event LaunchCreated(address indexed token, address indexed creator, string name, string symbol, uint64 salvoEndsAt);
    event SalvoCommitted(address indexed token, address indexed buyer, uint256 amount, uint256 salvoTotalEth);
    event SalvoSettled(address indexed token, uint256 netEth, uint256 tokensCleared);
    event SalvoDistributed(address indexed token, address indexed buyer, uint256 tokens);
    event Traded(
        address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, Phase phase
    );
    event Graduated(address indexed token, uint256 poolEth, uint256 poolTokens);
    event Withdrawn(address indexed user, uint256 amount);

    // ── Errors ─────────────────────────────────────────────────────────
    error PhaseMismatch();
    error SalvoEnded();
    error SalvoNotEnded();
    error WalletCapExceeded();
    error GlobalCapExceeded();
    error SlippageExceeded();
    error InsufficientCurveTokens();
    error ZeroAmount();
    error WrongFee();
    error NotOwner();
    error Reentrancy();

    // ── Reentrancy guard ───────────────────────────────────────────────
    uint256 private _locked = 1;

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address treasury_) {
        owner = msg.sender;
        treasury = treasury_;
    }

    // ── Launch ─────────────────────────────────────────────────────────

    function createLaunch(string calldata name, string calldata symbol, string calldata uri)
        external
        payable
        nonReentrant
        returns (address token)
    {
        if (msg.value != launchFee) revert WrongFee();
        owed[treasury] += msg.value;

        token = address(new SalvoToken(name, symbol, address(this), TOTAL_SUPPLY));
        Launch storage l = launches[token];
        l.creator = msg.sender;
        l.createdAt = uint64(block.timestamp);
        l.salvoEndsAt = uint64(block.timestamp + salvoDuration);
        l.phase = Phase.Salvo;
        l.virtualEth = VIRTUAL_ETH;
        l.virtualTokens = VIRTUAL_TOKENS;
        l.realTokens = CURVE_SUPPLY;
        l.uri = uri;
        allTokens.push(token);

        emit LaunchCreated(token, msg.sender, name, symbol, l.salvoEndsAt);
    }

    // ── The salvo (batch auction) ──────────────────────────────────────

    function commit(address token) external payable nonReentrant {
        Launch storage l = launches[token];
        if (l.phase != Phase.Salvo) revert PhaseMismatch();
        if (block.timestamp >= l.salvoEndsAt) revert SalvoEnded();
        if (msg.value == 0) revert ZeroAmount();
        uint256 newCommit = commits[token][msg.sender] + msg.value;
        if (newCommit > salvoWalletCap) revert WalletCapExceeded();
        if (l.salvoTotalEth + msg.value > salvoGlobalCap) revert GlobalCapExceeded();

        if (commits[token][msg.sender] == 0) _committers[token].push(msg.sender);
        commits[token][msg.sender] = newCommit;
        l.salvoTotalEth += msg.value;

        emit SalvoCommitted(token, msg.sender, msg.value, l.salvoTotalEth);
    }

    /// Permissionless: clears the whole batch as ONE buy at one average
    /// price. Nothing for a sniper to win.
    function settle(address token) external nonReentrant {
        Launch storage l = launches[token];
        if (l.phase != Phase.Salvo) revert PhaseMismatch();
        if (block.timestamp < l.salvoEndsAt) revert SalvoNotEnded();

        l.settled = true;
        l.phase = Phase.Live;

        uint256 total = l.salvoTotalEth;
        if (total == 0) return;

        uint256 fee = (total * feeBps) / 10_000;
        uint256 net = total - fee;
        uint256 tokensOut = _tokensOutForEth(l.virtualEth, l.virtualTokens, net);
        if (tokensOut > l.realTokens) revert InsufficientCurveTokens();

        l.virtualEth += net;
        l.virtualTokens -= tokensOut;
        l.realEth += net;
        l.realTokens -= tokensOut;
        l.salvoTokensPool = tokensOut;
        _bookFees(l, fee);

        emit SalvoSettled(token, net, tokensOut);
        if (l.realEth >= graduationEth) _graduate(token, l);
    }

    /// Permissionless delivery crank: pushes each committer's pro-rata
    /// tokens straight to their wallet. The platform bot calls this right
    /// after settle so buyers never claim anything.
    function distribute(address token, uint256 maxCount) external nonReentrant {
        Launch storage l = launches[token];
        if (!l.settled) revert SalvoNotEnded();

        address[] storage list = _committers[token];
        uint256 end = l.distributedIdx + maxCount;
        if (end > list.length) end = list.length;

        for (uint256 i = l.distributedIdx; i < end; i++) {
            address buyer = list[i];
            uint256 amount = (l.salvoTokensPool * commits[token][buyer]) / l.salvoTotalEth;
            if (amount > 0) SalvoToken(token).transfer(buyer, amount);
            emit SalvoDistributed(token, buyer, amount);
        }
        l.distributedIdx = end;
    }

    // ── Trading (curve while Live, pool after graduation) ──────────────

    function buy(address token, uint256 minTokensOut) external payable nonReentrant {
        Launch storage l = launches[token];
        if (msg.value == 0) revert ZeroAmount();
        (uint256 rEth, uint256 rTok) = _reserves(l);

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 net = msg.value - fee;
        uint256 tokensOut = _tokensOutForEth(rEth, rTok, net);
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        if (l.phase == Phase.Live) {
            if (tokensOut > l.realTokens) revert InsufficientCurveTokens();
            l.virtualEth += net;
            l.virtualTokens -= tokensOut;
            l.realEth += net;
            l.realTokens -= tokensOut;
        } else if (l.phase == Phase.Graduated) {
            l.poolEth += net;
            l.poolTokens -= tokensOut;
        } else {
            revert PhaseMismatch();
        }

        _bookFees(l, fee);
        SalvoToken(token).transfer(msg.sender, tokensOut);
        emit Traded(token, msg.sender, true, msg.value, tokensOut, l.phase);

        if (l.phase == Phase.Live && l.realEth >= graduationEth) _graduate(token, l);
    }

    function sell(address token, uint256 tokenAmount, uint256 minEthOut) external nonReentrant {
        Launch storage l = launches[token];
        if (tokenAmount == 0) revert ZeroAmount();
        (uint256 rEth, uint256 rTok) = _reserves(l);

        uint256 gross = _ethOutForTokens(rEth, rTok, tokenAmount);
        uint256 fee = (gross * feeBps) / 10_000;
        uint256 net = gross - fee;
        if (net < minEthOut) revert SlippageExceeded();

        if (l.phase == Phase.Live) {
            if (gross > l.realEth) revert InsufficientCurveTokens();
            l.virtualEth -= gross;
            l.virtualTokens += tokenAmount;
            l.realEth -= gross;
            l.realTokens += tokenAmount;
        } else if (l.phase == Phase.Graduated) {
            l.poolEth -= gross;
            l.poolTokens += tokenAmount;
        } else {
            revert PhaseMismatch();
        }

        SalvoToken(token).transferFrom(msg.sender, address(this), tokenAmount);
        _bookFees(l, fee);
        emit Traded(token, msg.sender, false, net, tokenAmount, l.phase);

        (bool ok,) = msg.sender.call{value: net}("");
        require(ok, "eth send");
    }

    /// Graduation: take the platform fee, burn unsold curve inventory, and
    /// flip the SAME contract into a real-reserve pool seeded with the
    /// raised ETH + the 200M reserve. The protocol is the only LP, so the
    /// liquidity is locked by construction and the fee split keeps paying
    /// the creator after graduation.
    function _graduate(address token, Launch storage l) internal {
        uint256 fee = migrationFee < l.realEth ? migrationFee : l.realEth;
        owed[treasury] += fee;

        l.poolEth = l.realEth - fee;
        l.poolTokens = LP_RESERVE;
        if (l.realTokens > 0) SalvoToken(token).burn(l.realTokens);
        l.realEth = 0;
        l.realTokens = 0;
        l.phase = Phase.Graduated;

        emit Graduated(token, l.poolEth, l.poolTokens);
    }

    /// Withdraw everything the caller is owed (creator fees or protocol
    /// fees).
    function withdraw() external nonReentrant {
        _withdraw(msg.sender);
    }

    // ── Internal fee accounting ────────────────────────────────────────

    function _bookFees(Launch storage l, uint256 fee) internal {
        uint256 creatorCut = (fee * creatorShareBps) / 10_000;
        owed[l.creator] += creatorCut;
        owed[treasury] += fee - creatorCut;
        l.lifetimeCreatorFees += creatorCut;
    }

    function _withdraw(address to) internal {
        uint256 amount = owed[to];
        if (amount == 0) return;
        owed[to] = 0;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "eth send");
        emit Withdrawn(to, amount);
    }

    // ── Curve math (mirrors the Solana program; rounds against trader) ─

    function _reserves(Launch storage l) internal view returns (uint256, uint256) {
        if (l.phase == Phase.Graduated) return (l.poolEth, l.poolTokens);
        return (l.virtualEth, l.virtualTokens);
    }

    function _tokensOutForEth(uint256 rEth, uint256 rTok, uint256 ethIn) internal pure returns (uint256) {
        uint256 k = rEth * rTok;
        uint256 newTok = _divCeil(k, rEth + ethIn);
        return rTok - newTok;
    }

    function _ethOutForTokens(uint256 rEth, uint256 rTok, uint256 tokIn) internal pure returns (uint256) {
        uint256 k = rEth * rTok;
        uint256 newEth = _divCeil(k, rTok + tokIn);
        return rEth - newEth;
    }

    function _divCeil(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a + b - 1) / b;
    }

    // ── Views for the app and crank bot ────────────────────────────────

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function phaseOf(address token) external view returns (Phase) {
        return launches[token].phase;
    }

    function curveState(address token)
        external
        view
        returns (uint256 realEth, uint256 realTokens, uint256 poolEth, uint256 poolTokens)
    {
        Launch storage l = launches[token];
        return (l.realEth, l.realTokens, l.poolEth, l.poolTokens);
    }

    function committerCount(address token) external view returns (uint256) {
        return _committers[token].length;
    }

    function quoteBuy(address token, uint256 ethIn) external view returns (uint256) {
        Launch storage l = launches[token];
        (uint256 rEth, uint256 rTok) = _reserves(l);
        uint256 net = ethIn - (ethIn * feeBps) / 10_000;
        return _tokensOutForEth(rEth, rTok, net);
    }

    function quoteSell(address token, uint256 tokensIn) external view returns (uint256) {
        Launch storage l = launches[token];
        (uint256 rEth, uint256 rTok) = _reserves(l);
        uint256 gross = _ethOutForTokens(rEth, rTok, tokensIn);
        return gross - (gross * feeBps) / 10_000;
    }

    // ── Admin ──────────────────────────────────────────────────────────

    function setSalvoDuration(uint256 salvoDuration_) external onlyOwner {
        salvoDuration = salvoDuration_;
    }

    function setFeeSplit(uint256 feeBps_, uint256 creatorShareBps_) external onlyOwner {
        require(feeBps_ <= 300 && creatorShareBps_ <= 10_000, "bounds");
        feeBps = feeBps_;
        creatorShareBps = creatorShareBps_;
    }

    function setFees(uint256 launchFee_, uint256 migrationFee_) external onlyOwner {
        launchFee = launchFee_;
        migrationFee = migrationFee_;
    }

    function setCaps(uint256 walletCap_, uint256 globalCap_, uint256 graduationEth_) external onlyOwner {
        salvoWalletCap = walletCap_;
        salvoGlobalCap = globalCap_;
        graduationEth = graduationEth_;
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
    }

    function setOwner(address owner_) external onlyOwner {
        owner = owner_;
    }
}
