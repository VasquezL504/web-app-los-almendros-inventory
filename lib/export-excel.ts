import type { InventoryItem, Metric } from "@/lib/types"
import { getExpirationStatus, getDaysUntilExpiration } from "@/lib/types"
import type { InventoryEvent } from "@/lib/inventory-events"
import { replaceInventoryEvents } from "@/lib/inventory-events"
import type { Business } from "@/lib/businesses"
import { saveBusinesses } from "@/lib/businesses"
import { formatNumber } from "./utils"

const ALLOWED_METRICS: Metric[] = ["lbs", "oz", "units", "gal", "liters", "kg", "boxes"]

export interface InventoryBackupData {
  version?: number
  items: InventoryItem[]
  categoriesByBusiness: Record<string, string[]>
  nameHistory: string[]
  nextBatchNumber: number
  events?: InventoryEvent[]
  businesses?: Business[]
}

const DASHBOARD_IMPORT_NOTICE_KEY = "inventory-dashboard-import-notice"

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

  const events: InventoryEvent[] = Array.isArray(data.events)
    ? data.events
        .filter((event): event is InventoryEvent => {
          if (!event || typeof event !== "object") return false
          const current = event as Record<string, unknown>
          return (
            typeof current.id === "string" &&
            typeof current.businessId === "string" &&
            typeof current.itemName === "string" &&
            typeof current.quantity === "number" &&
            typeof current.unitPrice === "number" &&
            typeof current.totalValue === "number" &&
            (current.type === "purchase" || current.type === "use" || current.type === "waste") &&
            typeof current.occurredAt === "string"
          )
        })
        .map((event) => ({
          ...event,
          occurredAt: toIsoDate(event.occurredAt, new Date().toISOString()),
        }))
    : []

  const businesses: Business[] = Array.isArray(data.businesses)
    ? data.businesses.filter(
        (business): business is Business =>
          !!business &&
          typeof business === "object" &&
          typeof (business as Record<string, unknown>).id === "string" &&
          typeof (business as Record<string, unknown>).name === "string"
      )
    : []

  return {
    items,
    categoriesByBusiness,
    nameHistory,
    nextBatchNumber,
    events,
    businesses,
  }
}

export async function exportToExcel(items: InventoryItem[]) {
  const XLSX = await import("xlsx-js-style")
  const now = new Date()
  const downloadedDate = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`
  const downloadedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  const headers = [
    "Negocio ID",
    "Lote #",
    "Nombre",
    "Categorias",
    "Cantidad",
    "Metrica",
    "Precio por Unidad",
    "Valor Total",
    "Fecha de Compra",
    "Fecha de Expiracion",
    "Dias Restantes",
    "Estado",
    "Cantidad Minima",
    "Nota",
  ] as const

  const rows = items.map((item) => ({
    "Negocio ID": item.businessId,
    "Lote #": item.batchNumber,
    Nombre: item.name,
    Categorias: item.categories.join(", "),
    Cantidad: item.amount,
    Metrica: item.metric,
    "Precio por Unidad": formatNumber(item.pricePerUnit),
    "Valor Total": formatNumber(item.amount * item.pricePerUnit),
    "Fecha de Compra": item.buyingDate,
    "Fecha de Expiracion": item.expirationDate,
    "Dias Restantes": getDaysUntilExpiration(item.expirationDate),
    Estado: getExpirationStatus(item.expirationDate).toUpperCase(),
    "Cantidad Minima": item.minAmount ?? "",
    Nota: item.note,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ["Reporte de Inventario"],
    ["Fecha de descarga", downloadedDate],
    ["Hora de descarga", downloadedTime],
    [],
  ])
  XLSX.utils.sheet_add_json(ws, rows, { header: [...headers], origin: "A5", skipHeader: false })

  const totalCols = headers.length
  const totalRows = rows.length
  const headerRowIndex = 4
  const dataStartRowIndex = 5

  const titleStyle = {
    font: { bold: true, sz: 16, color: { rgb: "FFFFFFFF" } },
    fill: { fgColor: { rgb: "FF1F4E78" } },
    alignment: { horizontal: "center", vertical: "center" },
  }

  const metaLabelStyle = {
    font: { bold: true, color: { rgb: "FF1F4E78" } },
    fill: { fgColor: { rgb: "FFEAF2FB" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "FFD9E2F3" } },
      bottom: { style: "thin", color: { rgb: "FFD9E2F3" } },
      left: { style: "thin", color: { rgb: "FFD9E2F3" } },
      right: { style: "thin", color: { rgb: "FFD9E2F3" } },
    },
  }

  const metaValueStyle = {
    fill: { fgColor: { rgb: "FFF7FBFF" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "FFD9E2F3" } },
      bottom: { style: "thin", color: { rgb: "FFD9E2F3" } },
      left: { style: "thin", color: { rgb: "FFD9E2F3" } },
      right: { style: "thin", color: { rgb: "FFD9E2F3" } },
    },
  }

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { fgColor: { rgb: "FF2F75B5" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "FFB4C7E7" } },
      bottom: { style: "thin", color: { rgb: "FFB4C7E7" } },
      left: { style: "thin", color: { rgb: "FFB4C7E7" } },
      right: { style: "thin", color: { rgb: "FFB4C7E7" } },
    },
  }

  const bodyStyleEven = {
    fill: { fgColor: { rgb: "FFFFFFFF" } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "FFE1EAF7" } },
      bottom: { style: "thin", color: { rgb: "FFE1EAF7" } },
      left: { style: "thin", color: { rgb: "FFE1EAF7" } },
      right: { style: "thin", color: { rgb: "FFE1EAF7" } },
    },
  }

  const bodyStyleOdd = {
    fill: { fgColor: { rgb: "FFF7FBFF" } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "FFE1EAF7" } },
      bottom: { style: "thin", color: { rgb: "FFE1EAF7" } },
      left: { style: "thin", color: { rgb: "FFE1EAF7" } },
      right: { style: "thin", color: { rgb: "FFE1EAF7" } },
    },
  }

  const titleCell = ws["A1"]
  if (titleCell) titleCell.s = titleStyle
  if (ws["A2"]) ws["A2"].s = metaLabelStyle
  if (ws["B2"]) ws["B2"].s = metaValueStyle
  if (ws["A3"]) ws["A3"].s = metaLabelStyle
  if (ws["B3"]) ws["B3"].s = metaValueStyle

  for (let col = 0; col < totalCols; col++) {
    const headerCellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col })
    if (ws[headerCellAddress]) {
      ws[headerCellAddress].s = headerStyle
    }
  }

  for (let row = 0; row < totalRows; row++) {
    const rowStyle = row % 2 === 0 ? bodyStyleEven : bodyStyleOdd
    for (let col = 0; col < totalCols; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: dataStartRowIndex + row, c: col })
      if (ws[cellAddress]) {
        ws[cellAddress].s = rowStyle
      }
    }
  }

  const colWidths = headers.map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String(r[key]).length)
    ) + 2,
  }))
  ws["!cols"] = colWidths
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: dataStartRowIndex + Math.max(totalRows - 1, 0), c: totalCols - 1 },
    }),
  }
  ws["!rows"] = [
    { hpt: 26 },
    { hpt: 20 },
    { hpt: 20 },
    { hpt: 8 },
    { hpt: 22 },
  ]

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

        if (normalized.events.length > 0) {
          replaceInventoryEvents(normalized.events)
        } else {
          const expiresAt = Date.now() + 24 * 60 * 60 * 1000
          localStorage.setItem(
            DASHBOARD_IMPORT_NOTICE_KEY,
            JSON.stringify({
              expiresAt,
              message: "Backup legado importado: faltan eventos historicos de uso/merma para el dashboard.",
            })
          )
        }

        if (normalized.businesses.length > 0) {
          saveBusinesses(normalized.businesses)
        }
      } else {
        alert("Archivo JSON inválido")
      }
    } catch {
      alert("Error al leer el archivo")
    }
  }
  input.click()
}
