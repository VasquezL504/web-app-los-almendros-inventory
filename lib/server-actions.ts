"use server"

import { prisma } from "@/lib/db"
import { type Metric } from "@/lib/types"
import { type AppPermissions, DEFAULT_PERMISSIONS } from "./permissions"

export async function loadInventoryData() {
  try {
    const items = await prisma.inventoryItem.findMany()
    const categories = await prisma.category.findMany()
    const appState = await prisma.appState.findUnique({ where: { id: "app_state" } })
    const permissions = await prisma.permissions.findUnique({ where: { id: "employee_permissions" } })

    return {
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        categories: item.categories,
        buyingDate: item.buyingDate,
        expirationDate: item.expirationDate,
        amount: item.amount,
        metric: item.metric as Metric,
        pricePerUnit: item.pricePerUnit,
        minAmount: item.minAmount,
        note: item.note,
        batchNumber: item.batchNumber,
        createdAt: item.createdAt,
        zeroedAt: item.zeroedAt || undefined,
      })),
      categories: categories.map(c => c.name),
      nameHistory: appState?.nameHistory || [],
      nextBatchNumber: appState?.nextBatchNumber || 1,
      permissions: permissions ? {
        canViewBatchDetail: permissions.canViewBatchDetail,
        canViewItemCardDetails: permissions.canViewItemCardDetails,
        canEditItems: permissions.canEditItems,
        canDeleteItems: permissions.canDeleteItems,
        canManageCategories: permissions.canManageCategories,
        canUseRemoveDialog: permissions.canUseRemoveDialog,
        canViewTotalValue: permissions.canViewTotalValue,
        canExportExcel: permissions.canExportExcel,
        canBackupJSON: permissions.canBackupJSON,
        canImportBackup: permissions.canImportBackup,
      } : DEFAULT_PERMISSIONS.employee,
    }
  } catch (error) {
    console.error("Failed to load from DB:", error)
    return null
  }
}

export async function saveInventoryData(data: {
  items: Array<{
    id: string
    name: string
    categories: string[]
    buyingDate: string
    expirationDate: string
    amount: number
    metric: string
    pricePerUnit: number
    minAmount: number | null
    note: string
    batchNumber: number
    createdAt: string
    zeroedAt?: string
  }>
  categories: string[]
  nameHistory: string[]
  nextBatchNumber: number
}) {
  try {
    const { items, categories, nameHistory, nextBatchNumber } = data

    await prisma.$transaction([
      prisma.inventoryItem.deleteMany({}),
      prisma.category.deleteMany({}),
      prisma.appState.deleteMany({}),
    ])

    if (items.length > 0) {
      await prisma.inventoryItem.createMany({
        data: items.map(item => ({
          id: item.id,
          name: item.name,
          categories: item.categories,
          buyingDate: item.buyingDate,
          expirationDate: item.expirationDate,
          amount: item.amount,
          metric: item.metric,
          pricePerUnit: item.pricePerUnit,
          minAmount: item.minAmount,
          note: item.note,
          batchNumber: item.batchNumber,
          createdAt: item.createdAt,
          zeroedAt: item.zeroedAt || null,
        })),
      })
    }

    await prisma.category.createMany({
      data: categories.map(name => ({ name })),
      skipDuplicates: true,
    })

    await prisma.appState.upsert({
      where: { id: "app_state" },
      update: { nameHistory, nextBatchNumber },
      create: { id: "app_state", nameHistory, nextBatchNumber },
    })

    return { success: true }
  } catch (error) {
    console.error("Failed to save to DB:", error)
    return { success: false, error: String(error) }
  }
}

export async function savePermissions(perms: AppPermissions) {
  try {
    await prisma.permissions.upsert({
      where: { id: "employee_permissions" },
      update: perms,
      create: {
        id: "employee_permissions",
        ...perms,
      },
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to save permissions:", error)
    return { success: false, error: String(error) }
  }
}
