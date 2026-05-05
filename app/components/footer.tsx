import ConnectButton from "./connect-button";

export default function Footer() {
  return (
    <footer className="px-4 pb-10 pt-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="sky relative overflow-hidden rounded-3xl px-6 py-14 sm:px-12">
          <div className="relative z-10 flex flex-col items-center gap-5 text-center">
            <span className="pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
              Powered by Umbra · Live on Polymarket
            </span>
            <h2 className="heading-display max-w-2xl text-4xl sm:text-5xl">
              Move size. Leave no trace.
            </h2>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <ConnectButton variant="primary" />
              <a
                href="https://sdk.umbraprivacy.com/introduction"
                target="_blank"
                rel="noreferrer"
                className="cta-secondary inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold"
              >
                Read Umbra docs ↗
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mask.png" alt="Insiders" className="h-5 w-5 object-contain" />
            <span>Incognito mode for your bets</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="https://x.com/" className="hover:text-foreground">X / Twitter</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
