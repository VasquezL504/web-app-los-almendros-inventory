import type { InventoryItem, Metric } from "@/lib/types"
import { getExpirationStatus, getDaysUntilExpiration } from "@/lib/types"
import { formatNumber } from "./utils"

const ALLOWED_METRICS: Metric[] = ["lbs", "oz", "units", "gal", "liters", "kg", "boxes"]

export interface InventoryBackupData {
  version?: number
  items: InventoryItem[]
  categoriesByBusiness: Record<string, string[]>
  nameHistory: string[]
  nextBatchNumber: number
}

function generateImportedId(index: number) {
  return `imported-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
}

function toIsoDate(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toISOString()
}

function normalizeImportedItem(raw: unknown, index: number, fallbackBusinessId: string): InventoryItem | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>

  const name = typeof item.name === "string" ? item.name.trim() : ""
  if (!name) return null

  const categories = Array.isArray(item.categories)
    ? item.categories.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : []

  const amount = typeof item.amount === "number" && Number.isFinite(item.amount) ? item.amount : 0
  const pricePerUnit = typeof item.pricePerUnit === "number" && Number.isFinite(item.pricePerUnit)
    ? item.pricePerUnit
    : 0
  const minAmount = typeof item.minAmount === "number" && Number.isFinite(item.minAmount)
    ? item.minAmount
    : null
  const metric = typeof item.metric === "string" && ALLOWED_METRICS.includes(item.metric as Metric)
    ? (item.metric as Metric)
    : "units"

  const createdAt = toIsoDate(item.createdAt, new Date().toISOString())
  const buyingDate = toIsoDate(item.buyingDate, createdAt)
  const expirationFallback = new Date(createdAt)
  expirationFallback.setDate(expirationFallback.getDate() + 30)
  const expirationDate = toIsoDate(item.expirationDate, expirationFallback.toISOString())
  const zeroedAt = typeof item.zeroedAt === "string" ? toIsoDate(item.zeroedAt, createdAt) : undefined

  return {
    id: typeof item.id === "string" && item.id.trim().length > 0 ? item.id : generateImportedId(index),
    businessId: typeof item.businessId === "string" ? item.businessId : fallbackBusinessId,
    name,
    categories,
    buyingDate,
    expirationDate,
    amount,
    metric,
    pricePerUnit,
    minAmount,
    note: typeof item.note === "string" ? item.note : "",
    batchNumber: typeof item.batchNumber === "number" && Number.isFinite(item.batchNumber) && item.batchNumber > 0
      ? Math.floor(item.batchNumber)
      : index + 1,
    createdAt,
    zeroedAt,
  }
}

function normalizeImportedBackup(raw: unknown, fallbackBusinessId: string) {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const rawItems = Array.isArray(data.items) ? data.items : []
  const items = rawItems
    .map((item, idx) => normalizeImportedItem(item, idx, fallbackBusinessId))
    .filter((item): item is InventoryItem => item !== null)
    .sort((a, b) => a.batchNumber - b.batchNumber)

  const categoriesByBusiness: Record<string, string[]> = {}

  if (data.categoriesByBusiness && typeof data.categoriesByBusiness === "object") {
    for (const [businessId, value] of Object.entries(data.categoriesByBusiness as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue
      const names = value.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
      if (names.length > 0) {
        categoriesByBusiness[businessId] = Array.from(new Set(names))
      }
    }
  } else if (Array.isArray(data.categories)) {
    if (data.categories.every((entry) => typeof entry === "string")) {
      const categories = data.categories.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      if (categories.length > 0) {
        categoriesByBusiness[fallbackBusinessId] = Array.from(new Set(categories))
      }
    } else {
      for (const entry of data.categories) {
        if (!entry || typeof entry !== "object") continue
        const category = entry as Record<string, unknown>
        const businessId = typeof category.businessId === "string" ? category.businessId : fallbackBusinessId
        const name = typeof category.name === "string" ? category.name.trim() : ""
        if (!name) continue
        if (!categoriesByBusiness[businessId]) {
          categoriesByBusiness[businessId] = []
        }
        if (!categoriesByBusiness[businessId].includes(name)) {
          categoriesByBusiness[businessId].push(name)
        }
      }
    }
  }

  const nameHistory = Array.isArray(data.nameHistory)
    ? data.nameHistory.filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    : []

  const maxBatch = items.length > 0 ? Math.max(...items.map(i => i.batchNumber)) : 0
  const nextBatchNumber = typeof data.nextBatchNumber === "number" && Number.isFinite(data.nextBatchNumber) && data.nextBatchNumber > 0
    ? Math.floor(data.nextBatchNumber)
    : maxBatch + 1

  return {
    items,
    categoriesByBusiness,
    nameHistory,
    nextBatchNumber,
  }
}

export async function exportToExcel(items: InventoryItem[]) {
  const XLSX = await import("xlsx")

  const rows = items.map((item) => ({
    "Lote #": item.batchNumber,
    Nombre: item.name,
    Categorias: item.categories.join(", "),
    Cantidad: item.amount,
    Metrica: item.metric,
    "Precio por Unidad": `$${formatNumber(item.pricePerUnit)}`,
    "Fecha de Compra": item.buyingDate,
    "Fecha de Expiracion": item.expirationDate,
    "Dias Restantes": getDaysUntilExpiration(item.expirationDate),
    Estado: getExpirationStatus(item.expirationDate).toUpperCase(),
    "Cantidad Minima": item.minAmount ?? "",
    Nota: item.note,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String(r[key as keyof typeof r]).length)
    ) + 2,
  }))
  ws["!cols"] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, "Inventario")
  XLSX.writeFile(
    wb,
    `inventario-${new Date().toISOString().split("T")[0]}.xlsx`
  )
}

export function exportToJSON(data: InventoryBackupData) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `inventario-backup-${new Date().toISOString().split("T")[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importFromJSON(
  callback: (data: InventoryBackupData) => void,
  options?: { fallbackBusinessId?: string }
) {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".json"
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const normalized = normalizeImportedBackup(data, options?.fallbackBusinessId || "")
      if (normalized.items.length > 0) {
        callback(normalized)
      } else {
        alert("Archivo JSON inválido")
      }
    } catch {
      alert("Error al leer el archivo")
    }
  }
  input.click()
}
