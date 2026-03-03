"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: string[]
  items: { categories: string[] }[]
  onAdd: (name: string) => void
  onEdit: (oldName: string, newName: string) => void
  onDelete: (name: string) => void
}

export function CategoryDialog({ open, onOpenChange, categories, items, onAdd, onEdit, onDelete }: CategoryDialogProps) {
  const [newCategory, setNewCategory] = useState("")
  const [editCategory, setEditCategory] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  function handleAdd() {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      onAdd(newCategory.trim())
      setNewCategory("")
    }
  }

  function handleEdit() {
    if (editCategory && editName.trim() && !categories.includes(editName.trim())) {
      onEdit(editCategory, editName.trim())
      setEditCategory(null)
      setEditName("")
    }
  }

  function handleDelete(name: string) {
    const used = items.some(item => item.categories.includes(name))
    if (!used) {
      onDelete(name)
    } else {
      alert("No se puede eliminar una categoría que está en uso.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Categorías</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              placeholder="Nueva categoría"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
            />
            <Button onClick={handleAdd} className="mt-2">Agregar</Button>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Categorías existentes</h4>
            <ul className="space-y-2">
              {categories.map(cat => (
                <li key={cat} className="flex items-center gap-2">
                  {editCategory === cat ? (
                    <>
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-32"
                      />
                      <Button size="sm" onClick={handleEdit}>Guardar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditCategory(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1">{cat}</span>
                      <Button size="sm" variant="outline" onClick={() => { setEditCategory(cat); setEditName(cat); }}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(cat)}>Eliminar</Button>
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
