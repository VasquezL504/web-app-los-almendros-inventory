"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { type AppPermissions, DEFAULT_PERMISSIONS } from "@/lib/permissions"
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

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user, updatePermissions, permissions } = useAuth()
  const [employeePerms, setEmployeePerms] = useState<AppPermissions>(DEFAULT_PERMISSIONS.employee)

  // Cargar permisos de DB cuando se abre
  useEffect(() => {
    if (open && permissions) {
      setEmployeePerms(permissions)
    }
  }, [open, permissions])

  if (user?.role !== "admin") return null

  const handleToggle = async (key: keyof AppPermissions, checked: boolean) => {
    const updated = { ...employeePerms, [key]: checked }
    setEmployeePerms(updated)
    await updatePermissions(updated)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permisos de Empleado</DialogTitle>
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
              checked={employeePerms.canViewBatchDetail}
              onCheckedChange={(checked) => handleToggle("canViewBatchDetail", checked)}
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
              checked={employeePerms.canViewItemCardDetails}
              onCheckedChange={(checked) => handleToggle("canViewItemCardDetails", checked)}
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
              checked={employeePerms.canEditItems}
              onCheckedChange={(checked) => handleToggle("canEditItems", checked)}
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
              checked={employeePerms.canDeleteItems}
              onCheckedChange={(checked) => handleToggle("canDeleteItems", checked)}
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
              checked={employeePerms.canManageCategories}
              onCheckedChange={(checked) => handleToggle("canManageCategories", checked)}
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
              checked={employeePerms.canUseRemoveDialog}
              onCheckedChange={(checked) => handleToggle("canUseRemoveDialog", checked)}
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
              checked={employeePerms.canViewTotalValue}
              onCheckedChange={(checked) => handleToggle("canViewTotalValue", checked)}
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
