"use client"

import { useState, useMemo, useCallback } from "react"
import { useInventory } from "@/lib/inventory-context"
import {
  type InventoryItem,
  getExpirationStatus,
  getAlerts,
} from "@/lib/types"
import { exportToExcel } from "@/lib/export-excel"
import { Button } from "@/components/ui/button"
import { Download, Plus, Package, Minus } from "lucide-react"
import { SearchBar } from "./search-bar"
import { CategoryNav } from "./category-nav"
import { AlertsPopover } from "./alerts-popover"
import { ItemCard } from "./item-card"
import { ItemDialog } from "./item-dialog"
import { DeleteDialog } from "./delete-dialog"
import { RemoveDialog } from "./remove-dialog"

const statusOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 }

export function Dashboard() {
  const { state, addItem, updateItem, deleteItem, reduceItem } = useInventory()
  const { items, categories, nameHistory, isHydrated } = state

  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)

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

    // Sort: red first, then yellow, then green. Within same status, lower batch number first (FIFO)
    return [...filtered].sort((a, b) => {
      const sa = statusOrder[getExpirationStatus(a.expirationDate)] ?? 2
      const sb = statusOrder[getExpirationStatus(b.expirationDate)] ?? 2
      if (sa !== sb) return sa - sb
      return a.batchNumber - b.batchNumber
    })
  }, [items, search, selectedCategory])

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
            <Package className="size-6 text-foreground" />
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Los Almendros - Inventario
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <AlertsPopover alerts={alerts} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(items)}
              disabled={items.length === 0}
              className="hidden sm:inline-flex"
            >
              <Download className="size-4" />
              Exportar
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => exportToExcel(items)}
              disabled={items.length === 0}
              className="sm:hidden"
              aria-label="Exportar a Excel"
            >
              <Download className="size-4" />
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Agregar</span>
            </Button>
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
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Search */}
        <SearchBar value={search} onChange={setSearch} suggestions={allNames} />

        {/* Category pills */}
        <CategoryNav
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

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
                onEdit={setEditItem}
                onDelete={(id) => {
                  const target = items.find((i) => i.id === id)
                  if (target) setDeleteTarget(target)
                }}
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
            {items.length === 0 && (
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
    </div>
  )
}
