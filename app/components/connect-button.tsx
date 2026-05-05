"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";
import { useModals } from "./modal-store";

type Variant = "primary" | "secondary" | "nav";

export default function ConnectButton({
  variant = "primary",
  className = "",
  ctaWhenConnected = "Deposit",
}: {
  variant?: Variant;
  className?: string;
  ctaWhenConnected?: string;
}) {
  const { connected, publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { openDeposit } = useModals();

  const short = useMemo(() => {
    if (!publicKey) return "";
    const s = publicKey.toBase58();
    return `${s.slice(0, 4)}…${s.slice(-4)}`;
  }, [publicKey]);

  const onClick = () => {
    if (connected) {
      openDeposit();
    } else {
      setVisible(true);
    }
  };

  const base =
    variant === "primary"
      ? "cta-primary inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold"
      : variant === "secondary"
      ? "cta-secondary inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold"
      : "inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 text-sm font-semibold text-black backdrop-blur-md transition hover:bg-white";

  return (
    <div className={variant === "nav" ? "flex items-center gap-2" : "flex items-center gap-2"}>
      <button type="button" onClick={onClick} className={`${base} ${className}`}>
        <WalletIcon className={variant === "nav" ? "h-4 w-4" : "h-5 w-5"} />
        {connecting
          ? "Connecting…"
          : connected && publicKey
          ? `${ctaWhenConnected} · ${short}`
          : variant === "nav"
          ? "Connect wallet"
          : "Connect wallet"}
        {connected && (
          <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            live
          </span>
        )}
      </button>
      {connected && variant !== "nav" && (
        <button
          type="button"
          onClick={() => disconnect()}
          aria-label="Disconnect"
          title="Disconnect"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/10 bg-white/70 text-black/60 backdrop-blur-md transition hover:bg-white hover:text-black"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M16 17l5-5-5-5M21 12H9" />
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          </svg>
        </button>
      )}
    </div>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H5a2 2 0 0 0 0 4h14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <circle cx="16" cy="13" r="1.2" fill="currentColor" />
    </svg>
  );
}
