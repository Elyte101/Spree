// Ghana-first locale constants.
// All currency formatting, phone prefixes, regions, and ID types for the app
// are defined here. Import from this file — never hardcode USD or en-US.

export const DEFAULT_CURRENCY = "GHS";
export const DEFAULT_CURRENCY_SYMBOL = "₵";
export const DEFAULT_COUNTRY = "Ghana";
export const GHANA_PHONE_PREFIX = "+233";

export const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Central",
  "Eastern",
  "Volta",
  "Oti",
  "Bono",
  "Bono East",
  "Ahafo",
  "Northern",
  "Savannah",
  "North East",
  "Upper East",
  "Upper West",
  "Western North",
];

// Ghana first, then ECOWAS neighbours, then global.
export const COUNTRY_LIST = [
  "Ghana",
  "Nigeria",
  "Côte d'Ivoire",
  "Togo",
  "Benin",
  "Burkina Faso",
  "Senegal",
  "Sierra Leone",
  "Liberia",
  "Guinea",
  "Cameroon",
  "Kenya",
  "South Africa",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "China",
  "India",
  "United Arab Emirates",
  "Other",
];

export const GHANA_ID_TYPES: { value: string; label: string }[] = [
  { value: "ghana-card", label: "Ghana Card (NIA)" },
  { value: "voters-id", label: "Voter's ID" },
  { value: "drivers-license", label: "Driver's License (DVLA)" },
  { value: "passport", label: "Passport" },
  { value: "ecowas-card", label: "ECOWAS Identity Card" },
  { value: "ssnit", label: "SSNIT Card" },
];

/**
 * Format a number as GHS currency (or any other ISO currency).
 * Uses en-GH locale so the cedi symbol and separators are correct.
 */
export function formatPrice(
  amount: number,
  currency: string = DEFAULT_CURRENCY
): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
