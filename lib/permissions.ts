export interface AppPermissions {
  canViewBatchDetail: boolean
  canViewItemCardDetails: boolean
  canEditItems: boolean
  canDeleteItems: boolean
  canManageCategories: boolean
  canUseRemoveDialog: boolean
  canViewTotalValue: boolean
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
  },
  employee: {
    canViewBatchDetail: false,
    canViewItemCardDetails: false,
    canEditItems: true, // Both can add/edit
    canDeleteItems: false,
    canManageCategories: false,
    canUseRemoveDialog: false,
    canViewTotalValue: false,
  },
}

export function getPermissions(role: "admin" | "employee"): AppPermissions {
  return DEFAULT_PERMISSIONS[role]
}
