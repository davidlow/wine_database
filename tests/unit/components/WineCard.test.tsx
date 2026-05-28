import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WineCard from '@/components/WineCard';
import type { Wine, CellarInventory } from '@/types';

// Mock Next.js components that don't work in jsdom
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const baseWine: Wine = {
  id: 'wine-1',
  name: 'Chateau Margaux',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

function makeInventory(items: Array<{ id: string; quantity: number }>): CellarInventory[] {
  return items.map(({ id, quantity }) => ({
    id,
    wine_id: baseWine.id,
    profile_id: 'profile-1',
    location: 'Rack A',
    quantity,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }));
}

describe('WineCard', () => {
  // ─── Core content ─────────────────────────────────────────────────────────

  it('renders wine name', () => {
    render(<WineCard wine={baseWine} />);
    expect(screen.getByText('Chateau Margaux')).toBeInTheDocument();
  });

  it('renders producer when provided', () => {
    render(<WineCard wine={{ ...baseWine, producer: 'Château Margaux Estate' }} />);
    expect(screen.getByText('Château Margaux Estate')).toBeInTheDocument();
  });

  it('does not render producer section when absent', () => {
    render(<WineCard wine={baseWine} />);
    // No producer text in the document (baseWine has no producer)
    expect(screen.queryByText(/estate/i)).not.toBeInTheDocument();
  });

  it('renders vintage year when provided', () => {
    render(<WineCard wine={{ ...baseWine, vintage_year: 2015 }} />);
    expect(screen.getByText('2015')).toBeInTheDocument();
  });

  it('renders region and country when both provided', () => {
    render(<WineCard wine={{ ...baseWine, region: 'Bordeaux', country: 'France' }} />);
    expect(screen.getByText(/Bordeaux.*France/)).toBeInTheDocument();
  });

  it('renders only country when region is absent', () => {
    render(<WineCard wine={{ ...baseWine, country: 'France' }} />);
    expect(screen.getByText('France')).toBeInTheDocument();
  });

  it('renders formatted average price when provided', () => {
    render(<WineCard wine={{ ...baseWine, average_price: 125 }} />);
    expect(screen.getByText('$125.00')).toBeInTheDocument();
  });

  // ─── Wine type badge ──────────────────────────────────────────────────────

  it('renders wine type badge when wine_type is set', () => {
    render(<WineCard wine={{ ...baseWine, wine_type: 'red' }} />);
    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  it('renders white wine type badge', () => {
    render(<WineCard wine={{ ...baseWine, wine_type: 'white' }} />);
    expect(screen.getByText('White')).toBeInTheDocument();
  });

  it('renders sparkling wine type badge', () => {
    render(<WineCard wine={{ ...baseWine, wine_type: 'sparkling' }} />);
    expect(screen.getByText('Sparkling')).toBeInTheDocument();
  });

  it('does not render type badge when wine_type is absent', () => {
    render(<WineCard wine={baseWine} />);
    // No type badge labels
    ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified', 'Other'].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  // ─── Bottle count ─────────────────────────────────────────────────────────

  it('shows total bottle count when inventory is provided', () => {
    const inventory = makeInventory([
      { id: 'i1', quantity: 2 },
      { id: 'i2', quantity: 3 },
    ]);
    render(<WineCard wine={baseWine} inventory={inventory} />);
    expect(screen.getByText('5 bottles')).toBeInTheDocument();
  });

  it('shows singular "bottle" for exactly 1 bottle', () => {
    const inventory = makeInventory([{ id: 'i1', quantity: 1 }]);
    render(<WineCard wine={baseWine} inventory={inventory} />);
    expect(screen.getByText('1 bottle')).toBeInTheDocument();
  });

  it('shows "0 bottles" when inventory is empty array', () => {
    render(<WineCard wine={baseWine} inventory={[]} />);
    expect(screen.getByText('0 bottles')).toBeInTheDocument();
  });

  it('hides bottle count when inventory prop is not provided', () => {
    render(<WineCard wine={baseWine} />);
    expect(screen.queryByText(/bottle/)).not.toBeInTheDocument();
  });

  // ─── Link behaviour ───────────────────────────────────────────────────────

  it('wraps card in a link when href is provided', () => {
    render(<WineCard wine={baseWine} href="/wines/wine-1" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/wines/wine-1');
    expect(link).toContainElement(screen.getByText('Chateau Margaux'));
  });

  it('renders without a link when href is not provided', () => {
    render(<WineCard wine={baseWine} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  // ─── Image ────────────────────────────────────────────────────────────────

  it('renders wine image when image_url is provided', () => {
    render(<WineCard wine={{ ...baseWine, image_url: 'https://example.com/wine.jpg' }} />);
    const img = screen.getByRole('img', { name: 'Chateau Margaux' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/wine.jpg');
  });

  it('renders type icon when no image_url', () => {
    render(<WineCard wine={baseWine} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    // Should render a Lucide SVG icon as the fallback (not an emoji)
    const card = document.querySelector('.bg-gray-200, .bg-red-900, .bg-amber-50, .bg-pink-100, .bg-sky-100, .bg-amber-100, .bg-amber-900');
    expect(card).toBeTruthy();
  });
});
