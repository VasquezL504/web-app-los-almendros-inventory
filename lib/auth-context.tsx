"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type GranularPermissions, DEFAULT_GRANULAR_PERMISSIONS, granularToLegacy, getAdminPermissions, getAdminGranularPermissions } from "./permissions"
import { loadInventoryData, savePermissions, loadPermissions } from "./server-actions"

type UserRole = "admin" | "employee" | null

interface User {
  code: string
  role: "admin" | "employee"
}

interface AuthContextValue {
  user: User | null
  permissions: ReturnType<typeof granularToLegacy>
  granularPermissions: GranularPermissions
  login: (code: string) => boolean
  logout: () => void
  isLoading: boolean
  updatePermissions: (newPermissions: Partial<GranularPermissions>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const VALID_CODES = {
  "qa-admin-26-ws": "admin",
  "ed-normal-rf": "employee",
} as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [granularPermissions, setGranularPermissions] = useState<GranularPermissions>(DEFAULT_GRANULAR_PERMISSIONS)

  // Load permissions from server on mount
  useEffect(() => {
    async function loadPerms() {
      try {
        const data = await loadInventoryData()
        if (data && data.granularPermissions) {
          setGranularPermissions(data.granularPermissions)
        }
      } catch (e) {
        console.error("Failed to load permissions:", e)
      }
    }
    loadPerms()
  }, [])

  // Poll for permission changes every 5 seconds for employees
  useEffect(() => {
    if (user?.role === "employee") {
      const interval = setInterval(async () => {
        try {
          const perms = await loadPermissions()
          if (perms) {
            setGranularPermissions(perms)
          }
        } catch (e) {
          // ignore polling errors
        }
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [user])

  useEffect(() => {
    const saved = localStorage.getItem("inventory-auth")
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User
        if (parsed.code && parsed.role) {
          setUser(parsed)
        }
      } catch {
        localStorage.removeItem("inventory-auth")
      }
    }
    setIsLoading(false)
  }, [])

  const login = (code: string): boolean => {
    const role = VALID_CODES[code as keyof typeof VALID_CODES]
    if (role) {
      const user = { code, role }
      setUser(user)
      localStorage.setItem("inventory-auth", JSON.stringify(user))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("inventory-auth")
  }

  const updatePermissions = async (newPerms: Partial<GranularPermissions>) => {
    if (user?.role === "admin" || user?.role === "employee") {
      const updated = { ...granularPermissions, ...newPerms }
      setGranularPermissions(updated)
      await savePermissions(updated)
    }
  }

  const permissions = user?.role === "admin" ? getAdminPermissions() : granularToLegacy(granularPermissions)
  const effectiveGranularPerms = user?.role === "admin" ? getAdminGranularPermissions() : granularPermissions

  return (
    <AuthContext.Provider value={{ user, permissions, granularPermissions: effectiveGranularPerms, login, logout, isLoading, updatePermissions }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
