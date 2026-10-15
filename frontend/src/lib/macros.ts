export const formatMacrosShort = (protein: number, fat: number, carbs: number) =>
  `B ${Math.round(protein)}g · T ${Math.round(fat)}g · W ${Math.round(carbs)}g`;

export const targetRange = (target: number, min?: number | null, max?: number | null) =>
  `${min || Math.round(target * 0.9)}-${max || Math.round(target * 1.1)}`;
