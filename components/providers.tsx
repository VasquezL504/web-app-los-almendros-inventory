'use client'

import * as React from 'react'
import { ThemeProvider } from './theme-provider'
import { InventoryProvider } from '@/lib/inventory-context'
import { AuthProvider } from '@/lib/auth-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <InventoryProvider>
          {children}
        </InventoryProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
