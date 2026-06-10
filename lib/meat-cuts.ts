export interface MeatCut {
  cut: string;
  primal: string;
}

export const MEAT_CUTS: MeatCut[] = [
  { cut: 'Beef Short Rib',      primal: 'Chuck / Plate' },
  { cut: 'Beef Ribeye Steak',   primal: 'Rib' },
  { cut: 'Beef Ribeye Roast',   primal: 'Rib' },
  { cut: 'Beef NY Strip Steak', primal: 'Short Loin' },
  { cut: 'Beef NY Strip Roast', primal: 'Short Loin' },
  { cut: 'Beef Top Sirloin',    primal: 'Sirloin' },
  { cut: 'Beef Top Round',      primal: 'Round' },
  { cut: 'Beef Chuck Steak',    primal: 'Chuck' },
  { cut: 'Beef Chuck Roast',    primal: 'Chuck' },
  { cut: 'Beef Chuck Stew',     primal: 'Chuck' },
  { cut: 'Beef Tri-Tip',        primal: 'Bottom Sirloin' },
  { cut: 'Pork Loin Chop',      primal: 'Loin' },
  { cut: 'Pork Loin Roast',     primal: 'Loin' },
  { cut: 'Pork Butt',           primal: 'Shoulder' },
];

export function getPrimalForCut(cut: string): string | undefined {
  return MEAT_CUTS.find(m => m.cut.toLowerCase() === cut.toLowerCase())?.primal;
}
