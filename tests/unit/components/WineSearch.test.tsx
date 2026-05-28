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

async function openAdvanced() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /advanced filters/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WineSearch', () => {
  // ─── Rendering ──────────────────────────────────────────────────────────────

  it('renders the search input', () => {
    renderSearch();
    expect(screen.getByPlaceholderText(/search name, producer/i)).toBeInTheDocument();
  });

  it('renders all seven wine type chips', () => {
    renderSearch();
    const labels = ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified', 'Other'];
    labels.forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('renders drink status filter chips', () => {
    renderSearch();
    expect(screen.getByRole('button', { name: 'Past Peak' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Too Young' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In Window' })).toBeInTheDocument();
  });

  it('renders Advanced Filters toggle button', () => {
    renderSearch();
    expect(screen.getByRole('button', { name: /advanced filters/i })).toBeInTheDocument();
  });

  it('reflects query param value in search input', () => {
    renderSearch({ query: 'Bordeaux' });
    expect(screen.getByDisplayValue('Bordeaux')).toBeInTheDocument();
  });

  it('reflects vintage_year param in year input after opening advanced panel', async () => {
    renderSearch({ vintage_year: 2019 });
    await openAdvanced();
    expect(screen.getByDisplayValue('2019')).toBeInTheDocument();
  });

  it('reflects country param in country input after opening advanced panel', async () => {
    renderSearch({ country: 'France' });
    await openAdvanced();
    // SearchSuggest renders an input; find it by its displayed value
    expect(screen.getByDisplayValue('France')).toBeInTheDocument();
  });

  // ─── Search input interaction ─────────────────────────────────────────────

  it('typing in search calls onChange with "query" key', () => {
    renderSearch();
    fireEvent.change(screen.getByPlaceholderText(/search name, producer/i), {
      target: { value: 'Chardonnay' },
    });
    expect(mockOnChange).toHaveBeenCalledWith('query', 'Chardonnay');
  });

  it('clearing the search input calls onChange with undefined', () => {
    renderSearch({ query: 'Test' });
    fireEvent.change(screen.getByPlaceholderText(/search name, producer/i), {
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

  // ─── Drink status chip interaction ────────────────────────────────────────

  it('clicking Past Peak chip calls onChange with drink_status', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.click(screen.getByRole('button', { name: 'Past Peak' }));
    expect(mockOnChange).toHaveBeenCalledWith('drink_status', 'past_peak');
  });

  it('clicking active drink_status chip toggles it off', async () => {
    const user = userEvent.setup();
    renderSearch({ drink_status: 'past_peak' });
    await user.click(screen.getByRole('button', { name: 'Past Peak' }));
    expect(mockOnChange).toHaveBeenCalledWith('drink_status', undefined);
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

  // ─── Advanced filter inputs (panel must be opened first) ─────────────────

  it('advanced panel is hidden by default', () => {
    renderSearch();
    expect(screen.queryByPlaceholderText('Country')).not.toBeInTheDocument();
  });

  it('advanced panel opens on toggle click', async () => {
    renderSearch();
    await openAdvanced();
    expect(screen.getByPlaceholderText('Country')).toBeInTheDocument();
  });

  it('typing in country input calls onChange with "country"', async () => {
    renderSearch();
    await openAdvanced();
    fireEvent.change(screen.getByPlaceholderText('Country'), { target: { value: 'Italy' } });
    expect(mockOnChange).toHaveBeenCalledWith('country', 'Italy');
  });

  it('typing in region input calls onChange with "region"', async () => {
    renderSearch();
    await openAdvanced();
    fireEvent.change(screen.getByPlaceholderText(/or type exact region/i), { target: { value: 'Tuscany' } });
    expect(mockOnChange).toHaveBeenCalledWith('region', 'Tuscany');
  });

  it('typing in vintage year input calls onChange with numeric value', async () => {
    renderSearch();
    await openAdvanced();
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 2019/), { target: { value: '2020' } });
    expect(mockOnChange).toHaveBeenCalledWith('vintage_year', 2020);
  });

  it('price_min input calls onChange with price_min', async () => {
    renderSearch();
    await openAdvanced();
    fireEvent.change(screen.getByPlaceholderText('Min'), { target: { value: '20' } });
    expect(mockOnChange).toHaveBeenCalledWith('price_min', 20);
  });

  it('price_max input calls onChange with price_max', async () => {
    renderSearch();
    await openAdvanced();
    fireEvent.change(screen.getByPlaceholderText('Max'), { target: { value: '100' } });
    expect(mockOnChange).toHaveBeenCalledWith('price_max', 100);
  });

  it('variety input calls onChange with variety', async () => {
    renderSearch();
    await openAdvanced();
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. cab/i), { target: { value: 'Cab' } });
    expect(mockOnChange).toHaveBeenCalledWith('variety', 'Cab');
  });

  it('shows "active" badge on Advanced Filters toggle when advanced params are set', () => {
    renderSearch({ price_min: 10 });
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
