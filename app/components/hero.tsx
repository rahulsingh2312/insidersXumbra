"use client";

import Link from "next/link";
import ConnectButton from "./connect-button";

export default function Hero() {
  return (
    <section className="p-2 sm:p-3">
      <div className="sky relative flex min-h-[100svh] sm:min-h-[96svh] flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl px-4 py-6 sm:px-10 sm:py-8">
        <Clouds />
        {/* Top nav */}
        <header className="relative z-10 flex w-full max-w-7xl items-center justify-between">
          <Link href="/" aria-label="Insiders.bot" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-light.svg"
              alt="Insiders.bot"
              className="h-6 w-auto object-contain sm:h-7"
            />
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#markets" className="text-sm font-medium text-black/60 transition hover:text-black">
              Markets
            </a>
            <a href="#portfolio" className="text-sm font-medium text-black/60 transition hover:text-black">
              Portfolio
            </a>
            <a href="#how" className="text-sm font-medium text-black/60 transition hover:text-black">
              How it works
            </a>
            <a
              href="https://www.umbraprivacy.com/"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-black/60 transition hover:text-black"
            >
              Built on Umbra ↗
            </a>
          </nav>
          <div className="hidden md:block">
            <ConnectButton variant="nav" />
          </div>
        </header>

        {/* Center heading */}
        <div className="relative z-10 flex flex-col items-center gap-7 text-center">
          <div className="pill-v2 md:px-5 px-1 inline-flex items-stretch overflow-hidden rounded-full text-[13px] font-semibold tracking-tight">
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
            <span className="self-stretch w-px bg-black/10" />
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-[#0b0c0f]">
              Polymarket
            </span>
            <span className="self-stretch w-px bg-black/10" />
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-[#0082f3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#00b3ff]/15">
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
                </svg>
              </span>
              Umbra privacy
            </span>
          </div>

          <h1 className="heading-display max-w-5xl text-[14vw] sm:text-[10vw] md:text-[8vw] lg:text-[112px] xl:text-[128px]">
            Incognito Mode
            <br />
            for your Bets
          </h1>

          <p className="max-w-xl text-balance text-base sm:text-lg text-black/65">
            Trade Polymarket privately. Insiders splits your size across hundreds
            of stealth wallets via Umbra, fills the best of the order book, then
            sweeps your winnings home without ever moving the chart.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <ConnectButton variant="primary" />
            <a
              href="#markets"
              className="cta-secondary inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold"
            >
              Browse markets
            </a>
          </div>
        </div>

        {/* Bottom hint */}
        <div className="relative z-10 flex w-full max-w-6xl items-center justify-between gap-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">
          <div className="hidden items-center gap-3 sm:flex">
            <BottomTag>Untraceable size</BottomTag>
            <span className="h-3 w-px bg-black/15" />
            <BottomTag>Best-of-book fills</BottomTag>
            <span className="h-3 w-px bg-black/15" />
            <BottomTag>Self-custody</BottomTag>
          </div>
          <a href="#markets" className="flex items-center gap-1.5 transition hover:text-black">
            Browse markets
            <span aria-hidden className="animate-bounce">↓</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function BottomTag({ children }: { children: React.ReactNode }) {
  return <span className="text-black/55">{children}</span>;
}

function Clouds() {
  // each cloud = a positioned div with multiple radial-gradient blobs, blurred
  // for a puffy photographic feel. Pure CSS so it always renders.
  const clouds: { style: React.CSSProperties; opacity: number }[] = [
    // top-left big
    { style: { top: "8%", left: "-6%", width: "44%", height: "26%" }, opacity: 1 },
    // top-right big
    { style: { top: "6%", right: "-8%", width: "46%", height: "28%" }, opacity: 1 },
    // mid-left small
    { style: { top: "32%", left: "-3%", width: "26%", height: "16%" }, opacity: 0.85 },
    // mid-right small
    { style: { top: "30%", right: "-4%", width: "30%", height: "18%" }, opacity: 0.85 },
    // bottom-left huge
    { style: { bottom: "8%", left: "-12%", width: "60%", height: "34%" }, opacity: 1 },
    // bottom-right huge
    { style: { bottom: "4%", right: "-12%", width: "58%", height: "36%" }, opacity: 1 },
    // mid-center wisp
    { style: { top: "55%", left: "30%", width: "40%", height: "16%" }, opacity: 0.7 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {clouds.map((c, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            ...c.style,
            opacity: c.opacity,
            filter: "blur(28px)",
            background: `
              radial-gradient(50% 60% at 30% 50%, #ffffff 0%, rgba(255,255,255,0.9) 35%, rgba(255,255,255,0) 75%),
              radial-gradient(40% 55% at 60% 45%, #ffffff 0%, rgba(255,255,255,0.85) 35%, rgba(255,255,255,0) 75%),
              radial-gradient(35% 50% at 80% 55%, #ffffff 0%, rgba(255,255,255,0.8) 35%, rgba(255,255,255,0) 75%),
              radial-gradient(30% 40% at 15% 60%, #ffffff 0%, rgba(255,255,255,0.7) 35%, rgba(255,255,255,0) 75%)
            `,
          }}
        />
      ))}
      {/* faint atmospheric haze under the heading */}
      <div className="absolute left-1/2 top-[44%] h-44 w-[85%] -translate-x-1/2 rounded-full bg-white/45 blur-3xl" />
    </div>
  );
}

