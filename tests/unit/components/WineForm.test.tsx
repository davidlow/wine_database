import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WineForm from '@/components/WineForm';

const mockSubmit = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WineForm', () => {
  it('renders required fields', () => {
    render(<WineForm onSubmit={mockSubmit} />);
    expect(screen.getByPlaceholderText(/e\.g\. Opus One/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save wine/i })).toBeInTheDocument();
  });

  it('shows error when name is empty on submit', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} />);
    await user.click(screen.getByRole('button', { name: /save wine/i }));
    expect(await screen.findByText(/wine name is required/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with form data when valid', async () => {
    const user = userEvent.setup();
    render(<WineForm onSubmit={mockSubmit} />);

    await user.type(screen.getByPlaceholderText(/e\.g\. Opus One/i), 'Test Wine');
    await user.type(screen.getByPlaceholderText(/e\.g\. Opus One Winery/i), 'Test Winery');
    await user.click(screen.getByRole('button', { name: /save wine/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Wine', producer: 'Test Winery' })
      );
    });
  });

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

  it('shows custom submit label', () => {
    render(<WineForm onSubmit={mockSubmit} submitLabel="Update Wine" />);
    expect(screen.getByRole('button', { name: /update wine/i })).toBeInTheDocument();
  });

  it('calls onCancel when cancel is clicked', async () => {
    const user = userEvent.setup();
    const mockCancel = vi.fn();
    render(<WineForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockCancel).toHaveBeenCalled();
  });

  it('disables submit button while submitting', async () => {
    const slowSubmit = vi.fn(() => new Promise((r) => setTimeout(r, 500)));
    const user = userEvent.setup();
    render(<WineForm onSubmit={slowSubmit} />);

    await user.type(screen.getByPlaceholderText(/e\.g\. Opus One/i), 'Test Wine');
    await user.click(screen.getByRole('button', { name: /save wine/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save wine/i })).toBeDisabled();
    });
  });
});
