import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function runDeepDive(base44, homeIds) {
  const homes = await base44.asServiceRole.entities.Home.list('-created_date', 1000);
  const targets = homes.filter(h => homeIds.includes(h.id));

  for (const home of targets) {
    if (!home.address) continue;

    try {
      const rawText = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a forensic real estate analyst specializing in DFW Texas properties for 100% P&T Disabled Veterans. Your goal is to provide a comprehensive scorecard that is 2+ pages long. Research the following property thoroughly using Zillow, Redfin, county CAD records, school district ratings, and VA loan guidelines.

**CRITICAL: Extract and include the full URL of the main house photo from the Zillow or Redfin listing. This URL must be a direct image link (e.g., https://...). Include it in your report as "PHOTO_URL: [full_url_here]"**

Address: ${home.address}, ${home.city || ''} ${home.zip_code || ''}

CRITICAL RULES — NEVER violate these:
- NEVER guess, assume, fabricate, or infer any property fact (pool, bedrooms, bathrooms, sqft, HOA, PID, builder, year built, etc.)
- If a fact cannot be confirmed from a real listing source (Zillow, Redfin, MLS, CAD), mark it as "UNVERIFIED" or "Unknown"
- Do NOT say a home has a pool unless you have confirmed it from a listing photo, description, or CAD record
- Do NOT fill in missing numbers with estimates — leave them blank or mark as unconfirmed

Provide a comprehensive report covering:
1. Overview: Full Address, List Price, Year Built, Overall Score (0-100), Conditional Consideration (2-3 sentences on key features and headwinds). Do NOT mention $0 property tax or VA exemption benefits.
2. Criteria Scores (0-10 each with notes): Must-Haves Met, Price/Value, Resale Potential, Commute (to 3200 E Renner Rd and 1301 Abrams Rd Richardson TX at 7:30AM), True Cost (PID/HOA only), Build Quality/Age.
3. Pros: 5+ specific positives backed by facts.
4. Cons: 5+ specific negatives backed by facts.
5. Red Flags / Open Items: Critical issues with specific verification actions.
6. Estimated True Monthly Cost: P&I at list and offer price, HOA, PID, Home Insurance (estimate $150-250/mo), Flood Insurance (if applicable), TOTAL.
7. Flood Zone & Insurance: FEMA zone, flood risk level, insurance requirement and cost estimate.
8. Offer Framework: Opening offer, Target close, Walk-away price.
9. Utilities & Infrastructure: Internet (fiber availability?), electricity provider, water/sewer source, natural gas. Flag any concerns.
10. Footer: Subdivision, county, school district, parcel number, listing agent.

Be forensic and critical. Assume 100% P&T Disabled Veteran buyer.`,
        add_context_from_internet: true,
        model: "gemini_3_1_pro",
      });

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract structured data from this real estate research report into JSON.

REPORT:
${rawText}

IMPORTANT: Find and extract the PHOTO_URL line from the report. Extract the full URL exactly as written after "PHOTO_URL:".

Return all fields with 0 for unknown numbers, empty string for unknown strings. image_url must be the house photo URL extracted from the PHOTO_URL line in the report.`,
        response_json_schema: {
          type: "object",
          properties: {
            address: { type: "string" }, city: { type: "string" }, zip_code: { type: "string" },
            price: { type: "number" }, sqft: { type: "number" }, year_built: { type: "number" },
            bedrooms: { type: "number" }, bathrooms: { type: "number" }, has_office: { type: "boolean" },
            pool_status: { type: "string", enum: ["private", "community", "none"] }, hoa_monthly: { type: "number" }, pid_mud_annual: { type: "number" },
            pid_type: { type: "string" }, builder: { type: "string" }, school_district: { type: "string" }, image_url: { type: "string" },
            overall_score: { type: "number" }, verdict: { type: "string" }, conditional_consideration: { type: "string" },
            criteria_scores: { type: "object", properties: {
              must_haves: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              price_value: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              resale_potential: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              commute: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              true_cost: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              build_quality: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } }
            }},
            pros: { type: "array", items: { type: "string" } },
            cons: { type: "array", items: { type: "string" } },
            red_flags_open_items: { type: "array", items: { type: "string" } },
            estimated_monthly_cost: { type: "object", properties: {
              pi_list_price: { type: "string" }, pi_offer_price: { type: "string" },
              property_tax: { type: "string" }, pmi: { type: "string" }, hoa: { type: "string" },
              pid: { type: "string" }, home_insurance: { type: "string" },
              flood_insurance: { type: "string" }, total: { type: "string" }
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
              opening_offer: { type: "string" }, target_close: { type: "string" }, walk_away: { type: "string" }
            }},
            footer_details: { type: "string" }, tax_history: { type: "string" },
            price_history: { type: "string" }, dom_analysis: { type: "string" },
            market_context: { type: "string" }, analyst_note: { type: "string" },
            utilities: { type: "object", properties: {
              internet: { type: "string" }, electricity: { type: "string" },
              water_sewer: { type: "string" }, gas_heating: { type: "string" },
              concerns: { type: "string" }
            }}
          },
          required: ["address", "price"]
        }
      });

      await base44.asServiceRole.entities.Home.update(home.id, {
        builder: res.builder || home.builder || "",
        school_district: res.school_district || home.school_district || "",
        image_url: res.image_url || home.image_url || "",
        conditional_consideration: res.conditional_consideration || "",
        criteria_score_notes: {
          must_haves: res.criteria_scores?.must_haves?.notes || "",
          price_value: res.criteria_scores?.price_value?.notes || "",
          resale_potential: res.criteria_scores?.resale_potential?.notes || "",
          commute: res.criteria_scores?.commute?.notes || "",
          true_cost: res.criteria_scores?.true_cost?.notes || "",
          build_quality: res.criteria_scores?.build_quality?.notes || "",
        },
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

      // Small delay to avoid rate limiting
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

    // Use EdgeRuntime.waitUntil to keep background task alive after response
    const task = runDeepDive(base44, homeIds);

    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(task);
      return Response.json({ message: 'Deep dive started in background', count: homeIds.length });
    } else {
      // Fallback: await the task (will block but won't be killed)
      await task;
      return Response.json({ message: 'Deep dive complete', count: homeIds.length });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});