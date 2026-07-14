use anchor_lang::prelude::*;

#[event]
pub struct LaunchCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub salvo_end_ts: i64,
}

#[event]
pub struct SalvoCommitted {
    pub mint: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub salvo_total_sol: u64,
}

#[event]
pub struct SalvoSettled {
    pub mint: Pubkey,
    pub net_sol: u64,
    pub tokens_cleared: u64,
}

#[event]
pub struct SalvoDistributed {
    pub mint: Pubkey,
    pub buyer: Pubkey,
    pub tokens: u64,
}

#[event]
pub struct Traded {
    pub mint: Pubkey,
    pub trader: Pubkey,
    pub is_buy: bool,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub virtual_sol: u64,
    pub virtual_tokens: u64,
    pub real_sol: u64,
}

#[event]
pub struct Staked {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
}

#[event]
pub struct Unstaked {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
}

#[event]
pub struct RewardsClaimed {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub lamports: u64,
}

#[event]
pub struct GraduationReady {
    pub mint: Pubkey,
    pub real_sol: u64,
}
