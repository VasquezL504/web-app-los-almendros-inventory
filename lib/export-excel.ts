import type { InventoryItem } from "@/lib/types"
import { getExpirationStatus, getDaysUntilExpiration } from "@/lib/types"

export async function exportToExcel(items: InventoryItem[]) {
  const XLSX = await import("xlsx")

  const rows = items.map((item) => ({
    "Lote #": item.batchNumber,
    Nombre: item.name,
    Categorias: item.categories.join(", "),
    Cantidad: item.amount,
    Metrica: item.metric,
    "Precio por Unidad": `$${item.pricePerUnit.toFixed(2)}`,
    "Fecha de Compra": item.buyingDate,
    "Fecha de Expiracion": item.expirationDate,
    "Dias Restantes": getDaysUntilExpiration(item.expirationDate),
    Estado: getExpirationStatus(item.expirationDate).toUpperCase(),
    "Cantidad Minima": item.minAmount ?? "",
    Nota: item.note,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Auto-width columns
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
