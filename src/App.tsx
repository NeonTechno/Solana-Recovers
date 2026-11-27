import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, Bell, Check, ChevronRight,
  CircleHelp, Clock3, Copy, Fingerprint, Github, KeyRound, LockKeyhole, LogOut,
  Menu, Plus, RefreshCw, Shield, ShieldAlert, ShieldCheck, Users, Wallet,
  X, Zap
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { formatSolAmount } from "./formatSolAmount";
import { initialRecoveryDemo, recoveryDemoReducer } from "./recoveryDemo";

type Tab = "overview" | "recovery" | "guardians" | "activity";
type NoticeKind = "info" | "success" | "error";
type Notice = { kind: NoticeKind; message: string };

const shortKey = (value: string) => value.length > 14 ? value.slice(0, 5) + "…" + value.slice(-5) : value;

function App() {
  const { connection } = useConnection();
  const { publicKey, connected, disconnect } = useWallet();
  const [tab, setTab] = useState<Tab>("overview");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);
  const [recoveryDemo, dispatchRecoveryDemo] = useReducer(recoveryDemoReducer, initialRecoveryDemo);
  const { status: recoveryState, approvals } = recoveryDemo;
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const notificationsCloseRef = useRef<HTMLButtonElement>(null);

  const refreshBalance = useCallback(async () => {
    if (!publicKey) { setBalance(null); return; }
    setBalanceLoading(true);
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      setBalance(lamports / 1_000_000_000);
    } catch {
      setNotice({ kind: "error", message: "Couldn't load the Devnet balance. Try refreshing." });
    } finally {
      setBalanceLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => { void refreshBalance(); }, [refreshBalance]);

  const closeMobileMenu = useCallback(() => {
    setMobileMenu(false);
    window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
  }, []);

  const selectTab = (nextTab: Tab) => {
    setTab(nextTab);
    setNotificationsOpen(false);
    if (mobileMenu) closeMobileMenu();
  };

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
    window.requestAnimationFrame(() => notificationsButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (mobileMenu) {
      mobileSidebarRef.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    }
    if (notificationsOpen) notificationsCloseRef.current?.focus();
    if (!mobileMenu && !notificationsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (notificationsOpen) closeNotifications();
        else if (mobileMenu) closeMobileMenu();
        return;
      }

      if (!mobileMenu || event.key !== "Tab") return;
      const focusable = mobileSidebarRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenu, notificationsOpen, closeMobileMenu, closeNotifications]);

  const requestAirdrop = async () => {
    if (!publicKey) return;
    setAirdropLoading(true);
    setNotice(null);
    try {
      const signature = await connection.requestAirdrop(publicKey, 1_000_000_000);
      await connection.confirmTransaction(signature, "confirmed");
      setNotice({ kind: "success", message: "1 Devnet SOL airdrop confirmed." });
      await refreshBalance();
    } catch {
      setNotice({ kind: "error", message: "Devnet airdrop unavailable right now. Try again later or use the Solana faucet." });
    } finally {
      setAirdropLoading(false);
    }
  };

  const copyAddress = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setNotice({ kind: "error", message: "Couldn't copy the address. Copy it from your wallet instead." });
    }
  };

  const startRecoveryDemo = () => {
    dispatchRecoveryDemo({ type: "start" });
    setNotice({ kind: "info", message: "Demo recovery request created. No on-chain state has changed." });
  };

  const approveDemo = (guardian: string) => {
    dispatchRecoveryDemo({ type: "approve", guardian });
    if (approvals.length === 1 && !approvals.includes(guardian)) {
      setNotice({ kind: "info", message: "Threshold met in simulation. The timelock and on-chain execution are not simulated." });
    }
  };

  const cancelDemo = () => {
    dispatchRecoveryDemo({ type: "cancel" });
    setNotice({ kind: "info", message: "Demo request cancelled. No on-chain request exists." });
  };

  const formattedBalance = useMemo(() => formatSolAmount(balance), [balance]);
  const completedSetupSteps = connected ? 1 : 0;
  const setupProgress = (completedSetupSteps / 4) * 100;
  const thresholdMet = recoveryState === "threshold-met";
  const recoveryStarted = recoveryState === "pending" || thresholdMet;

  const navItems = useMemo(() => [
    { id: "overview" as Tab, label: "Overview", icon: Activity },
    { id: "recovery" as Tab, label: "Recovery", icon: RefreshCw },
    { id: "guardians" as Tab, label: "Guardians", icon: Users },
    { id: "activity" as Tab, label: "Activity", icon: Clock3 }
  ], []);

  return (
    <div className="app-shell">
      <aside ref={mobileSidebarRef} id="primary-sidebar" aria-label="Primary navigation" className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={21} /></div>
          <div><strong>rekey<span>.</span></strong><small>RECOVERY PROTOCOL</small></div>
          <button className="mobile-close icon-button" type="button" onClick={closeMobileMenu} aria-label="Close primary navigation"><X size={18}/></button>
        </div>
        <div className="network-pill"><span className="pulse-dot"/> SOLANA DEVNET <span className="network-tag">TEST</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} className={`nav-item ${tab === item.id ? "active" : ""}`} onClick={() => selectTab(item.id)}>
              <Icon size={18}/><span>{item.label}</span>{item.id === "recovery" && recoveryStarted && <i className="nav-indicator" aria-hidden="true"/>}
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card">
            <div className="security-icon"><LockKeyhole size={17}/></div>
            <strong>Recovery stays non-custodial.</strong>
            <p>Guardian approval is limited to the recovery request; it does not sign wallet transactions.</p>
            <a href="https://github.com/NeonTechno/Solana-Recovers" target="_blank" rel="noreferrer">Review the code <ChevronRight size={13}/></a>
          </div>
          <div className="sidebar-footer"><span className="footer-dot"/> Prototype environment <span>v0.1.0</span></div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-scrim" type="button" onClick={closeMobileMenu} aria-label="Close navigation" aria-hidden="true" tabIndex={-1}/>}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button ref={mobileMenuButtonRef} className="mobile-menu icon-button" type="button" onClick={() => setMobileMenu(true)} aria-label="Open menu" aria-expanded={mobileMenu} aria-controls="primary-sidebar"><Menu size={19}/></button>
            <div className="breadcrumb">Workspace <ChevronRight size={14}/> <span>{navItems.find(n => n.id === tab)?.label}</span></div>
          </div>
          <div className="topbar-right">
            <div className="top-status"><span className="pulse-dot"/> Devnet connected</div>
            <div className="notification-wrap">
              <button ref={notificationsButtonRef} className="icon-button notification-button" type="button" aria-label="Notifications" aria-expanded={notificationsOpen} aria-controls="notifications-panel" onClick={() => setNotificationsOpen(open => !open)}><Bell size={18}/></button>
              {notificationsOpen && <section id="notifications-panel" className="notification-panel" aria-label="Notifications" role="region">
                <div><strong>You're all caught up</strong><p>Security alerts will appear here when available.</p></div>
                <button ref={notificationsCloseRef} className="icon-button" type="button" onClick={closeNotifications} aria-label="Close notifications"><X size={16}/></button>
              </section>}
            </div>
            <WalletMultiButton className="wallet-connect-button"/>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line"/> NON-CUSTODIAL WALLET SECURITY</div>
              <h1>{tab === "overview" ? "A recovery plan for your wallet." : tab === "recovery" ? "Recovery center" : tab === "guardians" ? "Your guardians" : "Activity log"}</h1>
              <p>{tab === "overview" ? "Review who can approve recovery and when changes could take effect." : tab === "recovery" ? "Review and test your wallet recovery process." : tab === "guardians" ? "The people you trust to help you recover access." : "A transparent view of your recovery activity."}</p>
            </div>
            <div className="heading-actions"><span className="prototype-chip"><span/> PROTOTYPE</span></div>
          </div>

          <div className="prototype-warning" role="note"><ShieldAlert size={17}/><div><strong>Prototype notice</strong><span>Wallet connection and Devnet balance are live. Recovery and guardian actions below are currently simulated in this browser — no wallet authority or assets are being changed.</span></div></div>

          {notice && <div className={`notice-banner notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-live={notice.kind === "error" ? "assertive" : "polite"}><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={15}/></button></div>}

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
                {connected && <button className="copy-address" type="button" onClick={copyAddress} aria-label={copied ? "Wallet address copied" : "Copy wallet address"} aria-live="polite"><Copy size={13}/>{copied ? "Copied" : "Copy address"}</button>}
              </div>
              <div className="stat-card">
                <div className="stat-top"><span>DEVNET BALANCE</span><div className="stat-icon purple"><Zap size={17}/></div></div>
                <div className="stat-value token-amount" aria-busy={balanceLoading}><span aria-live="polite" aria-label={balanceLoading ? "Loading Devnet SOL balance" : formattedBalance.ariaLabel} title={formattedBalance.approximate ? "Approximate display; no SOL/USD price is available." : undefined}>{balanceLoading ? "…" : formattedBalance.display}</span> <small>SOL</small></div>
                <div className="stat-foot">{connected ? "Live balance · Solana Devnet" : "Connect a wallet to view balance"}</div>
                <button className="text-action" type="button" onClick={() => void refreshBalance()} disabled={!connected || balanceLoading} aria-busy={balanceLoading}><RefreshCw size={13}/> Refresh</button>
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
                <div className="progress-track" role="progressbar" aria-label="Recovery setup progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completedSetupSteps}><span style={{width:`${setupProgress}%`}}/></div>
                <div className="readiness-meta"><span>Setup progress</span><strong>{completedSetupSteps} of 4 steps</strong></div>
                <div className="setup-list">
                  <div><span className="step-number">01</span><span>Connect a Solana wallet</span><span className={connected ? "step-done" : "step-pending"}>{connected ? "CONNECTED" : "PENDING"}</span></div>
                  <div><span className="step-number">02</span><span>Register a passkey</span><span className="step-pending">PLANNED</span></div>
                  <div><span className="step-number">03</span><span>Choose trusted guardians</span><span className="step-pending">PLANNED</span></div>
                  <div><span className="step-number">04</span><span>Register recovery policy</span><span className="step-pending">PLANNED</span></div>
                </div>
                <button className="primary-button full-button" type="button" onClick={() => selectTab("recovery")}>Explore recovery <ChevronRight size={16}/></button>
              </div>

              <div className="panel wallet-panel">
                <div className="panel-heading"><div><span className="section-kicker">ACCOUNT</span><h2>Wallet connection</h2></div><span className="panel-icon"><KeyRound size={18}/></span></div>
                <div className="wallet-illustration"><div className="wallet-orbit orbit-one"/><div className="wallet-orbit orbit-two"/><div className="wallet-illustration-icon"><Wallet size={29}/></div><div className="orbit-node node-one"/><div className="orbit-node node-two"/></div>
                <div className="wallet-details">
                  <div><span>Network</span><strong>Solana Devnet</strong></div>
                  <div><span>Address</span><strong>{connected && publicKey ? shortKey(publicKey.toBase58()) : "—"}</strong></div>
                  <div><span>Connection</span><strong className={connected ? "connected-label" : ""}>{connected ? "Active" : "Disconnected"}</strong></div>
                </div>
                {connected ? <button className="secondary-button full-button" type="button" onClick={() => void disconnect()}><LogOut size={15}/> Disconnect wallet</button> : <WalletMultiButton className="wallet-connect-button full-wallet-button"/>}
                <button className="faucet-link" type="button" onClick={() => void requestAirdrop()} disabled={!connected || airdropLoading} aria-busy={airdropLoading}>{airdropLoading ? "Requesting airdrop…" : "Get 1 Devnet SOL"} <ArrowUpRight size={14}/></button>
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
                <button className="quick-action" type="button" onClick={() => selectTab("recovery")}><div className="quick-action-icon"><RefreshCw size={16}/></div><div><strong>Recovery simulation</strong><span>Test the guardian approval flow</span></div><ChevronRight size={17}/></button>
                <button className="quick-action" type="button" onClick={() => selectTab("guardians")}><div className="quick-action-icon"><Users size={16}/></div><div><strong>Guardian setup</strong><span>Explore the 2-of-3 policy</span></div><ChevronRight size={17}/></button>
              </div>
            </section>
          </>}

          {tab === "recovery" && <section className="panel workspace-panel">
            <div className="panel-heading"><div><span className="section-kicker">SOCIAL RECOVERY · DEMO</span><h2>Recovery request</h2></div><span className={`state-pill state-${recoveryState}`} role="status">{thresholdMet ? "THRESHOLD MET" : recoveryState.toUpperCase()}</span></div>
            <div className="recovery-intro"><div className="large-feature-icon"><RefreshCw size={25}/></div><div><h3>Recover access with trusted people</h3><p>In the intended flow, the Solana program verifies each step. This preview demonstrates the sequence without submitting transactions.</p></div></div>
            <div className="flow-steps">
              <div className={`flow-step ${recoveryStarted ? "done" : recoveryState === "idle" ? "active" : ""}`}><span>1</span><div><strong>Request initiated</strong><small>Demo only; no wallet authority has changed</small></div>{recoveryStarted && <Check size={17}/>}</div>
              <div className={`flow-step ${thresholdMet ? "done" : recoveryState === "pending" && approvals.length > 0 ? "active" : ""}`}><span>2</span><div><strong>Guardian approvals</strong><small>{approvals.length} of 2 required approvals</small></div>{thresholdMet && <Check size={17}/>}</div>
              <div className={`flow-step ${thresholdMet ? "active" : ""}`}><span>3</span><div><strong>Timelock</strong><small>Would start after approval; execution is not simulated</small></div></div>
            </div>
            {recoveryState === "idle" || recoveryState === "cancelled" ? <button className="primary-button" type="button" onClick={startRecoveryDemo}><RefreshCw size={16}/> Start demo recovery</button> : <div className="approval-box">
              <strong>Guardian approval simulation</strong><p>Choose two different demo guardians to meet the threshold.</p>
              <div className="guardian-approval-grid">{["Guardian Alpha","Guardian Beta","Guardian Gamma"].map((g,i) => <button key={g} type="button" disabled={approvals.includes(g) || thresholdMet} aria-pressed={approvals.includes(g)} onClick={() => approveDemo(g)} className={`guardian-approve ${approvals.includes(g) ? "approved" : ""}`}><span className="guardian-avatar">{g.split(" ")[1][0]}</span><span>{g}<small>{approvals.includes(g) ? "Approved in demo" : "Awaiting approval"}</small></span>{approvals.includes(g) ? <Check size={17}/> : <Plus size={17}/>}</button>)}</div>
              {thresholdMet && <div className="success-message" role="status" aria-live="polite"><Check size={17}/> Threshold met in simulation. The timelock and on-chain execution are not simulated.</div>}
              {(recoveryState === "pending" || thresholdMet) && <button className="cancel-button" type="button" onClick={cancelDemo}><X size={15}/> Cancel demo request</button>}
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