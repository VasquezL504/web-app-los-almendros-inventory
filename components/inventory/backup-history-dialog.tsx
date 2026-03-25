"use client"

import { useCallback, useEffect, useState } from "react"
import {
  deleteBackupSnapshotFromDB,
  loadBackupSnapshotsFromDB,
  restoreBackupSnapshotFromDB,
} from "@/lib/server-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react"

interface BackupHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface BackupSnapshotSummary {
  id: string
  createdAt: string
  reason: string
  itemCount: number
  eventCount: number
  businessCount: number
}

export function BackupHistoryDialog({ open, onOpenChange }: BackupHistoryDialogProps) {
  const [snapshots, setSnapshots] = useState<BackupSnapshotSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true)
    try {
      const loaded = await loadBackupSnapshotsFromDB(80)
      setSnapshots(loaded)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    loadSnapshots()
  }, [open, loadSnapshots])

  async function handleRestore(snapshotId: string, createdAt: string) {
    const formattedDate = new Date(createdAt).toLocaleString("es-HN")
    const confirmed = window.confirm(
      `Se restaurara el respaldo del ${formattedDate}. Esta accion reemplaza inventario e historial actuales. Deseas continuar?`
    )
    if (!confirmed) return

    setWorkingId(snapshotId)
    const result = await restoreBackupSnapshotFromDB(snapshotId)
    setWorkingId(null)

    if (!result.success) {
      alert(result.error || "No se pudo restaurar el respaldo")
      return
    }

    alert("Respaldo restaurado correctamente. Se recargara la pagina.")
    window.location.reload()
  }

  async function handleDelete(snapshotId: string) {
    const confirmed = window.confirm("Eliminar este respaldo del servidor?")
    if (!confirmed) return

    setWorkingId(snapshotId)
    const result = await deleteBackupSnapshotFromDB(snapshotId)
    setWorkingId(null)

    if (!result.success) {
      alert(result.error || "No se pudo eliminar el respaldo")
      return
    }

    await loadSnapshots()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de respaldos (Servidor)</DialogTitle>
          <DialogDescription>
            Puedes restaurar cualquier punto en el tiempo o limpiar respaldos antiguos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={loadSnapshots} disabled={isLoading}>
            <RefreshCw className="size-4" />
            Actualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando respaldos...</div>
        ) : snapshots.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No hay respaldos en servidor todavia.
          </div>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snapshot) => (
              <article key={snapshot.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{new Date(snapshot.createdAt).toLocaleString("es-HN")}</p>
                    <p className="text-xs text-muted-foreground">
                      Tipo: {snapshot.reason} | Items: {snapshot.itemCount} | Eventos: {snapshot.eventCount} | Negocios: {snapshot.businessCount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(snapshot.id, snapshot.createdAt)}
                      disabled={workingId === snapshot.id}
                    >
                      <RotateCcw className="size-4" />
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(snapshot.id)}
                      disabled={workingId === snapshot.id}
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
