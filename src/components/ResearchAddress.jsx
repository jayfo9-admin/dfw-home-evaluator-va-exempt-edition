import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, CheckCircle, AlertCircle, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { scoreHome } from "@/lib/scoringEngine";
import { normalizeHome } from "@/lib/normalizeHome";
import { sanitizeUtilities } from "@/lib/sanitizeUtilities";

export default function ResearchAddress() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const handleResearch = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    try {
    // Step 1: Web search — no JSON schema (incompatible with Search tool on Gemini)
     const rawText = await base44.integrations.Core.InvokeLLM({
       prompt: `You are a forensic real estate analyst specializing in DFW Texas properties for 100% P&T Disabled Veterans. Your goal is to provide a comprehensive scorecard that is 2+ pages long, mirroring the detail and structure of an official DFW Home Evaluator report. Research the following property address thoroughly using Zillow, Redfin, county CAD records, local news sources, school district ratings (e.g., Niche.com), FEMA flood map (msc.fema.gov), and VA loan guidelines.

    **CRITICAL: Extract and include the full URL of the main house photo from the Zillow or Redfin listing. This URL must be a direct image link (e.g., https://...). Include it in your report as "PHOTO_URL: [full_url_here]"**

    Address: ${address}

CRITICAL RULES — NEVER violate these:
- NEVER guess, assume, fabricate, or infer any property fact (pool, bedrooms, bathrooms, sqft, HOA, PID, builder, year built, etc.)
- If a fact cannot be confirmed from a real listing source (Zillow, Redfin, MLS, CAD), mark it as "UNVERIFIED" or "Unknown"
- Do NOT say a home has a pool unless you have confirmed it from a listing photo, description, or CAD record
- Do NOT fill in missing numbers with estimates — leave them blank or mark as unconfirmed

Provide a detailed research report covering ALL of the following sections and information:

1.  **Overview Header**:
    *   Full Address, List Price, Year Built, and an Overall Score (0-100, estimate if not explicit).
    *   **Conditional Consideration**: A concise, 2-3 sentence summary evaluating the home's key features (bedrooms, office, pool), benefits, and primary headwinds (commute, school district, pricing history, age-related maintenance). Do NOT mention $0 property tax or VA exemption benefits — they are given conditions.

2.  **Criteria Scores**: For each of the following categories, provide a score (0-10, with 10 being best) and brief, specific notes explaining the score:
    *   **Must-Haves Met**: Score based on bedrooms (4+), bathrooms (2.5+), dedicated office, private pool, and any other unique must-haves (e.g., first-floor primary). List each factor that contributed to the score.
    *   **Price / Value**: Score based on list price per sqft, comparison to average for zip code, recent market trends (soft/hot), and relation to average below-ask sales.
    *   **Resale Potential**: Score based on school district ratings (mentioning specific school names and their ratings), vintage/age of home, lot size, and location within subdivision.
    *   **Commute**: Score based on estimated commute times to "3200 E Renner Rd, Richardson TX" and "1301 Abrams Rd, Richardson TX" at 7:30 AM Tuesday (using Google Maps estimated times). Note if verification is needed.
    *   **True Cost (PID/HOA)**: Score based on HOA fees (annual/monthly) and PID/MUD costs. Explicitly state if PID/MUD is confirmed and its type (fixed assessment vs ad-valorem).
    *   **Build Quality / Age**: Score based on year built (preference for 2015+), notable features (solar, specific materials), and inspection-focus items (roof, HVAC, pool equipment). Mention builder if known.

3.  **Pros**: A detailed bulleted list of 5+ positive aspects of the property, backed by specific facts.

4.  **Cons**: A detailed bulleted list of 5+ negative aspects or significant drawbacks of the property, backed by specific facts.

5.  **Red Flags / Open Items**: A detailed bulleted list of critical issues or items requiring verification. For each:
    *   Identify the item (e.g., "Commute UNVERIFIED", "DCAD Record Not Confirmed", "Builder Unknown", "2018 Listing Failure", "VA Appraisal Risk").
    *   Provide a specific action to verify or investigate, including names, phone numbers, parcel numbers, or specific listing agent details if discovered during research.

6.  **Estimated True Monthly Cost**: A breakdown in a table format:
    *   Principal & Interest (VA loan, 0% down, no funding fee, 30yr, at list price).
    *   Principal & Interest at recommended opening offer.
    *   HOA (monthly and annual).
    *   PID (if applicable; $0 if ad-valorem exempt).
    *   Home Insurance (estimated monthly — use ~$150-250/mo for DFW homes in this price range, note to verify).
    *   Flood Insurance (estimated monthly if required; otherwise $0).
    *   **TOTAL (at recommended offer, including insurance)**.

7.  **Flood Zone & Insurance**:
    *   Look up this address on FEMA's flood map (msc.fema.gov) or use available flood zone data.
    *   Report the FEMA flood zone designation (Zone X = minimal risk, Zone AE/A = high risk, Zone X500 = moderate risk).
    *   State whether flood insurance is REQUIRED (lender-mandated for Zone A/AE) or RECOMMENDED.
    *   Provide an estimated monthly flood insurance cost if applicable (NFIP rates: ~$50-100/mo for Zone X500, $100-300+/mo for Zone AE).
    *   Flag if the address is near a creek, lake, retention pond, or drainage easement.

8.  **Offer Framework**:
    *   **Opening Offer**: Recommended price range and any suggested seller concessions.
    *   **Target Close**: Realistic price given market conditions.
    *   **Walk-Away**: Price point where VA appraisal risk becomes too high.

9.  **Utilities & Infrastructure**:
    *   **Internet**: What providers serve this address? Is fiber optic available (AT&T Fiber, Google Fiber, Frontier Fiber, etc.)? If only cable or DSL is available, note it prominently. If no broadband is confirmed, flag as a HARD PASS item.
    *   **Electricity**: Which retail electric provider(s) serve this zip? Is it a deregulated market (ERCOT) or fixed utility? Note the primary provider.
    *   **Water & Sewer**: Is the property on city water/sewer, a MUD district, or a private well/septic? Name the specific provider (e.g. City of Rowlett, North Texas MUD, etc.).
    *   **Natural Gas / Heating**: Is natural gas available at this address (Atmos Energy, CoServ Gas, etc.)? Or is the home all-electric? Note the heating source if known from the listing.
    *   Flag any utility concerns (no fiber, well/septic, propane-only, etc.) clearly.

10. **Footer Details**: Include subdivision name, county, school district, parcel number, and listing agent name/phone (if found).

Be forensic and critical. Do not be optimistic. Assume the user is a 100% P&T Disabled Veteran. Structure the report clearly with headings for each section.`,
      add_context_from_internet: true,
      model: "gemini_3_1_pro",
    });

    // Step 2: Parse raw text into structured JSON — no web search needed
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract structured data from the following real estate research report and return a JSON object.

REPORT:
${rawText}

IMPORTANT: Find and extract the PHOTO_URL line from the report. Extract the full URL exactly as written.

Return a JSON object with EXACTLY these fields (use 0 for unknown numbers, empty string for unknown strings, false for unknown booleans):
address, city, zip_code, price (number), sqft (number), year_built (number), bedrooms (number), bathrooms (number), has_office (boolean), pool_status ("private"|"community"|"none"), hoa_monthly (number), pid_mud_annual (number), pid_type ("fixed_assessment"|"ad_valorem"), builder (string), school_district (string), image_url (string - EXTRACT FROM PHOTO_URL line in report), overall_score (number 0-100), verdict (string), conditional_consideration (string), criteria_scores (object with must_haves/price_value/resale_potential/commute/true_cost/build_quality each having score and notes), pros (array of strings), cons (array of strings), red_flags_open_items (array of strings), estimated_monthly_cost (object), offer_framework (object), footer_details (string), tax_history (string), price_history (string), dom_analysis (string), market_context (string), analyst_note (string)`,
      response_json_schema: {
        type: "object",
        properties: {
          address: { type: "string" },
          city: { type: "string" },
          zip_code: { type: "string" },
          price: { type: "number" },
          sqft: { type: "number" },
          year_built: { type: "number" },
          bedrooms: { type: "number" },
          bathrooms: { type: "number" },
          has_office: { type: "boolean" },
          pool_status: { type: "string", enum: ["private", "community", "none"] },
          hoa_monthly: { type: "number" },
          pid_mud_annual: { type: "number" },
          pid_type: { type: "string" },
          builder: { type: "string" },
          school_district: { type: "string" },
          image_url: { type: "string" },
          overall_score: { type: "number" },
          verdict: { type: "string" },
          conditional_consideration: { type: "string" },
          criteria_scores: {
            type: "object",
            properties: {
              must_haves: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              price_value: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              resale_potential: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              commute: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              true_cost: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } },
              build_quality: { type: "object", properties: { score: { type: "number" }, notes: { type: "string" } } }
            }
          },
          pros: { type: "array", items: { type: "string" } },
          cons: { type: "array", items: { type: "string" } },
          red_flags_open_items: { type: "array", items: { type: "string" } },
          estimated_monthly_cost: {
            type: "object",
            properties: {
              pi_list_price: { type: "string" },
              pi_offer_price: { type: "string" },
              property_tax: { type: "string" },
              pmi: { type: "string" },
              hoa: { type: "string" },
              pid: { type: "string" },
              home_insurance: { type: "string" },
              flood_insurance: { type: "string" },
              total: { type: "string" }
            }
          },
          flood_info: {
            type: "object",
            properties: {
              fema_zone: { type: "string" },
              flood_risk: { type: "string", enum: ["minimal", "moderate", "high", "unknown"] },
              flood_insurance_required: { type: "boolean" },
              estimated_flood_insurance_monthly: { type: "number" },
              notes: { type: "string" }
            }
          },
          home_insurance_monthly: { type: "number" },
          offer_framework: {
            type: "object",
            properties: {
              opening_offer: { type: "string" },
              target_close: { type: "string" },
              walk_away: { type: "string" }
            }
          },
          footer_details: { type: "string" },
          tax_history: { type: "string" },
          price_history: { type: "string" },
          dom_analysis: { type: "string" },
          market_context: { type: "string" },
          analyst_note: { type: "string" },
          utilities: {
            type: "object",
            properties: {
              internet: { type: "string" },
              electricity: { type: "string" },
              water_sewer: { type: "string" },
              gas_heating: { type: "string" },
              concerns: { type: "string" }
            }
          }
        },
        required: ["address", "price"]
      }
    });

    // Step 3: Real commute times via Google Maps
    let commuteTimes = {};
    try {
      const commuteRes = await base44.functions.invoke("getCommuteTimesForAddress", { address });
      commuteTimes = commuteRes.data || {};
    } catch (e) {
      console.warn("Commute lookup failed, will save without verified times:", e);
    }

    setLoading(false);
    setResult({ ...res, _commuteTimes: commuteTimes });
    } catch (err) {
      setLoading(false);
      setError(`Research failed: ${err?.message || "Unknown error. Please try again."}`);
    }
  };

  const handleAddToShortlist = async () => {
    if (!result) return;
    try {
    const normalized = normalizeHome(result);
    const scored = scoreHome(normalized);
    const record = {
      address: normalized.address,
      city: normalized.city,
      zip_code: normalized.zip_code,
      price: normalized.price,
      sqft: normalized.sqft,
      year_built: normalized.year_built,
      bedrooms: normalized.bedrooms,
      bathrooms: normalized.bathrooms,
      has_office: normalized.has_office,
      pool_status: normalized.pool_status,
      hoa_monthly: normalized.hoa_monthly || 0,
      pid_mud_annual: normalized.pid_mud_annual || 0,
      pid_type: normalized.pid_type || "fixed_assessment",
      builder: normalized.builder || "",
      school_district: normalized.school_district || "",
      commute_collins_min: result._commuteTimes?.collins || undefined,
      commute_coram_deo_min: result._commuteTimes?.coram_deo || undefined,
      commute_dallas_christian_min: result._commuteTimes?.dallas_christian || undefined,
      commute_heritage_min: result._commuteTimes?.heritage || undefined,
      commute_mckinney_christian_min: result._commuteTimes?.mckinney_christian || undefined,
      commute_garland_christian_min: result._commuteTimes?.garland_christian || undefined,
      commute_verified: !!(result._commuteTimes?.collins),
      last_deep_dive_at: new Date().toISOString(),

      conditional_consideration: result.conditional_consideration || "",
      criteria_score_notes: {
        must_haves: result.criteria_scores?.must_haves?.notes || "",
        price_value: result.criteria_scores?.price_value?.notes || "",
        resale_potential: result.criteria_scores?.resale_potential?.notes || "",
        commute: result.criteria_scores?.commute?.notes || "",
        true_cost: result.criteria_scores?.true_cost?.notes || "",
        build_quality: result.criteria_scores?.build_quality?.notes || "",
      },
      estimated_monthly_cost: result.estimated_monthly_cost || {},
      offer_framework: result.offer_framework || {},
      utilities: sanitizeUtilities(result.utilities),
      flood_info: result.flood_info || { fema_zone: "Unknown", flood_risk: "unknown", flood_insurance_required: false, estimated_flood_insurance_monthly: 0, notes: "" },
      home_insurance_monthly: result.home_insurance_monthly || 0,
      footer_details: result.footer_details || "",
      tax_history: result.tax_history || "",
      price_history: result.price_history || "",
      dom_analysis: result.dom_analysis || "",
      market_context: [
        result.tax_history && `TAX HISTORY: ${result.tax_history}`,
        result.price_history && `PRICE HISTORY: ${result.price_history}`,
        result.dom_analysis && `DOM: ${result.dom_analysis}`,
        result.market_context && `MARKET: ${result.market_context}`,
      ].filter(Boolean).join("\n\n"),
      analyst_note: result.analyst_note || "",
      image_url: result.image_url || "",
      overall_score: scored.overall_score,
      one_line: scored.verdict,
      verdict: scored.verdict,
      scores: scored.scores,
      pros: scored.pros,
      cons: scored.cons,
      red_flags: scored.red_flags,
      va_mortgage_pi: scored.va_mortgage_pi,
      monthly_true_cost: scored.monthly_true_cost,
      monthly_cost_note: `VA P&I ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(scored.va_mortgage_pi)}/mo + HOA $${result.hoa_monthly||0}/mo + PID $${Math.round((result.pid_mud_annual||0)/12)}/mo = ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(scored.monthly_true_cost)}/mo ($0 property tax, $0 PMI)`,
    };

    await base44.entities.Home.create(record);
    queryClient.invalidateQueries({ queryKey: ["homes"] });
    toast.success("Added to shortlist with forensic research.");
    setResult(null);
    setAddress("");
    } catch (err) {
      toast.error(`Failed to add home: ${err?.message || "Unknown error"}`);
      console.error("handleAddToShortlist failed:", err);
    }
  };

  const hasWarning = (text) => text && (
    text.includes("FAILED LISTING") ||
    text.includes("TAX SPIKE") ||
    text.toUpperCase().includes("FLAG")
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-base font-semibold mb-1">Forensic Address Research</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Enter an address to pull live data from Zillow, Redfin, County CAD, and news sources.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. 1234 Elm St, Rowlett TX 75089"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleResearch()}
            className="font-body"
          />
          <Button onClick={handleResearch} disabled={!address.trim() || loading} className="shrink-0 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Researching..." : "Research"}
          </Button>
        </div>
        {loading && (
          <p className="text-xs text-muted-foreground mt-2 animate-pulse">
            Searching Zillow, Redfin, CAD records, and news... this may take 20–30 seconds.
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Overview Header */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {result.address}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm mb-3">
                {[
                  ["Price", result.price ? `$${result.price.toLocaleString()}` : "—"],
                  ["Sqft", result.sqft ? result.sqft.toLocaleString() : "—"],
                  ["Year Built", result.year_built || "—"],
                  ["Beds / Baths", `${result.bedrooms || "—"} / ${result.bathrooms || "—"}`],
                  ["Pool", result.pool_status || "—"],
                  ["School District", result.school_district || "—"],
                  ["HOA/mo", result.hoa_monthly ? `$${result.hoa_monthly}` : "$0"],
                  ["PID/yr", result.pid_mud_annual ? `$${result.pid_mud_annual}` : "$0"],
                  ["Builder", result.builder || "Unknown"],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
              </div>
              {result.overall_score > 0 && (
                <div className="flex items-center gap-3 mt-3 p-3 bg-secondary rounded-lg">
                  <div className="text-center">
                    <p className="font-heading text-3xl font-bold">{result.overall_score}<span className="text-base font-normal text-muted-foreground">/100</span></p>
                    <p className="text-xs text-muted-foreground">AI Estimate</p>
                    <p className="text-[10px] text-amber-600 font-medium">Final score calculated on add</p>
                  </div>
                  {result.verdict && <p className="text-sm font-heading font-semibold flex-1">{result.verdict}</p>}
                </div>
              )}
              {result.conditional_consideration && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Conditional Consideration</p>
                  <p className="text-sm text-amber-900">{result.conditional_consideration}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Criteria Scores */}
          {result.criteria_scores && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm">Criteria Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  ["Must-Haves Met", result.criteria_scores.must_haves],
                  ["Price / Value", result.criteria_scores.price_value],
                  ["Resale Potential", result.criteria_scores.resale_potential],
                  ["Commute", result.criteria_scores.commute],
                  ["True Cost (PID/HOA)", result.criteria_scores.true_cost],
                  ["Build Quality / Age", result.criteria_scores.build_quality],
                ].map(([label, data]) => data && (
                  <div key={label} className="border-b border-border pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{label}</span>
                      <span className={`text-sm font-bold ${data.score >= 7 ? "text-green-600" : data.score >= 5 ? "text-yellow-600" : "text-red-600"}`}>
                        {data.score}/10
                      </span>
                    </div>
                    {data.notes && <p className="text-xs text-muted-foreground">{data.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pros / Cons */}
          {(result.pros?.length > 0 || result.cons?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.pros?.length > 0 && (
                <Card className="border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-sm text-green-700">Pros</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {result.pros.map((pro, i) => (
                      <p key={i} className="text-xs flex items-start gap-1.5"><span className="text-green-500 shrink-0 mt-0.5">+</span>{pro}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
              {result.cons?.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-sm text-red-700">Cons</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {result.cons.map((con, i) => (
                      <p key={i} className="text-xs flex items-start gap-1.5"><span className="text-red-500 shrink-0 mt-0.5">–</span>{con}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Red Flags / Open Items */}
          {result.red_flags_open_items?.length > 0 && (
            <Card className="border-orange-300">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Red Flags / Open Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.red_flags_open_items.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-orange-50 rounded-md">
                    <span className="text-orange-500 shrink-0 mt-0.5">🚩</span>
                    <p className="text-xs text-orange-900">{flag}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Flood Zone */}
          {result.flood_info && (
            <Card className={result.flood_info.flood_risk === "high" ? "border-red-400" : result.flood_info.flood_risk === "moderate" ? "border-orange-300" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm flex items-center gap-2">
                  🌊 Flood Zone & Insurance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {[
                  ["FEMA Zone", result.flood_info.fema_zone || "Unknown"],
                  ["Flood Risk", result.flood_info.flood_risk || "unknown"],
                  ["Insurance Required", result.flood_info.flood_insurance_required ? "YES — lender-mandated" : "Not required"],
                  ["Est. Flood Insurance/mo", result.flood_info.estimated_flood_insurance_monthly > 0 ? `$${result.flood_info.estimated_flood_insurance_monthly}/mo` : "$0 (minimal risk)"],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${label === "Insurance Required" && result.flood_info.flood_insurance_required ? "text-red-600" : ""}`}>{val}</span>
                  </div>
                ))}
                {result.flood_info.notes && (
                  <p className="text-xs text-muted-foreground pt-1">{result.flood_info.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Utilities */}
          {result.utilities && (
            <Card className={result.utilities.concerns ? "border-orange-300" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm">Utilities & Infrastructure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {[
                  ["Internet / Fiber", result.utilities.internet],
                  ["Electricity", result.utilities.electricity],
                  ["Water & Sewer", result.utilities.water_sewer],
                  ["Gas / Heating", result.utilities.gas_heating],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-right max-w-[60%]">{val}</span>
                  </div>
                ))}
                {result.utilities.concerns && (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                    <p className="text-xs font-semibold text-orange-700 mb-0.5">⚠️ Utility Concerns</p>
                    <p className="text-xs text-orange-900">{result.utilities.concerns}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Forensic History */}
          {(result.tax_history || result.price_history || result.dom_analysis || result.market_context) && (
            <Card className={hasWarning(result.tax_history) || hasWarning(result.price_history) || hasWarning(result.dom_analysis) ? "border-orange-300" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Forensic History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <ForensicRow label="Tax History" text={result.tax_history} />
                <ForensicRow label="Price / Sale History" text={result.price_history} />
                <ForensicRow label="Days on Market" text={result.dom_analysis} />
                {result.market_context && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Market Context</p>
                    <p className="text-sm">{result.market_context}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Estimated Monthly Cost */}
          {result.estimated_monthly_cost && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm">Estimated True Monthly Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {[
                    ["P&I (at list price)", result.estimated_monthly_cost.pi_list_price],
                    ["P&I (at offer price)", result.estimated_monthly_cost.pi_offer_price],
                    ["Property Tax", result.estimated_monthly_cost.property_tax],
                    ["PMI", result.estimated_monthly_cost.pmi],
                    ["HOA", result.estimated_monthly_cost.hoa],
                    ["PID", result.estimated_monthly_cost.pid],
                    ["Home Insurance", result.estimated_monthly_cost.home_insurance],
                    ["Flood Insurance", result.estimated_monthly_cost.flood_insurance],
                  ].filter(([, val]) => val).map(([label, val]) => (
                    <div key={label} className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{val}</span>
                    </div>
                  ))}
                  {result.estimated_monthly_cost.total && (
                    <div className="flex justify-between py-2 font-bold text-accent">
                      <span>TOTAL (at offer)</span>
                      <span>{result.estimated_monthly_cost.total}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Offer Framework */}
          {result.offer_framework && (
            <Card className="bg-primary text-primary-foreground border-0">
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-sm opacity-80">Offer Framework</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  ["Opening Offer", result.offer_framework.opening_offer],
                  ["Target Close", result.offer_framework.target_close],
                  ["Walk-Away", result.offer_framework.walk_away],
                ].filter(([, val]) => val).map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm border-b border-white/20 pb-2 last:border-0">
                    <span className="opacity-70">{label}</span>
                    <span className="font-semibold">{val}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Analyst Note */}
          {result.analyst_note && (
            <Card className="border-slate-300 bg-slate-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Analyst Note</p>
                    <p className="text-sm leading-relaxed text-slate-800">{result.analyst_note}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          {result.footer_details && (
            <p className="text-xs text-muted-foreground text-center border-t border-border pt-3">{result.footer_details}</p>
          )}

          <Button onClick={handleAddToShortlist} className="w-full gap-2">
            <CheckCircle className="w-4 h-4" />
            Add to Shortlist with Research
          </Button>
        </div>
      )}
    </div>
  );
}

function ForensicRow({ label, text }) {
  if (!text) return null;
  const isWarning = text.includes("FAILED LISTING") || text.includes("TAX SPIKE");
  return (
    <div className={`rounded-md p-2 ${isWarning ? "bg-orange-50 border border-orange-200" : "bg-secondary"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isWarning ? "text-orange-700" : "text-muted-foreground"}`}>
        {isWarning && "⚠️ "}{label}
      </p>
      <p className={`text-sm ${isWarning ? "text-orange-900" : ""}`}>{text}</p>
    </div>
  );
}