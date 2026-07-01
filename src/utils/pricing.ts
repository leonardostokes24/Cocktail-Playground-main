export const UNIT_CONVERSIONS = {
  'oz': 1,
  'ml': 0.033814,
  'l': 33.814,
  'liter': 33.814,
  'dash': 0.01, // Approximate: 1 dash ~ 0.3ml
};

export const parseAmount = (label: string): number => {
  if (!label) return 0;
  
  const match = label.match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  
  const value = parseFloat(match[0]);
  const lowerLabel = label.toLowerCase();
  
  if (lowerLabel.includes('ml')) return value * UNIT_CONVERSIONS.ml;
  if (lowerLabel.includes('l') && !lowerLabel.includes('ml')) return value * UNIT_CONVERSIONS.l;
  if (lowerLabel.includes('dash')) return value * UNIT_CONVERSIONS.dash;
  
  // Default to oz
  return value;
};

export const calculateCostPerOz = (totalPrice: number, volumeStr: string): number => {
  const volume = parseAmount(volumeStr);
  if (volume === 0) return 0;
  return totalPrice / volume;
};

export const calculateGP = (salePrice: number, cost: number): number => {
  if (salePrice <= 0) return 0;
  return ((salePrice - cost) / salePrice) * 100;
};
