use anchor_lang::prelude::*;

#[error_code]
pub enum SalvoError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Action not valid in the token's current phase")]
    PhaseMismatch,
    #[msg("The salvo window has already ended")]
    SalvoEnded,
    #[msg("The salvo window has not ended yet")]
    SalvoNotEnded,
    #[msg("Commit would exceed the per-wallet salvo cap")]
    WalletCapExceeded,
    #[msg("Commit would exceed the global salvo cap")]
    GlobalCapExceeded,
    #[msg("Output below minimum — slippage exceeded")]
    SlippageExceeded,
    #[msg("Not enough tokens left on the curve for this buy")]
    InsufficientCurveTokens,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Salvo allocation already claimed")]
    AlreadyClaimed,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Insufficient staked balance")]
    InsufficientStake,
    #[msg("Stake is still in its 5-minute cooldown")]
    StakeLocked,
    #[msg("Resulting stake would be below the 1,000 token minimum")]
    StakeTooSmall,
    #[msg("Name, symbol, or URI exceeds maximum length")]
    StringTooLong,
}
