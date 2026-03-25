import {
  loadInventoryEventsFromDB,
  appendInventoryEventToDB,
  replaceInventoryEventsToDB,
} from "@/lib/server-actions"

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

export async function loadInventoryEvents(): Promise<InventoryEvent[]> {
  return loadInventoryEventsFromDB() as Promise<InventoryEvent[]>
}

export async function replaceInventoryEvents(events: InventoryEvent[]): Promise<void> {
  await replaceInventoryEventsToDB(events)
}

export async function appendInventoryEvent(event: Omit<InventoryEvent, "id">): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  await appendInventoryEventToDB({ ...event, id })
}
