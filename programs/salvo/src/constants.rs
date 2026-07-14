/// Token has 6 decimals, matching the pump.fun convention.
pub const TOKEN_DECIMALS: u8 = 6;

/// 1,000,000,000 tokens total supply (raw units include 6 decimals).
pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000;

/// 800,000,000 tokens sold on the bonding curve.
pub const CURVE_SUPPLY: u64 = 800_000_000_000_000;

/// 200,000,000 tokens reserved for AMM liquidity at graduation.
pub const LP_RESERVE: u64 = TOTAL_SUPPLY - CURVE_SUPPLY;

/// Virtual reserves seed the constant-product curve so price starts
/// non-zero and moves smoothly: k = virtual_sol * virtual_tokens.
pub const INITIAL_VIRTUAL_SOL: u64 = 30_000_000_000; // 30 SOL
pub const INITIAL_VIRTUAL_TOKENS: u64 = 1_073_000_000_000_000; // 1.073B tokens

/// Curve graduates (locks for AMM migration) once real SOL collected hits this.
pub const GRADUATION_SOL: u64 = 85_000_000_000; // 85 SOL

/// Trade fee: 1% of SOL notional on every buy and sell.
pub const FEE_BPS: u64 = 100;

/// How the 1% fee is split. Must sum to 10_000.
pub const HOLDER_SHARE_BPS: u64 = 5_000; // 50% to staked holders
pub const CREATOR_SHARE_BPS: u64 = 2_500; // 25% to the token creator
pub const PROTOCOL_SHARE_BPS: u64 = 2_500; // 25% to protocol treasury

/// Flat platform fee paid by the creator at launch, straight to the treasury.
pub const LAUNCH_FEE: u64 = 20_000_000; // 0.02 SOL
/// Platform fee skimmed from raised SOL at graduation, before LP seeding.
pub const MIGRATION_FEE: u64 = 2_000_000_000; // 2 SOL

/// The salvo: batch-auction window at launch. All commits clear at one price.
pub const SALVO_DURATION_SECS: i64 = 120;
/// Per-wallet commit cap during the salvo, so whales can't own the launch.
pub const SALVO_WALLET_CAP: u64 = 2_000_000_000; // 2 SOL
/// Global salvo cap keeps the batch from blowing past graduation in one settle.
pub const SALVO_GLOBAL_CAP: u64 = 40_000_000_000; // 40 SOL

/// Fixed-point precision for the staking reward accumulator.
pub const ACC_PRECISION: u128 = 1_000_000_000_000;

/// Anti flash-stake: tokens are locked for this long after each stake or
/// top-up, so nobody can stake into a whale's trade and unstake right after.
pub const STAKE_COOLDOWN_SECS: i64 = 300; // 5 minutes

/// Minimum resulting stake (1,000 tokens). Keeps dust positions from
/// inflating the accumulator's per-share growth to pathological values.
pub const MIN_STAKE: u64 = 1_000_000_000;

pub const CURVE_SEED: &[u8] = b"curve";
pub const SOL_VAULT_SEED: &[u8] = b"sol_vault";
pub const REWARD_VAULT_SEED: &[u8] = b"reward_vault";
pub const TOKEN_VAULT_SEED: &[u8] = b"token_vault";
pub const STAKE_VAULT_SEED: &[u8] = b"stake_vault";
pub const COMMIT_SEED: &[u8] = b"commit";
pub const POSITION_SEED: &[u8] = b"position";
pub const CONFIG_SEED: &[u8] = b"config";
