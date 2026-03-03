"use client"

import { type InventoryItem, getExpirationStatus, isLowStock, getDaysUntilExpiration } from "@/lib/types"
import { useInventory } from "@/lib/inventory-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const statusConfig = {
  red: {
    border: "border-l-red-500",
    bg: "bg-red-500/10",
    dot: "bg-red-500",
    label: "Por expirar",
  },
  yellow: {
    border: "border-l-amber-400",
    bg: "bg-amber-400/10",
    dot: "bg-amber-400",
    label: "Usar pronto",
  },
  green: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-500",
    label: "Fresco",
  },
}

interface ItemCardProps {
  item: InventoryItem
  onEdit: (item: InventoryItem) => void
  onDelete: (id: string) => void
}

export function ItemCard({ item, onEdit, onDelete }: ItemCardProps) {
  const { state } = useInventory()
  const status = getExpirationStatus(item.expirationDate)
  const config = statusConfig[status]
  const low = isLowStock(item, state.items)
  const daysLeft = getDaysUntilExpiration(item.expirationDate)

  // determine position among items with same name
  const sameName = state.items
    .filter((i) => i.name === item.name)
    .sort((a, b) => a.batchNumber - b.batchNumber)
  const index = sameName.findIndex((i) => i.id === item.id)
  const localBatch = index >= 0 ? index + 1 : 1

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border border-border/60 bg-card transition-all hover:shadow-md",
        "border-l-4",
        config.border
      )}
    >
      {/* Top row: status dot + batch + actions */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className={cn("inline-block size-2.5 rounded-full", config.dot)} />
          <span className="text-xs text-muted-foreground font-medium">
            {"#"}{item.batchNumber}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(item)}
            aria-label={`Editar ${item.name}`}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(item.id)}
            aria-label={`Eliminar ${item.name}`}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Name + LOW badge (show batch index when more of same name exist) */}
      <div className="flex items-start gap-2 px-4 pb-1">
        <h3 className={cn(
          "text-sm font-semibold leading-snug line-clamp-2 flex-1",
          item.amount === 0 ? "text-red-500" : "text-foreground"
        )}>
          {item.name}{" "}
          {localBatch > 1 && (
            <span className="text-xs font-normal text-muted-foreground">({localBatch})</span>
          )}
        </h3>
        {low && (
          <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
            BAJO
          </span>
        )}
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-1 px-4 pb-2">
        {item.categories.map((cat) => (
          <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">
            {cat}
          </Badge>
        ))}
      </div>

      {/* Details row */}
      <div className="mt-auto flex items-center justify-between border-t border-border/40 px-4 py-2.5">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Cantidad</span>
          <span className={cn(
            "text-sm font-semibold",
            item.amount === 0 ? "text-red-500" : "text-foreground"
          )}>
            {item.amount} {item.metric}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio</span>
          <span className="text-sm font-semibold text-foreground">
            L. {item.pricePerUnit.toFixed(2)}/{item.metric === "units" ? "ud" : item.metric}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Expira</span>
          <span
            className={cn(
              "text-sm font-semibold",
              status === "red" && "text-red-500",
              status === "yellow" && "text-amber-500",
              status === "green" && "text-emerald-600"
            )}
          >
            {daysLeft <= 0
              ? "Expirado"
              : daysLeft === 1
                ? "Manana"
                : `${daysLeft}d`}
          </span>
        </div>
      </div>
    </div>
  )
}
