import { useState } from "react";
import {
  ArrowRight, Check, ChevronRight, Copy, ExternalLink,
  LockKeyhole, ShieldAlert, Users,
} from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { ApiHealth } from "./api/types";
import type { AppTab } from "./appTypes";
import { ReKeyIllustration } from "./components/ReKeyIllustration";

type ApiStatus = "checking" | "online" | "offline";
type Navigate = (tab: AppTab) => void;

export function LandingSurface({ connected, onNavigate }: { connected: boolean; onNavigate: Navigate }) {
  return (
    <div className="rk-landing">
      <header className="rk-landing-nav">
        <button className="rk-brand-lockup" type="button" onClick={() => onNavigate("overview")} aria-label="Open ReKey workspace">
          <img src="/rekey-logo.jpg" alt="" width="44" height="44" />
          <span>ReKey<small>RECOVERY, ON YOUR TERMS</small></span>
        </button>
        <div className="rk-landing-actions"><span className="rk-devnet-chip">SOLANA DEVNET · TEST</span><WalletMultiButton className="wallet-connect-button" /></div>
      </header>
      <main className="rk-landing-main">
        <section className="rk-landing-hero">
          <div className="rk-landing-copy">
            <p className="rk-landing-eyebrow"><span /> A PLAN FOR THE DAY YOU NEED IT</p>
            <h1>Recovery should feel like a <em>lifeline</em>, not a leap of faith.</h1>
            <p>ReKey explores non-custodial recovery for Solana smart wallets, with trusted guardians and clear approval boundaries.</p>
            <div className="rk-landing-buttons">
              <button className="primary-button" type="button" onClick={() => onNavigate("setup")}>Build a recovery plan <ArrowRight size={16} aria-hidden="true" /></button>
              <button className="secondary-button" type="button" onClick={() => onNavigate("overview")}>{connected ? "Open workspace" : "Explore prototype"}</button>
            </div>
            <p className="rk-landing-notice"><ShieldAlert size={16} aria-hidden="true" /> Devnet prototype. Recovery actions require the deployed program and an explicit wallet signature.</p>
          </div>
          <div className="rk-landing-art" aria-label="ReKey security illustration">
            <span className="rk-landing-orbit" aria-hidden="true" />
            <ReKeyIllustration name="security" className="rk-landing-shield" label="Friendly shield mascot with a violet finish" />
            <ReKeyIllustration name="wallet" className="rk-landing-wallet" />
          </div>
        </section>
        <section className="rk-landing-features" aria-label="ReKey principles">
          <article><ReKeyIllustration name="guardians" /><h2>People you choose</h2><p>Guardians can approve recovery under a policy; they do not get spending authority.</p></article>
          <article><ReKeyIllustration name="resilience" /><h2>Rules you can review</h2><p>Thresholds, delays, expiry, and cancellation should be clear before any approval.</p></article>
          <article><ReKeyIllustration name="activity" /><h2>State you can verify</h2><p>Simulated steps are labeled. Only confirmed on-chain events belong in your history.</p></article>
        </section>
      </main>
    </div>
  );
}

interface SmartWalletProps {
  connected: boolean;
  walletAddress: string | null;
  balanceText: string;
  balanceLoading: boolean;
  apiStatus: ApiStatus;
  health: ApiHealth | null;
  copied: boolean;
  onCopyAddress: () => void;
  onDisconnect: () => void;
  onRefreshBalance: () => void;
}

export function SmartWalletSurface(props: SmartWalletProps) {
  const { connected, walletAddress, balanceText, balanceLoading, apiStatus, health, copied, onCopyAddress, onDisconnect, onRefreshBalance } = props;
  return (
    <section className="rk-page-stack">
      <div className="rk-smart-wallet-hero">
        <div><p className="rk-surface-eyebrow">CONNECTED WALLET · SOLANA DEVNET</p><h2>Wallet details, without made-up numbers.</h2><p>Balances come from Solana RPC. ReKey smart-wallet state is only shown when the API returns it.</p></div>
        <ReKeyIllustration name="wallet" className="rk-smart-wallet-art" />
      </div>
      <div className="rk-detail-grid">
        <article className="rk-detail-card">
          <div className="rk-detail-heading"><span>YOUR WALLET</span><span className={`rk-detail-state ${connected ? "is-live" : ""}`}>{connected ? "CONNECTED" : "DISCONNECTED"}</span></div>
          <strong className="rk-detail-value rk-address-value">{connected && walletAddress ? `${walletAddress.slice(0, 5)}…${walletAddress.slice(-5)}` : "No wallet connected"}</strong>
          <p>Wallet adapter · Solana Devnet</p>
          {connected && walletAddress && <div className="rk-detail-actions">
            <button type="button" className="secondary-button" onClick={onCopyAddress}><Copy size={14} aria-hidden="true" />{copied ? "Copied" : "Copy address"}</button>
            <a className="secondary-button" href={`https://explorer.solana.com/address/${walletAddress}?cluster=devnet`} target="_blank" rel="noreferrer">Explorer <ExternalLink size={14} aria-hidden="true" /></a>
          </div>}
          {connected && <button type="button" className="rk-disconnect-action" onClick={onDisconnect}>Disconnect wallet</button>}
          {!connected && <WalletMultiButton className="wallet-connect-button" />}
        </article>
        <article className="rk-detail-card rk-balance-detail">
          <div className="rk-detail-heading"><span>LIVE DEVNET BALANCE</span><button type="button" className="rk-refresh-button" onClick={onRefreshBalance} disabled={!connected || balanceLoading} aria-label="Refresh Devnet SOL balance" aria-busy={balanceLoading}>{balanceLoading ? "Loading" : "Refresh"}</button></div>
          <strong className="rk-detail-value rk-mono">{connected ? balanceText : "—"} <small>SOL</small></strong>
          <p>{connected ? "Fetched from the Devnet RPC. USD value is not estimated." : "Connect a wallet to query its balance."}</p>
        </article>
        <article className="rk-detail-card rk-program-detail">
          <div className="rk-detail-heading"><span>REKEY SMART WALLET</span><span className="rk-demo-chip">NOT INITIALIZED</span></div>
          <ReKeyIllustration name="security" className="rk-detail-illustration" />
          <strong className="rk-detail-value">No smart wallet linked</strong>
          <p>Initialization is unavailable until a deployed program and its account interface are connected.</p>
        </article>
        <article className="rk-detail-card">
          <div className="rk-detail-heading"><span>PROGRAM HEALTH</span><span className={`rk-detail-state ${apiStatus === "online" ? "is-live" : ""}`}>{apiStatus === "checking" ? "CHECKING" : apiStatus === "online" ? "API ONLINE" : "API OFFLINE"}</span></div>
          <dl className="rk-health-list"><div><dt>Cluster</dt><dd>{health?.cluster ?? "Devnet (fixed)"}</dd></div><div><dt>RPC reachable</dt><dd>{health ? health.rpcReachable ? "Yes" : "No" : "Not reported"}</dd></div><div><dt>Program ID</dt><dd>{health?.programId ? `${health.programId.slice(0, 5)}…${health.programId.slice(-5)}` : "Not reported"}</dd></div></dl>
          <p>API health is not proof that this wallet has a ReKey account.</p>
        </article>
      </div>
      <p className="rk-trust-note"><LockKeyhole size={15} aria-hidden="true" /> Never send funds to an address represented as a ReKey smart wallet until on-chain initialization is supported and confirmed.</p>
    </section>
  );
}

const SETUP_STEPS = [
  { title: "Connect a test wallet", detail: "Use a dedicated Solana Devnet wallet. ReKey never asks for a seed phrase or private key." },
  { title: "Initialize the ReKey wallet", detail: "This action is unavailable until the program is deployed and the initialization transaction is integrated." },
  { title: "Choose guardians", detail: "Guardian identities cannot be registered in this preview. The app will not invent contacts or addresses." },
  { title: "Set threshold and delay", detail: "These controls update local preview values only; nothing is saved to a wallet or sent to the API." },
  { title: "Review readiness", detail: "A readiness score is not calculated from sample data. On-chain configuration remains unverified." },
];

export function SetupSurface({ connected, onNavigate }: { connected: boolean; onNavigate: Navigate }) {
  const [step, setStep] = useState(0);
  const [threshold, setThreshold] = useState("2 of 3");
  const [delay, setDelay] = useState("24 hours");
  const current = SETUP_STEPS[step];
  return (
    <section className="rk-page-stack">
      <div className="rk-setup-warning" role="note"><ShieldAlert size={17} aria-hidden="true" /> Guided setup preview only. Wallet connection and Devnet balance are live; setup values stay in this browser.</div>
      <div className="rk-setup-layout">
        <article className="rk-detail-card rk-setup-card">
          <div className="rk-setup-heading"><div><p className="rk-surface-eyebrow">STEP {String(step + 1).padStart(2, "0")} / 05</p><h2>{current.title}</h2></div><ReKeyIllustration name={step === 2 ? "guardians" : step === 4 ? "resilience" : "recovery"} className="rk-setup-art" /></div>
          <p>{current.detail}</p>
          {step === 0 && <div>{connected ? <span className="rk-setup-connected"><Check size={15} aria-hidden="true" />Devnet wallet connected</span> : <WalletMultiButton className="wallet-connect-button" />}</div>}
          {step === 1 && <div className="rk-setup-unavailable"><LockKeyhole size={17} aria-hidden="true" />Initialization is not available in this prototype.</div>}
          {step === 2 && <div className="rk-setup-unavailable"><Users size={17} aria-hidden="true" />No guardians are registered. No identities are being simulated.</div>}
          {step === 3 && <fieldset className="rk-policy-preview"><legend>Local policy preview</legend><div><label htmlFor="setup-threshold">Approval threshold</label><select id="setup-threshold" value={threshold} onChange={event => setThreshold(event.target.value)}><option>2 of 3</option><option>3 of 5</option></select></div><div><label htmlFor="setup-delay">Recovery delay</label><select id="setup-delay" value={delay} onChange={event => setDelay(event.target.value)}><option>24 hours</option><option>48 hours</option><option>72 hours</option></select></div><small>These values are not registered or submitted.</small></fieldset>}
          {step === 4 && <dl className="rk-review-list"><div><dt>Wallet</dt><dd>{connected ? "Connected on Devnet" : "Not connected"}</dd></div><div><dt>Smart wallet</dt><dd>Not initialized</dd></div><div><dt>Guardian policy</dt><dd>{threshold} · local preview</dd></div><div><dt>Delay</dt><dd>{delay} · inactive</dd></div><div><dt>Transaction</dt><dd>None signed or submitted</dd></div></dl>}
          <div className="rk-setup-actions">{step > 0 && <button className="secondary-button" type="button" onClick={() => setStep(step - 1)}>Back</button>}{step < SETUP_STEPS.length - 1 ? <button className="primary-button" type="button" onClick={() => setStep(step + 1)}>Continue in preview <ChevronRight size={15} aria-hidden="true" /></button> : <button className="primary-button" type="button" onClick={() => onNavigate("recovery")}>Open recovery center <ChevronRight size={15} aria-hidden="true" /></button>}</div>
        </article>
        <aside className="rk-detail-card rk-setup-steps"><p className="rk-surface-eyebrow">RECOVERY PATH</p><ol>{SETUP_STEPS.map((item, index) => <li className={index === step ? "is-current" : index < step ? "is-visited" : ""} key={item.title}><span>{index < step ? <Check size={14} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong></li>)}</ol><p>Visited steps are not evidence of on-chain configuration.</p></aside>
      </div>
    </section>
  );
}

export function SettingsSurface({ connected, walletAddress, apiStatus, onCopyAddress, copied, onDisconnect, onNavigate }: {
  connected: boolean;
  walletAddress: string | null;
  apiStatus: ApiStatus;
  copied: boolean;
  onCopyAddress: () => void;
  onDisconnect: () => void;
  onNavigate: Navigate;
}) {
  return (
    <section className="rk-page-stack">
      <div className="rk-detail-grid">
        <article className="rk-detail-card"><div className="rk-detail-heading"><span>ACCOUNT</span><span className="rk-demo-chip">DEVNET ONLY</span></div><h2>Wallet session</h2><dl className="rk-health-list"><div><dt>Connection</dt><dd>{connected ? "Connected" : "Disconnected"}</dd></div><div><dt>Address</dt><dd>{connected && walletAddress ? `${walletAddress.slice(0, 5)}…${walletAddress.slice(-5)}` : "Not available"}</dd></div><div><dt>Cluster</dt><dd>Solana Devnet · fixed</dd></div><div><dt>ReKey account</dt><dd>Not initialized</dd></div></dl><div className="rk-detail-actions">{connected && walletAddress && <button className="secondary-button" type="button" onClick={onCopyAddress}><Copy size={14} aria-hidden="true" />{copied ? "Copied" : "Copy address"}</button>}{connected && <button className="secondary-button" type="button" onClick={onDisconnect}>Disconnect wallet</button>}</div></article>
        <article className="rk-detail-card"><div className="rk-detail-heading"><span>SECURITY BOUNDARIES</span><span className={`rk-detail-state ${apiStatus === "online" ? "is-live" : ""}`}>{apiStatus === "online" ? "API ONLINE" : apiStatus === "checking" ? "CHECKING" : "API OFFLINE"}</span></div><ReKeyIllustration name="security" className="rk-settings-art" /><h2>Never share secret material.</h2><ul className="rk-security-list"><li><Check size={15} aria-hidden="true" />ReKey never asks for a seed phrase or private key.</li><li><Check size={15} aria-hidden="true" />Guardian approval does not grant spending authority.</li><li><Check size={15} aria-hidden="true" />AI and MCP tools are advisory and read-only.</li><li><Check size={15} aria-hidden="true" />Recovery requires an explicit wallet signature.</li></ul></article>
      </div>
      <div className="rk-settings-links"><button className="secondary-button" type="button" onClick={() => onNavigate("mcp")}>Review MCP permissions <ChevronRight size={15} aria-hidden="true" /></button><button className="secondary-button" type="button" onClick={() => onNavigate("assistant")}>AI security guide <ChevronRight size={15} aria-hidden="true" /></button></div>
    </section>
  );
}