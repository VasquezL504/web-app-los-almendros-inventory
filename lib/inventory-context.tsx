"use client"

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import {
  type InventoryItem,
  DEFAULT_CATEGORIES,
} from "@/lib/types"

// ---------- State ----------
interface InventoryState {
  items: InventoryItem[]
  categories: string[]
  nameHistory: string[] // previously used names for autocomplete
  nextBatchNumber: number
  isHydrated: boolean
}

const initialState: InventoryState = {
  items: [],
  categories: [...DEFAULT_CATEGORIES],
  nameHistory: [],
  nextBatchNumber: 1,
  isHydrated: false,
}

// ---------- Actions ----------
type Action =
  | { type: "HYDRATE"; payload: Omit<InventoryState, "isHydrated"> }
  | { type: "ADD_ITEM"; payload: Omit<InventoryItem, "id" | "batchNumber" | "createdAt"> }
  | { type: "UPDATE_ITEM"; payload: { id: string; updates: Partial<InventoryItem> } }
  | { type: "DELETE_ITEM"; payload: string }
  | { type: "ADD_CATEGORY"; payload: string }
  | { type: "REDUCE_ITEM"; payload: { itemName: string; quantity: number } }
  // action dispatched internally by timer or on hydrate to remove expired
  | { type: "PRUNE_ZEROED" }

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function pruneZeroed(items: InventoryItem[]): InventoryItem[] {
  const now = Date.now()
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours in ms
  return items.filter((item) => {
    if (item.amount > 0) return true
    const zeroed = item.zeroedAt ? new Date(item.zeroedAt).getTime() : now
    return now - zeroed < maxAge
  })
}

function reducer(state: InventoryState, action: Action): InventoryState {
  switch (action.type) {
    case "HYDRATE":
      // make sure any stale zeroed batches are removed immediately
      return { ...action.payload, isHydrated: true, items: pruneZeroed(action.payload.items) }

    case "ADD_ITEM": {
      const newItem: InventoryItem = {
        ...action.payload,
        id: generateId(),
        batchNumber: state.nextBatchNumber,
        createdAt: new Date().toISOString(),
      }
      const nameHistory = state.nameHistory.includes(newItem.name)
        ? state.nameHistory
        : [...state.nameHistory, newItem.name]

      // merge any new categories
      const newCats = newItem.categories.filter(
        (c) => !state.categories.includes(c)
      )

      return {
        ...state,
        items: [...state.items, newItem],
        nameHistory,
        categories: [...state.categories, ...newCats],
        nextBatchNumber: state.nextBatchNumber + 1,
      }
    }

    case "UPDATE_ITEM": {
      let items = state.items.map((item) =>
        item.id === action.payload.id
          ? { ...item, ...action.payload.updates }
          : item
      )
      // if an update made amount zero, stamp zeroedAt if missing
      items = items.map((item) =>
        item.amount === 0 && !item.zeroedAt
          ? { ...item, zeroedAt: new Date().toISOString() }
          : item
      )
      // merge categories from updated item
      const updatedItem = items.find((i) => i.id === action.payload.id)
      const newCats = updatedItem
        ? updatedItem.categories.filter((c) => !state.categories.includes(c))
        : []

      return {
        ...state,
        items: pruneZeroed(items),
        categories: [...state.categories, ...newCats],
      }
    }

    case "DELETE_ITEM": {
      // Find deleted item's batchNumber, shift down any higher batchNumbers
      const deleted = state.items.find((it) => it.id === action.payload)
      if (!deleted) return state
      const deletedBatch = deleted.batchNumber
      const shifted = state.items
        .filter((item) => item.id !== action.payload)
        .map((item) =>
          item.batchNumber > deletedBatch
            ? { ...item, batchNumber: item.batchNumber - 1 }
            : item
        )

      // Recalculate nextBatchNumber from remaining items (or reset to 1 if none)
      const next = shifted.length > 0 ? Math.max(...shifted.map((i) => i.batchNumber)) + 1 : 1

      return {
        ...state,
        items: shifted,
        nextBatchNumber: next,
      }
    }

    case "ADD_CATEGORY":
      if (state.categories.includes(action.payload)) return state
      return {
        ...state,
        categories: [...state.categories, action.payload],
      }

    case "REDUCE_ITEM": {
      const { itemName, quantity } = action.payload
      let remaining = quantity

      // sort items by batchNumber ascending so oldest first
      const sorted = [...state.items].sort((a, b) => a.batchNumber - b.batchNumber)
      const result: InventoryItem[] = []

      for (const item of sorted) {
        // keep zeroed records untouched, always preserve their timestamp
        if (item.amount === 0 || item.name.toLowerCase() !== itemName.toLowerCase()) {
          result.push(item)
          continue
        }

        if (remaining >= item.amount) {
          // consume whole batch -> keep it with zero amount and stamp time
          remaining -= item.amount
          result.push({ ...item, amount: 0, zeroedAt: new Date().toISOString() })
          continue
        }

        // partial consumption
        result.push({ ...item, amount: item.amount - remaining })
        remaining = 0
      }

      // if some remaining but no more items, just ignore extra
      // drop any stale zeroed batches before renumbering
      const pruned = pruneZeroed(result)
      const renumbered = pruned.map((it, idx) => ({ ...it, batchNumber: idx + 1 }))
      const next = renumbered.length > 0 ? Math.max(...renumbered.map((i) => i.batchNumber)) + 1 : 1
      return {
        ...state,
        items: renumbered,
        nextBatchNumber: next,
      }
    }

    case "PRUNE_ZEROED": {
      const pruned = pruneZeroed(state.items)
      // renumber after pruning
      const renumbered = pruned.map((it, idx) => ({ ...it, batchNumber: idx + 1 }))
      const next = renumbered.length > 0 ? Math.max(...renumbered.map((i) => i.batchNumber)) + 1 : 1
      return {
        ...state,
        items: renumbered,
        nextBatchNumber: next,
      }
    }

    default:
      return state
  }
}

// ---------- Persistence ----------
const STORAGE_KEY = "buffet-inventory"

function loadFromStorage(): InventoryState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as InventoryState
  } catch {
    return null
  }
}

function saveToStorage(state: InventoryState) {
  if (typeof window === "undefined") return
  try {
    const { isHydrated: _, ...rest } = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch {
    // storage full or unavailable
  }
}

// ---------- Context ----------
interface InventoryContextValue {
  state: InventoryState
  addItem: (item: Omit<InventoryItem, "id" | "batchNumber" | "createdAt">) => void
  updateItem: (id: string, updates: Partial<InventoryItem>) => void
  deleteItem: (id: string) => void
  addCategory: (name: string) => void
  reduceItem: (itemName: string, quantity: number) => void
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadFromStorage()
    if (saved) {
      dispatch({ type: "HYDRATE", payload: saved })
    } else {
      dispatch({
        type: "HYDRATE",
        payload: {
          items: [],
          categories: [...DEFAULT_CATEGORIES],
          nameHistory: [],
          nextBatchNumber: 1,
        },
      })
    }
  }, [])

  // periodically remove expired zeroed batches so they disappear after 24h
  useEffect(() => {
    if (!state.isHydrated) return
    // run once immediately, subsequent ticks handle long-running open apps
    dispatch({ type: "PRUNE_ZEROED" })
    const handle = setInterval(() => {
      dispatch({ type: "PRUNE_ZEROED" })
    }, 60 * 60 * 1000) // every hour
    return () => clearInterval(handle)
  }, [state.isHydrated])

  // Persist on every change after hydration
  useEffect(() => {
    if (state.isHydrated) {
      saveToStorage(state)
    }
  }, [state])

  const addItem = useCallback(
    (item: Omit<InventoryItem, "id" | "batchNumber" | "createdAt">) => {
      dispatch({ type: "ADD_ITEM", payload: item })
    },
    []
  )

  const updateItem = useCallback(
    (id: string, updates: Partial<InventoryItem>) => {
      dispatch({ type: "UPDATE_ITEM", payload: { id, updates } })
    },
    []
  )

  const deleteItem = useCallback((id: string) => {
    dispatch({ type: "DELETE_ITEM", payload: id })
  }, [])

  const addCategory = useCallback((name: string) => {
    dispatch({ type: "ADD_CATEGORY", payload: name })
  }, [])

  const reduceItem = useCallback((itemName: string, quantity: number) => {
    dispatch({ type: "REDUCE_ITEM", payload: { itemName, quantity } })
  }, [])

  return (
    <InventoryContext.Provider
      value={{ state, addItem, updateItem, deleteItem, addCategory, reduceItem }}
    >
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error("useInventory must be used inside InventoryProvider")
  return ctx
}
