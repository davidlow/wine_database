export type MeatAnimal = 'beef' | 'pork' | 'chicken' | 'lamb' | 'other';

export interface MeatCut {
  cut: string;
  primal: string;
  animal: MeatAnimal;
}

export const MEAT_CUTS: MeatCut[] = [
  // Beef
  { cut: 'Beef Short Rib',        primal: 'Chuck / Plate',  animal: 'beef' },
  { cut: 'Beef Ribeye Steak',     primal: 'Rib',            animal: 'beef' },
  { cut: 'Beef Ribeye Roast',     primal: 'Rib',            animal: 'beef' },
  { cut: 'Beef NY Strip Steak',   primal: 'Short Loin',     animal: 'beef' },
  { cut: 'Beef NY Strip Roast',   primal: 'Short Loin',     animal: 'beef' },
  { cut: 'Beef Tenderloin',       primal: 'Short Loin',     animal: 'beef' },
  { cut: 'Beef T-Bone Steak',     primal: 'Short Loin',     animal: 'beef' },
  { cut: 'Beef Porterhouse',      primal: 'Short Loin',     animal: 'beef' },
  { cut: 'Beef Top Sirloin',      primal: 'Sirloin',        animal: 'beef' },
  { cut: 'Beef Tri-Tip',          primal: 'Bottom Sirloin', animal: 'beef' },
  { cut: 'Beef Top Round',        primal: 'Round',          animal: 'beef' },
  { cut: 'Beef Bottom Round',     primal: 'Round',          animal: 'beef' },
  { cut: 'Beef Eye of Round',     primal: 'Round',          animal: 'beef' },
  { cut: 'Beef Ground',           primal: 'Various',        animal: 'beef' },
  { cut: 'Beef Chuck Steak',      primal: 'Chuck',          animal: 'beef' },
  { cut: 'Beef Chuck Roast',      primal: 'Chuck',          animal: 'beef' },
  { cut: 'Beef Chuck Stew',       primal: 'Chuck',          animal: 'beef' },
  { cut: 'Beef Brisket',          primal: 'Brisket',        animal: 'beef' },
  { cut: 'Beef Flank Steak',      primal: 'Flank',          animal: 'beef' },
  { cut: 'Beef Skirt Steak',      primal: 'Plate',          animal: 'beef' },
  { cut: 'Beef Hanger Steak',     primal: 'Plate',          animal: 'beef' },
  { cut: 'Beef Osso Buco',        primal: 'Shank',          animal: 'beef' },
  // Pork
  { cut: 'Pork Loin Chop',        primal: 'Loin',           animal: 'pork' },
  { cut: 'Pork Loin Roast',       primal: 'Loin',           animal: 'pork' },
  { cut: 'Pork Tenderloin',       primal: 'Loin',           animal: 'pork' },
  { cut: 'Pork Butt',             primal: 'Shoulder',       animal: 'pork' },
  { cut: 'Pork Shoulder',         primal: 'Shoulder',       animal: 'pork' },
  { cut: 'Pork Belly',            primal: 'Belly',          animal: 'pork' },
  { cut: 'Pork Ribs (Spare)',     primal: 'Belly',          animal: 'pork' },
  { cut: 'Pork Ribs (Baby Back)', primal: 'Loin',           animal: 'pork' },
  { cut: 'Pork Ground',           primal: 'Various',        animal: 'pork' },
  { cut: 'Pork Ham',              primal: 'Leg',            animal: 'pork' },
  // Chicken
  { cut: 'Chicken Breast',        primal: 'Breast',         animal: 'chicken' },
  { cut: 'Chicken Thigh',         primal: 'Thigh',          animal: 'chicken' },
  { cut: 'Chicken Drumstick',     primal: 'Leg',            animal: 'chicken' },
  { cut: 'Chicken Wing',          primal: 'Wing',           animal: 'chicken' },
  { cut: 'Chicken Whole',         primal: 'Whole',          animal: 'chicken' },
  { cut: 'Chicken Ground',        primal: 'Various',        animal: 'chicken' },
  // Lamb
  { cut: 'Lamb Rack',             primal: 'Rack',           animal: 'lamb' },
  { cut: 'Lamb Loin Chop',        primal: 'Loin',           animal: 'lamb' },
  { cut: 'Lamb Leg',              primal: 'Leg',            animal: 'lamb' },
  { cut: 'Lamb Shoulder',         primal: 'Shoulder',       animal: 'lamb' },
  { cut: 'Lamb Ground',           primal: 'Various',        animal: 'lamb' },
  // Other
  { cut: 'Ground Turkey',         primal: 'Various',        animal: 'other' },
  { cut: 'Turkey Breast',         primal: 'Breast',         animal: 'other' },
  { cut: 'Venison Steak',         primal: 'Loin',           animal: 'other' },
  { cut: 'Venison Roast',         primal: 'Round',          animal: 'other' },
  { cut: 'Bison Ground',          primal: 'Various',        animal: 'other' },
  { cut: 'Bison Steak',           primal: 'Loin',           animal: 'other' },
];

export function getPrimalForCut(cut: string): string | undefined {
  return MEAT_CUTS.find(m => m.cut.toLowerCase() === cut.toLowerCase())?.primal;
}

export function getAnimalForCut(cut: string): MeatAnimal {
  const found = MEAT_CUTS.find(m => m.cut.toLowerCase() === cut.toLowerCase());
  if (found) return found.animal;
  const lower = cut.toLowerCase();
  if (lower.startsWith('beef') || lower.includes('bison') || lower.includes('veal')) return 'beef';
  if (lower.startsWith('pork') || lower.includes('ham') || lower.includes('bacon')) return 'pork';
  if (lower.startsWith('chicken') || lower.includes('poultry') || lower.includes('turkey')) return 'chicken';
  if (lower.startsWith('lamb') || lower.includes('mutton')) return 'lamb';
  return 'other';
}

export const ANIMAL_LABELS: Record<MeatAnimal, string> = {
  beef: 'Beef',
  pork: 'Pork',
  chicken: 'Chicken',
  lamb: 'Lamb',
  other: 'Other',
};
