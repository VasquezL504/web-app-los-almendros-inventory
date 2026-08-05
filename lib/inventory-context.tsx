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
  type MetricOption,
  DEFAULT_CATEGORIES,
  DEFAULT_METRICS,
} from "@/lib/types"
import { useAuth } from "@/lib/auth-context"
import {
  loadInventoryData,
  saveInventorySnapshot,
  loadMetrics,
  createInventoryItemDB,
  updateInventoryItemDB,
  deleteInventoryItemDB,
  reduceInventoryItemDB,
  renameCategoryForItemsDB,
  renameMetricForItemsDB,
  restoreInventoryItemsDB,
  pruneZeroedInventoryItemsDB,
} from "@/lib/server-actions"
import { type InventoryBackupData } from "@/lib/export-excel"
import { type Business, DEFAULT_BUSINESSES } from "@/lib/businesses"
import { toast } from "@/hooks/use-toast"
import { safeLocalStorage } from "@/lib/safe-storage"

interface InventoryState {
  items: InventoryItem[]
  categoriesByBusiness: Record<string, string[]>
  metrics: MetricOption[]
  nameHistory: string[]
  nextBatchNumber: number
  isHydrated: boolean
  businessId: string // Negocio activo
  businesses: Business[]
}

const initialState: InventoryState = {
  items: [],
  categoriesByBusiness: {},
  metrics: [...DEFAULT_METRICS],
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
  | { type: "SET_BUSINESS_ITEMS"; payload: { businessId: string; items: InventoryItem[] } }
  | { type: "SET_ALL_ITEMS"; payload: InventoryItem[] }
  | { type: "MERGE_ITEM_METADATA"; payload: { businessId: string; name: string; categories: string[] } }
  | { type: "ADD_CATEGORY"; payload: string }
  | { type: "EDIT_CATEGORY"; payload: { oldName: string; newName: string } }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "PRUNE_ZEROED" }
  | { type: "SET_METRICS"; payload: MetricOption[] }
  | { type: "ADD_METRIC"; payload: MetricOption }
  | { type: "EDIT_METRIC"; payload: { oldValue: string; newValue: string; newLabel: string } }
  | { type: "DELETE_METRIC"; payload: string }

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
      // Item-level category renames are applied via renameCategoryForItemsDB
      // + SET_ALL_ITEMS; this only updates the taxonomy list itself.
      const { oldName, newName } = action.payload
      const currentCats = state.categoriesByBusiness[state.businessId] ?? [...DEFAULT_CATEGORIES]
      const updatedCats = currentCats.map(cat => cat === oldName ? newName : cat)
      return {
        ...state,
        categoriesByBusiness: { ...state.categoriesByBusiness, [state.businessId]: updatedCats },
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

    // Replaces every item belonging to one business with the server's
    // authoritative post-mutation list (used after create/update/delete/
    // reduce, and by the periodic refresh poll).
    case "SET_BUSINESS_ITEMS": {
      const { businessId, items: businessItems } = action.payload
      const items = pruneZeroed([
        ...state.items.filter((item) => item.businessId !== businessId),
        ...businessItems,
      ])
      const nextBatchNumber = businessId === state.businessId
        ? getNextBatchNumberForBusiness(items, state.businessId)
        : state.nextBatchNumber
      return { ...state, items, nextBatchNumber }
    }

    // Full items replace, used after rare bulk admin operations (category/
    // metric rename across items) and backup restore.
    case "SET_ALL_ITEMS": {
      const items = pruneZeroed(action.payload)
      return {
        ...state,
        items,
        nextBatchNumber: getNextBatchNumberForBusiness(items, state.businessId),
      }
    }

    case "MERGE_ITEM_METADATA": {
      const { businessId, name, categories } = action.payload
      const nameHistory = state.nameHistory.includes(name)
        ? state.nameHistory
        : [...state.nameHistory, name]
      const currentCats = state.categoriesByBusiness[businessId] ?? [...DEFAULT_CATEGORIES]
      const newCats = categories.filter((c) => !currentCats.includes(c))
      return {
        ...state,
        nameHistory,
        categoriesByBusiness: newCats.length > 0
          ? { ...state.categoriesByBusiness, [businessId]: [...currentCats, ...newCats] }
          : state.categoriesByBusiness,
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

    case "SET_METRICS":
      return { ...state, metrics: action.payload }

    case "ADD_METRIC": {
      const exists = state.metrics.some(m => m.value === action.payload.value)
      if (exists) return state
      return { ...state, metrics: [...state.metrics, action.payload] }
    }

    case "EDIT_METRIC": {
      // Item-level metric renames are applied via renameMetricForItemsDB +
      // SET_ALL_ITEMS; this only updates the metrics list itself.
      const { oldValue, newValue, newLabel } = action.payload
      return {
        ...state,
        metrics: state.metrics.map(m =>
          m.value === oldValue ? { ...m, value: newValue, label: newLabel } : m
        ),
      }
    }

    case "DELETE_METRIC": {
      const value = action.payload
      const used = state.items.some(item => item.metric === value)
      if (used) return state
      return {
        ...state,
        metrics: state.metrics.filter(m => m.value !== value),
      }
    }

    default:
      return state
  }
}

interface InventoryContextValue {
  state: InventoryState
  categories: string[]
  metrics: MetricOption[]
  businesses: Business[]
  addItem: (item: Omit<InventoryItem, "id" | "batchNumber" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; error?: string }>
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<{ success: boolean; error?: string; conflict?: boolean }>
  deleteItem: (id: string) => Promise<{ success: boolean; error?: string }>
  addCategory: (name: string) => void
  editCategory: (oldName: string, newName: string) => Promise<void>
  deleteCategory: (name: string) => void
  addMetric: (metric: MetricOption) => void
  editMetric: (oldValue: string, newValue: string, newLabel: string) => Promise<void>
  deleteMetric: (value: string) => void
  reduceItem: (itemName: string, quantity: number) => Promise<{ success: boolean; error?: string }>
  importData: (data: InventoryBackupData) => Promise<void>
  setBusiness: (businessId: string) => void
  updateBusinesses: (businesses: Business[]) => void
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { user } = useAuth()
  // Cambiar negocio activo
  const setBusiness = useCallback((businessId: string) => {
    dispatch({ type: "SET_BUSINESS", payload: businessId })
    if (typeof window !== "undefined") {
      if (businessId) {
        safeLocalStorage.setItem("inventory-last-business", businessId)
      } else {
        safeLocalStorage.removeItem("inventory-last-business")
      }
    }
  }, [])
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false)
  // Ref always holds the latest state so async callbacks can access it without
  // causing stale-closure issues or adding state to the effect deps.
  const stateRef = useRef(state)
  const lastSaveErrorRef = useRef<string | null>(null)
  // Tracks the exact state object last written to the DB, so callers can skip
  // redundant saves when nothing changed since then.
  const lastPersistedRef = useRef<InventoryState | null>(null)
  useEffect(() => { stateRef.current = state })

  const getSnapshotPayload = useCallback((snapshot: InventoryState) => {
    const categories = Object.entries(snapshot.categoriesByBusiness).flatMap(
      ([businessId, names]) => names.map((name) => ({ businessId, name }))
    )

    return {
      categories,
      nameHistory: snapshot.nameHistory,
      nextBatchNumber: snapshot.nextBatchNumber,
      businesses: snapshot.businesses,
      metrics: snapshot.metrics,
    }
  }, [])

  const persistSnapshot = useCallback(async (snapshot: InventoryState, showToastOnError: boolean) => {
    const result = await saveInventorySnapshot(getSnapshotPayload(snapshot))

    if (result.success) {
      lastSaveErrorRef.current = null
      return true
    }

    if (!showToastOnError) {
      return false
    }

    if (lastSaveErrorRef.current === result.error) {
      return false
    }

    lastSaveErrorRef.current = result.error ?? "unknown"
    toast({
      title: "Error guardando inventario",
      description: "Los cambios no se pudieron guardar en la base de datos. Revisa el deploy y la configuracion de Prisma.",
      variant: "destructive",
    })

    return false
  }, [getSnapshotPayload])

  const hydrateFromServerData = useCallback((
    data: Awaited<ReturnType<typeof loadInventoryData>>,
    selectedBusinessId: string,
    metricsData?: MetricOption[]
  ) => {
    const resolvedMetrics = metricsData ?? DEFAULT_METRICS
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
        payload: { ...data, items: itemsWithBusiness, categoriesByBusiness, metrics: resolvedMetrics, businessId: selectedBusinessId, businesses: data.businesses?.length ? data.businesses : DEFAULT_BUSINESSES },
      })
      setHasLoadedFromDB(true)
      return
    }

    dispatch({
      type: "HYDRATE",
      payload: {
        items: [],
        categoriesByBusiness: {},
        metrics: resolvedMetrics,
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
        await persistSnapshot(stateRef.current, false)
      }

      if (canceled) return

      const [data, metricsData] = await Promise.all([
        loadInventoryData(),
        loadMetrics(),
      ])

      if (canceled) return

      const savedBusinessId = safeLocalStorage.getItem("inventory-last-business") || ""
      const businessId = savedBusinessId
      hydrateFromServerData(data, businessId, metricsData)
    }

    load()
    return () => { canceled = true }
  }, [hydrateFromServerData, user])

  useEffect(() => {
    if (!user || !hasLoadedFromDB) return

    let syncing = false

    async function refreshInventory() {
      if (syncing) return
      syncing = true
      try {
        const preSyncState = stateRef.current
        const currentBusinessId = preSyncState.businessId || ""
        // Flush any pending local changes before polling to avoid losing data.
        // Skip the write entirely if nothing changed since the last save —
        // otherwise every device re-runs a full delete/recreate transaction
        // every 5s regardless of edits, and that write load multiplies with
        // each concurrently connected phone/tablet.
        if (preSyncState.isHydrated && lastPersistedRef.current !== preSyncState) {
          const saved = await persistSnapshot(preSyncState, false)
          if (saved) lastPersistedRef.current = preSyncState
        }
        const [data, metricsData] = await Promise.all([
          loadInventoryData(),
          loadMetrics(),
        ])
        // If the user changed something locally while this round trip was in
        // flight (more likely on slow mobile/tablet connections), applying
        // this now-stale server snapshot would silently revert that edit.
        // Skip it and let the next poll pick up the latest state instead.
        if (stateRef.current !== preSyncState) return
        hydrateFromServerData(data, currentBusinessId, metricsData)
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
  }, [hasLoadedFromDB, hydrateFromServerData, user])

  useEffect(() => {
    if (!state.isHydrated) return
    dispatch({ type: "PRUNE_ZEROED" })
    const runServerPrune = async () => {
      const result = await pruneZeroedInventoryItemsDB()
      if (result.success) {
        dispatch({ type: "SET_ALL_ITEMS", payload: result.items })
      }
    }
    if (hasLoadedFromDB) void runServerPrune()
    const handle = setInterval(() => {
      dispatch({ type: "PRUNE_ZEROED" })
      void runServerPrune()
    }, 60 * 60 * 1000)
    return () => clearInterval(handle)
  }, [state.isHydrated, hasLoadedFromDB])

  // Save to DB only after initial load and when inventory-related state changes.
  useEffect(() => {
    if (!hasLoadedFromDB || !state.isHydrated) return

    // Debounce the save
    const timeout = setTimeout(async () => {
      const saved = await persistSnapshot(state, true)
      if (saved) lastPersistedRef.current = state
    }, 500)

    return () => clearTimeout(timeout)
  }, [
    state.items,
    state.categoriesByBusiness,
    state.nameHistory,
    state.nextBatchNumber,
    state.businesses,
    state.metrics,
    hasLoadedFromDB,
    state.isHydrated,
    persistSnapshot,
    state,
  ])

  const addItem = useCallback(
    async (item: Omit<InventoryItem, "id" | "batchNumber" | "createdAt" | "updatedAt">) => {
      const businessId = stateRef.current.businessId
      const result = await createInventoryItemDB({ ...item, businessId })

      if (!result.success) {
        toast({
          title: "No se pudo guardar el producto",
          description: result.error || "Intenta de nuevo.",
          variant: "destructive",
        })
        return { success: false, error: result.error }
      }

      dispatch({ type: "SET_BUSINESS_ITEMS", payload: { businessId: result.businessId, items: result.items } })
      dispatch({ type: "MERGE_ITEM_METADATA", payload: { businessId, name: item.name, categories: item.categories } })
      return { success: true }
    },
    []
  )

  const updateItem = useCallback(
    async (id: string, updates: Partial<InventoryItem>) => {
      const current = stateRef.current.items.find((i) => i.id === id)
      if (!current) {
        toast({
          title: "No se pudo actualizar el producto",
          description: "Este producto ya no existe.",
          variant: "destructive",
        })
        return { success: false, error: "not-found" }
      }

      const result = await updateInventoryItemDB(id, updates, current.updatedAt)

      if (!result.success) {
        toast({
          title: result.conflict ? "Otro usuario ya modifico este producto" : "No se pudo actualizar el producto",
          description: result.error || "Intenta de nuevo.",
          variant: "destructive",
        })
        if (result.conflict) {
          // Pull the latest authoritative version so the UI reflects
          // whichever change "won" instead of staying stale.
          const data = await loadInventoryData()
          if (data) {
            const items = data.items.filter((i) => i.businessId === current.businessId)
            dispatch({ type: "SET_BUSINESS_ITEMS", payload: { businessId: current.businessId, items } })
          }
        }
        return { success: false, error: result.error, conflict: result.conflict }
      }

      dispatch({ type: "SET_BUSINESS_ITEMS", payload: { businessId: result.businessId, items: result.items } })
      dispatch({
        type: "MERGE_ITEM_METADATA",
        payload: {
          businessId: current.businessId,
          name: updates.name ?? current.name,
          categories: updates.categories ?? current.categories,
        },
      })
      return { success: true }
    },
    []
  )

  const deleteItem = useCallback(async (id: string) => {
    const current = stateRef.current.items.find((i) => i.id === id)
    const result = await deleteInventoryItemDB(id)

    if (!result.success) {
      toast({
        title: "No se pudo eliminar el producto",
        description: result.error || "Intenta de nuevo.",
        variant: "destructive",
      })
      return { success: false, error: result.error }
    }

    const businessId = result.businessId ?? current?.businessId ?? stateRef.current.businessId
    dispatch({ type: "SET_BUSINESS_ITEMS", payload: { businessId, items: result.items } })
    return { success: true }
  }, [])

  const addCategory = useCallback((name: string) => {
    dispatch({ type: "ADD_CATEGORY", payload: name })
  }, [])

  const editCategory = useCallback(async (oldName: string, newName: string) => {
    const businessId = stateRef.current.businessId
    dispatch({ type: "EDIT_CATEGORY", payload: { oldName, newName } })

    const result = await renameCategoryForItemsDB(businessId, oldName, newName)
    if (!result.success) {
      toast({
        title: "No se pudieron actualizar los productos de esta categoria",
        description: result.error || "Intenta de nuevo.",
        variant: "destructive",
      })
      return
    }

    const data = await loadInventoryData()
    if (data) {
      const items = data.items.map((item) =>
        typeof item.businessId === "string" ? item : { ...item, businessId }
      )
      dispatch({ type: "SET_ALL_ITEMS", payload: items })
    }
  }, [])

  const deleteCategory = useCallback((name: string) => {
    dispatch({ type: "DELETE_CATEGORY", payload: name })
  }, [])

  const addMetric = useCallback((metric: MetricOption) => {
    dispatch({ type: "ADD_METRIC", payload: metric })
  }, [])

  const editMetric = useCallback(async (oldValue: string, newValue: string, newLabel: string) => {
    dispatch({ type: "EDIT_METRIC", payload: { oldValue, newValue, newLabel } })

    const result = await renameMetricForItemsDB(oldValue, newValue)
    if (!result.success) {
      toast({
        title: "No se pudieron actualizar los productos con esta unidad",
        description: result.error || "Intenta de nuevo.",
        variant: "destructive",
      })
      return
    }

    const businessId = stateRef.current.businessId
    const data = await loadInventoryData()
    if (data) {
      const items = data.items.map((item) =>
        typeof item.businessId === "string" ? item : { ...item, businessId }
      )
      dispatch({ type: "SET_ALL_ITEMS", payload: items })
    }
  }, [])

  const deleteMetric = useCallback((value: string) => {
    dispatch({ type: "DELETE_METRIC", payload: value })
  }, [])

  const reduceItem = useCallback(async (itemName: string, quantity: number) => {
    const businessId = stateRef.current.businessId
    const result = await reduceInventoryItemDB(businessId, itemName, quantity)

    if (!result.success) {
      toast({
        title: "No se pudo actualizar el stock",
        description: result.error || "Intenta de nuevo.",
        variant: "destructive",
      })
      return { success: false, error: result.error }
    }

    dispatch({ type: "SET_BUSINESS_ITEMS", payload: { businessId: result.businessId, items: result.items } })
    return { success: true }
  }, [])

  const importData = useCallback(async (data: InventoryBackupData) => {
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

    const result = await restoreInventoryItemsDB(renumberedItems)
    if (!result.success) {
      toast({
        title: "No se pudo restaurar el respaldo",
        description: result.error || "Intenta de nuevo.",
        variant: "destructive",
      })
      return
    }

    dispatch({
      type: "HYDRATE",
      payload: {
        items: result.items,
        categoriesByBusiness,
        metrics: state.metrics, // keep current metrics on import
        nameHistory: data.nameHistory,
        nextBatchNumber,
        businessId: fallbackBusinessId,
        businesses: data.businesses?.length ? data.businesses : state.businesses,
      },
    })
  }, [state.businessId, state.businesses, state.metrics])

  const categories = state.categoriesByBusiness[state.businessId] ?? [...DEFAULT_CATEGORIES]
  const metrics = state.metrics

  const updateBusinesses = useCallback((businesses: Business[]) => {
    dispatch({ type: "SET_BUSINESSES", payload: businesses })
  }, [])

  return (
    <InventoryContext.Provider
      value={{ state, categories, metrics, businesses: state.businesses, addItem, updateItem, deleteItem, addCategory, editCategory, deleteCategory, addMetric, editMetric, deleteMetric, reduceItem, importData, setBusiness, updateBusinesses }}
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
