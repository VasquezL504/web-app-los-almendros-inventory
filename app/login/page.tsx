"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const codeInputRef = useRef<HTMLInputElement | null>(null)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const submittedCode = codeInputRef.current?.value.trim() ?? ""
    if (!submittedCode) {
      setError("Ingresa tu codigo de acceso")
      setIsLoading(false)
      return
    }

    await new Promise(resolve => setTimeout(resolve, 500))

    const success = login(submittedCode)
    
    if (success) {
      router.push("/")
    } else {
      setError("Codigo de acceso invalido")
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
          <CardDescription>Ingresa tu codigo de acceso para acceder al inventario</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            <input
              type="text"
              name="username"
              autoComplete="username"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
              tabIndex={-1}
              aria-hidden="true"
              defaultValue="inventario"
            />
            <div className="space-y-2">
              <Label htmlFor="code">Codigo de acceso</Label>
              <div className="relative">
                <Input
                  ref={codeInputRef}
                  id="code"
                  type={showCode ? "text" : "password"}
                  name="password"
                  placeholder="Ingresa tu codigo"
                  onChange={() => setError("")}
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
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>


        </CardContent>
      </Card>
    </div>
  )
}
