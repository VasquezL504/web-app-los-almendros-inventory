export type Metric = "lbs" | "oz" | "units" | "gal" | "liters" | "kg"

export interface InventoryItem {
  id: string
  name: string
  categories: string[]
  buyingDate: string // ISO date string
  expirationDate: string // ISO date string
  amount: number
  metric: Metric
  pricePerUnit: number
  minAmount: number | null
  note: string
  batchNumber: number // FIFO ordering — lower = arrived first
  createdAt: string // ISO date string
}

export type ExpirationStatus = "red" | "yellow" | "green"

export function getExpirationStatus(expirationDate: string): ExpirationStatus {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(expirationDate)
  exp.setHours(0, 0, 0, 0)
  const diffMs = exp.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 2) return "red"
  if (diffDays <= 5) return "yellow"
  return "green"
}

export function getDaysUntilExpiration(expirationDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(expirationDate)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function isLowStock(item: InventoryItem, allItems: InventoryItem[]): boolean {
  if (item.minAmount === null) return false
  // Calculate total amount for all items with same name
  const totalAmount = allItems
    .filter((i) => i.name.toLowerCase() === item.name.toLowerCase())
    .reduce((sum, i) => sum + i.amount, 0)
  return totalAmount <= item.minAmount
}

export interface Alert {
  id: string
  itemId: string
  itemName: string
  type: "expiration" | "low-stock"
  message: string
}

export function getAlerts(items: InventoryItem[]): Alert[] {
  const alerts: Alert[] = []

  for (const item of items) {
    const days = getDaysUntilExpiration(item.expirationDate)
    if (days <= 5) {
      alerts.push({
        id: `exp-${item.id}`,
        itemId: item.id,
        itemName: item.name,
        type: "expiration",
        message:
          days <= 0
            ? `${item.name} ha expirado!`
            : days === 1
              ? `${item.name} expira manana!`
              : `${item.name} expira en ${days} dias`,
      })
    }
    const totalAmount = items
      .filter((i) => i.name.toLowerCase() === item.name.toLowerCase())
      .reduce((sum, i) => sum + i.amount, 0)
    if (isLowStock(item, items)) {
      alerts.push({
        id: `low-${item.id}`,
        itemId: item.id,
        itemName: item.name,
        type: "low-stock",
        message: `${item.name} esta bajo — ${totalAmount} ${item.metric} restante (min: ${item.minAmount})`,
      })
    }
  }

  return alerts
}

export const DEFAULT_CATEGORIES = [
  "Carnes",
  "Verduras",
  "Lacteos",
  "Bebidas",
]

export const METRICS: { value: Metric; label: string }[] = [
  { value: "lbs", label: "Libras (lbs)" },
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "oz", label: "Onzas (oz)" },
  { value: "units", label: "Unidades" },
  { value: "gal", label: "Galones (gal)" },
  { value: "liters", label: "Litros" },
]
