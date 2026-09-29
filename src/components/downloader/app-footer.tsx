"use client";

import { useState } from "react";
import Image from "next/image";
import { Facebook, Github, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

/** Custom "black hat" icon (top-hat silhouette) — lucide has no built-in one. */
function BlackHatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {/* Crown */}
      <path d="M7.4 14.6V6.4C7.4 3.97 9.42 2 12 2s4.6 1.97 4.6 4.4v8.2a1 1 0 0 1-1 1H8.4a1 1 0 0 1-1-1Z" />
      {/* Brim */}
      <path d="M12 13.6c-5.25 0-9.5 1.34-9.5 3S6.75 19.9 12 19.9s9.5-1.64 9.5-3.3-4.25-3-9.5-3Zm0 4.5c-3.9 0-6.9-.95-6.9-1.5s3-1.5 6.9-1.5 6.9.95 6.9 1.5-3 1.5-6.9 1.5Z" />
    </svg>
  );
}

export function AppFooter() {
  const [devOpen, setDevOpen] = useState(false);

  return (
    <footer className="mt-auto w-full border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-4 py-5 text-center text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <p className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
          <span>
            <span className="font-medium text-foreground">PureDownload</span> — we never add a watermark to
            your downloaded files.
          </span>
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
          <p className="max-w-md text-xs leading-5">
            No account · Local-first · Private by design · Download only what you have permission to save
          </p>

          <Popover open={devOpen} onOpenChange={setDevOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                aria-label="Developer information"
                aria-expanded={devOpen}
              >
                <BlackHatIcon className="size-4" />
                Developer
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-64 p-4">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Image
                    src="/dev-avatar.png"
                    alt="Anime-style avatar of developer ROBERTH NAMOC"
                    width={44}
                    height={44}
                    className="size-11 rounded-full object-cover ring-2 ring-emerald-500/50"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background bg-emerald-500"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">ROBERTH NAMOC</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BlackHatIcon className="size-3" />
                    Developer
                  </p>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://facebook.com/ronams03"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="ROBERTH NAMOC on Facebook"
                  >
                    <Facebook className="size-4" aria-hidden="true" />
                    Facebook
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://github.com/ronams03"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="ROBERTH NAMOC on GitHub"
                  >
                    <Github className="size-4" aria-hidden="true" />
                    GitHub
                  </a>
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </footer>
  );
}
