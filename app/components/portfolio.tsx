"use client";

import { useState } from "react";
import { usePortfolio, type Position } from "./portfolio-store";
import { fmtUsd } from "../lib/api";

export default function Portfolio() {
  const { positions, totals, closePosition } = usePortfolio();
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");

  const filtered = positions.filter((p) =>
    filter === "all" ? true : filter === "open" ? p.status === "open" : p.status !== "open",
  );

  if (positions.length === 0) {
    return (
      <section id="portfolio" className="relative px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col gap-3">
            <span className="eyebrow">Portfolio</span>
            <h2 className="heading-display text-4xl sm:text-5xl">Your positions</h2>
          </header>
          <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--surface)] ring-1 ring-border">
              <BriefcaseIcon className="h-5 w-5 text-muted" />
            </div>
            <div className="text-base font-semibold text-foreground">No positions yet</div>
            <div className="max-w-md text-sm text-muted">
              Buy an outcome on any market above and your stealth-routed position will show up
              here for you to manage.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="portfolio" className="relative px-4 py-20 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <span className="eyebrow">Portfolio</span>
          <h2 className="heading-display text-4xl sm:text-5xl">Your positions</h2>
        </header>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Open" value={`${totals.open}`} />
          <StatCard label="Invested" value={fmtUsd(totals.invested)} />
          <StatCard label="Current value" value={fmtUsd(totals.value)} />
          <StatCard
            label="P&L"
            value={`${totals.pnl >= 0 ? "+" : ""}${fmtUsd(Math.abs(totals.pnl))} (${totals.pnlPct.toFixed(2)}%)`}
            tone={totals.pnl >= 0 ? "up" : "down"}
          />
          <StatCard label="Wallets via Umbra" value={`${totals.stealthWallets}`} accent />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {(["open", "closed", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                "rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition " +
                (filter === f
                  ? "bg-[#0b0c0f] text-white"
                  : "border border-black/10 bg-white text-black/70 hover:border-black/20")
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* Position rows */}
        {filtered.length === 0 ? (
          <div className="card py-12 text-center text-sm text-muted">
            No {filter} positions.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden grid-cols-12 gap-4 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-2 sm:grid">
              <div className="col-span-5">Market</div>
              <div className="col-span-1 text-right">Shares</div>
              <div className="col-span-1 text-right">Avg</div>
              <div className="col-span-1 text-right">Now</div>
              <div className="col-span-1 text-right">Invested</div>
              <div className="col-span-1 text-right">Value</div>
              <div className="col-span-1 text-right">P&L</div>
              <div className="col-span-1 text-right" />
            </div>
            <ul>
              {filtered.map((p) => (
                <PositionRow
                  key={p.id}
                  position={p}
                  onClose={() => closePosition(p.id, p.currentPrice ?? p.avgPrice)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function PositionRow({ position, onClose }: { position: Position; onClose: () => void }) {
  const cur = position.currentPrice ?? position.avgPrice;
  const value = position.shares * cur;
  const pnl = position.status === "open" ? value - position.size : (position.payout ?? 0) - position.size;
  const pnlPct = position.size > 0 ? (pnl / position.size) * 100 : 0;
  const up = pnl >= 0;
  const isOpen = position.status === "open";

  return (
    <li className="grid grid-cols-12 gap-3 border-b border-border px-5 py-4 text-sm last:border-b-0">
      <div className="col-span-12 flex items-center gap-3 sm:col-span-5">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
          {position.marketIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={position.marketIcon} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#9dd1ee] to-[#0082f3] text-sm font-bold text-white">
              {position.marketTitle.match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className="line-clamp-2 break-words text-[13px] font-medium leading-snug text-foreground"
            title={position.marketTitle}
          >
            {position.marketTitle}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-2">
            <span
              className={`rounded-full px-1.5 py-0.5 font-semibold ${
                position.outcome === "Yes" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {position.outcome}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#00b3ff]/12 px-1.5 py-0.5 font-semibold text-[#0082f3]">
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
              </svg>
              {position.walletCount} via Umbra
            </span>
            {!isOpen && (
              <span className="rounded-full bg-black/5 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-muted">
                {position.status}
              </span>
            )}
          </div>
        </div>
      </div>

      <Cell label="Shares" value={position.shares.toFixed(2)} />
      <Cell label="Avg" value={`${Math.round(position.avgPrice * 100)}¢`} />
      <Cell label="Now" value={`${Math.round(cur * 100)}¢`} mono />
      <Cell label="Invested" value={fmtUsd(position.size)} />
      <Cell label="Value" value={fmtUsd(value)} mono />
      <div className="col-span-6 flex items-center justify-end text-right sm:col-span-1">
        <div className="flex flex-col items-end">
          <span className={up ? "font-mono text-emerald-700" : "font-mono text-rose-700"}>
            {up ? "+" : "−"}
            {fmtUsd(Math.abs(pnl))}
          </span>
          <span className={`text-[11px] ${up ? "text-emerald-600" : "text-rose-600"}`}>
            {up ? "+" : "−"}
            {Math.abs(pnlPct).toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="col-span-6 flex items-center justify-end sm:col-span-1">
        {isOpen ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
          >
            Sell
          </button>
        ) : (
          <span className="text-[11px] text-muted-2">closed</span>
        )}
      </div>
    </li>
  );
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="col-span-6 flex items-center justify-end text-right sm:col-span-1">
      <div className="flex flex-col items-end">
        <span className="text-[10px] uppercase tracking-wider text-muted-2 sm:hidden">{label}</span>
        <span className={`${mono ? "font-mono" : ""} text-foreground`}>{value}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  accent?: boolean;
}) {
  const color =
    tone === "up" ? "text-emerald-700" : tone === "down" ? "text-rose-700" : "text-foreground";
  if (accent) {
    return (
      <div className="card flex flex-col gap-1 p-4 ring-1 ring-[#00b3ff]/30">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0082f3]">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-[#00b3ff]/15">
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-[#0082f3]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
            </svg>
          </span>
          {label}
        </span>
        <span className="font-mono text-xl font-semibold text-[#0082f3]">{value}</span>
      </div>
    );
  }
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">{label}</span>
      <span className={`font-mono text-xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}
