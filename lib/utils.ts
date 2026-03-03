import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number with thousands separators and fixed decimals.
 *
 * Defaults to 2 decimal places and respects the user's locale.
 */
export function formatNumber(
  value: number,
  decimals: number = 2,
  locale: string = undefined // `undefined` uses the runtime locale (typically en-US)
): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
