"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useModals } from "./modal-store";

const API_BASE = "https://insiders-api.polyinsiders.com/api";
const PAGE_SIZE = 6;

type ApiMarket = {
  conditionId: string;
  marketTitle: string;
  outcome?: string;
  side?: string;
  eventSlug?: string;
  totalSignals?: number;
  smartMoneyCount?: number;
  totalVolume?: number;
  avgPrice?: number;
  latestSignalAt?: string;
  tags?: string[];
  icon?: string; // enriched lazily from /market/market/<slug>
};

type SearchMarket = {
  id: string;
  title: string;
  slug: string;
  icon?: string;
  assetIds?: string[];
};

type DisplayMarket = {
  key: string;
  title: string;
  slug?: string;
  icon?: string;
  category?: string;
  tags?: string[];
  volume?: number;
  yesProb?: number;
  signals?: number;
  smartMoney?: number;
  outcome?: string;
};

const CATEGORIES = ["All", "crypto", "politics", "sports", "world", "tech", "ai"];

const TAG_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  crypto: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  politics: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
  sports: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  world: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  tech: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  ai: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  macro: { bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200" },
  default: { bg: "bg-[color:var(--surface)]", text: "text-muted", ring: "ring-border" },
};

function tagStyle(tag: string) {
  const k = tag.toLowerCase();
  return TAG_COLORS[k] ?? TAG_COLORS.default;
}

const AVATAR_GRADIENTS: Record<string, string> = {
  crypto: "from-amber-300 to-orange-400",
  politics: "from-rose-300 to-rose-500",
  sports: "from-emerald-300 to-emerald-500",
  world: "from-blue-300 to-blue-500",
  tech: "from-violet-300 to-violet-500",
  ai: "from-violet-300 to-fuchsia-500",
  macro: "from-slate-300 to-slate-500",
  default: "from-[#9dd1ee] to-[#0082f3]",
};

function avatarGradient(tag?: string) {
  if (!tag) return AVATAR_GRADIENTS.default;
  return AVATAR_GRADIENTS[tag.toLowerCase()] ?? AVATAR_GRADIENTS.default;
}

function fmtUsd(n?: number) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function initialFor(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const m = trimmed.match(/[A-Za-z0-9]/);
  return (m?.[0] || trimmed[0]).toUpperCase();
}

export default function Markets() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");
  const [trending, setTrending] = useState<ApiMarket[] | null>(null);
  const [searchResults, setSearchResults] = useState<SearchMarket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const debounceRef = useRef<number | null>(null);

  // initial load — trending active markets with signals
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/v13/markets/active`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setTrending(json?.data ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // lazily enrich trending markets with icons (fetch in parallel batches)
  useEffect(() => {
    if (!trending || trending.length === 0) return;
    const needsIcon = trending.filter((m) => !m.icon && m.eventSlug);
    if (needsIcon.length === 0) return;
    let cancelled = false;
    (async () => {
      // batch 8 at a time to avoid hammering
      for (let i = 0; i < needsIcon.length; i += 8) {
        if (cancelled) return;
        const batch = needsIcon.slice(i, i + 8);
        const results = await Promise.all(
          batch.map(async (m) => {
            try {
              const res = await fetch(
                `${API_BASE}/market/market/${encodeURIComponent(m.eventSlug!)}`,
              );
              if (!res.ok) return null;
              const json = await res.json();
              return {
                conditionId: m.conditionId,
                icon: json?.data?.image || json?.image || null,
              };
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        setTrending((prev) => {
          if (!prev) return prev;
          const map = new Map(
            results.filter(Boolean).map((r) => [r!.conditionId, r!.icon]),
          );
          return prev.map((m) =>
            map.has(m.conditionId) ? { ...m, icon: map.get(m.conditionId) ?? undefined } : m,
          );
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trending?.length]);

  // reset pagination when filter/search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, active]);

  // debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const url = `${API_BASE}/username/search?q=${encodeURIComponent(query.trim())}&limit=12`;
        const res = await fetch(url);
        const json = await res.json();
        setSearchResults(json?.markets ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const display: DisplayMarket[] = useMemo(() => {
    if (query.trim() && searchResults) {
      return searchResults.map((m) => ({
        key: m.id,
        title: m.title,
        slug: m.slug,
        icon: m.icon,
      }));
    }
    const list = trending ?? [];
    const filtered =
      active === "All"
        ? list
        : list.filter((m) => (m.tags ?? []).some((t) => t.toLowerCase() === active.toLowerCase()));
    return filtered.map((m) => ({
      key: m.conditionId,
      title: m.marketTitle,
      slug: m.eventSlug,
      icon: m.icon,
      category: m.tags?.[0],
      tags: m.tags,
      volume: m.totalVolume,
      yesProb: m.avgPrice,
      signals: m.totalSignals,
      smartMoney: m.smartMoneyCount,
      outcome: m.outcome,
    }));
  }, [query, searchResults, trending, active]);

  return (
    <section id="markets" className="relative px-4 py-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-col items-start gap-3">
          <span className="eyebrow">Live markets</span>
          <h2 className="heading-display text-4xl sm:text-5xl">Trade any market. Privately.</h2>
          <p className="max-w-2xl text-lg text-muted">
            Search any active Polymarket market. Pick an outcome. Insiders splits your size across
            stealth wallets via Umbra and fills it without moving the chart.
          </p>
        </header>

        {/* Search + categories */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="search-input flex h-14 w-full items-center gap-3 rounded-2xl px-5 lg:max-w-xl">
            <SearchIcon className="h-5 w-5 text-black/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search markets, try "Bitcoin", "election", "Fed"...'
              className="w-full bg-transparent text-base text-black placeholder:text-black/40 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {searching && <Spinner />}
            {query && !searching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="grid h-7 w-7 place-items-center rounded-full bg-black/5 text-black/50 transition hover:bg-black/10"
                aria-label="Clear"
              >
                ×
              </button>
            )}
            <kbd className="hidden rounded-md border border-black/10 bg-white/60 px-2 py-1 font-mono text-xs text-black/50 sm:inline-flex">
              ⌘K
            </kbd>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActive(c)}
                disabled={!!query.trim()}
                className={
                  "rounded-full px-3.5 py-2 text-sm font-medium capitalize transition disabled:opacity-40 " +
                  (active === c
                    ? "bg-[#0b0c0f] text-white"
                    : "border border-black/10 bg-white text-black/70 hover:border-black/20")
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="card mb-4 flex h-16 items-center justify-center text-sm text-rose-700">
            Couldn&apos;t reach Insiders API: {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : display.length === 0 ? (
          <div className="card flex h-40 items-center justify-center text-sm text-muted">
            {query ? `No markets match "${query}".` : "No markets available right now."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {display.slice(0, visibleCount).map((m) => (
                <MarketCard key={m.key} market={m} />
              ))}
            </div>
            {visibleCount < display.length && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="cta-secondary inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
                >
                  Show more markets
                  <span aria-hidden>↓</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function MarketCard({ market }: { market: DisplayMarket }) {
  const { openBuy } = useModals();
  const yesPct = market.yesProb != null ? Math.round(market.yesProb * 100) : null;
  const noPct = yesPct != null ? 100 - yesPct : null;
  const href = market.slug
    ? `https://polymarket.com/event/${market.slug}`
    : undefined;

  const yesPrice = market.yesProb ?? 0.5;
  const noPrice = 1 - yesPrice;

  const tags = (market.tags && market.tags.length > 0
    ? market.tags
    : market.category
    ? [market.category]
    : []
  ).slice(0, 3);

  return (
    <div className="market-card card flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <MarketAvatar icon={market.icon} title={market.title} category={market.category} />
        <div className="flex flex-1 flex-col gap-2">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const s = tagStyle(t);
                return (
                  <span
                    key={t}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${s.bg} ${s.text} ${s.ring}`}
                  >
                    {t}
                  </span>
                );
              })}
            </div>
          )}
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground">
            {market.title}
          </h3>
        </div>
      </div>

      {yesPct != null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-emerald-700">Yes {yesPct}¢</span>
            <span className="text-rose-700">No {noPct}¢</span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-rose-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-emerald-400 to-emerald-500"
              style={{ width: `${yesPct}%` }}
            />
          </div>
        </div>
      )}

      {(market.volume != null || market.signals != null || market.smartMoney != null) && (
        <div className="flex items-center justify-between text-xs text-muted">
          {market.volume != null && <span>Vol {fmtUsd(market.volume)}</span>}
          {market.signals != null && <span>{market.signals} signals</span>}
          {market.smartMoney != null && (
            <span className="rounded-full bg-[#00b3ff]/10 px-2 py-0.5 font-semibold text-[#0082f3]">
              {market.smartMoney} smart
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            openBuy({
              marketTitle: market.title,
              marketIcon: market.icon,
              outcome: "Yes",
              price: yesPrice,
            })
          }
          className="outcome-yes flex h-11 items-center justify-center gap-1 rounded-xl text-sm font-semibold"
        >
          Buy Yes {yesPct != null && <span className="font-mono text-xs opacity-70">{yesPct}¢</span>}
        </button>
        <button
          type="button"
          onClick={() =>
            openBuy({
              marketTitle: market.title,
              marketIcon: market.icon,
              outcome: "No",
              price: noPrice,
            })
          }
          className="outcome-no flex h-11 items-center justify-center gap-1 rounded-xl text-sm font-semibold"
        >
          Buy No {noPct != null && <span className="font-mono text-xs opacity-70">{noPct}¢</span>}
        </button>
      </div>

      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted hover:text-foreground"
        >
          View on Polymarket ↗
        </a>
      )}
    </div>
  );
}

function MarketAvatar({
  icon,
  title,
  category,
}: {
  icon?: string;
  title: string;
  category?: string;
}) {
  const [errored, setErrored] = useState(false);
  const showImg = icon && !errored;
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-border">
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-linear-to-br ${avatarGradient(
            category,
          )} text-lg font-bold text-white`}
        >
          {initialFor(title)}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card flex animate-pulse flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-black/5" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-3 w-16 rounded bg-black/5" />
          <div className="h-4 w-3/4 rounded bg-black/10" />
          <div className="h-4 w-1/2 rounded bg-black/5" />
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-black/5" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-11 rounded-xl bg-black/5" />
        <div className="h-11 rounded-xl bg-black/5" />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-black/40" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
