import { describe, it, expect } from 'vitest';
import { sortProducers } from '@/app/producers/page';
import type { ProducerStats } from '@/types';

const PRODUCERS: ProducerStats[] = [
  { producer: 'Zinfandel House', wine_count: 3, bottle_count: 10, transaction_count: 5 },
  { producer: 'Apex Winery',     wine_count: 8, bottle_count: 2,  transaction_count: 20 },
  { producer: 'Chateau Merlot',  wine_count: 1, bottle_count: 15, transaction_count: 1  },
];

describe('sortProducers', () => {
  it('sorts by transactions descending (default)', () => {
    const sorted = sortProducers(PRODUCERS, 'transactions_desc');
    expect(sorted.map(p => p.producer)).toEqual(['Apex Winery', 'Zinfandel House', 'Chateau Merlot']);
  });

  it('sorts by transactions ascending', () => {
    const sorted = sortProducers(PRODUCERS, 'transactions_asc');
    expect(sorted.map(p => p.producer)).toEqual(['Chateau Merlot', 'Zinfandel House', 'Apex Winery']);
  });

  it('sorts by bottles descending', () => {
    const sorted = sortProducers(PRODUCERS, 'bottles_desc');
    expect(sorted.map(p => p.producer)).toEqual(['Chateau Merlot', 'Zinfandel House', 'Apex Winery']);
  });

  it('sorts by bottles ascending', () => {
    const sorted = sortProducers(PRODUCERS, 'bottles_asc');
    expect(sorted.map(p => p.producer)).toEqual(['Apex Winery', 'Zinfandel House', 'Chateau Merlot']);
  });

  it('sorts by wine count descending', () => {
    const sorted = sortProducers(PRODUCERS, 'wines_desc');
    expect(sorted.map(p => p.producer)).toEqual(['Apex Winery', 'Zinfandel House', 'Chateau Merlot']);
  });

  it('sorts by wine count ascending', () => {
    const sorted = sortProducers(PRODUCERS, 'wines_asc');
    expect(sorted.map(p => p.producer)).toEqual(['Chateau Merlot', 'Zinfandel House', 'Apex Winery']);
  });

  it('sorts alphabetically A→Z', () => {
    const sorted = sortProducers(PRODUCERS, 'name_asc');
    expect(sorted.map(p => p.producer)).toEqual(['Apex Winery', 'Chateau Merlot', 'Zinfandel House']);
  });

  it('sorts alphabetically Z→A', () => {
    const sorted = sortProducers(PRODUCERS, 'name_desc');
    expect(sorted.map(p => p.producer)).toEqual(['Zinfandel House', 'Chateau Merlot', 'Apex Winery']);
  });

  it('does not mutate the input array', () => {
    const original = [...PRODUCERS];
    sortProducers(PRODUCERS, 'name_asc');
    expect(PRODUCERS).toEqual(original);
  });
});
