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
