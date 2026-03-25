"use server"

import { prisma } from "@/lib/db"
import { type Metric } from "@/lib/types"
import { type GranularPermissions, type AppPermissions, DEFAULT_GRANULAR_PERMISSIONS, DEFAULT_PERMISSIONS, granularToLegacy } from "./permissions"

export async function loadInventoryData() {
  try {
    const items = await prisma.inventoryItem.findMany()
    const categories = await prisma.category.findMany()
    const appState = await prisma.appState.findUnique({ where: { id: "app_state" } })
    const permissions = await prisma.permissions.findUnique({ where: { id: "employee_permissions" } })
    const businessesFromDB = await prisma.business.findMany()

    let granularPerms: GranularPermissions
    if (permissions) {
      granularPerms = {
        showListCantidad: permissions.showListCantidad as "yes" | "no" | "custom",
        listCantidadDetail: permissions.listCantidadDetail,
        listValorTotalDetail: permissions.listValorTotalDetail,
        listExpiracionDetail: permissions.listExpiracionDetail,
        showCardDetails: permissions.showCardDetails as "yes" | "no" | "custom",
        cardCantidad: permissions.cardCantidad,
        cardPrecioUnidad: permissions.cardPrecioUnidad,
        cardValorLote: permissions.cardValorLote,
        cardFechaCompra: permissions.cardFechaCompra,
        cardFechaExpiracion: permissions.cardFechaExpiracion,
        cardCantidadMinima: permissions.cardCantidadMinima,
        allowEdit: permissions.allowEdit as "yes" | "no",
        canEditItems: permissions.canEditItems ?? true,
        canDeleteItems: permissions.canDeleteItems,
        canManageCategories: permissions.canManageCategories,
        canUseRemoveDialog: permissions.canUseRemoveDialog,
        canViewTotalValue: permissions.canViewTotalValue,
        canExportExcel: permissions.canExportExcel,
        canBackupJSON: permissions.canBackupJSON,
        canImportBackup: permissions.canImportBackup,
      }
    } else {
      granularPerms = DEFAULT_GRANULAR_PERMISSIONS
    }

    return {
      items: items.map(item => ({
        id: item.id,
        businessId: item.businessId ?? "", // Ensure businessId is always present
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
      categories: categories.map(c => ({ businessId: c.businessId ?? "", name: c.name })),
      nameHistory: appState?.nameHistory || [],
      nextBatchNumber: appState?.nextBatchNumber || 1,
      permissions: granularToLegacy(granularPerms),
      granularPermissions: granularPerms,
      businesses: businessesFromDB.map(b => ({ id: b.id, name: b.name })),
    }
  } catch (error) {
    console.error("Failed to load from DB:", error)
    return null
  }
}

export async function saveInventoryData(data: {
  items: Array<{
    id: string
    businessId: string
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
  categories: Array<{ businessId: string; name: string }>
  nameHistory: string[]
  nextBatchNumber: number
}) {
  try {
    const { items, categories, nameHistory, nextBatchNumber } = data

    await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.deleteMany({})
      await tx.category.deleteMany({})
      await tx.appState.deleteMany({})

      if (items.length > 0) {
        await tx.inventoryItem.createMany({
          data: items.map(item => ({
            id: item.id,
            businessId: item.businessId || "",
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

      if (categories.length > 0) {
        await tx.category.createMany({
          data: categories.map(c => ({ businessId: c.businessId, name: c.name })),
          skipDuplicates: true,
        })
      }

      await tx.appState.upsert({
        where: { id: "app_state" },
        update: { nameHistory, nextBatchNumber },
        create: { id: "app_state", nameHistory, nextBatchNumber },
      })
    })

    return { success: true }
  } catch (error) {
    console.error("Failed to save to DB:", error)
    return { success: false, error: String(error) }
  }
}

export async function savePermissions(perms: GranularPermissions) {
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

export async function loadPermissions(): Promise<GranularPermissions | null> {
  try {
    const permissions = await prisma.permissions.findUnique({ where: { id: "employee_permissions" } })
    if (permissions) {
      return {
        showListCantidad: permissions.showListCantidad as "yes" | "no" | "custom",
        listCantidadDetail: permissions.listCantidadDetail,
        listValorTotalDetail: permissions.listValorTotalDetail,
        listExpiracionDetail: permissions.listExpiracionDetail,
        showCardDetails: permissions.showCardDetails as "yes" | "no" | "custom",
        cardCantidad: permissions.cardCantidad,
        cardPrecioUnidad: permissions.cardPrecioUnidad,
        cardValorLote: permissions.cardValorLote,
        cardFechaCompra: permissions.cardFechaCompra,
        cardFechaExpiracion: permissions.cardFechaExpiracion,
        cardCantidadMinima: permissions.cardCantidadMinima,
        allowEdit: permissions.allowEdit as "yes" | "no",
        canEditItems: permissions.canEditItems ?? true,
        canDeleteItems: permissions.canDeleteItems,
        canManageCategories: permissions.canManageCategories,
        canUseRemoveDialog: permissions.canUseRemoveDialog,
        canViewTotalValue: permissions.canViewTotalValue,
        canExportExcel: permissions.canExportExcel,
        canBackupJSON: permissions.canBackupJSON,
        canImportBackup: permissions.canImportBackup,
      }
    }
    return null
  } catch (error) {
    console.error("Failed to load permissions:", error)
    return null
  }
}

export async function loadEmployees() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
    })
    return employees
  } catch (error) {
    console.error("Failed to load employees:", error)
    return []
  }
}

export async function addEmployee(code: string, name: string, businessIds: string[] = []) {
  try {
    const existing = await prisma.employee.findUnique({ where: { code } })
    if (existing) {
      return { success: false, error: "Ya existe un empleado con este código" }
    }
    await prisma.employee.create({
      data: { code, name, role: "employee", businessIds },
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to add employee:", error)
    return { success: false, error: String(error) }
  }
}

export async function updateEmployee(id: string, name: string, isActive: boolean, businessIds: string[] = []) {
  try {
    await prisma.employee.update({
      where: { id },
      data: { name, isActive, businessIds },
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to update employee:", error)
    return { success: false, error: String(error) }
  }
}

export async function deleteEmployee(id: string) {
  try {
    await prisma.employee.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    console.error("Failed to delete employee:", error)
    return { success: false, error: String(error) }
  }
}

export async function loadAdministrators() {
  try {
    const admins = await prisma.employee.findMany({
      where: { role: "admin" },
      orderBy: { createdAt: "desc" },
    })
    return admins
  } catch (error) {
    console.error("Failed to load administrators:", error)
    return []
  }
}

export async function addAdministrator(code: string, name: string) {
  try {
    const existing = await prisma.employee.findUnique({ where: { code } })
    if (existing) {
      return { success: false, error: "Ya existe un usuario con este código" }
    }
    await prisma.employee.create({
      data: { code, name, role: "admin", businessIds: [] },
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to add administrator:", error)
    return { success: false, error: String(error) }
  }
}

export async function updateAdministrator(id: string, name: string, isActive: boolean, code: string) {
  try {
    const existingByCode = await prisma.employee.findUnique({ where: { code } })
    if (existingByCode && existingByCode.id !== id) {
      return { success: false, error: "Ya existe un usuario con este código" }
    }

    await prisma.employee.update({
      where: { id },
      data: { name, isActive, code },
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to update administrator:", error)
    return { success: false, error: String(error) }
  }
}

export async function deleteAdministrator(id: string) {
  try {
    await prisma.employee.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    console.error("Failed to delete administrator:", error)
    return { success: false, error: String(error) }
  }
}

export async function saveBusinessesToDB(businesses: Array<{ id: string; name: string }>) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.business.deleteMany({})
      if (businesses.length > 0) {
        await tx.business.createMany({
          data: businesses.map(b => ({ id: b.id, name: b.name })),
        })
      }
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to save businesses:", error)
    return { success: false, error: String(error) }
  }
}

// ── Inventory Events ──────────────────────────────────────────────────────────

export async function loadInventoryEventsFromDB() {
  try {
    const events = await prisma.inventoryEvent.findMany({ orderBy: { occurredAt: "asc" } })
    return events.map(e => ({
      id: e.id,
      businessId: e.businessId,
      itemName: e.itemName,
      actorName: e.actorName ?? undefined,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      totalValue: e.totalValue,
      type: e.type as import("@/lib/inventory-events").InventoryEventType,
      adjustmentKind: (e.adjustmentKind ?? undefined) as import("@/lib/inventory-events").InventoryAdjustmentKind | undefined,
      note: e.note ?? undefined,
      occurredAt: e.occurredAt,
    }))
  } catch (error) {
    console.error("Failed to load inventory events:", error)
    return []
  }
}

export async function appendInventoryEventToDB(event: {
  id: string
  businessId: string
  itemName: string
  actorName?: string
  quantity: number
  unitPrice: number
  totalValue: number
  type: string
  adjustmentKind?: string
  note?: string
  occurredAt: string
}) {
  try {
    await prisma.inventoryEvent.create({ data: event })
    return { success: true }
  } catch (error) {
    console.error("Failed to append inventory event:", error)
    return { success: false, error: String(error) }
  }
}

export async function replaceInventoryEventsToDB(events: Array<{
  id: string
  businessId: string
  itemName: string
  actorName?: string
  quantity: number
  unitPrice: number
  totalValue: number
  type: string
  adjustmentKind?: string
  note?: string
  occurredAt: string
}>) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.inventoryEvent.deleteMany({})
      if (events.length > 0) {
        await tx.inventoryEvent.createMany({
          data: events.map(e => ({
            ...e,
            actorName: e.actorName ?? null,
            adjustmentKind: e.adjustmentKind ?? null,
            note: e.note ?? null,
          })),
        })
      }
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to replace inventory events:", error)
    return { success: false, error: String(error) }
  }
}
