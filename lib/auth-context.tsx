"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type AppPermissions, DEFAULT_PERMISSIONS, getPermissions } from "./permissions"
import { loadInventoryData, savePermissions, loadPermissions } from "./server-actions"

type UserRole = "admin" | "employee" | null

interface User {
  code: string
  role: "admin" | "employee"
}

interface AuthContextValue {
  user: User | null
  permissions: AppPermissions
  employeePermissions: AppPermissions
  login: (code: string) => boolean
  logout: () => void
  isLoading: boolean
  updatePermissions: (newPermissions: Partial<AppPermissions>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const VALID_CODES = {
  "qa-admin-26-ws": "admin",
  "ed-normal-rf": "employee",
} as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [permissions, setPermissions] = useState<AppPermissions>(DEFAULT_PERMISSIONS.employee)
  const [dbPermissions, setDbPermissions] = useState<AppPermissions | null>(null)

  // Load permissions from server on mount
  useEffect(() => {
    async function loadPerms() {
      try {
        const data = await loadInventoryData()
        if (data && data.permissions) {
          setDbPermissions(data.permissions)
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
            setPermissions(perms)
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

  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        setPermissions(getPermissions("admin"))
      } else {
        // Employee usa permisos de la DB
        if (dbPermissions) {
          setPermissions(dbPermissions)
        } else {
          setPermissions(getPermissions("employee"))
        }
      }
    }
  }, [user, dbPermissions])

  const login = (code: string): boolean => {
    const role = VALID_CODES[code as keyof typeof VALID_CODES]
    if (role) {
      const user = { code, role }
      setUser(user)
      localStorage.setItem("inventory-auth", JSON.stringify(user))
      setPermissions(getPermissions(role))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    setPermissions(DEFAULT_PERMISSIONS.employee)
    localStorage.removeItem("inventory-auth")
  }

  const updatePermissions = async (newPerms: Partial<AppPermissions>) => {
    // Admin can save employee permissions
    if (user?.role === "admin" || user?.role === "employee") {
      const updated = { ...employeePermissions, ...newPerms }
      
      // Guardar en DB
      await savePermissions(updated)
      
      // Update local state
      setDbPermissions(updated)
    }
  }

  const employeePermissions = dbPermissions || DEFAULT_PERMISSIONS.employee

  return (
    <AuthContext.Provider value={{ user, permissions, employeePermissions, login, logout, isLoading, updatePermissions }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
