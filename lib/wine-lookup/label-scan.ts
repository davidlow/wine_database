import type { WineLookupResult } from './types';

// TODO: Implement vision LLM label scanning.
// Suggested implementation:
//   1. Send imageBase64 to Claude claude-opus-4-7 (or similar) with a prompt asking it to extract
//      wine name, producer, vintage, variety, region, etc. from the label image.
//   2. Optionally perform a web search to fill in additional details (price, appellation).
//   3. Return a WineLookupResult with source='label-scan'.
//
// Example (using Anthropic SDK):
//   const { Anthropic } = await import('@anthropic-ai/sdk');
//   const client = new Anthropic();
//   const message = await client.messages.create({
//     model: 'claude-opus-4-7',
//     max_tokens: 1024,
//     messages: [{ role: 'user', content: [
//       { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
//       { type: 'text', text: 'Extract wine information from this label as JSON...' }
//     ]}]
//   });

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export async function scanLabel(_imageBase64: string): Promise<WineLookupResult> {
  throw new NotImplementedError(
    'Label scanning via vision LLM is not yet implemented. See lib/wine-lookup/label-scan.ts for implementation guide.'
  );
}
