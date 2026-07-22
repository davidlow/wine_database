'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Home, Wine, ScanLine, Layers, BarChart2, Building2,
  UtensilsCrossed, Snowflake, ShoppingBasket, Moon, Sun, Menu, X,
  Archive, Shuffle, Monitor, ChevronDown, ChevronRight, ScanSearch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSelector from './ProfileSelector';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from 'next-themes';

type NavLink = { href: string; label: string; Icon: React.ComponentType<{ className?: string }>; exact?: boolean; desktopCellar?: boolean };

const STANDARD_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', Icon: Home, exact: true },
  { href: '/wines', label: 'Wines', Icon: Wine },
  { href: '/producers', label: 'Producers', Icon: Building2 },
  { href: '/scanner', label: 'Scanner', Icon: ScanLine },
  { href: '/profiles', label: 'Cellar', Icon: Archive, desktopCellar: true },
  { href: '/defragment', label: 'Defragment', Icon: Shuffle },
  { href: '/discover', label: 'Discover', Icon: ScanSearch },
  { href: '/food-pairings', label: 'Food Pairings', Icon: UtensilsCrossed },
  { href: '/freezer', label: 'Freezer', Icon: Snowflake },
  { href: '/pantry', label: 'Pantry', Icon: ShoppingBasket },
  { href: '/statistics', label: 'Statistics', Icon: BarChart2 },
];

const DESKTOP_LINKS: NavLink[] = [
  { href: '/cellar', label: 'Desktop Cellar', Icon: Layers },
  { href: '/desktop/scanner', label: 'Desktop Scanner', Icon: ScanLine },
  { href: '/desktop/wines', label: 'Desktop Wines', Icon: Wine },
  { href: '/desktop/defragment', label: 'Desktop Defrag', Icon: Shuffle },
  { href: '/desktop/freezer', label: 'Desktop Freezer', Icon: Snowflake },
  { href: '/desktop/pantry', label: 'Desktop Pantry', Icon: ShoppingBasket },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeProfile } = useProfile();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopSectionOpen, setDesktopSectionOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  const cellarsHref = activeProfile ? `/profiles/${activeProfile.id}` : '/profiles';

  const isActive = (link: NavLink) => {
    const { href, exact, desktopCellar } = link;
    if (desktopCellar) return pathname.startsWith('/profiles');
    return exact ? pathname === href : pathname.startsWith(href);
  };

  const navItemCls = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left',
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  );

  const renderLink = (link: NavLink, onNavigate?: () => void) => {
    const resolvedHref = link.desktopCellar ? cellarsHref : link.href;
    const active = isActive(link);
    return (
      <Link
        key={link.href}
        href={resolvedHref}
        className={navItemCls(active)}
        onClick={onNavigate}
      >
        <link.Icon className="h-4 w-4 shrink-0" />
        {link.label}
      </Link>
    );
  };

  const NavLinks = ({ onNavigate, showDesktop }: { onNavigate?: () => void; showDesktop?: boolean }) => (
    <>
      {STANDARD_LINKS.map(link => renderLink(link, onNavigate))}

      {/* Desktop section divider */}
      <div className="pt-2">
        {showDesktop ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Desktop</span>
            </div>
            {DESKTOP_LINKS.map(link => renderLink(link, onNavigate))}
          </>
        ) : (
          <button
            onClick={() => setDesktopSectionOpen(v => !v)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider hover:text-muted-foreground transition-colors"
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
            {desktopSectionOpen
              ? <ChevronDown className="h-3 w-3 ml-auto" />
              : <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>
        )}
        {!showDesktop && desktopSectionOpen && (
          DESKTOP_LINKS.map(link => renderLink(link, onNavigate))
        )}
      </div>
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
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          <NavLinks showDesktop />
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
              <NavLinks onNavigate={() => setDrawerOpen(false)} showDesktop={false} />
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
