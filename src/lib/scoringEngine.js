// DFW Veteran Home Advisor — Scoring Engine v2
// VA Rate: 6.45% | P&T Exempt: $0 tax | 30-yr fixed

const VA_RATE = 0.0645;
const VA_TERM_MONTHS = 360;

// ─── Zip Code Tier Lookup ─────────────────────────────────────────────────────
// Tier 1: Strong commute + resale
const TIER_1_ZIPS = ["75094", "75089", "75088", "75048", "75070", "75071"];
// Tier 2: Top resale, moderate commute
const TIER_2_ZIPS = ["75034", "75002", "75098", "75032"];
// Tier 4: Out of range
const TIER_4_ZIPS = ["75166"];

export function getZipTier(zip) {
  if (!zip) return null;
  const z = String(zip).trim();
  if (TIER_1_ZIPS.includes(z)) return 1;
  if (TIER_2_ZIPS.includes(z)) return 2;
  if (TIER_4_ZIPS.includes(z)) return 4;
  return null;
}

export function getZipAutoScores(zip) {
  const tier = getZipTier(zip);
  if (tier === 1) return { resale_score: 8, commute_score: 8 };
  if (tier === 2) return { resale_score: 9, commute_score: 5 };
  if (tier === 4) return { resale_score: 0, commute_score: 0, outOfRange: true };
  return null;
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

// ─── Dallas vs Collin CAD ─────────────────────────────────────────────────────
// Dallas County zips (sample — not exhaustive, covers Rowlett/Garland/Dallas)
const DALLAS_COUNTY_ZIPS = [
  "75088", "75089", "75043", "75041", "75042", "75040",
  "75098", "75232", "75211", "75217", "75228", "75218",
  "75149", "75150", "75080", "75081", "75082", "75083",
];

export function getCADInfo(zip) {
  if (!zip) return { name: "Dallas CAD", phone: "214-631-0520" };
  const z = String(zip).trim();
  if (DALLAS_COUNTY_ZIPS.includes(z)) {
    return { name: "Dallas CAD", phone: "214-631-0520" };
  }
  return { name: "Collin CAD", phone: "469-742-9200" };
}

// ─── Financial ────────────────────────────────────────────────────────────────
export function calculateVAMortgage(price) {
  const r = VA_RATE / 12;
  const n = VA_TERM_MONTHS;
  if (price <= 0) return 0;
  return price * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calculateTrueCost(home) {
  const pi = calculateVAMortgage(home.price || 0);
  const hoa = home.hoa_monthly || 0;
  const pidMonthly = (home.pid_mud_annual || 0) / 12;
  // Property tax = $0 (100% P&T Homestead Exemption)
  return pi + hoa + pidMonthly;
}

// ─── Pool Rule (Mandatory) ────────────────────────────────────────────────────
function scorePool(home) {
  const price = home.price || 0;
  const pool = home.pool_status;
  const pros = [];
  const cons = [];
  const flags = [];

  if (pool === "private") {
    pros.push("Private pool — 10/10 lifestyle asset");
    return { score: 10, pros, cons, flags };
  }
  if (pool === "community") {
    pros.push("Community pool available");
    return { score: 6, pros, cons, flags };
  }
  // No pool
  if (price < 500000) {
    pros.push("No pool — Pool-Ready Lot at sub-$500k");
    return { score: 7, pros, cons, flags };
  }
  // No pool + price >= $500k → RED FLAG
  cons.push("No private pool at premium price point");
  flags.push("🚩 RED FLAG: No pool above $500k — Overpriced");
  return { score: 0, pros, cons, flags };
}

// ─── Must-Haves (bed/bath/office) ─────────────────────────────────────────────
function scoreMustHaves(home) {
  let score = 0;
  const pros = [];
  const cons = [];
  const flags = [];

  if ((home.bedrooms || 0) >= 4) {
    score += 4;
    pros.push(`${home.bedrooms} bedrooms ✓`);
  } else {
    cons.push(`Only ${home.bedrooms || 0} bedrooms — need 4+`);
    flags.push("Insufficient bedrooms (need 4+)");
  }

  if ((home.bathrooms || 0) >= 2.5) {
    score += 3;
    pros.push(`${home.bathrooms} bathrooms ✓`);
  } else {
    score += 1;
    cons.push(`Only ${home.bathrooms || 0} baths — need 2.5+`);
  }

  if (home.has_office) {
    score += 3;
    pros.push("Dedicated office/study ✓");
  } else {
    cons.push("No dedicated office space");
  }

  return { score: Math.min(score, 10), max: 10, pros, cons, flags };
}

// ─── Price Value ──────────────────────────────────────────────────────────────
function scorePriceValue(home) {
  const price = home.price || 0;
  const pros = [];
  const cons = [];
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
  const score = zipAuto ? zipAuto.resale_score : Math.min(Math.max(home.resale_score || 5, 0), 10);
  const pros = [];
  const cons = [];
  const flags = [];
  const tier = getZipTier(home.zip_code);

  if (tier === 1) pros.push(`Zip ${home.zip_code} — Tier 1 resale zone`);
  else if (tier === 2) pros.push(`Zip ${home.zip_code} — Tier 2 top resale zone`);
  else if (tier === 4) { flags.push("Zip tier 4 — Out of Range"); cons.push("Location out of viable range"); }
  else if (score >= 8) pros.push("Strong resale potential");
  else if (score >= 6) pros.push("Good resale potential");
  else cons.push("Moderate or unknown resale potential");

  return { score, max: 10, pros, cons, flags };
}

// ─── Commute ──────────────────────────────────────────────────────────────────
function scoreCommute(home) {
  const zipAuto = getZipAutoScores(home.zip_code);
  const pros = [];
  const cons = [];
  const flags = [];

  // Tier 4 = out of range, score 0
  if (zipAuto?.outOfRange) {
    flags.push("PASS — Out of Range (Tier 4 zip)");
    cons.push("Zip is outside viable commute range");
    return { score: 0, max: 10, pros, cons, flags };
  }

  if (zipAuto) {
    const score = zipAuto.commute_score;
    if (score >= 8) pros.push(`Zip ${home.zip_code} — Tier 1 commute zone (≤25 min)`);
    else if (score >= 5) cons.push(`Zip ${home.zip_code} — Tier 2 commute (30-40 min)`);
    return { score, max: 10, pros, cons, flags };
  }

  // Manual commute times fallback
  let score = 0;
  const collins = home.commute_collins_min || 45;
  const coram = home.commute_coram_deo_min || 45;

  if (collins <= 20) { score += 5; pros.push(`${collins} min to Collins Aerospace`); }
  else if (collins <= 30) { score += 4; pros.push(`${collins} min to Collins — acceptable`); }
  else if (collins <= 40) { score += 2; cons.push(`${collins} min to Collins — long`); }
  else { cons.push(`${collins} min to Collins — too far`); flags.push("Collins commute > 40 min"); }

  if (coram <= 20) { score += 5; pros.push(`${coram} min to Coram Deo`); }
  else if (coram <= 30) { score += 4; pros.push(`${coram} min to Coram Deo — acceptable`); }
  else if (coram <= 40) { score += 2; cons.push(`${coram} min to Coram Deo — long`); }
  else { cons.push(`${coram} min to Coram Deo — too far`); flags.push("Coram Deo commute > 40 min"); }

  return { score: Math.min(score, 10), max: 10, pros, cons, flags };
}

// ─── True Cost ────────────────────────────────────────────────────────────────
function scoreTrueCost(home) {
  const tc = calculateTrueCost(home);
  const pros = [];
  const cons = [];
  let score;

  if (tc < 2800) { score = 10; pros.push(`${fmt(tc)}/mo — very affordable`); }
  else if (tc < 3200) { score = 8; pros.push(`${fmt(tc)}/mo — manageable`); }
  else if (tc < 3600) { score = 6; cons.push(`${fmt(tc)}/mo — moderate`); }
  else if (tc < 4000) { score = 4; cons.push(`${fmt(tc)}/mo — stretching`); }
  else if (tc < 4500) { score = 2; cons.push(`${fmt(tc)}/mo — heavy burden`); }
  else { score = 0; cons.push(`${fmt(tc)}/mo — exceeds comfort zone`); }

  return { score, max: 10, pros, cons, flags: [] };
}

// ─── Build Quality ────────────────────────────────────────────────────────────
function scoreBuildQuality(home) {
  const year = home.year_built || 2000;
  const pros = [];
  const cons = [];
  let score;

  if (year >= 2020) { score = 10; pros.push(`Built ${year} — modern construction`); }
  else if (year >= 2015) { score = 8; pros.push(`Built ${year} — recent build`); }
  else if (year >= 2005) { score = 6; }
  else if (year >= 1995) { score = 4; cons.push(`Built ${year} — aging systems risk`); }
  else { score = 2; cons.push(`Built ${year} — significant age risk`); }

  return { score, max: 10, pros, cons, flags: [] };
}

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function scoreHome(home) {
  const pool = scorePool(home);
  const mustHaves = scoreMustHaves(home);
  const priceValue = scorePriceValue(home);
  const resale = scoreResale(home);
  const commute = scoreCommute(home);
  const trueCost = scoreTrueCost(home);
  const buildQuality = scoreBuildQuality(home);

  // Weighted: Must-Haves 25%, Pool 5%, Price 20%, Resale 20%, Commute 15%, True Cost 10%, Build 5%
  let overall = Math.round(
    (mustHaves.score / 10) * 25 +
    (pool.score / 10) * 5 +
    (priceValue.score / 10) * 20 +
    (resale.score / 10) * 20 +
    (commute.score / 10) * 15 +
    (trueCost.score / 10) * 10 +
    (buildQuality.score / 10) * 5
  );

  // Builder modifier (±2 pts)
  const builderMod = getBuilderModifier(home.builder);
  overall = Math.min(100, Math.max(0, overall + builderMod));

  const allPros = [...pool.pros, ...mustHaves.pros, ...priceValue.pros, ...resale.pros, ...commute.pros, ...trueCost.pros, ...buildQuality.pros];
  const allCons = [...pool.cons, ...mustHaves.cons, ...priceValue.cons, ...resale.cons, ...commute.cons, ...trueCost.cons, ...buildQuality.cons];
  const allFlags = [...pool.flags, ...mustHaves.flags, ...resale.flags, ...commute.flags];

  // Override verdict for out-of-range zips
  const zipAuto = getZipAutoScores(home.zip_code);
  let verdict;
  if (zipAuto?.outOfRange) {
    verdict = "PASS — Out of Range.";
  } else if (overall >= 80) {
    verdict = "Strong contender — make an offer.";
  } else if (overall >= 65) {
    verdict = "Solid option — worth a showing.";
  } else if (overall >= 50) {
    verdict = "Acceptable with compromises.";
  } else {
    verdict = "Below threshold — skip or negotiate hard.";
  }

  return {
    overall_score: overall,
    verdict,
    pros: allPros,
    cons: allCons,
    red_flags: allFlags,
    va_mortgage_pi: Math.round(calculateVAMortgage(home.price || 0)),
    monthly_true_cost: Math.round(calculateTrueCost(home)),
    builder_modifier: builderMod,
    pillars: {
      pool: { score: pool.score, max: 10, weight: 5, label: "Pool Rule" },
      mustHaves: { score: mustHaves.score, max: 10, weight: 25, label: "Must-Haves" },
      priceValue: { score: priceValue.score, max: 10, weight: 20, label: "Price Value" },
      resale: { score: resale.score, max: 10, weight: 20, label: "Resale Potential" },
      commute: { score: commute.score, max: 10, weight: 15, label: "Commute" },
      trueCost: { score: trueCost.score, max: 10, weight: 10, label: "True Cost" },
      buildQuality: { score: buildQuality.score, max: 10, weight: 5, label: "Build Quality" },
    }
  };
}