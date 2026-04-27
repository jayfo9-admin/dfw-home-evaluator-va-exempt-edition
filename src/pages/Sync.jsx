import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle, Loader2, FileJson } from "lucide-react";
import { toast } from "sonner";
import { scoreHome, calculateVAMortgage, calculateTrueCost } from "@/lib/scoringEngine";

const SAMPLE_JSON = `[
  {"address": "8613 Lake Arrowhead Trl", "city": "McKinney", "zip_code": "75070", "price": 600000, "sqft": 3100, "year_built": 2021, "bedrooms": 4, "bathrooms": 3, "has_office": true, "pool_status": "private", "hoa_monthly": 80, "pid_mud_annual": 0, "builder": "Meritage"},
  {"address": "9702 October Glory Ln", "city": "Rowlett", "zip_code": "75089", "price": 625000, "sqft": 3300, "year_built": 2023, "bedrooms": 5, "bathrooms": 4, "has_office": true, "pool_status": "none", "hoa_monthly": 95, "pid_mud_annual": 1200},
  {"address": "7705 Chapman Cir", "city": "Rowlett", "zip_code": "75088", "price": 615000, "sqft": 3050, "year_built": 2024, "bedrooms": 4, "bathrooms": 3.5, "has_office": true, "pool_status": "community", "hoa_monthly": 70, "pid_mud_annual": 0},
  {"address": "7517 Silverthorn Dr", "city": "Rowlett", "zip_code": "75089", "price": 550000, "sqft": 2800, "year_built": 1994, "bedrooms": 4, "bathrooms": 3, "has_office": false, "pool_status": "private", "hoa_monthly": 45, "pid_mud_annual": 0},
  {"address": "324 Shady Timbers Ln", "city": "Murphy", "zip_code": "75094", "price": 525000, "sqft": 2500, "year_built": 2018, "bedrooms": 4, "bathrooms": 2.5, "has_office": false, "pool_status": "none", "hoa_monthly": 60, "pid_mud_annual": 0},
  {"address": "2109 Swanmore Way", "city": "Forney", "zip_code": "75126", "price": 529000, "sqft": 2900, "year_built": 2022, "bedrooms": 4, "bathrooms": 3, "has_office": true, "pool_status": "private", "hoa_monthly": 55, "pid_mud_annual": 1800, "builder": "Perry"}
]`;

export default function Sync() {
  const [jsonInput, setJsonInput] = useState("");
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [resultMsg, setResultMsg] = useState("");
  const queryClient = useQueryClient();

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
          Sync Homes
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste a JSON array from your AI advisor to add or update homes.
        </p>
      </div>

      <Card>
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
      </Card>

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