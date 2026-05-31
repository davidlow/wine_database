import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatPrice(price: number | undefined | null): string {
  if (price == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

export function formatDate(date: string | undefined | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function wineTypeLabel(type: string | undefined): string {
  const labels: Record<string, string> = {
    red: 'Red',
    white: 'White',
    'rosé': 'Rosé',
    sparkling: 'Sparkling',
    dessert: 'Dessert',
    fortified: 'Fortified',
    other: 'Other',
  };
  return type ? (labels[type] ?? type) : 'Unknown';
}

export type DrinkStatus = 'past_peak' | 'too_young' | 'in_window' | null;

export function drinkWindowStatus(
  drinkFromYear: number | undefined | null,
  drinkByYear: number | undefined | null,
  currentYear = new Date().getFullYear(),
): DrinkStatus {
  if (!drinkFromYear && !drinkByYear) return null;
  if (drinkByYear && currentYear > drinkByYear) return 'past_peak';
  if (drinkFromYear && currentYear < drinkFromYear) return 'too_young';
  if (drinkFromYear || drinkByYear) return 'in_window';
  return null;
}

export function drinkWindowBadge(status: DrinkStatus): { label: string; cls: string } | null {
  if (!status) return null;
  if (status === 'past_peak') return { label: 'Past Peak', cls: 'bg-red-100 text-red-700' };
  if (status === 'too_young') return { label: 'Too Young', cls: 'bg-blue-100 text-blue-700' };
  if (status === 'in_window') return { label: 'In Window', cls: 'bg-green-100 text-green-700' };
  return null;
}

// Border ring color for label images — separate from the image itself so it can be
// updated independently without reprocessing photos.
export function wineTypeBorderColor(type: string | undefined): string {
  const colors: Record<string, string> = {
    red:       'ring-red-700',
    white:     'ring-amber-400',
    'rosé':    'ring-pink-400',
    sparkling: 'ring-sky-400',
    dessert:   'ring-amber-500',
    fortified: 'ring-purple-700',
    other:     'ring-gray-400',
  };
  return type ? (colors[type] ?? 'ring-gray-400') : 'ring-gray-300';
}

export function wineTypeColor(type: string | undefined): string {
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-red-800',
    white: 'bg-yellow-100 text-yellow-800',
    'rosé': 'bg-pink-100 text-pink-800',
    sparkling: 'bg-blue-100 text-blue-800',
    dessert: 'bg-amber-100 text-amber-800',
    fortified: 'bg-orange-100 text-orange-800',
    other: 'bg-gray-100 text-gray-800',
  };
  return type ? (colors[type] ?? 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800';
}
