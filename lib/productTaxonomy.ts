/**
 * Shared color/size option sets for the seller create/edit product forms
 * (components/admin/productCreateForm.tsx, ProductsTable.tsx's edit dialog).
 * Sellers always SELECT from these — never type a size/color free-form — so
 * listings stay consistent and filterable instead of accumulating one-off
 * spellings ("Navy" vs "navy blue", "20cm" vs "20 cm" vs "8 inches").
 *
 * Sizes are additionally mirrored in Python for server-side validation — see
 * backend/app/core/size_taxonomy.py. Keep both in sync manually; there's no
 * single shared source across the TypeScript/Python split.
 */

export const COLOR_OPTIONS = [
  "Black", "White", "Gray", "Silver", "Gold",
  "Red", "Maroon", "Pink", "Orange", "Yellow",
  "Green", "Olive", "Teal", "Turquoise", "Blue", "Navy",
  "Purple", "Lavender", "Brown", "Beige", "Cream", "Sand",
  "Multicolor", "Ankara Print", "Kente Print",
];

export interface SizePreset {
  value: string;
  /** UI grouping label (MUI Autocomplete groupBy) — e.g. "Clothing", "Yards". */
  group: string;
}

const preset = (values: string[], group: string): SizePreset[] =>
  values.map((value) => ({ value, group }));

const CLOTHING_SIZES = preset(["XS", "S", "M", "L", "XL", "XXL", "XXXL"], "Clothing");

const KIDS_AGE_SIZES = preset(
  ["0-3m", "3-6m", "6-12m", "1-2y", "2-4y", "4-6y", "6-8y", "8-12y"],
  "Age"
);

// EU/UK/US conversion is the standard commercial (men's-numbering) table —
// each label shows all three so a buyer never has to guess which scale a
// bare number means.
const SHOE_SIZE_TABLE: [eu: string, uk: string, us: string][] = [
  ["36", "3.5", "4.5"], ["37", "4", "5"], ["38", "5", "6"], ["39", "5.5", "6.5"],
  ["40", "6.5", "7.5"], ["41", "7", "8"], ["42", "8", "9"], ["43", "9", "10"],
  ["44", "9.5", "10.5"], ["45", "10.5", "11.5"], ["46", "11", "12"], ["47", "12", "13"],
];
const SHOE_SIZES = preset(
  SHOE_SIZE_TABLE.map(([eu, uk, us]) => `EU ${eu} / UK ${uk} / US ${us}`),
  "Shoe size"
);

const FABRIC_YARDS = preset(["1 yard", "2 yards", "4 yards", "6 yards", "12 yards"], "Yards");
const FABRIC_METERS = preset(["1 m", "2 m", "5 m", "10 m"], "Meters");

const SCREEN_SIZES = preset(['5.5"', '6.1"', '6.7"', '13"', '14"', '16"'], "Screen size");
const STORAGE_SIZES = preset(["64GB", "128GB", "256GB", "512GB", "1TB", "2TB"], "Storage");

const VOLUME_SIZES = preset(["30 ml", "50 ml", "100 ml", "250 ml", "500 ml", "1 L"], "Volume");
const WEIGHT_SIZES = preset(["100 g", "250 g", "500 g", "1 kg"], "Weight");

const DIMENSION_SIZES = preset(
  ["30 cm", "50 cm", "1 m", "2 m", "6 in", "12 in", "18 in", "1 ft", "3 ft", "6 ft"],
  "Dimensions"
);

export const GENERIC_SIZE_PRESETS = preset(["One size", "Small", "Medium", "Large"], "General");

// Keyed by main-category slug (see backend/app/db/init_db.py's
// _CATEGORY_TAXONOMY). A category with no entry here falls back to
// GENERIC_SIZE_PRESETS — every category shows a Sizes field.
export const SIZE_PRESETS_BY_MAIN_CATEGORY_SLUG: Record<string, SizePreset[]> = {
  "fashion-apparel": CLOTHING_SIZES,
  "baby-kids": [...CLOTHING_SIZES, ...KIDS_AGE_SIZES],
  "shoes-footwear": SHOE_SIZES,
  "fabrics-textiles": [...FABRIC_YARDS, ...FABRIC_METERS],
  "phones-accessories": [...SCREEN_SIZES, ...STORAGE_SIZES],
  "electronics-gadgets": [...SCREEN_SIZES, ...STORAGE_SIZES],
  "tech": [...SCREEN_SIZES, ...STORAGE_SIZES],
  "beauty-personal-care": [...VOLUME_SIZES, ...WEIGHT_SIZES],
  "food-groceries": [...VOLUME_SIZES, ...WEIGHT_SIZES],
  "home-living": DIMENSION_SIZES,
  "kitchen-dining": DIMENSION_SIZES,
  "tools-hardware": DIMENSION_SIZES,
};

export function sizePresetsForSlug(slug: string | undefined | null): SizePreset[] {
  if (slug && SIZE_PRESETS_BY_MAIN_CATEGORY_SLUG[slug]) {
    return SIZE_PRESETS_BY_MAIN_CATEGORY_SLUG[slug];
  }
  return GENERIC_SIZE_PRESETS;
}

export function sizeValuesForSlug(slug: string | undefined | null): string[] {
  return sizePresetsForSlug(slug).map((p) => p.value);
}

export function sizeGroupLookup(slug: string | undefined | null): Map<string, string> {
  return new Map(sizePresetsForSlug(slug).map((p) => [p.value, p.group]));
}
