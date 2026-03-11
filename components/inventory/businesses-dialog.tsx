"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Trash, Pencil } from "lucide-react"

interface Business {
  id: string
  name: string
}

interface BusinessesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businesses: Business[]
  onAdd: (name: string) => void
  onEdit: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function BusinessesDialog({ open, onOpenChange, businesses, onAdd, onEdit, onDelete }: BusinessesDialogProps) {
  const [newName, setNewName] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  function handleAdd() {
    if (!newName.trim()) return
    onAdd(newName.trim())
    setNewName("")
  }

  function handleEditSave() {
    if (!editName.trim() || !editId) return
    onEdit(editId, editName.trim())
    setEditId(null)
    setEditName("")
  }

  function handleDeleteConfirm() {
    if (deleteConfirm === "ELIMINAR" && deleteId) {
      onDelete(deleteId)
      setDeleteId(null)
      setDeleteConfirm("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Administrar Negocios</DialogTitle>
        </DialogHeader>
        <div className="mb-6 flex gap-2">
          <Input
            placeholder="Nombre del negocio"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <Button onClick={handleAdd} disabled={!newName.trim()}>Agregar</Button>
        </div>
        <div className="space-y-3">
          {businesses.map(b => (
            <Card key={b.id} className="flex items-center justify-between p-4">
              {editId === b.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="mr-2"
                  />
                  <Button size="sm" onClick={handleEditSave} disabled={!editName.trim()}>Guardar</Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditId(null)}>
                    Cancelar
                  </Button>
                </>
              ) : deleteId === b.id ? (
                <>
                  <span className="font-medium text-lg text-destructive">Eliminar negocio y todos sus datos</span>
                  <Input
                    placeholder="Escribe ELIMINAR para confirmar"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    className="mr-2"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteConfirm}
                    disabled={deleteConfirm !== "ELIMINAR"}
                  >
                    Confirmar
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => { setDeleteId(null); setDeleteConfirm("") }}>Cancelar</Button>
                </>
              ) : (
                <>
                  <span className="font-medium text-lg">{b.name}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setEditId(b.id); setEditName(b.name) }}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="destructive" size="icon-sm" onClick={() => setDeleteId(b.id)}>
                      <Trash className="size-4" />
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
        <DialogClose asChild>
          <Button className="mt-4 w-full">Cerrar</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
