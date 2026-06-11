import { rmSync } from 'fs';

export default function globalSetup() {
  try { rmSync('./wine-test.db'); } catch {}
}
