"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { type GranularPermissions, DEFAULT_GRANULAR_PERMISSIONS } from "@/lib/permissions"
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

type YesNoCustom = "yes" | "no" | "custom"

function OptionSelector({ value, onChange }: { value: YesNoCustom; onChange: (v: YesNoCustom) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange("yes")}
        className={`px-2 py-1 text-xs rounded ${value === "yes" ? "bg-green-600 text-white" : "bg-muted"}`}
      >
        1. Sí
      </button>
      <button
        type="button"
        onClick={() => onChange("no")}
        className={`px-2 py-1 text-xs rounded ${value === "no" ? "bg-red-600 text-white" : "bg-muted"}`}
      >
        2. No
      </button>
      <button
        type="button"
        onClick={() => onChange("custom")}
        className={`px-2 py-1 text-xs rounded ${value === "custom" ? "bg-blue-600 text-white" : "bg-muted"}`}
      >
        3. Personalizar
      </button>
    </div>
  )
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user, updatePermissions, employeeGranularPermissions } = useAuth()
  const [perms, setPerms] = useState<GranularPermissions>(DEFAULT_GRANULAR_PERMISSIONS)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (open && employeeGranularPermissions) {
      setPerms(employeeGranularPermissions)
      setHasChanges(false)
    }
  }, [open, employeeGranularPermissions])

  if (user?.role !== "admin") return null

  const handleChange = (key: keyof GranularPermissions, value: boolean | YesNoCustom) => {
    setPerms(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    await updatePermissions(perms)
    setHasChanges(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permisos de Empleado</DialogTitle>
          <DialogDescription>
            Configura lo que los empleados pueden ver y hacer en la app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Ver detalles del producto en la lista */}
          <div className="space-y-2">
            <Label className="font-semibold">Ver detalles del producto en la lista:</Label>
            <OptionSelector 
              value={perms.showListCantidad} 
              onChange={(v) => handleChange("showListCantidad", v)} 
            />
            {perms.showListCantidad === "custom" && (
              <div className="ml-4 space-y-1 mt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={perms.listCantidadDetail}
                    onCheckedChange={(c) => handleChange("listCantidadDetail", c)}
                  />
                  <span className="text-sm">+Cantidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={perms.listValorTotalDetail}
                    onCheckedChange={(c) => handleChange("listValorTotalDetail", c)}
                  />
                  <span className="text-sm">+Valor Total</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={perms.listExpiracionDetail}
                    onCheckedChange={(c) => handleChange("listExpiracionDetail", c)}
                  />
                  <span className="text-sm">+Expiración</span>
                </div>
              </div>
            )}
          </div>

          {/* Ver detalles del producto en la tarjeta completa */}
          <div className="space-y-2">
            <Label className="font-semibold">Ver detalles del producto en la tarjeta completa:</Label>
            <OptionSelector 
              value={perms.showCardDetails} 
              onChange={(v) => handleChange("showCardDetails", v)} 
            />
            {perms.showCardDetails === "custom" && (
              <div className="ml-4 space-y-1 mt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={perms.cardCantidad} onCheckedChange={(c) => handleChange("cardCantidad", c)} />
                  <span className="text-sm">+Cantidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={perms.cardPrecioUnidad} onCheckedChange={(c) => handleChange("cardPrecioUnidad", c)} />
                  <span className="text-sm">+Precio por unidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={perms.cardValorLote} onCheckedChange={(c) => handleChange("cardValorLote", c)} />
                  <span className="text-sm">+Valor total del lote</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={perms.cardFechaCompra} onCheckedChange={(c) => handleChange("cardFechaCompra", c)} />
                  <span className="text-sm">+Fecha de compra</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={perms.cardFechaExpiracion} onCheckedChange={(c) => handleChange("cardFechaExpiracion", c)} />
                  <span className="text-sm">+Fecha de expiración</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={perms.cardCantidadMinima} onCheckedChange={(c) => handleChange("cardCantidadMinima", c)} />
                  <span className="text-sm">+Cantidad mínima</span>
                </div>
              </div>
            )}
          </div>

          {/* Editar información de productos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Editar información de productos</Label>
              <Switch
                checked={perms.allowEdit !== "no"}
                onCheckedChange={(c) => handleChange("allowEdit", c ? "yes" : "no")}
              />
            </div>
          </div>

          {/* Simple toggles */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label>Eliminar un lote de producto completo de la lista</Label>
              <Switch
                checked={perms.canDeleteItems}
                onCheckedChange={(c) => handleChange("canDeleteItems", c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Gestionar categorías (botón en el menú)</Label>
              <Switch
                checked={perms.canManageCategories}
                onCheckedChange={(c) => handleChange("canManageCategories", c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Usar botón de eliminar</Label>
              <Switch
                checked={perms.canUseRemoveDialog}
                onCheckedChange={(c) => handleChange("canUseRemoveDialog", c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Ver valor total del inventario</Label>
              <Switch
                checked={perms.canViewTotalValue}
                onCheckedChange={(c) => handleChange("canViewTotalValue", c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Exportar Excel (botón en el menú)</Label>
              <Switch
                checked={perms.canExportExcel}
                onCheckedChange={(c) => handleChange("canExportExcel", c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Backup JSON (botón en el menú)</Label>
              <Switch
                checked={perms.canBackupJSON}
                onCheckedChange={(c) => handleChange("canBackupJSON", c)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Importar Backup (botón en el menú)</Label>
              <Switch
                checked={perms.canImportBackup}
                onCheckedChange={(c) => handleChange("canImportBackup", c)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
