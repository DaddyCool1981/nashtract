"use client";

import type { ReactNode } from "react";
import { Mark } from "./Mark";
import { RoleSwitch } from "./RoleSwitch";
import { useStore } from "@/lib/store";

export function AppShell({ children }: { children: ReactNode }) {
  const { resetDemo, project } = useStore();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[var(--maxw)] items-center justify-between px-[var(--pad)] py-4">
          <div className="flex items-center gap-2.5">
            <Mark className="h-5 w-5 text-accent" />
            <span className="text-sm font-semibold tracking-tight">NashTract</span>
            <span className="hidden text-xs text-ink-faint sm:inline">reference demo</span>
          </div>
          <div className="flex items-center gap-3">
            <RoleSwitch />
            {project ? (
              <button
                onClick={() => {
                  if (window.confirm("Reset the demo? This clears the local ledger.")) resetDemo();
                }}
                className="text-xs text-ink-faint transition-colors hover:text-danger"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[var(--maxw)] flex-1 px-[var(--pad)] py-10 sm:py-14">{children}</main>
      <footer className="border-t border-line-2">
        <div className="mx-auto flex max-w-[var(--maxw)] flex-col gap-3 px-[var(--pad)] py-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg">
            Experimental protocol. No honesty, trust, or competence scoring — bounded exposure is the mechanism, not
            judgment of the people using it.
          </p>
          <a
            href="https://ytechnology.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-ink-faint transition-colors hover:text-ink"
          >
            Built by Cyrille Lecroq — Y Technology
          </a>
        </div>
      </footer>
    </div>
  );
}
