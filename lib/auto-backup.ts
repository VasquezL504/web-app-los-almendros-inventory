import { type InventoryBackupData } from "@/lib/export-excel"

const AUTO_BACKUP_STORAGE_KEY = "inventory-auto-backups-v1"

export interface AutoBackupSnapshot {
  id: string
  createdAt: string
  reason: string
  checksum: string
  data: InventoryBackupData
}

interface SaveAutoBackupOptions {
  reason?: string
  minIntervalMs?: number
  maxSnapshots?: number
}

interface SaveAutoBackupResult {
  saved: boolean
  reason: "saved" | "empty" | "same-as-latest" | "too-soon"
}

function isBrowserEnvironment() {
  return typeof window !== "undefined"
}

function computeChecksum(data: InventoryBackupData): string {
  const itemCount = data.items.length
  const eventCount = data.events?.length ?? 0
  const businessCount = data.businesses?.length ?? 0
  const categoriesCount = Object.values(data.categoriesByBusiness).reduce((sum, categories) => sum + categories.length, 0)
  const nameHistoryCount = data.nameHistory.length
  const employeePermissionSignature = data.permissionsByRole
    ? JSON.stringify(data.permissionsByRole.employee)
    : ""
  const managerPermissionSignature = data.permissionsByRole
    ? JSON.stringify(data.permissionsByRole.manager)
    : ""
  const lastItemCreatedAt = data.items.reduce((latest, item) => (item.createdAt > latest ? item.createdAt : latest), "")
  const lastEventOccurredAt = (data.events ?? []).reduce(
    (latest, event) => (event.occurredAt > latest ? event.occurredAt : latest),
    ""
  )

  return [
    itemCount,
    eventCount,
    businessCount,
    categoriesCount,
    nameHistoryCount,
    data.nextBatchNumber,
    employeePermissionSignature,
    managerPermissionSignature,
    lastItemCreatedAt,
    lastEventOccurredAt,
  ].join("|")
}

function safeParseBackups(raw: string | null): AutoBackupSnapshot[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((entry): entry is AutoBackupSnapshot => {
      if (!entry || typeof entry !== "object") return false
      const current = entry as Record<string, unknown>
      return (
        typeof current.id === "string" &&
        typeof current.createdAt === "string" &&
        typeof current.reason === "string" &&
        typeof current.checksum === "string" &&
        !!current.data &&
        typeof current.data === "object"
      )
    })
  } catch {
    return []
  }
}

export function readAutoBackups(): AutoBackupSnapshot[] {
  if (!isBrowserEnvironment()) return []
  return safeParseBackups(window.localStorage.getItem(AUTO_BACKUP_STORAGE_KEY))
}

function writeAutoBackups(backups: AutoBackupSnapshot[]) {
  if (!isBrowserEnvironment()) return
  window.localStorage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify(backups))
}

export function saveAutomaticBackupSnapshot(
  data: InventoryBackupData,
  options?: SaveAutoBackupOptions
): SaveAutoBackupResult {
  if (!isBrowserEnvironment()) {
    return { saved: false, reason: "empty" }
  }

  if (data.items.length === 0 && (data.events?.length ?? 0) === 0) {
    return { saved: false, reason: "empty" }
  }

  const maxSnapshots = options?.maxSnapshots ?? 72
  const minIntervalMs = options?.minIntervalMs ?? 3 * 60 * 1000
  const reason = options?.reason ?? "auto"
  const checksum = computeChecksum(data)
  const backups = readAutoBackups().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const latest = backups[0]

  if (latest?.checksum === checksum) {
    return { saved: false, reason: "same-as-latest" }
  }

  if (latest) {
    const elapsed = Date.now() - new Date(latest.createdAt).getTime()
    if (!Number.isNaN(elapsed) && elapsed < minIntervalMs) {
      return { saved: false, reason: "too-soon" }
    }
  }

  const snapshot: AutoBackupSnapshot = {
    id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    reason,
    checksum,
    data,
  }

  const next = [snapshot, ...backups].slice(0, maxSnapshots)
  writeAutoBackups(next)

  return { saved: true, reason: "saved" }
}

export function getLatestAutomaticBackup(): AutoBackupSnapshot | null {
  const backups = readAutoBackups().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return backups[0] ?? null
}

export function getAutomaticBackupsCount(): number {
  return readAutoBackups().length
}
