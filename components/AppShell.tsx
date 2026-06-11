'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wine, ScanLine, Layers, BarChart2, Building2, UtensilsCrossed, Snowflake, ShoppingBasket, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSelector from './ProfileSelector';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from 'next-themes';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeProfile } = useProfile();
  const { resolvedTheme, setTheme } = useTheme();
  // Go directly to the active cellar when one is saved; fall back to the list
  const cellarsHref = activeProfile ? `/profiles/${activeProfile.id}` : '/profiles';

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const navItemCls = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left',
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  );

  const mobileNavItemCls = (active: boolean) => cn(
    'flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors',
    active ? 'text-primary font-medium' : 'text-muted-foreground'
  );

  return (
    <div className="flex h-full">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex flex-col w-56 border-r bg-card shrink-0">
        <div className="px-4 py-5 border-b">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wine className="h-5 w-5 text-primary" />
            Wine Cellar
          </h1>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          <Link href="/" className={navItemCls(isActive('/') && pathname === '/')}>
            <Home className="h-4 w-4 shrink-0" />
            Dashboard
          </Link>
          <Link href="/wines" className={navItemCls(isActive('/wines'))}>
            <Wine className="h-4 w-4 shrink-0" />
            Wines
          </Link>
          <Link href="/producers" className={navItemCls(isActive('/producers'))}>
            <Building2 className="h-4 w-4 shrink-0" />
            Producers
          </Link>
          <Link href={cellarsHref} className={navItemCls(isActive('/profiles'))}>
            <Layers className="h-4 w-4 shrink-0" />
            Cellars
          </Link>
          <Link href="/scanner" className={navItemCls(isActive('/scanner'))}>
            <ScanLine className="h-4 w-4 shrink-0" />
            Scanner
          </Link>
          <Link href="/food-pairings" className={navItemCls(isActive('/food-pairings'))}>
            <UtensilsCrossed className="h-4 w-4 shrink-0" />
            Food Pairings
          </Link>
          <Link href="/freezer" className={navItemCls(isActive('/freezer'))}>
            <Snowflake className="h-4 w-4 shrink-0" />
            Freezer
          </Link>
          <Link href="/pantry" className={navItemCls(isActive('/pantry'))}>
            <ShoppingBasket className="h-4 w-4 shrink-0" />
            Pantry
          </Link>
          <Link href="/statistics" className={navItemCls(isActive('/statistics'))}>
            <BarChart2 className="h-4 w-4 shrink-0" />
            Statistics
          </Link>
        </nav>
        <div className="px-3 py-3 border-t space-y-2">
          <ProfileSelector />
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Wine className="h-4 w-4 text-primary" />
            Wine Cellar
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <ProfileSelector compact />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* Bottom nav — mobile only */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 flex border-t bg-card z-50">
          <Link href="/" className={mobileNavItemCls(isActive('/') && pathname === '/')}>
            <Home className="h-5 w-5" />
            Dashboard
          </Link>
          <Link href="/wines" className={mobileNavItemCls(isActive('/wines'))}>
            <Wine className="h-5 w-5" />
            Wines
          </Link>
          <Link href="/producers" className={mobileNavItemCls(isActive('/producers'))}>
            <Building2 className="h-5 w-5" />
            Producers
          </Link>
          <Link href={cellarsHref} className={mobileNavItemCls(isActive('/profiles'))}>
            <Layers className="h-5 w-5" />
            Cellars
          </Link>
          <Link href="/scanner" className={mobileNavItemCls(isActive('/scanner'))}>
            <ScanLine className="h-5 w-5" />
            Scanner
          </Link>
          <Link href="/food-pairings" className={mobileNavItemCls(isActive('/food-pairings'))}>
            <UtensilsCrossed className="h-5 w-5" />
            Pairings
          </Link>
          <Link href="/freezer" className={mobileNavItemCls(isActive('/freezer'))}>
            <Snowflake className="h-5 w-5" />
            Freezer
          </Link>
          <Link href="/pantry" className={mobileNavItemCls(isActive('/pantry'))}>
            <ShoppingBasket className="h-5 w-5" />
            Pantry
          </Link>
          <Link href="/statistics" className={mobileNavItemCls(isActive('/statistics'))}>
            <BarChart2 className="h-5 w-5" />
            Stats
          </Link>
        </nav>
      </div>
    </div>
  );
}
