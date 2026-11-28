import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Activity, BadgeCheck, ChevronRight, Clock3, Fingerprint,
  LockKeyhole, Menu, Network, RefreshCw, Shield, ShieldAlert, Users,
  Wallet, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { formatSolAmount } from "./formatSolAmount";
import { initialRecoveryDemo, recoveryDemoReducer } from "./recoveryDemo";
import { AmbientBackground } from "./components/AmbientBackground";
import { LandingPage, PageContent, pageMeta } from "./pages";
import type { AppPage } from "./pages";

type CurrentPage = AppPage | "landing";

const navGroups: Array<{ label: string; items: Array<{ id: AppPage; label: string; icon: LucideIcon }> }> = [
  {
    label: "RECOVERY WORKSPACE",
    items: [
      { id: "overview", label: "Overview", icon: Activity },
      { id: "smart-wallet", label: "Smart wallet", icon: Wallet },
      { id: "setup", label: "Recovery setup", icon: Fingerprint },
      { id: "recovery", label: "Recovery request", icon: RefreshCw },
      { id: "guardians", label: "Guardians", icon: Users },
      { id: "activity", label: "Activity", icon: Clock3 },
    ],
  },
  {
    label: "SECURITY & SUPPORT",
    items: [
      { id: "assistant", label: "Security guide", icon: Zap },
      { id: "mcp", label: "MCP connections", icon: Network },
      { id: "rewards", label: "Lifeline Rewards", icon: BadgeCheck },
      { id: "settings", label: "Security settings", icon: LockKeyhole },
    ],
  },
];

function ReKeyApp() {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const [page, setPage] = useState<CurrentPage>("landing");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [airdropNotice, setAirdropNotice] = useState<string | null>(null);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [recoveryDemo, dispatchRecoveryDemo] = useReducer(recoveryDemoReducer, initialRecoveryDemo);
  const [proposedOwner, setProposedOwner] = useState("");
  const [threshold, setThreshold] = useState("2-of-3");
  const [delay, setDelay] = useState("24 hours");
  const [setupStep, setSetupStep] = useState(0);
  const walletAddress = publicKey?.toBase58() ?? null;
  const walletAddressRef = useRef<string | null>(walletAddress);
  const balanceRequestRef = useRef(0);
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);

  walletAddressRef.current = walletAddress;

  const refreshBalance = useCallback(async () => {
    if (!connected || !publicKey) {
      balanceRequestRef.current += 1;
      setBalance(null);
      setBalanceError(null);
      setBalanceLoading(false);
      return;
    }

    const requestId = ++balanceRequestRef.current;
    const address = publicKey.toBase58();
    setBalanceLoading(true);
    setBalanceError(null);

    try {
      const lamports = await connection.getBalance(publicKey, "confirmed");
      if (requestId === balanceRequestRef.current && walletAddressRef.current === address) {
        setBalance(lamports / 1_000_000_000);
      }
    } catch {
      if (requestId === balanceRequestRef.current && walletAddressRef.current === address) {
        setBalanceError("Couldn't load the Devnet balance. Check your connection and retry.");
      }
    } finally {
      if (requestId === balanceRequestRef.current) setBalanceLoading(false);
    }
  }, [connection, connected, publicKey]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const closeMobileMenu = useCallback(() => {
    setMobileMenu(false);
    window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
  }, []);

  const selectPage = useCallback((nextPage: AppPage) => {
    setPage(nextPage);
    setMobileMenu(false);
    window.requestAnimationFrame(() => mainContentRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileMenu) return;
    mobileSidebarRef.current?.querySelector<HTMLButtonElement>(".rk-mobile-close")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
        return;
      }
      if (event.key !== "Tab") return;

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
  }, [mobileMenu, closeMobileMenu]);

  const requestAirdrop = async () => {
    if (!publicKey || !connected || airdropLoading) return;
    const requestAddress = publicKey.toBase58();
    setAirdropLoading(true);
    setAirdropNotice(null);

    try {
      const signature = await connection.requestAirdrop(publicKey, 1_000_000_000);
      await connection.confirmTransaction(signature, "confirmed");
      setAirdropNotice(walletAddressRef.current === requestAddress
        ? "1 Devnet SOL airdrop confirmed."
        : "1 Devnet SOL airdrop confirmed for the previously connected address; the wallet changed during confirmation.");
      if (walletAddressRef.current === requestAddress) await refreshBalance();
    } catch {
      setAirdropNotice("Devnet airdrop unavailable right now. Try again later or use the Solana faucet.");
    } finally {
      setAirdropLoading(false);
    }
  };

  const copyAddress = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setWalletNotice(null);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setWalletNotice("Couldn't copy the address. Copy it from your wallet instead.");
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();
      setCopied(false);
      setWalletNotice(null);
    } catch {
      setWalletNotice("Couldn't disconnect this wallet. Close its wallet prompt and try again.");
    }
  };

  const startRecoveryDemo = () => dispatchRecoveryDemo({ type: "start" });
  const approveDemoGuardian = (guardian: string) => dispatchRecoveryDemo({ type: "approve", guardian });
  const cancelRecoveryDemo = () => dispatchRecoveryDemo({ type: "cancel" });
  const formattedBalance = useMemo(() => formatSolAmount(balance), [balance]);
  const { status: recoveryState, approvals } = recoveryDemo;
  const currentPage = page === "landing" ? null : page;

  const sharedPageProps = currentPage ? {
    page: currentPage,
    connected,
    walletAddress,
    balanceText: formattedBalance.display,
    balanceAriaLabel: formattedBalance.ariaLabel,
    balanceLoading,
    balanceError,
    onRefreshBalance: () => void refreshBalance(),
    onRequestAirdrop: () => void requestAirdrop(),
    airdropLoading,
    airdropNotice,
    copied,
    onCopyAddress: () => void copyAddress(),
    onDisconnect: () => void disconnectWallet(),
    onNavigate: selectPage,
    recoveryState,
    approvals,
    proposedOwner,
    setProposedOwner,
    onStartRecovery: startRecoveryDemo,
    onApproveGuardian: approveDemoGuardian,
    onCancelRecovery: cancelRecoveryDemo,
    threshold,
    setThreshold,
    delay,
    setDelay,
    setupStep,
    setSetupStep,
  } : null;

  if (page === "landing") {
    return <><AmbientBackground /><LandingPage connected={connected} onNavigate={selectPage} /></>;
  }

  return (
    <div className="rk-app-shell">
      <AmbientBackground />
      <a className="rk-skip-link" href="#main-content">Skip to content</a>
      <aside ref={mobileSidebarRef} id="primary-sidebar" aria-label="Primary navigation" className={`rk-sidebar ${mobileMenu ? "is-open" : ""}`}>
        <div className="rk-sidebar-brand">
          <button className="rk-brand-lockup" type="button" onClick={() => selectPage("overview")} aria-label="Open ReKey overview">
            <img src="/assets/rekey-logo.jpg" alt="" />
            <span>ReKey<small>RECOVERY, ON YOUR TERMS</small></span>
          </button>
          <button className="rk-mobile-close" type="button" onClick={closeMobileMenu} aria-label="Close primary navigation"><X size={19} aria-hidden="true" /></button>
        </div>
        <div className="rk-network-pill"><span aria-hidden="true" />SOLANA DEVNET <strong>TEST</strong></div>
        <nav className="rk-primary-nav" aria-label="ReKey pages">
          {navGroups.map((group) => <div className="rk-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              return <button className={`rk-nav-item ${page === item.id ? "is-active" : ""}`} type="button" key={item.id} aria-current={page === item.id ? "page" : undefined} onClick={() => selectPage(item.id)}>
                <Icon size={18} aria-hidden="true" /><span>{item.label}</span>{item.id === "recovery" && recoveryState !== "idle" && recoveryState !== "cancelled" && <i aria-hidden="true" />}
              </button>;
            })}
          </div>)}
        </nav>
        <div className="rk-sidebar-bottom">
          <div className="rk-sidebar-security"><span><LockKeyhole size={17} aria-hidden="true" /></span><strong>Recovery stays yours.</strong><p>Guardians can approve a recovery request; they cannot spend your assets.</p><a href="https://github.com/NeonTechno/Solana-Recovers" target="_blank" rel="noreferrer">Review the project <ChevronRight size={14} aria-hidden="true" /></a></div>
          <p className="rk-sidebar-footer"><span aria-hidden="true" /> Prototype · Devnet only</p>
        </div>
      </aside>

      {mobileMenu && <button className="rk-mobile-scrim" type="button" onClick={closeMobileMenu} aria-hidden="true" tabIndex={-1} />}

      <div className="rk-main-area">
        <header className="rk-topbar">
          <div className="rk-topbar-left">
            <button ref={mobileMenuButtonRef} className="rk-mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="Open menu" aria-expanded={mobileMenu} aria-controls="primary-sidebar"><Menu size={19} aria-hidden="true" /></button>
            <div className="rk-breadcrumb"><span>WORKSPACE</span><ChevronRight size={14} aria-hidden="true" /><strong>{pageMeta[page].title}</strong></div>
          </div>
          <div className="rk-topbar-right">
            <div className="rk-network-indicator"><span aria-hidden="true" />DEVNET · TEST</div>
            <span className={`rk-wallet-state ${connected ? "is-connected" : connecting ? "is-connecting" : ""}`} role="status">{connected ? "WALLET CONNECTED" : connecting ? "CONNECTING WALLET" : "WALLET DISCONNECTED"}</span>
            <WalletMultiButton className="wallet-connect-button rk-wallet-adapter-button" />
          </div>
        </header>

        <main className="rk-main-content" id="main-content" ref={mainContentRef} tabIndex={-1}>
          <div className="rk-content-wrap">
            <div className="rk-page-heading"><div><p className="rk-eyebrow"><span />NON-CUSTODIAL WALLET SECURITY</p><h1>{pageMeta[page].title}</h1><p>{pageMeta[page].description}</p></div><span className="rk-prototype-chip">PROTOTYPE</span></div>
            <div className="rk-prototype-banner" role="note"><ShieldAlert size={18} aria-hidden="true" /><span>Wallet connection and Devnet balance are live. Recovery, guardian, rewards, AI, and MCP data are not represented as connected or confirmed.</span></div>
            {walletNotice && <div className="rk-inline-status rk-inline-error" role="alert"><span>{walletNotice}</span><button type="button" onClick={() => setWalletNotice(null)} aria-label="Dismiss wallet notice"><X size={15} aria-hidden="true" /></button></div>}
            {sharedPageProps && <PageContent props={sharedPageProps} />}
            <footer className="rk-page-footer"><span>REKEY © 2026</span><span>BUILT FOR SOLANA <i>·</i> DEV3PACK HACKATHON</span><a href="https://solana.com/developers" target="_blank" rel="noreferrer">Solana docs <ChevronRight size={13} aria-hidden="true" /></a></footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ReKeyApp;