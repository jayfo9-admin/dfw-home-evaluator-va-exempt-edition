// DFW Veteran Home Advisor — Scoring Engine v3
// VA Rate: Live from Navy Federal (default 5.375% as of Apr 27, 2026)

const VA_RATE_DEFAULT = 0.05375; // Navy Federal 30-Year VA rate (updated Apr 27, 2026)
const VA_TERM_MONTHS = 360;

const _fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export function fmt(n) { return _fmt.format(n); }

// Per-zip commute/resale scores based on real drive times to Collins Aerospace + Coram Deo
const ZIP_SCORES = {
  // Rowlett / Sachse — closest to both destinations
  "75088": { resale_score: 7, commute_score: 8 },
  "75089": { resale_score: 7, commute_score: 8 },
  "75048": { resale_score: 7, commute_score: 8 },
  // Murphy / Wylie — slightly further, Plano ISD resale premium
  "75094": { resale_score: 8, commute_score: 7 },
  // McKinney — good resale, longer commute
  "75070": { resale_score: 8, commute_score: 6 },
  "75071": { resale_score: 8, commute_score: 6 },
  // Plano / Allen — top resale, moderate commute
  "75034": { resale_score: 9, commute_score: 6 },
  "75035": { resale_score: 9, commute_score: 6 },
  "75002": { resale_score: 8, commute_score: 7 },
  "75013": { resale_score: 9, commute_score: 7 },
  // Rockwall / Heath / Royse City
  "75032": { resale_score: 8, commute_score: 5, commuteFlag: "Check I-30 morning traffic" },
  "75087": { resale_score: 7, commute_score: 5, commuteFlag: "Check I-30 morning traffic" },
  "75098": { resale_score: 7, commute_score: 5, commuteFlag: "Check I-30 morning traffic" },
  // Garland
  "75040": { resale_score: 4, commute_score: 7 },
  "75043": { resale_score: 4, commute_score: 7 },
  "75044": { resale_score: 5, commute_score: 7 },
  "75182": { resale_score: 4, commute_score: 6 },
  // Plano
  "75074": { resale_score: 9, commute_score: 6 },
  "75075": { resale_score: 9, commute_score: 6 },
  // Out of range
  "75166": { resale_score: 0, commute_score: 0, outOfRange: true },
};

export function getZipAutoScores(zip) {
  if (!zip) return null;
  const z = String(zip).trim();
  return ZIP_SCORES[z] || null;
}

// ─── Zip Code Tiers (for label display) ──────────────────────────────────────
export function getZipTier(zip) {
  const scores = getZipAutoScores(zip);
  if (!scores) return null;
  if (scores.outOfRange) return 4;
  if (scores.resale_score >= 8) return (scores.commute_score >= 7 ? 1 : 2);
  if (scores.resale_score >= 6) return 2;
  return 3;
}

// ─── CAD & Contact Info ───────────────────────────────────────────────────────
const DALLAS_CAD_ZIPS = ["75088", "75089", "75040", "75044", "75048",
  "75043", "75041", "75042", "75149", "75150", "75080", "75081", "75082"];
const COLLIN_CAD_ZIPS = ["75094", "75070", "75071", "75002", "75013",
  "75034", "75035", "75098", "75032", "75087"];
const PID_ADMIN_ZIPS = ["75126", "75032", "75098"]; // Forney / Rockwall / Wylie PID zones

export function getCADInfo(zip) {
  if (!zip) return [{ name: "Dallas CAD", phone: "214-631-0520" }];
  const z = String(zip).trim();
  const contacts = [];
  if (DALLAS_CAD_ZIPS.includes(z)) contacts.push({ name: "Dallas CAD", phone: "214-631-0520" });
  if (COLLIN_CAD_ZIPS.includes(z)) contacts.push({ name: "Collin CAD", phone: "469-742-9200" });
  if (PID_ADMIN_ZIPS.includes(z)) contacts.push({ name: "PID Admin (P3Works)", phone: "817-393-0353" });
  if (contacts.length === 0) contacts.push({ name: "Dallas CAD", phone: "214-631-0520" });
  return contacts;
}

// ─── Builder Modifier ─────────────────────────────────────────────────────────
const BUILDER_BONUS = ["perry", "meritage", "landon"];
const BUILDER_PENALTY = ["first texas", "bloomfield"];

export function getBuilderModifier(builder) {
  if (!builder) return 0;
  const b = builder.toLowerCase();
  if (BUILDER_BONUS.some((x) => b.includes(x))) return 2;
  if (BUILDER_PENALTY.some((x) => b.includes(x))) return -2;
  return 0;
}

// ─── Financial Engine ─────────────────────────────────────────────────────────
export function calculateVAMortgage(price, rate = VA_RATE_DEFAULT) {
  const r = rate / 12;
  const n = VA_TERM_MONTHS;
  if (price <= 0) return 0;
  return price * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calculateTrueCost(home, rate) {
  const pi = calculateVAMortgage(home.price || 0, rate);
  const hoa = home.hoa_monthly || 0;
  // PID Trap: Ad-Valorem PID = $0 (exemption applies). Fixed-Assessment = full amount.
  const pidMonthly = home.pid_type === "ad_valorem"
    ? 0
    : (home.pid_mud_annual || 0) / 12;
  // Home insurance — from AI research or conservative default (~$250/mo for DFW $500-700K homes; Texas insurance is expensive)
  const homeInsurance = home.home_insurance_monthly || Math.max(250, Math.round((home.price || 0) * 0.005 / 12));
  // Flood insurance — only if in high-risk zone and required
  const floodInsurance = home.flood_info?.flood_insurance_required
    ? (home.flood_info?.estimated_flood_insurance_monthly || 0)
    : 0;
  // Property tax = $0, PMI = $0 (100% P&T)
  return pi + hoa + pidMonthly + homeInsurance + floodInsurance;
}

// ─── Cautions & Red Flags Detector ───────────────────────────────────────────
function detectCautionsAndFlags(home) {
  const cautions = [];
  const redFlags = [];
  const year = home.year_built || 2000;
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // VA Certificate of Occupancy check (< 2 years old) — caution
  if (age < 2) {
    cautions.push("Verify VA Certificate of Occupancy (build < 2 years old)");
  }

  // Age-based inspection alerts — escalating by decade — cautions only
  if (age >= 30) {
    cautions.push(`Age Alert (${year}): Roof likely at or past end of life — get inspection + replacement estimate`);
    cautions.push(`Age Alert (${year}): HVAC systems likely at or past end of life — verify age and condition`);
    cautions.push(`Age Alert (${year}): Plumbing — inspect for galvanized or polybutylene pipes, water heater age`);
    cautions.push(`Age Alert (${year}): Foundation — require engineering inspection, check for pier and beam issues or slab cracks`);
    if (home.pool_status === "private") {
      cautions.push(`Age Alert (${year}): Pool — inspect plaster, plumbing, pump, and heater (30+ yr old pool)`);
    }
  } else if (age >= 20) {
    cautions.push(`Age Alert (${year}): HVAC — verify age and last service; systems may be approaching end of life`);
    cautions.push(`Age Alert (${year}): Roof — inspect for wear; shingles may need replacement within 5 years`);
    cautions.push(`Age Alert (${year}): Water heater likely needs replacement soon — confirm age`);
  } else if (age >= 10) {
    cautions.push(`Age Note (${year}): HVAC and water heater — confirm age and service records`);
  }

  // HOA complaint check — Cottonwood Creek — red flag
  if ((home.address || "").toLowerCase().includes("cottonwood creek")) {
    redFlags.push("Active HOA complaints — Cottonwood Creek community");
  }

  // ISD resale warning — auto-flag weak ISDs regardless of score — caution
  const sd = (home.school_district || "").toLowerCase();
  if (sd.includes("garland")) {
    cautions.push("Garland ISD rated 4/10 — resale ceiling is lower than Rockwall/Plano ISD peers; confirm Rowlett HS and feeder school ratings");
  } else if (sd.includes("mesquite")) {
    cautions.push("Mesquite ISD — below-average ratings; verify school quality impact on resale");
  } else if (sd.includes("dallas")) {
    cautions.push("Dallas ISD — significant resale headwind; research specific school ratings");
  }

  return { cautions, redFlags };
}

// ─── Must-Haves (includes Pool Rule + Sqft for family of 5) ──────────────────
function scoreMustHaves(home) {
  const price = home.price || 0;
  const pool = home.pool_status;
  const sqft = home.sqft || 0;
  const pros = [], cons = [], flags = [];

  // Pool Rule — hard gate: price > $500k with no private pool = 0 overall
  let poolScore = 0;
  if (pool === "private") {
    poolScore = 3; pros.push("Private pool ✓ — lifestyle asset");
  } else if (pool === "community") {
    poolScore = 1; pros.push("Community pool available");
    if (price > 500000) cons.push("No private pool above $500k");
  } else {
    if (price > 500000) {
      poolScore = 0;
      flags.push("POOL RULE: No pool above $500k — hard score zero");
      cons.push("No pool at premium price — fails Pool Rule");
    } else {
      poolScore = 1; pros.push("No pool — sub-$500k");
    }
  }

  // Bedrooms
  let bdScore = 0;
  if ((home.bedrooms || 0) >= 5) {
    bdScore = 2; pros.push(`${home.bedrooms} bedrooms ✓ — excellent for family of 5`);
  } else if ((home.bedrooms || 0) >= 4) {
    bdScore = 2; pros.push(`${home.bedrooms} bedrooms ✓`);
  } else {
    cons.push(`Only ${home.bedrooms || 0} bedrooms — need 4+`);
    flags.push("Insufficient bedrooms (need 4+)");
  }

  // Bathrooms
  let baScore = 0;
  if ((home.bathrooms || 0) >= 3) {
    baScore = 2; pros.push(`${home.bathrooms} bathrooms ✓`);
  } else if ((home.bathrooms || 0) >= 2.5) {
    baScore = 1; pros.push(`${home.bathrooms} bathrooms ✓`);
  } else {
    cons.push(`Only ${home.bathrooms || 0} baths — need 2.5+`);
  }

  // Office
  let officeScore = 0;
  if (home.has_office) {
    officeScore = 1; pros.push("Dedicated office/study ✓");
  } else {
    cons.push("No dedicated office space");
  }

  // Sqft — family of 5 with 3 teens needs space
  let sqftScore = 0;
  if (sqft >= 3500) {
    sqftScore = 2; pros.push(`${sqft.toLocaleString()} sqft — spacious for family of 5`);
  } else if (sqft >= 3000) {
    sqftScore = 1; pros.push(`${sqft.toLocaleString()} sqft — adequate`);
  } else if (sqft >= 2600) {
    sqftScore = 0; cons.push(`${sqft.toLocaleString()} sqft — tight for family of 5`);
    flags.push(`Sqft tight for 5 people — confirm layout before touring`);
  } else if (sqft > 0) {
    sqftScore = -1; cons.push(`${sqft.toLocaleString()} sqft — too small for family of 5`);
    flags.push(`Sqft concern: ${sqft.toLocaleString()} sqft for 5 people`);
  }

  // If pool rule fails, hard zero
  const failed = pool !== "private" && pool !== "community" && price > 500000;
  const raw = poolScore + bdScore + baScore + officeScore + sqftScore;
  const score = failed ? 0 : Math.min(10, Math.max(0, raw));

  return { score, max: 10, pros, cons, flags };
}

// ─── Price Value ──────────────────────────────────────────────────────────────
function scorePriceValue(home) {
  const price = home.price || 0;
  const pros = [], cons = [];
  let score;

  if (price < 500000) { score = 10; pros.push("Under $500k — excellent value"); }
  else if (price <= 600000) { score = 8; pros.push("$500–600k — good value"); }
  else if (price <= 700000) { score = 5; cons.push("$600–700k — stretching budget"); }
  else { score = 0; cons.push("Over $700k — above target ceiling"); }

  return { score, max: 10, pros, cons, flags: [] };
}

// ─── ISD Resale Modifier ──────────────────────────────────────────────────────
// School district quality is a major resale driver in DFW.
// ISD tier overrides or caps the zip-based resale score.
const ISD_TIERS = {
  // Tier A — Top resale premium ISDs
  "plano isd": { mod: 2, cap: null, label: "Plano ISD — top-tier resale premium" },
  "rockwall isd": { mod: 1, cap: null, label: "Rockwall ISD — strong resale district" },
  "frisco isd": { mod: 2, cap: null, label: "Frisco ISD — top-tier resale premium" },
  "allen isd": { mod: 1, cap: null, label: "Allen ISD — strong resale district" },
  "mckinney isd": { mod: 1, cap: null, label: "McKinney ISD — solid resale district" },
  "wylie isd": { mod: 0, cap: null, label: "Wylie ISD — average resale district" },
  "richardson isd": { mod: 1, cap: null, label: "Richardson ISD — solid resale district" },
  // Tier C — Resale headwind ISDs — cap score regardless of zip
  "garland isd": { mod: -2, cap: 5, label: "Garland ISD — resale headwind (rated 4/10)" },
  "mesquite isd": { mod: -2, cap: 5, label: "Mesquite ISD — resale headwind" },
  "dallas isd": { mod: -3, cap: 4, label: "Dallas ISD — significant resale headwind" },
  "forney isd": { mod: -1, cap: 6, label: "Forney ISD — moderate resale headwind" },
};

function getISDModifier(schoolDistrict) {
  if (!schoolDistrict) return null;
  const sd = schoolDistrict.toLowerCase();
  for (const [key, val] of Object.entries(ISD_TIERS)) {
    if (sd.includes(key.replace(" isd", ""))) return val;
  }
  return null;
}

// ─── Resale / Zip Tier + ISD ──────────────────────────────────────────────────
function scoreResale(home) {
  const pros = [], cons = [], flags = [];

  // Prefer explicit resale_score if provided
  if (home.resale_score !== undefined && home.resale_score !== null && home.resale_score !== 0) {
    let baseScore = Math.min(Math.max(home.resale_score, 0), 10);
    pros.push(`Custom resale score: ${baseScore}/10`);

    // Still apply ISD modifier on top
    const isd = getISDModifier(home.school_district);
    let score = baseScore;
    if (isd) {
      score = Math.min(10, Math.max(0, baseScore + isd.mod));
      if (isd.cap !== null) score = Math.min(score, isd.cap);
      if (isd.mod >= 1) pros.push(isd.label);
      else cons.push(isd.label);
    }
    return { score, max: 10, pros, cons, flags };
  }

  // Fall back to zip tier
  const zipAuto = getZipAutoScores(home.zip_code);
  const tier = getZipTier(home.zip_code);
  let baseScore = zipAuto ? zipAuto.resale_score : 5;

  // Zip tier label
  if (tier === 1) pros.push(`Zip ${home.zip_code} — Tier 1 resale zone`);
  else if (tier === 2) pros.push(`Zip ${home.zip_code} — Tier 2 top resale zone`);
  else if (tier === 3) cons.push(`Zip ${home.zip_code} — Tier 3 moderate resale zone`);
  else if (tier === 4) { flags.push("Zip Tier 4 — Out of Range"); cons.push("Location out of viable range"); }

  // ISD modifier — applied on top of zip score
  const isd = getISDModifier(home.school_district);
  let score = baseScore;
  if (isd) {
    score = Math.min(10, Math.max(0, baseScore + isd.mod));
    if (isd.cap !== null) score = Math.min(score, isd.cap);
    if (isd.mod >= 1) pros.push(isd.label);
    else cons.push(isd.label);
  }

  return { score, max: 10, pros, cons, flags };
}

// ─── Commute ──────────────────────────────────────────────────────────────────
function scoreCommute(home) {
  const pros = [], cons = [], flags = [];

  // Prefer specific home-level commute times if provided
  if (home.commute_collins_min !== undefined && home.commute_collins_min !== null) {
    let score = 0;
    const renner = home.commute_collins_min;

    if (renner <= 30) { score += 5; pros.push(`${renner} min to Collins Aerospace ✓`); }
    else if (renner <= 40) { score += 2; cons.push(`${renner} min to Collins — over 30 min`); flags.push("Collins commute > 30 min"); }
    else { cons.push(`${renner} min to Collins — too far`); flags.push("Collins commute > 40 min"); }

    return { score: Math.min(score, 10), max: 10, pros, cons, flags };
  }

  // Fall back to zip tier
  const zipAuto = getZipAutoScores(home.zip_code);

  if (zipAuto?.outOfRange) {
    flags.push("OUT OF RANGE — Tier 4 zip");
    cons.push("Zip is outside viable commute range");
    return { score: 0, max: 10, pros, cons, flags };
  }

  if (zipAuto) {
    const score = zipAuto.commute_score;
    if (score >= 8) pros.push(`Zip ${home.zip_code} — Tier 1 commute zone (≤30 min to Collins)`);
    else if (score >= 5) {
      cons.push(`Zip ${home.zip_code} — Tier 2 commute (30–40 min)`);
      if (zipAuto.commuteFlag) flags.push(zipAuto.commuteFlag);
    } else {
      cons.push(`Zip ${home.zip_code} — Tier 3 commute zone (>40 min)`);
    }
    return { score, max: 10, pros, cons, flags };
  }

  return { score: 5, max: 10, pros: ["Commute unverified"], cons: [], flags: ["Verify actual commute time to Collins Aerospace"] };
}

// ─── True Cost ────────────────────────────────────────────────────────────────
// Scores the add-on burden (HOA + PID) on top of VA P&I.
// $0 HOA + $0 PID = 10/10. Higher recurring fees reduce score.
function scoreTrueCost(home, rate) {
  const hoa = home.hoa_monthly || 0;
  const pidMonthly = home.pid_type === "ad_valorem" ? 0 : (home.pid_mud_annual || 0) / 12;
  const addonMonthly = hoa + pidMonthly;
  const tc = calculateTrueCost(home, rate);

  // PID type unknown flag
  const flags = [];
  if ((!home.pid_type || home.pid_type === "") && (home.pid_mud_annual || 0) > 0) {
    flags.push(`⚠ PID type unknown — ${fmt((home.pid_mud_annual || 0) / 12)}/mo assumed taxable (fixed assessment). Verify type.`);
  }
  const pros = [], cons = [];
  let score;

  const homeIns = home.home_insurance_monthly || Math.round((home.price || 0) * 0.001 / 12);
  const floodIns = home.flood_info?.flood_insurance_required ? (home.flood_info?.estimated_flood_insurance_monthly || 0) : 0;
  const tcLabel = `${fmt(tc)}/mo (P&I + HOA ${fmt(hoa)} + PID ${fmt(pidMonthly)} + Ins ${fmt(homeIns)}${floodIns > 0 ? ` + Flood ${fmt(floodIns)}` : ""})`;

  if (addonMonthly === 0) {
    score = 10;
  } else if (addonMonthly < 75) {
    score = 9;
  } else if (addonMonthly < 150) {
    score = 7;
  } else if (addonMonthly < 250) {
    score = 5; cons.push(`HOA/PID ${fmt(addonMonthly)}/mo adds to cost`);
  } else if (addonMonthly < 400) {
    score = 3; cons.push(`High HOA/PID ${fmt(addonMonthly)}/mo`);
  } else {
    score = 1; cons.push(`Very high HOA/PID ${fmt(addonMonthly)}/mo`);
  }

  if (home.pid_type === "ad_valorem" && (home.pid_mud_annual || 0) > 0) {
    pros.push("Ad-valorem PID exempt ($0)");
  }

  // Flood insurance flag
  if (home.flood_info?.flood_risk === "high") {
    cons.push(`High flood risk (FEMA ${home.flood_info.fema_zone || "zone unknown"}) — flood insurance required`);
  } else if (home.flood_info?.flood_risk === "moderate") {
    cons.push(`Moderate flood risk (FEMA ${home.flood_info.fema_zone || "zone unknown"}) — verify flood insurance`);
  }

  return { score, max: 10, pros, cons, flags };
}

// ─── Build Quality + Builder Reputation ──────────────────────────────────────
function scoreBuildQuality(home) {
  const year = home.year_built || 2000;
  const pros = [], cons = [], flags = [];
  let score;

  if (year >= 2020) { score = 9; pros.push(`Built ${year} — modern construction`); }
  else if (year >= 2015) { score = 8; pros.push(`Built ${year} — recent build`); }
  else if (year >= 2010) { score = 7; pros.push(`Built ${year} — post-2010`); }
  else if (year >= 2005) { score = 6; pros.push(`Built ${year} — mid-2000s`); }
  else if (year >= 2000) { score = 5; cons.push(`Built ${year} — aging systems, budget for updates`); }
  else if (year >= 1995) { score = 5; cons.push(`Built ${year} — 30yr old systems, inspect carefully`); }
  else if (year >= 1990) { score = 4; cons.push(`Built ${year} — significant age, major systems at end of life`); }
  else { score = 2; cons.push(`Built ${year} — significant age risk`); }

  // Builder Reputation modifier (±2 pts, capped 0–10)
  const builderMod = getBuilderModifier(home.builder);
  if (builderMod > 0) pros.push(`${home.builder} — preferred builder (+${builderMod})`);
  if (builderMod < 0) cons.push(`${home.builder} — flagged builder (${builderMod})`);
  score = Math.min(10, Math.max(0, score + builderMod));

  return { score, max: 10, pros, cons, flags };
}

// ─── Main Scorer ──────────────────────────────────────────────────────────────
export function scoreHome(home, rate) {
  const mustHaves = scoreMustHaves(home);
  const priceValue = scorePriceValue(home);
  const resale = scoreResale(home);
  const commute = scoreCommute(home);
  const trueCost = scoreTrueCost(home, rate);
  const buildQuality = scoreBuildQuality(home);
  const { cautions: autoCautions, redFlags: autoRedFlags } = detectCautionsAndFlags(home);

  // Weights: Must-Haves 30%, Price 20%, Resale 20%, Commute 15%, True Cost 10%, Build Quality 5%
  let overall = Math.round(
    (mustHaves.score / 10) * 30 +
    (priceValue.score / 10) * 20 +
    (resale.score / 10) * 20 +
    (commute.score / 10) * 15 +
    (trueCost.score / 10) * 10 +
    (buildQuality.score / 10) * 5
  );

  overall = Math.min(100, Math.max(0, overall));

  const allPros = [...commute.pros, ...mustHaves.pros, ...priceValue.pros, ...resale.pros, ...trueCost.pros, ...buildQuality.pros];
  const allCons = [...mustHaves.cons, ...priceValue.cons, ...resale.cons, ...commute.cons, ...trueCost.cons, ...buildQuality.cons];
  const allCautions = [...autoCautions, ...mustHaves.flags];
  const allRedFlags = [...autoRedFlags, ...resale.flags, ...commute.flags, ...buildQuality.flags];

  const zipAuto = getZipAutoScores(home.zip_code);
  let verdict;
  if (zipAuto?.outOfRange) verdict = "PASS — Out of Range.";
  else if (overall >= 85) verdict = "Strong contender — make an offer.";
  else if (overall >= 65) verdict = "Solid option — worth a showing.";
  else if (overall >= 50) verdict = "Acceptable with compromises.";
  else verdict = "Below threshold — skip or negotiate hard.";

  // Expose whether commute was verified via actual minutes (vs zip-tier estimate)
  const commuteVerified = home.commute_collins_min !== undefined && home.commute_collins_min !== null;
  const vaRateUsed = rate ?? VA_RATE_DEFAULT;

  return {
    overall_score: overall,
    verdict,
    one_line: verdict,
    pros: allPros,
    cons: allCons,
    cautions: allCautions,
    red_flags: allRedFlags,
    va_mortgage_pi: Math.round(calculateVAMortgage(home.price || 0, vaRateUsed)),
    monthly_true_cost: Math.round(calculateTrueCost(home, vaRateUsed)),
    commute_verified: commuteVerified,
    va_rate_used: vaRateUsed,
    scores: {
      must_haves: mustHaves.score,
      price_value: priceValue.score,
      resale: resale.score,
      commute: commute.score,
      true_cost: trueCost.score,
      build_quality: buildQuality.score,
    },
    pillars: {
      mustHaves:    { score: mustHaves.score,    max: 10, weight: 30, label: "Must-Haves + Pool Rule" },
      priceValue:   { score: priceValue.score,   max: 10, weight: 20, label: "Price Value" },
      resale:       { score: resale.score,       max: 10, weight: 20, label: "Resale Potential" },
      commute:      { score: commute.score,      max: 10, weight: 15, label: "Commute" },
      trueCost:     { score: trueCost.score,     max: 10, weight: 10, label: "True Cost" },
      buildQuality: { score: buildQuality.score, max: 10, weight: 5,  label: "Build Quality + Builder Rep" },
    }
  };
}