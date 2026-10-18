export const MAX_PACKAGE_WEIGHT = 50_000;

export function isValidPackageWeight(weight: number | null): boolean {
  return weight === null || (weight > 0 && weight <= MAX_PACKAGE_WEIGHT);
}
