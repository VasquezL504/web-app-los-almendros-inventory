"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Trash, Pencil } from "lucide-react"

// Mock business data for demo
interface Business {
  id: string
  name: string
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([
    { id: "almendros", name: "Los Almendros" },
    { id: "palmas", name: "Las Palmas" },
  ])
  const [newName, setNewName] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  function handleAdd() {
    if (!newName.trim()) return
    setBusinesses([...businesses, { id: Date.now().toString(), name: newName.trim() }])
    setNewName("")
  }

  function handleDelete(id: string) {
    setBusinesses(businesses.filter(b => b.id !== id))
  }

  function handleEdit(id: string) {
    const b = businesses.find(b => b.id === id)
    if (b) {
      setEditId(id)
      setEditName(b.name)
    }
  }

  function handleSaveEdit() {
    if (!editName.trim() || !editId) return
    setBusinesses(businesses.map(b => b.id === editId ? { ...b, name: editName.trim() } : b))
    setEditId(null)
    setEditName("")
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6">Administrar Negocios</h2>
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
                <Button size="sm" onClick={handleSaveEdit} disabled={!editName.trim()}>Guardar</Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditId(null)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <span className="font-medium text-lg">{b.name}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(b.id)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="destructive" size="icon-sm" onClick={() => handleDelete(b.id)}>
                    <Trash className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
