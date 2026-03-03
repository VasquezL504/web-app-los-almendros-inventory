# Agent Guidelines for Juan's Inventory Web App

## Project Overview

This is a Next.js 16 inventory management web application built with React 19, TypeScript, and Tailwind CSS 4. It uses shadcn/ui components (Radix UI primitives) and stores inventory data in localStorage. The app is primarily written in Spanish for its UI text.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.7
- **UI Library:** React 19
- **Styling:** Tailwind CSS 4 with shadcn/ui
- **Package Manager:** pnpm
- **Icons:** Lucide React
- **Validation:** Zod
- **State:** React Context (localStorage persistence)

## Build Commands

```bash
# Development
pnpm dev          # Start development server at http://localhost:3000
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint on entire project

# No test framework is currently configured
# If adding tests, use Vitest or Jest with appropriate setup
```

## Code Style Guidelines

### TypeScript

- Use explicit TypeScript types; avoid `any`
- Use `interface` for component props and data types (PascalCase)
- Use `type` for unions, primitives, and utility types
- Use `Record<string, string>` for dynamic object key-value maps

```typescript
// Good
interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Omit<InventoryItem, "id" | "batchNumber">) => void
}

// Avoid
const props = { open: true, onOpenChange: (o) => {} }
```

### Component Structure

- Add `"use client"` directive at the top for client components
- Use named exports for components (PascalCase)
- Define prop interfaces above the component function
- Place helper functions outside the component or as regular functions

```typescript
// Good pattern
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MyComponentProps {
  title: string
}

export function MyComponent({ title }: MyComponentProps) {
  const [state, setState] = useState("")

  function helper() {
    return state
  }

  return <Button className={cn("px-4", state && "bg-primary")}>{title}</Button>
}
```

### Imports

- Use path aliases (`@/components`, `@/lib`, `@/hooks`)
- Group imports: React imports → third-party UI → local UI → utilities → types
- Use named imports for UI components

```typescript
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { type InventoryItem, METRICS } from "@/lib/types"
```

### Naming Conventions

- Components: PascalCase (e.g., `ItemDialog`, `Dashboard`)
- Functions/variables: camelCase (e.g., `handleSave`, `toggleCategory`)
- Types/interfaces: PascalCase (e.g., `InventoryItem`, `Metric`)
- Constants: PascalCase or UPPER_SNAKE_CASE (e.g., `METRICS`, `DEFAULT_CATEGORIES`)
- Files: kebab-case (e.g., `item-dialog.tsx`, `use-toast.ts`)

### Tailwind CSS

- Use Tailwind's `@/components` path alias for UI components
- Use `cn()` utility for conditional class merging
- Follow shadcn/ui "new-york" style
- Use responsive prefixes (sm:, md:, lg:)
- Use semantic color tokens (foreground, background, primary, destructive)

```typescript
// Good
<Button className={cn("w-full", isActive && "bg-primary")} />

// Avoid
<Button className={`w-full ${isActive ? "bg-primary" : ""}`} />
```

### Error Handling

- Use inline validation with error state objects
- Display errors below form fields with `text-xs text-destructive` class
- Spanish error messages (e.g., "El nombre es obligatorio")

```typescript
const [errors, setErrors] = useState<Record<string, string>>({})

function validate(): boolean {
  const errs: Record<string, string> = {}
  if (!name.trim()) errs.name = "El nombre es obligatorio"
  if (amount <= 0) errs.amount = "La cantidad debe ser mayor a 0"
  setErrors(errs)
  return Object.keys(errs).length === 0
}
```

### State Management

- Use React Context for global state (see `lib/inventory-context.tsx`)
- Use local `useState` for component-specific state
- Use `useEffect` for side effects (form reset, click outside detection)

### JSDoc Comments

- Add JSDoc for exported utility functions explaining their purpose
- Document complex logic and edge cases

```typescript
/**
 * Format a number with thousands separators and fixed decimals.
 *
 * Defaults to 2 decimal places and respects the user's locale.
 */
export function formatNumber(value: number, decimals: number = 2): string {
  // ...
}
```

### File Organization

```
app/                    # Next.js App Router pages
components/
  inventory/           # Feature-specific components
  ui/                  # shadcn/ui components (DO NOT modify directly)
lib/
  utils.ts             # Shared utilities (cn, formatNumber)
  types.ts             # TypeScript types and helper functions
  inventory-context.tsx # Global state management
```

### UI Components (shadcn/ui)

- Do NOT modify components in `components/ui/` directly
- Use props as documented in shadcn/ui
- Use variants via `class-variance-authority` pattern when available

## Common Tasks

### Adding a New Component

1. Use existing shadcn/ui components from `components/ui/`
2. Create feature components in `components/inventory/` or appropriate folder
3. Follow the patterns in existing components for props and state

### Adding a New Page

1. Create file in `app/` directory (e.g., `app/settings/page.tsx`)
2. Use default export for the page component
3. Add "use client" if client-side interactivity is needed

### Modifying Types

- Update types in `lib/types.ts`
- Export types needed across components
- Keep type definitions organized with comments

## Linting

Run `pnpm lint` before committing. Address all ESLint warnings and errors.
