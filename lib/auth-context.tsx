"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type AppPermissions, DEFAULT_PERMISSIONS, getPermissions } from "./permissions"

type UserRole = "admin" | "employee" | null

interface User {
  code: string
  role: "admin" | "employee"
}

interface AuthContextValue {
  user: User | null
  permissions: AppPermissions
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
      // Admin siempre tiene todos los permisos
      if (user.role === "admin") {
        setPermissions(getPermissions("admin"))
      } else {
        // Employee usa permisos guardados o defaults
        const savedPerms = localStorage.getItem("inventory-permissions")
        if (savedPerms) {
          try {
            const parsed = JSON.parse(savedPerms) as AppPermissions
            setPermissions(parsed)
          } catch {
            setPermissions(getPermissions("employee"))
          }
        } else {
          setPermissions(getPermissions("employee"))
        }
      }
    }
  }, [user])

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

  const updatePermissions = (newPerms: Partial<AppPermissions>) => {
    // Solo guardar permisos de employee, admin siempre tiene todo
    if (user?.role === "employee") {
      const updated = { ...permissions, ...newPerms }
      setPermissions(updated)
      localStorage.setItem("inventory-permissions", JSON.stringify(updated))
    }
  }

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout, isLoading, updatePermissions }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
