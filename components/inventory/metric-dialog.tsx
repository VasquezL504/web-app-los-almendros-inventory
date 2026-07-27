"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type MetricOption } from "@/lib/types"

interface MetricDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metrics: MetricOption[]
  onAdd: (metric: MetricOption) => void
  onEdit: (oldValue: string, newValue: string, newLabel: string) => void
  onDelete: (value: string) => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20) || "custom"
}

export function MetricDialog({ open, onOpenChange, metrics, onAdd, onEdit, onDelete }: MetricDialogProps) {
  const [newLabel, setNewLabel] = useState("")
  const [newValue, setNewValue] = useState("")
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editValue, setEditValue] = useState("")

  function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    const value = newValue.trim() || slugify(label)
    if (metrics.some(m => m.value === value)) {
      alert("Ya existe una metrica con ese valor.")
      return
    }
    onAdd({ value, label, isDefault: false })
    setNewLabel("")
    setNewValue("")
  }

  function handleEdit() {
    if (!editKey || !editLabel.trim() || !editValue.trim()) return
    if (editValue !== editKey && metrics.some(m => m.value === editValue)) {
      alert("Ya existe una metrica con ese valor.")
      return
    }
    onEdit(editKey, editValue.trim(), editLabel.trim())
    setEditKey(null)
    setEditLabel("")
    setEditValue("")
  }

  function handleDelete(metric: MetricOption) {
    if (metric.isDefault) {
      alert("No se puede eliminar una metrica por defecto.")
      return
    }
    onDelete(metric.value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Metricas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              placeholder="Nombre de nueva metrica (ej. Libras (lbs))"
              value={newLabel}
              onChange={e => { setNewLabel(e.target.value); setNewValue(slugify(e.target.value)) }}
            />
            <Input
              placeholder="Valor interno (ej. lbs)"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              className="mt-2"
            />
            <Button onClick={handleAdd} className="mt-2" disabled={!newLabel.trim()}>
              Agregar
            </Button>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Metricas existentes</h4>
            <ul className="space-y-2">
              {metrics.map(m => (
                <li key={m.value} className="flex items-center gap-2">
                  {editKey === m.value ? (
                    <>
                      <Input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        className="w-32"
                        placeholder="Nombre"
                      />
                      <Input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-24"
                        placeholder="Valor"
                      />
                      <Button size="sm" onClick={handleEdit}>Guardar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditKey(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1">{m.label} {m.isDefault && <span className="text-xs text-muted-foreground">(default)</span>}</span>
                      <Button size="sm" variant="outline" onClick={() => { setEditKey(m.value); setEditLabel(m.label); setEditValue(m.value); }}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(m)}
                        disabled={m.isDefault}
                      >
                        Eliminar
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
