"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    await new Promise(resolve => setTimeout(resolve, 500))

    const success = login(code.trim())
    
    if (success) {
      router.push("/")
    } else {
      setError("Codigo de empleado invalido")
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Package className="size-12 text-foreground" />
          </div>
          <CardTitle className="text-2xl">Los Almendros</CardTitle>
          <CardDescription>Ingresa tu codigo de empleado para acceder al inventario</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo oculto de username para que los gestores de contraseñas guarden la credencial correctamente */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
              tabIndex={-1}
              aria-hidden="true"
              readOnly
            />
            <div className="space-y-2">
              <Label htmlFor="code">Codigo de Empleado</Label>
              <div className="relative">
                <Input
                  id="code"
                  type={showCode ? "text" : "password"}
                  name="password"
                  placeholder="Ingresa tu codigo"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCode((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showCode ? "Ocultar codigo" : "Mostrar codigo"}
                >
                  {showCode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading || !code.trim()}>
              {isLoading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>


        </CardContent>
      </Card>
    </div>
  )
}
