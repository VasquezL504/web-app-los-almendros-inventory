export interface Business {
  id: string
  name: string
}

const STORAGE_KEY = "inventory-businesses"

export const DEFAULT_BUSINESSES: Business[] = [
  { id: "almendros", name: "Los Almendros" },
  { id: "palmas", name: "Las Palmas" },
]

export function loadBusinesses(): Business[] {
  if (typeof window === "undefined") return DEFAULT_BUSINESSES

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_BUSINESSES

  try {
    const parsed = JSON.parse(raw) as Business[]
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_BUSINESSES

    const valid = parsed.filter((b) => typeof b?.id === "string" && typeof b?.name === "string")
    return valid.length ? valid : DEFAULT_BUSINESSES
  } catch {
    return DEFAULT_BUSINESSES
  }
}

export function saveBusinesses(businesses: Business[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(businesses))
}
