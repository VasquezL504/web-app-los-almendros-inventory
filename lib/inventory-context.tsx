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

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function reducer(state: InventoryState, action: Action): InventoryState {
  switch (action.type) {
    case "HYDRATE":
      return { ...action.payload, isHydrated: true }

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
      const items = state.items.map((item) =>
        item.id === action.payload.id
          ? { ...item, ...action.payload.updates }
          : item
      )
      // merge categories from updated item
      const updatedItem = items.find((i) => i.id === action.payload.id)
      const newCats = updatedItem
        ? updatedItem.categories.filter((c) => !state.categories.includes(c))
        : []

      return {
        ...state,
        items,
        categories: [...state.categories, ...newCats],
      }
    }

    case "DELETE_ITEM":
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

    case "ADD_CATEGORY":
      if (state.categories.includes(action.payload)) return state
      return {
        ...state,
        categories: [...state.categories, action.payload],
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

  return (
    <InventoryContext.Provider
      value={{ state, addItem, updateItem, deleteItem, addCategory }}
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
