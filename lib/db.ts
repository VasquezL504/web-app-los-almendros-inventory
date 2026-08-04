import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always reuse a single cached client (including in production/serverless).
// Without this, each serverless invocation can spin up its own PrismaClient
// with its own connection pool, exhausting Postgres connections under
// concurrent multi-device load (e.g. several phones polling at once).
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

globalForPrisma.prisma = prisma
