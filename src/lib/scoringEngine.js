// DFW Home Evaluator Scoring Engine
// Weighted rubric: Must-Haves 30%, Price Value 20%, Resale 20%, Commute 15%, True Cost 10%, Build Quality 5%

const VA_RATE = 0.065; // 6.5% VA rate assumption
const VA_TERM_MONTHS = 360; // 30-year fixed

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
  return pi + hoa + pidMonthly;
}

function scoreMustHaves(home) {
  let score = 0;
  const max = 10;
  const pros = [];
  const cons = [];
  const flags = [];

  // Bedrooms: 4+ required
  if ((home.bedrooms || 0) >= 4) {
    score += 3;
    pros.push(`${home.bedrooms} bedrooms meets 4+ requirement`);
  } else {
    cons.push(`Only ${home.bedrooms || 0} bedrooms — need 4+`);
    flags.push("Insufficient bedrooms");
  }

  // Bathrooms: 2.5+ required
  if ((home.bathrooms || 0) >= 2.5) {
    score += 2.5;
    pros.push(`${home.bathrooms} baths meets 2.5+ requirement`);
  } else {
    score += 0.5;
    cons.push(`Only ${home.bathrooms || 0} baths — need 2.5+`);
  }

  // Office
  if (home.has_office) {
    score += 1.5;
    pros.push("Dedicated office/study");
  } else {
    cons.push("No dedicated office space");
  }

  // Pool rule
  if (home.pool_status === "private") {
    score += 3;
    pros.push("Private pool — major lifestyle win");
  } else if (home.pool_status === "community") {
    score += 1.5;
    pros.push("Community pool available");
  } else {
    // No pool
    if ((home.price || 0) > 500000) {
      score += 0;
      cons.push("No pool at premium price point");
      flags.push("No pool above $500k — poor value");
    } else {
      score += 1;
    }
  }

  return { score: Math.min(score, max), max, pros, cons, flags };
}

function scorePriceValue(home) {
  const price = home.price || 0;
  let score;
  const pros = [];
  const cons = [];

  if (price < 500000) {
    score = 10;
    pros.push(`Under $500k — excellent value`);
  } else if (price <= 600000) {
    score = 8;
    pros.push("$500–600k range — good value");
  } else if (price <= 700000) {
    score = 5;
    cons.push("$600–700k — stretching budget");
  } else {
    score = 0;
    cons.push("Over $700k — above target budget");
  }

  return { score, max: 10, pros, cons, flags: [] };
}

function scoreResale(home) {
  const score = Math.min(Math.max(home.resale_score || 0, 0), 10);
  const pros = [];
  const cons = [];

  if (score >= 8) pros.push("Strong resale potential (top school district)");
  else if (score >= 6) pros.push("Good resale potential");
  else if (score >= 4) cons.push("Average resale potential");
  else cons.push("Weak resale potential — limited appreciation");

  return { score, max: 10, pros, cons, flags: [] };
}

function scoreCommute(home) {
  let score = 0;
  const max = 10;
  const pros = [];
  const cons = [];
  const flags = [];

  const collins = home.commute_collins_min || 45;
  const coram = home.commute_coram_deo_min || 45;

  // Collins Aerospace
  if (collins <= 20) { score += 5; pros.push(`${collins} min to Collins Aerospace — short commute`); }
  else if (collins <= 30) { score += 4; pros.push(`${collins} min to Collins Aerospace — acceptable`); }
  else if (collins <= 40) { score += 2; cons.push(`${collins} min to Collins Aerospace — long`); }
  else { score += 0; cons.push(`${collins} min to Collins Aerospace — too far`); flags.push("Collins commute exceeds 40 min"); }

  // Coram Deo Academy
  if (coram <= 20) { score += 5; pros.push(`${coram} min to Coram Deo — short commute`); }
  else if (coram <= 30) { score += 4; pros.push(`${coram} min to Coram Deo — acceptable`); }
  else if (coram <= 40) { score += 2; cons.push(`${coram} min to Coram Deo — long`); }
  else { score += 0; cons.push(`${coram} min to Coram Deo — too far`); flags.push("Coram Deo commute exceeds 40 min"); }

  return { score: Math.min(score, max), max, pros, cons, flags };
}

function scoreTrueCost(home) {
  const trueCost = calculateTrueCost(home);
  let score;
  const pros = [];
  const cons = [];

  if (trueCost < 2500) { score = 10; pros.push(`$${Math.round(trueCost)}/mo — very affordable`); }
  else if (trueCost < 3000) { score = 8; pros.push(`$${Math.round(trueCost)}/mo — manageable`); }
  else if (trueCost < 3500) { score = 6; cons.push(`$${Math.round(trueCost)}/mo — moderate`); }
  else if (trueCost < 4000) { score = 4; cons.push(`$${Math.round(trueCost)}/mo — stretching`); }
  else if (trueCost < 4500) { score = 2; cons.push(`$${Math.round(trueCost)}/mo — heavy`); }
  else { score = 0; cons.push(`$${Math.round(trueCost)}/mo — too expensive`); }

  return { score, max: 10, pros, cons, flags: [] };
}

function scoreBuildQuality(home) {
  const year = home.year_built || 2000;
  let score;
  const pros = [];
  const cons = [];

  if (year >= 2020) { score = 10; pros.push(`Built ${year} — modern construction`); }
  else if (year >= 2015) { score = 8; pros.push(`Built ${year} — recent build`); }
  else if (year >= 2005) { score = 6; }
  else if (year >= 1995) { score = 4; cons.push(`Built ${year} — aging systems likely`); }
  else { score = 2; cons.push(`Built ${year} — may need major updates`); }

  return { score, max: 10, pros, cons, flags: [] };
}

export function scoreHome(home) {
  const mustHaves = scoreMustHaves(home);
  const priceValue = scorePriceValue(home);
  const resale = scoreResale(home);
  const commute = scoreCommute(home);
  const trueCost = scoreTrueCost(home);
  const buildQuality = scoreBuildQuality(home);

  // Weighted score: Must-Haves 30%, Price 20%, Resale 20%, Commute 15%, True Cost 10%, Build 5%
  const overall = Math.round(
    (mustHaves.score / mustHaves.max) * 30 +
    (priceValue.score / priceValue.max) * 20 +
    (resale.score / resale.max) * 20 +
    (commute.score / commute.max) * 15 +
    (trueCost.score / trueCost.max) * 10 +
    (buildQuality.score / buildQuality.max) * 5
  );

  const allPros = [...mustHaves.pros, ...priceValue.pros, ...resale.pros, ...commute.pros, ...trueCost.pros, ...buildQuality.pros];
  const allCons = [...mustHaves.cons, ...priceValue.cons, ...resale.cons, ...commute.cons, ...trueCost.cons, ...buildQuality.cons];
  const allFlags = [...mustHaves.flags, ...priceValue.flags, ...resale.flags, ...commute.flags, ...trueCost.flags, ...buildQuality.flags];

  let verdict;
  if (overall >= 80) verdict = "Strong contender — make an offer.";
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
      mustHaves: { score: mustHaves.score, max: mustHaves.max, weight: 30 },
      priceValue: { score: priceValue.score, max: priceValue.max, weight: 20 },
      resale: { score: resale.score, max: resale.max, weight: 20 },
      commute: { score: commute.score, max: commute.max, weight: 15 },
      trueCost: { score: trueCost.score, max: trueCost.max, weight: 10 },
      buildQuality: { score: buildQuality.score, max: buildQuality.max, weight: 5 },
    }
  };
}