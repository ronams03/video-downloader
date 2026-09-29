"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Folder,
  FolderOpen,
  Inbox,
  LayoutGrid,
  Link2,
  Loader2,
  MoreVertical,
  Music,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  Trash2,
  Film,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDuration, timeAgo } from "@/lib/format";
import { saveFileFromUrl } from "@/lib/save-file";
import type { FileDTO, FolderDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? "Something went wrong");
  return data as T;
}

type CategoryKey = "all" | "videos" | "audio" | "favorites";
type SortKey = "name" | "date" | "size";
type FolderFilter = "all" | "root" | (string & {});

const CATEGORIES: { key: CategoryKey; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "All files", icon: LayoutGrid },
  { key: "videos", label: "Videos", icon: Film },
  { key: "audio", label: "Audio", icon: Music },
  { key: "favorites", label: "Favorites", icon: Star },
];

function gradientStyle(hue: number): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 30%))`,
  };
}

export function FilesPanel({ onChanged }: { onChanged?: () => void }) {
  const [files, setFiles] = useState<FileDTO[]>([]);
  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [folderId, setFolderId] = useState<FolderFilter>("all");
  const [sort, setSort] = useState<SortKey>("date");

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [renameTarget, setRenameTarget] = useState<FileDTO | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [playing, setPlaying] = useState<FileDTO | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleSave = useCallback(async (file: FileDTO) => {
    setSavingId(file.id);
    try {
      const outcome = await saveFileFromUrl(`${file.streamUrl}?dl=1`, file.name);
      if (outcome === "saved") {
        toast.success("Saved to your device", {
          description: `${file.name} — check your browser's downloads.`,
        });
      } else {
        toast.info("Opened the file in a new tab", {
          description: "If the download didn't start, allow downloads/pop-ups for this site.",
        });
      }
    } finally {
      setSavingId((current) => (current === file.id ? null : current));
    }
  }, []);

  const [fileToDelete, setFileToDelete] = useState<FileDTO | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);

  const [folderToDelete, setFolderToDelete] = useState<FolderDTO | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  const requestIdRef = useRef(0);

  // Debounce the search input (~300ms) before hitting the API.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchFiles = useCallback(
    async (options?: { silent?: boolean }) => {
      const requestId = ++requestIdRef.current;
      if (!options?.silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          category,
          folderId,
          sort,
          search: debouncedSearch,
        });
        const res = await fetch(`/api/files?${params.toString()}`);
        const data = await asJson<{ files: FileDTO[]; folders: FolderDTO[] }>(res);
        if (requestId !== requestIdRef.current) return; // a newer request superseded this one
        setFiles(data.files);
        setFolders(data.folders);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        toast.error((err as Error).message || "Failed to load files");
      } finally {
        if (requestId === requestIdRef.current && !options?.silent) setLoading(false);
      }
    },
    [category, folderId, sort, debouncedSearch],
  );

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  const refresh = useCallback(() => {
    void fetchFiles({ silent: true });
  }, [fetchFiles]);

  const folderNameById = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);

  const folderLabelFor = useCallback(
    (file: FileDTO): string => file.folderName ?? (file.folderId ? folderNameById.get(file.folderId) : undefined) ?? "Unsorted",
    [folderNameById],
  );

  async function toggleFavorite(file: FileDTO) {
    try {
      await asJson<{ file: FileDTO }>(
        await fetch(`/api/files/${file.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorite: !file.favorite }),
        }),
      );
      refresh();
    } catch (err) {
      toast.error((err as Error).message || "Could not update favorite");
    }
  }

  async function handleRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setRenaming(true);
    try {
      await asJson<{ file: FileDTO }>(
        await fetch(`/api/files/${renameTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      toast.success("File renamed");
      setRenameTarget(null);
      refresh();
    } catch (err) {
      toast.error((err as Error).message || "Could not rename file");
    } finally {
      setRenaming(false);
    }
  }

  async function moveToFolder(file: FileDTO, target: string) {
    const value = target === "root" ? null : target;
    if (value === file.folderId) return;
    try {
      await asJson<{ file: FileDTO }>(
        await fetch(`/api/files/${file.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: value }),
        }),
      );
      toast.success(value ? `Moved to "${folderNameById.get(value) ?? "folder"}"` : "Moved to Unsorted");
      refresh();
    } catch (err) {
      toast.error((err as Error).message || "Could not move file");
    }
  }

  function copySourceLink(file: FileDTO) {
    navigator.clipboard
      .writeText(file.sourceUrl)
      .then(() => toast.success("Source link copied"))
      .catch(() => toast.error("Could not copy link"));
  }

  async function handleDeleteFile() {
    if (!fileToDelete) return;
    setDeletingFile(true);
    try {
      await asJson<{ ok: boolean }>(await fetch(`/api/files/${fileToDelete.id}`, { method: "DELETE" }));
      toast.success("File deleted");
      setFileToDelete(null);
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not delete file");
    } finally {
      setDeletingFile(false);
    }
  }

  async function handleCreateFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    try {
      await asJson<{ folder: FolderDTO }>(
        await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      toast.success(`Folder "${name}" created`);
      setNewFolderOpen(false);
      setNewFolderName("");
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not create folder");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteFolder() {
    if (!folderToDelete) return;
    setDeletingFolder(true);
    try {
      await asJson<{ ok: boolean }>(await fetch(`/api/folders/${folderToDelete.id}`, { method: "DELETE" }));
      toast.success(`Folder "${folderToDelete.name}" deleted`);
      if (folderId === folderToDelete.id) setFolderId("all");
      setFolderToDelete(null);
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message || "Could not delete folder");
    } finally {
      setDeletingFolder(false);
    }
  }

  const folderChips: { key: FolderFilter; label: string; icon: LucideIcon; count: number | null; deletable: boolean }[] = [
    { key: "all", label: "All files", icon: FolderOpen, count: null, deletable: false },
    { key: "root", label: "Unsorted", icon: Inbox, count: null, deletable: false },
    ...folders.map((f) => ({ key: f.id, label: f.name, icon: Folder, count: f.fileCount, deletable: true })),
  ];

  const hasFilters = Boolean(debouncedSearch) || category !== "all" || folderId !== "all";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            aria-label="Search files"
            className="h-11 pl-9 pr-9 sm:h-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger aria-label="Sort files" className="h-11 flex-1 sm:h-9 sm:w-[150px] sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="date">Newest</SelectItem>
              <SelectItem value="size">Largest</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setNewFolderOpen(true)} className="h-11 flex-1 sm:h-9 sm:flex-none">
            <Plus className="size-4" aria-hidden="true" />
            New folder
          </Button>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="File categories">
        {CATEGORIES.map((cat) => {
          const active = category === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors sm:h-9",
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <cat.icon className="size-4" aria-hidden="true" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Folder sidebar + files grid */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <nav aria-label="Folders" className="min-w-0 lg:w-[200px] lg:shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {folderChips.map((chip) => {
              const active = folderId === chip.key;
              return (
                <div key={chip.key} className="group relative shrink-0 lg:w-full">
                  <button
                    type="button"
                    onClick={() => setFolderId(chip.key)}
                    aria-pressed={active}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors lg:h-9 lg:w-full lg:rounded-lg lg:px-2.5",
                      chip.deletable ? "pr-2 lg:pr-14" : "pr-3 lg:pr-2.5",
                      active
                        ? "border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400"
                        : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <chip.icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="max-w-40 truncate lg:max-w-none">{chip.label}</span>
                    {chip.count != null && (
                      <span className="ml-1 shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground lg:ml-auto">
                        {chip.count}
                      </span>
                    )}
                  </button>
                  {chip.deletable && (
                    <button
                      type="button"
                      onClick={() => setFolderToDelete(folders.find((f) => f.id === chip.key) ?? null)}
                      aria-label={`Delete folder ${chip.label}`}
                      className="absolute right-0.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground opacity-40 transition-opacity hover:bg-accent/50 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 lg:right-1"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="rounded-xl border-border p-4">
                  <Skeleton className="aspect-video w-full rounded-md" />
                  <Skeleton className="mt-3 h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </Card>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <FolderOpen className="size-7 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-medium">
                {hasFilters ? "No files match your filters." : "No files here yet — downloads will appear in this library."}
              </p>
              {!hasFilters && (
                <p className="mt-1 max-w-60 text-xs text-muted-foreground">
                  Finished downloads are saved here automatically.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  folders={folders}
                  folderLabel={folderLabelFor(file)}
                  onPlay={() => setPlaying(file)}
                  onRename={() => {
                    setRenameTarget(file);
                    setRenameValue(file.name);
                  }}
                  onToggleFavorite={() => void toggleFavorite(file)}
                  onMove={(target) => void moveToFolder(file, target)}
                  onCopyLink={() => copySourceLink(file)}
                  onDelete={() => setFileToDelete(file)}
                  onSave={() => void handleSave(file)}
                  saving={savingId === file.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New folder dialog */}
      <Dialog
        open={newFolderOpen}
        onOpenChange={(open) => {
          setNewFolderOpen(open);
          if (!open) setNewFolderName("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>Create a virtual folder to organize your library.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreateFolder(e)} className="space-y-4">
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              maxLength={60}
              aria-label="Folder name"
            />
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setNewFolderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newFolderName.trim() || creatingFolder} className="h-11 sm:h-9">
                {creatingFolder ? "Creating…" : "Create folder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>Choose a new name for this file.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleRename()} className="space-y-4">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="File name"
              maxLength={200}
              aria-label="File name"
            />
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renaming} className="h-11 sm:h-9">
                {renaming ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete file confirmation */}
      <AlertDialog
        open={fileToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setFileToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{fileToDelete?.name}&rdquo; will be permanently removed from this device. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFile}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingFile}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFile();
              }}
            >
              {deletingFile ? "Deleting…" : "Delete file"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder confirmation */}
      <AlertDialog
        open={folderToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setFolderToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder &ldquo;{folderToDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Files inside are kept and moved to Unsorted. The folder itself will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFolder}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingFolder}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFolder();
              }}
            >
              {deletingFolder ? "Deleting…" : "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Player dialog */}
      <Dialog
        open={playing !== null}
        onOpenChange={(open) => {
          if (!open) setPlaying(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          {playing && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-6">{playing.name}</DialogTitle>
              </DialogHeader>
              {playing.kind === "video" ? (
                <video
                  key={playing.id}
                  src={playing.streamUrl}
                  controls
                  autoPlay
                  playsInline
                  className="aspect-video w-full rounded-lg bg-black"
                />
              ) : (
                <div className="space-y-3">
                  <div
                    className="flex aspect-video w-full items-center justify-center rounded-lg"
                    style={gradientStyle(playing.hue)}
                  >
                    <Music className="size-14 text-white/85" aria-hidden="true" />
                  </div>
                  <audio key={playing.id} src={playing.streamUrl} controls autoPlay className="w-full" />
                </div>
              )}
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => void handleSave(playing)}>
                  <Download className="size-4" aria-hidden="true" />
                  Save to device
                </Button>
              </div>
              <DialogDescription className="text-center text-xs text-muted-foreground">
                Playing your local copy — no added watermarks, ever.
              </DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileCard({
  file,
  folders,
  folderLabel,
  onPlay,
  onRename,
  onToggleFavorite,
  onMove,
  onCopyLink,
  onDelete,
  onSave,
  saving,
}: {
  file: FileDTO;
  folders: FolderDTO[];
  folderLabel: string;
  onPlay: () => void;
  onRename: () => void;
  onToggleFavorite: () => void;
  onMove: (target: string) => void;
  onCopyLink: () => void;
  onDelete: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Card className="rounded-xl border-border p-4 transition-colors hover:bg-accent/50">
      <div className="relative overflow-hidden rounded-md">
        {file.kind === "video" ? (
          <img
            src={`/thumbs/thumb-${file.thumbKey}.jpg`}
            alt={file.name}
            loading="lazy"
            className="aspect-video w-full rounded-md object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-md" style={gradientStyle(file.hue)}>
            <Music className="size-9 text-white/85" aria-hidden="true" />
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {formatDuration(file.durationSec)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFavorite}
          aria-label={file.favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={file.favorite}
          className="absolute right-1.5 top-1.5 size-11 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white sm:size-9"
        >
          <Star className={cn("size-4", file.favorite && "fill-amber-400 text-amber-400")} aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={`${formatBytes(file.sizeBytes)} · ${file.quality} · ${folderLabel}`}>
            {formatBytes(file.sizeBytes)} · {file.quality} · {folderLabel} · {timeAgo(file.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSave}
            disabled={saving}
            aria-label={`Save ${file.name} to device`}
            className="size-11 text-muted-foreground hover:text-foreground sm:size-9"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="File actions"
                className="size-11 text-muted-foreground sm:size-9"
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={onPlay}>
                <Play aria-hidden="true" />
                Play
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onRename}>
                <Pencil aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Folder aria-hidden="true" />
                  Move to folder
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                  <DropdownMenuRadioGroup value={file.folderId ?? "root"} onValueChange={onMove}>
                    <DropdownMenuRadioItem value="root">Unsorted</DropdownMenuRadioItem>
                    {folders.map((folder) => (
                      <DropdownMenuRadioItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCopyLink}>
                <Link2 aria-hidden="true" />
                Copy source link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSave}>
                <Download aria-hidden="true" />
                Save to device
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
