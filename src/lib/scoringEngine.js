// DFW Veteran Home Advisor — Scoring Engine v3
// VA Rate: 6.45% | Property Tax: $0 | PMI: $0 (100% P&T Exemption)

const VA_RATE = 0.0645;
const VA_TERM_MONTHS = 360;

// ─── Zip Code Tiers ───────────────────────────────────────────────────────────
const TIER_1_ZIPS = ["75094", "75089", "75088", "75048", "75070", "75071"];
const TIER_2_ZIPS = ["75034", "75035", "75002", "75013", "75098", "75032", "75087"];
const TIER_3_ZIPS = ["75182", "75040", "75044"];
const TIER_4_ZIPS = ["75166"];

export function getZipTier(zip) {
  if (!zip) return null;
  const z = String(zip).trim();
  if (TIER_1_ZIPS.includes(z)) return 1;
  if (TIER_2_ZIPS.includes(z)) return 2;
  if (TIER_3_ZIPS.includes(z)) return 3;
  if (TIER_4_ZIPS.includes(z)) return 4;
  return null;
}

export function getZipAutoScores(zip) {
  const tier = getZipTier(zip);
  if (tier === 1) return { resale_score: 8, commute_score: 8 };
  if (tier === 2) return { resale_score: 9, commute_score: 5, commuteFlag: "Check morning traffic" };
  if (tier === 3) return { resale_score: 4, commute_score: 5 };
  if (tier === 4) return { resale_score: 0, commute_score: 0, outOfRange: true };
  return null;
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
export function calculateVAMortgage(price) {
  const r = VA_RATE / 12;
  const n = VA_TERM_MONTHS;
  if (price <= 0) return 0;
  return price * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calculateTrueCost(home) {
  const pi = calculateVAMortgage(home.price || 0);
  const hoa = home.hoa_monthly || 0;
  // PID Trap: Ad-Valorem PID = $0 (exemption applies). Fixed-Assessment = full amount.
  const pidMonthly = home.pid_type === "ad_valorem"
    ? 0
    : (home.pid_mud_annual || 0) / 12;
  // Property tax = $0, PMI = $0 (100% P&T)
  return pi + hoa + pidMonthly;
}

// ─── Automated Red Flag Detector ──────────────────────────────────────────────
function detectAutoFlags(home) {
  const flags = [];
  const year = home.year_built || 2000;
  const currentYear = new Date().getFullYear();

  // VA Certificate of Occupancy check (< 2 years old)
  if (currentYear - year < 2) {
    flags.push("Verify VA Certificate of Occupancy (build < 2 years old)");
  }

  // Foundation + pool plaster inspection alert (pre-2000)
  if (year < 2000) {
    flags.push("Inspection Alert: Verify foundation and pool plaster condition (pre-2000 build)");
  }

  // HOA complaint check — Cottonwood Creek
  if ((home.address || "").toLowerCase().includes("cottonwood creek")) {
    flags.push("Active HOA complaints — Cottonwood Creek community");
  }

  // Space alert for family of 5
  if ((home.bedrooms || 0) < 4 || (home.sqft || 0) < 2800) {
    flags.push(`Space Alert: High density for 5-person family (${home.bedrooms || 0} beds, ${(home.sqft || 0).toLocaleString()} sqft)`);
  }

  return flags;
}

// ─── Must-Haves (includes Pool Rule) ─────────────────────────────────────────
function scoreMustHaves(home) {
  const price = home.price || 0;
  const pool = home.pool_status;
  const pros = [], cons = [], flags = [];

  // Pool Rule — hard gate: price > $500k with no private pool = 0 overall
  let poolScore = 0;
  if (pool === "private") {
    poolScore = 4; pros.push("Private pool ✓ — lifestyle asset");
  } else if (pool === "community") {
    poolScore = 2; pros.push("Community pool available");
    if (price > 500000) cons.push("No private pool above $500k");
  } else {
    if (price > 500000) {
      poolScore = 0;
      flags.push("POOL RULE: No pool above $500k — hard score zero");
      cons.push("No pool at premium price — fails Pool Rule");
    } else {
      poolScore = 2; pros.push("No pool — sub-$500k pool-ready lot");
    }
  }

  // Bedrooms
  let bdScore = 0;
  if ((home.bedrooms || 0) >= 4) {
    bdScore = 3; pros.push(`${home.bedrooms} bedrooms ✓`);
  } else {
    cons.push(`Only ${home.bedrooms || 0} bedrooms — need 4+`);
    flags.push("Insufficient bedrooms (need 4+)");
  }

  // Bathrooms
  let baScore = 0;
  if ((home.bathrooms || 0) >= 2.5) {
    baScore = 2; pros.push(`${home.bathrooms} bathrooms ✓`);
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

  // If pool rule fails, hard zero
  const failed = pool !== "private" && pool !== "community" && price > 500000;
  const score = failed ? 0 : Math.min(poolScore + bdScore + baScore + officeScore, 10);

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

// ─── Resale / Zip Tier ────────────────────────────────────────────────────────
function scoreResale(home) {
  const zipAuto = getZipAutoScores(home.zip_code);
  const tier = getZipTier(home.zip_code);
  const score = zipAuto ? zipAuto.resale_score : Math.min(Math.max(home.resale_score || 5, 0), 10);
  const pros = [], cons = [], flags = [];

  if (tier === 1) pros.push(`Zip ${home.zip_code} — Tier 1 resale zone`);
  else if (tier === 2) pros.push(`Zip ${home.zip_code} — Tier 2 top resale zone`);
  else if (tier === 3) cons.push(`Zip ${home.zip_code} — Tier 3 moderate resale zone`);
  else if (tier === 4) { flags.push("Zip Tier 4 — Out of Range"); cons.push("Location out of viable range"); }
  else if (score >= 8) pros.push("Strong resale potential");
  else if (score >= 6) pros.push("Good resale potential");
  else cons.push("Moderate or unknown resale potential");

  return { score, max: 10, pros, cons, flags };
}

// ─── Commute ──────────────────────────────────────────────────────────────────
function scoreCommute(home) {
  const zipAuto = getZipAutoScores(home.zip_code);
  const pros = [], cons = [], flags = [];

  if (zipAuto?.outOfRange) {
    flags.push("OUT OF RANGE — Tier 4 zip");
    cons.push("Zip is outside viable commute range");
    return { score: 0, max: 10, pros, cons, flags };
  }

  if (zipAuto) {
    const score = zipAuto.commute_score;
    if (score >= 8) pros.push(`Zip ${home.zip_code} — Tier 1 commute zone (≤30 min to Renner & Abrams)`);
    else if (score >= 5) {
      cons.push(`Zip ${home.zip_code} — Tier 2 commute (30–40 min to Renner & Abrams)`);
      if (zipAuto.commuteFlag) flags.push(zipAuto.commuteFlag);
    } else {
      cons.push(`Zip ${home.zip_code} — Tier 3 commute zone (>40 min)`);
    }
    return { score, max: 10, pros, cons, flags };
  }

  // Manual fallback
  let score = 0;
  const renner = home.commute_collins_min || 45;   // 3200 E Renner Rd (Collins Aerospace)
  const abrams = home.commute_coram_deo_min || 45; // 1301 Abrams Rd (Coram Deo Academy)

  if (renner <= 30) { score += 5; pros.push(`${renner} min to 3200 E Renner Rd ✓`); }
  else if (renner <= 40) { score += 2; cons.push(`${renner} min to Renner — over 30 min threshold`); flags.push("Renner Rd commute > 30 min"); }
  else { cons.push(`${renner} min to Renner — too far`); flags.push("Renner Rd commute > 40 min"); }

  if (abrams <= 30) { score += 5; pros.push(`${abrams} min to 1301 Abrams Rd ✓`); }
  else if (abrams <= 40) { score += 2; cons.push(`${abrams} min to Abrams — over 30 min threshold`); flags.push("Abrams Rd commute > 30 min"); }
  else { cons.push(`${abrams} min to Abrams — too far`); flags.push("Abrams Rd commute > 40 min"); }

  return { score: Math.min(score, 10), max: 10, pros, cons, flags };
}

// ─── True Cost ────────────────────────────────────────────────────────────────
function scoreTrueCost(home) {
  const tc = calculateTrueCost(home);
  const pros = [], cons = [];
  let score;

  const pidNote = home.pid_type === "ad_valorem" && (home.pid_mud_annual || 0) > 0
    ? " (PID exempt)" : "";

  if (tc < 2800) { score = 10; pros.push(`${fmt(tc)}/mo — very affordable${pidNote}`); }
  else if (tc < 3200) { score = 8; pros.push(`${fmt(tc)}/mo — manageable${pidNote}`); }
  else if (tc < 3600) { score = 6; cons.push(`${fmt(tc)}/mo — moderate${pidNote}`); }
  else if (tc < 4000) { score = 4; cons.push(`${fmt(tc)}/mo — stretching${pidNote}`); }
  else if (tc < 4500) { score = 2; cons.push(`${fmt(tc)}/mo — heavy burden${pidNote}`); }
  else { score = 0; cons.push(`${fmt(tc)}/mo — exceeds comfort zone${pidNote}`); }

  return { score, max: 10, pros, cons, flags: [] };
}

// ─── Build Quality + Builder Reputation ──────────────────────────────────────
function scoreBuildQuality(home) {
  const year = home.year_built || 2000;
  const pros = [], cons = [], flags = [];
  let score;

  if (year >= 2020) { score = 8; pros.push(`Built ${year} — modern construction`); }
  else if (year >= 2015) { score = 7; pros.push(`Built ${year} — recent build`); }
  else if (year >= 2010) { score = 6; pros.push(`Built ${year} — post-2010`); }
  else if (year >= 2005) { score = 5; }
  else if (year >= 2000) { score = 3; cons.push(`Built ${year} — aging systems risk`); }
  else { score = 1; cons.push(`Built ${year} — significant age risk`); }

  // Builder Reputation modifier (±2 pts, capped 0–10)
  const builderMod = getBuilderModifier(home.builder);
  if (builderMod > 0) pros.push(`${home.builder} — preferred builder (+${builderMod})`);
  if (builderMod < 0) cons.push(`${home.builder} — flagged builder (${builderMod})`);
  score = Math.min(10, Math.max(0, score + builderMod));

  return { score, max: 10, pros, cons, flags };
}

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── Main Scorer ──────────────────────────────────────────────────────────────
export function scoreHome(home) {
  const mustHaves = scoreMustHaves(home);
  const priceValue = scorePriceValue(home);
  const resale = scoreResale(home);
  const commute = scoreCommute(home);
  const trueCost = scoreTrueCost(home);
  const buildQuality = scoreBuildQuality(home);
  const autoFlags = detectAutoFlags(home);

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

  const allPros = [...mustHaves.pros, ...priceValue.pros, ...resale.pros, ...commute.pros, ...trueCost.pros, ...buildQuality.pros];
  const allCons = [...mustHaves.cons, ...priceValue.cons, ...resale.cons, ...commute.cons, ...trueCost.cons, ...buildQuality.cons];
  const allFlags = [...mustHaves.flags, ...resale.flags, ...commute.flags, ...buildQuality.flags, ...autoFlags];

  const zipAuto = getZipAutoScores(home.zip_code);
  let verdict;
  if (zipAuto?.outOfRange) verdict = "PASS — Out of Range.";
  else if (overall >= 80) verdict = "Strong contender — make an offer.";
  else if (overall >= 65) verdict = "Solid option — worth a showing.";
  else if (overall >= 50) verdict = "Acceptable with compromises.";
  else verdict = "Below threshold — skip or negotiate hard.";

  return {
    overall_score: overall,
    verdict,
    pros: allPros,
    cons: allCons,
    red_flags: allFlags,
    va_mortgage_pi: Math.round(calculateVAMortgage(home.price || 0)),
    monthly_true_cost: Math.round(calculateTrueCost(home)),
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