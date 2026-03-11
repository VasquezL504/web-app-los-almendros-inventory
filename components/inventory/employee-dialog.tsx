"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { addEmployee, updateEmployee, deleteEmployee, loadEmployees } from "@/lib/server-actions"
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
import { Plus, Pencil, Trash2, Users } from "lucide-react"

interface EmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Employee {
  id: string
  code: string
  name: string
  role: string
  isActive: boolean
  businessIds: string[] // Negocios vinculados
  createdAt?: Date
  updatedAt?: Date
}

export function EmployeeDialog({ open, onOpenChange }: EmployeeDialogProps) {
  const { refreshEmployees, user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")
  const [newBusinessIds, setNewBusinessIds] = useState<string[]>([])
  const [editName, setEditName] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [editBusinessIds, setEditBusinessIds] = useState<string[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  // Negocios globales (demo)
  const businesses = [
    { id: "almendros", name: "Los Almendros" },
    { id: "palmas", name: "Las Palmas" }
  ]

  useEffect(() => {
    if (open) {
      loadEmployeeList()
    }
  }, [open])

  async function loadEmployeeList() {
    setIsLoading(true)
    const emps = await loadEmployees()
    setEmployees(emps)
    setIsLoading(false)
  }

  async function handleAdd() {
    if (!newCode.trim() || !newName.trim()) {
      setError("El código y nombre son obligatorios")
      return
    }
    setSaving(true)
    setError("")
    // Vinculación de negocios
    const result = await addEmployee(newCode.trim(), newName.trim(), newBusinessIds)
    if (result.success) {
      setNewCode("")
      setNewName("")
      setIsAdding(false)
      await loadEmployeeList()
      await refreshEmployees()
    } else {
      setError(result.error || "Error al agregar empleado")
    }
    setSaving(false)
  }

  async function handleEdit(emp: Employee) {
    setEditingId(emp.id)
    setEditName(emp.name)
    setEditActive(emp.isActive)
    setEditBusinessIds(emp.businessIds || [])
    setError("")
  }

  async function handleSaveEdit() {
    if (!editName.trim()) {
      setError("El nombre es obligatorio")
      return
    }
    if (!editingId) return
    setSaving(true)
    setError("")
    const result = await updateEmployee(editingId, editName.trim(), editActive, editBusinessIds)
    if (result.success) {
      setEditingId(null)
      await loadEmployeeList()
      await refreshEmployees()
    } else {
      setError(result.error || "Error al actualizar empleado")
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar este empleado?")) return
    setSaving(true)
    const result = await deleteEmployee(id)
    if (result.success) {
      await loadEmployeeList()
      await refreshEmployees()
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Gestión de Empleados
          </DialogTitle>
          <DialogDescription>
            Agrega, edita o elimina perfiles de empleados
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
              <Label htmlFor="empCode">Código de empleado</Label>
              <Input
                id="empCode"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Ej: ed-normal-rf"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empName">Nombre del empleado</Label>
              <Input
                id="empName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Eduardo"
              />
            </div>
            {user?.role === "admin" && (
              <div className="space-y-2">
                <Label>Negocios vinculados</Label>
                <div className="flex flex-col gap-1">
                  {businesses.map(b => (
                    <label key={b.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newBusinessIds.includes(b.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewBusinessIds([...newBusinessIds, b.id])
                          } else {
                            setNewBusinessIds(newBusinessIds.filter(id => id !== b.id))
                          }
                        }}
                      />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
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
              const emp = employees.find(e => e.id === editingId)
              return emp ? (
                <>
                  <div className="space-y-2">
                    <Label> Código: <span className="font-mono">{emp.code}</span></Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editName">Nombre</Label>
                    <Input
                      id="editName"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  {user?.role === "admin" && (
                    <div className="space-y-2">
                      <Label>Negocios vinculados</Label>
                      <div className="flex flex-col gap-1">
                        {businesses.map(b => (
                          <label key={b.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editBusinessIds.includes(b.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setEditBusinessIds([...editBusinessIds, b.id])
                                } else {
                                  setEditBusinessIds(editBusinessIds.filter(id => id !== b.id))
                                }
                              }}
                            />
                            <span>{b.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="editActive"
                      checked={editActive}
                      onCheckedChange={setEditActive}
                    />
                    <Label htmlFor="editActive">Activo</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditingId(null); setError("") }}>
                      Cancelar
                    </Button>
                  </div>
                </>
              ) : null
            })()}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Button onClick={() => setIsAdding(true)} className="w-full">
                <Plus className="size-4 mr-2" />
                Agregar nuevo empleado
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Cargando...</div>
            ) : employees.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No hay empleados registrados
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{emp.code}</div>
                      {!emp.isActive && (
                        <span className="text-xs text-destructive">Inactivo</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(emp)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(emp.id)}
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
