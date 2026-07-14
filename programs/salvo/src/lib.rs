use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{
    self, spl_token::instruction::AuthorityType, Mint, SetAuthority, Token, TokenAccount,
};

pub mod constants;
pub mod errors;
pub mod events;
pub mod math;
pub mod state;

use constants::*;
use errors::SalvoError;
use events::*;
use math::{bps, sol_out_for_tokens, tokens_out_for_sol};
use state::*;

// Placeholder id — replaced by `anchor keys sync` after first build.
declare_id!("yY4cYAc6iE2WtaPbcbsBVqEH5b7sjvsSunt4itujQa3");

#[program]
pub mod salvo {
    use super::*;

    /// Durations are parameters (not constants) so integration tests can run
    /// short salvos; production uses SALVO_DURATION_SECS / STAKE_COOLDOWN_SECS.
    pub fn initialize(
        ctx: Context<Initialize>,
        salvo_duration_secs: i64,
        stake_cooldown_secs: i64,
    ) -> Result<()> {
        require!(salvo_duration_secs > 0, SalvoError::ZeroAmount);
        require!(stake_cooldown_secs >= 0, SalvoError::ZeroAmount);
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_bps = FEE_BPS;
        config.holder_share_bps = HOLDER_SHARE_BPS;
        config.creator_share_bps = CREATOR_SHARE_BPS;
        config.protocol_share_bps = PROTOCOL_SHARE_BPS;
        config.launch_fee = LAUNCH_FEE;
        config.migration_fee = MIGRATION_FEE;
        config.salvo_duration_secs = salvo_duration_secs;
        config.stake_cooldown_secs = stake_cooldown_secs;
        config.salvo_wallet_cap = SALVO_WALLET_CAP;
        config.salvo_global_cap = SALVO_GLOBAL_CAP;
        config.launch_count = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// One click: creates the mint, mints full supply to the curve's vault,
    /// burns the mint authority, and opens the salvo window.
    pub fn create_launch(
        ctx: Context<CreateLaunch>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        require!(name.len() <= 32, SalvoError::StringTooLong);
        require!(symbol.len() <= 10, SalvoError::StringTooLong);
        require!(uri.len() <= 200, SalvoError::StringTooLong);

        let now = Clock::get()?.unix_timestamp;
        let config = &mut ctx.accounts.config;
        let mint_key = ctx.accounts.mint.key();
        let curve_bump = ctx.bumps.curve;

        // Mint the entire fixed supply into the curve's token vault…
        let seeds: &[&[u8]] = &[CURVE_SEED, mint_key.as_ref(), &[curve_bump]];
        let signer: &[&[&[u8]]] = &[seeds];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.curve.to_account_info(),
                },
                signer,
            ),
            TOTAL_SUPPLY,
        )?;
        // …then burn the mint authority so supply can never inflate.
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.curve.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                signer,
            ),
            AuthorityType::MintTokens,
            None,
        )?;

        // Seed both lamport vaults with rent-exempt minimum so they persist.
        let rent_min = Rent::get()?.minimum_balance(0);
        for vault in [
            ctx.accounts.sol_vault.to_account_info(),
            ctx.accounts.reward_vault.to_account_info(),
        ] {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.creator.to_account_info(),
                        to: vault,
                    },
                ),
                rent_min,
            )?;
        }

        // Flat platform fee for the launch.
        if config.launch_fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.creator.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                config.launch_fee,
            )?;
        }

        let curve = &mut ctx.accounts.curve;
        curve.mint = mint_key;
        curve.creator = ctx.accounts.creator.key();
        curve.phase = Phase::Salvo;
        curve.virtual_sol = INITIAL_VIRTUAL_SOL;
        curve.virtual_tokens = INITIAL_VIRTUAL_TOKENS;
        curve.real_sol = 0;
        curve.real_tokens = CURVE_SUPPLY;
        curve.salvo_end_ts = now + config.salvo_duration_secs;
        curve.salvo_total_sol = 0;
        curve.salvo_tokens_pool = 0;
        curve.salvo_settled = false;
        curve.total_staked = 0;
        curve.acc_reward_per_share = 0;
        curve.pending_holder_rewards = 0;
        curve.lifetime_holder_fees = 0;
        curve.name = name.clone();
        curve.symbol = symbol.clone();
        curve.uri = uri;
        curve.bump = curve_bump;
        curve.sol_vault_bump = ctx.bumps.sol_vault;
        curve.reward_vault_bump = ctx.bumps.reward_vault;

        config.launch_count += 1;

        emit!(LaunchCreated {
            mint: mint_key,
            creator: curve.creator,
            name,
            symbol,
            salvo_end_ts: curve.salvo_end_ts,
        });
        Ok(())
    }

    /// Commit SOL during the salvo window. No tokens move yet — everyone in
    /// the window clears at the same price when the batch settles. The
    /// buyer's ATA is created here (buyer pays its rent) so distribution
    /// after settle can never fail on a missing account.
    pub fn salvo_commit(ctx: Context<SalvoCommitIx>, amount: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let config = &ctx.accounts.config;
        let curve = &mut ctx.accounts.curve;

        require!(amount > 0, SalvoError::ZeroAmount);
        require!(curve.phase == Phase::Salvo, SalvoError::PhaseMismatch);
        require!(now < curve.salvo_end_ts, SalvoError::SalvoEnded);

        let commit = &mut ctx.accounts.commit;
        require!(
            commit.amount + amount <= config.salvo_wallet_cap,
            SalvoError::WalletCapExceeded
        );
        require!(
            curve.salvo_total_sol + amount <= config.salvo_global_cap,
            SalvoError::GlobalCapExceeded
        );

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.sol_vault.to_account_info(),
                },
            ),
            amount,
        )?;

        commit.curve = curve.key();
        commit.buyer = ctx.accounts.buyer.key();
        commit.amount += amount;
        commit.bump = ctx.bumps.commit;
        curve.salvo_total_sol += amount;

        emit!(SalvoCommitted {
            mint: curve.mint,
            buyer: commit.buyer,
            amount,
            salvo_total_sol: curve.salvo_total_sol,
        });
        Ok(())
    }

    /// Permissionless crank: after the window closes, the whole batch executes
    /// as ONE buy on the curve. Everyone gets the same average price — there
    /// is nothing for a sniper to win.
    pub fn salvo_settle(ctx: Context<SalvoSettle>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let config = &ctx.accounts.config;
        let curve_key = ctx.accounts.curve.key();

        {
            let curve = &ctx.accounts.curve;
            require!(curve.phase == Phase::Salvo, SalvoError::PhaseMismatch);
            require!(now >= curve.salvo_end_ts, SalvoError::SalvoNotEnded);
        }

        let total = ctx.accounts.curve.salvo_total_sol;
        if total == 0 {
            let curve = &mut ctx.accounts.curve;
            curve.phase = Phase::Live;
            curve.salvo_settled = true;
            return Ok(());
        }

        let fee = bps(total, config.fee_bps);
        let net = total - fee;
        let holder_cut = bps(fee, config.holder_share_bps);
        let creator_cut = bps(fee, config.creator_share_bps);
        let protocol_cut = fee - holder_cut - creator_cut;

        let (v_sol, v_tok, real_tokens) = {
            let c = &ctx.accounts.curve;
            (c.virtual_sol, c.virtual_tokens, c.real_tokens)
        };
        let tokens = tokens_out_for_sol(v_sol, v_tok, net)?;
        require!(tokens <= real_tokens, SalvoError::InsufficientCurveTokens);

        // Pay the fee splits out of the vault.
        let sol_vault_bump = ctx.accounts.curve.sol_vault_bump;
        let vault_seeds: &[&[u8]] = &[SOL_VAULT_SEED, curve_key.as_ref(), &[sol_vault_bump]];
        vault_transfer(
            &ctx.accounts.sol_vault.to_account_info(),
            &ctx.accounts.creator_wallet.to_account_info(),
            &ctx.accounts.system_program,
            vault_seeds,
            creator_cut,
        )?;
        vault_transfer(
            &ctx.accounts.sol_vault.to_account_info(),
            &ctx.accounts.reward_vault.to_account_info(),
            &ctx.accounts.system_program,
            vault_seeds,
            holder_cut,
        )?;
        vault_transfer(
            &ctx.accounts.sol_vault.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            &ctx.accounts.system_program,
            vault_seeds,
            protocol_cut,
        )?;

        let curve = &mut ctx.accounts.curve;
        curve.virtual_sol += net;
        curve.virtual_tokens -= tokens;
        curve.real_sol += net;
        curve.real_tokens -= tokens;
        curve.salvo_tokens_pool = tokens;
        curve.salvo_settled = true;
        curve.phase = Phase::Live;
        update_holder_rewards(curve, holder_cut);
        check_graduation(curve);

        emit!(SalvoSettled {
            mint: curve.mint,
            net_sol: net,
            tokens_cleared: tokens,
        });
        Ok(())
    }

    /// Permissionless delivery crank: after settle, ANYONE can push a
    /// committer's pro-rata tokens straight to their wallet — the platform
    /// bot cranks every commit so buyers never have to claim. Commit rent
    /// is refunded to the buyer on close.
    pub fn salvo_distribute(ctx: Context<SalvoDistribute>) -> Result<()> {
        let curve = &ctx.accounts.curve;
        require!(curve.salvo_settled, SalvoError::SalvoNotEnded);

        let commit = &ctx.accounts.commit;
        require!(commit.amount > 0, SalvoError::NothingToClaim);

        let tokens = ((curve.salvo_tokens_pool as u128) * (commit.amount as u128)
            / (curve.salvo_total_sol as u128)) as u64;

        if tokens > 0 {
            let mint_key = curve.mint;
            let seeds: &[&[u8]] = &[CURVE_SEED, mint_key.as_ref(), &[curve.bump]];
            let signer: &[&[&[u8]]] = &[seeds];
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.token_vault.to_account_info(),
                        to: ctx.accounts.buyer_ata.to_account_info(),
                        authority: ctx.accounts.curve.to_account_info(),
                    },
                    signer,
                ),
                tokens,
            )?;
        }

        emit!(SalvoDistributed {
            mint: curve.mint,
            buyer: ctx.accounts.buyer.key(),
            tokens,
        });
        Ok(())
    }

    /// Live-phase buy on the bonding curve. 1% fee, split 50/25/25 between
    /// staked holders, the creator, and the protocol treasury.
    pub fn buy(ctx: Context<Trade>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        require!(sol_amount > 0, SalvoError::ZeroAmount);
        require!(
            ctx.accounts.curve.phase == Phase::Live,
            SalvoError::PhaseMismatch
        );

        let config = &ctx.accounts.config;
        let fee = bps(sol_amount, config.fee_bps);
        let net = sol_amount - fee;
        let holder_cut = bps(fee, config.holder_share_bps);
        let creator_cut = bps(fee, config.creator_share_bps);
        let protocol_cut = fee - holder_cut - creator_cut;

        let (v_sol, v_tok, real_tokens) = {
            let c = &ctx.accounts.curve;
            (c.virtual_sol, c.virtual_tokens, c.real_tokens)
        };
        let tokens = tokens_out_for_sol(v_sol, v_tok, net)?;
        require!(tokens >= min_tokens_out, SalvoError::SlippageExceeded);
        require!(tokens <= real_tokens, SalvoError::InsufficientCurveTokens);

        // Buyer pays curve + all fee legs directly (buyer signs, no PDA needed).
        for (to, lamports) in [
            (ctx.accounts.sol_vault.to_account_info(), net),
            (ctx.accounts.creator_wallet.to_account_info(), creator_cut),
            (ctx.accounts.reward_vault.to_account_info(), holder_cut),
            (ctx.accounts.treasury.to_account_info(), protocol_cut),
        ] {
            if lamports == 0 {
                continue;
            }
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.trader.to_account_info(),
                        to,
                    },
                ),
                lamports,
            )?;
        }

        let mint_key = ctx.accounts.curve.mint;
        let curve_bump = ctx.accounts.curve.bump;
        let seeds: &[&[u8]] = &[CURVE_SEED, mint_key.as_ref(), &[curve_bump]];
        let signer: &[&[&[u8]]] = &[seeds];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.trader_ata.to_account_info(),
                    authority: ctx.accounts.curve.to_account_info(),
                },
                signer,
            ),
            tokens,
        )?;

        let curve = &mut ctx.accounts.curve;
        curve.virtual_sol += net;
        curve.virtual_tokens -= tokens;
        curve.real_sol += net;
        curve.real_tokens -= tokens;
        update_holder_rewards(curve, holder_cut);
        check_graduation(curve);

        emit!(Traded {
            mint: curve.mint,
            trader: ctx.accounts.trader.key(),
            is_buy: true,
            sol_amount,
            token_amount: tokens,
            virtual_sol: curve.virtual_sol,
            virtual_tokens: curve.virtual_tokens,
            real_sol: curve.real_sol,
        });
        Ok(())
    }

    /// Live-phase sell back to the curve. Same fee and split as buys.
    pub fn sell(ctx: Context<Trade>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        require!(token_amount > 0, SalvoError::ZeroAmount);
        require!(
            ctx.accounts.curve.phase == Phase::Live,
            SalvoError::PhaseMismatch
        );

        let config = &ctx.accounts.config;
        let (v_sol, v_tok, real_sol) = {
            let c = &ctx.accounts.curve;
            (c.virtual_sol, c.virtual_tokens, c.real_sol)
        };
        let gross = sol_out_for_tokens(v_sol, v_tok, token_amount)?;
        require!(gross <= real_sol, SalvoError::MathOverflow);

        let fee = bps(gross, config.fee_bps);
        let net = gross - fee;
        require!(net >= min_sol_out, SalvoError::SlippageExceeded);
        let holder_cut = bps(fee, config.holder_share_bps);
        let creator_cut = bps(fee, config.creator_share_bps);
        let protocol_cut = fee - holder_cut - creator_cut;

        // Tokens back to the curve vault (seller signs).
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.trader_ata.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // SOL out of the vault: net to seller, fee legs to their destinations.
        let curve_key = ctx.accounts.curve.key();
        let sol_vault_bump = ctx.accounts.curve.sol_vault_bump;
        let vault_seeds: &[&[u8]] = &[SOL_VAULT_SEED, curve_key.as_ref(), &[sol_vault_bump]];
        for (to, lamports) in [
            (ctx.accounts.trader.to_account_info(), net),
            (ctx.accounts.creator_wallet.to_account_info(), creator_cut),
            (ctx.accounts.reward_vault.to_account_info(), holder_cut),
            (ctx.accounts.treasury.to_account_info(), protocol_cut),
        ] {
            vault_transfer(
                &ctx.accounts.sol_vault.to_account_info(),
                &to,
                &ctx.accounts.system_program,
                vault_seeds,
                lamports,
            )?;
        }

        let curve = &mut ctx.accounts.curve;
        curve.virtual_sol -= gross;
        curve.virtual_tokens += token_amount;
        curve.real_sol -= gross;
        curve.real_tokens += token_amount;
        update_holder_rewards(curve, holder_cut);

        emit!(Traded {
            mint: curve.mint,
            trader: ctx.accounts.trader.key(),
            is_buy: false,
            sol_amount: net,
            token_amount,
            virtual_sol: curve.virtual_sol,
            virtual_tokens: curve.virtual_tokens,
            real_sol: curve.real_sol,
        });
        Ok(())
    }

    /// Stake tokens to earn the holder share of every trade fee, paid in SOL.
    /// Each stake (including top-ups) restarts the anti-flash-stake cooldown.
    pub fn stake(ctx: Context<StakeIx>, amount: u64) -> Result<()> {
        require!(amount > 0, SalvoError::ZeroAmount);
        require!(
            ctx.accounts.position.amount + amount >= MIN_STAKE,
            SalvoError::StakeTooSmall
        );
        harvest(
            &mut ctx.accounts.position,
            &ctx.accounts.curve,
            &ctx.accounts.reward_vault.to_account_info(),
            &ctx.accounts.owner.to_account_info(),
            &ctx.accounts.system_program,
        )?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.owner_ata.to_account_info(),
                    to: ctx.accounts.stake_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        let curve = &mut ctx.accounts.curve;
        let position = &mut ctx.accounts.position;
        position.curve = curve.key();
        position.owner = ctx.accounts.owner.key();
        position.amount += amount;
        position.staked_at = Clock::get()?.unix_timestamp;
        position.bump = ctx.bumps.position;
        curve.total_staked += amount;
        // Fold in any fees that accrued while nobody was staked.
        update_holder_rewards(curve, 0);
        position.reward_debt =
            (position.amount as u128) * curve.acc_reward_per_share / ACC_PRECISION;

        emit!(Staked {
            mint: curve.mint,
            owner: position.owner,
            amount,
            total_staked: curve.total_staked,
        });
        Ok(())
    }

    pub fn unstake(ctx: Context<StakeIx>, amount: u64) -> Result<()> {
        require!(amount > 0, SalvoError::ZeroAmount);
        require!(
            ctx.accounts.position.amount >= amount,
            SalvoError::InsufficientStake
        );
        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= ctx.accounts.position.staked_at + ctx.accounts.config.stake_cooldown_secs,
            SalvoError::StakeLocked
        );
        harvest(
            &mut ctx.accounts.position,
            &ctx.accounts.curve,
            &ctx.accounts.reward_vault.to_account_info(),
            &ctx.accounts.owner.to_account_info(),
            &ctx.accounts.system_program,
        )?;

        let mint_key = ctx.accounts.curve.mint;
        let curve_bump = ctx.accounts.curve.bump;
        let seeds: &[&[u8]] = &[CURVE_SEED, mint_key.as_ref(), &[curve_bump]];
        let signer: &[&[&[u8]]] = &[seeds];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.stake_vault.to_account_info(),
                    to: ctx.accounts.owner_ata.to_account_info(),
                    authority: ctx.accounts.curve.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        let curve = &mut ctx.accounts.curve;
        let position = &mut ctx.accounts.position;
        position.amount -= amount;
        curve.total_staked -= amount;
        position.reward_debt =
            (position.amount as u128) * curve.acc_reward_per_share / ACC_PRECISION;

        emit!(Unstaked {
            mint: curve.mint,
            owner: position.owner,
            amount,
            total_staked: curve.total_staked,
        });
        Ok(())
    }

    /// Harvest accrued SOL rewards without changing the staked amount.
    pub fn claim_rewards(ctx: Context<StakeIx>) -> Result<()> {
        let claimed = harvest(
            &mut ctx.accounts.position,
            &ctx.accounts.curve,
            &ctx.accounts.reward_vault.to_account_info(),
            &ctx.accounts.owner.to_account_info(),
            &ctx.accounts.system_program,
        )?;
        let curve = &ctx.accounts.curve;
        let position = &mut ctx.accounts.position;
        position.reward_debt =
            (position.amount as u128) * curve.acc_reward_per_share / ACC_PRECISION;

        emit!(RewardsClaimed {
            mint: curve.mint,
            owner: position.owner,
            lamports: claimed,
        });
        Ok(())
    }

    /// Takes the flat migration fee to the treasury and retires the curve.
    /// TODO v2: seed the SalvoSwap pool with the remaining real_sol +
    /// LP_RESERVE tokens in this same instruction (protocol-owned single-LP
    /// AMM, same 50/25/25 fee split, so staker rewards outlive the curve).
    pub fn migrate(ctx: Context<Migrate>) -> Result<()> {
        require!(
            ctx.accounts.curve.phase == Phase::PendingMigration,
            SalvoError::PhaseMismatch
        );

        let fee = ctx
            .accounts
            .config
            .migration_fee
            .min(ctx.accounts.curve.real_sol);
        let curve_key = ctx.accounts.curve.key();
        let sol_vault_bump = ctx.accounts.curve.sol_vault_bump;
        let vault_seeds: &[&[u8]] = &[SOL_VAULT_SEED, curve_key.as_ref(), &[sol_vault_bump]];
        vault_transfer(
            &ctx.accounts.sol_vault.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            &ctx.accounts.system_program,
            vault_seeds,
            fee,
        )?;

        let curve = &mut ctx.accounts.curve;
        curve.real_sol -= fee;
        curve.phase = Phase::Graduated;
        Ok(())
    }
}

fn update_holder_rewards(curve: &mut Curve, amount: u64) {
    let total = amount + curve.pending_holder_rewards;
    if curve.total_staked > 0 && total > 0 {
        curve.acc_reward_per_share +=
            (total as u128) * ACC_PRECISION / (curve.total_staked as u128);
        curve.pending_holder_rewards = 0;
    } else {
        curve.pending_holder_rewards = total;
    }
    curve.lifetime_holder_fees += amount;
}

fn check_graduation(curve: &mut Curve) {
    if curve.real_sol >= GRADUATION_SOL {
        curve.phase = Phase::PendingMigration;
        emit!(GraduationReady {
            mint: curve.mint,
            real_sol: curve.real_sol,
        });
    }
}

fn vault_transfer<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    system_program: &Program<'info, System>,
    seeds: &[&[u8]],
    lamports: u64,
) -> Result<()> {
    if lamports == 0 {
        return Ok(());
    }
    let signer: &[&[&[u8]]] = &[seeds];
    system_program::transfer(
        CpiContext::new_with_signer(
            system_program.to_account_info(),
            system_program::Transfer {
                from: from.clone(),
                to: to.clone(),
            },
            signer,
        ),
        lamports,
    )
}

/// Pay out any rewards owed to a position at the current accumulator.
/// Caller is responsible for resetting reward_debt afterwards.
fn harvest<'info>(
    position: &mut Account<'info, StakePosition>,
    curve: &Account<'info, Curve>,
    reward_vault: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    system_program: &Program<'info, System>,
) -> Result<u64> {
    if position.amount == 0 {
        return Ok(0);
    }
    let accrued = (position.amount as u128) * curve.acc_reward_per_share / ACC_PRECISION;
    let pending = accrued.saturating_sub(position.reward_debt) as u64;
    if pending > 0 {
        let curve_key = curve.key();
        let seeds: &[&[u8]] = &[
            REWARD_VAULT_SEED,
            curve_key.as_ref(),
            &[curve.reward_vault_bump],
        ];
        vault_transfer(reward_vault, owner, system_program, seeds, pending)?;
    }
    Ok(pending)
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: destination wallet for protocol fees, chosen by the authority.
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateLaunch<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(
        init,
        payer = creator,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = curve,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        space = 8 + Curve::INIT_SPACE,
        seeds = [CURVE_SEED, mint.key().as_ref()],
        bump
    )]
    pub curve: Account<'info, Curve>,
    #[account(
        init,
        payer = creator,
        seeds = [TOKEN_VAULT_SEED, curve.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = curve,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = creator,
        seeds = [STAKE_VAULT_SEED, curve.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = curve,
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    /// CHECK: zero-data lamport vault PDA, owned by the system program.
    #[account(mut, seeds = [SOL_VAULT_SEED, curve.key().as_ref()], bump)]
    pub sol_vault: UncheckedAccount<'info>,
    /// CHECK: zero-data lamport vault PDA for holder rewards.
    #[account(mut, seeds = [REWARD_VAULT_SEED, curve.key().as_ref()], bump)]
    pub reward_vault: UncheckedAccount<'info>,
    /// CHECK: launch-fee destination, must match the config's treasury.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SalvoCommitIx<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [CURVE_SEED, curve.mint.as_ref()], bump = curve.bump)]
    pub curve: Account<'info, Curve>,
    #[account(address = curve.mint)]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + SalvoCommit::INIT_SPACE,
        seeds = [COMMIT_SEED, curve.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub commit: Account<'info, SalvoCommit>,
    /// Created now so post-settle distribution can never fail on a
    /// missing token account.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Account<'info, TokenAccount>,
    /// CHECK: lamport vault PDA validated by seeds.
    #[account(mut, seeds = [SOL_VAULT_SEED, curve.key().as_ref()], bump = curve.sol_vault_bump)]
    pub sol_vault: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SalvoSettle<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [CURVE_SEED, curve.mint.as_ref()], bump = curve.bump)]
    pub curve: Account<'info, Curve>,
    /// CHECK: lamport vault PDA validated by seeds.
    #[account(mut, seeds = [SOL_VAULT_SEED, curve.key().as_ref()], bump = curve.sol_vault_bump)]
    pub sol_vault: UncheckedAccount<'info>,
    /// CHECK: lamport vault PDA validated by seeds.
    #[account(mut, seeds = [REWARD_VAULT_SEED, curve.key().as_ref()], bump = curve.reward_vault_bump)]
    pub reward_vault: UncheckedAccount<'info>,
    /// CHECK: fee destination, must match the curve's recorded creator.
    #[account(mut, address = curve.creator)]
    pub creator_wallet: UncheckedAccount<'info>,
    /// CHECK: fee destination, must match the config's treasury.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SalvoDistribute<'info> {
    /// Anyone may crank; the platform bot does in practice.
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(seeds = [CURVE_SEED, curve.mint.as_ref()], bump = curve.bump)]
    pub curve: Account<'info, Curve>,
    #[account(address = curve.mint)]
    pub mint: Account<'info, Mint>,
    /// CHECK: rent-refund destination, must match the commit's recorded buyer.
    #[account(mut, address = commit.buyer)]
    pub buyer: UncheckedAccount<'info>,
    #[account(
        mut,
        close = buyer,
        seeds = [COMMIT_SEED, curve.key().as_ref(), buyer.key().as_ref()],
        bump = commit.bump,
    )]
    pub commit: Account<'info, SalvoCommit>,
    #[account(mut, seeds = [TOKEN_VAULT_SEED, curve.key().as_ref()], bump)]
    pub token_vault: Account<'info, TokenAccount>,
    /// Normally created at commit time; recreated on the cranker's dime if
    /// the buyer closed it in between.
    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [CURVE_SEED, curve.mint.as_ref()], bump = curve.bump)]
    pub curve: Account<'info, Curve>,
    #[account(address = curve.mint)]
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [TOKEN_VAULT_SEED, curve.key().as_ref()], bump)]
    pub token_vault: Account<'info, TokenAccount>,
    /// CHECK: lamport vault PDA validated by seeds.
    #[account(mut, seeds = [SOL_VAULT_SEED, curve.key().as_ref()], bump = curve.sol_vault_bump)]
    pub sol_vault: UncheckedAccount<'info>,
    /// CHECK: lamport vault PDA validated by seeds.
    #[account(mut, seeds = [REWARD_VAULT_SEED, curve.key().as_ref()], bump = curve.reward_vault_bump)]
    pub reward_vault: UncheckedAccount<'info>,
    /// CHECK: fee destination, must match the curve's recorded creator.
    #[account(mut, address = curve.creator)]
    pub creator_wallet: UncheckedAccount<'info>,
    /// CHECK: fee destination, must match the config's treasury.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = trader,
        associated_token::mint = mint,
        associated_token::authority = trader,
    )]
    pub trader_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeIx<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [CURVE_SEED, curve.mint.as_ref()], bump = curve.bump)]
    pub curve: Account<'info, Curve>,
    #[account(address = curve.mint)]
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [STAKE_VAULT_SEED, curve.key().as_ref()], bump)]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_ata: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + StakePosition::INIT_SPACE,
        seeds = [POSITION_SEED, curve.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, StakePosition>,
    /// CHECK: lamport vault PDA validated by seeds.
    #[account(mut, seeds = [REWARD_VAULT_SEED, curve.key().as_ref()], bump = curve.reward_vault_bump)]
    pub reward_vault: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(address = config.authority)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [CURVE_SEED, curve.mint.as_ref()], bump = curve.bump)]
    pub curve: Account<'info, Curve>,
    /// CHECK: lamport vault PDA validated by seeds.
    #[account(mut, seeds = [SOL_VAULT_SEED, curve.key().as_ref()], bump = curve.sol_vault_bump)]
    pub sol_vault: UncheckedAccount<'info>,
    /// CHECK: fee destination, must match the config's treasury.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
