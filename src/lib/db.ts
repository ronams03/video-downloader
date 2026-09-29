import { PrismaClient } from '@prisma/client'
import { createMemoryDb } from '@/lib/memory-db'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Serverless platforms (e.g. Vercel) have a read-only filesystem: SQLite
 * cannot be created or written there, so every Prisma query would throw and
 * the app would fail with "Could not add these downloads to the queue."
 *
 * On those runtimes we swap in a self-contained in-memory store that speaks
 * the same Prisma API (see src/lib/memory-db.ts), so the deployed app works
 * out of the box in ephemeral demo mode — no database configuration needed.
 */
function shouldUseEphemeralStore(): boolean {
  if (process.env.PUREDOWNLOAD_EPHEMERAL === "1") return true;
  if (process.env.VERCEL === "1") return true;
  // Production build without a configured database (any host) → memory store.
  return process.env.NODE_ENV === "production" && !process.env.DATABASE_URL;
}

/** True when running against the in-memory store (ephemeral demo mode). */
export function isEphemeralDb(): boolean {
  return shouldUseEphemeralStore();
}

function createDb(): PrismaClient {
  if (shouldUseEphemeralStore()) {
    return createMemoryDb() as unknown as PrismaClient;
  }
  return new PrismaClient({
    log: ['error', 'warn'],
  })
}

export const db =
  globalForPrisma.prisma ??
  createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
