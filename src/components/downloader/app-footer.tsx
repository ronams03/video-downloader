import { ShieldCheck } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mt-auto w-full border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
        <p className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
          <span>
            <span className="font-medium text-foreground">PureDownload</span> — we never add a watermark to
            your downloaded files.
          </span>
        </p>
        <p className="text-xs">
          No account · Local-first · Private by design · Download only what you have permission to save
        </p>
      </div>
    </footer>
  );
}
