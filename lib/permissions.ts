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

  // Editar información de productos
  allowEdit: "yes" | "no" | "custom"
  editNombre: boolean
  editCategorias: boolean
  editFechaCompra: boolean
  editFechaExpiracion: boolean
  editCantidad: boolean
  editMetrica: boolean
  editPrecioUnidad: boolean
  editCantidadMinima: boolean
  editNota: boolean

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
  editNombre: false,
  editCategorias: false,
  editFechaCompra: false,
  editFechaExpiracion: false,
  editCantidad: false,
  editMetrica: false,
  editPrecioUnidad: false,
  editCantidadMinima: false,
  editNota: false,

  // Simple toggles
  canDeleteItems: false,
  canManageCategories: false,
  canUseRemoveDialog: false,
  canViewTotalValue: false,
  canExportExcel: false,
  canBackupJSON: false,
  canImportBackup: false,
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
}

export function getPermissions(role: "admin" | "employee"): AppPermissions {
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
    editNombre: true,
    editCategorias: true,
    editFechaCompra: true,
    editFechaExpiracion: true,
    editCantidad: true,
    editMetrica: true,
    editPrecioUnidad: true,
    editCantidadMinima: true,
    editNota: true,
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
