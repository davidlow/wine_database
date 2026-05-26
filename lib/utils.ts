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
