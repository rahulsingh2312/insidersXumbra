"use client";

import { useWallet } from "@solana/wallet-adapter-react";

const SEED_BALANCE_USD = 10_000;

export function useWalletBalance(): number {
  const { connected } = useWallet();
  return connected ? SEED_BALANCE_USD : 0;
}

export function fmtBalance(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(usd % 1_000_000 === 0 ? 0 : 2)}M`;
  if (usd >= 1_000) {
    const k = usd / 1_000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(2)}k`;
  }
  return `$${usd.toFixed(2)}`;
}
