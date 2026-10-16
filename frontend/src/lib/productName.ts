interface NamedProduct {
  name?: string | null;
  brand?: string | null;
}

export function productDisplayName(product: NamedProduct | null | undefined): string {
  const name = product?.name?.trim() ?? '';
  const brand = product?.brand?.trim() ?? '';
  if (!brand || name.toLowerCase().includes(brand.toLowerCase())) return name;
  return name ? `${name} (${brand})` : brand;
}
