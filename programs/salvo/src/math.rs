use crate::errors::SalvoError;
use anchor_lang::prelude::*;

/// Constant-product buy: how many tokens come out for `sol_in` (fee already removed).
/// Rounds against the buyer so the curve can never be drained by rounding.
pub fn tokens_out_for_sol(virtual_sol: u64, virtual_tokens: u64, sol_in: u64) -> Result<u64> {
    let k = (virtual_sol as u128)
        .checked_mul(virtual_tokens as u128)
        .ok_or(SalvoError::MathOverflow)?;
    let new_sol = (virtual_sol as u128)
        .checked_add(sol_in as u128)
        .ok_or(SalvoError::MathOverflow)?;
    let new_tokens = k.div_ceil(new_sol);
    let out = (virtual_tokens as u128)
        .checked_sub(new_tokens)
        .ok_or(SalvoError::MathOverflow)?;
    u64::try_from(out).map_err(|_| SalvoError::MathOverflow.into())
}

/// Constant-product sell: how much SOL comes out for `tokens_in` (gross, before fee).
/// Rounds against the seller.
pub fn sol_out_for_tokens(virtual_sol: u64, virtual_tokens: u64, tokens_in: u64) -> Result<u64> {
    let k = (virtual_sol as u128)
        .checked_mul(virtual_tokens as u128)
        .ok_or(SalvoError::MathOverflow)?;
    let new_tokens = (virtual_tokens as u128)
        .checked_add(tokens_in as u128)
        .ok_or(SalvoError::MathOverflow)?;
    let new_sol = k.div_ceil(new_tokens);
    let out = (virtual_sol as u128)
        .checked_sub(new_sol)
        .ok_or(SalvoError::MathOverflow)?;
    u64::try_from(out).map_err(|_| SalvoError::MathOverflow.into())
}

/// Basis-points slice of an amount, floor-rounded.
pub fn bps(amount: u64, bps: u64) -> u64 {
    ((amount as u128) * (bps as u128) / 10_000) as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::*;

    #[test]
    fn curve_sells_out_near_graduation() {
        // Buying the entire 800M curve supply should cost roughly 85-90 SOL.
        let mut v_sol = INITIAL_VIRTUAL_SOL;
        let mut v_tok = INITIAL_VIRTUAL_TOKENS;
        let mut bought: u64 = 0;
        let mut spent: u64 = 0;
        while bought < CURVE_SUPPLY {
            let chunk = 1_000_000_000; // 1 SOL steps
            let out = tokens_out_for_sol(v_sol, v_tok, chunk).unwrap();
            if bought + out > CURVE_SUPPLY {
                break;
            }
            bought += out;
            spent += chunk;
            v_sol += chunk;
            v_tok -= out;
        }
        assert!(spent >= 80_000_000_000 && spent <= 95_000_000_000, "spent {spent}");
    }

    #[test]
    fn round_trip_never_profits() {
        // Buy then immediately sell the same tokens must return <= sol in.
        let v_sol = INITIAL_VIRTUAL_SOL;
        let v_tok = INITIAL_VIRTUAL_TOKENS;
        let sol_in = 5_000_000_000;
        let out = tokens_out_for_sol(v_sol, v_tok, sol_in).unwrap();
        let back = sol_out_for_tokens(v_sol + sol_in, v_tok - out, out).unwrap();
        assert!(back <= sol_in, "round trip profited: {back} > {sol_in}");
    }
}
