"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import DepositModal from "./deposit-modal";
import BuyModal, { type BuyTarget } from "./buy-modal";

type ModalCtx = {
  openDeposit: () => void;
  openBuy: (target: BuyTarget) => void;
};

const Ctx = createContext<ModalCtx | null>(null);

export function useModals(): ModalCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useModals must be inside <ModalProvider>");
  return v;
}

export default function ModalProvider({ children }: { children: React.ReactNode }) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [buyTarget, setBuyTarget] = useState<BuyTarget | null>(null);

  const openDeposit = useCallback(() => setDepositOpen(true), []);
  const openBuy = useCallback((t: BuyTarget) => setBuyTarget(t), []);

  const value = useMemo(() => ({ openDeposit, openBuy }), [openDeposit, openBuy]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      <BuyModal
        open={!!buyTarget}
        target={buyTarget}
        onClose={() => setBuyTarget(null)}
      />
    </Ctx.Provider>
  );
}
