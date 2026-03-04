import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDynamicOverlayNameClass(name: string) {
  const len = name.length;
  if (len > 40) return "text-xs sm:text-sm md:text-base";
  if (len > 30) return "text-sm sm:text-base md:text-lg";
  if (len > 20) return "text-sm sm:text-lg md:text-xl";
  return "text-base sm:text-xl md:text-2xl";
}

export function getDynamicInlineNameClass(name: string) {
  const len = name.length;
  if (len > 40) return "text-xs";
  if (len > 30) return "text-xs sm:text-sm";
  if (len > 20) return "text-sm sm:text-base";
  return "text-base sm:text-lg";
}
