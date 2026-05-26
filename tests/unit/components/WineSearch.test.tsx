import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WineSearch from '@/components/WineSearch';
import type { WineSearchParams } from '@/types';

const mockOnChange = vi.fn();
const mockOnClear = vi.fn();

function renderSearch(params: WineSearchParams = {}) {
  return render(
    <WineSearch params={params} onChange={mockOnChange} onClear={mockOnClear} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WineSearch', () => {
  // ─── Rendering ──────────────────────────────────────────────────────────────

  it('renders the search input', () => {
    renderSearch();
    expect(screen.getByPlaceholderText(/search wines/i)).toBeInTheDocument();
  });

  it('renders all seven wine type chips', () => {
    renderSearch();
    const labels = ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified', 'Other'];
    labels.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('reflects query param value in search input', () => {
    renderSearch({ query: 'Bordeaux' });
    expect(screen.getByDisplayValue('Bordeaux')).toBeInTheDocument();
  });

  it('reflects vintage_year param in year input', () => {
    renderSearch({ vintage_year: 2019 });
    expect(screen.getByDisplayValue('2019')).toBeInTheDocument();
  });

  it('reflects country param in country input', () => {
    renderSearch({ country: 'France' });
    expect(screen.getByDisplayValue('France')).toBeInTheDocument();
  });

  // ─── Search input interaction ─────────────────────────────────────────────

  it('typing in search calls onChange with "query" key', () => {
    renderSearch();
    // WineSearch is fully controlled (value=params.query), so use fireEvent to
    // simulate a single change event with the complete input value.
    fireEvent.change(screen.getByPlaceholderText(/search wines/i), {
      target: { value: 'Chardonnay' },
    });
    expect(mockOnChange).toHaveBeenCalledWith('query', 'Chardonnay');
  });

  it('clearing the search input calls onChange with undefined', () => {
    renderSearch({ query: 'Test' });
    fireEvent.change(screen.getByPlaceholderText(/search wines/i), {
      target: { value: '' },
    });
    expect(mockOnChange).toHaveBeenCalledWith('query', undefined);
  });

  // ─── Type chip interaction ────────────────────────────────────────────────

  it('clicking a type chip calls onChange with wine_type', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.click(screen.getByRole('button', { name: 'Red' }));
    expect(mockOnChange).toHaveBeenCalledWith('wine_type', 'red');
  });

  it('clicking "Sparkling" calls onChange with "sparkling"', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.click(screen.getByRole('button', { name: 'Sparkling' }));
    expect(mockOnChange).toHaveBeenCalledWith('wine_type', 'sparkling');
  });

  it('clicking the currently active type chip toggles it off (calls with undefined)', async () => {
    const user = userEvent.setup();
    renderSearch({ wine_type: 'red' });
    await user.click(screen.getByRole('button', { name: 'Red' }));
    expect(mockOnChange).toHaveBeenCalledWith('wine_type', undefined);
  });

  it('clicking a different type chip does not toggle off (calls with new type)', async () => {
    const user = userEvent.setup();
    renderSearch({ wine_type: 'red' });
    await user.click(screen.getByRole('button', { name: 'White' }));
    expect(mockOnChange).toHaveBeenCalledWith('wine_type', 'white');
  });

  // ─── Clear button ─────────────────────────────────────────────────────────

  it('clear button is not shown when no filters are active', () => {
    renderSearch();
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('clear button appears when query filter is active', () => {
    renderSearch({ query: 'Burgundy' });
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('clear button appears when wine_type filter is active', () => {
    renderSearch({ wine_type: 'white' });
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('clicking clear button calls onClear', async () => {
    const user = userEvent.setup();
    renderSearch({ query: 'Test' });
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(mockOnClear).toHaveBeenCalled();
  });

  it('clicking clear button does not call onChange', async () => {
    const user = userEvent.setup();
    renderSearch({ query: 'Test' });
    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  // ─── Additional filter inputs ─────────────────────────────────────────────

  it('typing in country input calls onChange with "country"', () => {
    renderSearch();
    fireEvent.change(screen.getByPlaceholderText('Country'), { target: { value: 'Italy' } });
    expect(mockOnChange).toHaveBeenCalledWith('country', 'Italy');
  });

  it('typing in region input calls onChange with "region"', () => {
    renderSearch();
    fireEvent.change(screen.getByPlaceholderText('Region'), { target: { value: 'Tuscany' } });
    expect(mockOnChange).toHaveBeenCalledWith('region', 'Tuscany');
  });

  it('typing in vintage year input calls onChange with numeric value', () => {
    renderSearch();
    fireEvent.change(screen.getByPlaceholderText('Vintage year'), { target: { value: '2020' } });
    expect(mockOnChange).toHaveBeenCalledWith('vintage_year', 2020);
  });
});
