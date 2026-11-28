import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowRight, Award, Bot, Check, ChevronRight, CircleAlert, Clock3,
  Copy, ExternalLink, KeyRound, LifeBuoy, LoaderCircle, LockKeyhole, MessageCircle,
  RefreshCw, ShieldAlert, Sparkles, Terminal, Users, X, Zap,
} from "lucide-react";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  askAssistant,
  createRecoveryPlan,
  getActivity,
  getRecoveryRequests,
  getRewards,
  getWalletSummary,
} from "./api/client";
import type {
  ApiHealth,
  AssistantIntent,
  LifelineReward,
  RecoveryAction,
  RecoveryPlan,
  RecoveryRequestView,
  RewardsResponse,
} from "./api/types";
import { buildRecoveryInstruction } from "./security/recoveryTransaction";
import { simulateSignedTransaction, type SimulationReview } from "./security/transactionSimulation";

type ApiStatus = "checking" | "online" | "offline";

interface SurfaceProps {
  address: string | null;
  health: ApiHealth | null;
  apiStatus: ApiStatus;
  onNavigate: (tab: "overview" | "recovery" | "guardians" | "activity" | "assistant" | "mcp" | "rewards") => void;
  onWalletAddressChange: (address: string) => void;
}

interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

function useResource<T>(
  address: string | null,
  load: (address: string, signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(address));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!address) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setData(null);
    setError(null);
    setLoading(true);
    load(address, controller.signal)
      .then(result => setData(result))
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Couldn't load this data. Try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [address, attempt, load]);

  return { data, error, loading, retry: () => setAttempt(value => value + 1) };
}

function StatusBadge({ mode }: { mode: "live" | "simulated" }) {
  return <span className={`mode-badge mode-${mode}`}>{mode === "live" ? "LIVE · API" : "SIMULATED · NO CHAIN CHANGES"}</span>;
}

function ApiBadge({ status }: { status: ApiStatus }) {
  return <span className={`api-mode-badge api-${status}`}>{status === "online" ? "API CONNECTED" : status === "checking" ? "CHECKING API" : "API OFFLINE"}</span>;
}

function AddressWithCopy({ address, label }: { address: string; label: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const display = address.length > 13 ? `${address.slice(0, 5)}…${address.slice(-5)}` : address;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  return (
    <span className="address-with-copy" title={address}>
      <code>{display}</code>
      <button type="button" className="address-copy" onClick={() => void copy()} aria-label={copyState === "copied" ? `${label} copied` : `Copy ${label}`} title={copyState === "failed" ? "Clipboard unavailable" : `Copy ${label}`}><Copy size={13} aria-hidden="true" /></button>
      <span className="screen-reader-only" aria-live="polite">{copyState === "copied" ? `${label} copied.` : copyState === "failed" ? `Could not copy ${label}.` : ""}</span>
    </span>
  );
}

function KeyMascot({ className = "" }: { className?: string }) {
  return (
    <svg className={`key-mascot ${className}`} viewBox="0 0 112 104" role="img" aria-label="A friendly key character">
      <path d="M39 59 25 73v12h12V73h12l12-12" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="58" cy="39" r="28" fill="var(--surface-raised)" stroke="currentColor" strokeWidth="8" />
      <circle cx="50" cy="38" r="2.6" fill="var(--foreground)" />
      <circle cx="66" cy="38" r="2.6" fill="var(--foreground)" />
      <path d="M52 48q6 7 12 0" fill="none" stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M43 69 36 83m39-14 8 13" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="37" cy="47" r="3" fill="var(--accent-coral)" opacity=".8" />
      <circle cx="79" cy="47" r="3" fill="var(--accent-coral)" opacity=".8" />
    </svg>
  );
}

function WalletPrompt({ onNavigate }: Pick<SurfaceProps, "onNavigate">) {
  return (
    <div className="surface-empty">
      <KeyMascot />
      <strong>Connect a Devnet wallet to begin</strong>
      <p>These views read public wallet and recovery information from the ReKey API. No seed phrase or private key is needed.</p>
      <button className="secondary-button" type="button" onClick={() => onNavigate("overview")}>Go to wallet connection <ChevronRight size={15} aria-hidden="true" /></button>
    </div>
  );
}

function SurfaceHeading({ kicker, title, copy, icon }: { kicker: string; title: string; copy: string; icon: ReactNode }) {
  return (
    <div className="surface-heading">
      <div className="surface-heading-icon" aria-hidden="true">{icon}</div>
      <div><span className="section-kicker">{kicker}</span><h2>{title}</h2><p>{copy}</p></div>
    </div>
  );
}

function ResourceError({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="surface-error" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <div><strong>Couldn't load this view</strong><p>{error} Your current view is still available; retry when the API is reachable.</p></div>
      <button type="button" className="secondary-button" onClick={retry}>Try again</button>
    </div>
  );
}

function WalletContextNote({ onNavigate }: Pick<SurfaceProps, "onNavigate">) {
  return (
    <div className="wallet-context-note">
      <span>Wallet reads use the original owner address that seeds the ReKey PDA.</span>
      <button type="button" className="text-action" onClick={() => onNavigate("recovery")}>Choose owner address</button>
    </div>
  );
}

function SkeletonList({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-list" aria-label="Loading data" aria-busy="true">{Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index} />)}</div>;
}

function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "Time unavailable";
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Timelock elapsed · program checks still apply";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", minutes ? `${minutes}m` : "", !days && !hours ? `${remainder}s` : ""].filter(Boolean).join(" ");
}

function transactionExplorerUrl(signature: string, cluster: ApiHealth["cluster"]): string | null {
  const tx = encodeURIComponent(signature);
  if (cluster === "devnet") return `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
  if (cluster === "mainnet") return `https://explorer.solana.com/tx/${tx}`;
  return null;
}

function ActivitySurface({ address, health, apiStatus, onNavigate }: SurfaceProps) {
  const resource = useResource(address, getActivity);
  return (
    <section className="feature-surface">
      <SurfaceHeading kicker="PUBLIC PROGRAM EVENTS" title="Activity" copy="A read-only timeline of events associated with this wallet." icon={<Activity size={20} />} />
      {!address ? <WalletPrompt onNavigate={onNavigate} /> : <>
        <div className="surface-toolbar"><ApiBadge status={apiStatus} /><button className="text-action" type="button" onClick={resource.retry} disabled={resource.loading} aria-busy={resource.loading}><RefreshCw size={14} aria-hidden="true" /> Refresh events</button></div>
        <WalletContextNote onNavigate={onNavigate} />
        {resource.loading && <SkeletonList />}
        {resource.error && <ResourceError error={resource.error} retry={resource.retry} />}
        {!resource.loading && !resource.error && resource.data?.length === 0 && <div className="surface-empty compact-empty"><KeyMascot /><strong>No activity returned for this wallet</strong><p>If this is a new wallet, that can be expected. Events appear here after the API indexes the ReKey program accounts.</p><button className="secondary-button" type="button" onClick={() => onNavigate("recovery")}>Review recovery <ChevronRight size={15} aria-hidden="true" /></button></div>}
        {!resource.loading && !resource.error && Boolean(resource.data?.length) && <ol className="activity-list">
          {resource.data?.map(event => {
            const eventLabel = event.type.replace(/_/g, " ");
            const explorerUrl = transactionExplorerUrl(event.signature, health?.cluster ?? "devnet");
            return <li className="activity-item" key={`${event.signature}-${event.type}`}>
              <span className="activity-mark" aria-hidden="true"><Activity size={16} /></span>
              <div className="activity-copy"><strong>{event.description}</strong><span>{eventLabel} · {formatTime(event.blockTime)}</span></div>
              {explorerUrl ? <a className="activity-link" href={explorerUrl} target="_blank" rel="noreferrer" aria-label={`View ${eventLabel} transaction on Solana Explorer`}><ExternalLink size={16} aria-hidden="true" /></a> : <span className="activity-cluster-note" title="Localnet transactions do not have a public Solana Explorer link">LOCALNET</span>}
            </li>;
          })}
        </ol>}
      </>}
    </section>
  );
}

function RewardBar({ reward, index }: { reward: LifelineReward; index: number }) {
  const progress = Number.isFinite(reward.progress) ? Math.min(100, Math.max(0, reward.progress)) : 0;
  const points = Number.isFinite(reward.points) ? Math.max(0, Math.round(reward.points)) : 0;
  return (
    <article className={`reward-card reward-tone-${index % 4}`}>
      <div className="reward-card-top"><span className="reward-icon" aria-hidden="true"><Award size={18} /></span><span className={`numeric-value ${reward.earned ? "reward-earned" : "reward-points"}`}>{reward.earned ? "EARNED" : `${points} PTS`}</span></div>
      <h3>{reward.title}</h3><p>{reward.description}</p>
      <div className="reward-progress-meta"><span>{reward.requirement}</span><strong className="numeric-value">{Math.round(progress)}%</strong></div>
      <div className="reward-track" role="progressbar" aria-label={`${reward.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
    </article>
  );
}

function RewardsSurface({ address, apiStatus, onNavigate }: SurfaceProps) {
  const resource = useResource(address, getRewards);
  const result: RewardsResponse | null = resource.data;
  const score = result?.score;
  const scoreValue = score && Number.isFinite(score.score) ? Math.max(0, Math.min(100, Math.round(score.score))) : 0;
  const earnedPoints = result?.rewards.filter(reward => reward.earned).reduce((total, reward) => total + (Number.isFinite(reward.points) ? Math.max(0, Math.round(reward.points)) : 0), 0) ?? 0;
  const streakDays = result && Number.isFinite(result.streakDays) ? Math.max(0, Math.floor(result.streakDays)) : 0;
  return (
    <section className="feature-surface">
      <SurfaceHeading kicker="LIFELINE PROGRAM" title="Resilience, made visible." copy="A deterministic readiness score and the milestones that help strengthen your recovery setup." icon={<Award size={20} />} />
      {!address ? <WalletPrompt onNavigate={onNavigate} /> : <>
        <div className="surface-toolbar"><ApiBadge status={apiStatus} /><button className="text-action" type="button" onClick={resource.retry} disabled={resource.loading} aria-busy={resource.loading}><RefreshCw size={14} aria-hidden="true" /> Refresh rewards</button></div>
        <WalletContextNote onNavigate={onNavigate} />
        {resource.loading && <div className="reward-loading"><div className="skeleton-score" /><SkeletonList rows={2} /></div>}
        {resource.error && <ResourceError error={resource.error} retry={resource.retry} />}
        {result && score && <>
          <div className="score-overview">
            <div className="score-ring" style={{ "--score": scoreValue } as CSSProperties} role="img" aria-label={`Resilience score ${scoreValue} out of 100`}><div><strong className="numeric-value">{scoreValue}</strong><span>OF 100</span></div></div>
            <div className="score-copy"><span className={`score-band band-${score.band}`}>{score.band} readiness</span><h3>Your recovery resilience</h3><p>This deterministic score is advisory. It does not authorize or guarantee a recovery.</p><div className="score-summary"><span><Zap size={15} aria-hidden="true" /> {streakDays} day streak</span><span><Award size={15} aria-hidden="true" /> <b className="numeric-value">{earnedPoints}</b> points earned</span></div></div>
          </div>
          <div className="reward-columns">
            <section className="factor-panel" aria-labelledby="factor-title"><div className="panel-heading"><div><span className="section-kicker">SCORE DETAIL</span><h3 id="factor-title">What shapes your score</h3></div><ShieldAlert size={19} aria-hidden="true" /></div>
              {score.factors.length === 0 ? <p className="muted-copy">No score factors were returned.</p> : <ul className="factor-list">{score.factors.map(factor => {
                const impact = Number.isFinite(factor.impact) ? Math.round(factor.impact * 100) : 0;
                return <li key={factor.id}><span className={`factor-dot ${impact >= 0 ? "factor-positive" : "factor-negative"}`} aria-hidden="true" /><div><strong>{factor.label}</strong><p>{factor.detail}</p></div><span className={`numeric-value factor-impact ${impact >= 0 ? "impact-positive" : "impact-negative"}`}>{impact > 0 ? "+" : ""}{impact}%</span></li>;
              })}</ul>}
              <p className="advisory-note"><LockKeyhole size={14} aria-hidden="true" /> Score factors are product guidance, not program authorization checks.</p>
            </section>
            <section className="rewards-panel" aria-labelledby="rewards-title"><div className="panel-heading"><div><span className="section-kicker">LIFELINE REWARDS</span><h3 id="rewards-title">Your milestones</h3></div><LifeBuoy size={19} aria-hidden="true" /></div>
              {result.rewards.length === 0 ? <p className="muted-copy">No reward milestones are available yet.</p> : <div className="reward-list">{result.rewards.map((reward, index) => <RewardBar key={reward.id} reward={reward} index={index} />)}</div>}
            </section>
          </div>
        </>}
      </>}
    </section>
  );
}

type ChatMessage = { role: "assistant" | "user"; text: string; degraded?: boolean; contextUsed?: string[] };

const SECRET_LIKE_INPUT = /\b(?:seed|recovery|mnemonic)\s+phrase\b|\b(?:private|secret)\s+key\b|\b(?:0x)?[a-f0-9]{64}\b|[1-9A-HJ-NP-Za-km-z]{80,}/i;
const BARE_MNEMONIC_INPUT = /^(?:[a-z]{3,}\s+){11}[a-z]{3,}$|^(?:[a-z]{3,}\s+){23}[a-z]{3,}$/i;

function AssistantSurface({ address, health, onNavigate }: SurfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "I can explain recovery concepts and review the public context made available to ReKey. I cannot approve a recovery or replace your own review." }]);
  const [question, setQuestion] = useState("");
  const [intent, setIntent] = useState<AssistantIntent>("security_review");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretBlocked, setSecretBlocked] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chatEndRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [messages]);

  const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!address || !trimmed || loading) return;
    if (SECRET_LIKE_INPUT.test(trimmed) || BARE_MNEMONIC_INPUT.test(trimmed)) {
      setSecretBlocked(true);
      setError("This message looks like it may contain a seed phrase or private key. Remove it; the assistant never needs secret material.");
      return;
    }
    setSecretBlocked(false);
    setError(null);
    setLoading(true);
    setMessages(current => [...current, { role: "user", text: trimmed }]);
    try {
      const response = await askAssistant(address, trimmed, intent);
      setMessages(current => [...current, {
        role: "assistant",
        text: response.reply,
        degraded: response.degraded,
        contextUsed: response.contextUsed,
      }]);
      setQuestion("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't reach the assistant. Your question is still here; try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (value: string) => {
    if (SECRET_LIKE_INPUT.test(value) || BARE_MNEMONIC_INPUT.test(value)) {
      setQuestion("");
      setSecretBlocked(true);
      setError("This message looks like it may contain a seed phrase or private key. It was cleared and was not sent.");
      return;
    }
    setQuestion(value);
    setSecretBlocked(false);
    setError(null);
  };

  return (
    <section className="feature-surface assistant-surface">
      <SurfaceHeading kicker="ADVISORY ONLY · NEVER AUTHORIZES RECOVERY" title="Your security sidekick." copy="Ask about your recovery setup. ReKey’s program remains the only authority for recovery decisions." icon={<Bot size={20} />} />
      <div className="assistant-brand-card"><img src="/rekey-logo.jpg" alt="ReKey neon diamond logo" width="64" height="64" /><div><strong>AI Security Assistant</strong><p>Answers are advisory, not authorization. Verify important details before acting.</p></div><KeyMascot className="assistant-mascot" /></div>
      {health && !health.ai.reachable && <div className="degraded-hint" role="status"><Sparkles size={16} aria-hidden="true" /><span>AI provider is currently unavailable. The API may return a clearly marked deterministic offline analysis.</span></div>}
      {!address ? <WalletPrompt onNavigate={onNavigate} /> : <>
        <div className="chat-log" aria-label="Assistant conversation" aria-live="polite">
          {messages.map((message, index) => <article className={`chat-message chat-${message.role}`} key={`${message.role}-${index}`}>
            <span className="chat-avatar" aria-hidden="true">{message.role === "assistant" ? <Sparkles size={15} /> : <KeyRound size={15} />}</span>
            <div><div className="chat-message-meta"><strong>{message.role === "assistant" ? "ReKey assistant" : "You"}</strong>{message.role === "assistant" && index > 0 && <span className={message.degraded ? "advice-degraded" : "advice-live"}>{message.degraded ? "OFFLINE ANALYSIS · DETERMINISTIC" : "AI-GENERATED ADVICE · ADVISORY"}</span>}</div>
              <p>{message.text}</p>
              {message.contextUsed && message.contextUsed.length > 0 && <small className="context-used">Context used: {message.contextUsed.join(" · ")}</small>}
            </div>
          </article>)}
          {loading && <div className="assistant-thinking" role="status"><LoaderCircle size={16} aria-hidden="true" /> Reviewing public recovery context…</div>}
          <div ref={chatEndRef} />
        </div>
        <WalletContextNote onNavigate={onNavigate} />
        {error && <div className={`inline-error ${secretBlocked ? "secret-warning" : ""}`} role="alert"><CircleAlert size={16} aria-hidden="true" />{error}</div>}
        <form className="assistant-form" onSubmit={submitQuestion}>
          <label htmlFor="assistant-intent">What would you like help with?</label>
          <select id="assistant-intent" value={intent} onChange={event => setIntent(event.target.value as AssistantIntent)}>
            <option value="security_review">Security review</option><option value="guardian_advice">Guardian advice</option><option value="recovery_help">Recovery help</option><option value="freeform">General question</option>
          </select>
          <label htmlFor="assistant-question">Your question</label>
          <textarea id="assistant-question" rows={3} value={question} onChange={event => updateQuestion(event.target.value)} placeholder="For example: What does my guardian threshold mean?" disabled={loading} />
          <p className="form-hint"><LockKeyhole size={13} aria-hidden="true" /> Never enter a seed phrase, private key, or signed transaction.</p>
          <div className="assistant-submit-row"><span>AI answers cannot authorize recovery.</span><button className="primary-button" type="submit" disabled={!question.trim() || loading} aria-busy={loading}>{loading ? "Thinking…" : "Ask assistant"}<ArrowRight size={15} aria-hidden="true" /></button></div>
        </form>
      </>}
    </section>
  );
}

const MCP_TOOLS = [
  "rekey_get_wallet",
  "rekey_get_recovery_request",
  "rekey_list_guardians",
  "rekey_get_activity",
  "rekey_get_health",
  "rekey_get_resilience_score",
  "rekey_get_rewards",
  "rekey_get_wallet_health",
];

function McpSurface({ health, apiStatus }: SurfaceProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const configSnippet = JSON.stringify({
    mcpServers: {
      rekey: {
        command: "node",
        args: ["<path-to-installed-rekey-mcp-server>"],
      },
    },
  }, null, 2);

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configSnippet);
      setCopied(true);
      setCopyError(null);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError("Clipboard access is unavailable. Select and copy the configuration text instead.");
    }
  };

  const healthLabel = apiStatus === "checking" ? "Checking API…" : apiStatus === "offline" ? "API offline" : health?.rpcReachable ? `API + ${health.cluster} RPC online` : "API online · RPC unavailable";

  return (
    <section className="feature-surface mcp-surface">
      <SurfaceHeading kicker="MODEL CONTEXT PROTOCOL" title="Connect an agent, keep it read-only." copy="Let an AI tool inspect public recovery posture through the ReKey MCP Gateway." icon={<Terminal size={20} />} />
      <div className="mcp-hero-card"><div className="mcp-logo-wrap"><img src="/rekey-logo.jpg" alt="ReKey neon diamond logo" width="76" height="76" /><span className="mcp-logo-orbit" aria-hidden="true" /></div><div className="mcp-hero-copy"><span className="read-only-chip"><LockKeyhole size={13} aria-hidden="true" /> READ-ONLY TOOLS</span><h3>One calm connection for your security context.</h3><p>The gateway exposes public wallet, recovery, activity, and resilience reads. It cannot sign, submit, or change recovery state.</p></div><KeyMascot className="mcp-mascot" /></div>
      <div className="mcp-summary-grid">
        <article className="mcp-info-card mcp-transport"><span className="section-kicker">TRANSPORT</span><strong>stdio</strong><p>Local process transport from the MCP client. There is no HTTP MCP endpoint in contract v1.0.0.</p><code>ReKey MCP Gateway · stdio</code></article>
        <article className="mcp-info-card mcp-health"><span className="section-kicker">GATEWAY HEALTH</span><strong className={`health-text health-${apiStatus}`}>{healthLabel}</strong><p>Health is read from <code>GET /api/health</code>; MCP tools remain read-only.</p><span className={`health-indicator health-${apiStatus}`}><i aria-hidden="true" />{apiStatus === "online" ? `API v${health?.version ?? "—"}` : apiStatus === "checking" ? "Checking" : "Reconnect when available"}</span></article>
      </div>
      <section className="mcp-tools-panel" aria-labelledby="mcp-tools-heading"><div className="panel-heading"><div><span className="section-kicker">8 CONTRACTED TOOLS</span><h3 id="mcp-tools-heading">Public reads only</h3></div><Users size={19} aria-hidden="true" /></div><ul className="mcp-tool-list">{MCP_TOOLS.map((tool, index) => <li key={tool}><span className="tool-index">0{index + 1}</span><code>{tool}</code><span className="tool-read-only">READ ONLY</span></li>)}</ul></section>
      <section className="mcp-config-panel" aria-labelledby="mcp-config-heading"><div className="panel-heading"><div><span className="section-kicker">CLIENT CONFIGURATION</span><h3 id="mcp-config-heading">Add ReKey to your MCP client</h3></div><MessageCircle size={19} aria-hidden="true" /></div><pre><code>{configSnippet}</code></pre><div className="mcp-config-footer"><p>The contract defines stdio transport but not a packaged launcher path. Replace the marked path with the entrypoint from your ReKey backend install.</p><button type="button" className="secondary-button" onClick={() => void copyConfig()}><Copy size={15} aria-hidden="true" />{copied ? "Copied" : "Copy config"}</button></div>{copyError && <p className="inline-error" role="alert">{copyError}</p>}</section>
    </section>
  );
}

type SimulationPreview = { error: string | null; fee: number | null; units: number | null; logs: string[] };
type PreparedAction = {
  plan: RecoveryPlan;
  transaction?: VersionedTransaction;
  blockhash?: string;
  lastValidBlockHeight?: number;
  simulation?: SimulationPreview;
  signedSimulation?: SimulationReview;
  simulationLoading?: boolean;
  error?: string;
  status?: "review" | "signing" | "simulating" | "signed" | "submitting" | "confirming" | "submitted" | "confirmed";
  signature?: string;
};

function RecoveryActionDialog({
  prepared,
  onClose,
  onSignAndSimulate,
  onSubmit,
  submitting,
  cluster,
  canSign,
}: {
  prepared: PreparedAction;
  onClose: () => void;
  onSignAndSimulate: () => void;
  onSubmit: () => void;
  submitting: boolean;
  cluster: string;
  canSign: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = document.querySelectorAll<HTMLElement>(
        ".transaction-dialog button:not(:disabled), .transaction-dialog a[href], .transaction-dialog input:not(:disabled), .transaction-dialog select:not(:disabled), .transaction-dialog textarea:not(:disabled), .transaction-dialog summary",
      );
      if (!focusable.length) return;
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
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);
  const { plan } = prepared;
  const simulated = plan.mode === "simulated";
  return (
    <div className="dialog-backdrop">
      <section className="transaction-dialog" role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title">
        <div className="dialog-heading"><div><span className="section-kicker">TRANSACTION REVIEW</span><h2 id="transaction-dialog-title">{simulated ? "Simulated plan" : "Review before wallet signing"}</h2></div><button ref={closeRef} type="button" className="icon-button" onClick={onClose} disabled={submitting} aria-label="Close transaction review"><X size={18} aria-hidden="true" /></button></div>
        <StatusBadge mode={plan.mode} />
        <p className="transaction-description">{plan.description}</p>
        {simulated && <div className="simulated-explanation" role="status"><ShieldAlert size={17} aria-hidden="true" /><span>This API plan is simulated. No wallet signature or chain change will occur.</span></div>}
        {!simulated && !canSign && <div className="inline-error" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>This wallet adapter does not expose a reviewable transaction-signing method. Choose a compatible wallet; nothing has been signed.</span></div>}
        <dl className="transaction-facts"><div><dt>Action</dt><dd>{plan.action}</dd></div><div><dt>Fee payer</dt><dd><AddressWithCopy address={plan.requiresSignatureFrom} label="fee payer address" /></dd></div><div><dt>Cluster</dt><dd>{cluster}</dd></div><div><dt>Program</dt><dd><AddressWithCopy address={plan.programId} label="program address" /></dd></div>{Object.entries(plan.accounts).map(([name, value]) => <div key={name}><dt>Account · {name}</dt><dd><AddressWithCopy address={value} label={`${name} address`} /></dd></div>)}{Object.entries(plan.args).map(([name, value]) => <div key={name}><dt>Argument · {name}</dt><dd className="address-mono">{name === "newOwner" && typeof value === "string" ? <AddressWithCopy address={value} label="new owner address" /> : String(value)}</dd></div>)}</dl>
        {!simulated && <div className="simulation-review" aria-live="polite"><div><ShieldAlert size={16} aria-hidden="true" /><strong>{prepared.signedSimulation ? "Signature-verified transaction simulation" : "Unsigned transaction preview"}</strong></div>{prepared.status === "signing" ? <p>Waiting for your wallet to sign this reviewed transaction…</p> : prepared.status === "simulating" ? <p>Checking the wallet-signed transaction against current Devnet state. Nothing has been submitted.</p> : prepared.simulationLoading ? <p>Checking the unsigned instruction against current Devnet state…</p> : prepared.signedSimulation ? prepared.signedSimulation.error ? <p className="simulation-failed">Signature-verified simulation returned an execution error: {prepared.signedSimulation.error}</p> : <p className="simulation-clean">No execution error detected at slot {prepared.signedSimulation.slot}. Signature verification was requested; this is not a security guarantee.</p> : prepared.simulation ? prepared.simulation.error ? <p className="simulation-failed">Unsigned preview returned an execution error: {prepared.simulation.error}</p> : <p>Unsigned preview completed; signature verification has not run. Review the transaction before signing.</p> : <p>Simulation has not completed. Signing remains disabled.</p>}{(prepared.signedSimulation?.feeLamports ?? prepared.simulation?.fee) !== null && (prepared.signedSimulation?.feeLamports ?? prepared.simulation?.fee) !== undefined && <small className="numeric-value">Estimated network fee: {(prepared.signedSimulation?.feeLamports ?? prepared.simulation?.fee)?.toLocaleString("en-US")} lamports</small>}{prepared.signedSimulation && <small className="simulation-disclaimer">{prepared.signedSimulation.disclaimer}</small>}{prepared.signedSimulation?.logs && prepared.signedSimulation.logs.length > 0 && <details><summary>Untrusted program logs ({prepared.signedSimulation.logs.length})</summary><pre>{prepared.signedSimulation.logs.join("\n")}</pre></details>}{!prepared.signedSimulation && prepared.simulation?.logs && prepared.simulation.logs.length > 0 && <details><summary>Untrusted preview logs ({prepared.simulation.logs.length})</summary><pre>{prepared.simulation.logs.join("\n")}</pre></details>}</div>}
        {plan.warnings.length > 0 && <div className="plan-warnings"><strong>Advisory warnings</strong><ul>{plan.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul><small>These previews do not authorize a recovery; the on-chain program enforces its state machine.</small></div>}
        {prepared.error && <div className="inline-error" role="alert"><CircleAlert size={16} aria-hidden="true" />{prepared.error}</div>}
        {prepared.signature && prepared.status === "confirmed" && <div className="transaction-success" role="status"><Check size={17} aria-hidden="true" /><span>Transaction confirmed.</span><a href={`https://explorer.solana.com/tx/${encodeURIComponent(prepared.signature)}?cluster=devnet`} target="_blank" rel="noreferrer">View on Explorer <ExternalLink size={13} aria-hidden="true" /></a></div>}
        {prepared.signature && prepared.status === "confirming" && <div className="transaction-pending" role="status"><LoaderCircle size={16} aria-hidden="true" /><span>Submitted to Devnet. Waiting for confirmation…</span><a href={`https://explorer.solana.com/tx/${encodeURIComponent(prepared.signature)}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13} aria-hidden="true" /></a></div>}
        {prepared.signature && prepared.status === "submitted" && <div className="transaction-pending" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>Transaction submitted but not confirmed. Check its Explorer record before taking another action.</span><a href={`https://explorer.solana.com/tx/${encodeURIComponent(prepared.signature)}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13} aria-hidden="true" /></a></div>}
        <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>{prepared.signature ? "Done" : "Cancel"}</button>{!simulated && !prepared.signature && !prepared.signedSimulation && <button className="primary-button" type="button" onClick={onSignAndSimulate} disabled={!canSign || submitting || prepared.simulationLoading || !prepared.transaction || !prepared.simulation || Boolean(prepared.simulation.error) || Boolean(prepared.error && !prepared.transaction.signatures.some(signature => signature.some(byte => byte !== 0)))} aria-busy={submitting}>{submitting ? prepared.status === "simulating" ? "Verifying signature…" : "Waiting for wallet…" : prepared.transaction?.signatures.some(signature => signature.some(byte => byte !== 0)) ? "Retry signed simulation" : "Sign & verify · no submit"}<ArrowRight size={15} aria-hidden="true" /></button>}{!simulated && !prepared.signature && prepared.signedSimulation && <button className="primary-button" type="button" onClick={onSubmit} disabled={submitting || Boolean(prepared.signedSimulation.error) || Boolean(prepared.error)} aria-busy={submitting}>{submitting ? prepared.status === "confirming" ? "Confirming…" : "Submitting…" : "Submit signed transaction"}<ArrowRight size={15} aria-hidden="true" /></button>}</div>
        {!simulated && !prepared.signature && <p className="dialog-safety-note"><LockKeyhole size={13} aria-hidden="true" /> Signing and submitting are separate choices. A signed preview is not sent until you submit it.</p>}
      </section>
    </div>
  );
}

function RecoveryRequestCard({
  request,
  owner,
  signerAddress,
  busy,
  onAction,
}: {
  request: RecoveryRequestView;
  owner: string | null;
  signerAddress: string | null;
  busy: boolean;
  onAction: (action: RecoveryAction, nonce: number, trigger: HTMLElement) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const untilExecutable = Number.isFinite(request.secondsUntilExecutable) ? request.secondsUntilExecutable - elapsed : Number.NaN;
  const untilExpiry = Number.isFinite(request.expiresAt) ? request.expiresAt - Math.floor(Date.now() / 1000) : Number.NaN;
  const active = request.status === "Pending" || request.status === "Approved";
  const canCancel = active && signerAddress !== null && owner === signerAddress && untilExecutable > 0;
  const canExpire = active && Number.isFinite(untilExpiry) && untilExpiry < 0;
  const canExecute = request.status === "Approved" && Number.isFinite(untilExecutable) && untilExecutable <= 0 && untilExpiry >= 0;
  const hasApproved = signerAddress !== null && request.approvals.includes(signerAddress);
  const expiryLabel = !Number.isFinite(untilExpiry) ? "Unavailable" : untilExpiry > 0 ? formatCountdown(untilExpiry) : "Expired window";
  return (
    <article className="live-request-card">
      <div className="live-request-head"><div><span className="request-number">REQUEST #{request.nonce}</span><span className={`request-status status-${request.status.toLowerCase()}`}>{request.status}</span></div><StatusBadge mode={request.mode} /></div>
      <div className="request-owner-row"><span>Proposed new owner</span><AddressWithCopy address={request.newOwner} label="proposed new owner address" /></div>
      <div className="request-metrics"><div><span>Approvals</span><strong className="numeric-value">{request.approvals.length} / {request.threshold}</strong></div><div><span>Timelock</span><strong className="numeric-value">{formatCountdown(untilExecutable)}</strong></div><div><span>Expires</span><strong className="numeric-value">{expiryLabel}</strong></div></div>
      <div className="request-progress" role="progressbar" aria-label={`Guardian approvals for recovery request ${request.nonce}`} aria-valuemin={0} aria-valuemax={request.threshold} aria-valuenow={Math.min(request.threshold, request.approvals.length)}><span style={{ width: `${Math.min(100, Math.max(0, (request.approvals.length / Math.max(1, request.threshold)) * 100))}%` }} /></div>
      <div className="request-meta"><span>Created {formatTime(request.createdAt)}</span><span>Policy version {request.policyVersion}</span></div>
      {request.mode === "live" && active && <div className="request-actions">
        {request.status === "Pending" && untilExpiry >= 0 && !hasApproved && <button type="button" className="secondary-button" onClick={event => onAction("approve", request.nonce, event.currentTarget)} disabled={busy}>Approve request</button>}
        {request.status === "Pending" && hasApproved && <span className="action-hint"><Check size={14} aria-hidden="true" />Connected wallet approval is already recorded.</span>}
        {canCancel && <button type="button" className="cancel-button" onClick={event => onAction("cancel", request.nonce, event.currentTarget)} disabled={busy}>Cancel request</button>}
        {canExecute && <button type="button" className="primary-button" onClick={event => onAction("execute", request.nonce, event.currentTarget)} disabled={busy}>Execute recovery</button>}
        {canExpire && <button type="button" className="secondary-button" onClick={event => onAction("expire", request.nonce, event.currentTarget)} disabled={busy}>Mark expired</button>}
        {request.status === "Approved" && untilExecutable > 0 && <span className="action-hint"><Clock3 size={14} aria-hidden="true" />Execution waits for the timelock.</span>}
      </div>}
      {request.mode === "simulated" && <p className="simulated-request-note">This request is simulated. No on-chain state has changed.</p>}
    </article>
  );
}

function RecoverySurface({ address, health, apiStatus, onNavigate, onWalletAddressChange }: SurfaceProps) {
  const requests = useResource(address, getRecoveryRequests);
  const wallet = useResource(address, getWalletSummary);
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const [addressDraft, setAddressDraft] = useState(address ?? "");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [newOwner, setNewOwner] = useState("");
  const [newOwnerError, setNewOwnerError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => setAddressDraft(address ?? ""), [address]);

  const closePreview = useCallback(() => {
    if (submitting) return;
    setPrepared(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, [submitting]);

  const prepareAction = async (action: RecoveryAction, nonce?: number, proposedOwner?: string) => {
    if (!address) return;
    if (!connected || !publicKey) {
      setActionError("Connect the wallet that will act on this recovery request before preparing a live action.");
      return;
    }
    if (apiStatus !== "online") {
      setActionError("The ReKey API is offline. Live recovery actions need an API plan; the demo remains available below.");
      return;
    }
    if (!health?.rpcReachable || health.cluster !== "devnet") {
      setActionError("Live signing is available only when the API confirms a reachable Devnet. No transaction was prepared.");
      return;
    }
    setPreparing(true);
    setActionError(null);
    setPrepared(null);
    try {
      const plan = await createRecoveryPlan(address, action, { ...(proposedOwner ? { newOwner: proposedOwner } : {}), ...(nonce === undefined ? {} : { nonce }) });
      if (plan.action !== action) throw new Error("The API plan action did not match the requested action; signing is blocked.");
      if (action === "initiate" && proposedOwner && plan.args.newOwner !== proposedOwner) {
        throw new Error("The API plan new owner does not match your proposal; signing is blocked.");
      }
      if (plan.mode === "simulated") {
        setPrepared({ plan, status: "review" });
        return;
      }
      if (plan.mode !== "live") throw new Error("The API returned an unknown recovery mode; signing is blocked.");
      if (!signTransaction) throw new Error("This wallet adapter cannot sign a reviewed transaction. Connect a compatible wallet instead.");
      setPrepared({ plan, simulationLoading: true, status: "review" });
      const instruction = await buildRecoveryInstruction(plan, publicKey, address);
      const blockhash = await connection.getLatestBlockhash("confirmed");
      const transaction = new VersionedTransaction(new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash.blockhash,
        instructions: [instruction],
      }).compileToV0Message());
      setPrepared({ plan, transaction, blockhash: blockhash.blockhash, lastValidBlockHeight: blockhash.lastValidBlockHeight, simulationLoading: true, status: "review" });
      const simulation = await connection.simulateTransaction(transaction, {
        commitment: "confirmed",
        sigVerify: false,
        replaceRecentBlockhash: true,
      });
      const simError = simulation.value.err === null ? null : typeof simulation.value.err === "string" ? simulation.value.err : JSON.stringify(simulation.value.err);
      const fee = "fee" in simulation.value && typeof simulation.value.fee === "number" ? simulation.value.fee : null;
      setPrepared({
        plan,
        transaction,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
        simulation: { error: simError, fee, units: simulation.value.unitsConsumed ?? null, logs: (simulation.value.logs ?? []).slice(0, 5).map(log => log.slice(0, 500)) },
        simulationLoading: false,
        status: "review",
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Couldn't prepare the recovery plan. Try again when the API and Devnet are available.";
      setActionError(message);
      setPrepared(current => current ? { ...current, simulationLoading: false, error: message } : current);
    } finally {
      setPreparing(false);
    }
  };

  const startRecovery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextOwner = newOwner.trim();
    try {
      const ownerKey = new PublicKey(nextOwner);
      if (wallet.data?.owner && new PublicKey(wallet.data.owner).equals(ownerKey)) {
        setNewOwnerError("Choose a different address from the current wallet owner.");
        return;
      }
    } catch {
      setNewOwnerError("Enter a valid Solana public address for the proposed new owner.");
      return;
    }
    setNewOwnerError(null);
    setActionError(null);
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    void prepareAction("initiate", undefined, nextOwner);
  };

  const requestAction = (action: RecoveryAction, nonce: number, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    void prepareAction(action, nonce);
  };

  const selectWallet = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const normalized = new PublicKey(addressDraft.trim()).toBase58();
      setAddressError(null);
      onWalletAddressChange(normalized);
      setActionError(null);
    } catch {
      setAddressError("Enter a valid Solana address for the wallet’s original owner.");
    }
  };

  const signAndSimulate = async () => {
    if (!prepared?.transaction || !publicKey || !signTransaction || prepared.plan.mode !== "live") return;
    if (!prepared.simulation || prepared.simulation.error) return;
    if (!health?.rpcReachable || health.cluster !== "devnet") return;
    setSubmitting(true);
    setPrepared(current => current ? { ...current, status: "signing", error: undefined } : current);
    let signedTransaction: VersionedTransaction | null = null;
    try {
      const hasLocalSignature = prepared.transaction.signatures.some(signature => signature.some(byte => byte !== 0));
      signedTransaction = hasLocalSignature ? prepared.transaction : await signTransaction(prepared.transaction);
      setPrepared(current => current ? { ...current, transaction: signedTransaction!, status: "simulating" } : current);
      const signedSimulation = await simulateSignedTransaction(connection, signedTransaction);
      setPrepared(current => current ? {
        ...current,
        transaction: signedTransaction!,
        signedSimulation,
        status: "signed",
        simulationLoading: false,
      } : current);
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "Wallet signing or signed simulation failed.";
      const cancelled = !signedTransaction && /reject|declin|cancel/i.test(text);
      setPrepared(current => current ? {
        ...current,
        transaction: signedTransaction ?? current.transaction,
        status: "review",
        simulationLoading: false,
        error: cancelled ? "Wallet signing was cancelled. No transaction was sent." : signedTransaction
          ? "The wallet-signed transaction could not be simulated. Nothing was sent; retry signature verification or close this review."
          : text,
      } : current);
    } finally {
      setSubmitting(false);
    }
  };

  const submitPrepared = async () => {
    if (!prepared?.transaction || !prepared.blockhash || prepared.lastValidBlockHeight === undefined || !prepared.signedSimulation || prepared.signedSimulation.error !== null) return;
    if (prepared.plan.mode !== "live" || !health?.rpcReachable || health.cluster !== "devnet") return;
    setSubmitting(true);
    setPrepared(current => current ? { ...current, status: "submitting", error: undefined } : current);
    try {
      const currentBlockHeight = await connection.getBlockHeight("confirmed");
      if (currentBlockHeight > prepared.lastValidBlockHeight) {
        throw new Error("This signed preview has expired. Close it and prepare a fresh recovery plan before submitting.");
      }
      const signature = await connection.sendTransaction(prepared.transaction, { preflightCommitment: "confirmed", maxRetries: 3 });
      setPrepared(current => current ? { ...current, status: "confirming", signature } : current);
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: prepared.blockhash!,
        lastValidBlockHeight: prepared.lastValidBlockHeight!,
      }, "confirmed");
      if (confirmation.value.err) throw new Error("The transaction was submitted but Devnet reported an execution error. Check its Explorer record before retrying.");
      setPrepared(current => current ? { ...current, status: "confirmed", signature } : current);
      requests.retry();
      wallet.retry();
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "The transaction was not confirmed. Check Devnet before trying again.";
      setPrepared(current => current ? { ...current, status: current.signature ? "submitted" : current.signedSimulation ? "signed" : "review", error: text } : current);
    } finally {
      setSubmitting(false);
    }
  };

  const requestList = requests.data ?? [];
  const activeOwner = wallet.data?.owner ?? null;
  return (
    <section className="feature-surface recovery-surface">
      <SurfaceHeading kicker="PROGRAM-OWNED STATE MACHINE" title="Recovery center" copy="Review API-reported requests, timelocks, and approvals. The program enforces every authorization rule." icon={<RefreshCw size={20} />} />
      {!address ? <WalletPrompt onNavigate={onNavigate} /> : <>
        <div className="surface-toolbar"><ApiBadge status={apiStatus} /><span className="api-inline-status">Wallet reads use the original owner address; signing uses the connected wallet.</span><button type="button" className="text-action" onClick={() => { requests.retry(); wallet.retry(); }} disabled={requests.loading} aria-busy={requests.loading}><RefreshCw size={14} aria-hidden="true" /> Refresh requests</button></div>
        <form className="wallet-address-form" onSubmit={selectWallet}>
          <label htmlFor="initial-owner-address">ReKey wallet’s original owner address</label>
          <div className="owner-input-row"><input id="initial-owner-address" type="text" inputMode="text" autoComplete="off" spellCheck={false} value={addressDraft} onChange={event => { setAddressDraft(event.target.value); setAddressError(null); }} placeholder="Wallet initial-owner base58 address" aria-invalid={addressError ? "true" : undefined} aria-describedby={addressError ? "initial-owner-error" : "initial-owner-hint"} /><button type="submit" className="secondary-button">Load wallet</button></div>
          {addressError ? <p id="initial-owner-error" className="field-error" role="alert">{addressError}</p> : <p id="initial-owner-hint" className="form-hint">The API derives wallet PDAs from this public address. It may differ from the connected guardian or current owner.</p>}
        </form>
        {actionError && <div className="inline-error" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{actionError}</span><button className="icon-button" type="button" aria-label="Dismiss recovery error" onClick={() => setActionError(null)}><X size={14} aria-hidden="true" /></button></div>}
        {requests.loading && <SkeletonList rows={2} />}
        {requests.error && <ResourceError error={requests.error} retry={requests.retry} />}
        {!requests.loading && !requests.error && requestList.length === 0 && <div className="surface-empty compact-empty"><KeyMascot /><strong>No live recovery requests</strong><p>There may be no ReKey account yet, or this wallet has no requests. This view does not create simulated requests.</p></div>}
        {requestList.length > 0 && <div className="live-request-list">{requestList.map(request => <RecoveryRequestCard key={request.request} request={request} owner={activeOwner} signerAddress={publicKey?.toBase58() ?? null} busy={preparing || submitting} onAction={requestAction} />)}</div>}
        {wallet.error && <div className="advisory-note"><CircleAlert size={14} aria-hidden="true" />Wallet summary unavailable: {wallet.error} Owner-only controls stay hidden until the API responds.</div>}
        <form className="initiate-recovery-form" onSubmit={startRecovery}>
          <div><span className="section-kicker">PREPARE A NEW REQUEST</span><h3>Propose a new wallet owner</h3><p>Initiation requires a live API plan and a connected Devnet wallet. The request remains subject to guardian approvals and the program’s timelock.</p></div>
          <label htmlFor="proposed-owner">New owner public address</label>
          <div className="owner-input-row"><input id="proposed-owner" type="text" inputMode="text" autoComplete="off" spellCheck={false} value={newOwner} onChange={event => { setNewOwner(event.target.value); setNewOwnerError(null); }} placeholder="Base58 Solana address" aria-invalid={newOwnerError ? "true" : undefined} aria-describedby={newOwnerError ? "new-owner-error" : "new-owner-hint"} /><button type="submit" className="primary-button" disabled={!newOwner.trim() || preparing || !connected || apiStatus !== "online"} aria-busy={preparing}>{preparing ? "Preparing…" : "Review plan"}<ChevronRight size={15} aria-hidden="true" /></button></div>
          {newOwnerError ? <p id="new-owner-error" className="field-error" role="alert">{newOwnerError}</p> : <p id="new-owner-hint" className="form-hint">Only a public address is needed. Never enter private keys or seed phrases.</p>}
        </form>
        <div className="program-note"><LockKeyhole size={15} aria-hidden="true" /><span>Recovery state is controlled by the Anchor program. Threshold, policy version, expiry, and timelock are advisory previews here—not independent authorization decisions.</span></div>
        <section className="demo-panel" aria-labelledby="recovery-demo-title"><div className="demo-panel-head"><div><span className="section-kicker">PROTOTYPE SANDBOX</span><h3 id="recovery-demo-title">Try the guardian flow</h3></div><span className="mode-badge mode-simulated">SIMULATED · NO CHAIN CHANGES</span></div><p>This local demo is separate from API-backed requests. Its approvals do not create or alter Solana accounts.</p><button type="button" className="secondary-button" onClick={() => onNavigate("overview")}>Return to overview <ChevronRight size={15} aria-hidden="true" /></button><div className="demo-flow-copy"><span><Users size={15} aria-hidden="true" /> Illustrative 2-of-3 guardians</span><span><Clock3 size={15} aria-hidden="true" /> No real timelock runs here</span></div></section>
      </>}
      {prepared && <RecoveryActionDialog prepared={prepared} onClose={closePreview} onSignAndSimulate={() => void signAndSimulate()} onSubmit={() => void submitPrepared()} submitting={submitting} cluster={health?.cluster ?? "Devnet"} canSign={Boolean(signTransaction)} />}
    </section>
  );
}

export function ActivityView(props: SurfaceProps) { return <ActivitySurface {...props} />; }
export function RewardsView(props: SurfaceProps) { return <RewardsSurface {...props} />; }
export function AssistantView(props: SurfaceProps) { return <AssistantSurface {...props} />; }
export function McpView(props: SurfaceProps) { return <McpSurface {...props} />; }
export function RecoveryView(props: SurfaceProps) { return <RecoverySurface {...props} />; }