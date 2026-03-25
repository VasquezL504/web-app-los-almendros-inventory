"use client"

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
  useRef,
  type ReactNode,
} from "react"
import {
  type InventoryItem,
  DEFAULT_CATEGORIES,
} from "@/lib/types"
import { loadInventoryData, saveInventoryData, saveBusinessesToDB } from "@/lib/server-actions"
import { type InventoryBackupData } from "@/lib/export-excel"
import { type Business, DEFAULT_BUSINESSES } from "@/lib/businesses"
import { toast } from "@/hooks/use-toast"

interface InventoryState {
  items: InventoryItem[]
  categoriesByBusiness: Record<string, string[]>
  nameHistory: string[]
  nextBatchNumber: number
  isHydrated: boolean
  businessId: string // Negocio activo
  businesses: Business[]
}

const initialState: InventoryState = {
  items: [],
  categoriesByBusiness: {},
  nameHistory: [],
  nextBatchNumber: 1,
  isHydrated: false,
  businessId: "", // Por defecto vacío
  businesses: [],
}

type Action =
  | { type: "HYDRATE"; payload: Omit<InventoryState, "isHydrated"> }
  | { type: "SET_BUSINESS"; payload: string }
  | { type: "SET_BUSINESSES"; payload: Business[] }
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

function getNextBatchNumberForBusiness(items: InventoryItem[], businessId: string): number {
  const businessItems = items.filter((item) => item.businessId === businessId)
  if (businessItems.length === 0) return 1
  return Math.max(...businessItems.map((item) => item.batchNumber)) + 1
}

function renumberBusinessItems(items: InventoryItem[], businessId: string): InventoryItem[] {
  const targetItems = items
    .filter((item) => item.businessId === businessId)
    .sort((a, b) => a.batchNumber - b.batchNumber)

  if (targetItems.length === 0) return items

  const nextBatchById = new Map(targetItems.map((item, index) => [item.id, index + 1]))

  return items.map((item) => {
    if (item.businessId !== businessId) return item
    const batchNumber = nextBatchById.get(item.id)
    return batchNumber ? { ...item, batchNumber } : item
  })
}

function renumberAllBusinesses(items: InventoryItem[]): InventoryItem[] {
  const businessIds = Array.from(new Set(items.map((item) => item.businessId)))
  return businessIds.reduce(
    (acc, businessId) => renumberBusinessItems(acc, businessId),
    items
  )
}

function reducer(state: InventoryState, action: Action): InventoryState {
  switch (action.type) {
    case "SET_BUSINESSES":
      return { ...state, businesses: action.payload }
    case "SET_BUSINESS":
      return {
        ...state,
        businessId: action.payload,
        nextBatchNumber: getNextBatchNumberForBusiness(state.items, action.payload),
      }
    case "EDIT_CATEGORY": {
      const { oldName, newName } = action.payload
      const currentCats = state.categoriesByBusiness[state.businessId] ?? [...DEFAULT_CATEGORIES]
      const updatedCats = currentCats.map(cat => cat === oldName ? newName : cat)
      const items = state.items.map(item =>
        item.businessId === state.businessId
          ? { ...item, categories: item.categories.map(cat => cat === oldName ? newName : cat) }
          : item
      )
      return {
        ...state,
        categoriesByBusiness: { ...state.categoriesByBusiness, [state.businessId]: updatedCats },
        items,
      }
    }

    case "DELETE_CATEGORY": {
      const name = action.payload
      const used = state.items.some(item => item.businessId === state.businessId && item.categories.includes(name))
      if (used) return state
      const currentCats = state.categoriesByBusiness[state.businessId] ?? [...DEFAULT_CATEGORIES]
      return {
        ...state,
        categoriesByBusiness: {
          ...state.categoriesByBusiness,
          [state.businessId]: currentCats.filter(cat => cat !== name),
        },
      }
    }
    case "HYDRATE": {
      const prunedItems = pruneZeroed(action.payload.items)
      const renumberedItems = renumberAllBusinesses(prunedItems)
      return {
        ...action.payload,
        isHydrated: true,
        items: renumberedItems,
        nextBatchNumber: getNextBatchNumberForBusiness(renumberedItems, action.payload.businessId),
        businesses: action.payload.businesses?.length ? action.payload.businesses : DEFAULT_BUSINESSES,
      }
    }

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

      const currentCats = state.categoriesByBusiness[state.businessId] ?? [...DEFAULT_CATEGORIES]
      const newCats = newItem.categories.filter((c) => !currentCats.includes(c))

      return {
        ...state,
        items: [...state.items, newItem],
        nameHistory,
        categoriesByBusiness: {
          ...state.categoriesByBusiness,
          [state.businessId]: [...currentCats, ...newCats],
        },
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
      const currentCats = state.categoriesByBusiness[state.businessId] ?? [...DEFAULT_CATEGORIES]
      const newCats = updatedItem
        ? updatedItem.categories.filter((c) => !currentCats.includes(c))
        : []

      return {
        ...state,
        items: pruneZeroed(items),
        categoriesByBusiness: {
          ...state.categoriesByBusiness,
          [state.businessId]: [...currentCats, ...newCats],
        },
      }
    }

    case "DELETE_ITEM": {
      const deleted = state.items.find((it) => it.id === action.payload)
      if (!deleted) return state
      const remaining = state.items.filter((item) => item.id !== action.payload)
      const renumbered = renumberBusinessItems(remaining, deleted.businessId)
      const next = getNextBatchNumberForBusiness(renumbered, state.businessId)

      return {
        ...state,
        items: renumbered,
        nextBatchNumber: next,
      }
    }

    case "ADD_CATEGORY": {
      const currentCats = state.categoriesByBusiness[state.businessId] ?? [...DEFAULT_CATEGORIES]
      if (currentCats.includes(action.payload)) return state
      return {
        ...state,
        categoriesByBusiness: {
          ...state.categoriesByBusiness,
          [state.businessId]: [...currentCats, action.payload],
        },
      }
    }

    case "REDUCE_ITEM": {
      const { itemName, quantity } = action.payload
      let remaining = quantity

      const sorted = [...state.items].sort((a, b) => {
        if (a.businessId !== b.businessId) {
          return a.businessId.localeCompare(b.businessId)
        }
        return a.batchNumber - b.batchNumber
      })
      const result: InventoryItem[] = []

      for (const item of sorted) {
        if (
          item.businessId !== state.businessId ||
          item.amount === 0 ||
          item.name.toLowerCase() !== itemName.toLowerCase()
        ) {
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
      const renumbered = renumberBusinessItems(pruned, state.businessId)
      const next = getNextBatchNumberForBusiness(renumbered, state.businessId)
      return {
        ...state,
        items: renumbered,
        nextBatchNumber: next,
      }
    }

    case "PRUNE_ZEROED": {
      const pruned = pruneZeroed(state.items)
      const renumbered = renumberAllBusinesses(pruned)
      const next = getNextBatchNumberForBusiness(renumbered, state.businessId)
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
  categories: string[]
  businesses: Business[]
  addItem: (item: Omit<InventoryItem, "id" | "batchNumber" | "createdAt">) => void
  updateItem: (id: string, updates: Partial<InventoryItem>) => void
  deleteItem: (id: string) => void
  addCategory: (name: string) => void
  editCategory: (oldName: string, newName: string) => void
  deleteCategory: (name: string) => void
  reduceItem: (itemName: string, quantity: number) => void
  importData: (data: InventoryBackupData) => void
  setBusiness: (businessId: string) => void
  updateBusinesses: (businesses: Business[]) => void
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Cambiar negocio activo
  const setBusiness = useCallback((businessId: string) => {
    dispatch({ type: "SET_BUSINESS", payload: businessId })
    if (typeof window !== "undefined") {
      if (businessId) {
        localStorage.setItem("inventory-last-business", businessId)
      } else {
        localStorage.removeItem("inventory-last-business")
      }
    }
  }, [])
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false)
  // Ref always holds the latest state so async callbacks can access it without
  // causing stale-closure issues or adding state to the effect deps.
  const stateRef = useRef(state)
  const lastSaveErrorRef = useRef<string | null>(null)
  useEffect(() => { stateRef.current = state })

  // Forzar recarga del inventario cada vez que cambia el usuario autenticado
  const { user } = require("@/lib/auth-context")?.useAuth?.() || { user: null }

  const hydrateFromServerData = useCallback((
    data: Awaited<ReturnType<typeof loadInventoryData>>,
    selectedBusinessId: string
  ) => {
    if (data) {
      const itemsWithBusiness = Array.isArray(data.items)
        ? data.items.map((item) => {
            if (typeof item.businessId === "string") {
              return item
            }
            return { ...item, businessId: selectedBusinessId }
          })
        : []

      const categoriesByBusiness: Record<string, string[]> = {}
      for (const cat of data.categories as Array<{ businessId: string; name: string }>) {
        const bId = cat.businessId || ""
        if (!categoriesByBusiness[bId]) categoriesByBusiness[bId] = []
        if (!categoriesByBusiness[bId].includes(cat.name)) categoriesByBusiness[bId].push(cat.name)
      }

      if (categoriesByBusiness[""]?.length && !categoriesByBusiness[selectedBusinessId]?.length) {
        categoriesByBusiness[selectedBusinessId] = categoriesByBusiness[""]
        delete categoriesByBusiness[""]
      }

      dispatch({
        type: "HYDRATE",
        payload: { ...data, items: itemsWithBusiness, categoriesByBusiness, businessId: selectedBusinessId, businesses: data.businesses?.length ? data.businesses : DEFAULT_BUSINESSES },
      })
      setHasLoadedFromDB(true)
      return
    }

    dispatch({
      type: "HYDRATE",
      payload: {
        items: [],
        categoriesByBusiness: {},
        nameHistory: [],
        nextBatchNumber: 1,
        businessId: selectedBusinessId,
        businesses: DEFAULT_BUSINESSES,
      },
    })
    setHasLoadedFromDB(true)
  }, [])

  useEffect(() => {
    let canceled = false

    async function load() {
      // Flush any unsaved changes before replacing state with a fresh DB load.
      // This prevents newly-added items being lost when user switches accounts
      // before the 500 ms debounce has fired.
      if (stateRef.current.isHydrated) {
        const catEntries = Object.entries(stateRef.current.categoriesByBusiness).flatMap(
          ([bId, names]) => (names as string[]).map((name: string) => ({ businessId: bId, name }))
        )
        await saveInventoryData({
          items: stateRef.current.items,
          categories: catEntries,
          nameHistory: stateRef.current.nameHistory,
          nextBatchNumber: stateRef.current.nextBatchNumber,
        })
      }

      if (canceled) return

      const data = await loadInventoryData()

      if (canceled) return

      const savedBusinessId = typeof window !== "undefined" ? localStorage.getItem("inventory-last-business") || "" : ""
      const businessId = savedBusinessId
      hydrateFromServerData(data, businessId)
    }

    load()
    return () => { canceled = true }
  }, [hydrateFromServerData, user])

  useEffect(() => {
    if (!user || user.role === "admin" || !hasLoadedFromDB) return

    let syncing = false

    async function refreshInventory() {
      if (syncing) return
      syncing = true
      try {
        const currentBusinessId = stateRef.current.businessId || ""
        const data = await loadInventoryData()
        hydrateFromServerData(data, currentBusinessId)
      } catch {
        // Ignore polling errors and keep current local state.
      } finally {
        syncing = false
      }
    }

    const interval = setInterval(refreshInventory, 5000)

    function handleVisibilityOrFocus() {
      if (document.visibilityState === "visible") {
        refreshInventory()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityOrFocus)
    window.addEventListener("focus", handleVisibilityOrFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
      window.removeEventListener("focus", handleVisibilityOrFocus)
    }
  }, [hasLoadedFromDB, hydrateFromServerData, user?.role])

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
    const catEntries = Object.entries(state.categoriesByBusiness).flatMap(
      ([bId, names]) => names.map(name => ({ businessId: bId, name }))
    )
    // Debounce the save
    const timeout = setTimeout(() => {
      saveInventoryData({
        items: state.items,
        categories: catEntries,
        nameHistory: state.nameHistory,
        nextBatchNumber: state.nextBatchNumber,
      }).then((result) => {
        if (result.success) {
          lastSaveErrorRef.current = null
          return
        }

        if (lastSaveErrorRef.current === result.error) {
          return
        }

        lastSaveErrorRef.current = result.error ?? "unknown"
        toast({
          title: "Error guardando inventario",
          description: "Los cambios no se pudieron guardar en la base de datos. Revisa el deploy y la configuracion de Prisma.",
          variant: "destructive",
        })
      })
    }, 500)
    
    return () => clearTimeout(timeout)
  }, [state.items, state.categoriesByBusiness, state.nameHistory, state.nextBatchNumber, hasLoadedFromDB, state.isHydrated])

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

  const importData = useCallback((data: InventoryBackupData) => {
    const fallbackBusinessId = state.businessId || ""
    const migratedItems = data.items.map((item) => ({
      ...item,
      businessId: typeof item.businessId === "string" ? item.businessId : fallbackBusinessId,
    }))
    const renumberedItems = renumberAllBusinesses(migratedItems)
    const nextBatchNumber = getNextBatchNumberForBusiness(renumberedItems, fallbackBusinessId)
    const categoriesByBusiness = Object.keys(data.categoriesByBusiness).length > 0
      ? data.categoriesByBusiness
      : { [fallbackBusinessId]: [...DEFAULT_CATEGORIES] }

    dispatch({
      type: "HYDRATE",
      payload: {
        items: renumberedItems,
        categoriesByBusiness,
        nameHistory: data.nameHistory,
        nextBatchNumber,
        businessId: fallbackBusinessId,
        businesses: data.businesses?.length ? data.businesses : state.businesses,
      },
    })
  }, [state.businessId, state.businesses])

  const categories = state.categoriesByBusiness[state.businessId] ?? [...DEFAULT_CATEGORIES]

  const updateBusinesses = useCallback((businesses: Business[]) => {
    dispatch({ type: "SET_BUSINESSES", payload: businesses })
  }, [])

  // Save businesses to DB whenever they change
  useEffect(() => {
    if (!hasLoadedFromDB || !state.isHydrated) return
    const timeout = setTimeout(() => {
      saveBusinessesToDB(state.businesses)
    }, 500)
    return () => clearTimeout(timeout)
  }, [state.businesses, hasLoadedFromDB, state.isHydrated])

  return (
    <InventoryContext.Provider
      value={{ state, categories, businesses: state.businesses, addItem, updateItem, deleteItem, addCategory, editCategory, deleteCategory, reduceItem, importData, setBusiness, updateBusinesses }}
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
