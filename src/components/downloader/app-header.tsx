"use client";

import { Crown, Download, HardDrive, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import type { StorageInfo } from "@/lib/types";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
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
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <Download className="size-4 text-white" aria-hidden />
          </div>
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
