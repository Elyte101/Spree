// Ghana-first locale constants.
// All currency formatting, phone prefixes, regions, and ID types for the app
// are defined here. Import from this file — never hardcode USD or en-US.

export const DEFAULT_CURRENCY = "GH₵";
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

/** Region/state/province lists keyed by country name. */
export const COUNTRY_REGIONS: Record<string, string[]> = {
  Ghana: GHANA_REGIONS,
  Nigeria: [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe",
    "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
    "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
    "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
  ],
  "Côte d'Ivoire": [
    "Abidjan", "Bas-Sassandra", "Comoé", "Denguélé", "Gôh-Djiboua", "Lacs", "Lagunes",
    "Montagnes", "Sassandra-Marahoué", "Savanes", "Vallée du Bandama", "Woroba",
    "Yamoussoukro", "Zanzan",
  ],
  Togo: ["Centrale", "Kara", "Maritime", "Plateaux", "Savanes"],
  Benin: [
    "Alibori", "Atacora", "Atlantique", "Borgou", "Collines", "Donga",
    "Kouffo", "Littoral", "Mono", "Ouémé", "Plateau", "Zou",
  ],
  "Burkina Faso": [
    "Boucle du Mouhoun", "Cascades", "Centre", "Centre-Est", "Centre-Nord",
    "Centre-Ouest", "Centre-Sud", "Est", "Hauts-Bassins", "Nord",
    "Plateau-Central", "Sahel", "Sud-Ouest",
  ],
  Senegal: [
    "Dakar", "Diourbel", "Fatick", "Kaffrine", "Kaolack", "Kédougou",
    "Kolda", "Louga", "Matam", "Saint-Louis", "Sédhiou", "Tambacounda",
    "Thiès", "Ziguinchor",
  ],
  "Sierra Leone": ["Eastern", "Northern", "North West", "Southern", "Western Area"],
  Liberia: [
    "Bomi", "Bong", "Gbarpolu", "Grand Bassa", "Grand Cape Mount", "Grand Gedeh",
    "Grand Kru", "Lofa", "Margibi", "Maryland", "Montserrado", "Nimba",
    "River Cess", "River Gee", "Sinoe",
  ],
  Guinea: ["Boké", "Conakry", "Faranah", "Kankan", "Kindia", "Labé", "Mamou", "Nzérékoré"],
  Cameroon: [
    "Adamaoua", "Centre", "East", "Far North", "Littoral",
    "North", "North West", "South", "South West", "West",
  ],
  Kenya: [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
    "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
    "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
    "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a",
    "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
    "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia",
    "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
  ],
  "South Africa": [
    "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
    "Mpumalanga", "North West", "Northern Cape", "Western Cape",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  "United States": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
    "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
    "Washington", "West Virginia", "Wisconsin", "Wyoming", "Washington D.C.",
  ],
  Canada: [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick",
    "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia",
    "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon",
  ],
  Germany: [
    "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg",
    "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia",
    "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt",
    "Schleswig-Holstein", "Thuringia",
  ],
  France: [
    "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne",
    "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France",
    "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
    "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
  ],
  Netherlands: [
    "Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg",
    "North Brabant", "North Holland", "Overijssel", "South Holland", "Utrecht", "Zeeland",
  ],
  "United Arab Emirates": [
    "Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain",
  ],
  China: [
    "Anhui", "Beijing", "Chongqing", "Fujian", "Gansu", "Guangdong", "Guangxi",
    "Guizhou", "Hainan", "Hebei", "Heilongjiang", "Henan", "Hubei", "Hunan",
    "Inner Mongolia", "Jiangsu", "Jiangxi", "Jilin", "Liaoning", "Ningxia",
    "Qinghai", "Shaanxi", "Shandong", "Shanghai", "Shanxi", "Sichuan",
    "Tianjin", "Tibet", "Xinjiang", "Yunnan", "Zhejiang",
  ],
  India: [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry",
  ],
};

/** Returns the list of regions/states for a country, or null if unknown. */
export function getRegionsForCountry(country: string): string[] | null {
  return COUNTRY_REGIONS[country] ?? null;
}

/**
 * Returns the appropriate label for the region/state field for a given country.
 * E.g. Ghana → "Region", Nigeria → "State", Kenya → "County", etc.
 */
export function getRegionLabel(country: string): string {
  const labels: Record<string, string> = {
    Ghana: "Region",
    Nigeria: "State",
    Kenya: "County",
    "South Africa": "Province",
    Canada: "Province / Territory",
    "United Kingdom": "Country",
    "United Arab Emirates": "Emirate",
  };
  return labels[country] ?? "State / Region";
}

/** Dialling codes, Ghana first, then ECOWAS, then global. Used by PhoneInput. */
export const COUNTRY_PHONE_CODES: { code: string; label: string }[] = [
  { code: "+233", label: "+233 Ghana" },
  { code: "+234", label: "+234 Nigeria" },
  { code: "+225", label: "+225 Côte d'Ivoire" },
  { code: "+228", label: "+228 Togo" },
  { code: "+229", label: "+229 Benin" },
  { code: "+226", label: "+226 Burkina Faso" },
  { code: "+221", label: "+221 Senegal" },
  { code: "+232", label: "+232 Sierra Leone" },
  { code: "+231", label: "+231 Liberia" },
  { code: "+224", label: "+224 Guinea" },
  { code: "+237", label: "+237 Cameroon" },
  { code: "+254", label: "+254 Kenya" },
  { code: "+27",  label: "+27 South Africa" },
  { code: "+44",  label: "+44 United Kingdom" },
  { code: "+1",   label: "+1 US / Canada" },
  { code: "+49",  label: "+49 Germany" },
  { code: "+33",  label: "+33 France" },
  { code: "+31",  label: "+31 Netherlands" },
  { code: "+86",  label: "+86 China" },
  { code: "+91",  label: "+91 India" },
  { code: "+971", label: "+971 UAE" },
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
 * Per-ID-type format specifications for seller identity verification.
 * Each entry carries a placeholder, a human-readable format hint shown
 * below the input, and a validate() function that returns null on success
 * or an actionable error string on failure.
 */
export const GHANA_ID_SPECS: Record<
  string,
  { placeholder: string; formatHint: string; validate: (v: string) => string | null }
> = {
  "ghana-card": {
    placeholder: "GHA-000000000-0",
    formatHint: "Format: GHA-XXXXXXXXX-X  (GHA‑ prefix, 9 digits, dash, 1 check digit)",
    validate: (v) =>
      /^GHA-\d{9}-\d$/.test(v.trim())
        ? null
        : "Enter the Ghana Card number exactly as printed — e.g. GHA-123456789-0",
  },
  "voters-id": {
    placeholder: "e.g. B0123456789",
    formatHint: "7–14 alphanumeric characters as printed on your Voter's ID card",
    validate: (v) => {
      const s = v.trim();
      if (s.length < 7) return "Voter's ID must be at least 7 characters";
      if (s.length > 14) return "Voter's ID must be at most 14 characters";
      if (!/^[A-Z0-9]+$/.test(s)) return "Only letters (A-Z) and digits are allowed";
      return null;
    },
  },
  "drivers-license": {
    placeholder: "e.g. DVL-000000",
    formatHint: "As printed on your DVLA license — letters, digits, and hyphens",
    validate: (v) => {
      const s = v.trim();
      if (s.length < 5) return "Driver's license number must be at least 5 characters";
      if (s.length > 20) return "Driver's license number must be at most 20 characters";
      if (!/^[A-Z0-9/ -]+$/.test(s)) return "Only letters, digits, spaces, and hyphens are allowed";
      return null;
    },
  },
  passport: {
    placeholder: "e.g. G1234567",
    formatHint: "Format: one letter followed by 7–8 digits  (e.g. G1234567)",
    validate: (v) =>
      /^[A-Z]\d{7,8}$/.test(v.trim())
        ? null
        : "Passport number: one letter then 7–8 digits (e.g. G1234567)",
  },
  "ecowas-card": {
    placeholder: "e.g. GH-000000000",
    formatHint: "As printed on your ECOWAS card — letters, digits, and hyphens",
    validate: (v) => {
      const s = v.trim();
      if (s.length < 6) return "ECOWAS card number must be at least 6 characters";
      if (s.length > 20) return "ECOWAS card number must be at most 20 characters";
      if (!/^[A-Z0-9-]+$/.test(s)) return "Only letters, digits, and hyphens are allowed";
      return null;
    },
  },
  ssnit: {
    placeholder: "e.g. C012345678901",
    formatHint: "Format: C or P followed by 10–11 digits  (e.g. C012345678901)",
    validate: (v) =>
      /^[CP]\d{10,11}$/i.test(v.trim())
        ? null
        : "SSNIT number: starts with C or P, then 10–11 digits (e.g. C012345678901)",
  },
};

/** Validates a Ghana mobile money number (10 digits starting with 0, or +233 followed by 9 digits). */
export function validateMoMoNumber(v: string): string | null {
  const s = v.trim();
  if (/^0\d{9}$/.test(s) || /^\+233\d{9}$/.test(s)) return null;
  return "Enter a valid 10-digit Ghana number (e.g. 0241234567)";
}

/** Normalises a Ghana mobile money number to the local 10-digit format (strips +233 prefix). */
export function normalizeMoMoNumber(v: string): string {
  const s = v.trim();
  if (s.startsWith("+233") && s.length === 13) return "0" + s.slice(4);
  return s;
}

/** Consistent mobile network options used across onboarding and profile. */
export const MOMO_NETWORKS = [
  { value: "MTN Mobile Money", label: "MTN Mobile Money" },
  { value: "Vodafone Cash", label: "Vodafone Cash" },
  { value: "AirtelTigo Money", label: "AirtelTigo Money" },
];

/**
 * Format a number as $ currency (or any other ISO currency).
 * Uses en-GH locale so the cedi symbol and separators are correct.
 */
export function formatPrice(
  amount: number,
  currency: string = DEFAULT_CURRENCY
): string {
  // Intl.NumberFormat requires ISO 4217 codes; "GH₵" is a display symbol — map it to the code
  const isoCode = currency === "GH₵" ? "GHS" : currency;
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: isoCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
