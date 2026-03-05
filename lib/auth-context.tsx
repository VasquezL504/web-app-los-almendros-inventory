"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type UserRole = "admin" | "employee" | null

interface User {
  code: string
  role: "admin" | "employee"
}

interface AuthContextValue {
  user: User | null
  login: (code: string) => boolean
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const VALID_CODES = {
  "qa-admin-26-ws": "admin",
  "ed-normal-rf": "employee",
} as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
