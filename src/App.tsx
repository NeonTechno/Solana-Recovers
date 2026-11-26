import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, Bell, Check, ChevronRight,
  CircleHelp, Clock3, Copy, Fingerprint, Github, KeyRound, LockKeyhole, LogOut,
  Menu, Plus, RefreshCw, Shield, ShieldAlert, ShieldCheck, Users, Wallet,
  X, Zap
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

type Tab = "overview" | "recovery" | "guardians" | "activity";
type RecoveryState = "idle" | "pending" | "approved" | "cancelled";

const shortKey = (value: string) => value.length > 14 ? value.slice(0, 5) + "…" + value.slice(-5) : value;

function App() {
  const { connection } = useConnection();
  const { publicKey, connected, disconnect } = useWallet();
  const [tab, setTab] = useState<Tab>("overview");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("idle");
  const [approvals, setApprovals] = useState<string[]>([]);
  const [mobileMenu, setMobileMenu] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!publicKey) { setBalance(null); return; }
    setBalanceLoading(true);
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setBalance(lamports / 1_000_000_000);
    } catch {
      setNotice("Couldn't load the Devnet balance. Try refreshing.");
    } finally {
      setBalanceLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => { void refreshBalance(); }, [refreshBalance]);

  const requestAirdrop = async () => {
    if (!publicKey) return;
    setAirdropLoading(true);
    setNotice("");
    try {
      const signature = await connection.requestAirdrop(publicKey, 1_000_000_000);
      await connection.confirmTransaction(signature, "confirmed");
      setNotice("1 Devnet SOL airdrop confirmed.");
      await refreshBalance();
    } catch {
      setNotice("Devnet airdrop unavailable right now. Try again later or use the Solana faucet.");
    } finally {
      setAirdropLoading(false);
    }
  };

  const copyAddress = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const startRecoveryDemo = () => {
    setApprovals([]);
    setRecoveryState("pending");
    setNotice("Demo recovery request created. No on-chain state has changed.");
  };

  const approveDemo = (guardian: string) => {
    setApprovals(current => current.includes(guardian) ? current : [...current, guardian]);
    if (approvals.length + 1 >= 2) setRecoveryState("approved");
  };

  const cancelDemo = () => {
    setRecoveryState("cancelled");
    setApprovals([]);
    setNotice("Demo recovery request cancelled.");
  };

  const navItems = useMemo(() => [
    { id: "overview" as Tab, label: "Overview", icon: Activity },
    { id: "recovery" as Tab, label: "Recovery", icon: RefreshCw },
    { id: "guardians" as Tab, label: "Guardians", icon: Users },
    { id: "activity" as Tab, label: "Activity", icon: Clock3 }
  ], []);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={21} /></div>
          <div><strong>rekey<span>.</span></strong><small>RECOVERY PROTOCOL</small></div>
          <button className="mobile-close icon-button" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18}/></button>
        </div>
        <div className="network-pill"><span className="pulse-dot"/> SOLANA DEVNET <span className="network-tag">TEST</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setMobileMenu(false); }}>
              <Icon size={18}/><span>{item.label}</span>{item.id === "recovery" && recoveryState === "pending" && <i className="nav-indicator"/>}
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-icon"><LockKeyhole size={17}/></div>
            <strong>Your keys stay yours.</strong>
            <p>Guardians can authorize recovery. They never get access to your funds.</p>
            <a href="https://github.com/NeonTechno/Solana-Recovers" target="_blank" rel="noreferrer">Review the code <ChevronRight size={13}/></a>
          </div>
          <div className="sidebar-footer"><span className="footer-dot"/> Prototype environment <span>v0.1.0</span></div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation"/>}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={19}/></button>
            <div className="breadcrumb">Workspace <ChevronRight size={14}/> <span>{navItems.find(n => n.id === tab)?.label}</span></div>
          </div>
          <div className="topbar-right">
            <div className="top-status"><span className="pulse-dot"/> Devnet connected</div>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18}/><i/></button>
            <WalletMultiButton className="wallet-connect-button"/>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line"/> NON-CUSTODIAL WALLET SECURITY</div>
              <h1>{tab === "overview" ? "Your wallet, protected." : tab === "recovery" ? "Recovery center" : tab === "guardians" ? "Your guardians" : "Activity log"}</h1>
              <p>{tab === "overview" ? "A safer way back into your Solana wallet." : tab === "recovery" ? "Review and test your wallet recovery process." : tab === "guardians" ? "The people you trust to help you recover access." : "A transparent view of your recovery activity."}</p>
            </div>
            <div className="heading-actions"><span className="prototype-chip"><span/> PROTOTYPE</span></div>
          </div>

          <div className="prototype-warning"><ShieldAlert size={17}/><div><strong>Prototype notice</strong><span>Wallet connection and Devnet balance are live. Recovery and guardian actions below are currently simulated in this browser — no wallet authority or assets are being changed.</span></div></div>

          {notice && <div className="notice-banner"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}

          {!connected && <section className="connect-banner">
            <div className="connect-art"><Wallet size={23}/></div>
            <div><strong>Connect your Solana wallet</strong><p>Connect Phantom or Solflare on Devnet to see your address and live SOL balance.</p></div>
            <WalletMultiButton className="wallet-connect-button connect-cta"/>
          </section>}

          {tab === "overview" && <>
            <section className="stats-grid">
              <div className="stat-card balance-card">
                <div className="stat-top"><span>CONNECTED WALLET</span><div className="stat-icon"><Wallet size={17}/></div></div>
                <div className="stat-value address-value">{connected && publicKey ? shortKey(publicKey.toBase58()) : "Not connected"}</div>
                <div className="stat-foot">{connected ? <><span className="live-dot"/> Wallet connected</> : "Connect a wallet to begin"}</div>
                {connected && <button className="copy-address" onClick={copyAddress}><Copy size={13}/>{copied ? "Copied" : "Copy address"}</button>}
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>DEVNET BALANCE</span><div className="stat-icon purple"><Zap size={17}/></div></div>
                <div className="stat-value">{balanceLoading ? "…" : balance === null ? "—" : balance.toFixed(4)} <small>SOL</small></div>
                <div className="stat-foot">Live balance · Solana Devnet</div>
                <button className="text-action" onClick={() => void refreshBalance()} disabled={!connected || balanceLoading}><RefreshCw size={13}/> Refresh</button>
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>GUARDIAN POLICY</span><div className="stat-icon green"><Users size={17}/></div></div>
                <div className="stat-value">2 <small>of 3</small></div>
                <div className="stat-foot">Illustrative threshold configuration</div>
                <span className="stat-badge">DEMO CONFIG</span>
              </div>
            </section>

            <section className="section-grid">
              <div className="panel recovery-panel">
                <div className="panel-heading"><div><span className="section-kicker">RECOVERY READINESS</span><h2>Recovery overview</h2></div><span className="panel-icon"><Shield size={18}/></span></div>
                <div className="readiness-row"><div className="readiness-score">—<small>/100</small></div><div><strong>Not configured on-chain</strong><p>Your recovery policy will be registered when the smart-wallet program is deployed.</p></div></div>
                <div className="progress-track"><span style={{width:"0%"}}/></div>
                <div className="readiness-meta"><span>Setup progress</span><strong>0 of 4 steps</strong></div>
                <div className="setup-list">
                  <div><span className="step-number">01</span><span>Connect a Solana wallet</span><span className={connected ? "step-done" : "step-pending"}>{connected ? "CONNECTED" : "PENDING"}</span></div>
                  <div><span className="step-number">02</span><span>Register a passkey</span><span className="step-pending">PLANNED</span></div>
                  <div><span className="step-number">03</span><span>Choose trusted guardians</span><span className="step-pending">PLANNED</span></div>
                  <div><span className="step-number">04</span><span>Register recovery policy</span><span className="step-pending">PLANNED</span></div>
                </div>
                <button className="primary-button full-button" onClick={() => setTab("recovery")}>Explore recovery <ChevronRight size={16}/></button>
              </div>

              <div className="panel wallet-panel">
                <div className="panel-heading"><div><span className="section-kicker">ACCOUNT</span><h2>Wallet connection</h2></div><span className="panel-icon"><KeyRound size={18}/></span></div>
                <div className="wallet-illustration"><div className="wallet-orbit orbit-one"/><div className="wallet-orbit orbit-two"/><div className="wallet-illustration-icon"><Wallet size={29}/></div><div className="orbit-node node-one"/><div className="orbit-node node-two"/></div>
                <div className="wallet-details">
                  <div><span>Network</span><strong>Solana Devnet</strong></div>
                  <div><span>Address</span><strong>{connected && publicKey ? shortKey(publicKey.toBase58()) : "—"}</strong></div>
                  <div><span>Connection</span><strong className={connected ? "connected-label" : ""}>{connected ? "Active" : "Disconnected"}</strong></div>
                </div>
                {connected ? <button className="secondary-button full-button" onClick={() => void disconnect()}><LogOut size={15}/> Disconnect wallet</button> : <WalletMultiButton className="wallet-connect-button full-wallet-button"/>}
                <button className="faucet-link" onClick={() => void requestAirdrop()} disabled={!connected || airdropLoading}>{airdropLoading ? "Requesting airdrop…" : "Get 1 Devnet SOL"} <ArrowUpRight size={14}/></button>
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel feature-panel">
                <div className="panel-heading"><div><span className="section-kicker">HYBRID SECURITY</span><h2>Three layers of protection</h2></div><BadgeCheck size={19} className="muted-icon"/></div>
                <div className="feature-list">
                  <div className="feature-row"><div className="feature-icon teal"><Fingerprint size={18}/></div><div><strong>Passkey authentication</strong><p>Device-bound authentication without exposing private keys.</p></div><span className="feature-status">PLANNED</span></div>
                  <div className="feature-row"><div className="feature-icon violet"><Users size={18}/></div><div><strong>Trusted guardians</strong><p>Independent approvals with a configurable threshold.</p></div><span className="feature-status">PLANNED</span></div>
                  <div className="feature-row"><div className="feature-icon blue"><ShieldCheck size={18}/></div><div><strong>On-chain enforcement</strong><p>Program-controlled authority, timelocks and cancellation.</p></div><span className="feature-status">PLANNED</span></div>
                </div>
              </div>
              <div className="panel quick-panel">
                <div className="panel-heading"><div><span className="section-kicker">DEVELOPER PREVIEW</span><h2>Try the prototype</h2></div><Zap size={18} className="muted-icon"/></div>
                <p className="quick-copy">Explore the recovery experience while the on-chain program is being built.</p>
                <button className="quick-action" onClick={() => setTab("recovery")}><div className="quick-action-icon"><RefreshCw size={16}/></div><div><strong>Recovery simulation</strong><span>Test the guardian approval flow</span></div><ChevronRight size={17}/></button>
                <button className="quick-action" onClick={() => setTab("guardians")}><div className="quick-action-icon"><Users size={16}/></div><div><strong>Guardian setup</strong><span>Explore the 2-of-3 policy</span></div><ChevronRight size={17}/></button>
              </div>
            </section>
          </>}

          {tab === "recovery" && <section className="panel workspace-panel">
            <div className="panel-heading"><div><span className="section-kicker">SOCIAL RECOVERY · DEMO</span><h2>Recovery request</h2></div><span className={`state-pill state-${recoveryState}`}>{recoveryState.toUpperCase()}</span></div>
            <div className="recovery-intro"><div className="large-feature-icon"><RefreshCw size={25}/></div><div><h3>Recover access with trusted people</h3><p>A real recovery request will be verified by the Solana program. This preview demonstrates the intended sequence without submitting transactions.</p></div></div>
            <div className="flow-steps">
              <div className={recoveryState !== "idle" ? "flow-step done" : "flow-step active"}><span>1</span><div><strong>Request initiated</strong><small>New wallet authority is specified</small></div>{recoveryState !== "idle" && <Check size={17}/>}</div>
              <div className={approvals.length > 0 ? "flow-step done" : "flow-step"}><span>2</span><div><strong>Guardian approvals</strong><small>{approvals.length} of 2 required approvals</small></div>{approvals.length > 0 && <Check size={17}/>}</div>
              <div className={recoveryState === "approved" ? "flow-step done" : "flow-step"}><span>3</span><div><strong>Timelock & execution</strong><small>On-chain delay and owner cancellation</small></div>{recoveryState === "approved" && <Check size={17}/>}</div>
            </div>
            {recoveryState === "idle" || recoveryState === "cancelled" ? <button className="primary-button" onClick={startRecoveryDemo}><RefreshCw size={16}/> Start demo recovery</button> : <div className="approval-box">
              <strong>Guardian approval simulation</strong><p>Choose two guardians to approve this request.</p>
              <div className="guardian-approval-grid">{["Guardian Alpha","Guardian Beta","Guardian Gamma"].map((g,i) => <button key={g} disabled={approvals.includes(g) || recoveryState === "approved"} onClick={() => approveDemo(g)} className={`guardian-approve ${approvals.includes(g) ? "approved" : ""}`}><span className="guardian-avatar">{g.split(" ")[1][0]}</span><span>{g}<small>{approvals.includes(g) ? "Approved" : "Awaiting approval"}</small></span>{approvals.includes(g) ? <Check size={17}/> : <Plus size={17}/>}</button>)}</div>
              {recoveryState === "approved" && <div className="success-message"><Check size={17}/> Threshold reached in simulation. The real on-chain execution is not implemented yet.</div>}
              {recoveryState === "pending" && <button className="cancel-button" onClick={cancelDemo}><X size={15}/> Cancel demo request</button>}
            </div>}
          </section>}

          {tab === "guardians" && <section className="panel workspace-panel">
            <div className="panel-heading"><div><span className="section-kicker">RECOVERY CIRCLE · DEMO</span><h2>Guardian configuration</h2></div><span className="state-pill state-idle">2 OF 3 THRESHOLD</span></div>
            <p className="panel-description">Guardians approve ownership recovery only. They cannot spend, transfer or withdraw your assets.</p>
            <div className="guardian-list">{["Guardian Alpha","Guardian Beta","Guardian Gamma"].map((g,i) => <div className="guardian-item" key={g}><div className="guardian-avatar">{g.split(" ")[1][0]}</div><div className="guardian-info"><strong>{g}</strong><small>{i === 0 ? "Trusted contact · Demo" : i === 1 ? "Backup contact · Demo" : "Recovery contact · Demo"}</small></div><span className="guardian-role">APPROVER</span><BadgeCheck size={17} className="muted-icon"/></div>)}</div>
            <div className="threshold-card"><div><strong>Approval threshold</strong><p>At least 2 guardians must approve a recovery request.</p></div><div className="threshold-number">2<span>/3</span></div></div>
            <div className="notice-inline"><CircleHelp size={16}/> Guardian identities and approvals are illustrative. No contacts have been registered on-chain.</div>
          </section>}

          {tab === "activity" && <section className="panel workspace-panel">
            <div className="panel-heading"><div><span className="section-kicker">AUDIT TRAIL</span><h2>Recent activity</h2></div><Activity size={19} className="muted-icon"/></div>
            <div className="empty-state"><div className="empty-icon"><Clock3 size={25}/></div><strong>No on-chain activity yet</strong><p>Once the recovery program is deployed, wallet configuration and recovery events will appear here.</p><button className="secondary-button" onClick={() => setTab("recovery")}>Try the recovery demo <ChevronRight size={15}/></button></div>
          </section>}

          <footer className="page-footer"><span>REKEY © 2026</span><span>BUILT FOR SOLANA <span className="footer-separator">·</span> DEV3PACK HACKATHON</span><a href="https://solana.com/developers" target="_blank" rel="noreferrer">Solana docs <ArrowUpRight size={12}/></a></footer>
        </div>
      </main>
    </div>
  );
}

export default App;