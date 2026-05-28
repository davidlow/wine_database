import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Calendar, Plus, Wine as WineIcon, GlassWater, Grape } from 'lucide-react';
import type { Wine, CellarInventory, WineType } from '@/types';
import { cn, wineTypeLabel, wineTypeColor, formatPrice } from '@/lib/utils';

interface Props {
  wine: Wine;
  inventory?: CellarInventory[];
  href?: string;
  onAdd?: () => void;
}

const WINE_ICON_CFG: Record<string, { bg: string; iconColor: string; icon: 'wine' | 'flute' | 'grape' }> = {
  red:       { bg: 'bg-red-900',    iconColor: 'text-red-200',    icon: 'wine' },
  white:     { bg: 'bg-amber-50 border border-amber-200',  iconColor: 'text-amber-600',   icon: 'wine' },
  'rosé':    { bg: 'bg-pink-100',   iconColor: 'text-pink-600',   icon: 'wine' },
  sparkling: { bg: 'bg-sky-100',    iconColor: 'text-sky-600',    icon: 'flute' },
  dessert:   { bg: 'bg-amber-100',  iconColor: 'text-amber-700',  icon: 'grape' },
  fortified: { bg: 'bg-amber-900',  iconColor: 'text-amber-200',  icon: 'wine' },
  other:     { bg: 'bg-gray-200',   iconColor: 'text-gray-500',   icon: 'wine' },
};

function WineTypeIcon({ type }: { type?: WineType | null }) {
  const cfg = (type && WINE_ICON_CFG[type]) ?? WINE_ICON_CFG.other;
  const Icon = cfg.icon === 'flute' ? GlassWater : cfg.icon === 'grape' ? Grape : WineIcon;
  return (
    <div className={cn('h-16 w-12 shrink-0 rounded flex items-center justify-center', cfg.bg)}>
      <Icon className={cn('h-7 w-7', cfg.iconColor)} />
    </div>
  );
}

export default function WineCard({ wine, inventory, href, onAdd }: Props) {
  const totalBottles = inventory?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const card = (
    <div className="group flex gap-3 rounded-lg border bg-card p-3 hover:shadow-md transition-shadow">
      {wine.image_url ? (
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded">
          <Image src={wine.image_url} alt={wine.name} fill className="object-cover" />
        </div>
      ) : (
        <WineTypeIcon type={wine.wine_type} />
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

  const inner = href ? <Link href={href} className="block">{card}</Link> : card;

  if (!onAdd) return inner;
  return (
    <div className="relative">
      {inner}
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); onAdd(); }}
        title="Quick-add bottle"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-sm transition-colors z-10"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
