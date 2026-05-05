/**
 * API clients for Polymarket Bridge + Insiders backend.
 *
 * Bridge docs: https://docs-polymarket.rahul.monster/api-reference/bridge/*
 * Real base:   https://bridge.polymarket.com
 *
 * Insiders backend: https://insiders-api.polyinsiders.com/api
 */

export const BRIDGE_BASE = "https://bridge.polymarket.com";
export const INSIDERS_BASE = "https://insiders-api.polyinsiders.com/api";

/* === Polymarket Bridge types === */

export type SupportedAsset = {
  chainId: string;
  chainName: string;
  tokenAddress: string;
  symbol: string;
  decimals: number;
  minimumDepositBaseUnit?: string;
  network?: "EVM" | "SVM" | "BTC";
};

export type QuoteRequest = {
  fromAmountBaseUnit: string;
  fromChainId: string;
  fromTokenAddress: string;
  recipientAddress: string;
  toChainId: string;
  toTokenAddress: string;
};

export type FeeBreakdown = {
  gasUsd: number;
  appFeeLabel?: string;
  appFeePercent?: number;
  appFeeUsd?: number;
  fillCostPercent?: number;
  fillCostUsd?: number;
};

export type QuoteResponse = {
  estCheckoutTimeMs: number;
  estInputUsd: number;
  estOutputUsd: number;
  estToTokenBaseUnit: string;
  quoteId: string;
  estFeeBreakdown: FeeBreakdown;
};

export type DepositAddresses = {
  evm?: string;
  svm?: string;
  btc?: string;
  // some implementations return chain-keyed map
  [chain: string]: string | undefined;
};

export type BridgeStatus =
  | "DEPOSIT_DETECTED"
  | "PROCESSING"
  | "ORIGIN_TX_CONFIRMED"
  | "SUBMITTED"
  | "COMPLETED"
  | "FAILED";

export type BridgeTransaction = {
  fromChainId: string;
  fromTokenAddress: string;
  fromAmountBaseUnit: string;
  toChainId: string;
  toTokenAddress: string;
  status: BridgeStatus;
  txHash?: string;
  createdTimeMs?: number;
};

/* === Bridge functions === */

export async function getSupportedAssets(): Promise<SupportedAsset[]> {
  const res = await fetch(`${BRIDGE_BASE}/supported-assets`);
  if (!res.ok) throw new Error(`supported-assets ${res.status}`);
  return res.json();
}

export async function getBridgeQuote(req: QuoteRequest): Promise<QuoteResponse> {
  const res = await fetch(`${BRIDGE_BASE}/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`quote ${res.status}`);
  return res.json();
}

export async function createDepositAddresses(
  recipientAddress: string,
): Promise<DepositAddresses> {
  const res = await fetch(`${BRIDGE_BASE}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: recipientAddress }),
  });
  if (!res.ok) throw new Error(`deposit ${res.status}`);
  return res.json();
}

export async function getBridgeStatus(
  depositAddress: string,
): Promise<{ transactions: BridgeTransaction[] }> {
  const res = await fetch(`${BRIDGE_BASE}/status/${depositAddress}`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

/* === Helpers === */

export const SOL_NATIVE = "11111111111111111111111111111111"; // Solana native (SOL)
export const USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // native USDC
export const PUSD_POLYGON = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB"; // pUSD
export const SOLANA_CHAIN_ID = "1399811149";
export const POLYGON_CHAIN_ID = "137";

export function fmtUsd(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function solToLamports(sol: number): string {
  return Math.floor(sol * 1e9).toString();
}

export function shortAddr(a: string | undefined, len = 4): string {
  if (!a) return "";
  return `${a.slice(0, len)}…${a.slice(-len)}`;
}
