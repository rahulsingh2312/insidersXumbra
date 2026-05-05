"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Dialog, { DialogClose } from "./dialog";
import { fmtUsd } from "../lib/api";
import { usePortfolio } from "./portfolio-store";

export type BuyTarget = {
  marketTitle: string;
  marketIcon?: string;
  outcome: "Yes" | "No";
  price: number; // 0..1
};

const STEPS = ["Order", "Split", "Execute"] as const;
type Step = (typeof STEPS)[number];

export default function BuyModal({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: BuyTarget | null;
  onClose: () => void;
}) {
  const { addPosition } = usePortfolio();
  const [step, setStep] = useState<Step>("Order");
  const [size, setSize] = useState<string>("100");
  const [walletCount, setWalletCount] = useState<number>(80);
  const [slippage, setSlippage] = useState<number>(0.3);

  // execute progress
  const [progress, setProgress] = useState(0);
  const [filled, setFilled] = useState(0);
  const positionRecorded = useRef(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setStep("Order");
      setProgress(0);
      setFilled(0);
      positionRecorded.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (step !== "Execute") return;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + Math.random() * 6 + 2);
        if (next >= 100) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
        }
        return next;
      });
      setFilled((f) => Math.min(walletCount, f + Math.ceil(Math.random() * 4)));
    }, 220);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [step, walletCount]);

  // record position once when execution completes
  useEffect(() => {
    if (progress < 100 || positionRecorded.current || !target) return;
    positionRecorded.current = true;
    const sizeN = Number(size) || 0;
    const shares = target.price > 0 ? sizeN / target.price : 0;
    addPosition({
      marketTitle: target.marketTitle,
      marketIcon: target.marketIcon,
      outcome: target.outcome,
      shares,
      avgPrice: target.price,
      size: sizeN,
      walletCount,
    });
  }, [progress, target, addPosition, size, walletCount]);

  if (!target) {
    return (
      <Dialog open={open} onClose={onClose}>
        <div className="text-sm text-muted">No market selected.</div>
      </Dialog>
    );
  }

  const sizeNum = Number(size) || 0;
  const perWallet = walletCount > 0 ? sizeNum / walletCount : 0;
  const sharesPerWallet = target.price > 0 ? perWallet / target.price : 0;
  const totalShares = sharesPerWallet * walletCount;
  const stepIndex = STEPS.indexOf(step);

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">
            Buy · {step} · step {stepIndex + 1}/{STEPS.length}
          </span>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface ring-1 ring-border">
              {target.marketIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={target.marketIcon} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>◎</span>
              )}
            </div>
            <div className="flex flex-col">
              <h2 className="line-clamp-2 text-lg font-semibold leading-tight tracking-tight text-foreground">
                {target.marketTitle}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    target.outcome === "Yes"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  Buy {target.outcome}
                </span>
                <span className="font-mono text-sm text-muted">
                  @ {Math.round(target.price * 100)}¢
                </span>
              </div>
            </div>
          </div>
        </div>
        <DialogClose onClick={onClose} />
      </div>

      <Stepper stepIndex={stepIndex} />

      {step === "Order" && (
        <OrderStep
          size={size}
          setSize={setSize}
          slippage={slippage}
          setSlippage={setSlippage}
          target={target}
          onNext={() => setStep("Split")}
        />
      )}

      {step === "Split" && (
        <SplitStep
          sizeNum={sizeNum}
          perWallet={perWallet}
          walletCount={walletCount}
          setWalletCount={setWalletCount}
          totalShares={totalShares}
          target={target}
          onBack={() => setStep("Order")}
          onNext={() => setStep("Execute")}
        />
      )}

      {step === "Execute" && (
        <ExecuteStep
          sizeNum={sizeNum}
          perWallet={perWallet}
          walletCount={walletCount}
          progress={progress}
          filled={filled}
          target={target}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function Stepper({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="my-4 flex items-center gap-1.5">
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

function OrderStep({
  size,
  setSize,
  slippage,
  setSlippage,
  target,
  onNext,
}: {
  size: string;
  setSize: (v: string) => void;
  slippage: number;
  setSlippage: (n: number) => void;
  target: BuyTarget;
  onNext: () => void;
}) {
  const sizeNum = Number(size) || 0;
  const shares = target.price > 0 ? sizeNum / target.price : 0;
  return (
    <div className="flex flex-col gap-5">
      <label className="card flex flex-col gap-3 p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-2">
          Order size (USD)
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-muted-2">$</span>
          <input
            value={size}
            onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="w-full bg-transparent text-4xl font-semibold tracking-tight text-foreground focus:outline-none"
            placeholder="0"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>≈ {shares.toFixed(2)} shares of {target.outcome}</span>
          <div className="flex gap-1">
            {["50", "250", "1000", "5000"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSize(v)}
                className="rounded-full bg-black/5 px-2 py-1 font-mono text-[11px] hover:bg-black/10"
              >
                ${v}
              </button>
            ))}
          </div>
        </div>
      </label>

      <div className="card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Slippage tolerance</span>
          <span className="font-mono text-sm text-[#0082f3]">{slippage.toFixed(2)}%</span>
        </div>
        <div className="flex gap-2">
          {[0.1, 0.3, 0.5, 1].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSlippage(v)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                slippage === v
                  ? "bg-[#0b0c0f] text-white"
                  : "border border-black/10 bg-white text-black/70 hover:border-black/20"
              }`}
            >
              {v}%
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={sizeNum <= 0}
        onClick={onNext}
        className="cta-primary inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue → Configure split
      </button>
    </div>
  );
}

function SplitStep({
  sizeNum,
  perWallet,
  walletCount,
  setWalletCount,
  totalShares,
  target,
  onBack,
  onNext,
}: {
  sizeNum: number;
  perWallet: number;
  walletCount: number;
  setWalletCount: (n: number) => void;
  totalShares: number;
  target: BuyTarget;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Stealth wallets</div>
            <div className="text-xs text-muted">
              {fmtUsd(sizeNum)} split across {walletCount} fresh wallets
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-semibold leading-none text-[#0082f3]">
              {walletCount}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-2">
              wallets
            </div>
          </div>
        </div>
        <input
          type="range"
          min={10}
          max={400}
          step={5}
          value={walletCount}
          onChange={(e) => setWalletCount(Number(e.target.value))}
          className="w-full accent-[#00b3ff]"
        />
        <SplitPreview walletCount={walletCount} perWallet={perWallet} />
      </div>

      <div className="card flex flex-col gap-2 p-5 text-sm">
        <Row label="Per wallet" value={fmtUsd(perWallet)} mono />
        <Row label={`Shares of ${target.outcome}`} value={`${totalShares.toFixed(2)}`} mono />
        <Row label="Avg fill price" value={`${Math.round(target.price * 100)}¢`} mono />
        <Row label="Est. price impact" value="0.04%" mono muted />
        <Row label="Privacy score" value="A+" mono bold />
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="cta-secondary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold">
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="cta-primary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold"
        >
          Execute trade
        </button>
      </div>
    </div>
  );
}

/**
 * Calm preview shown in the Split step BEFORE execution begins.
 * Visualises the source funds branching out to N wallets — gentle,
 * static-looking with a slow ambient breathing glow rather than the
 * aggressive pop-in animation used during Execute.
 */
function SplitPreview({
  walletCount,
  perWallet,
}: {
  walletCount: number;
  perWallet: number;
}) {
  // sample N wallets to draw (cap at 60 so the SVG stays readable)
  const N = Math.min(60, walletCount);
  const w = 480;
  const h = 160;
  const cx = w / 2;
  const cy = 30;
  // arrange wallet endpoints in a nice arc + grid below the source
  const points = Array.from({ length: N }).map((_, i) => {
    const cols = 12;
    const row = Math.floor(i / cols);
    const col = i % cols;
    const totalRows = Math.ceil(N / cols);
    const x = ((col + 0.5) / cols) * (w - 40) + 20;
    const y = h - 30 - (totalRows - 1 - row) * 18;
    return { x, y };
  });
  return (
    <div className="relative overflow-hidden rounded-xl bg-[radial-gradient(120%_60%_at_50%_0%,#e1f3ff_0%,#ffffff_70%)] p-2 ring-1 ring-border">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full">
        <defs>
          <radialGradient id="srcGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00b3ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#00b3ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* connector lines */}
        {points.map((p, i) => (
          <line
            key={`l${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#00b3ff"
            strokeOpacity="0.18"
            strokeWidth="0.7"
          />
        ))}
        {/* source halo + node */}
        <circle cx={cx} cy={cy} r="22" fill="url(#srcGlow)">
          <animate attributeName="r" values="20;26;20" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r="9" fill="#0082f3" />
        <circle cx={cx} cy={cy} r="4" fill="#ffffff" />
        {/* wallet endpoints */}
        {points.map((p, i) => (
          <g key={`p${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r="2.6"
              fill="#00b3ff"
              opacity="0.85"
            >
              <animate
                attributeName="opacity"
                values="0.4;0.95;0.4"
                dur="2.6s"
                begin={`${(i * 60) % 1800}ms`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-between px-2 pb-1 pt-0.5 text-[11px] text-muted-2">
        <span>Source</span>
        <span className="font-mono text-[#0082f3]">
          ≈ {fmtUsd(perWallet)} / wallet
        </span>
        <span>{walletCount} stealth endpoints</span>
      </div>
    </div>
  );
}

function ExecuteStep({
  sizeNum,
  perWallet,
  walletCount,
  progress,
  filled,
  target,
  onClose,
}: {
  sizeNum: number;
  perWallet: number;
  walletCount: number;
  progress: number;
  filled: number;
  target: BuyTarget;
  onClose: () => void;
}) {
  const done = progress >= 100;
  const phase = useMemo(() => {
    if (progress < 25) return { label: "Generating stealth wallets", icon: <PhaseIcon kind="key" /> };
    if (progress < 55) return { label: "Funding wallets via Umbra", icon: <PhaseIcon kind="shield" /> };
    if (progress < 90) return { label: "Filling order book", icon: <PhaseIcon kind="bolt" /> };
    if (progress < 100) return { label: "Confirming on Polygon", icon: <PhaseIcon kind="check-loading" /> };
    return { label: "Filled — receipts in your portfolio", icon: <PhaseIcon kind="check" /> };
  }, [progress]);

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
          <span className="font-mono text-sm text-[#0082f3]">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-black/5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-[#00b3ff] to-[#0082f3] shadow-[0_0_10px_rgba(0,179,255,0.6)]"
            style={{ width: `${progress}%`, transition: "width 200ms linear" }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Wallets" value={`${filled}/${walletCount}`} />
          <Stat label="Filled" value={fmtUsd((sizeNum * progress) / 100)} />
          <Stat label="Avg price" value={`${Math.round(target.price * 100)}¢`} />
        </div>
      </div>

      <WalletGrid walletCount={walletCount} filled={filled} />

      <div className="card flex flex-col gap-1 p-5 text-sm">
        <Row
          label="Outcome"
          value={`${target.outcome} @ ${Math.round(target.price * 100)}¢`}
          bold
        />
        <Row label="Total size" value={fmtUsd(sizeNum)} />
        <Row label="Per wallet" value={fmtUsd(perWallet)} muted />
        <Row label="Privacy" value="Untraceable via Umbra" muted />
      </div>

      <div className="flex gap-3">
        {done && (
          <a
            href="#portfolio"
            onClick={onClose}
            className="cta-secondary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold"
          >
            View portfolio
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={!done}
          className={`cta-primary inline-flex h-12 ${
            done ? "flex-1" : "w-full"
          } items-center justify-center gap-2 rounded-full px-6 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {done ? "Done" : "Filling…"}
        </button>
      </div>
    </div>
  );
}

function WalletGrid({ walletCount, filled }: { walletCount: number; filled: number }) {
  const dots = Math.min(120, walletCount);
  const filledDots = Math.min(dots, Math.round((filled / Math.max(1, walletCount)) * dots));
  return (
    <div className="card relative grid grid-cols-12 gap-1.5 overflow-hidden p-4 sm:grid-cols-15 md:grid-cols-20">
      {Array.from({ length: dots }).map((_, i) => {
        const isFilled = i < filledDots;
        return (
          <div
            key={i}
            className={`relative aspect-square rounded-md transition-all duration-300 ${
              isFilled
                ? "bg-[#00b3ff] shadow-[0_0_8px_rgba(0,179,255,0.7)]"
                : "bg-black/5"
            }`}
            style={{
              animation: isFilled
                ? `walletPop 0.3s ease ${(i % 12) * 20}ms forwards`
                : undefined,
            }}
          />
        );
      })}
      <style>{`
        @keyframes walletPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function PhaseIcon({ kind }: { kind: "key" | "shield" | "bolt" | "check" | "check-loading" }) {
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
  if (kind === "bolt")
    return (
      <svg {...common}>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    );
  if (kind === "check")
    return (
      <svg {...common}>
        <path d="m5 12 5 5L20 7" />
      </svg>
    );
  // check-loading — refined spinner ring
  return (
    <svg {...common} className="h-4 w-4 animate-spin">
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2 ring-1 ring-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-2">{label}</div>
      <div className="font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  bold,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={`text-sm ${muted ? "text-muted-2" : "text-muted"}`}>{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""} text-foreground`}
      >
        {value}
      </span>
    </div>
  );
}
