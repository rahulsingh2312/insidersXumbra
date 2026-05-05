"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import ModalProvider from "./modal-store";
import PortfolioProvider from "./portfolio-store";

import "@solana/wallet-adapter-react-ui/styles.css";

const NETWORK = "mainnet-beta" as const;

export default function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);
  // Wallet adapters auto-detect installed wallets via the Wallet Standard
  // (Phantom, Backpack, Solflare, etc.) — no need to enumerate.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <PortfolioProvider>
            <ModalProvider>{children}</ModalProvider>
          </PortfolioProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
