"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
import { Search, Minus } from "lucide-react"
import { InventoryItem } from "@/lib/types"
import { useToast } from '@/hooks/use-toast'
import { SearchBar } from "./search-bar"
import { cn } from "@/lib/utils"

interface RemoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemove: (itemName: string, quantity: number, usageType: "uso" | "merma") => void
  items: InventoryItem[]
}

export function RemoveDialog({
  open,
  onOpenChange,
  onRemove,
  items,
}: RemoveDialogProps) {
  const [search, setSearch] = useState("")
  const [selectedName, setSelectedName] = useState("")
  const [quantity, setQuantity] = useState("")
  const [usageType, setUsageType] = useState<"uso" | "merma">("uso")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const uniqueNames = useMemo(
    () => Array.from(new Set(items.map((i) => i.name))),
    [items]
  )

  const { toast } = useToast()

  // derive metric for selected item
  const selectedMetric = useMemo(() => {
    if (!selectedName) return ""
    const found = items.find(
      (i) => i.name.toLowerCase() === selectedName.toLowerCase()
    )
    return found?.metric || ""
  }, [selectedName, items])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setSelectedName("")
      setQuantity("")
      setErrors({})
    }
  }, [open])

  function validate() {
    const errs: Record<string, string> = {}
    if (!selectedName.trim()) {
      errs.name = "Selecciona un producto"
    }
    const qty = parseFloat(quantity)
    if (!quantity.trim()) {
      errs.quantity = "Ingresa una cantidad"
    } else if (isNaN(qty) || qty <= 0) {
      errs.quantity = "Cantidad inválida"
    } else if (selectedName.trim()) {
      const totalAvailable = items
        .filter((i) => i.name.toLowerCase() === selectedName.toLowerCase())
        .reduce((sum, i) => sum + i.amount, 0)
      if (qty > totalAvailable) {
        const msg = `Cantidad mayor a existencia — sólo hay ${totalAvailable} ${selectedMetric || ""}`
        errs.quantity = msg
        try {
          toast({ title: 'Error', description: msg, variant: 'destructive' })
        } catch (e) {
          // noop if toast not available
        }
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onRemove(selectedName, parseFloat(quantity), usageType === "uso" ? "uso" : "merma")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="size-5" /> Eliminar
          </DialogTitle>
          <DialogDescription>
            Busca un producto existente y especifica la cantidad a restar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="remove-search">Producto *</Label>
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v)
                setSelectedName(v)
              }}
              suggestions={uniqueNames}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="remove-quantity">Cantidad *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="remove-quantity"
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={cn(errors.quantity && "border-destructive focus-visible:ring-destructive")}
              />
              {selectedMetric && (
                <span className="text-sm text-muted-foreground">{selectedMetric}</span>
              )}
            </div>
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage-type">Tipo *</Label>
            <select
              id="usage-type"
              value={usageType}
              onChange={(e) => setUsageType(e.target.value as "uso" | "merma")}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="uso">Usado</option>
              <option value="merma">Merma</option>
            </select>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
