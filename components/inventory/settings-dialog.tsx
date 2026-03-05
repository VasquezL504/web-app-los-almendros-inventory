"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Settings } from "lucide-react"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { permissions, updatePermissions, user } = useAuth()

  if (user?.role !== "admin") return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configuracion de Permisos</DialogTitle>
          <DialogDescription>
            Configura lo que los empleados pueden ver y hacer en la app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="canViewBatchDetail" className="flex flex-col">
              <span>Ver detalle de lote</span>
              <span className="text-xs text-muted-foreground font-normal">
                Permite ver el dialogo de detalle de batch
              </span>
            </Label>
            <Switch
              id="canViewBatchDetail"
              checked={permissions.canViewBatchDetail}
              onCheckedChange={(checked) => updatePermissions({ canViewBatchDetail: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="canViewItemCardDetails" className="flex flex-col">
              <span>Ver detalles de articulo</span>
              <span className="text-xs text-muted-foreground font-normal">
                Muestra detalles completos en las tarjetas
              </span>
            </Label>
            <Switch
              id="canViewItemCardDetails"
              checked={permissions.canViewItemCardDetails}
              onCheckedChange={(checked) => updatePermissions({ canViewItemCardDetails: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="canEditItems" className="flex flex-col">
              <span>Editar articulos</span>
              <span className="text-xs text-muted-foreground font-normal">
                Permite modificar articulos existentes
              </span>
            </Label>
            <Switch
              id="canEditItems"
              checked={permissions.canEditItems}
              onCheckedChange={(checked) => updatePermissions({ canEditItems: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="canDeleteItems" className="flex flex-col">
              <span>Eliminar articulos</span>
              <span className="text-xs text-muted-foreground font-normal">
                Permite borrar articulos del inventario
              </span>
            </Label>
            <Switch
              id="canDeleteItems"
              checked={permissions.canDeleteItems}
              onCheckedChange={(checked) => updatePermissions({ canDeleteItems: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="canManageCategories" className="flex flex-col">
              <span>Gestionar categorias</span>
              <span className="text-xs text-muted-foreground font-normal">
                Permite agregar, editar y eliminar categorias
              </span>
            </Label>
            <Switch
              id="canManageCategories"
              checked={permissions.canManageCategories}
              onCheckedChange={(checked) => updatePermissions({ canManageCategories: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="canUseRemoveDialog" className="flex flex-col">
              <span>Usar dialogo de eliminar</span>
              <span className="text-xs text-muted-foreground font-normal">
                Permite restar cantidad del inventario
              </span>
            </Label>
            <Switch
              id="canUseRemoveDialog"
              checked={permissions.canUseRemoveDialog}
              onCheckedChange={(checked) => updatePermissions({ canUseRemoveDialog: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="canViewTotalValue" className="flex flex-col">
              <span>Ver valor total</span>
              <span className="text-xs text-muted-foreground font-normal">
                Muestra el valor total del inventario
              </span>
            </Label>
            <Switch
              id="canViewTotalValue"
              checked={permissions.canViewTotalValue}
              onCheckedChange={(checked) => updatePermissions({ canViewTotalValue: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
