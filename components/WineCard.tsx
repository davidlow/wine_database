import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Calendar, Plus, Wine as WineIcon, GlassWater, Grape } from 'lucide-react';
import type { Wine, CellarInventory, WineType } from '@/types';
import { cn, wineTypeLabel, wineTypeColor, wineTypeBorderColor, formatPrice } from '@/lib/utils';

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

function WineTypeIcon({ type, className }: { type?: WineType | null; className?: string }) {
  const cfg = (type && WINE_ICON_CFG[type]) ?? WINE_ICON_CFG.other;
  const Icon = cfg.icon === 'flute' ? GlassWater : cfg.icon === 'grape' ? Grape : WineIcon;
  return (
    <div className={cn('h-16 w-12 shrink-0 rounded flex items-center justify-center', cfg.bg, className)}>
      <Icon className={cn('h-7 w-7', cfg.iconColor)} />
    </div>
  );
}

export default function WineCard({ wine, inventory, href, onAdd }: Props) {
  const totalBottles = inventory?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  // Right column: type badge stacked above the add button.
  // Rendered inside the Link when href is set, so onAdd uses stopPropagation.
  const rightCol = (wine.wine_type || onAdd) ? (
    <div className="flex flex-col items-end gap-2 shrink-0 self-start">
      {wine.wine_type && (
        <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap', wineTypeColor(wine.wine_type))}>
          {wineTypeLabel(wine.wine_type)}
        </span>
      )}
      {onAdd && (
        <button
          onClick={e => { e.stopPropagation(); e.preventDefault(); onAdd(); }}
          title="Quick-add bottle"
          className="h-7 w-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  ) : null;

  const ringCls = cn('ring-2', wineTypeBorderColor(wine.wine_type));

  const card = (
    <div className="group flex gap-3 rounded-lg border bg-card p-3 hover:shadow-md transition-shadow">
      {wine.label_image ? (
        <div className={cn('h-16 w-12 shrink-0 overflow-hidden rounded', ringCls)}>
          <img
            src={`data:image/webp;base64,${wine.label_image}`}
            alt={wine.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : wine.image_url ? (
        <div className={cn('relative h-16 w-12 shrink-0 overflow-hidden rounded', ringCls)}>
          <Image src={wine.image_url} alt={wine.name} fill className="object-cover" />
        </div>
      ) : (
        <WineTypeIcon type={wine.wine_type} className={ringCls} />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors pr-1">
          {wine.name}
        </h3>

        {wine.producer && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{wine.producer}</p>
        )}

        <div className="flex items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground flex-wrap">
          {wine.vintage_year && (
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {wine.vintage_year}
            </span>
          )}
          {(wine.region || wine.country) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{[wine.region, wine.country].filter(Boolean).join(', ')}</span>
            </span>
          )}
          {wine.variety && (
            <span className="flex items-center gap-1">
              <span className="text-sm leading-none">🍇</span>
              <span className="truncate">{wine.variety}</span>
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

      {rightCol}
    </div>
  );

  if (href) return <Link href={href} className="block">{card}</Link>;
  return card;
}
