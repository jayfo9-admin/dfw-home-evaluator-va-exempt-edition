import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, CheckCircle, AlertCircle, Loader2, FileJson, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { scoreHome } from "@/lib/scoringEngine";
import ResearchAddress from "@/components/ResearchAddress";

// AI sometimes returns utility fields as {type, provider} objects instead of strings — flatten them
function sanitizeUtilities(u) {
  const toStr = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.provider || v.value || v.description || v.availability || JSON.stringify(v);
    return String(v);
  };
  return {
    internet: toStr(u?.internet),
    electricity: toStr(u?.electricity),
    water_sewer: toStr(u?.water_sewer),
    gas_heating: toStr(u?.gas_heating),
    concerns: toStr(u?.concerns),
  };
}

const SAMPLE_JSON = `[
  {"address": "8613 Lake Arrowhead Trl", "city": "McKinney", "zip_code": "75070", "price": 600000, "sqft": 2693, "year_built": 2019, "bedrooms": 4, "bathrooms": 3, "has_office": true, "pool_status": "private", "hoa_monthly": 80, "pid_mud_annual": 0, "pid_type": "fixed_assessment", "builder": "Meritage"},
  {"address": "9702 October Glory Ln", "city": "Rowlett", "zip_code": "75089", "price": 625000, "sqft": 3466, "year_built": 2002, "bedrooms": 4, "bathrooms": 3.5, "has_office": true, "pool_status": "private", "hoa_monthly": 95, "pid_mud_annual": 0, "pid_type": "fixed_assessment"},
  {"address": "7705 Chapman Cir", "city": "Rowlett", "zip_code": "75088", "price": 615000, "sqft": 2753, "year_built": 2021, "bedrooms": 4, "bathrooms": 3, "has_office": true, "pool_status": "private", "hoa_monthly": 70, "pid_mud_annual": 0, "pid_type": "fixed_assessment"},
  {"address": "7517 Silverthorn Dr", "city": "Rowlett", "zip_code": "75089", "price": 550000, "sqft": 4095, "year_built": 1994, "bedrooms": 4, "bathrooms": 3, "has_office": false, "pool_status": "private", "hoa_monthly": 45, "pid_mud_annual": 0, "pid_type": "fixed_assessment"},
  {"address": "3410 Juniper Ct", "city": "Rowlett", "zip_code": "75089", "price": 599000, "sqft": 3200, "year_built": 1991, "bedrooms": 4, "bathrooms": 3, "has_office": false, "pool_status": "private", "hoa_monthly": 50, "pid_mud_annual": 0, "pid_type": "fixed_assessment"},
  {"address": "324 Shady Timbers Ln", "city": "Murphy", "zip_code": "75094", "price": 525000, "sqft": 2655, "year_built": 1995, "bedrooms": 4, "bathrooms": 2.5, "has_office": false, "pool_status": "private", "hoa_monthly": 60, "pid_mud_annual": 0, "pid_type": "fixed_assessment"},
  {"address": "2109 Swanmore Way", "city": "Forney", "zip_code": "75126", "price": 529000, "sqft": 3333, "year_built": 2020, "bedrooms": 4, "bathrooms": 3, "has_office": true, "pool_status": "private", "hoa_monthly": 55, "pid_mud_annual": 1800, "pid_type": "fixed_assessment", "builder": "Perry"}
]`;

export default function Sync() {
  const [tab, setTab] = useState("research");
  const [jsonInput, setJsonInput] = useState("");
  const [status, setStatus] = useState(null);
  const [resultMsg, setResultMsg] = useState("");
  const [selectedHomes, setSelectedHomes] = useState([]);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [deepDiveStatus, setDeepDiveStatus] = useState(null);
  const [deepDiveMsg, setDeepDiveMsg] = useState("");
  const queryClient = useQueryClient();

  const { data: allHomes = [] } = useQuery({
    queryKey: ["homes"],
    queryFn: () => base44.entities.Home.list("-created_date", 100),
  });

  const toggleHome = (id) => {
    setSelectedHomes(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeepDiveRefresh = async () => {
    const targets = allHomes.filter(h => selectedHomes.includes(h.id));
    setIsDeepDiveLoading(true);
    setDeepDiveStatus(null);
    setDeepDiveMsg("");
    let ok = 0, fail = 0;
    try {

    for (const home of targets) {
      try {
      const rawText = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a forensic real estate analyst specializing in DFW Texas properties for 100% P&T Disabled Veterans. Research the following property thoroughly using Zillow, Redfin, county CAD records, school district ratings, and VA loan guidelines.

Address: ${home.address}, ${home.city} ${home.zip_code}

CRITICAL RULES — NEVER violate these:
- NEVER guess, assume, fabricate, or infer any property fact (pool, bedrooms, bathrooms, sqft, HOA, PID, builder, year built, etc.)
- If a fact cannot be confirmed from a real listing source (Zillow, Redfin, MLS, CAD), mark it as "UNVERIFIED" or "Unknown"
- Do NOT say a home has a pool unless you have confirmed it from a listing photo, description, or CAD record
- Do NOT fill in missing numbers with estimates — leave them blank or mark as unconfirmed

Provide a comprehensive report covering:
1. Overview: Full Address, List Price, Year Built, Overall Score (0-100), Conditional Consideration (2-3 sentences on key features and headwinds).
2. Criteria Scores (0-10 each with notes): Must-Haves Met, Price/Value, Resale Potential, Commute (to 3200 E Renner Rd and 1301 Abrams Rd Richardson TX at 7:30AM), True Cost (PID/HOA), Build Quality/Age.
3. Pros: 5+ specific positives backed by facts.
4. Cons: 5+ specific negatives backed by facts.
5. Red Flags / Open Items: Critical issues with specific verification actions.
6. Estimated True Monthly Cost: P&I at list and offer price (VA loan 0% down, no funding fee), $0 property tax, $0 PMI, HOA, PID, Home Insurance (estimate $150-250/mo for DFW homes this price range), Flood Insurance (if applicable — $0 if Zone X, otherwise estimate), TOTAL including insurance.
7. Flood Zone & Insurance: Look up FEMA flood zone (msc.fema.gov). Report FEMA zone (X=minimal, AE/A=high, X500=moderate). State if flood insurance is REQUIRED or recommended. Estimate monthly flood insurance cost. Note any nearby creeks, ponds, or drainage easements.
8. Offer Framework: Opening offer, Target close, Walk-away price.
9. Utilities & Infrastructure: Internet providers (is fiber available? AT&T Fiber, Google Fiber, Frontier?), electricity provider (ERCOT deregulated or fixed?), water/sewer source (city, MUD, well/septic — name the provider), natural gas availability (Atmos, CoServ, or all-electric?). Flag any utility concerns prominently — no fiber would be a hard pass.
10. Footer: Subdivision, county, school district, parcel number, listing agent.

Be forensic and critical. Assume 100% P&T Disabled Veteran buyer.`,
        add_context_from_internet: true,
        model: "gemini_3_1_pro",
      });

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract structured data from this real estate research report into JSON.\n\nREPORT:\n${rawText}\n\nReturn all fields with 0 for unknown numbers, empty string for unknown strings.`,
        response_json_schema: {
          type: "object",
          properties: {
            address: { type: "string" }, city: { type: "string" }, zip_code: { type: "string" },
            price: { type: "number" }, sqft: { type: "number" }, year_built: { type: "number" },
            bedrooms: { type: "number" }, bathrooms: { type: "number" }, has_office: { type: "boolean" },
            pool_status: { type: "string", enum: ["private", "community", "none"] }, hoa_monthly: { type: "number" }, pid_mud_annual: { type: "number" },
            pid_type: { type: "string" }, builder: { type: "string" }, school_district: { type: "string" },
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

      // Merge: preserve original verified property facts, only update research/analysis fields
      const mergedForScoring = {
        ...home,
        // Only update price/sqft/year_built/beds/baths from research if they were 0/missing on original
        price: home.price || res.price,
        sqft: home.sqft || res.sqft,
        year_built: home.year_built || res.year_built,
        bedrooms: home.bedrooms || res.bedrooms,
        bathrooms: home.bathrooms || res.bathrooms,
        // NEVER overwrite pool_status, has_office, hoa_monthly, pid_mud_annual, pid_type from AI — keep originals
        pool_status: home.pool_status,
        has_office: home.has_office,
        hoa_monthly: home.hoa_monthly,
        pid_mud_annual: home.pid_mud_annual,
        pid_type: home.pid_type,
      };
      const scored = scoreHome(mergedForScoring);
      await base44.entities.Home.update(home.id, {
        // Only update research/analysis fields — never overwrite verified property facts
        builder: res.builder || home.builder || "",
        school_district: res.school_district || home.school_district || "",
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
        utilities: sanitizeUtilities(res.utilities),
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
        overall_score: scored.overall_score,
        verdict: scored.verdict,
        one_line: scored.verdict,
        pros: scored.pros,
        cons: scored.cons,
        red_flags: scored.red_flags,
        va_mortgage_pi: scored.va_mortgage_pi,
        monthly_true_cost: scored.monthly_true_cost,
      });
        ok++;
      } catch (homeErr) {
        fail++;
        console.error(`Deep dive failed for ${home.address}:`, homeErr);
        toast.error(`Skipped ${home.address?.split(",")[0]} — ${homeErr?.message?.slice(0,60)}`);
      }
    }

      queryClient.invalidateQueries({ queryKey: ["homes"] });
      const skipMsg = fail > 0 ? ` (${fail} skipped due to errors)` : "";
      setDeepDiveStatus(fail > 0 && ok === 0 ? "error" : "success");
      setDeepDiveMsg(`Deep dive complete: ${ok} home${ok !== 1 ? "s" : ""} refreshed${skipMsg}.`);
      setSelectedHomes([]);
      toast.success(`${ok} refreshed${skipMsg}`);
    } catch (e) {
      console.error("Deep dive failed:", e);
      setDeepDiveStatus("error");
      setDeepDiveMsg(`Error: ${e?.message || "Something went wrong. Check console."}`);
      toast.error("Deep dive failed — see error below.");
    } finally {
      setIsDeepDiveLoading(false);
    }
  };

  const handleSync = async () => {
    setStatus("loading");
    setResultMsg("");

    let parsed;
    try {
      parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) parsed = [parsed];
    } catch {
      setStatus("error");
      setResultMsg("Invalid JSON. Please check the format and try again.");
      return;
    }

    let created = 0;
    let errors = 0;

    for (const entry of parsed) {
      const scored = scoreHome(entry);
      const record = {
        ...entry,
        overall_score: scored.overall_score,
        verdict: scored.verdict,
        pros: scored.pros,
        cons: scored.cons,
        red_flags: scored.red_flags,
        va_mortgage_pi: scored.va_mortgage_pi,
        monthly_true_cost: scored.monthly_true_cost,
      };

      try {
        await base44.entities.Home.create(record);
        created++;
      } catch (e) {
        errors++;
        console.error("Failed to create home:", e);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["homes"] });

    if (errors === 0) {
      setStatus("success");
      setResultMsg(`Successfully synced ${created} home${created !== 1 ? "s" : ""}.`);
      setJsonInput("");
      toast.success(`${created} home(s) added to your shortlist.`);
    } else {
      setStatus("error");
      setResultMsg(`${created} created, ${errors} failed. Check console for details.`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Upload className="w-6 h-6" />
          Add Homes
        </h2>
        <p className="text-sm text-muted-foreground">
          Research an address with live web data, or paste JSON manually.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-5">
        <button
          onClick={() => setTab("research")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tab === "research" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Search className="w-4 h-4" /> Research Address
        </button>
        <button
          onClick={() => setTab("json")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tab === "json" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <FileJson className="w-4 h-4" /> Paste JSON
        </button>
        <button
          onClick={() => setTab("deepDive")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tab === "deepDive" ? "bg-destructive text-destructive-foreground shadow" : "text-destructive/70 hover:text-destructive"}`}
        >
          <Zap className="w-4 h-4" /> Deep Dive Refresh
        </button>
      </div>

      {tab === "research" && (
        <Card>
          <CardContent className="pt-5">
            <ResearchAddress />
          </CardContent>
        </Card>
      )}

      {tab === "json" && <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <FileJson className="w-4 h-4" />
            JSON Input
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste your JSON here..."
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="font-mono text-sm min-h-[240px]"
          />

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setJsonInput(SAMPLE_JSON)}
            >
              Load Sample
            </Button>
            <Button
              onClick={handleSync}
              disabled={!jsonInput.trim() || status === "loading"}
              className="gap-2"
            >
              {status === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Sync to Shortlist
            </Button>
          </div>

          {/* Status message */}
          {status && status !== "loading" && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                status === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {status === "success" ? (
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{resultMsg}</span>
            </div>
          )}
        </CardContent>
      </Card>}

      {tab === "deepDive" && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base flex items-center gap-2 text-destructive">
              <Zap className="w-4 h-4" />
              Extensive Deep Dive Refresh
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Select homes to re-run full AI forensic research with live web data. Uses integration credits per home.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {allHomes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No homes in your shortlist yet.</p>
            ) : (
              <div className="space-y-2">
                {allHomes.map(home => (
                  <div key={home.id} className="flex items-center gap-3 p-2.5 rounded-md bg-secondary">
                    <Checkbox
                      id={`dd-${home.id}`}
                      checked={selectedHomes.includes(home.id)}
                      onCheckedChange={() => toggleHome(home.id)}
                    />
                    <label htmlFor={`dd-${home.id}`} className="flex-1 text-sm font-medium cursor-pointer">
                      {home.address}{home.city ? `, ${home.city}` : ""}{home.zip_code ? ` ${home.zip_code}` : ""}
                    </label>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleDeepDiveRefresh}
              disabled={selectedHomes.length === 0 || isDeepDiveLoading}
              className="w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeepDiveLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Researching... this may take a while</>
                : <><Zap className="w-4 h-4" /> Deep Dive Refresh ({selectedHomes.length} selected)</>
              }
            </Button>

            {deepDiveStatus && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${deepDiveStatus === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                {deepDiveStatus === "success"
                  ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                }
                <span>{deepDiveMsg}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schema reference */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Field Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {[
              ["address", "string (required)"],
              ["city", "string"],
              ["zip_code", "string — drives auto-scoring"],
              ["price", "number (required)"],
              ["sqft", "number"],
              ["year_built", "number"],
              ["bedrooms", "number"],
              ["bathrooms", "number (e.g. 2.5)"],
              ["has_office", "boolean"],
              ["pool_status", '"private" | "community" | "none"'],
              ["hoa_monthly", "number"],
              ["pid_mud_annual", "number/yr"],
              ["pid_type", '"ad_valorem" (exempt) | "fixed_assessment"'],
              ["builder", "Perry/Meritage/Landon = +2pts"],
              ["resale_score", "0–10 (overridden by zip tier)"],
              ["commute_collins_min", "minutes (overridden by zip tier)"],
              ["commute_coram_deo_min", "minutes (overridden by zip tier)"],
            ].map(([field, type]) => (
              <div key={field} className="flex justify-between py-1 border-b border-border">
                <code className="text-xs font-mono font-medium">{field}</code>
                <span className="text-xs text-muted-foreground">{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}