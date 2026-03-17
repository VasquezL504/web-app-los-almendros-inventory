export type InventoryEventType = "purchase" | "use" | "waste" | "adjustment"
export type InventoryAdjustmentKind = "edit" | "delete"

export interface InventoryEvent {
  id: string
  businessId: string
  itemName: string
  actorName?: string
  quantity: number
  unitPrice: number
  totalValue: number
  type: InventoryEventType
  adjustmentKind?: InventoryAdjustmentKind
  note?: string
  occurredAt: string
}

const STORAGE_KEY = "inventory-events"

export function loadInventoryEvents(): InventoryEvent[] {
  if (typeof window === "undefined") return []

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as InventoryEvent[]
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (event) =>
        typeof event?.id === "string" &&
        typeof event?.businessId === "string" &&
        typeof event?.itemName === "string" &&
        (event?.actorName === undefined || typeof event?.actorName === "string") &&
        typeof event?.quantity === "number" &&
        typeof event?.unitPrice === "number" &&
        typeof event?.totalValue === "number" &&
        (event?.type === "purchase" || event?.type === "use" || event?.type === "waste" || event?.type === "adjustment") &&
        (event?.adjustmentKind === undefined || event?.adjustmentKind === "edit" || event?.adjustmentKind === "delete") &&
        (event?.note === undefined || typeof event?.note === "string") &&
        typeof event?.occurredAt === "string"
    )
  } catch {
    return []
  }
}

export function saveInventoryEvents(events: InventoryEvent[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

export function replaceInventoryEvents(events: InventoryEvent[]) {
  saveInventoryEvents(events)
}

export function appendInventoryEvent(event: Omit<InventoryEvent, "id">) {
  const events = loadInventoryEvents()
  const nextEvent: InventoryEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  }
  saveInventoryEvents([...events, nextEvent])
}
