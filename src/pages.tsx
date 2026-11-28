import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowUpRight, Check, ChevronRight, CircleHelp, Copy, ExternalLink,
  Fingerprint, LockKeyhole, LogOut, RefreshCw, Shield, ShieldAlert,
  Users, Wallet, Zap,
} from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import type { RecoveryDemoStatus } from "./recoveryDemo";
import { ReKeyIllustration } from "./components/ReKeyIllustration";

export type AppPage =
  | "overview"
  | "smart-wallet"
  | "setup"
  | "recovery"
  | "guardians"
  | "activity"
  | "assistant"
  | "mcp"
  | "rewards"
  | "settings";

export const pageMeta: Record<AppPage, { title: string; description: string }> = {
  overview: { title: "Your recovery overview", description: "A clear view of your Devnet wallet and recovery readiness." },
  "smart-wallet": { title: "Smart wallet", description: "Review your connected wallet and the current ReKey program status." },
  setup: { title: "Build your recovery plan", description: "Walk through the intended setup. This preview does not register on-chain state." },
  recovery: { title: "Recovery center", description: "Review the request, approvals, timelock, expiry, and transaction state." },
  guardians: { title: "Guardian circle", description: "See how guardian approvals work without registering sample contacts." },
  activity: { title: "Activity history", description: "Confirmed recovery events will appear here when an event source is available." },
  assistant: { title: "Security guide", description: "Local readiness guidance; the AI service is not connected." },
  mcp: { title: "MCP connections", description: "Review the connection and permissions state without implying a client is active." },
  rewards: { title: "Lifeline Rewards", description: "Rewards remain unavailable until verified data is provided." },
  settings: { title: "Security settings", description: "Review the Devnet environment and ReKey’s security boundaries." },
};

type Navigate = (page: AppPage) => void;

interface SharedPageProps {
  page: AppPage;
  connected: boolean;
  walletAddress: string | null;
  balanceText: string;
  balanceAriaLabel: string;
  balanceLoading: boolean;
  balanceError: string | null;
  onRefreshBalance: () => void;
  onRequestAirdrop: () => void;
  airdropLoading: boolean;
  airdropNotice: string | null;
  copied: boolean;
  onCopyAddress: () => void;
  onDisconnect: () => void;
  onNavigate: Navigate;
  recoveryState: RecoveryDemoStatus;
  approvals: string[];
  proposedOwner: string;
  setProposedOwner: (value: string) => void;
  onStartRecovery: () => void;
  onApproveGuardian: (guardian: string) => void;
  onCancelRecovery: () => void;
  threshold: string;
  setThreshold: (value: string) => void;
  delay: string;
  setDelay: (value: string) => void;
  setupStep: number;
  setSetupStep: (step: number) => void;
}

function shortAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 5)}…${address.slice(-5)}` : address;
}

function StatePill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warning" }) {
  return <span className={`rk-state-pill rk-state-${tone}`}><span aria-hidden="true" />{children}</span>;
}

function InlineStatus({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" | "warning" }) {
  return <div className={`rk-inline-status rk-inline-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

function BalanceValue({ props }: { props: SharedPageProps }) {
  const { connected, balanceAriaLabel, balanceError, balanceLoading, balanceText, onRefreshBalance } = props;
  return (
    <div className="rk-balance-value" aria-busy={balanceLoading}>
      {balanceLoading ? <span className="rk-skeleton" aria-label="Loading Devnet SOL balance" /> : <span aria-label={balanceAriaLabel}>{balanceText}</span>}
      <small>SOL</small>
      {connected && <button className="rk-icon-action" type="button" onClick={onRefreshBalance} disabled={balanceLoading} aria-label="Refresh Devnet SOL balance" aria-busy={balanceLoading}><RefreshCw size={16} aria-hidden="true" /></button>}
      {balanceError && <p className="rk-field-error" role="alert">{balanceError} <button type="button" onClick={onRefreshBalance}>Retry</button></p>}
    </div>
  );
}

function OverviewPage({ props }: { props: SharedPageProps }) {
  const { connected, walletAddress, onNavigate } = props;
  return (
    <div className="rk-page-stack">
      <section className="rk-hero-card rk-hero-dashboard">
        <div className="rk-hero-copy">
          <p className="rk-eyebrow"><span /> RECOVERY READINESS</p>
          <h2>Your access plan starts with people you trust.</h2>
          <p>ReKey is a Devnet prototype. Connect a test wallet to review the live balance; recovery policy, guardian setup, and approvals are not registered on-chain.</p>
          <div className="rk-action-row">
            <button className="rk-button rk-button-primary" type="button" onClick={() => onNavigate("setup")}>Start setup preview <ChevronRight size={17} aria-hidden="true" /></button>
            <button className="rk-button rk-button-secondary" type="button" onClick={() => onNavigate("recovery")}>Open recovery center</button>
          </div>
        </div>
        <ReKeyIllustration name="resilience" className="rk-hero-art" label="Glossy violet shield with a cyan resilience pulse" />
        <span className="rk-hero-glint" aria-hidden="true" />
      </section>

      <section className="rk-summary-grid" aria-label="Wallet and recovery status">
        <article className="rk-stat-card">
          <div className="rk-stat-heading"><span>CONNECTED WALLET</span><Wallet size={18} aria-hidden="true" /></div>
          <strong className="rk-stat-value rk-mono">{connected && walletAddress ? shortAddress(walletAddress) : "Not connected"}</strong>
          <p>{connected ? "Solana Devnet · wallet adapter" : "Connect Phantom or Solflare on Devnet to begin."}</p>
          <StatePill tone={connected ? "good" : "neutral"}>{connected ? "Connected" : "Waiting for wallet"}</StatePill>
        </article>
        <article className="rk-stat-card">
          <div className="rk-stat-heading"><span>LIVE DEVNET BALANCE</span><Zap size={18} aria-hidden="true" /></div>
          <BalanceValue props={props} />
          <p>Fetched from Solana Devnet RPC. No USD value is estimated.</p>
          <StatePill tone={connected ? "good" : "neutral"}>{connected ? "Live RPC data" : "No wallet data"}</StatePill>
        </article>
        <article className="rk-stat-card rk-stat-policy">
          <div className="rk-stat-heading"><span>RECOVERY POLICY</span><Shield size={18} aria-hidden="true" /></div>
          <strong className="rk-stat-value">Not configured</strong>
          <p>The smart-wallet program is not deployed; no policy is registered.</p>
          <StatePill tone="warning">On-chain setup unavailable</StatePill>
        </article>
      </section>

      <section className="rk-content-grid">
        <article className="rk-panel rk-readiness-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">A REALISTIC CHECKLIST</p><h2>Recovery readiness</h2></div><ReKeyIllustration name="security" className="rk-heading-art" /></div>
          <div className="rk-readiness-list">
            <ReadinessItem number="01" title="Connect a Devnet wallet" status={connected ? "Connected" : "Not connected"} complete={connected} />
            <ReadinessItem number="02" title="Initialize a ReKey smart wallet" status="Not available" />
            <ReadinessItem number="03" title="Register guardian policy" status="Not configured" />
            <ReadinessItem number="04" title="Review threshold and delay" status="Preview only" />
          </div>
          <button className="rk-text-action" type="button" onClick={() => onNavigate("setup")}>Walk through the setup <ChevronRight size={16} aria-hidden="true" /></button>
        </article>
        <article className="rk-panel rk-circle-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">RECOVERY CIRCLE</p><h2>Guardians, not custodians.</h2></div><ReKeyIllustration name="guardians" className="rk-heading-art" /></div>
          <p>Guardians can approve a recovery request under a program policy. They do not receive spending authority.</p>
          <div className="rk-panel-note"><ShieldAlert size={18} aria-hidden="true" /><span>No guardians have been registered. Names shown in the demo are samples only.</span></div>
          <button className="rk-button rk-button-secondary" type="button" onClick={() => onNavigate("guardians")}>Review guardian model</button>
        </article>
      </section>

      <section className="rk-feature-strip" aria-label="ReKey prototype features">
        <FeatureChip icon={<Fingerprint size={18} />} title="Passkey-first" detail="Planned" color="cyan" />
        <FeatureChip icon={<Users size={18} />} title="Trusted guardians" detail="Preview only" color="violet" />
        <FeatureChip icon={<LockKeyhole size={18} />} title="Program-enforced recovery" detail="Not deployed" color="gold" />
      </section>
    </div>
  );
}

function ReadinessItem({ number, title, status, complete = false }: { number: string; title: string; status: string; complete?: boolean }) {
  return (
    <div className="rk-readiness-item">
      <span className={`rk-step-number ${complete ? "is-complete" : ""}`}>{complete ? <Check size={14} aria-hidden="true" /> : number}</span>
      <strong>{title}</strong>
      <span className="rk-readiness-status">{status}</span>
    </div>
  );
}

function FeatureChip({ icon, title, detail, color }: { icon: ReactNode; title: string; detail: string; color: string }) {
  return <div className="rk-feature-chip"><span className={`rk-feature-icon tone-${color}`} aria-hidden="true">{icon}</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}

function WalletPage({ props }: { props: SharedPageProps }) {
  const { connected, walletAddress, airdropLoading, airdropNotice, onCopyAddress, onDisconnect, onRequestAirdrop } = props;
  return (
    <div className="rk-page-stack">
      <section className="rk-content-grid rk-wallet-grid">
        <article className="rk-panel rk-wallet-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">SOLANA DEVNET</p><h2>Wallet connection</h2></div><ReKeyIllustration name="wallet" className="rk-heading-art" /></div>
          <div className="rk-wallet-address-block">
            <span>Connected wallet address</span>
            <strong className="rk-mono">{connected && walletAddress ? shortAddress(walletAddress) : "Not connected"}</strong>
            {connected && walletAddress && <div className="rk-action-row">
              <button className="rk-button rk-button-secondary" type="button" onClick={onCopyAddress}><Copy size={15} aria-hidden="true" />{props.copied ? "Copied" : "Copy address"}</button>
              <a className="rk-button rk-button-quiet" href={`https://explorer.solana.com/address/${walletAddress}?cluster=devnet`} target="_blank" rel="noreferrer">View on Explorer <ExternalLink size={14} aria-hidden="true" /></a>
            </div>}
          </div>
          <div className="rk-detail-list">
            <DetailRow label="Network" value="Solana Devnet" />
            <DetailRow label="Wallet state" value={connected ? "Connected" : "Disconnected"} />
            <DetailRow label="Smart wallet" value="Not initialized" />
            <DetailRow label="Program status" value="Not deployed to Devnet" />
          </div>
          <div className="rk-action-row">
            {connected ? <button className="rk-button rk-button-secondary" type="button" onClick={onDisconnect}><LogOut size={15} aria-hidden="true" />Disconnect wallet</button> : <WalletMultiButton className="wallet-connect-button rk-wallet-adapter-button" />}
            <button className="rk-button rk-button-primary" type="button" onClick={onRequestAirdrop} disabled={!connected || airdropLoading} aria-busy={airdropLoading}>{airdropLoading ? "Requesting Devnet airdrop…" : "Request 1 Devnet SOL"}<ArrowUpRight size={15} aria-hidden="true" /></button>
          </div>
          {airdropNotice && <InlineStatus tone={airdropNotice.startsWith("1 Devnet") ? "success" : "error"}>{airdropNotice}</InlineStatus>}
        </article>
        <article className="rk-panel rk-balance-panel">
          <p className="rk-eyebrow">LIVE RPC QUERY</p>
          <h2>Available SOL</h2>
          <BalanceValue props={props} />
          <p>Balance is read from the connected Devnet wallet. No simulated amount is displayed.</p>
          <div className="rk-panel-note"><CircleHelp size={17} aria-hidden="true" /><span>Airdrops are Devnet-only and may be rate-limited by the faucet.</span></div>
        </article>
      </section>
      <section className="rk-panel rk-program-status">
        <ReKeyIllustration name="security" className="rk-inline-art" />
        <div><p className="rk-eyebrow">REKEY SMART WALLET</p><h2>Initialization is unavailable in this prototype.</h2><p>The program has not been deployed. Do not send funds to an address represented as a ReKey smart wallet.</p></div>
        <StatePill tone="warning">No on-chain account</StatePill>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="rk-detail-row"><span>{label}</span><strong>{value}</strong></div>;
}

function SetupPage({ props }: { props: SharedPageProps }) {
  const { connected, onNavigate, setupStep, setSetupStep, threshold, setThreshold, delay, setDelay } = props;
  const steps = ["Connect wallet", "Initialize wallet", "Choose guardians", "Set policy", "Review readiness"];
  const stepContent = [
    { title: "Connect a Solana wallet", copy: "Use a dedicated test wallet on Devnet. ReKey never asks for a seed phrase or private key." },
    { title: "Initialize your ReKey wallet", copy: "This step is unavailable because the smart-wallet program is not deployed to Devnet." },
    { title: "Choose trusted guardians", copy: "Add identities only after a real registration flow exists. The guardian names in other screens are demo labels." },
    { title: "Set threshold and delay", copy: "Adjust a local preview policy. These values are not saved to your wallet or submitted to Solana." },
    { title: "Review recovery readiness", copy: "The prototype is not configured on-chain. No readiness score is calculated from sample data." },
  ];
  const lastStep = setupStep >= steps.length - 1;

  return (
    <div className="rk-page-stack">
      <div className="rk-prototype-banner" role="note"><ShieldAlert size={18} aria-hidden="true" /><span>Guided preview only. Wallet connection and Devnet balance are live; setup values below remain in this browser.</span></div>
      <section className="rk-onboarding-layout">
        <article className="rk-panel rk-onboarding-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">STEP {String(setupStep + 1).padStart(2, "0")} / 05</p><h2>{stepContent[setupStep].title}</h2></div><ReKeyIllustration name={setupStep === 1 ? "wallet" : setupStep === 2 ? "guardians" : "recovery"} className="rk-heading-art" /></div>
          <p>{stepContent[setupStep].copy}</p>
          {setupStep === 0 && <div className="rk-setup-control">{connected ? <InlineStatus tone="success"><Check size={16} aria-hidden="true" />Devnet wallet connected.</InlineStatus> : <WalletMultiButton className="wallet-connect-button rk-wallet-adapter-button" />}</div>}
          {setupStep === 1 && <InlineStatus tone="error"><LockKeyhole size={16} aria-hidden="true" />Not deployed. ReKey cannot initialize an on-chain wallet here.</InlineStatus>}
          {setupStep === 2 && <div className="rk-setup-sample"><ReKeyIllustration name="guardians" className="rk-inline-art" /><div><strong>No guardians registered</strong><span>Guardian identities can be configured after the program and registration flow are available.</span></div></div>}
          {setupStep === 3 && <fieldset className="rk-form-grid"><legend>Local policy preview</legend>
            <div className="rk-field"><label htmlFor="policy-threshold">Approval threshold</label><select id="policy-threshold" value={threshold} onChange={(event) => setThreshold(event.target.value)}><option value="2-of-3">2 of 3 guardians</option><option value="3-of-5">3 of 5 guardians</option></select><small>Example only. Not registered on-chain.</small></div>
            <div className="rk-field"><label htmlFor="policy-delay">Recovery delay</label><select id="policy-delay" value={delay} onChange={(event) => setDelay(event.target.value)}><option value="24 hours">24 hours</option><option value="48 hours">48 hours</option><option value="72 hours">72 hours</option></select><small>No timelock starts in this preview.</small></div>
          </fieldset>}
          {setupStep === 4 && <div className="rk-review-list"><DetailRow label="Wallet" value={connected ? "Connected on Devnet" : "Not connected"} /><DetailRow label="Smart wallet" value="Not initialized" /><DetailRow label="Guardian policy" value={`${threshold.replace("-", " ")} · local preview`} /><DetailRow label="Delay" value={`${delay} · not active`} /><InlineStatus tone="warning">Readiness is not verified. No transaction has been signed or submitted.</InlineStatus></div>}
          <div className="rk-action-row rk-onboarding-actions">
            {setupStep > 0 && <button className="rk-button rk-button-secondary" type="button" onClick={() => setSetupStep(setupStep - 1)}>Back</button>}
            {lastStep ? <button className="rk-button rk-button-primary" type="button" onClick={() => onNavigate("recovery")}>Open recovery center <ChevronRight size={16} aria-hidden="true" /></button> : <button className="rk-button rk-button-primary" type="button" onClick={() => setSetupStep(setupStep + 1)}>Continue in preview <ChevronRight size={16} aria-hidden="true" /></button>}
          </div>
        </article>
        <aside className="rk-panel rk-step-panel" aria-label="Recovery setup steps">
          <p className="rk-eyebrow">YOUR RECOVERY PATH</p>
          <ol className="rk-step-list">
            {steps.map((step, index) => <li className={index === setupStep ? "is-current" : index < setupStep ? "is-visited" : ""} key={step}><span>{index < setupStep ? <Check size={14} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></li>)}
          </ol>
          <p className="rk-small-note">Visited steps are not evidence of on-chain configuration.</p>
        </aside>
      </section>
    </div>
  );
}

function RecoveryPage({ props }: { props: SharedPageProps }) {
  const { recoveryState, approvals, proposedOwner, setProposedOwner, onStartRecovery, onApproveGuardian, onCancelRecovery } = props;
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const isValidOwner = (() => {
    if (!proposedOwner.trim()) return false;
    try { new PublicKey(proposedOwner.trim()); return true; } catch { return false; }
  })();
  const isActive = recoveryState === "pending" || recoveryState === "threshold-met";
  const isThresholdMet = recoveryState === "threshold-met";

  const start = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (isValidOwner) onStartRecovery();
  };

  const copyProposedOwner = async () => {
    if (!isValidOwner) return;
    try {
      await navigator.clipboard.writeText(proposedOwner.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rk-page-stack">
      <div className="rk-prototype-banner" role="note"><ShieldAlert size={18} aria-hidden="true" /><span>Simulation only. This page does not create an on-chain recovery request, start a timelock, or sign a transaction.</span></div>
      <section className="rk-recovery-layout">
        <article className="rk-panel rk-recovery-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">GUARDIAN APPROVAL FLOW</p><h2>Recovery request</h2></div><ReKeyIllustration name="recovery" className="rk-heading-art" /></div>
          {!isActive && <form className="rk-recovery-form" onSubmit={start} noValidate>
            <div className="rk-field"><label htmlFor="proposed-owner">Proposed new owner address</label><input id="proposed-owner" type="text" inputMode="text" autoComplete="off" spellCheck={false} value={proposedOwner} onChange={(event) => setProposedOwner(event.target.value)} aria-invalid={submitted && !isValidOwner ? "true" : undefined} aria-describedby={submitted && !isValidOwner ? "owner-error owner-hint" : "owner-hint"} placeholder="Paste a Solana public address" /><small id="owner-hint">Used only in this browser’s demo. It will not be sent to a wallet or RPC.</small>{submitted && !isValidOwner && <small className="rk-field-error" id="owner-error">Enter a valid Solana public address before starting the local demo.</small>}</div>
            <button className="rk-button rk-button-primary" type="submit">Start local simulation <RefreshCw size={15} aria-hidden="true" /></button>
          </form>}
          <div className="rk-recovery-details" aria-live="polite">
            <DetailRow label="Proposed new owner" value={isValidOwner ? shortAddress(proposedOwner.trim()) : "Not provided"} />
            <DetailRow label="Guardian approvals" value={`${approvals.length} of 2 required · demo only`} />
            <DetailRow label="Timelock countdown" value="Not started" />
            <DetailRow label="Expiration" value="Not set" />
            <DetailRow label="Transaction state" value="Simulation · not signed or submitted" />
          </div>
          {isValidOwner && <button className="rk-text-action rk-owner-copy" type="button" onClick={() => void copyProposedOwner()}><Copy size={14} aria-hidden="true" />{copied ? "Copied proposed address" : "Copy proposed address"}</button>}
          {recoveryState === "idle" && <p className="rk-small-note">A local approval count is not an approval transaction. The on-chain request, proposed owner, expiry, and timelock are unavailable until a deployed program contract is integrated.</p>}
          {recoveryState === "cancelled" && <InlineStatus tone="info">The local simulation was cancelled. No on-chain request existed.</InlineStatus>}
        </article>
        <aside className="rk-panel rk-approval-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">APPROVALS · LOCAL DEMO</p><h2>Guardian response</h2></div><ReKeyIllustration name="guardians" className="rk-heading-art" /></div>
          <p>Choose two distinct sample guardians to illustrate the approval threshold. These names are not registered contacts.</p>
          {isActive ? <div className="rk-demo-guardian-list">{["Demo guardian 1", "Demo guardian 2", "Demo guardian 3"].map((guardian, index) => {
            const approved = approvals.includes(guardian);
            return <button className={`rk-guardian-action ${approved ? "is-approved" : ""}`} type="button" key={guardian} disabled={approved || isThresholdMet} aria-pressed={approved} onClick={() => onApproveGuardian(guardian)}><span className={`rk-guardian-avatar avatar-${index + 1}`}><ReKeyIllustration name="security" /></span><span><strong>{guardian}</strong><small>{approved ? "Approved in local simulation" : "Sample identity · no signature"}</small></span><span aria-hidden="true">{approved ? <Check size={18} /> : <ChevronRight size={18} />}</span></button>;
          })}</div> : <div className="rk-empty-mini"><ReKeyIllustration name="security" className="rk-empty-art" /><strong>Waiting for a local demo request</strong><span>Enter a proposed owner address to preview the approval counter.</span></div>}
          {isThresholdMet && <InlineStatus tone="success"><Check size={16} aria-hidden="true" />Demo threshold reached. No timelock or on-chain execution has started.</InlineStatus>}
          {isActive && <button className="rk-button rk-button-danger-quiet" type="button" onClick={onCancelRecovery}>Cancel local simulation</button>}
        </aside>
      </section>
    </div>
  );
}

function GuardiansPage() {
  const examples = ["Sample guardian A", "Sample guardian B", "Sample guardian C"];
  return (
    <div className="rk-page-stack">
      <section className="rk-hero-card rk-compact-hero">
        <div><p className="rk-eyebrow">TRUSTED PEOPLE · NOT CUSTODIANS</p><h2>A guardian can approve recovery, not spend your SOL.</h2><p>Real guardian enrollment requires a deployed ReKey wallet and an approved registration interface.</p></div>
        <ReKeyIllustration name="guardians" className="rk-hero-art" />
      </section>
      <section className="rk-content-grid">
        <article className="rk-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">SAMPLE LIST</p><h2>Guardian slots</h2></div><StatePill tone="warning">Not registered</StatePill></div>
          <div className="rk-guardian-list">{examples.map((name, index) => <div className="rk-guardian-row" key={name}><span className={`rk-guardian-avatar avatar-${index + 1}`}><ReKeyIllustration name="security" /></span><div><strong>{name}</strong><small>Example slot · no address saved</small></div><span className="rk-tag">SAMPLE</span></div>)}</div>
        </article>
        <article className="rk-panel rk-threshold-panel">
          <ReKeyIllustration name="resilience" className="rk-panel-art" />
          <p className="rk-eyebrow">EXAMPLE POLICY</p><h2>2 of 3 approvals</h2>
          <p>This threshold is a demonstration default only. It is not a wallet setting and has not been registered.</p>
          <div className="rk-panel-note"><CircleHelp size={17} aria-hidden="true" /><span>Guardian approval does not grant spending authority.</span></div>
        </article>
      </section>
    </div>
  );
}

function ActivityPage() {
  return (
    <section className="rk-panel rk-empty-page">
      <ReKeyIllustration name="activity" className="rk-empty-art" />
      <p className="rk-eyebrow">TRANSACTION ACTIVITY</p><h2>No verified recovery events yet</h2>
      <p>The recovery program is not deployed and no activity indexer is connected. ReKey does not fabricate transaction history.</p>
      <StatePill tone="warning">History source unavailable</StatePill>
    </section>
  );
}

function AssistantPage({ onNavigate, connected }: { onNavigate: Navigate; connected: boolean }) {
  return (
    <div className="rk-page-stack">
      <section className="rk-content-grid">
        <article className="rk-panel rk-assistant-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">AI SECURITY ASSISTANT</p><h2>Helpful guidance, with clear limits.</h2></div><ReKeyIllustration name="assistant" className="rk-heading-art" /></div>
          <div className="rk-chat-preview" aria-label="Assistant connection status">
            <div className="rk-chat-message"><ReKeyIllustration name="assistant" className="rk-chat-avatar" /><p><strong>ReKey guide</strong><br />The AI service is not connected yet. This panel is a UI preview, not an AI conversation.</p></div>
            <InlineStatus tone="warning">No AI API contract is available. No wallet data has been sent to an assistant.</InlineStatus>
            <label className="rk-field-label" htmlFor="assistant-message">Message</label>
            <div className="rk-chat-composer"><input id="assistant-message" type="text" disabled placeholder="Assistant service not connected" /><button className="rk-button rk-button-primary" type="button" disabled>Send</button></div>
            <p className="rk-small-note">Chat is disabled until Vibe provides a documented API contract.</p>
          </div>
          <div className="rk-panel-note"><ShieldAlert size={18} aria-hidden="true" /><span>Any future transaction proposal must show its details and ask for confirmation before a wallet signature.</span></div>
        </article>
        <article className="rk-panel">
          <p className="rk-eyebrow">LOCAL CHECKLIST · NOT AI-GENERATED</p><h2>Current security context</h2>
          <div className="rk-checklist">
            <ReadinessItem number="01" title="Devnet wallet" status={connected ? "Connected" : "Not connected"} complete={connected} />
            <ReadinessItem number="02" title="Recovery policy" status="Not configured on-chain" />
            <ReadinessItem number="03" title="AI service" status="Disconnected" />
          </div>
          <div className="rk-action-row"><button className="rk-button rk-button-secondary" type="button" onClick={() => onNavigate("setup")}>Review setup steps</button><button className="rk-button rk-button-quiet" type="button" onClick={() => onNavigate("mcp")}>MCP connection settings</button></div>
        </article>
      </section>
    </div>
  );
}

function McpPage() {
  return (
    <div className="rk-page-stack">
      <section className="rk-hero-card rk-compact-hero">
        <div><p className="rk-eyebrow">MODEL CONTEXT PROTOCOL</p><h2>No client is connected.</h2><p>This page reports only established connections. It will not mark an MCP client active without a real handshake.</p></div>
        <ReKeyIllustration name="mcp" className="rk-hero-art" />
      </section>
      <section className="rk-content-grid">
        <article className="rk-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">CONNECTED CLIENTS</p><h2>Connection status</h2></div><StatePill>Disconnected</StatePill></div>
          <div className="rk-empty-inline"><ReKeyIllustration name="mcp" className="rk-empty-art" /><div><strong>No MCP clients configured</strong><p>There is no established session, client identity, or granted permission.</p></div></div>
        </article>
        <article className="rk-panel">
          <p className="rk-eyebrow">PERMISSIONS & TOOLS</p><h2>Nothing has been granted.</h2>
          <div className="rk-permission-list"><DetailRow label="Client permissions" value="None" /><DetailRow label="Available tools" value="Not discovered" /><DetailRow label="Tool execution" value="Unavailable" /></div>
          <p className="rk-small-note">Tool names and permission scopes will be shown after Vibe publishes the integration contract and a client actually connects.</p>
        </article>
      </section>
    </div>
  );
}

function RewardsPage() {
  const badges = [
    { title: "Guardian network", art: "guardians" as const },
    { title: "Recovery ready", art: "resilience" as const },
    { title: "First milestone", art: "achievement" as const },
  ];
  return (
    <div className="rk-page-stack">
      <section className="rk-rewards-hero rk-hero-card">
        <div><p className="rk-eyebrow">LIFELINE REWARDS</p><h2>Resilience grows from real contributions.</h2><p>Rewards are not enabled until verified data and its source are defined.</p></div>
        <ReKeyIllustration name="rewards" className="rk-hero-art" />
      </section>
      <section className="rk-summary-grid rk-rewards-summary">
        <article className="rk-stat-card"><p className="rk-eyebrow">RESILIENCE SCORE</p><strong className="rk-stat-value">Not verified</strong><p>No score is calculated from sample activity.</p></article>
        <article className="rk-stat-card"><p className="rk-eyebrow">LIFELINE POINTS</p><strong className="rk-stat-value">Unavailable</strong><p>No points balance or rewards API is connected.</p></article>
        <article className="rk-stat-card"><p className="rk-eyebrow">GUARDIAN RECOGNITION</p><strong className="rk-stat-value">No records</strong><p>Recognition requires verified contribution data.</p></article>
      </section>
      <section className="rk-content-grid">
        <article className="rk-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">COLLECTIBLE BADGES</p><h2>Illustrative badge concepts</h2></div><StatePill tone="warning">Samples · not earned</StatePill></div>
          <div className="rk-badge-grid">{badges.map((badge) => <div className="rk-badge-card" key={badge.title}><ReKeyIllustration name={badge.art} /><strong>{badge.title}</strong><span>Sample artwork · no reward issued</span></div>)}</div>
        </article>
        <article className="rk-panel rk-empty-rewards"><ReKeyIllustration name="activity" className="rk-empty-art" /><p className="rk-eyebrow">CONTRIBUTION HISTORY</p><h2>No verified contributions</h2><p>There are no reward events to display.</p></article>
      </section>
    </div>
  );
}

function SettingsPage({ props }: { props: SharedPageProps }) {
  const { connected, walletAddress, onCopyAddress, onDisconnect, onNavigate } = props;
  return (
    <div className="rk-page-stack">
      <section className="rk-content-grid">
        <article className="rk-panel">
          <div className="rk-panel-heading"><div><p className="rk-eyebrow">ACCOUNT</p><h2>Wallet session</h2></div><ReKeyIllustration name="wallet" className="rk-heading-art" /></div>
          <div className="rk-detail-list"><DetailRow label="Network" value="Solana Devnet · fixed" /><DetailRow label="Connection" value={connected ? "Connected" : "Disconnected"} /><DetailRow label="Address" value={connected && walletAddress ? shortAddress(walletAddress) : "Not available"} /><DetailRow label="Smart wallet" value="Not initialized" /></div>
          <div className="rk-action-row">{connected && walletAddress && <button className="rk-button rk-button-secondary" type="button" onClick={onCopyAddress}><Copy size={15} aria-hidden="true" />{props.copied ? "Copied" : "Copy address"}</button>}{connected && <button className="rk-button rk-button-danger-quiet" type="button" onClick={onDisconnect}><LogOut size={15} aria-hidden="true" />Disconnect</button>}</div>
        </article>
        <article className="rk-panel">
          <p className="rk-eyebrow">SECURITY BOUNDARIES</p><h2>ReKey never needs your seed phrase.</h2>
          <ul className="rk-security-list"><li><Check size={16} aria-hidden="true" />Use a dedicated Devnet test wallet.</li><li><Check size={16} aria-hidden="true" />Never share private keys or recovery phrases.</li><li><Check size={16} aria-hidden="true" />Guardian approval does not grant spending power.</li><li><Check size={16} aria-hidden="true" />This prototype does not recover conventional Solana keypairs.</li></ul>
          <button className="rk-button rk-button-secondary" type="button" onClick={() => onNavigate("mcp")}>Review MCP permissions <ChevronRight size={16} aria-hidden="true" /></button>
        </article>
      </section>
      <section className="rk-panel rk-program-status"><ReKeyIllustration name="security" className="rk-inline-art" /><div><p className="rk-eyebrow">NETWORK STATUS</p><h2>Devnet only</h2><p>The wallet adapter is configured for Solana Devnet. Mainnet actions are not available in this prototype.</p></div><StatePill tone="warning">TEST NETWORK</StatePill></section>
    </div>
  );
}

export function LandingPage({ connected, onNavigate }: { connected: boolean; onNavigate: Navigate }) {
  return (
    <div className="rk-landing">
      <header className="rk-landing-nav">
        <button className="rk-brand-lockup" type="button" onClick={() => onNavigate("overview")} aria-label="Open ReKey dashboard"><img src="/assets/rekey-logo.jpg" alt="ReKey" /><span>ReKey<small>RECOVERY, ON YOUR TERMS</small></span></button>
        <div className="rk-landing-links"><button type="button" onClick={() => onNavigate("setup")}>How it works</button><button type="button" onClick={() => onNavigate("guardians")}>Guardians</button></div>
        <div className="rk-action-row"><StatePill tone="warning">DEVNET PROTOTYPE</StatePill><WalletMultiButton className="wallet-connect-button rk-wallet-adapter-button" /></div>
      </header>
      <main className="rk-landing-main">
        <section className="rk-landing-hero">
          <div className="rk-landing-copy">
            <p className="rk-eyebrow"><span /> A PLAN FOR THE DAY YOU NEED IT</p>
            <h1>Recovery should feel like a <em>lifeline</em>, not a leap of faith.</h1>
            <p>ReKey explores non-custodial recovery for Solana smart wallets, with trusted guardians and clear approval boundaries.</p>
            <div className="rk-action-row"><button className="rk-button rk-button-primary" type="button" onClick={() => onNavigate("setup")}>Explore the setup <ChevronRight size={17} aria-hidden="true" /></button><button className="rk-button rk-button-secondary" type="button" onClick={() => onNavigate("overview")}>{connected ? "Open dashboard" : "View prototype"}</button></div>
            <p className="rk-landing-caption"><ShieldAlert size={15} aria-hidden="true" /> Experimental Devnet software. Recovery is simulated; do not use real funds.</p>
          </div>
          <div className="rk-landing-art-wrap"><div className="rk-art-orbit" aria-hidden="true" /><ReKeyIllustration name="security" className="rk-landing-art" label="ReKey's friendly violet shield guardian" /><ReKeyIllustration name="wallet" className="rk-floating-wallet" /></div>
        </section>
        <section className="rk-landing-features" aria-label="ReKey product principles">
          <article><ReKeyIllustration name="guardians" /><h2>People you choose</h2><p>Guardians can approve recovery under a policy; they do not get your spending authority.</p></article>
          <article><ReKeyIllustration name="resilience" /><h2>Rules you can review</h2><p>Thresholds, delays, expiry, and cancellation should be clear before any approval.</p></article>
          <article><ReKeyIllustration name="activity" /><h2>State you can verify</h2><p>Simulated steps are labeled. Only confirmed on-chain events belong in your history.</p></article>
        </section>
      </main>
    </div>
  );
}

export function PageContent({ props }: { props: SharedPageProps }) {
  switch (props.page) {
    case "overview": return <OverviewPage props={props} />;
    case "smart-wallet": return <WalletPage props={props} />;
    case "setup": return <SetupPage props={props} />;
    case "recovery": return <RecoveryPage props={props} />;
    case "guardians": return <GuardiansPage />;
    case "activity": return <ActivityPage />;
    case "assistant": return <AssistantPage onNavigate={props.onNavigate} connected={props.connected} />;
    case "mcp": return <McpPage />;
    case "rewards": return <RewardsPage />;
    case "settings": return <SettingsPage props={props} />;
  }
  return null;
}