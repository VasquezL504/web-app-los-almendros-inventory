"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package } from "lucide-react"

export default function LoginPage() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
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
            <div className="space-y-2">
              <Label htmlFor="code">Codigo de Empleado</Label>
              <Input
                id="code"
                type="text"
                placeholder="Ej. qa-admin-26-ws"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
              />
            </div>
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading || !code.trim()}>
              {isLoading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Codigos de prueba:<br />
              Admin: <code className="bg-muted px-1 rounded">qa-admin-26-ws</code><br />
              Empleado: <code className="bg-muted px-1 rounded">ed-normal-rf</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
