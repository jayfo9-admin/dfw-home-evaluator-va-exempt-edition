/**
 * Sanitizes a raw home object before it's scored or saved.
 * Handles the most common paste/sync errors:
 *   - string prices like "$550,000" or "550000"
 *   - string numbers for numeric fields
 *   - wrong boolean types ("true" / 1 / null)
 *   - invalid pool_status / pid_type enums
 */

const STRIP_CURRENCY = /[^0-9.]/g;

function toNum(val, fallback = 0) {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  // Strip currency symbols, commas, spaces
  const cleaned = String(val).replace(STRIP_CURRENCY, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? fallback : n;
}

function toBool(val, fallback = false) {
  if (typeof val === "boolean") return val;
  if (val === 1 || val === "1" || val === "true" || val === "yes") return true;
  if (val === 0 || val === "0" || val === "false" || val === "no") return false;
  return fallback;
}

const VALID_POOL = ["private", "community", "none"];
const VALID_PID = ["ad_valorem", "fixed_assessment"];

export function normalizeHome(raw) {
  if (!raw || typeof raw !== "object") return null;

  const home = { ...raw };

  // Numeric fields
  home.price            = toNum(home.price, 0);
  home.sqft             = toNum(home.sqft, 0);
  home.year_built       = toNum(home.year_built, 0);
  home.bedrooms         = toNum(home.bedrooms, 0);
  home.bathrooms        = toNum(home.bathrooms, 0);
  home.hoa_monthly      = toNum(home.hoa_monthly, 0);
  home.pid_mud_annual   = toNum(home.pid_mud_annual, 0);
  home.home_insurance_monthly = toNum(home.home_insurance_monthly, 0);
  const commuteField = (val) => (val !== undefined && val !== null) ? toNum(val, null) : undefined;
  home.commute_collins_min           = commuteField(home.commute_collins_min);
  home.commute_coram_deo_min         = commuteField(home.commute_coram_deo_min);
  home.commute_dallas_christian_min  = commuteField(home.commute_dallas_christian_min);
  home.commute_heritage_min          = commuteField(home.commute_heritage_min);
  home.commute_mckinney_christian_min = commuteField(home.commute_mckinney_christian_min);
  home.commute_garland_christian_min = commuteField(home.commute_garland_christian_min);
  home.resale_score     = home.resale_score !== undefined ? toNum(home.resale_score, 0) : undefined;

  // Boolean
  home.has_office = toBool(home.has_office, false);

  // Enum — default to safe values if invalid
  if (!VALID_POOL.includes(home.pool_status)) home.pool_status = "none";
  if (home.pid_type && !VALID_PID.includes(home.pid_type)) home.pid_type = "fixed_assessment";

  // String fields — coerce to string or empty
  const strOrEmpty = (v) => (v !== null && v !== undefined ? String(v) : "");
  home.address         = strOrEmpty(home.address);
  home.city            = strOrEmpty(home.city);
  home.zip_code        = strOrEmpty(home.zip_code);
  home.builder         = strOrEmpty(home.builder);
  home.school_district = strOrEmpty(home.school_district);

  return home;
}