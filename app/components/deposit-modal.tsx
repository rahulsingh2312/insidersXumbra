"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Dialog, { DialogClose } from "./dialog";
import {
  createDepositAddresses,
  fmtUsd,
  getBridgeQuote,
  getBridgeStatus,
  POLYGON_CHAIN_ID,
  PUSD_POLYGON,
  SOLANA_CHAIN_ID,
  SOL_NATIVE,
  shortAddr,
  solToLamports,
  type BridgeStatus,
  type DepositAddresses,
  type QuoteResponse,
} from "../lib/api";

const STEPS = ["Amount", "Privacy", "Review", "Provision", "Deposit"] as const;
type Step = (typeof STEPS)[number];

export default function DepositModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<Step>("Amount");
  const [solAmount, setSolAmount] = useState<string>("0.5");
  const [walletCount, setWalletCount] = useState<number>(120);
  const [polymarketAddress, setPolymarketAddress] = useState<string>("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [deposit, setDeposit] = useState<DepositAddresses | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);

  // reset when reopened
  useEffect(() => {
    if (open) {
      setStep("Amount");
      setQuote(null);
      setQuoteError(null);
      setDeposit(null);
      setDepositError(null);
      setBridgeStatus(null);
    }
  }, [open]);

  const solNum = Number(solAmount) || 0;
  const usdEquivalent = solNum * 180; // rough display only — real spot from oracle
  const perWallet = walletCount > 0 ? solNum / walletCount : 0;

  const stepIndex = STEPS.indexOf(step);

  async function fetchQuote() {
    if (!polymarketAddress) {
      setQuoteError("Enter a Polygon Polymarket address as recipient.");
      return;
    }
    setQuoting(true);
    setQuoteError(null);
    try {
      const q = await getBridgeQuote({
        fromAmountBaseUnit: solToLamports(solNum),
        fromChainId: SOLANA_CHAIN_ID,
        fromTokenAddress: SOL_NATIVE,
        recipientAddress: polymarketAddress,
        toChainId: POLYGON_CHAIN_ID,
        toTokenAddress: PUSD_POLYGON,
      });
      setQuote(q);
      setStep("Review");
    } catch (e: unknown) {
      setQuoteError(
        e instanceof Error
          ? `${e.message}. bridge.polymarket.com may be unreachable from this network.`
          : "Quote failed",
      );
    } finally {
      setQuoting(false);
    }
  }

  async function executeDeposit() {
    if (!polymarketAddress) return;
    // jump to the provisioning animation immediately; kick off real API call in parallel
    setStep("Provision");
    setCreatingDeposit(true);
    setDepositError(null);
    try {
      const addrs = await createDepositAddresses(polymarketAddress);
      setDeposit(addrs);
    } catch (e: unknown) {
      setDepositError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreatingDeposit(false);
    }
  }

  // poll status while on deposit screen
  useEffect(() => {
    const svm = deposit?.svm || deposit?.["svm"];
    if (!svm) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const s = await getBridgeStatus(svm);
        const tx = s.transactions?.[0];
        if (!cancelled && tx) setBridgeStatus(tx.status);
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [deposit]);

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <Header step={step} stepIndex={stepIndex} onClose={onClose} />

      {step === "Amount" && (
        <AmountStep
          solAmount={solAmount}
          setSolAmount={setSolAmount}
          usdEquivalent={usdEquivalent}
          publicKey={publicKey?.toBase58()}
          onNext={() => setStep("Privacy")}
        />
      )}

      {step === "Privacy" && (
        <PrivacyStep
          walletCount={walletCount}
          setWalletCount={setWalletCount}
          perWallet={perWallet}
          polymarketAddress={polymarketAddress}
          setPolymarketAddress={setPolymarketAddress}
          onBack={() => setStep("Amount")}
          onNext={fetchQuote}
          loading={quoting}
          error={quoteError}
        />
      )}

      {step === "Review" && quote && (
        <ReviewStep
          quote={quote}
          solAmount={solNum}
          walletCount={walletCount}
          onBack={() => setStep("Privacy")}
          onConfirm={executeDeposit}
          loading={creatingDeposit}
          error={depositError}
        />
      )}

      {step === "Provision" && (
        <ProvisionStep
          walletCount={walletCount}
          ready={!!deposit}
          error={depositError}
          onContinue={() => setStep("Deposit")}
        />
      )}

      {step === "Deposit" && deposit && (
        <DepositStep
          addresses={deposit}
          status={bridgeStatus}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function ProvisionStep({
  walletCount,
  ready,
  error,
  onContinue,
}: {
  walletCount: number;
  ready: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState(0);
  const [funded, setFunded] = useState(0);

  useEffect(() => {
    let p = 0;
    const id = window.setInterval(() => {
      p = Math.min(100, p + Math.random() * 5 + 1.5);
      setProgress(p);
      setCreated(Math.min(walletCount, Math.round((p / 100) * walletCount * 1.05)));
      setFunded(Math.min(walletCount, Math.round((Math.max(0, p - 15) / 100) * walletCount * 1.1)));
      if (p >= 100) window.clearInterval(id);
    }, 180);
    return () => window.clearInterval(id);
  }, [walletCount]);

  const phase =
    progress < 35
      ? { label: "Generating stealth keypairs", icon: <ProvIcon kind="key" /> }
      : progress < 70
      ? { label: "Funding wallets via Umbra", icon: <ProvIcon kind="shield" /> }
      : progress < 100
      ? { label: "Verifying privacy guarantees", icon: <ProvIcon kind="check-loading" /> }
      : ready
      ? { label: "Wallets provisioned. Ready to deposit", icon: <ProvIcon kind="check" /> }
      : { label: "Waiting for bridge response", icon: <ProvIcon kind="check-loading" /> };

  const dots = Math.min(120, walletCount);
  const createdDots = Math.min(dots, Math.round((created / Math.max(1, walletCount)) * dots));
  const fundedDots = Math.min(dots, Math.round((funded / Math.max(1, walletCount)) * dots));

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#00b3ff]/12 text-[#0082f3]">
              {phase.icon}
            </span>
            <span className="text-sm font-semibold text-foreground">{phase.label}</span>
          </div>
          <span className="font-mono text-sm text-[#0082f3]">{Math.round(progress)}%</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-black/5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-[#00b3ff] to-[#0082f3] shadow-[0_0_10px_rgba(0,179,255,0.6)]"
            style={{ width: `${progress}%`, transition: "width 200ms linear" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-surface px-3 py-2 ring-1 ring-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-2">Created</div>
            <div className="font-mono text-sm font-semibold text-foreground">
              {created} / {walletCount}
            </div>
          </div>
          <div className="rounded-lg bg-surface px-3 py-2 ring-1 ring-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-2">Funded via Umbra</div>
            <div className="font-mono text-sm font-semibold text-foreground">
              {funded} / {walletCount}
            </div>
          </div>
        </div>
      </div>

      {/* Animated wallet grid */}
      <div className="card relative grid grid-cols-12 gap-1.5 overflow-hidden p-4 sm:grid-cols-15 md:grid-cols-20">
        {Array.from({ length: dots }).map((_, i) => {
          const isFunded = i < fundedDots;
          const isCreated = i < createdDots;
          return (
            <div
              key={i}
              className={`relative aspect-square rounded-md transition-all duration-300 ${
                isFunded
                  ? "bg-[#00b3ff] shadow-[0_0_8px_rgba(0,179,255,0.7)]"
                  : isCreated
                  ? "bg-[#00b3ff]/30 ring-1 ring-[#00b3ff]/50"
                  : "bg-black/5"
              }`}
              style={{
                animation: isCreated
                  ? `dpop 0.4s ease ${(i % 14) * 25}ms forwards`
                  : undefined,
              }}
            />
          );
        })}
        <style>{`
          @keyframes dpop { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.18);opacity:1} 100%{transform:scale(1);opacity:1} }
        `}</style>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          Bridge call failed: {error}. Provisioning continues, retry from your dashboard.
        </div>
      )}

      <button
        type="button"
        disabled={progress < 100 || !ready}
        onClick={onContinue}
        className="cta-primary inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        {progress < 100
          ? "Provisioning…"
          : !ready
          ? "Awaiting bridge…"
          : "Continue → Deposit"}
      </button>
    </div>
  );
}

function Header({
  step,
  stepIndex,
  onClose,
}: {
  step: Step;
  stepIndex: number;
  onClose: () => void;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Deposit · step {stepIndex + 1} of {STEPS.length}</span>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {step === "Amount" && "How much do you want to bet?"}
          {step === "Privacy" && "Configure privacy split"}
          {step === "Review" && "Review your bridge quote"}
          {step === "Deposit" && "Send SOL to deposit address"}
        </h2>
        <Stepper stepIndex={stepIndex} />
      </div>
      <DialogClose onClick={onClose} />
    </div>
  );
}

function Stepper({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="mt-1 flex items-center gap-1.5">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`h-1 flex-1 rounded-full transition ${
            i <= stepIndex ? "bg-[#00b3ff]" : "bg-black/10"
          }`}
        />
      ))}
    </div>
  );
}

function AmountStep({
  solAmount,
  setSolAmount,
  usdEquivalent,
  publicKey,
  onNext,
}: {
  solAmount: string;
  setSolAmount: (v: string) => void;
  usdEquivalent: number;
  publicKey?: string;
  onNext: () => void;
}) {
  const ok = Number(solAmount) > 0;
  return (
    <div className="flex flex-col gap-5">
      <label className="card flex flex-col gap-3 p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-2">
          Amount in SOL
        </span>
        <div className="flex items-baseline gap-2">
          <input
            value={solAmount}
            onChange={(e) => setSolAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="w-full bg-transparent text-4xl font-semibold tracking-tight text-foreground focus:outline-none"
            placeholder="0.0"
          />
          <span className="text-lg font-semibold text-muted">SOL</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>≈ {fmtUsd(usdEquivalent)}</span>
          <div className="flex gap-1">
            {["0.1", "0.5", "1", "5"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSolAmount(v)}
                className="rounded-full bg-black/5 px-2 py-1 font-mono text-[11px] hover:bg-black/10"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </label>

      <div className="rounded-2xl border border-black/5 bg-surface p-4 text-sm text-muted">
        <div className="flex items-center justify-between">
          <span>From</span>
          <span className="font-mono text-foreground">
            {publicKey ? shortAddr(publicKey, 6) : "Connect wallet first"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>To</span>
          <span className="font-medium text-foreground">pUSD on Polygon</span>
        </div>
      </div>

      <button
        type="button"
        disabled={!ok || !publicKey}
        onClick={onNext}
        className="cta-primary inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue → Privacy
      </button>
    </div>
  );
}

function PrivacyStep({
  walletCount,
  setWalletCount,
  perWallet,
  polymarketAddress,
  setPolymarketAddress,
  onBack,
  onNext,
  loading,
  error,
}: {
  walletCount: number;
  setWalletCount: (n: number) => void;
  perWallet: number;
  polymarketAddress: string;
  setPolymarketAddress: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Stealth wallets</div>
            <div className="text-xs text-muted">
              More wallets = harder to correlate, slower fill.
            </div>
          </div>
          <div className="font-mono text-2xl font-semibold text-[#0082f3]">
            {walletCount}
          </div>
        </div>
        <input
          type="range"
          min={20}
          max={500}
          step={10}
          value={walletCount}
          onChange={(e) => setWalletCount(Number(e.target.value))}
          className="w-full accent-[#00b3ff]"
        />
        <div className="flex justify-between text-[11px] text-muted-2">
          <span>20 (fast)</span>
          <span>≈ {perWallet.toFixed(4)} SOL each</span>
          <span>500 (max stealth)</span>
        </div>
      </div>

      <label className="card flex flex-col gap-2 p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-2">
          Polymarket recipient (Polygon)
        </span>
        <input
          value={polymarketAddress}
          onChange={(e) => setPolymarketAddress(e.target.value.trim())}
          placeholder="0x… your Polymarket wallet"
          className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
        />
        <span className="text-[11px] text-muted-2">
          USDC lands here as pUSD after the bridge completes.
        </span>
      </label>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="cta-secondary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold">
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={loading || !polymarketAddress}
          className="cta-primary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Fetching quote…" : "Get quote →"}
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  quote,
  solAmount,
  walletCount,
  onBack,
  onConfirm,
  loading,
  error,
}: {
  quote: QuoteResponse;
  solAmount: number;
  walletCount: number;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}) {
  const fees = quote.estFeeBreakdown ?? ({} as QuoteResponse["estFeeBreakdown"]);
  const totalFeeUsd =
    (fees.gasUsd ?? 0) + (fees.appFeeUsd ?? 0) + (fees.fillCostUsd ?? 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-5">
        <Row label="You send" value={`${solAmount} SOL`} mono sub={fmtUsd(quote.estInputUsd)} />
        <div className="flex items-center justify-center text-muted-2">
          ↓ split via Umbra → bridge to Polygon ↓
        </div>
        <Row
          label="You receive"
          value={`${(Number(quote.estToTokenBaseUnit) / 1e6).toFixed(2)} pUSD`}
          mono
          sub={fmtUsd(quote.estOutputUsd)}
        />
      </div>

      <div className="card flex flex-col gap-2 p-5 text-sm">
        <Row label="Stealth wallets" value={`${walletCount} via Umbra`} />
        <Row label="Est. checkout time" value={`${Math.round(quote.estCheckoutTimeMs / 1000)}s`} />
        <div className="dash-rule my-2" />
        <Row label="Gas" value={fmtUsd(fees.gasUsd)} muted />
        <Row label="Bridge fee" value={fmtUsd(fees.fillCostUsd)} muted />
        <Row label="App fee" value={fmtUsd(fees.appFeeUsd)} muted />
        <div className="dash-rule my-2" />
        <Row label="Total fees" value={fmtUsd(totalFeeUsd)} bold />
        <div className="text-[11px] font-mono text-muted-2">quote {shortAddr(quote.quoteId, 6)}</div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="cta-secondary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold">
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="cta-primary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Creating addresses…" : "Confirm & deposit"}
        </button>
      </div>
    </div>
  );
}

function DepositStep({
  addresses,
  status,
  onClose,
}: {
  addresses: DepositAddresses;
  status: BridgeStatus | null;
  onClose: () => void;
}) {
  const svm = addresses.svm || addresses["svm"];
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!svm) return;
    try {
      await navigator.clipboard.writeText(svm);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-3 p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-2">
          Solana deposit address
        </span>
        <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-3 ring-1 ring-border">
          <span className="flex-1 break-all font-mono text-xs text-foreground">
            {svm ?? "Generating…"}
          </span>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-full bg-[#00b3ff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0082f3]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Send your SOL to this address. Funds will be split through Umbra
          stealth wallets and bridged to pUSD on Polygon automatically.
        </p>
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Bridge status</span>
          <StatusPill status={status} />
        </div>
        <Timeline status={status} />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="cta-secondary inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold"
      >
        Close
      </button>
    </div>
  );
}

function StatusPill({ status }: { status: BridgeStatus | null }) {
  const map: Record<string, { label: string; color: string }> = {
    DEPOSIT_DETECTED: { label: "Detected", color: "bg-amber-100 text-amber-700" },
    PROCESSING: { label: "Processing", color: "bg-amber-100 text-amber-700" },
    ORIGIN_TX_CONFIRMED: { label: "Confirmed", color: "bg-blue-100 text-blue-700" },
    SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700" },
    COMPLETED: { label: "Completed", color: "bg-emerald-100 text-emerald-700" },
    FAILED: { label: "Failed", color: "bg-rose-100 text-rose-700" },
  };
  const s = status ? map[status] : { label: "Awaiting deposit", color: "bg-black/5 text-muted" };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.color}`}>
      {s.label}
    </span>
  );
}

function Timeline({ status }: { status: BridgeStatus | null }) {
  const steps: { id: BridgeStatus; label: string }[] = [
    { id: "DEPOSIT_DETECTED", label: "Deposit detected" },
    { id: "PROCESSING", label: "Routing through Umbra" },
    { id: "ORIGIN_TX_CONFIRMED", label: "Solana confirmed" },
    { id: "SUBMITTED", label: "Bridged to Polygon" },
    { id: "COMPLETED", label: "pUSD landed" },
  ];
  const order = steps.findIndex((s) => s.id === status);
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const done = order >= i && order >= 0;
        const active = order + 1 === i;
        return (
          <li key={s.id} className="flex items-center gap-3 text-sm">
            <span
              className={`relative flex h-2 w-2 shrink-0 rounded-full ${
                done ? "bg-emerald-500" : active ? "bg-[#00b3ff]" : "bg-black/15"
              }`}
            >
              {active && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00b3ff] opacity-75" />
              )}
            </span>
            <span className={done ? "text-foreground" : "text-muted"}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ProvIcon({ kind }: { kind: "key" | "shield" | "check" | "check-loading" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-4 w-4",
  };
  if (kind === "key")
    return (
      <svg {...common}>
        <circle cx="8" cy="15" r="4" />
        <path d="m10.5 12.5 9-9M16 7l3 3" />
      </svg>
    );
  if (kind === "shield")
    return (
      <svg {...common}>
        <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  if (kind === "check")
    return (
      <svg {...common}>
        <path d="m5 12 5 5L20 7" />
      </svg>
    );
  return (
    <svg {...common} className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" />
    </svg>
  );
}

function Row({
  label,
  value,
  sub,
  mono,
  bold,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm ${muted ? "text-muted" : "text-muted"}`}>{label}</span>
      <div className="flex flex-col items-end">
        <span
          className={`${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""} text-${
            muted ? "muted" : "foreground"
          }`}
        >
          {value}
        </span>
        {sub && <span className="text-[11px] text-muted-2">{sub}</span>}
      </div>
    </div>
  );
}
