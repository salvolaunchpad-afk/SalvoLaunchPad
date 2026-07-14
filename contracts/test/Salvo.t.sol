// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Salvo} from "../src/Salvo.sol";
import {SalvoToken} from "../src/SalvoToken.sol";

contract SalvoTest is Test {
    Salvo salvo;
    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    function setUp() public {
        salvo = new Salvo(treasury);
        vm.deal(creator, 10 ether);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
        vm.deal(dave, 10 ether);
    }

    function _launch() internal returns (address token) {
        // NB: config reads are hoisted before pranks everywhere in this
        // file — a view call would consume the prank otherwise.
        uint256 fee = salvo.launchFee();
        vm.prank(creator);
        token = salvo.createLaunch{value: fee}("Trench Rat", "RAT", "ipfs://rat");
    }

    function test_launchFeeEnforced() public {
        vm.prank(creator);
        vm.expectRevert(Salvo.WrongFee.selector);
        salvo.createLaunch{value: 0}("X", "X", "");
    }

    function test_salvoCapsEnforced() public {
        address token = _launch();
        uint256 cap = salvo.salvoWalletCap();

        vm.prank(alice);
        vm.expectRevert(Salvo.WalletCapExceeded.selector);
        salvo.commit{value: cap + 1}(token);

        // Fill wallet cap exactly: fine.
        vm.prank(alice);
        salvo.commit{value: cap}(token);

        // Top-up past the cap: rejected.
        vm.prank(alice);
        vm.expectRevert(Salvo.WalletCapExceeded.selector);
        salvo.commit{value: 1}(token);
    }

    function test_cannotTradeDuringSalvo() public {
        address token = _launch();
        vm.prank(alice);
        vm.expectRevert(Salvo.PhaseMismatch.selector);
        salvo.buy{value: 0.1 ether}(token, 0);
    }

    function test_fullLifecycle() public {
        address token = _launch();
        SalvoToken t = SalvoToken(token);

        // ── Salvo: alice commits 2x bob ──
        vm.prank(alice);
        salvo.commit{value: 0.04 ether}(token);
        vm.prank(bob);
        salvo.commit{value: 0.02 ether}(token);

        vm.expectRevert(Salvo.SalvoNotEnded.selector);
        salvo.settle(token);

        vm.warp(block.timestamp + salvo.salvoDuration() + 1);
        salvo.settle(token);
        assertEq(uint256(salvo.phaseOf(token)), uint256(Salvo.Phase.Live));

        // ── Auto-delivery: pro-rata at ONE price ──
        salvo.distribute(token, 50);
        uint256 aliceTokens = t.balanceOf(alice);
        uint256 bobTokens = t.balanceOf(bob);
        assertGt(bobTokens, 0);
        // alice committed exactly 2x bob, so she gets exactly 2x the tokens
        // (same clearing price), allowing 1 wei of rounding.
        assertApproxEqAbs(aliceTokens, bobTokens * 2, 1);

        // ── Live trading: fees split and booked ──
        uint256 treasuryOwedBefore = salvo.owed(treasury);
        uint256 creatorOwedBefore = salvo.owed(creator);
        uint256 quoted = salvo.quoteBuy(token, 0.5 ether);
        vm.prank(carol);
        salvo.buy{value: 0.5 ether}(token, quoted);
        assertEq(t.balanceOf(carol), quoted);
        assertGt(salvo.owed(treasury), treasuryOwedBefore);
        assertGt(salvo.owed(creator), creatorOwedBefore);

        // ── Staking: earn ETH from the next trade ──
        uint256 minStake = salvo.minStake();
        vm.startPrank(carol);
        t.approve(address(salvo), type(uint256).max);
        salvo.stake(token, minStake);
        vm.stopPrank();

        vm.prank(dave);
        salvo.buy{value: 0.3 ether}(token, 0);
        assertGt(salvo.pendingRewards(token, carol), 0);

        uint256 carolEthBefore = carol.balance;
        vm.prank(carol);
        salvo.claimRewards(token);
        assertGt(carol.balance, carolEthBefore);

        // ── Flash-stake protection ──
        vm.prank(carol);
        vm.expectRevert(Salvo.StakeLocked.selector);
        salvo.unstake(token, minStake);

        vm.warp(block.timestamp + salvo.stakeCooldown() + 1);
        vm.prank(carol);
        salvo.unstake(token, minStake);

        // ── Dust-stake protection ──
        vm.prank(carol);
        vm.expectRevert(Salvo.StakeTooSmall.selector);
        salvo.stake(token, 1);

        // ── Graduate: buy until the curve fills ──
        vm.deal(dave, 100 ether);
        uint256 guard;
        while (salvo.phaseOf(token) == Salvo.Phase.Live) {
            vm.prank(dave);
            salvo.buy{value: 0.2 ether}(token, 0);
            guard++;
            assertLt(guard, 100, "never graduated");
        }
        assertEq(uint256(salvo.phaseOf(token)), uint256(Salvo.Phase.Graduated));

        (,, uint256 poolEth, uint256 poolTokens) = salvo.curveState(token);
        assertGt(poolEth, 0);
        assertEq(poolTokens, salvo.LP_RESERVE());
        // Unsold curve inventory burned at graduation.
        assertLt(t.totalSupply(), salvo.TOTAL_SUPPLY());

        // ── Post-graduation trading + fee flow continue ──
        uint256 lifetimeBefore = _lifetimeHolderFees(token);
        vm.prank(dave);
        salvo.buy{value: 0.1 ether}(token, 0);
        vm.startPrank(dave);
        t.approve(address(salvo), type(uint256).max);
        salvo.sell(token, t.balanceOf(dave) / 2, 0);
        vm.stopPrank();
        assertGt(_lifetimeHolderFees(token), lifetimeBefore);

        // ── Solvency: contract holds at least everything it owes ──
        (uint256 realEth,, uint256 poolEth2,) = salvo.curveState(token);
        uint256 liabilities = realEth + poolEth2 + salvo.owed(treasury) + salvo.owed(creator)
            + salvo.owed(carol) + salvo.pendingRewards(token, carol) + _pendingHolderRewards(token);
        assertGe(address(salvo).balance, liabilities);

        // ── Withdrawals actually pay ──
        uint256 treasuryBefore = treasury.balance;
        vm.prank(treasury);
        salvo.withdraw();
        assertGt(treasury.balance, treasuryBefore);
    }

    function test_roundTripNeverProfits() public {
        address token = _launch();
        vm.warp(block.timestamp + salvo.salvoDuration() + 1);
        salvo.settle(token);

        uint256 spend = 1 ether;
        vm.startPrank(carol);
        salvo.buy{value: spend}(token, 0);
        SalvoToken t = SalvoToken(token);
        t.approve(address(salvo), type(uint256).max);
        uint256 before = carol.balance;
        salvo.sell(token, t.balanceOf(carol), 0);
        vm.stopPrank();
        assertLt(carol.balance - before, spend, "round trip profited");
    }

    function _lifetimeHolderFees(address token) internal view returns (uint256 v) {
        (,,,,,,,,,,,,,,,,, v,) = _launchTuple(token);
    }

    function _pendingHolderRewards(address token) internal view returns (uint256 v) {
        (,,,,,,,,,,,,,,,, v,,) = _launchTuple(token);
    }

    function _launchTuple(address token)
        internal
        view
        returns (
            address,
            uint64,
            uint64,
            Salvo.Phase,
            bool,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            string memory
        )
    {
        return salvo.launches(token);
    }
}
