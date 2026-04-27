import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, CheckCircle, AlertCircle, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { scoreHome } from "@/lib/scoringEngine";

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

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a forensic real estate analyst specializing in DFW Texas properties. Research the following property address thoroughly using Zillow, Redfin, county CAD records, and local news sources.

Address: ${address}

Return a JSON object with EXACTLY these fields:

{
  "address": "full street address",
  "city": "city name",
  "zip_code": "5-digit zip",
  "price": current listing price as number,
  "sqft": square footage as number,
  "year_built": year as number,
  "bedrooms": number,
  "bathrooms": number (e.g. 2.5),
  "has_office": true or false,
  "pool_status": "private" or "community" or "none",
  "hoa_monthly": monthly HOA as number (0 if none),
  "pid_mud_annual": annual PID/MUD as number (0 if none),
  "pid_type": "fixed_assessment" or "ad_valorem",
  "builder": "builder name or empty string",
  "school_district": "name of school district",
  "tax_history": "Summary of last 3 years assessed values. Flag any year-over-year jump >20% with 'TAX SPIKE' prefix.",
  "price_history": "Summary of all prior sale prices with dates. Compare current ask to last sale. Note if current price is >20% above last sale.",
  "dom_analysis": "Days on market history. If listed and removed within last 12 months without selling, prefix with 'FAILED LISTING:'. Include current DOM.",
  "market_context": "2-3 sentence summary combining tax history, price history, and DOM patterns. Highlight any anomalies.",
  "analyst_note": "One paragraph analyst commentary. If current ask is significantly higher than prior sale or Zestimate with no obvious renovation justification, explicitly state estimated negotiation room as a percentage. Example: 'This property is asking $600k despite a $480k Zestimate and no recorded renovations since 2022—expect 15% negotiation room.'"
}

Be forensic and critical. Do not be optimistic. If data is unavailable for a field, say 'Data unavailable' rather than guessing.`,
      add_context_from_internet: true,
      model: "gemini_3_1_pro",
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
          pool_status: { type: "string" },
          hoa_monthly: { type: "number" },
          pid_mud_annual: { type: "number" },
          pid_type: { type: "string" },
          builder: { type: "string" },
          school_district: { type: "string" },
          tax_history: { type: "string" },
          price_history: { type: "string" },
          dom_analysis: { type: "string" },
          market_context: { type: "string" },
          analyst_note: { type: "string" }
        }
      }
    });

    setLoading(false);
    setResult(res);
  };

  const handleAddToShortlist = async () => {
    if (!result) return;
    const scored = scoreHome(result);
    const record = {
      address: result.address,
      city: result.city,
      zip_code: result.zip_code,
      price: result.price,
      sqft: result.sqft,
      year_built: result.year_built,
      bedrooms: result.bedrooms,
      bathrooms: result.bathrooms,
      has_office: result.has_office,
      pool_status: result.pool_status,
      hoa_monthly: result.hoa_monthly || 0,
      pid_mud_annual: result.pid_mud_annual || 0,
      pid_type: result.pid_type || "fixed_assessment",
      builder: result.builder || "",
      market_context: [
        result.tax_history && `TAX HISTORY: ${result.tax_history}`,
        result.price_history && `PRICE HISTORY: ${result.price_history}`,
        result.dom_analysis && `DOM: ${result.dom_analysis}`,
        result.market_context && `MARKET: ${result.market_context}`,
      ].filter(Boolean).join("\n\n"),
      analyst_note: result.analyst_note || "",
      overall_score: scored.overall_score,
      verdict: scored.verdict,
      pros: scored.pros,
      cons: scored.cons,
      red_flags: scored.red_flags,
      va_mortgage_pi: scored.va_mortgage_pi,
      monthly_true_cost: scored.monthly_true_cost,
    };

    await base44.entities.Home.create(record);
    queryClient.invalidateQueries({ queryKey: ["homes"] });
    toast.success("Added to shortlist with forensic research.");
    setResult(null);
    setAddress("");
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
          {/* Basic Data */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Extracted Data — {result.address}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
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
            </CardContent>
          </Card>

          {/* Forensic History */}
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

          {/* Analyst Note */}
          {result.analyst_note && (
            <Card className="bg-primary text-primary-foreground border-0">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Analyst Note</p>
                    <p className="text-sm leading-relaxed">{result.analyst_note}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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