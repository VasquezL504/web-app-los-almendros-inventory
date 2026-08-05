"use client"

import { useEffect } from "react"

// Catches errors thrown in the root layout itself (app/error.tsx only covers
// nested routes). Must render its own <html>/<body> since it replaces the
// root layout entirely.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled root error:", error)
  }, [error])

  return (
    <html lang="es">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "1.5rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2>Ocurrio un error inesperado</h2>
          <p>Algo fallo al cargar la aplicacion. Tus datos no se perdieron, intenta de nuevo.</p>
          <button onClick={() => reset()}>Reintentar</button>
        </div>
      </body>
    </html>
  )
}
