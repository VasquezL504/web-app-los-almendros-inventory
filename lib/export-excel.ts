import type { InventoryItem } from "@/lib/types"
import { getExpirationStatus, getDaysUntilExpiration } from "@/lib/types"
import { formatNumber } from "./utils"

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

export function exportToJSON(data: { items: InventoryItem[], categories: string[], nameHistory: string[], nextBatchNumber: number }) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `inventario-backup-${new Date().toISOString().split("T")[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importFromJSON(callback: (data: { items: InventoryItem[], categories: string[], nameHistory: string[], nextBatchNumber: number }) => void) {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".json"
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.items && Array.isArray(data.items)) {
        callback(data)
      } else {
        alert("Archivo JSON inválido")
      }
    } catch {
      alert("Error al leer el archivo")
    }
  }
  input.click()
}
