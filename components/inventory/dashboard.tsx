"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useInventory } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import { type InventoryEvent, loadInventoryEvents } from "@/lib/inventory-events"
import { type InventoryItem, getAlerts, getDaysUntilExpiration, isLowStock } from "@/lib/types"
import { exportToExcel, exportToJSON, importFromJSON } from "@/lib/export-excel"
import { formatNumber, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { BusinessSelector } from "./business-selector"
import { BusinessesDialog } from "./businesses-dialog"
import { CategoryDialog } from "./category-dialog"
import { SettingsDialog } from "./settings-dialog"
import { EmployeeDialog } from "./employee-dialog"
import { AdminDialog } from "./admin-dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  LayoutDashboard,
  Package,
  History,
  TriangleAlert,
  TrendingUp,
  TrendingDown,
  Wallet,
  Store,
  LogOut,
  Settings,
  Box,
  Download,
  FileDown,
  Save,
  Upload,
  Users,
  ShieldUser,
} from "lucide-react"

type PeriodRange = 7 | 30

interface DailySeriesPoint {
  label: string
  purchase: number
  output: number
}

interface SummaryTotals {
  purchase: number
  use: number
  waste: number
}

interface WasteSummary {
  itemName: string
  totalValue: number
  totalQty: number
}

interface StockProjection {
  itemName: string
  stock: number
  avgDailyOutput: number
  daysRemaining: number | null
}

interface OutputSummaryTotals {
  use: number
  waste: number
}

const DASHBOARD_IMPORT_NOTICE_KEY = "inventory-dashboard-import-notice"

function formatMoney(value: number): string {
  return `L. ${formatNumber(value)}`
}

function getPeriodStart(days: PeriodRange): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (days - 1))
  return date
}

function buildSeries(
  purchases: Array<{ date: string; totalValue: number }>,
  outputs: InventoryEvent[],
  days: PeriodRange
): DailySeriesPoint[] {
  const start = getPeriodStart(days)
  const map = new Map<string, { purchase: number; output: number }>()

  for (let index = 0; index < days; index++) {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    const key = day.toISOString().slice(0, 10)
    map.set(key, { purchase: 0, output: 0 })
  }

  for (const purchase of purchases) {
    const key = purchase.date.slice(0, 10)
    const current = map.get(key)
    if (!current) continue

    current.purchase += purchase.totalValue
  }

  for (const event of outputs) {
    const key = event.occurredAt.slice(0, 10)
    const current = map.get(key)
    if (!current) continue

    if (event.type === "use" || event.type === "waste") {
      current.output += event.totalValue
    }
  }

  return Array.from(map.entries()).map(([key, value]) => {
    const date = new Date(`${key}T00:00:00`)
    return {
      label: date.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit" }),
      purchase: value.purchase,
      output: value.output,
    }
  })
}

function buildOutputSummary(events: InventoryEvent[]): OutputSummaryTotals {
  const totals: OutputSummaryTotals = {
    use: 0,
    waste: 0,
  }

  for (const event of events) {
    if (event.type === "use") totals.use += event.totalValue
    if (event.type === "waste") totals.waste += event.totalValue
  }

  return totals
}

function getPurchaseValueInRange(items: InventoryItem[], start: Date, end?: Date): number {
  return items
    .filter((item) => {
      const buyingDate = new Date(item.buyingDate)
      if (Number.isNaN(buyingDate.getTime())) return false
      if (end) return buyingDate >= start && buyingDate <= end
      return buyingDate >= start
    })
    .reduce((sum, item) => sum + item.amount * item.pricePerUnit, 0)
}

function getPurchaseEntriesInRange(items: InventoryItem[], start: Date): Array<{ date: string; totalValue: number }> {
  return items
    .filter((item) => {
      const buyingDate = new Date(item.buyingDate)
      return !Number.isNaN(buyingDate.getTime()) && buyingDate >= start
    })
    .map((item) => ({
      date: new Date(item.buyingDate).toISOString(),
      totalValue: item.amount * item.pricePerUnit,
    }))
}

function formatPercentDelta(current: number, previous: number): string {
  if (previous === 0) {
    if (current === 0) return "0%"
    return "Nuevo"
  }

  const change = ((current - previous) / previous) * 100
  const sign = change > 0 ? "+" : ""
  return `${sign}${formatNumber(change, 1)}%`
}

function getProjectionTone(daysRemaining: number | null): string {
  if (daysRemaining === null) return "text-muted-foreground"
  if (daysRemaining <= 3) return "text-red-600"
  if (daysRemaining <= 7) return "text-amber-600"
  return "text-emerald-600"
}

export function Dashboard() {
  const router = useRouter()
  const { state, categories, businesses, addCategory, editCategory, deleteCategory, importData, setBusiness, updateBusinesses } = useInventory()
  const { user, logout, employees, permissions } = useAuth()
  const { items, businessId, isHydrated, nameHistory } = state

  const [manageOpen, setManageOpen] = useState(false)
  const [period, setPeriod] = useState<PeriodRange>(7)
  const [events, setEvents] = useState<InventoryEvent[]>([])
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [employeeOpen, setEmployeeOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  const isAdmin = user?.role === "admin"
  const employeeData = employees?.find((employee) => employee.code === user?.code)
  const filteredBusinesses = isAdmin
    ? businesses
    : businesses.filter((business) => employeeData?.businessIds?.includes(business.id))
  const allowedBusinesses = isAdmin ? businesses : filteredBusinesses
  const employeeHasAssignedBusinesses = isAdmin || filteredBusinesses.length > 0

  useEffect(() => {
    if (!isAdmin && manageOpen) {
      setManageOpen(false)
    }
  }, [isAdmin, manageOpen])

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

  useEffect(() => {
    let cancelled = false

    const syncEvents = async () => {
      const loaded = await loadInventoryEvents()
      if (!cancelled) setEvents(loaded)
    }

    syncEvents()
    const interval = setInterval(syncEvents, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const businessItems = useMemo(
    () => items.filter((item) => item.businessId === businessId),
    [items, businessId]
  )

  const businessEvents = useMemo(
    () => events.filter((event) => event.businessId === businessId),
    [events, businessId]
  )

  const periodStart = useMemo(() => getPeriodStart(period), [period])

  const previousPeriodRange = useMemo(() => {
    const previousEnd = new Date(periodStart)
    previousEnd.setDate(previousEnd.getDate() - 1)
    previousEnd.setHours(23, 59, 59, 999)

    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - (period - 1))
    previousStart.setHours(0, 0, 0, 0)

    return { previousStart, previousEnd }
  }, [periodStart, period])

  const periodEvents = useMemo(
    () => businessEvents.filter((event) => new Date(event.occurredAt) >= periodStart),
    [businessEvents, periodStart]
  )

  const periodOutputEvents = useMemo(
    () => periodEvents.filter((event) => event.type === "use" || event.type === "waste"),
    [periodEvents]
  )

  const previousPeriodEvents = useMemo(
    () =>
      businessEvents.filter((event) => {
        const eventDate = new Date(event.occurredAt)
        return eventDate >= previousPeriodRange.previousStart && eventDate <= previousPeriodRange.previousEnd
      }),
    [businessEvents, previousPeriodRange]
  )

  const previousPeriodOutputEvents = useMemo(
    () => previousPeriodEvents.filter((event) => event.type === "use" || event.type === "waste"),
    [previousPeriodEvents]
  )

  const totalInventoryValue = useMemo(
    () => businessItems.reduce((sum, item) => sum + item.amount * item.pricePerUnit, 0),
    [businessItems]
  )

  const currentPurchaseValue = useMemo(
    () => getPurchaseValueInRange(businessItems, periodStart),
    [businessItems, periodStart]
  )

  const previousPurchaseValue = useMemo(
    () => getPurchaseValueInRange(businessItems, previousPeriodRange.previousStart, previousPeriodRange.previousEnd),
    [businessItems, previousPeriodRange]
  )

  const outputSummary = useMemo(() => buildOutputSummary(periodOutputEvents), [periodOutputEvents])
  const previousOutputSummary = useMemo(() => buildOutputSummary(previousPeriodOutputEvents), [previousPeriodOutputEvents])

  const summary = useMemo<SummaryTotals>(
    () => ({ purchase: currentPurchaseValue, use: outputSummary.use, waste: outputSummary.waste }),
    [currentPurchaseValue, outputSummary]
  )

  const previousSummary = useMemo<SummaryTotals>(
    () => ({ purchase: previousPurchaseValue, use: previousOutputSummary.use, waste: previousOutputSummary.waste }),
    [previousPurchaseValue, previousOutputSummary]
  )

  const alerts = useMemo(() => getAlerts(businessItems), [businessItems])

  const criticalAlerts = useMemo(() => {
    const sorted = [...alerts].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "expiration" ? -1 : 1
      }
      return a.message.localeCompare(b.message, "es")
    })

    return sorted.slice(0, 5)
  }, [alerts])

  const stockHealth = useMemo(() => {
    const lowStockCount = businessItems.filter((item) => isLowStock(item, businessItems)).length
    const expiringSoonCount = businessItems.filter((item) => getDaysUntilExpiration(item.expirationDate) <= 5).length

    return {
      lowStockCount,
      expiringSoonCount,
      activeItems: businessItems.filter((item) => item.amount > 0).length,
    }
  }, [businessItems])

  const periodPurchaseEntries = useMemo(
    () => getPurchaseEntriesInRange(businessItems, periodStart),
    [businessItems, periodStart]
  )

  const chartSeries = useMemo(
    () => buildSeries(periodPurchaseEntries, periodOutputEvents, period),
    [periodPurchaseEntries, periodOutputEvents, period]
  )
  const chartSeriesRecentFirst = useMemo(() => [...chartSeries].reverse(), [chartSeries])
  const maxChartValue = useMemo(() => {
    const max = Math.max(
      ...chartSeries.map((point) => Math.max(point.purchase, point.output)),
      1
    )
    return max
  }, [chartSeries])

  const hasActiveBusiness = !!businessId
  const currentBusiness = businesses.find((business) => business.id === businessId)
  const businessName = currentBusiness ? currentBusiness.name : "Negocio"

  const topWasteItems = useMemo(() => {
    const wasteByItem = new Map<string, WasteSummary>()

    for (const event of periodEvents) {
      if (event.type !== "waste") continue
      const current = wasteByItem.get(event.itemName)
      if (current) {
        current.totalValue += event.totalValue
        current.totalQty += event.quantity
      } else {
        wasteByItem.set(event.itemName, {
          itemName: event.itemName,
          totalValue: event.totalValue,
          totalQty: event.quantity,
        })
      }
    }

    return Array.from(wasteByItem.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 5)
  }, [periodEvents])

  const stockProjections = useMemo(() => {
    const stockByName = new Map<string, number>()
    for (const item of businessItems) {
      if (item.amount <= 0) continue
      const key = item.name.toLowerCase()
      stockByName.set(key, (stockByName.get(key) ?? 0) + item.amount)
    }

    const outputByName = new Map<string, number>()
    for (const event of periodEvents) {
      if (event.type !== "use" && event.type !== "waste") continue
      const key = event.itemName.toLowerCase()
      outputByName.set(key, (outputByName.get(key) ?? 0) + event.quantity)
    }

    const projections: StockProjection[] = []
    for (const [nameKey, stock] of stockByName.entries()) {
      const avgDailyOutput = (outputByName.get(nameKey) ?? 0) / period
      const sourceItem = businessItems.find((item) => item.name.toLowerCase() === nameKey)
      const itemName = sourceItem?.name ?? nameKey

      projections.push({
        itemName,
        stock,
        avgDailyOutput,
        daysRemaining: avgDailyOutput > 0 ? stock / avgDailyOutput : null,
      })
    }

    return projections
      .sort((a, b) => {
        if (a.daysRemaining === null && b.daysRemaining === null) return 0
        if (a.daysRemaining === null) return 1
        if (b.daysRemaining === null) return -1
        return a.daysRemaining - b.daysRemaining
      })
      .slice(0, 5)
  }, [businessItems, periodEvents, period])

  const netFlow = summary.purchase - (summary.use + summary.waste)

  useEffect(() => {
    if (typeof window === "undefined") return

    const raw = localStorage.getItem(DASHBOARD_IMPORT_NOTICE_KEY)
    if (!raw) {
      setImportNotice(null)
      return
    }

    try {
      const parsed = JSON.parse(raw) as { expiresAt?: number; message?: string }
      if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
        localStorage.removeItem(DASHBOARD_IMPORT_NOTICE_KEY)
        setImportNotice(null)
        return
      }

      setImportNotice(parsed.message ?? "Backup legado importado sin historial completo para dashboard.")
    } catch {
      localStorage.removeItem(DASHBOARD_IMPORT_NOTICE_KEY)
      setImportNotice(null)
    }
  }, [])

  async function handleExportReportExcel() {
    const XLSX = await import("xlsx")
    const periodLabel = period === 7 ? "Ultimos 7 dias" : "Ultimos 30 dias"

    const totalsRows = [
      { Indicador: "Periodo", Valor: periodLabel },
      { Indicador: "Negocio", Valor: businessName },
      { Indicador: "Producto ingresado", Valor: summary.purchase },
      { Indicador: "Producto usado", Valor: summary.use },
      { Indicador: "Producto mermado", Valor: summary.waste },
      { Indicador: "Valor total inventario", Valor: totalInventoryValue },
      { Indicador: "Balance de flujo", Valor: netFlow },
    ]

    const comparisonRows = [
      {
        Indicador: "Ingresado",
        Actual: summary.purchase,
        Anterior: previousSummary.purchase,
        Cambio: formatPercentDelta(summary.purchase, previousSummary.purchase),
      },
      {
        Indicador: "Usado",
        Actual: summary.use,
        Anterior: previousSummary.use,
        Cambio: formatPercentDelta(summary.use, previousSummary.use),
      },
      {
        Indicador: "Mermado",
        Actual: summary.waste,
        Anterior: previousSummary.waste,
        Cambio: formatPercentDelta(summary.waste, previousSummary.waste),
      },
      {
        Indicador: "Flujo neto",
        Actual: netFlow,
        Anterior: previousSummary.purchase - (previousSummary.use + previousSummary.waste),
        Cambio: formatPercentDelta(
          netFlow,
          previousSummary.purchase - (previousSummary.use + previousSummary.waste)
        ),
      },
    ]

    const wasteRows = topWasteItems.map((item) => ({
      Producto: item.itemName,
      "Cantidad mermada": item.totalQty,
      "Valor mermado": item.totalValue,
    }))

    const projectionRows = stockProjections.map((item) => ({
      Producto: item.itemName,
      Stock: item.stock,
      "Salida diaria promedio": item.avgDailyOutput,
      "Dias restantes": item.daysRemaining === null ? "Sin consumo" : Number(item.daysRemaining.toFixed(1)),
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totalsRows), "Resumen")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comparisonRows), "Comparativo")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wasteRows), "Top Mermas")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectionRows), "Proyeccion")

    XLSX.writeFile(wb, `dashboard-reporte-${businessId || "negocio"}-${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  function handleExportReportPdf() {
    const periodLabel = period === 7 ? "Ultimos 7 dias" : "Ultimos 30 dias"
    const popup = window.open("", "_blank", "width=900,height=700")
    if (!popup) return

    const wasteHtml =
      topWasteItems.length > 0
        ? topWasteItems
            .map(
              (item) =>
                `<tr><td>${item.itemName}</td><td>${formatNumber(item.totalQty)}</td><td>${formatMoney(item.totalValue)}</td></tr>`
            )
            .join("")
        : '<tr><td colspan="3">Sin mermas en este periodo.</td></tr>'

    const projectionHtml =
      stockProjections.length > 0
        ? stockProjections
            .map(
              (item) =>
                `<tr><td>${item.itemName}</td><td>${formatNumber(item.stock)}</td><td>${formatNumber(item.avgDailyOutput, 2)}</td><td>${
                  item.daysRemaining === null ? "Sin consumo" : `${formatNumber(item.daysRemaining, 1)} dias`
                }</td></tr>`
            )
            .join("")
        : '<tr><td colspan="4">Sin datos para proyeccion.</td></tr>'

    popup.document.write(`
      <html>
        <head>
          <title>Reporte Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1, h2 { margin-bottom: 6px; }
            .muted { color: #475569; margin-bottom: 18px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f1f5f9; }
            .kpi { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
            .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
          </style>
        </head>
        <body>
          <h1>Reporte de Dashboard</h1>
          <div class="muted">Negocio: ${businessName} | Periodo: ${periodLabel}</div>

          <div class="kpi">
            <div class="box"><strong>Ingresado:</strong> ${formatMoney(summary.purchase)}</div>
            <div class="box"><strong>Usado:</strong> ${formatMoney(summary.use)}</div>
            <div class="box"><strong>Mermado:</strong> ${formatMoney(summary.waste)}</div>
            <div class="box"><strong>Inventario total:</strong> ${formatMoney(totalInventoryValue)}</div>
          </div>

          <h2>Comparativo contra periodo anterior</h2>
          <table>
            <thead>
              <tr><th>Indicador</th><th>Actual</th><th>Anterior</th><th>Cambio</th></tr>
            </thead>
            <tbody>
              <tr><td>Ingresado</td><td>${formatMoney(summary.purchase)}</td><td>${formatMoney(previousSummary.purchase)}</td><td>${formatPercentDelta(summary.purchase, previousSummary.purchase)}</td></tr>
              <tr><td>Usado</td><td>${formatMoney(summary.use)}</td><td>${formatMoney(previousSummary.use)}</td><td>${formatPercentDelta(summary.use, previousSummary.use)}</td></tr>
              <tr><td>Mermado</td><td>${formatMoney(summary.waste)}</td><td>${formatMoney(previousSummary.waste)}</td><td>${formatPercentDelta(summary.waste, previousSummary.waste)}</td></tr>
            </tbody>
          </table>

          <h2>Top mermas</h2>
          <table>
            <thead><tr><th>Producto</th><th>Cantidad mermada</th><th>Valor mermado</th></tr></thead>
            <tbody>${wasteHtml}</tbody>
          </table>

          <h2>Proyeccion de quiebre</h2>
          <table>
            <thead><tr><th>Producto</th><th>Stock</th><th>Salida diaria promedio</th><th>Dias restantes</th></tr></thead>
            <tbody>${projectionHtml}</tbody>
          </table>
        </body>
      </html>
    `)

    popup.document.close()
    popup.focus()
    popup.print()
  }

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Package className="size-8 animate-pulse" />
          <span className="text-sm">Cargando dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-[-120px] top-[320px] h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />
      </div>
      {!hasActiveBusiness && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
          <Package className="mb-4 size-12 text-primary" />
          <h2 className="mb-2 text-2xl font-bold">Bienvenido</h2>
          <p className="mb-6 max-w-xs text-center text-muted-foreground">
            {isAdmin || employeeHasAssignedBusinesses
              ? "Selecciona un negocio para abrir el dashboard."
              : "Tu cuenta no tiene un negocio asignado. Pidele al administrador que te vincule a un negocio."}
          </p>
          <div className="flex w-full max-w-xs flex-col gap-3">
            {allowedBusinesses.map((business) => (
              <Button key={business.id} onClick={() => setBusiness(business.id)} className="w-full">
                <Store className="mr-2 size-4" />
                {business.name}
              </Button>
            ))}
            {isAdmin && (
              <Button variant="outline" onClick={() => setManageOpen(true)}>
                <Settings className="mr-2 size-4" />
                Administrar negocios
              </Button>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 mt-3 border-b border-cyan-500/20 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-h-11 items-center gap-2 md:min-h-0">
            <Drawer direction="left">
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Package className="size-6 text-muted-foreground" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <div className="flex h-full flex-col justify-between px-4 py-2">
                  <div className="flex flex-col gap-2">
                    <div className="mb-2">
                      <BusinessSelector
                        businesses={allowedBusinesses}
                        selectedId={businessId}
                        onSelect={setBusiness}
                        onManage={isAdmin ? () => setManageOpen(true) : undefined}
                        minimal
                        showManage={isAdmin}
                      />
                    </div>
                    <DrawerClose asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/inventory")}
                      >
                        <Box className="size-4" />
                        Ir a inventario
                      </Button>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/history")}
                      >
                        <History className="size-4" />
                        Historial
                      </Button>
                    </DrawerClose>
                    {permissions.canManageCategories && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCategoryDialogOpen(true)}
                      >
                        Editar categorias
                      </Button>
                    )}
                    {permissions.canExportExcel && (
                      <DrawerClose asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportToExcel(businessItems)}
                          disabled={businessItems.length === 0}
                        >
                          <Download className="size-4" />
                          Exportar Excel
                        </Button>
                      </DrawerClose>
                    )}
                    {permissions.canBackupJSON && (
                      <DrawerClose asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            exportToJSON({
                              version: 3,
                              items,
                              categoriesByBusiness: state.categoriesByBusiness,
                              nameHistory,
                              nextBatchNumber: state.nextBatchNumber,
                              events,
                              businesses,
                            })
                          }
                          disabled={items.length === 0}
                        >
                          <Save className="size-4" />
                          Backup JSON
                        </Button>
                      </DrawerClose>
                    )}
                    {permissions.canImportBackup && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => importFromJSON((data) => importData(data), { fallbackBusinessId: businessId })}
                        disabled={!hasActiveBusiness}
                      >
                        <Upload className="size-4" />
                        Importar Backup
                      </Button>
                    )}
                  </div>
                  <CategoryDialog
                    open={categoryDialogOpen}
                    onOpenChange={setCategoryDialogOpen}
                    categories={categories}
                    items={businessItems}
                    onAdd={addCategory}
                    onEdit={editCategory}
                    onDelete={deleteCategory}
                  />
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex justify-center">
                      <ThemeToggle />
                    </div>
                    {user?.role === "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdminOpen(true)}
                      >
                        <ShieldUser className="size-4" />
                        Administradores
                      </Button>
                    )}
                    {user?.role === "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSettingsOpen(true)}
                      >
                        <Settings className="size-4" />
                        Permisos
                      </Button>
                    )}
                    {user?.role === "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEmployeeOpen(true)}
                      >
                        <Users className="size-4" />
                        Empleados
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={logout}>
                      <LogOut className="size-4" />
                      Cerrar sesion
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      {user?.role === "admin" ? "Admin" : "Empleado"}: {employeeData?.name ?? user?.code}
                    </p>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
            <h1 className="max-w-[calc(100vw-6rem)] truncate text-lg font-bold text-foreground sm:max-w-none sm:text-xl md:text-2xl md:whitespace-nowrap">
              {businessName} - Dashboard
            </h1>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1 md:mt-0 md:flex md:items-center md:justify-end md:gap-2">
            <Button variant="outline" size="sm" onClick={handleExportReportExcel} disabled={!hasActiveBusiness} className="h-8 min-w-0 gap-1 px-1.5 text-[11px] border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 md:h-9 md:px-3 md:text-sm">
              <Download className="size-3.5 shrink-0 md:size-4" />
              <span>Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportReportPdf} disabled={!hasActiveBusiness} className="h-8 min-w-0 gap-1 px-1.5 text-[11px] border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 md:h-9 md:px-3 md:text-sm">
              <FileDown className="size-3.5 shrink-0 md:size-4" />
              <span>PDF</span>
            </Button>
            <Button
              variant={period === 7 ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(7)}
              className={cn("h-8 min-w-0 px-1.5 text-[11px] md:h-9 md:px-3 md:text-sm", period === 7 && "bg-emerald-600 hover:bg-emerald-700")}
            >
              <span className="md:hidden">7 dias</span>
              <span className="hidden md:inline">Ultimos 7 dias</span>
            </Button>
            <Button
              variant={period === 30 ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(30)}
              className={cn("h-8 min-w-0 px-1.5 text-[11px] md:h-9 md:px-3 md:text-sm", period === 30 && "bg-indigo-600 hover:bg-indigo-700")}
            >
              <span className="md:hidden">30 dias</span>
              <span className="hidden md:inline">Ultimos 30 dias</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-background shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-600" />
                Producto ingresado
              </CardDescription>
              <CardTitle className="text-lg">{formatMoney(summary.purchase)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Valor total comprado en el periodo.</p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/15 to-background shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Box className="size-4 text-blue-600" />
                Producto usado
              </CardDescription>
              <CardTitle className="text-lg">{formatMoney(summary.use)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Salidas registradas por uso de produccion.</p>
            </CardContent>
          </Card>

          <Card className="border-rose-500/30 bg-gradient-to-br from-rose-500/15 to-background shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-rose-600" />
                Producto mermado
              </CardDescription>
              <CardTitle className="text-lg">{formatMoney(summary.waste)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Perdida por mermas registradas en el periodo.</p>
            </CardContent>
          </Card>

          <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-background shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="size-4 text-violet-600" />
                Valor total inventario
              </CardDescription>
              <CardTitle className="text-lg">{formatMoney(totalInventoryValue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Valor actual de todo el inventario activo.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 to-background lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="size-4 text-cyan-600" />
                Tendencia de entradas y salidas
              </CardTitle>
              <CardDescription>
                Comparativo diario de compras vs salidas para los ultimos {period} dias.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {chartSeriesRecentFirst.map((point) => (
                  <div key={point.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{point.label}</span>
                      <span>
                        +{formatNumber(point.purchase)} / -{formatNumber(point.output)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-2 rounded bg-emerald-200/70 dark:bg-emerald-900/50">
                        <div
                          className="h-2 rounded bg-emerald-500"
                          style={{ width: `${(point.purchase / maxChartValue) * 100}%` }}
                        />
                      </div>
                      <div className="h-2 rounded bg-rose-200/70 dark:bg-rose-900/50">
                        <div
                          className="h-2 rounded bg-rose-500"
                          style={{ width: `${(point.output / maxChartValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-amber-600" />
                Alertas prioritarias
              </CardTitle>
              <CardDescription>Acciones que debes revisar primero.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {importNotice && (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2">
                  <div className="mb-1 flex items-center gap-2">
                    <TriangleAlert className="size-4 text-amber-600" />
                    <p className="text-sm font-medium">Aviso de importacion</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{importNotice}</p>
                </div>
              )}
              {criticalAlerts.length > 0 ? (
                criticalAlerts.map((alert) => (
                  <div key={alert.id} className="rounded border border-border/60 bg-background/60 p-2">
                    <div className="mb-1 flex items-center gap-2">
                      <TriangleAlert className={cn("size-4", alert.type === "expiration" ? "text-amber-500" : "text-red-500")} />
                      <p className="text-sm font-medium">{alert.itemName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin alertas urgentes por ahora.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="size-4 text-emerald-600" />
                Articulos activos
              </CardDescription>
              <CardTitle className="text-2xl">{stockHealth.activeItems}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Lotes con cantidad mayor a cero.</p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-orange-600" />
                Stock bajo
              </CardDescription>
              <CardTitle className="text-2xl">{stockHealth.lowStockCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Productos por debajo de cantidad minima.</p>
            </CardContent>
          </Card>

          <Card className="border-sky-500/20 bg-sky-500/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-sky-600" />
                Por expirar ({"<="} 5 dias)
              </CardDescription>
              <CardTitle className="text-2xl">{stockHealth.expiringSoonCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Productos que requieren rotacion inmediata.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-indigo-500/20 bg-indigo-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="size-4 text-indigo-600" />
                Comparativo vs periodo anterior
              </CardTitle>
              <CardDescription>Cambio frente a los {period} dias anteriores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Ingresado</span>
                <span>{formatPercentDelta(summary.purchase, previousSummary.purchase)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Usado</span>
                <span>{formatPercentDelta(summary.use, previousSummary.use)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Mermado</span>
                <span>{formatPercentDelta(summary.waste, previousSummary.waste)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Flujo neto</span>
                <span>
                  {formatPercentDelta(
                    netFlow,
                    previousSummary.purchase - (previousSummary.use + previousSummary.waste)
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-emerald-600" />
                Balance de flujo
              </CardTitle>
              <CardDescription>Entrada menos salidas del periodo.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              {netFlow >= 0 ? (
                <TrendingUp className="size-5 text-emerald-600" />
              ) : (
                <TrendingDown className="size-5 text-red-600" />
              )}
              <p className="text-lg font-semibold">
                {formatMoney(netFlow)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-500/20 bg-rose-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4 text-rose-600" />
                Costo total de salida
              </CardTitle>
              <CardDescription>Uso + merma en el periodo.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Wallet className="size-5 text-muted-foreground" />
              <p className="text-lg font-semibold">{formatMoney(summary.use + summary.waste)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TriangleAlert className="size-4 text-rose-600" />
                Top 5 productos con mayor merma
              </CardTitle>
              <CardDescription>Por valor mermado durante el periodo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {topWasteItems.length > 0 ? (
                topWasteItems.map((item, index) => (
                  <div key={item.itemName} className="flex items-center justify-between rounded border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm">
                    <p>
                      {index + 1}. {item.itemName}
                    </p>
                    <p className="font-medium">{formatMoney(item.totalValue)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No hay mermas registradas en este periodo.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 to-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Box className="size-4 text-cyan-600" />
                Proyeccion de quiebre de stock
              </CardTitle>
              <CardDescription>Estimado con salida diaria promedio del periodo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {stockProjections.length > 0 ? (
                stockProjections.map((item, index) => (
                  <div key={item.itemName} className="rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p>
                        {index + 1}. {item.itemName}
                      </p>
                      <p className={cn("font-medium", getProjectionTone(item.daysRemaining))}>
                        {item.daysRemaining === null ? "Sin consumo" : `${formatNumber(item.daysRemaining, 1)} dias`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Stock: {formatNumber(item.stock)} | Salida diaria: {formatNumber(item.avgDailyOutput, 2)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aun no hay datos suficientes para proyectar quiebre.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {isAdmin && (
        <BusinessesDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          businesses={businesses}
          onAdd={(name) => updateBusinesses([...businesses, { id: Date.now().toString(), name }])}
          onEdit={(id, name) =>
            updateBusinesses(businesses.map((business) => (business.id === id ? { ...business, name } : business)))
          }
          onDelete={(id) => {
            updateBusinesses(businesses.filter((business) => business.id !== id))
            if (businessId === id) setBusiness("")
          }}
        />
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <AdminDialog
        open={adminOpen}
        onOpenChange={setAdminOpen}
      />

      <EmployeeDialog
        open={employeeOpen}
        onOpenChange={setEmployeeOpen}
        businesses={businesses}
      />
    </div>
  )
}
