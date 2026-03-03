"use client"

import { type InventoryItem, getExpirationStatus, getDaysUntilExpiration } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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
}

export function BatchDetailDialog({ open, onOpenChange, item }: BatchDetailDialogProps) {
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

  const createdDate = new Date(item.createdAt)
  const formattedCreatedDate = createdDate.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{item.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <Badge className={cn("px-3 py-1", config.bg, config.text)}>
              {config.label}
            </Badge>
            {item.amount === 0 && (
              <Badge variant="destructive" className="px-3 py-1">
                LOTE TERMINADO
              </Badge>
            )}
          </div>

          {/* Batch Number */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border-l-2 border-foreground/20 pl-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Número de Lote
              </span>
              <p className="text-sm text-foreground">
                #{item.batchNumber}
              </p>
            </div>
          </div>

          {/* Categories */}
          {item.categories.length > 0 && (
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">
                Categorías
              </span>
              <div className="flex flex-wrap gap-2">
                {item.categories.map((cat) => (
                  <Badge key={cat} variant="secondary">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="border-l-2 border-foreground/20 pl-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Cantidad
            </span>
            <p className={cn(
              "text-sm",
              item.amount === 0 ? "text-red-500" : "text-foreground"
            )}>
              {item.amount} {item.metric}
            </p>
          </div>

          {/* Price per Unit */}
          <div className="border-l-2 border-foreground/20 pl-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Precio por Unidad
            </span>
            <p className="text-sm text-foreground">
              L. {item.pricePerUnit.toFixed(2)}/{item.metric === "units" ? "ud" : item.metric}
            </p>
          </div>

          {/* Total Value */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Valor Total del Lote
            </span>
            <p className="text-lg font-semibold text-primary">
              L. {totalValue.toFixed(2)}
            </p>
          </div>

          {/* Buying Date */}
          <div className="border-l-2 border-foreground/20 pl-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Fecha de Compra
            </span>
            <p className="text-sm text-foreground">
              {formattedCreatedDate}
            </p>
          </div>

          {/* Expiration Date */}
          <div className="border-l-2 border-foreground/20 pl-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Fecha de Expiración
            </span>
            <p className={cn(
              "text-sm font-semibold",
              item.amount === 0 ? "text-red-500" : status === "red" && "text-red-500",
              item.amount === 0 ? "text-red-500" : status === "yellow" && "text-amber-500",
              item.amount === 0 ? "text-red-500" : status === "green" && "text-emerald-600"
            )}>
              {formattedExpDate}
              {daysLeft > 0 && ` (${daysLeft} días)`}
              {daysLeft === 0 && " (Hoy)"}
              {daysLeft < 0 && " (Expirado)"}
            </p>
          </div>

          {/* Notes */}
          {item.note && (
            <div className="bg-foreground/5 rounded-lg p-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Notas
              </span>
              <p className="text-sm text-foreground mt-1">
                {item.note}
              </p>
            </div>
          )}

          {/* Min Amount */}
          {item.minAmount !== null && (
            <div className="border-l-2 border-foreground/20 pl-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Cantidad Mínima
              </span>
              <p className="text-sm text-foreground">
                {item.minAmount} {item.metric}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
