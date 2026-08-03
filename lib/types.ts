export type Metric = string

export interface InventoryItem {
  id: string
  businessId: string // ID del negocio al que pertenece
  name: string
  categories: string[]
  buyingDate: string // ISO date string
  expirationDate: string // ISO date string
  hasExpiration: boolean // whether this item tracks an expiration date
  amount: number
  metric: Metric
  pricePerUnit: number
  minAmount: number | null
  note: string
  batchNumber: number // FIFO ordering — lower = arrived first
  createdAt: string // ISO date string
  /**
   * Timestamp when the item reached zero amount. Used to automatically
   * purge zeroed batches after 24 hours. Undefined for non‑zero items or
   * legacy data.
   */
  zeroedAt?: string
}

export type ExpirationStatus = "red" | "yellow" | "green"

export function getExpirationStatus(expirationDate: string, hasExpiration: boolean = true): ExpirationStatus {
  if (!hasExpiration) return "green"
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

export function getDaysUntilExpiration(expirationDate: string, hasExpiration: boolean = true): number {
  if (!hasExpiration) return Infinity
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
  businessId: string // ID del negocio al que pertenece
  itemId: string
  itemName: string
  type: "expiration" | "low-stock"
  message: string
}

export function getAlerts(items: InventoryItem[]): Alert[] {
  const alerts: Alert[] = []

  for (const item of items) {
    const days = getDaysUntilExpiration(item.expirationDate, item.hasExpiration)
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
              ? `${item.name} expira mañana!`
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
        message: `${item.name} esta bajo — ${totalAmount} ${getMetricLabel(item.metric)} restante (min: ${item.minAmount})`,
      })
    }
  }

  return alerts
}

export function getMetricLabel(value: string): string {
  const found = DEFAULT_METRICS.find(m => m.value === value)
  return found?.label || value
}

export const DEFAULT_CATEGORIES = [
  "Carnes",
  "Verduras",
  "Lacteos",
  "Bebidas",
]

export interface MetricOption {
  value: string
  label: string
  isDefault: boolean
}

export const DEFAULT_METRICS: MetricOption[] = [
  { value: "lbs", label: "Libras (lbs)", isDefault: true },
  { value: "kg", label: "Kilogramos (kg)", isDefault: true },
  { value: "oz", label: "Onzas (oz)", isDefault: true },
  { value: "units", label: "Unidades", isDefault: true },
  { value: "gal", label: "Galones (gal)", isDefault: true },
  { value: "liters", label: "Litros", isDefault: true },
  { value: "boxes", label: "Cajas", isDefault: true },
]
