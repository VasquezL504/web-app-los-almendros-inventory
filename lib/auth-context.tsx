"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type GranularPermissions, DEFAULT_GRANULAR_PERMISSIONS, granularToLegacy, getAdminPermissions, getAdminGranularPermissions } from "./permissions"
import { loadInventoryData, savePermissions, loadPermissions, loadEmployees } from "./server-actions"
import { ADMIN_CODE } from "./auth-constants"

type UserRole = "admin" | "employee" | null

interface User {
  code: string
  role: "admin" | "employee"
}

interface AuthContextValue {
  user: User | null
  permissions: ReturnType<typeof granularToLegacy>
  granularPermissions: GranularPermissions
  employeeGranularPermissions: GranularPermissions
  login: (code: string) => boolean
  logout: () => void
  isLoading: boolean
  updatePermissions: (newPermissions: Partial<GranularPermissions>) => void
  employees: Array<{ id: string; code: string; name: string; role: string; isActive: boolean; businessIds: string[] }>
  refreshEmployees: () => Promise<void>
  updateCurrentUserCode: (newCode: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [granularPermissions, setGranularPermissions] = useState<GranularPermissions>(DEFAULT_GRANULAR_PERMISSIONS)
  const [employees, setEmployees] = useState<Array<{ id: string; code: string; name: string; role: string; isActive: boolean; businessIds: string[] }>>([])

  const refreshEmployees = async () => {
    const emps = await loadEmployees()
    setEmployees(emps)
  }

  useEffect(() => {
    refreshEmployees()
  }, [])

  // Keep users in sync for all logged sessions so admin changes propagate quickly.
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      refreshEmployees()
    }, 3000)

    return () => clearInterval(interval)
  }, [user])

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
    const saved = sessionStorage.getItem("inventory-auth")
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User
        if (parsed.code && parsed.role) {
          setUser(parsed)
        }
      } catch {
        sessionStorage.removeItem("inventory-auth")
      }
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return

    if (user.code === ADMIN_CODE) return

    const dbUser = employees.find((employee) => employee.code === user.code)

    if (!dbUser || !dbUser.isActive) {
      logout()
      return
    }

    if (dbUser.role !== user.role) {
      const updated = { code: dbUser.code, role: dbUser.role as "admin" | "employee" }
      setUser(updated)
      sessionStorage.setItem("inventory-auth", JSON.stringify(updated))
    }
  }, [employees, user])

  const login = (code: string): boolean => {
    const adminUser = employees.find((employee) => employee.code === code && employee.isActive && employee.role === "admin")
    if (code === ADMIN_CODE || adminUser) {
      const user = { code, role: "admin" as const }
      setUser(user)
      sessionStorage.setItem("inventory-auth", JSON.stringify(user))
      return true
    }
    const employee = employees.find(e => e.code === code && e.isActive && e.role === "employee")
    if (employee) {
      const user = { code, role: "employee" as const }
      setUser(user)
      sessionStorage.setItem("inventory-auth", JSON.stringify(user))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem("inventory-auth")
  }

  const updateCurrentUserCode = (newCode: string) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, code: newCode }
      sessionStorage.setItem("inventory-auth", JSON.stringify(updated))
      return updated
    })
  }

  const updatePermissions = async (newPerms: Partial<GranularPermissions>) => {
    // Save employee permissions (not admin's full permissions)
    const updated = { ...granularPermissions, ...newPerms }
    setGranularPermissions(updated)
    await savePermissions(updated)
  }

  const permissions = user?.role === "admin" ? getAdminPermissions() : granularToLegacy(granularPermissions)
  const effectiveGranularPerms = user?.role === "admin" ? getAdminGranularPermissions() : granularPermissions
  const employeeGranularPermissions = granularPermissions

  return (
    <AuthContext.Provider value={{ user, permissions, granularPermissions: effectiveGranularPerms, employeeGranularPermissions, login, logout, isLoading, updatePermissions, employees, refreshEmployees, updateCurrentUserCode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
