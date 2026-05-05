export default function HowItWorks() {
  return (
    <section id="how" className="relative px-4 py-20 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-14">
        <header className="flex max-w-2xl flex-col items-center gap-3 text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="heading-display text-4xl sm:text-5xl">
            Three steps. Zero footprint.
          </h2>
          <p className="text-lg text-muted">
            Send SOL → we privatize it via Umbra → fill across hundreds of
            wallets → sweep your winnings home.
          </p>
        </header>

        <ol className="grid w-full grid-cols-1 gap-5 md:grid-cols-3">
          <Step
            n="01"
            title="Connect & deposit SOL"
            body="Solana wallet adapter, Phantom, Backpack, Solflare. Drop in the size you want to bet. We never custody your keys."
            visual={<DepositVisual />}
          />
          <Step
            n="02"
            title="Privatize via Umbra SDK"
            body="SOL gets bridged through Umbra's stealth address protocol and split across hundreds of unlinked wallets. Then bridged to USDC on Polygon to trade Polymarket."
            visual={<DiversifyVisual />}
          />
          <Step
            n="03"
            title="Fill the book, sweep home"
            body="Each wallet picks the best price-time on the YES/NO ladder. Tiny clips, randomized timing. On resolution, every wallet sweeps back to you."
            visual={<AggregateVisual />}
          />
        </ol>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  body,
  visual,
}: {
  n: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}) {
  return (
    <li className="card flex flex-col gap-4 overflow-hidden p-5">
      <div className="relative h-36 overflow-hidden rounded-xl bg-[radial-gradient(120%_120%_at_50%_0%,#eaf6ff_0%,#ffffff_70%)] ring-1 ring-border">
        {visual}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-primary-strong">{n}</span>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </li>
  );
}

function DepositVisual() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <svg viewBox="0 0 200 120" className="h-full w-full">
        <defs>
          <linearGradient id="sol2" x1="0" y1="0" x2="200" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9945FF" />
            <stop offset="1" stopColor="#14F195" />
          </linearGradient>
        </defs>
        <rect x="60" y="30" width="80" height="60" rx="12" fill="url(#sol2)" opacity="0.18" />
        <rect x="60" y="30" width="80" height="60" rx="12" stroke="url(#sol2)" strokeWidth="1.5" fill="none" />
        <path d="M75 50h50M75 60h35M75 70h45" stroke="#9945FF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <circle cx="100" cy="100" r="3" fill="#00b3ff" />
        <path d="M100 90v8" stroke="#00b3ff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function DiversifyVisual() {
  const wallets = Array.from({ length: 16 });
  return (
    <div className="absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 144" fill="none">
        {wallets.map((_, i) => {
          const angle = (i / wallets.length) * Math.PI * 2;
          const r = 50 + (i % 3) * 6;
          const x = 160 + Math.cos(angle) * r;
          const y = 72 + Math.sin(angle) * r * 0.55;
          return (
            <line key={i} x1="160" y1="72" x2={x} y2={y}
              stroke="#00b3ff" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 3" />
          );
        })}
        <circle cx="160" cy="72" r="12" fill="#00b3ff" />
        <circle cx="160" cy="72" r="20" stroke="#00b3ff" strokeOpacity="0.3" />
        {wallets.map((_, i) => {
          const angle = (i / wallets.length) * Math.PI * 2;
          const r = 50 + (i % 3) * 6;
          const x = 160 + Math.cos(angle) * r;
          const y = 72 + Math.sin(angle) * r * 0.55;
          return <circle key={`c${i}`} cx={x} cy={y} r="2.5" fill="#0082f3" />;
        })}
      </svg>
    </div>
  );
}

function AggregateVisual() {
  const points = [
    { x: 40, y: 30 }, { x: 80, y: 26 }, { x: 120, y: 44 },
    { x: 36, y: 90 }, { x: 90, y: 110 }, { x: 200, y: 30 },
    { x: 250, y: 50 }, { x: 240, y: 110 }, { x: 280, y: 90 },
  ];
  return (
    <div className="absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 144">
        {points.map((p, i) => (
          <line key={i} x1={p.x} y1={p.y} x2="160" y2="72" stroke="#00b3ff" strokeOpacity="0.4" strokeWidth="1" />
        ))}
        {points.map((p, i) => (
          <circle key={`c${i}`} cx={p.x} cy={p.y} r="2.5" fill="#0082f3" opacity="0.85" />
        ))}
        <circle cx="160" cy="72" r="16" fill="#ffffff" stroke="#00b3ff" strokeWidth="2" />
        <path d="M154 72l5 5 8-9" stroke="#00b3ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}
