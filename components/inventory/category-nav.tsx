"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type SortType = 'added' | 'alpha' | 'lastBatch' | 'firstBatch'

function getSortedCategories(categories: string[], sortType: SortType, items?: any[]) {
  if (sortType === 'alpha') {
    return [...categories].sort((a, b) => a.localeCompare(b))
  }
  if (sortType === 'lastBatch' && items) {
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
  return categories
}

interface FilterState {
  selectedCategory: string | null
  sortType: SortType
}

interface CategoryNavProps {
  categories: string[]
  selected: string | null
  onSelect: (category: string | null) => void
  items?: any[]
  filterState: FilterState
  onFilterChange: (filter: FilterState) => void
}

export function CategoryNav({ categories, selected, onSelect, items, filterState, onFilterChange }: CategoryNavProps) {
  const [sortType] = useState<SortType>(filterState.sortType)
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

  useEffect(() => {
    localStorage.setItem("inventory-filters", JSON.stringify({ selectedCategory: selected, sortType }))
    onFilterChange({ selectedCategory: selected, sortType })
  }, [selected, sortType, onFilterChange])

  function scroll(direction: "left" | "right") {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -200 : 200,
      behavior: "smooth",
    })
  }

  const sortedCategories = getSortedCategories(categories, sortType, items)

  return (
    <div className="relative flex items-center gap-1">
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
        {sortedCategories.map((cat: string) => (
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
