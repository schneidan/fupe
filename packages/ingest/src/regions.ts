/** Region → ISO 3166-1 alpha-2 filters for SPARQL / OFF. */

const EU_CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE',
];

export function countryCodesForRegion(region?: string): string[] | null {
  if (!region) return null;
  const r = region.toUpperCase();
  if (r === 'EU' || r === 'EEA') return [...EU_CODES];
  if (/^[A-Z]{2}$/.test(r)) return [r];
  return null;
}

/** OFF `countries_tags_en` value, e.g. united-states */
export function offCountryTag(region?: string): string | undefined {
  const map: Record<string, string> = {
    US: 'united-states',
    GB: 'united-kingdom',
    UK: 'united-kingdom',
    CA: 'canada',
    DE: 'germany',
    FR: 'france',
  };
  if (!region) return undefined;
  const r = region.toUpperCase();
  if (r === 'EU') return undefined; // no single OFF country; category-only
  return map[r];
}
