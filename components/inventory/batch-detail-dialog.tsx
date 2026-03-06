"use client"

import { type InventoryItem, getExpirationStatus, getDaysUntilExpiration } from "@/lib/types"
import { type GranularPermissions } from "@/lib/permissions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn, formatNumber } from "@/lib/utils"

const statusConfig = {
  red: {
    label: "Por expirar",
    bg: "bg-red-500/10",
    text: "text-red-600",
  },
  yellow: {
    label: "Usar pronto",
    bg: "bg-amber-400/10",
    text: "text-amber-600",
  },
  green: {
    label: "Fresco",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
  },
}

interface BatchDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem | null
  permissions?: GranularPermissions
}

export function BatchDetailDialog({ open, onOpenChange, item, permissions }: BatchDetailDialogProps) {
  if (!item) return null

  const status = getExpirationStatus(item.expirationDate)
  const config = statusConfig[status]
  const daysLeft = getDaysUntilExpiration(item.expirationDate)
  const totalValue = item.amount * item.pricePerUnit

  const expirationDate = new Date(item.expirationDate)
  const formattedExpDate = expirationDate.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const buyingDate = new Date(item.buyingDate)
  const formattedBuyingDate = buyingDate.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Default to showing all if no permissions specified (admin)
  const showCard = !permissions || permissions.showCardDetails !== "no"
  const showCantidad = !permissions || permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardCantidad)
  const showPrecioUnidad = !permissions || permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardPrecioUnidad)
  const showValorLote = !permissions || permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardValorLote)
  const showFechaCompra = !permissions || permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardFechaCompra)
  const showFechaExpiracion = !permissions || permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardFechaExpiracion)
  const showCantidadMinima = !permissions || permissions.showCardDetails === "yes" || (permissions.showCardDetails === "custom" && permissions.cardCantidadMinima)

  if (!showCard) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{item.name}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">No tienes permisos para ver los detalles de este lote.</p>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.name}
            <span className="text-sm font-normal text-muted-foreground">#{item.batchNumber}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className={cn("rounded-lg p-3", config.bg)}>
            <p className={cn("font-medium", config.text)}>{config.label}</p>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-1">
            {item.categories.map((cat) => (
              <Badge key={cat} variant="secondary">
                {cat}
              </Badge>
            ))}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {showCantidad && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Cantidad</p>
                <p className="font-medium">
                  {item.amount} {item.metric === "units" ? "ud" : item.metric}
                </p>
              </div>
            )}

            {showPrecioUnidad && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Precio por unidad</p>
                <p className="font-medium">L. {formatNumber(item.pricePerUnit)}</p>
              </div>
            )}

            {showValorLote && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Valor total del lote</p>
                <p className="font-medium">L. {formatNumber(totalValue)}</p>
              </div>
            )}

            {showCantidadMinima && item.minAmount !== null && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Cantidad minima</p>
                <p className="font-medium">{item.minAmount} {item.metric === "units" ? "ud" : item.metric}</p>
              </div>
            )}

            {showFechaCompra && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Fecha de compra</p>
                <p className="font-medium">{formattedBuyingDate}</p>
              </div>
            )}

            {showFechaExpiracion && (
              <div>
                <p className="text-xs text-muted-foreground uppercase">Fecha de expiracion</p>
                <p className="font-medium">{formattedExpDate}</p>
                <p className="text-xs text-muted-foreground">
                  {daysLeft <= 0
                    ? "Expirado"
                    : daysLeft === 1
                      ? "Expira manana"
                      : `Expira en ${daysLeft} dias`}
                </p>
              </div>
            )}
          </div>

          {/* Note */}
          {item.note && (
            <div>
              <p className="text-xs text-muted-foreground uppercase">Nota</p>
              <p className="text-sm">{item.note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
