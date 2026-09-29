"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, FolderOpen, Settings, Download } from "lucide-react";
import { toast } from "sonner";
import { AppFooter } from "@/components/downloader/app-footer";
import { AppHeader } from "@/components/downloader/app-header";
import { DownloadsPanel } from "@/components/downloader/downloads-panel";
import { HeroAnalyzer } from "@/components/downloader/hero-analyzer";
import { SettingsPanel } from "@/components/downloader/settings-panel";
import { HistoryPanel } from "@/components/downloader/history-panel";
import { FilesPanel } from "@/components/downloader/files-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppSettings, DownloadJobDTO, StorageInfo } from "@/lib/types";

type TabValue = "downloads" | "history" | "files" | "settings";

interface DownloadsResponse {
  jobs: DownloadJobDTO[];
  concurrency: number;
  premium: boolean;
  events?: { completed: string[]; failed: Array<{ title: string; message: string }> };
}

export default function Home() {
  const [tab, setTab] = useState<TabValue>("downloads");
  const [jobs, setJobs] = useState<DownloadJobDTO[]>([]);
  const [concurrency, setConcurrency] = useState(2);
  const [premium, setPremium] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [libraryRefresh, setLibraryRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const jobsRef = useRef<DownloadJobDTO[]>([]);

  const refreshStorage = useCallback(async () => {
    try {
      const res = await fetch("/api/storage");
      const data = await res.json();
      if (res.ok) setStorage(data.storage as StorageInfo);
    } catch {
      /* polling error — ignore */
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings as AppSettings);
        setPremium(Boolean((data.settings as AppSettings).premium));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const pollJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/downloads");
      if (!res.ok) return;
      const data = (await res.json()) as DownloadsResponse;
      const hadErrors = (data.events?.failed.length ?? 0) > 0;
      const completed = data.events?.completed ?? [];
      const failed = data.events?.failed ?? [];
      setJobs(data.jobs);
      setConcurrency(data.concurrency);
      setPremium(data.premium);
      jobsRef.current = data.jobs;

      for (const title of completed) {
        toast.success("Download complete", {
          description: `“${title}” is ready in your Files.`,
        });
      }
      for (const f of failed) {
        toast.error("Download failed", {
          description: `${f.title} — tap retry in the queue to resume.`,
        });
      }
      if (completed.length > 0 || hadErrors) {
        void refreshStorage();
        if (completed.length > 0) {
          setLibraryRefresh((n) => n + 1);
          setHistoryRefresh((n) => n + 1);
        }
        if (hadErrors) setHistoryRefresh((n) => n + 1);
      }
    } catch {
      /* polling error — ignore */
    }
  }, [refreshStorage]);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void refreshStorage();
      void refreshSettings();
    }, 0);
    return () => clearTimeout(kickoff);
  }, [refreshStorage, refreshSettings]);

  useEffect(() => {
    const first = setTimeout(() => void pollJobs(), 0);
    const interval = setInterval(() => {
      void pollJobs();
    }, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [pollJobs]);

  const handleAction = useCallback(
    async (id: string, action: "pause" | "resume" | "cancel" | "retry") => {
      try {
        const res = await fetch(`/api/downloads/${id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.message ?? "Action failed.");
          return;
        }
        if (action === "cancel") {
          toast("Download canceled", {
            description: "You can redownload it later from History.",
          });
          setHistoryRefresh((n) => n + 1);
        }
        void pollJobs();
        void refreshStorage();
      } catch {
        toast.error("Network error — please try again.");
      }
    },
    [pollJobs, refreshStorage],
  );

  const handleSaveSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partial),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? "Could not save settings.");
          return;
        }
        setSettings(data.settings as AppSettings);
        setPremium(Boolean((data.settings as AppSettings).premium));
        if (partial.premium !== undefined) {
          toast.success(
            partial.premium ? "Premium enabled — enjoy 4× parallel downloads" : "Switched back to the Free plan",
          );
        } else {
          toast.success("Settings saved");
        }
        void pollJobs();
      } catch {
        toast.error("Network error — please try again.");
      }
    },
    [pollJobs],
  );

  const activeCount = jobs.length;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader storage={storage} premium={premium} />

      <main className="w-full flex-1">
        <div className="mx-auto w-full max-w-5xl px-4">
          <HeroAnalyzer
            premium={premium}
            onQueued={() => {
              setTab("downloads");
              void pollJobs();
              void refreshStorage();
            }}
          />

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TabValue)}
            className="mt-2"
          >
            <TabsList className="mx-auto grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="downloads" className="gap-1.5">
                <Download className="size-4 sm:hidden" aria-hidden />
                <span className="sm:hidden">{activeCount || ""}</span>
                <span className="hidden sm:inline">Downloads</span>
                {activeCount > 0 && (
                  <span className="hidden sm:inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <Clock className="size-4 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5">
                <FolderOpen className="size-4 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">Files</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings className="size-4 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {tab === "downloads" && (
                    <DownloadsPanel
                      jobs={jobs}
                      concurrency={concurrency}
                      premium={premium}
                      onAction={(id, action) => void handleAction(id, action)}
                    />
                  )}
                  {tab === "history" && (
                    <HistoryPanel
                      key={`history-${historyRefresh}`}
                      onRedownload={() => {
                        setTab("downloads");
                        void pollJobs();
                      }}
                    />
                  )}
                  {tab === "files" && (
                    <FilesPanel key={`files-${libraryRefresh}`} onChanged={() => void refreshStorage()} />
                  )}
                  {tab === "settings" && (
                    <SettingsPanel settings={settings} storage={storage} onSave={(p) => void handleSaveSettings(p)} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </Tabs>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
