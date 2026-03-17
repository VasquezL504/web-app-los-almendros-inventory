export type InventoryEventType = "purchase" | "use" | "waste"

export interface InventoryEvent {
  id: string
  businessId: string
  itemName: string
  quantity: number
  unitPrice: number
  totalValue: number
  type: InventoryEventType
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
        typeof event?.quantity === "number" &&
        typeof event?.unitPrice === "number" &&
        typeof event?.totalValue === "number" &&
        (event?.type === "purchase" || event?.type === "use" || event?.type === "waste") &&
        typeof event?.occurredAt === "string"
    )
  } catch {
    return []
  }
}

function saveInventoryEvents(events: InventoryEvent[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

export function appendInventoryEvent(event: Omit<InventoryEvent, "id">) {
  const events = loadInventoryEvents()
  const nextEvent: InventoryEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  }
  saveInventoryEvents([...events, nextEvent])
}
