// In-memory, PrismaClient-shaped data layer for ephemeral runtimes.
//
// Serverless platforms like Vercel have a read-only filesystem: SQLite files
// cannot be created or written there, so every Prisma query would throw and
// the app would fail with "Could not add these downloads to the queue."
//
// This module implements the exact subset of Prisma operations the app uses
// (see schema.prisma + src/lib/engine.ts + API routes) against plain Maps, so
// the deployed demo runs with zero configuration. Data lives for the lifetime
// of the serverless instance (ephemeral demo mode).

// ---------------------------------------------------------------------------
// Row shapes mirroring prisma/schema.prisma (DateTime fields are real Dates).
// ---------------------------------------------------------------------------

interface JobRow {
  id: string;
  url: string;
  title: string;
  author: string;
  platform: string;
  kind: string;
  quality: string;
  format: string;
  totalBytes: number;
  speedBps: number;
  failAtBytes: number | null;
  status: string;
  errorMessage: string | null;
  startedAt: Date | null;
  accumulatedMs: number;
  completedAt: Date | null;
  fileId: string | null;
  thumbKey: string;
  createdAt: Date;
}

interface FileRow {
  id: string;
  jobId: string | null;
  name: string;
  kind: string;
  quality: string;
  format: string;
  sizeBytes: number;
  durationSec: number;
  sourceUrl: string;
  filePath: string;
  thumbKey: string;
  hue: number;
  favorite: boolean;
  folderId: string | null;
  createdAt: Date;
}

interface FolderRow {
  id: string;
  name: string;
  createdAt: Date;
}

interface SettingRow {
  key: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Query helpers (only the where/orderBy shapes the app actually uses).
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function looseEq(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const key of Object.keys(where)) {
    const cond = where[key];
    const value = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const op = cond as Record<string, unknown>;
      if ("in" in op) {
        const list = op.in as unknown[];
        if (!Array.isArray(list) || !list.some((v) => looseEq(value, v))) return false;
      }
      if ("contains" in op) {
        const haystack = String(value ?? "").toLowerCase();
        const needle = String(op.contains ?? "").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if ("equals" in op && !looseEq(value, op.equals)) return false;
      if ("not" in op && looseEq(value, op.not)) return false;
    } else if (!looseEq(value, cond)) {
      return false;
    }
  }
  return true;
}

function compareRows(a: Row, b: Row, orderBy: Record<string, string> | undefined): number {
  if (!orderBy) return 0;
  for (const [field, dir] of Object.entries(orderBy)) {
    const av = a[field];
    const bv = b[field];
    let cmp = 0;
    if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
    else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
  }
  return 0;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

class RecordNotFoundError extends Error {
  constructor() {
    super("Record not found (P2025)");
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createMemoryDb(): unknown {
  const g = globalThis as unknown as { __pdMemoryDb?: unknown };
  if (g.__pdMemoryDb) return g.__pdMemoryDb;

  const settings: SettingRow[] = [];
  const jobs: JobRow[] = [];
  const files: FileRow[] = [];
  const folders: FolderRow[] = [];

  function attachFolder(row: FileRow): FileRow & { folder: { name: string } | null } {
    const folder = row.folderId ? folders.find((f) => f.id === row.folderId) : undefined;
    return { ...clone(row), folder: folder ? { name: folder.name } : null };
  }

  const memoryDb = {
    setting: {
      async findMany(): Promise<SettingRow[]> {
        return settings.map(clone);
      },
      async upsert(args: {
        where: { key: string };
        update: { value: string };
        create: { key: string; value: string };
      }): Promise<SettingRow> {
        const row = settings.find((s) => s.key === args.where.key);
        if (row) {
          row.value = args.update.value;
          return clone(row);
        }
        const created: SettingRow = { key: args.create.key, value: args.create.value };
        settings.push(created);
        return clone(created);
      },
    },

    downloadJob: {
      async create({ data }: { data: Record<string, unknown> }): Promise<JobRow> {
        const row = {
          id: newId("job"),
          url: "",
          title: "",
          author: "",
          platform: "",
          kind: "video",
          quality: "",
          format: "mp4",
          totalBytes: 0,
          speedBps: 0,
          failAtBytes: null,
          status: "queued",
          errorMessage: null,
          startedAt: null,
          accumulatedMs: 0,
          completedAt: null,
          fileId: null,
          thumbKey: "1",
          createdAt: new Date(),
          ...clone(data),
        } as JobRow;
        jobs.push(row);
        return clone(row);
      },
      async findMany(args: {
        where?: Row;
        orderBy?: Record<string, string>;
        take?: number;
      } = {}): Promise<JobRow[]> {
        const found = jobs
          .filter((j) => matchesWhere(j as unknown as Row, args.where))
          .sort((a, b) => compareRows(a as unknown as Row, b as unknown as Row, args.orderBy));
        const limited = args.take ? found.slice(0, args.take) : found;
        return limited.map(clone);
      },
      async findUnique({ where }: { where: { id: string } }): Promise<JobRow | null> {
        const row = jobs.find((j) => j.id === where.id);
        return row ? clone(row) : null;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }): Promise<JobRow> {
        const row = jobs.find((j) => j.id === where.id);
        if (!row) throw new RecordNotFoundError();
        Object.assign(row, clone(data));
        return clone(row);
      },
      async deleteMany({ where }: { where?: Row } = {}): Promise<{ count: number }> {
        const victims = jobs.filter((j) => matchesWhere(j as unknown as Row, where));
        for (const v of victims) jobs.splice(jobs.indexOf(v), 1);
        return { count: victims.length };
      },
      async count({ where }: { where?: Row } = {}): Promise<number> {
        return jobs.filter((j) => matchesWhere(j as unknown as Row, where)).length;
      },
    },

    mediaFile: {
      async create({ data }: { data: Record<string, unknown> }): Promise<FileRow> {
        const row = {
          id: newId("file"),
          jobId: null,
          name: "",
          kind: "video",
          quality: "",
          format: "mp4",
          sizeBytes: 0,
          durationSec: 0,
          sourceUrl: "",
          filePath: "sample-video-1",
          thumbKey: "1",
          hue: 150,
          favorite: false,
          folderId: null,
          createdAt: new Date(),
          ...clone(data),
        } as FileRow;
        files.push(row);
        return clone(row);
      },
      async findUnique({ where }: { where: { id: string } }): Promise<FileRow | null> {
        const row = files.find((f) => f.id === where.id);
        return row ? clone(row) : null;
      },
      async findMany(args: {
        where?: Row;
        orderBy?: Record<string, string>;
        take?: number;
      } = {}): Promise<ReturnType<typeof attachFolder>[]> {
        const found = files
          .filter((f) => matchesWhere(f as unknown as Row, args.where))
          .sort((a, b) => compareRows(a as unknown as Row, b as unknown as Row, args.orderBy));
        const limited = args.take ? found.slice(0, args.take) : found;
        return limited.map(attachFolder);
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }): Promise<ReturnType<typeof attachFolder>> {
        const row = files.find((f) => f.id === where.id);
        if (!row) throw new RecordNotFoundError();
        Object.assign(row, clone(data));
        return attachFolder(row);
      },
      async deleteMany({ where }: { where?: Row } = {}): Promise<{ count: number }> {
        const victims = files.filter((f) => matchesWhere(f as unknown as Row, where));
        for (const v of victims) files.splice(files.indexOf(v), 1);
        return { count: victims.length };
      },
      async count({ where }: { where?: Row } = {}): Promise<number> {
        return files.filter((f) => matchesWhere(f as unknown as Row, where)).length;
      },
      async aggregate({ _sum }: { _sum?: { sizeBytes?: boolean } } = {}): Promise<{ _sum: { sizeBytes: number | null } }> {
        if (_sum?.sizeBytes) {
          const total = files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
          return { _sum: { sizeBytes: total } };
        }
        return { _sum: { sizeBytes: null } };
      },
      async groupBy(): Promise<Array<{ folderId: string | null; _count: { _all: number } }>> {
        const groups = new Map<string | null, number>();
        for (const f of files) {
          groups.set(f.folderId ?? null, (groups.get(f.folderId ?? null) ?? 0) + 1);
        }
        return Array.from(groups.entries()).map(([folderId, count]) => ({
          folderId,
          _count: { _all: count },
        }));
      },
    },

    folder: {
      async findMany({ orderBy }: { orderBy?: Record<string, string> } = {}): Promise<FolderRow[]> {
        return folders
          .slice()
          .sort((a, b) => compareRows(a as unknown as Row, b as unknown as Row, orderBy))
          .map(clone);
      },
      async findFirst({ where }: { where?: Row } = {}): Promise<FolderRow | null> {
        const row = folders.find((f) => matchesWhere(f as unknown as Row, where));
        return row ? clone(row) : null;
      },
      async create({ data }: { data: { name: string } }): Promise<FolderRow> {
        const row: FolderRow = { id: newId("folder"), name: data.name, createdAt: new Date() };
        folders.push(row);
        return clone(row);
      },
      // Mirrors the schema's `onDelete: SetNull` relation action.
      async deleteMany({ where }: { where?: Row } = {}): Promise<{ count: number }> {
        const victims = folders.filter((f) => matchesWhere(f as unknown as Row, where));
        const ids = new Set(victims.map((v) => v.id));
        for (const v of victims) folders.splice(folders.indexOf(v), 1);
        for (const file of files) {
          if (file.folderId && ids.has(file.folderId)) file.folderId = null;
        }
        return { count: victims.length };
      },
    },
  };

  g.__pdMemoryDb = memoryDb;
  return memoryDb;
}
