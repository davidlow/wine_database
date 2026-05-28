'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Wine, ScanLine, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSelector from './ProfileSelector';
import ProfilePickerModal from './ProfilePickerModal';
import { useProfile } from '@/hooks/useProfile';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profiles } = useProfile();
  const [picker, setPicker] = useState<'wines' | 'cellars' | null>(null);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  // If only one profile, skip the picker and navigate directly
  const handleWinesClick = () => {
    if (profiles.length === 0) { router.push('/wines'); return; }
    setPicker('wines');
  };

  const handleCellarsClick = () => {
    if (profiles.length === 0) { router.push('/profiles'); return; }
    if (profiles.length === 1) { router.push(`/profiles/${profiles[0].id}`); return; }
    setPicker('cellars');
  };

  const navItemCls = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer w-full text-left',
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
          <button onClick={handleWinesClick} className={navItemCls(isActive('/wines'))}>
            <Wine className="h-4 w-4 shrink-0" />
            Wines
          </button>
          <Link href="/scanner" className={navItemCls(isActive('/scanner'))}>
            <ScanLine className="h-4 w-4 shrink-0" />
            Scanner
          </Link>
          <button onClick={handleCellarsClick} className={navItemCls(isActive('/profiles'))}>
            <Layers className="h-4 w-4 shrink-0" />
            Cellars
          </button>
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
          <button onClick={handleWinesClick} className={mobileNavItemCls(isActive('/wines'))}>
            <Wine className="h-5 w-5" />
            Wines
          </button>
          <Link href="/scanner" className={mobileNavItemCls(isActive('/scanner'))}>
            <ScanLine className="h-5 w-5" />
            Scanner
          </Link>
          <button onClick={handleCellarsClick} className={mobileNavItemCls(isActive('/profiles'))}>
            <Layers className="h-5 w-5" />
            Cellars
          </button>
        </nav>
      </div>

      {/* Profile picker modal */}
      {picker && (
        <ProfilePickerModal mode={picker} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
