"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type GranularPermissions, DEFAULT_GRANULAR_PERMISSIONS, getDefaultGranularPermissions, granularToLegacy, getAdminPermissions, getAdminGranularPermissions } from "./permissions"
import { loadRolePermissions, savePermissions, loadPermissions, loadEmployees } from "./server-actions"
import { ADMIN_CODE } from "./auth-constants"

type UserRole = "admin" | "employee" | "manager"

interface User {
  code: string
  role: UserRole
}

interface AuthContextValue {
  user: User | null
  permissions: ReturnType<typeof granularToLegacy>
  granularPermissions: GranularPermissions
  employeeGranularPermissions: GranularPermissions
  managerGranularPermissions: GranularPermissions
  login: (code: string) => boolean
  logout: () => void
  isLoading: boolean
  updatePermissions: (role: "employee" | "manager", newPermissions: Partial<GranularPermissions>) => void
  employees: Array<{ id: string; code: string; name: string; role: string; isActive: boolean; businessIds: string[] }>
  refreshEmployees: () => Promise<void>
  updateCurrentUserCode: (newCode: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [employeeGranularPermissions, setEmployeeGranularPermissions] = useState<GranularPermissions>(DEFAULT_GRANULAR_PERMISSIONS)
  const [managerGranularPermissions, setManagerGranularPermissions] = useState<GranularPermissions>(getDefaultGranularPermissions("manager"))
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

  // Load role permissions from server on mount
  useEffect(() => {
    async function loadPerms() {
      try {
        const permissionsByRole = await loadRolePermissions()
        setEmployeeGranularPermissions(permissionsByRole.employee)
        setManagerGranularPermissions(permissionsByRole.manager)
      } catch (e) {
        console.error("Failed to load permissions:", e)
      }
    }
    loadPerms()
  }, [])

  // Poll for permission changes every 5 seconds for non-admin users
  useEffect(() => {
    if (user?.role && user.role !== "admin") {
      const interval = setInterval(async () => {
        try {
          const perms = await loadPermissions(user.role)
          if (perms) {
            if (user.role === "employee") {
              setEmployeeGranularPermissions(perms)
            } else {
              setManagerGranularPermissions(perms)
            }
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
      const updated = { code: dbUser.code, role: dbUser.role as UserRole }
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
    const staffUser = employees.find(
      (employee) => employee.code === code && employee.isActive && (employee.role === "employee" || employee.role === "manager")
    )
    if (staffUser) {
      const user = { code: staffUser.code, role: staffUser.role as UserRole }
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

  const updatePermissions = async (role: "employee" | "manager", newPerms: Partial<GranularPermissions>) => {
    const currentPermissions = role === "employee" ? employeeGranularPermissions : managerGranularPermissions
    const updated = { ...currentPermissions, ...newPerms }

    if (role === "employee") {
      setEmployeeGranularPermissions(updated)
    } else {
      setManagerGranularPermissions(updated)
    }

    await savePermissions(updated, role)
  }

  const currentUserGranularPermissions = user?.role === "manager" ? managerGranularPermissions : employeeGranularPermissions
  const permissions = user?.role === "admin" ? getAdminPermissions() : granularToLegacy(currentUserGranularPermissions)
  const effectiveGranularPerms = user?.role === "admin" ? getAdminGranularPermissions() : currentUserGranularPermissions

  return (
    <AuthContext.Provider value={{ user, permissions, granularPermissions: effectiveGranularPerms, employeeGranularPermissions, managerGranularPermissions, login, logout, isLoading, updatePermissions, employees, refreshEmployees, updateCurrentUserCode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
