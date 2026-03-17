"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { addAdministrator, updateAdministrator, deleteAdministrator, loadAdministrators } from "@/lib/server-actions"
import { ADMIN_CODE, TEMP_ADMIN_ID, TEMP_ADMIN_NAME } from "@/lib/auth-constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, ShieldUser } from "lucide-react"

interface AdminDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface AdminUser {
  id: string
  code: string
  name: string
  role: string
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

export function AdminDialog({ open, onOpenChange }: AdminDialogProps) {
  const { refreshEmployees, user, updateCurrentUserCode } = useAuth()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")
  const [editCode, setEditCode] = useState("")
  const [editName, setEditName] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      loadAdminList()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const interval = setInterval(() => {
      loadAdminList()
    }, 3000)

    return () => clearInterval(interval)
  }, [open])

  async function loadAdminList() {
    setIsLoading(true)
    const users = (await loadAdministrators()) as AdminUser[]

    const hasTempAdmin = users.some((admin) => admin.code === ADMIN_CODE)
    const withTempAdmin = hasTempAdmin
      ? users
      : [
          {
            id: TEMP_ADMIN_ID,
            code: ADMIN_CODE,
            name: TEMP_ADMIN_NAME,
            role: "admin",
            isActive: true,
          },
          ...users,
        ]

    setAdmins(withTempAdmin)
    setIsLoading(false)
  }

  async function handleAdd() {
    if (!newCode.trim() || !newName.trim()) {
      setError("El codigo y nombre son obligatorios")
      return
    }
    setSaving(true)
    setError("")
    const result = await addAdministrator(newCode.trim(), newName.trim())
    if (result.success) {
      setNewCode("")
      setNewName("")
      setIsAdding(false)
      await loadAdminList()
      await refreshEmployees()
    } else {
      setError(result.error || "Error al agregar administrador")
    }
    setSaving(false)
  }

  async function handleEdit(admin: AdminUser) {
    setEditingId(admin.id)
    setEditCode(admin.code)
    setEditName(admin.name)
    setEditActive(admin.isActive)
    setError("")
  }

  async function handleSaveEdit() {
    if (!editName.trim()) {
      setError("El nombre es obligatorio")
      return
    }
    if (!editingId) return

    const editingAdmin = admins.find((admin) => admin.id === editingId)
    const isCurrentAdmin = editingAdmin?.code === user?.code

    if (!isCurrentAdmin && editCode.trim() !== editingAdmin?.code) {
      setError("Solo puedes cambiar tu propio codigo de acceso")
      return
    }

    if (!editCode.trim()) {
      setError("El codigo es obligatorio")
      return
    }

    setSaving(true)
    setError("")

    const isTemporaryAdmin = editingId === TEMP_ADMIN_ID
    const result = isTemporaryAdmin
      ? await addAdministrator(editCode.trim(), editName.trim())
      : await updateAdministrator(editingId, editName.trim(), editActive, editCode.trim())

    if (result.success) {
      if (isCurrentAdmin && user?.code !== editCode.trim()) {
        updateCurrentUserCode(editCode.trim())
      }
      setEditingId(null)
      await loadAdminList()
      await refreshEmployees()
    } else {
      setError(result.error || "Error al actualizar administrador")
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (id === TEMP_ADMIN_ID) {
      setError("El admin temporal no se puede eliminar")
      return
    }

    const adminToDelete = admins.find((admin) => admin.id === id)
    if (adminToDelete?.code === user?.code) {
      setError("No puedes eliminar tu propio usuario mientras estas en sesion")
      return
    }

    if (!confirm("¿Estas seguro de eliminar este administrador?")) return
    setSaving(true)
    const result = await deleteAdministrator(id)
    if (result.success) {
      await loadAdminList()
      await refreshEmployees()
    } else {
      setError(result.error || "Error al eliminar administrador")
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldUser className="size-5" />
            Gestion de Administradores
          </DialogTitle>
          <DialogDescription>
            Agrega, edita o elimina perfiles con acceso total
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-2 rounded">
            {error}
          </div>
        )}

        {isAdding ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adminCode">Codigo de acceso</Label>
              <Input
                id="adminCode"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Ej: admin-jose"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminName">Nombre del administrador</Label>
              <Input
                id="adminName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Jose"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" onClick={() => { setIsAdding(false); setError("") }}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : editingId ? (
          <div className="space-y-4 py-4">
            {(() => {
              const admin = admins.find((a) => a.id === editingId)
              if (!admin) return null

              const isCurrentAdmin = admin.code === user?.code
              const isTemporaryAdmin = admin.id === TEMP_ADMIN_ID

              return (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="editCode">Codigo de acceso</Label>
                    <Input
                      id="editCode"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      disabled={!isCurrentAdmin}
                    />
                    {!isCurrentAdmin && (
                      <p className="text-xs text-muted-foreground">Solo el admin en sesion puede cambiar su codigo.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editName">Nombre</Label>
                    <Input
                      id="editName"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="editActive"
                      checked={editActive}
                      onCheckedChange={setEditActive}
                      disabled={isTemporaryAdmin}
                    />
                    <Label htmlFor="editActive">Activo</Label>
                  </div>
                  {isTemporaryAdmin && (
                    <p className="text-xs text-muted-foreground">
                      Al guardar, este admin temporal se convertira en un admin persistente.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditingId(null); setError("") }}>
                      Cancelar
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Button onClick={() => setIsAdding(true)} className="w-full">
                <Plus className="size-4 mr-2" />
                Agregar nuevo administrador
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Cargando...</div>
            ) : admins.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No hay administradores registrados
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{admin.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{admin.code}</div>
                      {admin.id === TEMP_ADMIN_ID && (
                        <span className="text-xs text-muted-foreground">Temporal</span>
                      )}
                      {!admin.isActive && (
                        <span className="text-xs text-destructive">Inactivo</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(admin)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(admin.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
