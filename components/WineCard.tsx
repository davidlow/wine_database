import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Calendar } from 'lucide-react';
import type { Wine, CellarInventory } from '@/types';
import { cn, wineTypeLabel, wineTypeColor, formatPrice } from '@/lib/utils';

interface Props {
  wine: Wine;
  inventory?: CellarInventory[];
  href?: string;
}

export default function WineCard({ wine, inventory, href }: Props) {
  const totalBottles = inventory?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const card = (
    <div className="group flex gap-3 rounded-lg border bg-card p-3 hover:shadow-md transition-shadow">
      {wine.image_url ? (
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
          <Image src={wine.image_url} alt={wine.name} fill className="object-cover" />
        </div>
      ) : (
        <div className="h-16 w-12 shrink-0 rounded bg-muted flex items-center justify-center text-2xl select-none">
          🍷
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {wine.name}
          </h3>
          {wine.wine_type && (
            <span className={cn('shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium', wineTypeColor(wine.wine_type))}>
              {wineTypeLabel(wine.wine_type)}
            </span>
          )}
        </div>

        {wine.producer && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{wine.producer}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          {wine.vintage_year && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {wine.vintage_year}
            </span>
          )}
          {(wine.region || wine.country) && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{[wine.region, wine.country].filter(Boolean).join(', ')}</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-1.5">
          {wine.average_price != null && (
            <span className="text-xs text-muted-foreground">{formatPrice(wine.average_price)}</span>
          )}
          {inventory !== undefined && (
            <span className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded',
              totalBottles > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            )}>
              {totalBottles} {totalBottles === 1 ? 'bottle' : 'bottles'}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}
