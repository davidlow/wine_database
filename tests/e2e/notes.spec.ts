import { test, expect } from '@playwright/test';

test.describe('Tasting Notes', () => {
  let wineId: string;

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/wines', { data: { name: 'Notes Test Wine' } });
    expect(res.ok()).toBe(true);
    wineId = (await res.json()).id;
  });

  test.afterEach(async ({ request }) => {
    if (wineId) await request.delete(`/api/wines/${wineId}`).catch(() => {});
  });

  // ── API tests ────────────────────────────────────────────────────────────

  test('POST /api/wines/:id/notes creates a note', async ({ request }) => {
    const res = await request.post(`/api/wines/${wineId}/notes`, {
      data: { note: 'Excellent nose, dark cherry' },
    });
    expect(res.status()).toBe(201);
    const note = await res.json();
    expect(note.id).toBeDefined();
    expect(note.note).toBe('Excellent nose, dark cherry');
    expect(note.wine_id).toBe(wineId);
    expect(note.created_at).toBeDefined();
  });

  test('POST /api/wines/:id/notes rejects empty note', async ({ request }) => {
    const res = await request.post(`/api/wines/${wineId}/notes`, { data: { note: '' } });
    expect(res.status()).toBe(400);
  });

  test('POST /api/wines/:id/notes rejects whitespace-only note', async ({ request }) => {
    const res = await request.post(`/api/wines/${wineId}/notes`, { data: { note: '   ' } });
    expect(res.status()).toBe(400);
  });

  test('POST /api/wines/:id/notes accepts optional tasted_at date', async ({ request }) => {
    const res = await request.post(`/api/wines/${wineId}/notes`, {
      data: { note: 'Had this with dinner', tasted_at: '2024-12-25' },
    });
    expect(res.status()).toBe(201);
    const note = await res.json();
    expect(note.tasted_at).toBe('2024-12-25');
  });

  test('GET /api/wines/:id/notes returns all notes', async ({ request }) => {
    await request.post(`/api/wines/${wineId}/notes`, { data: { note: 'First note' } });
    await request.post(`/api/wines/${wineId}/notes`, { data: { note: 'Second note' } });

    const res = await request.get(`/api/wines/${wineId}/notes`);
    expect(res.ok()).toBe(true);
    const notes = await res.json();
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBe(2);
  });

  test('GET /api/wines/:id/notes returns empty array for wine with no notes', async ({ request }) => {
    const res = await request.get(`/api/wines/${wineId}/notes`);
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual([]);
  });

  test('DELETE /api/wines/:id/notes/:noteId removes the note', async ({ request }) => {
    const createRes = await request.post(`/api/wines/${wineId}/notes`, {
      data: { note: 'Delete me' },
    });
    const note = await createRes.json();

    const delRes = await request.delete(`/api/wines/${wineId}/notes/${note.id}`);
    expect(delRes.ok()).toBe(true);

    const listRes = await request.get(`/api/wines/${wineId}/notes`);
    const notes = await listRes.json();
    expect(notes.find((n: { id: string }) => n.id === note.id)).toBeUndefined();
  });

  test('deleting one note does not remove others', async ({ request }) => {
    const n1Res = await request.post(`/api/wines/${wineId}/notes`, { data: { note: 'Keep me' } });
    const n2Res = await request.post(`/api/wines/${wineId}/notes`, { data: { note: 'Delete me' } });
    const n1 = await n1Res.json();
    const n2 = await n2Res.json();

    await request.delete(`/api/wines/${wineId}/notes/${n2.id}`);

    const listRes = await request.get(`/api/wines/${wineId}/notes`);
    const notes = await listRes.json();
    expect(notes.some((n: { id: string }) => n.id === n1.id)).toBe(true);
    expect(notes.some((n: { id: string }) => n.id === n2.id)).toBe(false);
  });

  test('notes are scoped to wine (other wine has no notes)', async ({ request }) => {
    const wine2Res = await request.post('/api/wines', { data: { name: 'Other Wine For Notes' } });
    const wine2 = await wine2Res.json();

    await request.post(`/api/wines/${wineId}/notes`, { data: { note: 'Only for wine 1' } });

    const notesRes = await request.get(`/api/wines/${wine2.id}/notes`);
    expect((await notesRes.json())).toHaveLength(0);

    await request.delete(`/api/wines/${wine2.id}`);
  });

  // ── UI tests ─────────────────────────────────────────────────────────────

  test('Notes tab is visible on wine detail page after load', async ({ page }) => {
    await page.goto(`/wines/${wineId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /^Notes/ })).toBeVisible({ timeout: 10000 });
  });

  test('can add a tasting note through the UI', async ({ page }) => {
    await page.goto(`/wines/${wineId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^Notes/ }).click();

    await page.getByPlaceholder(/aromas/i).fill('Rich tannins, elegant finish');
    await page.getByRole('button', { name: /save note/i }).click();

    await expect(page.getByText('Rich tannins, elegant finish')).toBeVisible({ timeout: 5000 });
  });
});
