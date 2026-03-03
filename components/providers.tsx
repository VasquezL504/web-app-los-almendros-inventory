'use client'

import * as React from 'react'
import { ThemeProvider } from './theme-provider'
import { InventoryProvider } from '@/lib/inventory-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <InventoryProvider>
        {children}
      </InventoryProvider>
    </ThemeProvider>
  )
}
