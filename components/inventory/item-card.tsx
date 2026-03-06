"use client"

import { type InventoryItem, getExpirationStatus, isLowStock, getDaysUntilExpiration } from "@/lib/types"
import { type GranularPermissions } from "@/lib/permissions"
import { useInventory } from "@/lib/inventory-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2 } from "lucide-react"
import { cn, formatNumber } from "@/lib/utils"

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
  onViewDetails?: (item: InventoryItem) => void
  permissions: GranularPermissions
}

export function ItemCard({ item, onEdit, onDelete, onViewDetails, permissions }: ItemCardProps) {
  const { state } = useInventory()
  const status = getExpirationStatus(item.expirationDate)
  const config = statusConfig[status]
  const low = isLowStock(item, state.items)
  const daysLeft = getDaysUntilExpiration(item.expirationDate)

  // List view permissions
  const showListDetails = permissions.showListCantidad !== "no"
  const showListCantidad = permissions.showListCantidad === "yes" || (permissions.showListCantidad === "custom" && permissions.listCantidadDetail)
  const showListValorTotal = permissions.showListCantidad === "yes" || (permissions.showListCantidad === "custom" && permissions.listValorTotalDetail)
  const showListExpiracion = permissions.showListCantidad === "yes" || (permissions.showListCantidad === "custom" && permissions.listExpiracionDetail)

  // Card details permissions
  const showCardDetails = permissions.showCardDetails !== "no"
  const showCardCantidad = permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardCantidad)
  const showCardPrecioUnidad = permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardPrecioUnidad)
  const showCardValorLote = permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardValorLote)
  const showCardFechaCompra = permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardFechaCompra)
  const showCardFechaExpiracion = permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardFechaExpiracion)
  const showCardCantidadMinima = permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardCantidadMinima)

  // Edit permissions
  const canEdit = permissions.allowEdit !== "no"
  const canEditNombre = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editNombre)
  const canEditCategorias = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editCategorias)
  const canEditFechaCompra = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editFechaCompra)
  const canEditFechaExpiracion = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editFechaExpiracion)
  const canEditCantidad = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editCantidad)
  const canEditMetrica = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editMetrica)
  const canEditPrecioUnidad = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editPrecioUnidad)
  const canEditCantidadMinima = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editCantidadMinima)
  const canEditNota = permissions.allowEdit === "yes" || (permissions.allowEdit === "custom" && permissions.editNota)

  // determine position among items with same name
  const sameName = state.items
    .filter((i) => i.name === item.name)
    .sort((a, b) => a.batchNumber - b.batchNumber)
  const index = sameName.findIndex((i) => i.id === item.id)
  const localBatch = index >= 0 ? index + 1 : 1

  return (
    <div
      onClick={() => onViewDetails?.(item)}
      className={cn(
        "group relative flex flex-col rounded-lg border border-border/60 bg-card transition-all hover:shadow-md cursor-pointer",
        "border-l-4",
        config.border
      )}
    >
      {/* Top row: status dot + name + actions */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <div className="flex items-center gap-3">
          <span className={cn("inline-block size-2.5 rounded-full", config.dot)} />
          <h3 className={cn(
            "text-[125%] font-semibold leading-snug line-clamp-2",
            item.amount === 0 ? "text-[#dc2626]" : "text-foreground"
          )}>
            {item.name}
            {localBatch > 1 && (
              <span className="text-xs font-normal text-muted-foreground ml-2">({localBatch})</span>
            )}
          </h3>
        </div>
        {/* Edit/Delete buttons */}
        <div className="flex items-center gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(item)
              }}
              aria-label={`Editar ${item.name}`}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {permissions.canDeleteItems && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(item.id)
              }}
              aria-label={`Eliminar ${item.name}`}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Categories + global batch number */}
      <div className="flex items-center justify-between flex-wrap gap-1 px-4 pb-1">
        <div className="flex flex-wrap gap-1">
          {item.categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">
              {cat}
            </Badge>
          ))}
        </div>
        <div className="ml-2">
          {item.amount === 0 ? (
            <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
              LOTE TERMINADO
            </span>
          ) : low ? (
            <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
              BAJO
            </span>
          ) : (
            <span className="text-xs text-muted-foreground font-medium">#{item.batchNumber}</span>
          )}
        </div>
      </div>

      {/* Details row - controlled by granular permissions */}
      {showListDetails && (
        <div className="mt-auto flex items-center justify-between border-t border-border/40 px-4 py-2.5">
          {showListCantidad && (
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Cantidad</span>
              <span className={cn(
                "text-sm font-semibold",
                item.amount === 0 ? "text-[#dc2626]" : "text-foreground"
              )}>
                {item.amount === 0
                  ? "-"
                  : `${item.amount} ${item.metric === "units" ? "ud" : item.metric}`}
              </span>
            </div>
          )}
          {showListValorTotal && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor Total</span>
              <span className={cn(
                "text-sm font-semibold",
                item.amount === 0 ? "text-[#dc2626]" : "text-foreground"
              )}>
                {item.amount === 0 ? "-" : `L. ${formatNumber(item.amount * item.pricePerUnit)}`}
              </span>
            </div>
          )}
          {showListExpiracion && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Expira</span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  item.amount === 0 ? "text-red-500" : status === "red" && "text-red-500",
                  item.amount === 0 ? "text-red-500" : status === "yellow" && "text-amber-500",
                  item.amount === 0 ? "text-red-500" : status === "green" && "text-emerald-600"
                )}
              >
                {item.amount === 0 ? "-" : daysLeft <= 0
                  ? "Expirado"
                  : daysLeft === 1
                    ? "Manana"
                    : `${daysLeft}d`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
