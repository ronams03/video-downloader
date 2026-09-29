"use client";

import { useSyncExternalStore } from "react";
import { Crown, HardDrive, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import type { StorageInfo } from "@/lib/types";

const emptySubscribe = () => () => {};

/** Custom PureDownload brand mark — matches /icon.svg (favicon). */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="pd-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#pd-bg)" />
      <path d="M30 13v20" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M20 26l10 10 10-10" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 50h26" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M49 8l1.8 5.2L56 15l-5.2 1.8L49 22l-1.8-5.2L42 15l5.2-1.8Z" fill="#fff" opacity="0.92" />
    </svg>
  );
}

/** Hydration-safe `mounted` flag: false during SSR + hydration, true after. */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // `resolvedTheme` is only known on the client. Render a stable, theme-independent
  // output until after hydration so the server HTML always matches the first
  // client render (prevents the aria-label hydration mismatch).
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </Button>
  );
}

export function AppHeader({
  storage,
  premium,
}: {
  storage: StorageInfo | null;
  premium: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="size-8 shrink-0 drop-shadow-sm" />
          <span className="truncate font-semibold tracking-tight">PureDownload</span>
          <Badge
            variant="outline"
            className="hidden border-emerald-500/40 text-emerald-600 dark:text-emerald-400 sm:inline-flex"
          >
            No added watermarks
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {storage && (
            <span
              className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground md:inline-flex"
              title="Simulated device storage used by your library"
            >
              <HardDrive className="size-3.5" aria-hidden />
              {formatBytes(storage.usedBytes)} / {formatBytes(storage.totalBytes)}
            </span>
          )}
          {premium && (
            <Badge className="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" variant="outline">
              <Crown className="size-3" aria-hidden /> Premium
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
