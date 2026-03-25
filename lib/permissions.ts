export interface GranularPermissions {
  // Ver detalles del producto en la lista
  showListCantidad: "yes" | "no" | "custom"
  listCantidadDetail: boolean
  listValorTotalDetail: boolean
  listExpiracionDetail: boolean

  // Ver detalles del producto en la tarjeta completa
  showCardDetails: "yes" | "no" | "custom"
  cardCantidad: boolean
  cardPrecioUnidad: boolean
  cardValorLote: boolean
  cardFechaCompra: boolean
  cardFechaExpiracion: boolean
  cardCantidadMinima: boolean

  // Editar información de productos (simple yes/no)
  allowEdit: "yes" | "no"
  canEditItems: boolean

  // Simple toggles
  canDeleteItems: boolean
  canManageCategories: boolean
  canUseRemoveDialog: boolean
  canViewTotalValue: boolean
  canExportExcel: boolean
  canBackupJSON: boolean
  canImportBackup: boolean
}

export const DEFAULT_GRANULAR_PERMISSIONS: GranularPermissions = {
  // Lista
  showListCantidad: "yes",
  listCantidadDetail: false,
  listValorTotalDetail: false,
  listExpiracionDetail: false,

  // Tarjeta completa
  showCardDetails: "yes",
  cardCantidad: false,
  cardPrecioUnidad: false,
  cardValorLote: false,
  cardFechaCompra: false,
  cardFechaExpiracion: false,
  cardCantidadMinima: false,

  // Editar
  allowEdit: "yes",
  canEditItems: true,

  // Simple toggles
  canDeleteItems: false,
  canManageCategories: false,
  canUseRemoveDialog: false,
  canViewTotalValue: false,
  canExportExcel: false,
  canBackupJSON: false,
  canImportBackup: false,
}

export const DEFAULT_MANAGER_GRANULAR_PERMISSIONS: GranularPermissions = {
  // Lista
  showListCantidad: "yes",
  listCantidadDetail: true,
  listValorTotalDetail: true,
  listExpiracionDetail: true,

  // Tarjeta completa
  showCardDetails: "yes",
  cardCantidad: true,
  cardPrecioUnidad: true,
  cardValorLote: true,
  cardFechaCompra: true,
  cardFechaExpiracion: true,
  cardCantidadMinima: true,

  // Editar
  allowEdit: "yes",
  canEditItems: true,

  // Simple toggles
  canDeleteItems: false,
  canManageCategories: true,
  canUseRemoveDialog: true,
  canViewTotalValue: true,
  canExportExcel: true,
  canBackupJSON: false,
  canImportBackup: false,
}

export function getDefaultGranularPermissions(role: "employee" | "manager"): GranularPermissions {
  return role === "manager" ? DEFAULT_MANAGER_GRANULAR_PERMISSIONS : DEFAULT_GRANULAR_PERMISSIONS
}

// Legacy support
export interface AppPermissions {
  canViewBatchDetail: boolean
  canViewItemCardDetails: boolean
  canEditItems: boolean
  canDeleteItems: boolean
  canManageCategories: boolean
  canUseRemoveDialog: boolean
  canViewTotalValue: boolean
  canExportExcel: boolean
  canBackupJSON: boolean
  canImportBackup: boolean
}

export const DEFAULT_PERMISSIONS: Record<string, AppPermissions> = {
  admin: {
    canViewBatchDetail: true,
    canViewItemCardDetails: true,
    canEditItems: true,
    canDeleteItems: true,
    canManageCategories: true,
    canUseRemoveDialog: true,
    canViewTotalValue: true,
    canExportExcel: true,
    canBackupJSON: true,
    canImportBackup: true,
  },
  employee: {
    canViewBatchDetail: false,
    canViewItemCardDetails: false,
    canEditItems: true,
    canDeleteItems: false,
    canManageCategories: false,
    canUseRemoveDialog: false,
    canViewTotalValue: false,
    canExportExcel: false,
    canBackupJSON: false,
    canImportBackup: false,
  },
  manager: {
    canViewBatchDetail: true,
    canViewItemCardDetails: true,
    canEditItems: true,
    canDeleteItems: false,
    canManageCategories: true,
    canUseRemoveDialog: true,
    canViewTotalValue: true,
    canExportExcel: true,
    canBackupJSON: false,
    canImportBackup: false,
  },
}

export function getPermissions(role: "admin" | "employee" | "manager"): AppPermissions {
  return DEFAULT_PERMISSIONS[role]
}

// Get full admin permissions
export function getAdminPermissions(): AppPermissions {
  return DEFAULT_PERMISSIONS.admin
}

// Get admin granular permissions (all full access)
export function getAdminGranularPermissions(): GranularPermissions {
  return {
    showListCantidad: "yes",
    listCantidadDetail: true,
    listValorTotalDetail: true,
    listExpiracionDetail: true,
    showCardDetails: "yes",
    cardCantidad: true,
    cardPrecioUnidad: true,
    cardValorLote: true,
    cardFechaCompra: true,
    cardFechaExpiracion: true,
    cardCantidadMinima: true,
    allowEdit: "yes",
    canEditItems: true,
    canDeleteItems: true,
    canManageCategories: true,
    canUseRemoveDialog: true,
    canViewTotalValue: true,
    canExportExcel: true,
    canBackupJSON: true,
    canImportBackup: true,
  }
}

// Convert granular to legacy for compatibility
export function granularToLegacy(g: GranularPermissions): AppPermissions {
  return {
    canViewBatchDetail: g.showCardDetails === "yes" || (g.showCardDetails === "custom" && g.cardCantidad),
    canViewItemCardDetails: g.showCardDetails !== "no",
    canEditItems: g.allowEdit !== "no",
    canDeleteItems: g.canDeleteItems,
    canManageCategories: g.canManageCategories,
    canUseRemoveDialog: g.canUseRemoveDialog,
    canViewTotalValue: g.canViewTotalValue,
    canExportExcel: g.canExportExcel,
    canBackupJSON: g.canBackupJSON,
    canImportBackup: g.canImportBackup,
  }
}
