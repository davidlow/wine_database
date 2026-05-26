'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wine, ScanLine, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSelector from './ProfileSelector';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/wines', label: 'Wines', icon: Wine },
  { href: '/scanner', label: 'Scanner', icon: ScanLine },
  { href: '/profiles', label: 'Profiles', icon: Layers },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

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
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive(href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
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
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors',
                isActive(href)
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
