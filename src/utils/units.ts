const ML_PER_UNIT: Record<string, number> = {
  ml: 1,
  cl: 10,
  oz: 29.5735,
  tsp: 5,
  tbsp: 15,
  dash: 0.6,
  barspoon: 5,
  drop: 0.05,
  part: 30,
};

export const UNITS = Object.keys(ML_PER_UNIT) as string[];

export function toMl(amount: number, unit: string): number {
  return amount * (ML_PER_UNIT[unit.toLowerCase()] ?? 1);
}

export function fromMl(ml: number, unit: string): number {
  const factor = ML_PER_UNIT[unit.toLowerCase()] ?? 1;
  return ml / factor;
}
