"use client"

import { useState, useMemo, useCallback } from "react"
import { useInventory } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import {
  type InventoryItem,
  getExpirationStatus,
  getAlerts,
} from "@/lib/types"
import { exportToExcel, exportToJSON, importFromJSON } from "@/lib/export-excel"
import { formatNumber } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Download, Plus, Package, Minus, Menu, Save, Upload, LogOut, Settings } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { SearchBar } from "./search-bar"
import { CategoryNav } from "./category-nav"
import { AlertsPopover } from "./alerts-popover"
import { CategoryDialog } from "./category-dialog"
import { ItemCard } from "./item-card"
import { ItemDialog } from "./item-dialog"
import { DeleteDialog } from "./delete-dialog"
import { RemoveDialog } from "./remove-dialog"
import { BatchDetailDialog } from "./batch-detail-dialog"
import { SettingsDialog } from "./settings-dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"

// drawer components for hamburger menu
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"

const statusOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 }

export function Dashboard() {
  const { state, addItem, updateItem, deleteItem, reduceItem, addCategory, editCategory, deleteCategory, importData } = useInventory()
  const { user, logout, permissions } = useAuth()
  const { items, categories, nameHistory, isHydrated } = state

  const [search, setSearch] = useState("")
  const [itemSort, setItemSort] = useState<'batchAsc' | 'batchDesc' | 'alpha' | 'expiryAsc' | 'minAmount'>("batchAsc")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Unique item names for search suggestions
  const allNames = useMemo(
    () => Array.from(new Set(items.map((i) => i.name))),
    [items]
  )

  // Alerts
  const alerts = useMemo(() => getAlerts(items), [items])

  // Filter and sort items
  const displayedItems = useMemo(() => {
    let filtered = items

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter((i) =>
        i.name.toLowerCase().includes(q)
      )
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter((i) =>
        i.categories.includes(selectedCategory)
      )
    }

    // Separar vacíos y no vacíos
    const empty = filtered.filter(i => i.amount === 0)
    const nonEmpty = filtered.filter(i => i.amount > 0)

    // Ordenar por batch number global ascendente
    if (itemSort === "batchAsc") {
      return [
        ...empty,
        ...nonEmpty.sort((a, b) => a.batchNumber - b.batchNumber)
      ]
    }

    // Ordenar por batch number global descendente
    if (itemSort === "batchDesc") {
      return [
        ...empty,
        ...nonEmpty.sort((a, b) => b.batchNumber - a.batchNumber)
      ]
    }

    // Ordenar por nombre (A-Z)
    if (itemSort === "alpha") {
      return [
        ...empty,
        ...nonEmpty.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      ]
    }

    // Ordenar por fecha de caducidad más próxima
    if (itemSort === "expiryAsc") {
      return [
        ...empty,
        ...nonEmpty.sort((a, b) => {
          const dateA = new Date(a.expirationDate).getTime()
          const dateB = new Date(b.expirationDate).getTime()
          return dateA - dateB
        })
      ]
    }

    // Ordenar por cantidad mínima (global)
    if (itemSort === "minAmount") {
      // Agrupar por nombre para calcular cantidad global
      const nameMap = new Map<string, { total: number, minAmount: number | null }>()
      for (const i of nonEmpty) {
        const key = i.name.toLowerCase()
        if (!nameMap.has(key)) {
          nameMap.set(key, { total: 0, minAmount: i.minAmount ?? 0 })
        }
        const entry = nameMap.get(key)!
        entry.total += i.amount
        // Si hay diferentes minAmount, toma el menor
        if (i.minAmount !== null && (entry.minAmount === null || i.minAmount < entry.minAmount)) {
          entry.minAmount = i.minAmount
        }
      }
      // Clasificar items por debajo o arriba de minAmount global
      const belowMin: typeof nonEmpty = []
      const aboveMin: typeof nonEmpty = []
      for (const i of nonEmpty) {
        const entry = nameMap.get(i.name.toLowerCase())!
        if (entry.minAmount !== null && entry.total < entry.minAmount) {
          belowMin.push(i)
        } else {
          aboveMin.push(i)
        }
      }
      // Ordenar por minAmount ascendente dentro de cada grupo
      const sortByMin = (a: InventoryItem, b: InventoryItem) => {
        const minA = nameMap.get(a.name.toLowerCase())?.minAmount ?? 0
        const minB = nameMap.get(b.name.toLowerCase())?.minAmount ?? 0
        return minA - minB
      }
      return [
        ...empty,
        ...belowMin.sort(sortByMin),
        ...aboveMin.sort(sortByMin)
      ]
    }

    // Default: sin orden adicional
    return [...empty, ...nonEmpty]
  }, [items, search, selectedCategory, itemSort])

  const handleSaveNew = useCallback(
    (data: Omit<InventoryItem, "id" | "batchNumber" | "createdAt">) => {
      addItem(data)
    },
    [addItem]
  )

  const handleSaveEdit = useCallback(
    (data: Omit<InventoryItem, "id" | "batchNumber" | "createdAt">) => {
      if (editItem) {
        updateItem(editItem.id, data)
        setEditItem(null)
      }
    },
    [editItem, updateItem]
  )

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteItem(deleteTarget.id)
      setDeleteTarget(null)
    }
  }, [deleteTarget, deleteItem])

  const handleRemove = useCallback(
    (name: string, qty: number, usageType: "uso" | "merma") => {
      // perform reduction
      reduceItem(name, qty)
      // show alert for confirmation
      const item = items.find((i) => i.name.toLowerCase() === name.toLowerCase())
      const metric = item ? ` ${item.metric}` : ""
      const note = usageType ? ` (${usageType})` : ""
      alert(`Eliminar ${qty}${metric} de ${name}${note}`)
      setRemoveOpen(false)
    },
    [items, reduceItem]
  )

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Package className="size-8 animate-pulse" />
          <span className="text-sm">Cargando inventario...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* hamburger drawer trigger */}
            <Drawer direction="left">
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-2">
                  <Menu className="size-6 text-foreground" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                <DrawerTitle>Menú</DrawerTitle>
              </DrawerHeader>
                <div className="flex h-full flex-col justify-between px-4 py-2">
                  <div className="flex flex-col gap-2">
                    {permissions.canManageCategories && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCategoryDialogOpen(true)}
                      >
                        Editar categorías
                      </Button>
                    )}
                    <DrawerClose asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToExcel(items)}
                        disabled={items.length === 0}
                      >
                        <Download className="size-4" />
                        Exportar Excel
                      </Button>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToJSON({ items, categories, nameHistory, nextBatchNumber: state.nextBatchNumber })}
                        disabled={items.length === 0}
                      >
                        <Save className="size-4" />
                        Backup JSON
                      </Button>
                    </DrawerClose>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => importFromJSON((data) => importData(data))}
                    >
                      <Upload className="size-4" />
                      Importar Backup
                    </Button>
                  </div>
                        {/* Category Dialog */}
                        <CategoryDialog
                          open={categoryDialogOpen}
                          onOpenChange={setCategoryDialogOpen}
                          categories={categories}
                          items={items}
                          onAdd={addCategory}
                          onEdit={editCategory}
                          onDelete={deleteCategory}
                        />
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex justify-center">
                      <ThemeToggle />
                    </div>
                    {user?.role === "admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSettingsOpen(true)}
                      >
                        <Settings className="size-4" />
                        Configuracion
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={logout}
                    >
                      <LogOut className="size-4" />
                      Cerrar Sesion
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      {user?.role === "admin" ? "Admin" : "Empleado"}: {user?.code}
                    </p>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            <Package className="size-6 text-foreground" />
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Los Almendros - Inventario
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <AlertsPopover alerts={alerts} />
            {permissions.canEditItems && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                <span className="hidden sm:inline">Agregar</span>
              </Button>
            )}
            {permissions.canUseRemoveDialog && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRemoveOpen(true)}
                disabled={items.length === 0}
                className="hidden sm:inline-flex"
              >
                <Minus className="size-4" />
                Eliminar
              </Button>
            )}
            {permissions.canUseRemoveDialog && (
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={() => setRemoveOpen(true)}
                disabled={items.length === 0}
                className="sm:hidden"
                aria-label="Restar del inventario"
              >
                <Minus className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Filtro de item-cards + Search */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0"
                aria-label="Filtrar items"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Ordenar items</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setItemSort("batchAsc")}
                className={itemSort === "batchAsc" ? "font-semibold text-primary" : ""}
              >
                Por batch global (ascendente)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setItemSort("batchDesc")}
                className={itemSort === "batchDesc" ? "font-semibold text-primary" : ""}
              >
                Por batch global (descendente)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setItemSort("alpha")}
                className={itemSort === "alpha" ? "font-semibold text-primary" : ""}
              >
                Por nombre (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setItemSort("expiryAsc")}
                className={itemSort === "expiryAsc" ? "font-semibold text-primary" : ""}
              >
                Por fecha de caducidad (más próxima)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setItemSort("minAmount")}
                className={itemSort === "minAmount" ? "font-semibold text-primary" : ""}
              >
                Por cantidad mínima
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SearchBar value={search} onChange={setSearch} suggestions={allNames} />
        </div>

        {/* Category pills */}
        <CategoryNav
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          items={items}
        />

        {/* Total inventory value */}
        {permissions.canViewTotalValue && (
          <div className="bg-card border rounded-lg p-3">
            <p className="text-sm font-medium text-foreground">
              Valor Total del Inventario: L. {formatNumber(displayedItems.reduce((sum, item) => sum + (item.amount * item.pricePerUnit), 0))}
            </p>
          </div>
        )}

        {/* Item count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {displayedItems.length} articulo{displayedItems.length !== 1 ? "s" : ""}
            {selectedCategory ? ` en ${selectedCategory}` : ""}
            {search ? ` que coinciden con "${search}"` : ""}
          </p>
        </div>

        {/* Items grid */}
        {displayedItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={permissions.canEditItems ? setEditItem : () => {}}
                onDelete={(id) => {
                  if (permissions.canDeleteItems) {
                    const target = items.find((i) => i.id === id)
                    if (target) setDeleteTarget(target)
                  }
                }}
                onViewDetails={permissions.canViewBatchDetail ? setDetailItem : undefined}
                permissions={permissions}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Package className="size-12 opacity-20" />
            <p className="text-sm">
              {items.length === 0
                ? "Tu inventario esta vacio. Agrega tu primer articulo para comenzar."
                : "Ningun articulo coincide con tu busqueda o filtro."}
            </p>
            {items.length === 0 && permissions.canEditItems && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Agregar Primer Articulo
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Dialogs */}
      <ItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={handleSaveNew}
        categories={categories}
        nameHistory={nameHistory}
      />

      <ItemDialog
        open={!!editItem}
        onOpenChange={(o) => {
          if (!o) setEditItem(null)
        }}
        onSave={handleSaveEdit}
        categories={categories}
        nameHistory={nameHistory}
        editItem={editItem}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
        itemName={deleteTarget?.name ?? ""}
        onConfirm={handleConfirmDelete}
      />

      <RemoveDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onRemove={handleRemove}
        items={items}
      />

      <BatchDetailDialog
        open={!!detailItem}
        onOpenChange={(o) => {
          if (!o) setDetailItem(null)
        }}
        item={detailItem}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>
  )
}
