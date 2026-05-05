"use client";

import { useEffect } from "react";

export default function Dialog({
  open,
  onClose,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center px-4 py-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[#03101e]/40 backdrop-blur-sm"
      />
      <div
        className={`relative z-10 w-full ${widthClass} rounded-3xl border border-black/10 bg-white p-1 shadow-[0_40px_80px_-20px_rgba(2,32,71,0.45)]`}
      >
        <div className="rounded-[20px] bg-[radial-gradient(120%_60%_at_50%_0%,#eaf6ff_0%,#ffffff_55%)] p-6 sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}

export function DialogClose({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-black/60 transition hover:bg-black/10 hover:text-black"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
  );
}
