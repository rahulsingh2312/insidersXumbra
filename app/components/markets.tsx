"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useModals } from "./modal-store";
import { fetchActiveMarkets, fetchAssetPrices, type HasuraMarket } from "../lib/hasura";

const API_BASE = "https://insiders-api.polyinsiders.com/api";
const PAGE_SIZE = 6;

type TrendingMarket = HasuraMarket & {
  yesProb?: number;
};

type SearchMarket = {
  id: string;
  title: string;
  slug: string;
  icon?: string;
  assetIds?: string[];
  yesProb?: number;
  endDate?: string;
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
  const [trending, setTrending] = useState<TrendingMarket[] | null>(null);
  const [searchResults, setSearchResults] = useState<SearchMarket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const debounceRef = useRef<number | null>(null);
  const enrichedRef = useRef<Set<string>>(new Set());

  // initial load — pull active markets from Hasura, sort by volume desc client-side
  // (sorting by volume server-side times out on this dataset).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const ms = await fetchActiveMarkets({ windowDays: 240, limit: 200 });
        if (cancelled) return;
        const sorted = [...ms].sort(
          (a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0),
        );
        setTrending(sorted);
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

  // fetch yes-side prices for visible trending markets via MarketAsset (Hasura).
  // batches all visible asset ids into a single query; skips ones already priced.
  useEffect(() => {
    if (query.trim()) return;
    if (!trending || trending.length === 0) return;
    const tagFiltered =
      active === "All"
        ? trending
        : trending.filter((m) =>
            (m.PolymarketMarketTags ?? []).some(
              (t) => t.PolymarketTag.slug.toLowerCase() === active.toLowerCase(),
            ),
          );
    const visible = tagFiltered.slice(0, visibleCount);
    const ids: string[] = [];
    for (const m of visible) {
      if (m.yesProb != null) continue;
      if (enrichedRef.current.has(m.conditionId)) continue;
      const yesId = (m.assetIds ?? [])[0];
      if (yesId) ids.push(yesId);
      enrichedRef.current.add(m.conditionId);
    }
    if (ids.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const priceById = await fetchAssetPrices(ids);
        if (cancelled || priceById.size === 0) return;
        setTrending((prev) => {
          if (!prev) return prev;
          let changed = false;
          const next = prev.map((m) => {
            if (m.yesProb != null) return m;
            const yesId = (m.assetIds ?? [])[0];
            const p = yesId ? priceById.get(yesId) : undefined;
            if (p == null) return m;
            changed = true;
            return { ...m, yesProb: p };
          });
          return changed ? next : prev;
        });
      } catch {
        /* leave prices blank, MarketCard will hide the bar */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trending, active, visibleCount, query]);

  // search enrichment — /username/search returns only id/title/slug/icon, so for
  // the visible search results we hit /market/market/<slug> for prices + endDate
  // and hide closed/expired ones via hiddenKeys.
  useEffect(() => {
    if (!query.trim() || !searchResults) return;
    const now = Date.now();
    const filtered = searchResults.filter(
      (m) =>
        !hiddenKeys.has(m.id) &&
        (!m.endDate || new Date(m.endDate).getTime() > now),
    );
    const todo = filtered
      .slice(0, visibleCount)
      .filter((m) => m.slug && !enrichedRef.current.has(m.id));
    if (todo.length === 0) return;
    todo.forEach((m) => enrichedRef.current.add(m.id));

    // intentionally not cancelling on cleanup: rapid keystrokes (e.g. "elo" → "elon")
    // can re-fire this effect before the first batch of fetches resolves. cancelling
    // would drop those results and the enrichedRef entries would block re-fetching,
    // so prices would never appear. setSearchResults uses setter form, so applying
    // enrichment data to a since-replaced list only updates rows whose id still matches.
    (async () => {
      const results = await Promise.all(
        todo.map(async (m) => {
          try {
            const res = await fetch(
              `${API_BASE}/market/market/${encodeURIComponent(m.slug)}`,
            );
            if (!res.ok) return null;
            const json = await res.json();
            const icon: string | null =
              json?.data?.image ?? json?.image ?? json?.icon ?? null;

            // /market/market/<slug> can return either an event (with nested
            // markets[]) or a single market (outcomePrices at top level). Pick
            // whichever shape we actually got.
            const inner: Array<Record<string, unknown>> = Array.isArray(json?.markets)
              ? (json.markets as Array<Record<string, unknown>>)
              : [];
            const matched: Record<string, unknown> | null =
              inner.find((mi) => String(mi?.id) === m.id) ??
              inner[0] ??
              (json && typeof json === "object" ? (json as Record<string, unknown>) : null);

            let yesProb: number | undefined;
            if (matched) {
              try {
                const op = matched.outcomePrices;
                const arr = typeof op === "string" ? JSON.parse(op) : op;
                if (Array.isArray(arr) && arr[0] != null) yesProb = Number(arr[0]);
              } catch {
                /* ignore */
              }
              if (yesProb == null && matched.lastTradePrice != null)
                yesProb = Number(matched.lastTradePrice);
              if (
                yesProb == null &&
                matched.bestBid != null &&
                matched.bestAsk != null
              )
                yesProb = (Number(matched.bestBid) + Number(matched.bestAsk)) / 2;
            }
            const closedFlag =
              json?.closed === true ||
              json?.archived === true ||
              matched?.closed === true ||
              matched?.archived === true;
            const endIso = matched?.endDate ?? json?.endDate;
            const endMs = endIso ? new Date(String(endIso)).getTime() : null;
            const hidden =
              closedFlag ||
              (endMs != null && Number.isFinite(endMs) && endMs <= now);
            return { key: m.id, icon, yesProb, hidden };
          } catch {
            return null;
          }
        }),
      );
      const valid = results.filter((r) => r != null) as Array<{
        key: string;
        icon: string | null;
        yesProb?: number;
        hidden: boolean;
      }>;
      if (valid.length === 0) return;
      const toHide = valid.filter((r) => r.hidden).map((r) => r.key);
      if (toHide.length > 0) {
        setHiddenKeys((prev) => {
          const next = new Set(prev);
          toHide.forEach((k) => next.add(k));
          return next;
        });
      }
      const byKey = new Map(valid.map((r) => [r.key, r]));
      setSearchResults((prev) => {
        if (!prev) return prev;
        let changed = false;
        const next = prev.map((m) => {
          const r = byKey.get(m.id);
          if (!r) return m;
          const nextIcon = m.icon ?? r.icon ?? undefined;
          const nextYes = m.yesProb ?? r.yesProb;
          if (nextIcon === m.icon && nextYes === m.yesProb) return m;
          changed = true;
          return { ...m, icon: nextIcon, yesProb: nextYes };
        });
        return changed ? next : prev;
      });
    })();
  }, [searchResults, visibleCount, query, hiddenKeys]);

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
    const now = Date.now();
    if (query.trim() && searchResults) {
      return searchResults
        .filter(
          (m) =>
            !hiddenKeys.has(m.id) &&
            (!m.endDate || new Date(m.endDate).getTime() > now),
        )
        .map((m) => ({
          key: m.id,
          title: m.title,
          slug: m.slug,
          icon: m.icon,
          yesProb: m.yesProb,
        }));
    }
    const list = trending ?? [];
    const filtered =
      active === "All"
        ? list
        : list.filter((m) =>
            (m.PolymarketMarketTags ?? []).some(
              (t) => t.PolymarketTag.slug.toLowerCase() === active.toLowerCase(),
            ),
          );
    return filtered
      .filter((m) => !hiddenKeys.has(m.conditionId))
      .map((m) => {
        const tags = (m.PolymarketMarketTags ?? [])
          .map((t) => t.PolymarketTag.slug)
          .filter(Boolean);
        const vol = Number(m.volume ?? 0);
        return {
          key: m.conditionId,
          title: m.title,
          slug: m.slug,
          icon: m.icon ?? undefined,
          category: tags[0],
          tags,
          volume: Number.isFinite(vol) ? vol : undefined,
          yesProb: m.yesProb,
        };
      });
  }, [query, searchResults, trending, active, hiddenKeys]);

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
