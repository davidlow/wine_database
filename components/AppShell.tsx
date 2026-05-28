'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wine, ScanLine, Layers, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSelector from './ProfileSelector';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
          <Link href="/scanner" className={navItemCls(isActive('/scanner'))}>
            <ScanLine className="h-4 w-4 shrink-0" />
            Scanner
          </Link>
          <Link href="/profiles" className={navItemCls(isActive('/profiles'))}>
            <Layers className="h-4 w-4 shrink-0" />
            Cellars
          </Link>
          <Link href="/statistics" className={navItemCls(isActive('/statistics'))}>
            <BarChart2 className="h-4 w-4 shrink-0" />
            Statistics
          </Link>
        </nav>
        <div className="px-3 py-3 border-t">
          <ProfileSelector />
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
          <ProfileSelector compact />
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
          <Link href="/scanner" className={mobileNavItemCls(isActive('/scanner'))}>
            <ScanLine className="h-5 w-5" />
            Scanner
          </Link>
          <Link href="/profiles" className={mobileNavItemCls(isActive('/profiles'))}>
            <Layers className="h-5 w-5" />
            Cellars
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
