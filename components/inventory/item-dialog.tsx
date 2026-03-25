"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Search } from "lucide-react"
import { type InventoryItem, type Metric, METRICS } from "@/lib/types"
import { useInventory } from "@/lib/inventory-context"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Omit<InventoryItem, "id" | "batchNumber" | "createdAt">) => void
  categories: string[]
  nameHistory: string[]
  editItem?: InventoryItem | null
}

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

export function ItemDialog({
  open,
  onOpenChange,
  onSave,
  categories,
  nameHistory,
  editItem,
}: ItemDialogProps) {
  const { state } = useInventory()
  const { user } = useAuth()
  const isEmployee = user?.role === "employee" || user?.role === "manager"
  const [name, setName] = useState("")
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])
  const [showNameDropdown, setShowNameDropdown] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [newCategoryInput, setNewCategoryInput] = useState("")
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [buyingDate, setBuyingDate] = useState(todayISO())
  const [expirationDate, setExpirationDate] = useState("")
  const [amount, setAmount] = useState("")
  const [metric, setMetric] = useState<Metric>("units")
  const [pricePerUnit, setPricePerUnit] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const nameContainerRef = useRef<HTMLDivElement>(null)

  // Reset form when dialog opens or editItem changes
  useEffect(() => {
    if (open) {
      if (editItem) {
        setName(editItem.name)
        setSelectedCategories([...editItem.categories])
        setBuyingDate(editItem.buyingDate)
        setExpirationDate(editItem.expirationDate)
        setAmount(String(editItem.amount))
        setMetric(editItem.metric)
        setPricePerUnit(String(editItem.pricePerUnit))
        setMinAmount(editItem.minAmount !== null ? String(editItem.minAmount) : "")
        setNote(editItem.note)
      } else {
        setName("")
        setSelectedCategories([])
        setBuyingDate(todayISO())
        setExpirationDate("")
        setAmount("")
        setMetric("units")
        setPricePerUnit("")
        setMinAmount("")
        setNote("")
      }
      setErrors({})
      setShowNewCategory(false)
      setNewCategoryInput("")
    }
  }, [open, editItem])

  // Name autocomplete
  useEffect(() => {
    if (name.length > 0) {
      const matches = nameHistory.filter(
        (n) => n.toLowerCase().includes(name.toLowerCase()) && n.toLowerCase() !== name.toLowerCase()
      )
      setNameSuggestions(matches.slice(0, 6))
    } else {
      setNameSuggestions([])
    }
  }, [name, nameHistory])

  // Auto-populate categories, metric, and minAmount when name matches existing items (only when adding, not editing)
  const existingItems = name.trim().length > 0 
    ? state.items.filter((item) => item.name.toLowerCase() === name.trim().toLowerCase())
    : []
  const itemExists = existingItems.length > 0
  const isRestrictedEmployee = isEmployee && itemExists && !editItem

  useEffect(() => {
    if (!editItem && name.trim().length > 0) {
      const existingItemsCheck = state.items.filter(
        (item) => item.name.toLowerCase() === name.trim().toLowerCase()
      )
      if (existingItemsCheck.length > 0) {
        const firstMatch = existingItemsCheck[0]
        setSelectedCategories([...firstMatch.categories])
        setMetric(firstMatch.metric)
        setMinAmount(firstMatch.minAmount !== null ? String(firstMatch.minAmount) : "")
      }
    }
  }, [name, editItem, state.items])

  // Close name dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (nameContainerRef.current && !nameContainerRef.current.contains(e.target as Node)) {
        setShowNameDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  function addNewCategory() {
    const trimmed = newCategoryInput.trim()
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed])
    }
    setNewCategoryInput("")
    setShowNewCategory(false)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = "El nombre es obligatorio"
    if (selectedCategories.length === 0) errs.categories = "Selecciona al menos una categoria"
    if (!expirationDate) errs.expirationDate = "La fecha de expiracion es obligatoria"
    if (!amount || Number(amount) <= 0) errs.amount = "La cantidad debe ser mayor a 0"
    if (!pricePerUnit || Number(pricePerUnit) < 0) errs.pricePerUnit = "Ingresa un precio valido"
    if (!minAmount || Number(minAmount) < 0) errs.minAmount = "La cantidad minima es obligatoria"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return
    onSave({
      name: name.trim(),
      categories: selectedCategories,
      buyingDate,
      expirationDate,
      amount: Number(amount),
      metric,
      pricePerUnit: Number(pricePerUnit),
      minAmount: minAmount ? Number(minAmount) : null,
      note: note.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Articulo" : "Agregar Nuevo Articulo"}</DialogTitle>
          <DialogDescription>
            {editItem
              ? "Actualiza los detalles de este articulo del inventario."
              : "Completa los detalles para agregar un nuevo articulo al inventario."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Name with autocomplete */}
          <div className="flex flex-col gap-1.5" ref={nameContainerRef}>
            <Label htmlFor="item-name">Nombre del Articulo</Label>
            <div className="relative">
              <Input
                id="item-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setShowNameDropdown(true)
                }}
                onFocus={() => setShowNameDropdown(true)}
                placeholder="Ej. Pechuga de pollo"
                aria-invalid={!!errors.name}
              />
              {showNameDropdown && nameSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
                  {nameSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setName(s)
                        setShowNameDropdown(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-accent cursor-pointer text-left"
                    >
                      <Search className="size-3 text-muted-foreground" />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Categories */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Categorias
              {isRestrictedEmployee && <span className="text-xs text-muted-foreground ml-1">(bloqueado)</span>}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  disabled={isRestrictedEmployee}
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selectedCategories.includes(cat)
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground/30",
                    isRestrictedEmployee && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {cat}
                </button>
              ))}
              {/* Show custom categories that aren't in the main list */}
              {selectedCategories
                .filter((c) => !categories.includes(c))
                .map((cat) => (
                  <Badge
                    key={cat}
                    variant="default"
                    className={cn("gap-1 pr-1", isRestrictedEmployee && "opacity-50 cursor-not-allowed")}
                    onClick={isRestrictedEmployee ? undefined : () => toggleCategory(cat)}
                  >
                    {cat}
                    {!isRestrictedEmployee && <X className="size-3" />}
                  </Badge>
                ))}
            </div>

            {!isRestrictedEmployee && showNewCategory ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="Nombre de nueva categoria"
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addNewCategory()
                    }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={addNewCategory}>
                  Agregar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewCategory(false)
                    setNewCategoryInput("")
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : !isRestrictedEmployee && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit mt-1"
                onClick={() => setShowNewCategory(true)}
              >
                <Plus className="size-3.5" />
                Nueva Categoria
              </Button>
            )}
            {errors.categories && (
              <p className="text-xs text-destructive">{errors.categories}</p>
            )}
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="buying-date">Fecha de Compra</Label>
              <Input
                id="buying-date"
                type="date"
                value={buyingDate}
                onChange={(e) => setBuyingDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expiration-date">Fecha de Expiracion</Label>
              <Input
                id="expiration-date"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                aria-invalid={!!errors.expirationDate}
              />
              {errors.expirationDate && (
                <p className="text-xs text-destructive">{errors.expirationDate}</p>
              )}
            </div>
          </div>

          {/* Amount + Metric row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Cantidad</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                aria-invalid={!!errors.amount}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Metrica
                {isRestrictedEmployee && <span className="text-xs text-muted-foreground ml-1">(bloqueado)</span>}
              </Label>
              <Select 
                value={metric} 
                onValueChange={(v) => setMetric(v as Metric)}
                disabled={isRestrictedEmployee}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price per unit */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price">
              Precio por {metric === "units" ? "unidad" : metric}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                L.
              </span>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                aria-invalid={!!errors.pricePerUnit}
              />
            </div>
            {errors.pricePerUnit && (
              <p className="text-xs text-destructive">{errors.pricePerUnit}</p>
            )}
          </div>

          {/* Min amount */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="min-amount">
              Cantidad Minima (para alerta de stock bajo)
              {isRestrictedEmployee && <span className="text-xs text-muted-foreground ml-1">(bloqueado)</span>}
            </Label>
            {isRestrictedEmployee ? (
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-sm">
                {minAmount || "Sin configurar"}
              </div>
            ) : (
              <Input
                id="min-amount"
                type="number"
                min="0"
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="Dejar vacio para omitir"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Recibiras una alerta cuando la cantidad baje a este numero o menos.
            </p>
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            {editItem ? "Guardar Cambios" : "Agregar Articulo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
