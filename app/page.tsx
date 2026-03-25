"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Dashboard } from "@/components/inventory/dashboard"
import { Package } from "lucide-react"

export default function ProtectedPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
      return
    }

    if (!isLoading && user && user.role !== "admin") {
      router.push("/inventory")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Package className="size-8 animate-pulse" />
          <span className="text-sm">Cargando...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (user.role !== "admin") {
    return null
  }

  return <Dashboard />
}
