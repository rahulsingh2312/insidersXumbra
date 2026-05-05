"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type Position = {
  id: string;
  marketTitle: string;
  marketIcon?: string;
  outcome: "Yes" | "No";
  shares: number;
  avgPrice: number; // 0..1, what we paid per share
  size: number; // USD invested
  walletCount: number;
  createdAt: number; // ms
  // current price is a live concept; we mark-to-market client-side by drifting slightly
  currentPrice?: number;
  // status — open while live, closed when user sells, settled when market resolves
  status: "open" | "closed" | "settled";
  payout?: number; // USD realised on close/settle
};

type Ctx = {
  positions: Position[];
  addPosition: (p: Omit<Position, "id" | "createdAt" | "status" | "currentPrice">) => void;
  closePosition: (id: string, exitPrice: number) => void;
  totals: {
    invested: number;
    value: number;
    pnl: number;
    pnlPct: number;
    open: number;
    stealthWallets: number;
  };
};

const PortfolioCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "insiders.positions.v1";

export function usePortfolio(): Ctx {
  const v = useContext(PortfolioCtx);
  if (!v) throw new Error("usePortfolio must be inside <PortfolioProvider>");
  return v;
}

export default function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [positions, setPositions] = useState<Position[]>([]);
  const hydrated = useRef(false);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPositions(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // persist
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch {
      /* ignore */
    }
  }, [positions]);

  // gentle mark-to-market drift on open positions every 4s (visual only)
  useEffect(() => {
    const id = setInterval(() => {
      setPositions((prev) =>
        prev.map((p) => {
          if (p.status !== "open") return p;
          const cur = p.currentPrice ?? p.avgPrice;
          // small random walk, clamped to [0.02, 0.98]
          const next = Math.max(0.02, Math.min(0.98, cur + (Math.random() - 0.5) * 0.012));
          return { ...p, currentPrice: next };
        }),
      );
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const addPosition: Ctx["addPosition"] = useCallback((p) => {
    setPositions((prev) => [
      {
        ...p,
        id: `pos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        status: "open",
        currentPrice: p.avgPrice,
      },
      ...prev,
    ]);
  }, []);

  const closePosition = useCallback((id: string, exitPrice: number) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "closed",
              currentPrice: exitPrice,
              payout: p.shares * exitPrice,
            }
          : p,
      ),
    );
  }, []);

  const totals = useMemo(() => {
    let invested = 0;
    let value = 0;
    let open = 0;
    let stealthWallets = 0;
    for (const p of positions) {
      if (p.status === "open") {
        invested += p.size;
        value += p.shares * (p.currentPrice ?? p.avgPrice);
        open += 1;
        stealthWallets += p.walletCount;
      }
    }
    const pnl = value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    return { invested, value, pnl, pnlPct, open, stealthWallets };
  }, [positions]);

  const ctx = useMemo<Ctx>(
    () => ({ positions, addPosition, closePosition, totals }),
    [positions, addPosition, closePosition, totals],
  );

  return <PortfolioCtx.Provider value={ctx}>{children}</PortfolioCtx.Provider>;
}
