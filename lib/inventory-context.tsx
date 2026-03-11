"use client"

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react"
import {
  type InventoryItem,
  DEFAULT_CATEGORIES,
} from "@/lib/types"
import { loadInventoryData, saveInventoryData } from "@/lib/server-actions"

interface InventoryState {
  items: InventoryItem[]
  categories: string[]
  nameHistory: string[]
  nextBatchNumber: number
  isHydrated: boolean
  businessId: string // Negocio activo
}

const initialState: InventoryState = {
  items: [],
  categories: [...DEFAULT_CATEGORIES],
  nameHistory: [],
  nextBatchNumber: 1,
  isHydrated: false,
  businessId: "", // Por defecto vacío
}

type Action =
  | { type: "HYDRATE"; payload: Omit<InventoryState, "isHydrated"> }
  | { type: "SET_BUSINESS"; payload: string }
  | { type: "ADD_ITEM"; payload: Omit<InventoryItem, "id" | "batchNumber" | "createdAt"> }
  | { type: "UPDATE_ITEM"; payload: { id: string; updates: Partial<InventoryItem> } }
  | { type: "DELETE_ITEM"; payload: string }
  | { type: "ADD_CATEGORY"; payload: string }
  | { type: "EDIT_CATEGORY"; payload: { oldName: string; newName: string } }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "REDUCE_ITEM"; payload: { itemName: string; quantity: number } }
  | { type: "PRUNE_ZEROED" }

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function pruneZeroed(items: InventoryItem[]): InventoryItem[] {
  const now = Date.now()
  const maxAge = 24 * 60 * 60 * 1000
  return items.filter((item) => {
    if (item.amount > 0) return true
    const zeroed = item.zeroedAt ? new Date(item.zeroedAt).getTime() : now
    return now - zeroed < maxAge
  })
}

function reducer(state: InventoryState, action: Action): InventoryState {
  switch (action.type) {
    case "SET_BUSINESS":
      return { ...state, businessId: action.payload }
    case "EDIT_CATEGORY": {
      const { oldName, newName } = action.payload
      const categories = state.categories.map(cat => cat === oldName ? newName : cat)
      const items = state.items.map(item => ({
        ...item,
        categories: item.categories.map(cat => cat === oldName ? newName : cat)
      }))
      return { ...state, categories, items }
    }

    case "DELETE_CATEGORY": {
      const name = action.payload
      const used = state.items.some(item => item.categories.includes(name))
      if (used) return state
      return {
        ...state,
        categories: state.categories.filter(cat => cat !== name)
      }
    }
    case "HYDRATE":
      return { ...action.payload, isHydrated: true, items: pruneZeroed(action.payload.items) }

    case "ADD_ITEM": {
      const newItem: InventoryItem = {
        ...action.payload,
        id: generateId(),
        batchNumber: state.nextBatchNumber,
        createdAt: new Date().toISOString(),
        businessId: state.businessId,
      }
      const nameHistory = state.nameHistory.includes(newItem.name)
        ? state.nameHistory
        : [...state.nameHistory, newItem.name]

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
          ? { ...item, ...action.payload.updates, businessId: state.businessId }
          : item
      )
      items = items.map((item) =>
        item.amount === 0 && !item.zeroedAt
          ? { ...item, zeroedAt: new Date().toISOString() }
          : item
      )
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

      const next = shifted.length > 0 ? Math.max(...shifted.map((i) => i.batchNumber)) + 1 : 1

      return {
        ...state,
        items: shifted,
        nextBatchNumber: next,
      }
    }

    case "ADD_CATEGORY":
      if (state.categories.includes(action.payload)) return state
      // Optionally, categories could be scoped by businessId if needed
      return {
        ...state,
        categories: [...state.categories, action.payload],
      }

    case "REDUCE_ITEM": {
      const { itemName, quantity } = action.payload
      let remaining = quantity

      const sorted = [...state.items].sort((a, b) => a.batchNumber - b.batchNumber)
      const result: InventoryItem[] = []

      for (const item of sorted) {
        if (item.amount === 0 || item.name.toLowerCase() !== itemName.toLowerCase()) {
          result.push(item)
          continue
        }

        if (remaining >= item.amount) {
          remaining -= item.amount
          result.push({ ...item, amount: 0, zeroedAt: new Date().toISOString() })
          continue
        }

        result.push({ ...item, amount: item.amount - remaining })
        remaining = 0
      }

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

interface InventoryContextValue {
  state: InventoryState
  addItem: (item: Omit<InventoryItem, "id" | "batchNumber" | "createdAt">) => void
  updateItem: (id: string, updates: Partial<InventoryItem>) => void
  deleteItem: (id: string) => void
  addCategory: (name: string) => void
  editCategory: (oldName: string, newName: string) => void
  deleteCategory: (name: string) => void
  reduceItem: (itemName: string, quantity: number) => void
  importData: (data: { items: InventoryItem[], categories: string[], nameHistory: string[], nextBatchNumber: number }) => void
  setBusiness: (businessId: string) => void
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
    // Cambiar negocio activo
    const setBusiness = useCallback((businessId: string) => {
      dispatch({ type: "SET_BUSINESS", payload: businessId })
    }, [])
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false)

  // Forzar recarga del inventario cada vez que cambia el usuario autenticado
  const { user } = require("@/lib/auth-context")?.useAuth?.() || { user: null }
  useEffect(() => {
    loadInventoryData().then(data => {
      const businessId = state.businessId || ""
      if (data) {
        // Ensure businessId exists in each item, cast legacy items
        const itemsWithBusiness = Array.isArray(data.items)
          ? data.items.map(item => {
              if (typeof item.businessId === "string") {
                return item
              }
              // Legacy: add businessId
              return { ...item, businessId }
            })
          : []
        dispatch({ type: "HYDRATE", payload: { ...data, items: itemsWithBusiness, businessId } })
        setHasLoadedFromDB(true)
      } else {
        dispatch({
          type: "HYDRATE",
          payload: {
            items: [],
            categories: [...DEFAULT_CATEGORIES],
            nameHistory: [],
            nextBatchNumber: 1,
            businessId
          }
        })
        setHasLoadedFromDB(true)
      }
    })
  }, [user])

  useEffect(() => {
    if (!state.isHydrated) return
    dispatch({ type: "PRUNE_ZEROED" })
    const handle = setInterval(() => {
      dispatch({ type: "PRUNE_ZEROED" })
    }, 60 * 60 * 1000)
    return () => clearInterval(handle)
  }, [state.isHydrated])

  // Save to DB only after initial load and when items/categories change
  useEffect(() => {
    if (!hasLoadedFromDB || !state.isHydrated) return
    
    // Debounce the save
    const timeout = setTimeout(() => {
      saveInventoryData(state)
    }, 500)
    
    return () => clearTimeout(timeout)
  }, [state.items, state.categories, state.nameHistory, state.nextBatchNumber, hasLoadedFromDB, state.isHydrated])

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

  const editCategory = useCallback((oldName: string, newName: string) => {
    dispatch({ type: "EDIT_CATEGORY", payload: { oldName, newName } })
  }, [])

  const deleteCategory = useCallback((name: string) => {
    dispatch({ type: "DELETE_CATEGORY", payload: name })
  }, [])

  const reduceItem = useCallback((itemName: string, quantity: number) => {
    dispatch({ type: "REDUCE_ITEM", payload: { itemName, quantity } })
  }, [])

  const importData = useCallback((data: { items: InventoryItem[], categories: string[], nameHistory: string[], nextBatchNumber: number }) => {
    dispatch({ type: "HYDRATE", payload: { ...data, businessId: state.businessId } })
  }, [])

  return (
    <InventoryContext.Provider
      value={{ state, addItem, updateItem, deleteItem, addCategory, editCategory, deleteCategory, reduceItem, importData, setBusiness }}
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
