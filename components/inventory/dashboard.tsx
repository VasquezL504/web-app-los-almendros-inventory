"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useInventory } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import {
  type InventoryItem,
  getExpirationStatus,
  getAlerts,
} from "@/lib/types"
import { exportToExcel, exportToJSON, importFromJSON } from "@/lib/export-excel"
import { formatNumber, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Download, Plus, Package, Minus, Menu, Save, Upload, LogOut, Settings, Filter, Users, Store } from "lucide-react"
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
import { EmployeeDialog } from "./employee-dialog"
import { BusinessesDialog } from "./businesses-dialog"
import { BusinessSelector } from "./business-selector"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator
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

type SortType = 'added' | 'alpha' | 'lastBatch' | 'firstBatch'

interface FilterState {
  selectedCategory: string | null
  sortType: SortType
}

function loadFilterState(): FilterState {
  if (typeof window === "undefined") return { selectedCategory: null, sortType: 'added' }
  const saved = localStorage.getItem("inventory-filters")
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      return {
        selectedCategory: null,
        sortType: parsed.sortType ?? 'added'
      }
    } catch { return { selectedCategory: null, sortType: 'added' } }
  }
  return { selectedCategory: null, sortType: 'added' }
}

export function Dashboard() {
  const { state, categories, addItem, updateItem, deleteItem, reduceItem, addCategory, editCategory, deleteCategory, importData, setBusiness } = useInventory()
  const { user, logout, permissions, granularPermissions, employees } = useAuth()
  const { items, nameHistory, isHydrated, businessId } = state

  // Negocios globales (demo)
  const [businesses, setBusinesses] = useState([
    { id: "almendros", name: "Los Almendros" },
    { id: "palmas", name: "Las Palmas" }
  ])
  const [manageOpen, setManageOpen] = useState(false)

  // Filtrar negocios según usuario
  const isAdmin = user?.role === "admin"
  const employeeData = employees?.find(e => e.code === user?.code)
  const filteredBusinesses = isAdmin
    ? businesses
    : businesses.filter(b => employeeData?.businessIds?.includes(b.id))
  const allowedBusinesses = isAdmin ? businesses : filteredBusinesses

  const [search, setSearch] = useState("")
  const [itemSort, setItemSort] = useState<'batchAsc' | 'batchDesc' | 'alpha' | 'expiryAsc' | 'minAmount'>("batchAsc")
  const [filterState, setFilterState] = useState<FilterState>({ selectedCategory: null, sortType: 'added' })
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [employeeOpen, setEmployeeOpen] = useState(false)

  useEffect(() => {
    const saved = loadFilterState()
    setFilterState(saved)
    setSelectedCategory(null)
  }, [])

  // When employee logs in, ensure their active business is one they actually
  // have access to.  If the localStorage business belongs to a different user's
  // session, auto-switch to the first valid business for this employee.
  useEffect(() => {
    if (!isHydrated || !user || user.role === "admin") return
    if (!filteredBusinesses.length) return
    const valid = filteredBusinesses.some(b => b.id === businessId)
    if (!valid) {
      setBusiness(filteredBusinesses[0].id)
    }
  }, [isHydrated, businessId, filteredBusinesses, user, setBusiness])

  useEffect(() => {
    if (!isAdmin && manageOpen) {
      setManageOpen(false)
    }
  }, [isAdmin, manageOpen])

  // Unique item names for search suggestions
  // Filtrar items por negocio activo
  const filteredItems = useMemo(
    () => items.filter(i => i.businessId === businessId),
    [items, businessId]
  )

  const allNames = useMemo(
    () => Array.from(new Set(filteredItems.map((i) => i.name))),
    [filteredItems]
  )

  useEffect(() => {
    if (selectedCategory && !categories.includes(selectedCategory)) {
      setSelectedCategory(null)
    }
  }, [categories, selectedCategory, businessId])

  // Alerts
  const alerts = useMemo(() => getAlerts(filteredItems), [filteredItems])

  // Filter and sort items
  const displayedItems = useMemo(() => {
    let filtered = filteredItems

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
  }, [filteredItems, search, selectedCategory, itemSort])

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

  // Block all actions when no business is selected
  const hasActiveBusiness = !!businessId

  // Get current business name
  const currentBusiness = businesses.find(b => b.id === businessId)
  const businessName = currentBusiness ? currentBusiness.name : "Negocio"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Business setup overlay — shown when no business selected (first time or cleared) */}
      {!hasActiveBusiness && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6">
          <Package className="size-12 mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Bienvenido</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-xs">
            Selecciona un negocio para comenzar a usar el inventario.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {allowedBusinesses.map(b => (
              <Button key={b.id} onClick={() => setBusiness(b.id)} className="w-full">
                <Store className="size-4 mr-2" />
                {b.name}
              </Button>
            ))}
            {isAdmin && (
              <Button variant="outline" onClick={() => setManageOpen(true)}>
                <Settings className="size-4 mr-2" />
                Administrar negocios
              </Button>
            )}
          </div>
          {isAdmin && (
            <BusinessesDialog
              open={manageOpen}
              onOpenChange={setManageOpen}
              businesses={businesses}
              onAdd={name => setBusinesses([...businesses, { id: Date.now().toString(), name }])}
              onEdit={(id, name) => setBusinesses(businesses.map(b => b.id === id ? { ...b, name } : b))}
              onDelete={id => {
                setBusinesses(businesses.filter(b => b.id !== id))
                if (businessId === id) setBusiness("")
              }}
            />
          )}
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md mt-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Main menu button and title */}
          <div className="flex items-center gap-2">
            <Drawer direction="left">
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Package className="size-6 text-muted-foreground" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <div className="flex h-full flex-col justify-between px-4 py-2">
                  {/* Drawer menu content here (moved from previous header) */}
                  <div className="flex flex-col gap-2">
                    <div className="mb-2">
                      <div className="flex items-center gap-2">
                        <BusinessSelector
                          businesses={allowedBusinesses}
                          selectedId={businessId}
                          onSelect={setBusiness}
                          onManage={isAdmin ? () => setManageOpen(true) : undefined}
                          onDelete={isAdmin ? ((id: string) => {/* TODO: implement delete logic */}) : undefined}
                          minimal
                          showManage={isAdmin}
                        />
                      </div>
                      {isAdmin && (
                        <BusinessesDialog
                          open={manageOpen}
                          onOpenChange={setManageOpen}
                          businesses={businesses}
                          onAdd={name => setBusinesses([...businesses, { id: Date.now().toString(), name }])}
                          onEdit={(id, name) => setBusinesses(businesses.map(b => b.id === id ? { ...b, name } : b))}
                          onDelete={id => {
                            setBusinesses(businesses.filter(b => b.id !== id))
                            if (businessId === id) setBusiness("")
                          }}
                        />
                      )}
                    </div>
                    {permissions.canManageCategories && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCategoryDialogOpen(true)}
                      >
                        Editar categorías
                      </Button>
                    )}
                    {permissions.canExportExcel && (
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
                    )}
                    {permissions.canBackupJSON && (
                      <DrawerClose asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportToJSON({
                            version: 2,
                            items,
                            categoriesByBusiness: state.categoriesByBusiness,
                            nameHistory,
                            nextBatchNumber: state.nextBatchNumber,
                          })}
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
                    items={filteredItems}
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
            <h1 className="text-2xl font-bold text-foreground">
              {businessName} - Inventario
            </h1>
          </div>
          {/* Main header actions */}
          <div className="flex items-center gap-2">
            <AlertsPopover alerts={alerts} />
            <Button size="sm" onClick={() => setAddOpen(true)} disabled={!hasActiveBusiness}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Agregar</span>
            </Button>
            {permissions.canUseRemoveDialog && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRemoveOpen(true)}
                disabled={items.length === 0 || !hasActiveBusiness}
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
                disabled={items.length === 0 || !hasActiveBusiness}
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
                size="sm"
                className={cn(
                  "shrink-0 gap-2",
                  (filterState.sortType !== 'added' || itemSort !== "batchAsc") && "border-green-500 bg-green-50 dark:bg-green-950"
                )}
                aria-label="Filtros"
              >
                <Filter className={cn("size-4", filterState.sortType !== 'added' || itemSort !== "batchAsc" ? "text-green-600" : "")} />
                <span className="hidden sm:inline">Filtros</span>
                {(filterState.sortType !== 'added' || itemSort !== "batchAsc") && (
                  <span className="size-2 rounded-full bg-green-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto min-w-[350px]">
              <div className="grid grid-cols-2 gap-4 p-3">
                {/* Columna 1: Ordenar categorías */}
                <div className="space-y-2">
                  <DropdownMenuLabel className="text-xs font-semibold">Ordenar categorías</DropdownMenuLabel>
                  <div className="space-y-1">
                    <DropdownMenuItem
                      onClick={() => setFilterState(f => ({ ...f, sortType: 'added' }))}
                      className={cn("text-sm", filterState.sortType === 'added' && "font-semibold text-primary")}
                    >
                      Primer agregada {filterState.sortType === 'added' && "✓"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setFilterState(f => ({ ...f, sortType: 'alpha' }))}
                      className={cn("text-sm", filterState.sortType === 'alpha' && "font-semibold text-primary")}
                    >
                      Alfabético {filterState.sortType === 'alpha' && "✓"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setFilterState(f => ({ ...f, sortType: 'lastBatch' }))}
                      className={cn("text-sm", filterState.sortType === 'lastBatch' && "font-semibold text-primary")}
                    >
                      Último lote {filterState.sortType === 'lastBatch' && "✓"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setFilterState(f => ({ ...f, sortType: 'firstBatch' }))}
                      className={cn("text-sm", filterState.sortType === 'firstBatch' && "font-semibold text-primary")}
                    >
                      Primer lote {filterState.sortType === 'firstBatch' && "✓"}
                    </DropdownMenuItem>
                  </div>
                </div>

                {/* Columna 2: Ordenar items */}
                <div className="space-y-2">
                  <DropdownMenuLabel className="text-xs font-semibold">Ordenar items</DropdownMenuLabel>
                  <div className="space-y-1">
                    <DropdownMenuItem
                      onClick={() => setItemSort("batchAsc")}
                      className={cn("text-sm", itemSort === "batchAsc" && "font-semibold text-primary")}
                    >
                      Batch (↑) {itemSort === "batchAsc" && "✓"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setItemSort("batchDesc")}
                      className={cn("text-sm", itemSort === "batchDesc" && "font-semibold text-primary")}
                    >
                      Batch (↓) {itemSort === "batchDesc" && "✓"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setItemSort("alpha")}
                      className={cn("text-sm", itemSort === "alpha" && "font-semibold text-primary")}
                    >
                      Nombre (A-Z) {itemSort === "alpha" && "✓"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setItemSort("expiryAsc")}
                      className={cn("text-sm", itemSort === "expiryAsc" && "font-semibold text-primary")}
                    >
                      Caducidad {itemSort === "expiryAsc" && "✓"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setItemSort("minAmount")}
                      className={cn("text-sm", itemSort === "minAmount" && "font-semibold text-primary")}
                    >
                      Cant. mín. {itemSort === "minAmount" && "✓"}
                    </DropdownMenuItem>
                  </div>
                </div>
              </div>
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
          filterState={filterState}
          onFilterChange={setFilterState}
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
                onViewDetails={granularPermissions.showCardDetails !== "no" ? setDetailItem : undefined}
                permissions={granularPermissions}
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
            {items.length === 0 && hasActiveBusiness && (
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
        permissions={granularPermissions}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <EmployeeDialog
        open={employeeOpen}
        onOpenChange={setEmployeeOpen}
        businesses={businesses}
      />
    </div>
  )
}
