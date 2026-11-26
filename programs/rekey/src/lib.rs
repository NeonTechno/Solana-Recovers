use anchor_lang::prelude::*;

declare_id!("284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP");

const MAX_GUARDIANS: usize = 5;
const MIN_DELAY_SECONDS: i64 = 60;
const MAX_DELAY_SECONDS: i64 = 30 * 24 * 60 * 60;
const REQUEST_GRACE_SECONDS: i64 = 7 * 24 * 60 * 60;

#[program]
pub mod rekey_program {
    use super::*;

    pub fn initialize_wallet(
        ctx: Context<InitializeWallet>,
        guardians: Vec<Pubkey>,
        threshold: u8,
        delay_seconds: i64,
    ) -> Result<()> {
        validate_policy(&guardians, threshold, delay_seconds, ctx.accounts.owner.key())?;

        let wallet = &mut ctx.accounts.wallet_config;
        wallet.initial_owner = ctx.accounts.owner.key();
        wallet.owner = ctx.accounts.owner.key();
        wallet.guardians = guardians;
        wallet.threshold = threshold;
        wallet.delay_seconds = delay_seconds;
        wallet.next_nonce = 0;
        wallet.policy_version = 1;
        wallet.bump = ctx.bumps.wallet_config;

        let vault = &mut ctx.accounts.vault;
        vault.wallet_config = wallet.key();
        vault.bump = ctx.bumps.vault;

        emit!(WalletInitialized {
            wallet: wallet.key(),
            owner: wallet.owner,
            vault: vault.key(),
        });
        Ok(())
    }

    pub fn update_recovery_policy(
        ctx: Context<UpdateRecoveryPolicy>,
        guardians: Vec<Pubkey>,
        threshold: u8,
        delay_seconds: i64,
    ) -> Result<()> {
        validate_policy(&guardians, threshold, delay_seconds, ctx.accounts.owner.key())?;

        let wallet = &mut ctx.accounts.wallet_config;
        wallet.guardians = guardians;
        wallet.threshold = threshold;
        wallet.delay_seconds = delay_seconds;
        wallet.policy_version = wallet
            .policy_version
            .checked_add(1)
            .ok_or(RecoveryError::ArithmeticOverflow)?;

        emit!(RecoveryPolicyUpdated {
            wallet: wallet.key(),
            policy_version: wallet.policy_version,
            threshold,
            guardian_count: wallet.guardians.len() as u8,
            delay_seconds,
        });
        Ok(())
    }

    pub fn initiate_recovery(ctx: Context<InitiateRecovery>, new_owner: Pubkey) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet_config;
        let initiator = ctx.accounts.initiator.key();

        require!(
            wallet.guardians.contains(&initiator),
            RecoveryError::UnauthorizedGuardian
        );
        require!(new_owner != Pubkey::default(), RecoveryError::InvalidNewOwner);
        require!(new_owner != wallet.owner, RecoveryError::SameOwner);

        let now = Clock::get()?.unix_timestamp;
        let execute_after = now
            .checked_add(wallet.delay_seconds)
            .ok_or(RecoveryError::ArithmeticOverflow)?;
        let expires_at = execute_after
            .checked_add(REQUEST_GRACE_SECONDS)
            .ok_or(RecoveryError::ArithmeticOverflow)?;

        let nonce = wallet.next_nonce;
        wallet.next_nonce = wallet
            .next_nonce
            .checked_add(1)
            .ok_or(RecoveryError::ArithmeticOverflow)?;

        let request = &mut ctx.accounts.recovery_request;
        request.wallet_config = wallet.key();
        request.new_owner = new_owner;
        request.nonce = nonce;
        request.policy_version = wallet.policy_version;
        request.created_at = now;
        request.execute_after = execute_after;
        request.expires_at = expires_at;
        request.approvals = Vec::new();
        request.status = RecoveryStatus::Pending;
        request.bump = ctx.bumps.recovery_request;

        emit!(RecoveryInitiated {
            wallet: wallet.key(),
            request: request.key(),
            new_owner,
            nonce,
            execute_after,
        });
        Ok(())
    }

    pub fn approve_recovery(ctx: Context<ApproveRecovery>) -> Result<()> {
        let wallet = &ctx.accounts.wallet_config;
        let guardian = ctx.accounts.guardian.key();
        let request = &mut ctx.accounts.recovery_request;
        let now = Clock::get()?.unix_timestamp;

        require!(
            wallet.guardians.contains(&guardian),
            RecoveryError::UnauthorizedGuardian
        );
        require!(
            request.policy_version == wallet.policy_version,
            RecoveryError::StalePolicy
        );
        require!(
            request.status == RecoveryStatus::Pending,
            RecoveryError::InvalidRecoveryState
        );
        require!(now <= request.expires_at, RecoveryError::RecoveryExpired);
        require!(
            !request.approvals.contains(&guardian),
            RecoveryError::DuplicateApproval
        );
        require!(
            request.approvals.len() < MAX_GUARDIANS,
            RecoveryError::TooManyApprovals
        );

        request.approvals.push(guardian);
        let approval_count = request.approvals.len() as u8;

        if approval_count >= wallet.threshold {
            request.status = RecoveryStatus::Approved;
        }

        emit!(GuardianApproved {
            wallet: wallet.key(),
            request: request.key(),
            guardian,
            approval_count,
            threshold: wallet.threshold,
        });
        Ok(())
    }

    pub fn execute_recovery(ctx: Context<ExecuteRecovery>) -> Result<()> {
        let wallet = &mut ctx.accounts.wallet_config;
        let request = &mut ctx.accounts.recovery_request;
        let now = Clock::get()?.unix_timestamp;

        require!(
            request.policy_version == wallet.policy_version,
            RecoveryError::StalePolicy
        );
        require!(
            request.status == RecoveryStatus::Approved,
            RecoveryError::ThresholdNotReached
        );
        require!(
            request.approvals.len() >= wallet.threshold as usize,
            RecoveryError::ThresholdNotReached
        );
        require!(now >= request.execute_after, RecoveryError::TimelockActive);
        require!(now <= request.expires_at, RecoveryError::RecoveryExpired);

        let previous_owner = wallet.owner;
        wallet.owner = request.new_owner;
        request.status = RecoveryStatus::Executed;

        emit!(RecoveryExecuted {
            wallet: wallet.key(),
            request: request.key(),
            previous_owner,
            new_owner: wallet.owner,
            nonce: request.nonce,
        });
        Ok(())
    }

    pub fn cancel_recovery(ctx: Context<CancelRecovery>) -> Result<()> {
        let request = &mut ctx.accounts.recovery_request;
        let now = Clock::get()?.unix_timestamp;

        require!(
            request.status == RecoveryStatus::Pending
                || request.status == RecoveryStatus::Approved,
            RecoveryError::InvalidRecoveryState
        );
        require!(now < request.execute_after, RecoveryError::TimelockElapsed);

        request.status = RecoveryStatus::Cancelled;
        emit!(RecoveryCancelled {
            wallet: request.wallet_config,
            request: request.key(),
            cancelled_by: ctx.accounts.owner.key(),
        });
        Ok(())
    }

    pub fn expire_recovery(ctx: Context<ExpireRecovery>) -> Result<()> {
        let request = &mut ctx.accounts.recovery_request;
        let now = Clock::get()?.unix_timestamp;

        require!(
            request.status == RecoveryStatus::Pending
                || request.status == RecoveryStatus::Approved,
            RecoveryError::InvalidRecoveryState
        );
        require!(now > request.expires_at, RecoveryError::RecoveryNotExpired);

        request.status = RecoveryStatus::Expired;
        Ok(())
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        require!(amount > 0, RecoveryError::InvalidAmount);
        require!(
            ctx.accounts.recipient.key() != ctx.accounts.vault.key(),
            RecoveryError::InvalidRecipient
        );

        let vault_info = ctx.accounts.vault.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();
        let rent_floor = Rent::get()?.minimum_balance(Vault::SPACE);

        let mut vault_lamports = vault_info.try_borrow_mut_lamports()?;
        let mut recipient_lamports = recipient_info.try_borrow_mut_lamports()?;

        require!(
            **vault_lamports >= amount.saturating_add(rent_floor),
            RecoveryError::InsufficientFunds
        );

        **vault_lamports = (**vault_lamports)
            .checked_sub(amount)
            .ok_or(RecoveryError::ArithmeticOverflow)?;
        **recipient_lamports = (**recipient_lamports)
            .checked_add(amount)
            .ok_or(RecoveryError::ArithmeticOverflow)?;

        emit!(SolWithdrawn {
            wallet: ctx.accounts.wallet_config.key(),
            recipient: ctx.accounts.recipient.key(),
            amount,
        });
        Ok(())
    }
}

fn validate_policy(
    guardians: &[Pubkey],
    threshold: u8,
    delay_seconds: i64,
    owner: Pubkey,
) -> Result<()> {
    require!(
        !guardians.is_empty() && guardians.len() <= MAX_GUARDIANS,
        RecoveryError::InvalidGuardianCount
    );
    require!(
        threshold > 0 && (threshold as usize) <= guardians.len(),
        RecoveryError::InvalidThreshold
    );
    require!(
        (MIN_DELAY_SECONDS..=MAX_DELAY_SECONDS).contains(&delay_seconds),
        RecoveryError::InvalidTimelock
    );

    for (index, guardian) in guardians.iter().enumerate() {
        require!(*guardian != owner, RecoveryError::OwnerCannotBeGuardian);
        require!(
            !guardians[index + 1..].contains(guardian),
            RecoveryError::DuplicateGuardian
        );
    }
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeWallet<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = WalletConfig::SPACE,
        seeds = [b"wallet", owner.key().as_ref()],
        bump
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    #[account(
        init,
        payer = owner,
        space = Vault::SPACE,
        seeds = [b"vault", wallet_config.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRecoveryPolicy<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet_config.initial_owner.as_ref()],
        bump = wallet_config.bump,
        constraint = wallet_config.owner == owner.key() @ RecoveryError::Unauthorized
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitiateRecovery<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet_config.initial_owner.as_ref()],
        bump = wallet_config.bump
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    #[account(
        init,
        payer = initiator,
        space = RecoveryRequest::SPACE,
        seeds = [
            b"recovery",
            wallet_config.key().as_ref(),
            &wallet_config.next_nonce.to_le_bytes()
        ],
        bump
    )]
    pub recovery_request: Account<'info, RecoveryRequest>,
    #[account(mut)]
    pub initiator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveRecovery<'info> {
    #[account(
        seeds = [b"wallet", wallet_config.initial_owner.as_ref()],
        bump = wallet_config.bump
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    #[account(
        mut,
        seeds = [
            b"recovery",
            wallet_config.key().as_ref(),
            &recovery_request.nonce.to_le_bytes()
        ],
        bump = recovery_request.bump,
        has_one = wallet_config
    )]
    pub recovery_request: Account<'info, RecoveryRequest>,
    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteRecovery<'info> {
    #[account(
        mut,
        seeds = [b"wallet", wallet_config.initial_owner.as_ref()],
        bump = wallet_config.bump
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    #[account(
        mut,
        seeds = [
            b"recovery",
            wallet_config.key().as_ref(),
            &recovery_request.nonce.to_le_bytes()
        ],
        bump = recovery_request.bump,
        has_one = wallet_config
    )]
    pub recovery_request: Account<'info, RecoveryRequest>,
}

#[derive(Accounts)]
pub struct CancelRecovery<'info> {
    #[account(
        seeds = [b"wallet", wallet_config.initial_owner.as_ref()],
        bump = wallet_config.bump,
        constraint = wallet_config.owner == owner.key() @ RecoveryError::Unauthorized
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    #[account(
        mut,
        seeds = [
            b"recovery",
            wallet_config.key().as_ref(),
            &recovery_request.nonce.to_le_bytes()
        ],
        bump = recovery_request.bump,
        has_one = wallet_config
    )]
    pub recovery_request: Account<'info, RecoveryRequest>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExpireRecovery<'info> {
    #[account(
        seeds = [b"wallet", wallet_config.initial_owner.as_ref()],
        bump = wallet_config.bump
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    #[account(
        mut,
        seeds = [
            b"recovery",
            wallet_config.key().as_ref(),
            &recovery_request.nonce.to_le_bytes()
        ],
        bump = recovery_request.bump,
        has_one = wallet_config
    )]
    pub recovery_request: Account<'info, RecoveryRequest>,
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(
        seeds = [b"wallet", wallet_config.initial_owner.as_ref()],
        bump = wallet_config.bump,
        constraint = wallet_config.owner == owner.key() @ RecoveryError::Unauthorized
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    #[account(
        mut,
        seeds = [b"vault", wallet_config.key().as_ref()],
        bump = vault.bump,
        has_one = wallet_config
    )]
    pub vault: Account<'info, Vault>,
    pub owner: Signer<'info>,
    /// CHECK: This account only receives lamports; it is never deserialized or trusted.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
}

#[account]
pub struct WalletConfig {
    pub initial_owner: Pubkey,
    pub owner: Pubkey,
    pub guardians: Vec<Pubkey>,
    pub threshold: u8,
    pub delay_seconds: i64,
    pub next_nonce: u64,
    pub policy_version: u64,
    pub bump: u8,
}

impl WalletConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 4 + (MAX_GUARDIANS * 32) + 1 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Vault {
    pub wallet_config: Pubkey,
    pub bump: u8,
}

impl Vault {
    pub const SPACE: usize = 8 + 32 + 1;
}

#[account]
pub struct RecoveryRequest {
    pub wallet_config: Pubkey,
    pub new_owner: Pubkey,
    pub nonce: u64,
    pub policy_version: u64,
    pub created_at: i64,
    pub execute_after: i64,
    pub expires_at: i64,
    pub approvals: Vec<Pubkey>,
    pub status: RecoveryStatus,
    pub bump: u8,
}

impl RecoveryRequest {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 4 + (MAX_GUARDIANS * 32) + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RecoveryStatus {
    Pending,
    Approved,
    Cancelled,
    Executed,
    Expired,
}

#[event]
pub struct WalletInitialized {
    pub wallet: Pubkey,
    pub owner: Pubkey,
    pub vault: Pubkey,
}

#[event]
pub struct RecoveryPolicyUpdated {
    pub wallet: Pubkey,
    pub policy_version: u64,
    pub threshold: u8,
    pub guardian_count: u8,
    pub delay_seconds: i64,
}

#[event]
pub struct RecoveryInitiated {
    pub wallet: Pubkey,
    pub request: Pubkey,
    pub new_owner: Pubkey,
    pub nonce: u64,
    pub execute_after: i64,
}

#[event]
pub struct GuardianApproved {
    pub wallet: Pubkey,
    pub request: Pubkey,
    pub guardian: Pubkey,
    pub approval_count: u8,
    pub threshold: u8,
}

#[event]
pub struct RecoveryCancelled {
    pub wallet: Pubkey,
    pub request: Pubkey,
    pub cancelled_by: Pubkey,
}

#[event]
pub struct RecoveryExecuted {
    pub wallet: Pubkey,
    pub request: Pubkey,
    pub previous_owner: Pubkey,
    pub new_owner: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct SolWithdrawn {
    pub wallet: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum RecoveryError {
    #[msg("The recovery policy must contain between one and five guardians.")]
    InvalidGuardianCount,
    #[msg("The approval threshold must be between one and the guardian count.")]
    InvalidThreshold,
    #[msg("The timelock must be between 60 seconds and 30 days.")]
    InvalidTimelock,
    #[msg("The wallet owner cannot be a guardian.")]
    OwnerCannotBeGuardian,
    #[msg("Guardian public keys must be unique.")]
    DuplicateGuardian,
    #[msg("The caller is not authorized.")]
    Unauthorized,
    #[msg("The caller is not a registered guardian.")]
    UnauthorizedGuardian,
    #[msg("The proposed owner public key is invalid.")]
    InvalidNewOwner,
    #[msg("The proposed owner is already the current owner.")]
    SameOwner,
    #[msg("This recovery request is not in a state that allows this action.")]
    InvalidRecoveryState,
    #[msg("The recovery request has expired.")]
    RecoveryExpired,
    #[msg("The recovery request has not expired yet.")]
    RecoveryNotExpired,
    #[msg("This guardian has already approved the request.")]
    DuplicateApproval,
    #[msg("The approval list is full.")]
    TooManyApprovals,
    #[msg("The guardian threshold has not been reached.")]
    ThresholdNotReached,
    #[msg("The recovery timelock is still active.")]
    TimelockActive,
    #[msg("The recovery timelock has elapsed; cancellation is no longer available.")]
    TimelockElapsed,
    #[msg("The recovery request was created under an outdated guardian policy.")]
    StalePolicy,
    #[msg("The wallet vault does not have enough spendable SOL.")]
    InsufficientFunds,
    #[msg("The transfer amount must be greater than zero.")]
    InvalidAmount,
    #[msg("The recipient cannot be the vault itself.")]
    InvalidRecipient,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
}
