use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Phase {
    /// Batch-auction window: buys are commitments, nothing clears yet.
    Salvo,
    /// Normal bonding-curve trading.
    Live,
    /// Curve hit the graduation threshold; trading locked until migration.
    PendingMigration,
    /// Liquidity migrated to the AMM; curve is retired.
    Graduated,
}

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_bps: u64,
    pub holder_share_bps: u64,
    pub creator_share_bps: u64,
    pub protocol_share_bps: u64,
    pub launch_fee: u64,
    pub migration_fee: u64,
    pub salvo_duration_secs: i64,
    pub stake_cooldown_secs: i64,
    pub salvo_wallet_cap: u64,
    pub salvo_global_cap: u64,
    pub launch_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Curve {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub phase: Phase,

    // Bonding curve reserves (constant product over virtual reserves).
    pub virtual_sol: u64,
    pub virtual_tokens: u64,
    /// SOL actually held in the sol vault from curve buys (fees excluded).
    pub real_sol: u64,
    /// Tokens still available for sale on the curve.
    pub real_tokens: u64,

    // Salvo (batch auction) state.
    pub salvo_end_ts: i64,
    /// Gross SOL committed during the window.
    pub salvo_total_sol: u64,
    /// Tokens cleared for the whole batch at settle; claims are pro-rata.
    pub salvo_tokens_pool: u64,
    pub salvo_settled: bool,

    // Holder fee-share staking state (MasterChef-style accumulator).
    pub total_staked: u64,
    pub acc_reward_per_share: u128,
    /// Holder fees that arrived while nobody was staked; folded in on next stake.
    pub pending_holder_rewards: u64,
    /// Lifetime SOL routed to holders, for display.
    pub lifetime_holder_fees: u64,

    #[max_len(32)]
    pub name: String,
    #[max_len(10)]
    pub symbol: String,
    #[max_len(200)]
    pub uri: String,

    pub bump: u8,
    pub sol_vault_bump: u8,
    pub reward_vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SalvoCommit {
    pub curve: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StakePosition {
    pub curve: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub reward_debt: u128,
    /// Refreshed on every stake/top-up; unstake requires the cooldown to
    /// have passed since this timestamp.
    pub staked_at: i64,
    pub bump: u8,
}
