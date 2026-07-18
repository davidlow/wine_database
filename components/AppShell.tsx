'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Home, Wine, ScanLine, Layers, BarChart2, Building2,
  UtensilsCrossed, Snowflake, ShoppingBasket, Moon, Sun, Menu, X,
  Archive, Shuffle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSelector from './ProfileSelector';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from 'next-themes';

type NavLink = { href: string; label: string; Icon: React.ComponentType<{ className?: string }>; exact?: boolean };

const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', Icon: Home, exact: true },
  { href: '/wines', label: 'Wines', Icon: Wine },
  { href: '/producers', label: 'Producers', Icon: Building2 },
  { href: '/profiles', label: 'Cellars', Icon: Layers },
  { href: '/scanner', label: 'Scanner', Icon: ScanLine },
  { href: '/cellar', label: 'Cellar', Icon: Archive },
  { href: '/defragment', label: 'Defragment', Icon: Shuffle },
  { href: '/food-pairings', label: 'Food Pairings', Icon: UtensilsCrossed },
  { href: '/freezer', label: 'Freezer', Icon: Snowflake },
  { href: '/pantry', label: 'Pantry', Icon: ShoppingBasket },
  { href: '/statistics', label: 'Statistics', Icon: BarChart2 },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeProfile } = useProfile();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const cellarsHref = activeProfile ? `/profiles/${activeProfile.id}` : '/profiles';

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const navItemCls = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left',
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  );

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {NAV_LINKS.map(({ href, label, Icon, exact }) => {
        const resolvedHref = href === '/profiles' ? cellarsHref : href;
        const active = isActive(href === '/profiles' ? '/profiles' : href, exact);
        return (
          <Link
            key={href}
            href={resolvedHref}
            className={navItemCls(active)}
            onClick={onNavigate}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </>
  );

  const ThemeToggle = ({ compact }: { compact?: boolean }) => (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={cn(
        'flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
        compact ? 'p-1.5' : 'w-full px-3 py-1.5'
      )}
      aria-label="Toggle theme"
    >
      {mounted && (resolvedTheme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />)}
      {!compact && mounted && (resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode')}
      {!compact && !mounted && 'Toggle theme'}
    </button>
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
          <NavLinks />
        </nav>
        <div className="px-3 py-3 border-t space-y-2">
          <ProfileSelector />
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Wine className="h-4 w-4 text-primary" />
              Wine Cellar
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <ProfileSelector compact />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-64 bg-card border-r flex flex-col h-full shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b">
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Wine className="h-4 w-4 text-primary" />
                Wine Cellar
              </h1>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
              <NavLinks onNavigate={() => setDrawerOpen(false)} />
            </nav>
            <div className="px-3 py-3 border-t space-y-2">
              <ProfileSelector />
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
