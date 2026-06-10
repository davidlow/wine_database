import { describe, it, expect } from 'vitest';
import { MEAT_CUTS, getPrimalForCut } from '@/lib/meat-cuts';

describe('MEAT_CUTS', () => {
  it('contains 14 predefined cuts', () => {
    expect(MEAT_CUTS).toHaveLength(14);
  });

  it('every entry has a non-empty cut name and primal', () => {
    for (const m of MEAT_CUTS) {
      expect(m.cut.trim()).toBeTruthy();
      expect(m.primal.trim()).toBeTruthy();
    }
  });

  it('all cut names are unique', () => {
    const names = MEAT_CUTS.map(m => m.cut);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes expected beef cuts', () => {
    const cuts = MEAT_CUTS.map(m => m.cut);
    expect(cuts).toContain('Beef Ribeye Steak');
    expect(cuts).toContain('Beef NY Strip Steak');
    expect(cuts).toContain('Beef Chuck Roast');
    expect(cuts).toContain('Beef Tri-Tip');
  });

  it('includes expected pork cuts', () => {
    const cuts = MEAT_CUTS.map(m => m.cut);
    expect(cuts).toContain('Pork Loin Chop');
    expect(cuts).toContain('Pork Butt');
  });
});

describe('getPrimalForCut', () => {
  it('returns correct primal for a known cut', () => {
    expect(getPrimalForCut('Beef Ribeye Steak')).toBe('Rib');
    expect(getPrimalForCut('Beef Ribeye Roast')).toBe('Rib');
    expect(getPrimalForCut('Beef NY Strip Steak')).toBe('Short Loin');
    expect(getPrimalForCut('Beef Chuck Steak')).toBe('Chuck');
    expect(getPrimalForCut('Beef Chuck Roast')).toBe('Chuck');
    expect(getPrimalForCut('Beef Tri-Tip')).toBe('Bottom Sirloin');
    expect(getPrimalForCut('Pork Butt')).toBe('Shoulder');
  });

  it('is case-insensitive', () => {
    expect(getPrimalForCut('beef ribeye steak')).toBe('Rib');
    expect(getPrimalForCut('BEEF CHUCK ROAST')).toBe('Chuck');
    expect(getPrimalForCut('Pork Loin Chop')).toBe('Loin');
  });

  it('returns undefined for an unknown cut', () => {
    expect(getPrimalForCut('Lamb Shank')).toBeUndefined();
    expect(getPrimalForCut('')).toBeUndefined();
    expect(getPrimalForCut('random text')).toBeUndefined();
  });

  it('chuck cuts all map to Chuck primal', () => {
    expect(getPrimalForCut('Beef Chuck Steak')).toBe('Chuck');
    expect(getPrimalForCut('Beef Chuck Roast')).toBe('Chuck');
    expect(getPrimalForCut('Beef Chuck Stew')).toBe('Chuck');
  });

  it('rib cuts map to Rib primal', () => {
    expect(getPrimalForCut('Beef Ribeye Steak')).toBe('Rib');
    expect(getPrimalForCut('Beef Ribeye Roast')).toBe('Rib');
  });

  it('loin cuts map to correct primals', () => {
    expect(getPrimalForCut('Beef NY Strip Steak')).toBe('Short Loin');
    expect(getPrimalForCut('Beef NY Strip Roast')).toBe('Short Loin');
    expect(getPrimalForCut('Pork Loin Chop')).toBe('Loin');
    expect(getPrimalForCut('Pork Loin Roast')).toBe('Loin');
  });
});
