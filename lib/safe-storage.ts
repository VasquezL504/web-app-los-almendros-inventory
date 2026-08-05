/**
 * Wrappers around localStorage/sessionStorage that never throw.
 *
 * Safari (particularly private-browsing tabs, where storage quota is 0) throws
 * on writes, and some in-app webviews restrict storage entirely. Without an
 * app-wide error boundary, an uncaught exception here crashes the whole React
 * tree, so every call site should go through these instead of the raw API.
 */
function getStore(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function safeGet(kind: "local" | "session", key: string): string | null {
  try {
    return getStore(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(kind: "local" | "session", key: string, value: string): boolean {
  try {
    getStore(kind)?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeRemove(kind: "local" | "session", key: string): void {
  try {
    getStore(kind)?.removeItem(key)
  } catch {
    // ignore
  }
}

export const safeLocalStorage = {
  getItem: (key: string) => safeGet("local", key),
  setItem: (key: string, value: string) => safeSet("local", key, value),
  removeItem: (key: string) => safeRemove("local", key),
}

export const safeSessionStorage = {
  getItem: (key: string) => safeGet("session", key),
  setItem: (key: string, value: string) => safeSet("session", key, value),
  removeItem: (key: string) => safeRemove("session", key),
}
