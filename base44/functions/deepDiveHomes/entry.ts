import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function runDeepDive(base44, homeIds) {
  const homes = await base44.asServiceRole.entities.Home.list('-created_date', 1000);
  const targets = homes.filter(h => homeIds.includes(h.id));

  for (const home of targets) {
    if (!home.address) continue;

    try {
      const rawText = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a forensic real estate analyst and buyer's agent specializing in DFW Texas properties for a 100% P&T Disabled Veteran family of 5. Research the following property thoroughly using Zillow, Redfin, county CAD records, school district ratings, FEMA flood maps, and neighborhood data.

Address: ${home.address}, ${home.city || ''} ${home.zip_code || ''}

CRITICAL RULES — NEVER violate these:
- NEVER guess, assume, fabricate, or infer any property fact (pool, bedrooms, bathrooms, sqft, HOA, PID, builder, year built, etc.)
- If a fact cannot be confirmed from a real listing source (Zillow, Redfin, MLS, CAD), mark it as "UNVERIFIED" or "Unknown"
- Do NOT say a home has a pool unless confirmed from a listing photo, description, or CAD record
- Do NOT fill in missing numbers with estimates — leave them blank or mark as unconfirmed
- Do NOT mention $0 property tax or VA exemption benefits

Provide a comprehensive forensic report covering ALL of the following:

1. PROPERTY FACTS: Confirm or flag: address, city, zip, list price, sqft, year built, bedrooms, bathrooms, builder, subdivision, school district, HOA monthly, PID/MUD annual assessment (and whether it's ad valorem or fixed), pool (private/community/none), has a dedicated office/study.

2. SCHOOL DISTRICT QUALITY: Rate the ISD (GreatSchools score, TEA rating, notable schools serving this address). Flag any boundary changes or redistricting risks.

3. NEIGHBORHOOD & RESALE ANALYSIS: What is the zip code's resale trajectory? Is it appreciating, flat, or declining? What is the typical DOM? Are there comparable sales supporting the list price? Any oversupply or builder competition risk? Crime index, proximity to commercial/industrial zones, HOA enforcement reputation.

4. PRICE & TAX HISTORY: List all prior sale dates and prices. List assessed value history from CAD. Flag any rapid appreciation or suspicious pricing.

5. FLOOD ZONE: FEMA flood zone designation (Zone X, AE, A, etc.), flood risk level, whether flood insurance is required, estimated monthly flood insurance cost.

6. ESTIMATED TRUE MONTHLY COST: P&I at list price (assume 30yr VA loan ~6.9%), HOA, PID/12, home insurance estimate ($150-250/mo), flood insurance if applicable. Show TOTAL.

7. OFFER FRAMEWORK: Opening offer price, target close price, walk-away price — based on DOM, comp analysis, and list price history.

8. UTILITIES & INFRASTRUCTURE: Internet provider and fiber availability, electricity provider, water/sewer (municipal or well/septic), natural gas availability. Flag any concerns.

9. RED FLAGS & OPEN ITEMS: List every critical issue requiring verification before offer — structural concerns, litigation, MUD/PID risks, builder defect history, proximity issues.

10. CONDITIONAL CONSIDERATION: 2-3 sentence summary of the property's key strengths and headwinds for this specific buyer.

11. FOOTER: Subdivision name, county, parcel number, listing agent/brokerage if available.

Be forensic, specific, and critical. Think like a buyer's agent protecting a veteran family's largest financial decision.`,
        add_context_from_internet: true,
        model: "gemini_3_1_pro",
      });

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract structured data from this real estate research report into JSON. Return all fields with 0 for unknown numbers, empty string for unknown strings.

REPORT:
${rawText}`,
        response_json_schema: {
          type: "object",
          properties: {
            builder: { type: "string" },
            school_district: { type: "string" },
            conditional_consideration: { type: "string" },
            criteria_score_notes: { type: "object", properties: {
              must_haves: { type: "string" },
              price_value: { type: "string" },
              resale_potential: { type: "string" },
              commute: { type: "string" },
              true_cost: { type: "string" },
              build_quality: { type: "string" }
            }},
            estimated_monthly_cost: { type: "object", properties: {
              pi_list_price: { type: "string" },
              pi_offer_price: { type: "string" },
              property_tax: { type: "string" },
              pmi: { type: "string" },
              hoa: { type: "string" },
              pid: { type: "string" },
              home_insurance: { type: "string" },
              flood_insurance: { type: "string" },
              total: { type: "string" }
            }},
            flood_info: { type: "object", properties: {
              fema_zone: { type: "string" },
              flood_risk: { type: "string", enum: ["minimal", "moderate", "high", "unknown"] },
              flood_insurance_required: { type: "boolean" },
              estimated_flood_insurance_monthly: { type: "number" },
              notes: { type: "string" }
            }},
            home_insurance_monthly: { type: "number" },
            offer_framework: { type: "object", properties: {
              opening_offer: { type: "string" },
              target_close: { type: "string" },
              walk_away: { type: "string" }
            }},
            utilities: { type: "object", properties: {
              internet: { type: "string" },
              electricity: { type: "string" },
              water_sewer: { type: "string" },
              gas_heating: { type: "string" },
              concerns: { type: "string" }
            }},
            footer_details: { type: "string" },
            tax_history: { type: "string" },
            price_history: { type: "string" },
            dom_analysis: { type: "string" },
            market_context: { type: "string" },
            analyst_note: { type: "string" }
          },
          required: ["builder"]
        }
      });

      await base44.asServiceRole.entities.Home.update(home.id, {
        builder: res.builder || home.builder || "",
        school_district: res.school_district || home.school_district || "",
        conditional_consideration: res.conditional_consideration || "",
        criteria_score_notes: res.criteria_score_notes || {},
        estimated_monthly_cost: res.estimated_monthly_cost || {},
        offer_framework: res.offer_framework || {},
        utilities: res.utilities || {},
        flood_info: res.flood_info || { fema_zone: "Unknown", flood_risk: "unknown", flood_insurance_required: false, estimated_flood_insurance_monthly: 0, notes: "" },
        home_insurance_monthly: res.home_insurance_monthly || 0,
        footer_details: res.footer_details || "",
        tax_history: res.tax_history || "",
        price_history: res.price_history || "",
        dom_analysis: res.dom_analysis || "",
        market_context: [
          res.tax_history && `TAX HISTORY: ${res.tax_history}`,
          res.price_history && `PRICE HISTORY: ${res.price_history}`,
          res.dom_analysis && `DOM: ${res.dom_analysis}`,
          res.market_context && `MARKET: ${res.market_context}`,
        ].filter(Boolean).join("\n\n"),
        analyst_note: res.analyst_note || "",
        last_deep_dive_at: new Date().toISOString(),
      });

      console.log(`Deep dive complete for: ${home.address}`);
      await new Promise(r => setTimeout(r, 1500));
    } catch (homeErr) {
      console.error(`Deep dive failed for ${home.address}:`, homeErr.message);
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { homeIds } = await req.json();
    if (!Array.isArray(homeIds) || homeIds.length === 0) {
      return Response.json({ error: 'No homes specified' }, { status: 400 });
    }

    const task = runDeepDive(base44, homeIds);

    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(task);
      return Response.json({ message: 'Deep dive started in background', count: homeIds.length });
    } else {
      await task;
      return Response.json({ message: 'Deep dive complete', count: homeIds.length });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});