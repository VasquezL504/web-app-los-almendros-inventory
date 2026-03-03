"use client"

import { type Alert } from "@/lib/types"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, AlertTriangle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface AlertsPopoverProps {
  alerts: Alert[]
}

export function AlertsPopover({ alerts }: AlertsPopoverProps) {
  const count = alerts.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="relative bg-yellow-300 text-yellow-800 hover:bg-yellow-400 dark:bg-yellow-600 dark:text-yellow-100 dark:hover:bg-yellow-500"
          aria-label="Ver alertas"
        >
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <h4 className="text-sm font-semibold text-foreground">Alertas</h4>
          <p className="text-xs text-muted-foreground">
            {count === 0
              ? "Sin alertas por ahora"
              : `${count} articulo${count !== 1 ? "s" : ""} requiere${count !== 1 ? "n" : ""} atencion`}
          </p>
        </div>
        {count > 0 ? (
          <ScrollArea className="max-h-72">
            <div className="flex flex-col">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-0",
                  )}
                >
                  {alert.type === "expiration" ? (
                    <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">
                      {alert.itemName}
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      {alert.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Bell className="size-8 mb-2 opacity-30" />
            <span className="text-sm">Todo en orden!</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
