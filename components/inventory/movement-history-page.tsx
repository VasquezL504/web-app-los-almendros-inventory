"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useInventory } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import { type InventoryEvent, loadInventoryEvents } from "@/lib/inventory-events"
import { type InventoryItem } from "@/lib/types"
import { exportItemMovementSummaryToExcel, exportMovementHistoryToExcel, type ItemMovementSummaryExportRow } from "@/lib/export-excel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BusinessSelector } from "./business-selector"
import { Store, Package, ArrowLeft, History, Plus, Minus, Pencil, Download, FileDown } from "lucide-react"

type MovementFilter = "all" | "income" | "output" | "modification"

interface HistoryEntry {
  id: string
  occurredAt: string
  movementType: "income" | "output" | "modification"
  title: string
  detail: string
  itemName: string
}

interface ReportMovementRecord {
  itemName: string
  movementKind: "income" | "use" | "waste"
  quantity: number
  totalValue: number
  occurredAt: string
}

const LEGACY_INCOME_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000
const PURCHASE_EVENT_MATCH_WINDOW_MS = 10 * 60 * 1000

function getMovementType(event: InventoryEvent): "income" | "output" | "modification" {
  if (event.type === "purchase") return "income"
  if (event.type === "adjustment") return "modification"
  return "output"
}

function toHistoryEntry(event: InventoryEvent): HistoryEntry {
  if (event.type === "purchase") {
    return {
      id: event.id,
      occurredAt: event.occurredAt,
      movementType: "income",
      title: "Ingreso",
      detail: `Ingreso por agregar batch. Cantidad: ${event.quantity}`,
      itemName: event.itemName,
    }
  }

  if (event.type === "use" || event.type === "waste") {
    const usageLabel = event.type === "waste" ? "Merma" : "Uso"
    return {
      id: event.id,
      occurredAt: event.occurredAt,
      movementType: "output",
      title: "Egreso",
      detail: `${usageLabel}. Cantidad: ${event.quantity}`,
      itemName: event.itemName,
    }
  }

  return {
    id: event.id,
    occurredAt: event.occurredAt,
    movementType: "modification",
    title: "Modificacion",
    detail: event.note?.trim() || "Correccion manual de batch",
    itemName: event.itemName,
  }
}

function formatEventDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return "Fecha no valida"
  return date.toLocaleString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isWithinLegacyLookback(isoDate: string): boolean {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return false
  return Date.now() - date.getTime() <= LEGACY_INCOME_LOOKBACK_MS
}

function hasRecordedPurchaseEvent(item: InventoryItem, events: InventoryEvent[]): boolean {
  const createdAtTime = new Date(item.createdAt).getTime()

  return events.some((event) => {
    if (event.type !== "purchase") return false
    if (event.businessId !== item.businessId) return false
    if (event.itemName !== item.name) return false
    if (event.quantity !== item.amount) return false
    if (event.unitPrice !== item.pricePerUnit) return false

    const eventTime = new Date(event.occurredAt).getTime()
    if (Number.isNaN(createdAtTime) || Number.isNaN(eventTime)) return false

    return Math.abs(eventTime - createdAtTime) <= PURCHASE_EVENT_MATCH_WINDOW_MS
  })
}

function toLegacyIncomeEntry(item: InventoryItem): HistoryEntry {
  return {
    id: `legacy-income-${item.id}`,
    occurredAt: item.buyingDate,
    movementType: "income",
    title: "Ingreso",
    detail: `Ingreso reconstruido desde fecha de compra. Cantidad actual: ${item.amount}`,
    itemName: item.name,
  }
}

function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60 * 1000)
  return adjusted.toISOString().slice(0, 10)
}

function isWithinDateRange(isoDate: string, startDate: string, endDate: string): boolean {
  const date = new Date(isoDate)
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T23:59:59.999`)

  if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false
  }

  return date >= start && date <= end
}

function toReportMovementRecord(event: InventoryEvent): ReportMovementRecord | null {
  if (event.type === "purchase") {
    return {
      itemName: event.itemName,
      movementKind: "income",
      quantity: event.quantity,
      totalValue: event.totalValue,
      occurredAt: event.occurredAt,
    }
  }

  if (event.type === "use") {
    return {
      itemName: event.itemName,
      movementKind: "use",
      quantity: event.quantity,
      totalValue: event.totalValue,
      occurredAt: event.occurredAt,
    }
  }

  if (event.type === "waste") {
    return {
      itemName: event.itemName,
      movementKind: "waste",
      quantity: event.quantity,
      totalValue: event.totalValue,
      occurredAt: event.occurredAt,
    }
  }

  return null
}

function toLegacyIncomeMovementRecord(item: InventoryItem): ReportMovementRecord {
  return {
    itemName: item.name,
    movementKind: "income",
    quantity: item.amount,
    totalValue: item.amount * item.pricePerUnit,
    occurredAt: item.buyingDate,
  }
}

export function MovementHistoryPage() {
  const router = useRouter()
  const { state, businesses, setBusiness } = useInventory()
  const { user, employees } = useAuth()
  const { businessId, isHydrated, items } = state

  const [events, setEvents] = useState<InventoryEvent[]>([])
  const [filter, setFilter] = useState<MovementFilter>("all")
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 6)
    return toDateInputValue(date)
  })
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()))

  const isAdmin = user?.role === "admin"
  const employeeData = employees?.find((employee) => employee.code === user?.code)
  const filteredBusinesses = isAdmin
    ? businesses
    : businesses.filter((business) => employeeData?.businessIds?.includes(business.id))
  const allowedBusinesses = isAdmin ? businesses : filteredBusinesses
  const employeeHasAssignedBusinesses = isAdmin || filteredBusinesses.length > 0

  useEffect(() => {
    if (typeof window === "undefined") return

    const syncEvents = () => {
      setEvents(loadInventoryEvents())
    }

    syncEvents()
    const interval = setInterval(syncEvents, 3000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isHydrated || !user || user.role === "admin") return
    if (!filteredBusinesses.length) {
      if (businessId) {
        setBusiness("")
      }
      return
    }

    const valid = filteredBusinesses.some((business) => business.id === businessId)
    if (!valid) {
      setBusiness(filteredBusinesses[0].id)
    }
  }, [isHydrated, businessId, filteredBusinesses, user, setBusiness])

  const businessEvents = useMemo(
    () => events.filter((event) => event.businessId === businessId),
    [events, businessId]
  )

  const businessItems = useMemo(
    () => items.filter((item) => item.businessId === businessId),
    [items, businessId]
  )

  const legacyIncomeEntries = useMemo(
    () =>
      businessItems
        .filter((item) => isWithinLegacyLookback(item.buyingDate))
        .filter((item) => !hasRecordedPurchaseEvent(item, businessEvents))
        .map(toLegacyIncomeEntry),
    [businessItems, businessEvents]
  )

  const entries = useMemo(
    () => [...businessEvents.map(toHistoryEntry), ...legacyIncomeEntries]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [businessEvents, legacyIncomeEntries]
  )

  const reportMovements = useMemo(
    () => [
      ...businessEvents.map(toReportMovementRecord).filter((event): event is ReportMovementRecord => event !== null),
      ...businessItems
        .filter((item) => !hasRecordedPurchaseEvent(item, businessEvents))
        .map(toLegacyIncomeMovementRecord),
    ],
    [businessEvents, businessItems]
  )

  const reportRows = useMemo<ItemMovementSummaryExportRow[]>(() => {
    const totals = new Map<string, ItemMovementSummaryExportRow>()

    for (const movement of reportMovements) {
      if (!isWithinDateRange(movement.occurredAt, startDate, endDate)) continue

      const current = totals.get(movement.itemName) ?? {
        itemName: movement.itemName,
        incomeQuantity: 0,
        incomeValue: 0,
        useQuantity: 0,
        useValue: 0,
        wasteQuantity: 0,
        wasteValue: 0,
      }

      if (movement.movementKind === "income") {
        current.incomeQuantity += movement.quantity
        current.incomeValue += movement.totalValue
      }

      if (movement.movementKind === "use") {
        current.useQuantity += movement.quantity
        current.useValue += movement.totalValue
      }

      if (movement.movementKind === "waste") {
        current.wasteQuantity += movement.quantity
        current.wasteValue += movement.totalValue
      }

      totals.set(movement.itemName, current)
    }

    return Array.from(totals.values()).sort((a, b) => a.itemName.localeCompare(b.itemName, "es", { sensitivity: "base" }))
  }, [reportMovements, startDate, endDate])

  const visibleEntries = useMemo(() => {
    if (filter === "all") return entries
    return entries.filter((entry) => entry.movementType === filter)
  }, [entries, filter])

  const activeBusinessName = businesses.find((business) => business.id === businessId)?.name || "Negocio"
  const hasValidRange = startDate <= endDate

  async function handleExportHistory() {
    await exportMovementHistoryToExcel(activeBusinessName, visibleEntries.map((entry) => ({
      occurredAt: formatEventDate(entry.occurredAt),
      movementType: entry.title,
      itemName: entry.itemName,
      detail: entry.detail,
    })))
  }

  async function handleExportSummary() {
    if (!hasValidRange) return
    await exportItemMovementSummaryToExcel(activeBusinessName, startDate, endDate, reportRows)
  }

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Package className="size-8 animate-pulse" />
          <span className="text-sm">Cargando historial...</span>
        </div>
      </div>
    )
  }

  const hasActiveBusiness = !!businessId

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!hasActiveBusiness && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6">
          <Store className="size-12 mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Historial de movimientos</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-xs">
            {isAdmin || employeeHasAssignedBusinesses
              ? "Selecciona un negocio para ver su historial."
              : "Tu cuenta no tiene un negocio asignado. Pidele al administrador que te vincule a un negocio."}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {allowedBusinesses.map((business) => (
              <Button key={business.id} onClick={() => setBusiness(business.id)} className="w-full">
                <Store className="size-4 mr-2" />
                {business.name}
              </Button>
            ))}
            <Button variant="outline" onClick={() => router.push("/inventory")}>
              <ArrowLeft className="size-4 mr-2" />
              Volver a inventario
            </Button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push("/inventory")} aria-label="Volver a inventario">
              <ArrowLeft className="size-5" />
            </Button>
            <History className="size-5 text-muted-foreground" />
            <h1 className="text-xl font-bold sm:text-2xl">Historial - {activeBusinessName}</h1>
          </div>
          <BusinessSelector
            businesses={allowedBusinesses}
            selectedId={businessId}
            onSelect={setBusiness}
            minimal
            showManage={false}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Todos</Button>
          <Button variant={filter === "income" ? "default" : "outline"} size="sm" onClick={() => setFilter("income")}>
            <Plus className="size-4" />
            Ingresos
          </Button>
          <Button variant={filter === "output" ? "default" : "outline"} size="sm" onClick={() => setFilter("output")}>
            <Minus className="size-4" />
            Egresos
          </Button>
          <Button variant={filter === "modification" ? "default" : "outline"} size="sm" onClick={() => setFilter("modification")}>
            <Pencil className="size-4" />
            Modificaciones
          </Button>
        </div>

        <div className="grid gap-3 rounded-lg border bg-card p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Desde</label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Hasta</label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="outline" onClick={handleExportHistory} disabled={visibleEntries.length === 0}>
              <Download className="size-4" />
              Descargar historial
            </Button>
            <Button onClick={handleExportSummary} disabled={!hasValidRange || reportRows.length === 0}>
              <FileDown className="size-4" />
              Reporte por item
            </Button>
          </div>
          {!hasValidRange && (
            <p className="text-sm text-destructive lg:col-span-2">La fecha inicial no puede ser mayor que la fecha final.</p>
          )}
        </div>

        {visibleEntries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
            <History className="size-10 opacity-40" />
            <p className="text-sm text-center px-4">No hay movimientos para este filtro en el restaurante seleccionado.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleEntries.map((entry) => (
              <article key={entry.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{entry.title}: {entry.itemName}</p>
                    <p className="text-sm text-muted-foreground">{entry.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatEventDate(entry.occurredAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
