"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled client error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h2 className="text-xl font-semibold">Ocurrio un error inesperado</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Algo fallo al cargar esta pagina. Tus datos no se perdieron, intenta de nuevo.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Reintentar</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Recargar pagina
        </Button>
      </div>
    </div>
  )
}
