import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WineForm from '@/components/WineForm';

import type { Wine } from '@/types';
type WineFormData = Omit<Wine, 'id' | 'created_at' | 'updated_at'>;
const mockSubmit = vi.fn((_data: WineFormData): Promise<void> => Promise.resolve());

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WineForm', () => {
  // ─── Rendering ──────────────────────────────────────────────────────────────

  it('renders required fields', () => {
    render(<WineForm onSubmit={mockSubmit} />);
    expect(screen.getByPlaceholderText('e.g. Opus One')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save wine/i })).toBeInTheDocument();
  });

  it('renders all optional input fields', () => {
    render(<WineForm onSubmit={mockSubmit} />);
    expect(screen.getByPlaceholderText(/e\.g\. Opus One Winery/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/cabernet sauvignon/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. 2019/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. USA/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/napa valley/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/tasting notes/i)).toBeInTheDocument();
  });

  it('shows custom submit label', () => {
    render(<WineForm onSubmit={mockSubmit} submitLabel="Update Wine" />);
    expect(screen.getByRole('button', { name: /update wine/i })).toBeInTheDocument();
  });

  it('renders cancel button only when onCancel is provided', () => {
    const { unmount } = render(<WineForm onSubmit={mockSubmit} />);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    unmount();

    render(<WineForm onSubmit={mockSubmit} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  // ─── Pre-filling ─────────────────────────────────────────────────────────────

  it('pre-fills fields from lookupResult', () => {
    render(
      <WineForm
        onSubmit={mockSubmit}
        lookupResult={{
          found: true,
          name: 'Pre-filled Wine',
          producer: 'Pre-filled Winery',
          wine_type: 'white',
          source: 'openfoodfacts',
        }}
      />
    );
    expect(screen.getByDisplayValue('Pre-filled Wine')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pre-filled Winery')).toBeInTheDocument();
    expect(screen.getByText(/auto-filled from Open Food Facts/i)).toBeInTheDocument();
  });

  it('pre-fills fields from initialData', () => {
    render(
      <WineForm
        onSubmit={mockSubmit}
        initialData={{ name: 'Init Wine', producer: 'Init Winery', vintage_year: 2018 }}
      />
    );
    expect(screen.getByDisplayValue('Init Wine')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Init Winery')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2018')).toBeInTheDocument();
  });

  it('initialData overrides lookupResult for the same field', () => {
    render(
      <WineForm
        onSubmit={mockSubmit}
        lookupResult={{ found: true, name: 'Lookup Name', source: 'openfoodfacts' }}
        initialData={{ name: 'Override Name' }}
      />
    );
    expect(screen.getByDisplayValue('Override Name')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Lookup Name')).not.toBeInTheDocument();
  });

  it('shows "your database" source banner', () => {
    render(
      <WineForm
        onSubmit={mockSubmit}
        lookupResult={{ found: true, name: 'DB Wine', source: 'database' }}
      />
    );
    expect(screen.getByText(/auto-filled from your database/i)).toBeInTheDocument();
  });

  it('shows "manual entry" source banner for manual source', () => {
    render(
      <WineForm
        onSubmit={mockSubmit}
        lookupResult={{ found: true, name: 'Manual Wine', source: 'manual' }}
      />
    );
    expect(screen.getByText(/auto-filled from manual entry/i)).toBeInTheDocument();
  });

  it('does not show source banner when lookupResult has no source', () => {
    render(
      <WineForm
        onSubmit={mockSubmit}
        lookupResult={{ found: true, name: 'No Source Wine' }}
      />
    );
    expect(screen.queryByText(/auto-filled from/i)).not.toBeInTheDocument();
  });

  // ─── Validation ──────────────────────────────────────────────────────────────

  it('shows error when name is empty on submit', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} />);
    await user.click(screen.getByRole('button', { name: /save wine/i }));
    expect(await screen.findByText(/wine name is required/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('shows error when name is only whitespace', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} />);
    await user.type(screen.getByPlaceholderText('e.g. Opus One'), '   ');
    await user.click(screen.getByRole('button', { name: /save wine/i }));
    expect(await screen.findByText(/wine name is required/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('clears validation error once name is filled', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} />);
    await user.click(screen.getByRole('button', { name: /save wine/i }));
    expect(await screen.findByText(/wine name is required/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Opus One'), 'Filled Wine');
    await user.click(screen.getByRole('button', { name: /save wine/i }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(screen.queryByText(/wine name is required/i)).not.toBeInTheDocument();
  });

  // ─── Submission ──────────────────────────────────────────────────────────────

  it('calls onSubmit with form data when valid', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} />);

    await user.type(screen.getByPlaceholderText('e.g. Opus One'), 'Test Wine');
    await user.type(screen.getByPlaceholderText(/e\.g\. Opus One Winery/i), 'Test Winery');
    await user.click(screen.getByRole('button', { name: /save wine/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Wine', producer: 'Test Winery' })
      );
    });
  });

  it('trims whitespace from name before submitting', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} />);
    await user.type(screen.getByPlaceholderText('e.g. Opus One'), '  Padded Name  ');
    await user.click(screen.getByRole('button', { name: /save wine/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Padded Name' })
      );
    });
  });

  it('submits empty optional text fields as undefined', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} />);
    await user.type(screen.getByPlaceholderText('e.g. Opus One'), 'Sparse Wine');
    await user.click(screen.getByRole('button', { name: /save wine/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sparse Wine',
          producer: undefined,
          variety: undefined,
          region: undefined,
          country: undefined,
          description: undefined,
        })
      );
    });
  });

  it('shows error message when onSubmit throws', async () => {
    const failingSubmit = vi.fn((): Promise<void> => Promise.reject(new Error('Server error')));
    const user = userEvent.setup();
    render(<WineForm onSubmit={failingSubmit} />);
    await user.type(screen.getByPlaceholderText('e.g. Opus One'), 'Test Wine');
    await user.click(screen.getByRole('button', { name: /save wine/i }));
    expect(await screen.findByText(/server error/i)).toBeInTheDocument();
  });

  it('re-enables submit button after failed submission', async () => {
    const failingSubmit = vi.fn((): Promise<void> => Promise.reject(new Error('Fail')));
    const user = userEvent.setup();
    render(<WineForm onSubmit={failingSubmit} />);
    await user.type(screen.getByPlaceholderText('e.g. Opus One'), 'Test Wine');
    await user.click(screen.getByRole('button', { name: /save wine/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save wine/i })).not.toBeDisabled();
    });
  });

  it('disables submit button while submitting', async () => {
    const slowSubmit = vi.fn((_data: WineFormData): Promise<void> => new Promise((r) => setTimeout(r, 500)));
    const user = userEvent.setup();
    render(<WineForm onSubmit={slowSubmit} />);

    await user.type(screen.getByPlaceholderText('e.g. Opus One'), 'Test Wine');
    await user.click(screen.getByRole('button', { name: /save wine/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save wine/i })).toBeDisabled();
    });
  });

  // ─── Interaction ─────────────────────────────────────────────────────────────

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    const mockCancel = vi.fn();
    render(<WineForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockCancel).toHaveBeenCalled();
  });

  it('cancel does not trigger submit', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} onCancel={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('e.g. Opus One'), 'Some Wine');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
