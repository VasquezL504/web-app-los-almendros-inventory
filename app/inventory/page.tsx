"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Package } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { InventoryPage } from "@/components/inventory/inventory-page"

export default function InventoryRoutePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

  return <InventoryPage />
}
