"use client"
// Función utilitaria para ordenar categorías
function getSortedCategories(categories: string[], sortType: 'added' | 'alpha' | 'lastBatch' | 'firstBatch', items?: any[]) {
  if (sortType === 'alpha') {
    return [...categories].sort((a, b) => a.localeCompare(b))
  }
  if (sortType === 'lastBatch' && items) {
    // Ordenar por el batchNumber global más alto por categoría (descendente)
    const catBatch: Record<string, number> = {}
    items.forEach(item => {
      item.categories.forEach((cat: string) => {
        if (!catBatch[cat] || item.batchNumber > catBatch[cat]) {
          catBatch[cat] = item.batchNumber
        }
      })
    })
    return [...categories].sort((a, b) => {
      const ba = catBatch[a] || 0
      const bb = catBatch[b] || 0
      return bb - ba
    })
  }
    if (sortType === 'firstBatch' && items) {
      // Ordenar por el batchNumber global más bajo por categoría (ascendente)
      const catBatch: Record<string, number> = {}
      items.forEach(item => {
        item.categories.forEach((cat: string) => {
          if (!catBatch[cat] || item.batchNumber < catBatch[cat]) {
            catBatch[cat] = item.batchNumber
          }
        })
      })
      return [...categories].sort((a, b) => {
        const ba = catBatch[a]
        const bb = catBatch[b]
        if (ba === undefined && bb === undefined) return 0
        if (ba === undefined) return 1
        if (bb === undefined) return -1
        return ba - bb
      })
    }
  // Por defecto, orden de agregada (original)
  return categories
}

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface CategoryNavProps {
  categories: string[]
  selected: string | null
  onSelect: (category: string | null) => void
  items?: any[] // Para obtener batchNumber global
}

// Update sortType union in CategoryNavProps
interface CategoryNavProps {
  categories: string[]
  selected: string | null
  onSelect: (category: string | null) => void
  items?: any[]
}

export function CategoryNav({ categories, selected, onSelect, items }: CategoryNavProps) {
  const [sortType, setSortType] = useState<'added' | 'alpha' | 'lastBatch' | 'firstBatch'>('added')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", checkScroll)
      ro.disconnect()
    }
  }, [categories])

  function scroll(direction: "left" | "right") {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -200 : 200,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative flex items-center gap-1">
      {/* Menú de filtro de orden */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="shrink-0 z-10 mr-1"
            aria-label="Filtrar categorías"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <label>Ordenar por:</label>
          <DropdownMenuItem onClick={() => setSortType('added')}>
            Primer categoría agregada
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortType('alpha')}>
            Alfabético
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortType('lastBatch')}>
            Último lote agregado
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSortType('firstBatch')}>
            Primer lote agregado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canScrollLeft && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 z-10"
          onClick={() => scroll("left")}
          aria-label="Desplazar categorias a la izquierda"
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide py-1 px-0.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            selected === null
              ? "bg-foreground text-background border-foreground"
              : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
          )}
        >
          Todos
        </button>
        {/* Ordenar categorías según sortType */}
        {getSortedCategories(categories, sortType, items).map((cat: string) => (
          <button
            key={cat}
            type="button"
            onClick={() => onSelect(cat === selected ? null : cat)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              cat === selected
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {canScrollRight && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 z-10"
          onClick={() => scroll("right")}
          aria-label="Desplazar categorias a la derecha"
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  )
}
