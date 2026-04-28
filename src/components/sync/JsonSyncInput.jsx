import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle, Loader2, FileJson } from "lucide-react";
import { toast } from "sonner";
import { scoreHome } from "@/lib/scoringEngine";

const SAMPLE_JSON = `[
  {"address": "8613 Lake Arrowhead Trl", "city": "McKinney", "zip_code": "75070", "price": 600000, "sqft": 2693, "year_built": 2019, "bedrooms": 4, "bathrooms": 3, "has_office": true, "pool_status": "private", "hoa_monthly": 80, "pid_mud_annual": 0, "pid_type": "fixed_assessment", "builder": "Meritage"},
  {"address": "9702 October Glory Ln", "city": "Rowlett", "zip_code": "75089", "price": 625000, "sqft": 3466, "year_built": 2002, "bedrooms": 4, "bathrooms": 3.5, "has_office": true, "pool_status": "private", "hoa_monthly": 95, "pid_mud_annual": 0, "pid_type": "fixed_assessment"}
]`;

export default function JsonSyncInput() {
  const [jsonInput, setJsonInput] = useState("");
  const [status, setStatus] = useState(null);
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

    let created = 0, errors = 0;
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
    <>
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
            <Button variant="outline" size="sm" onClick={() => setJsonInput(SAMPLE_JSON)}>
              Load Sample
            </Button>
            <Button onClick={handleSync} disabled={!jsonInput.trim() || status === "loading"} className="gap-2">
              {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Sync to Shortlist
            </Button>
          </div>
          {status && status !== "loading" && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${status === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              {status === "success" ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{resultMsg}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Field Reference */}
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
              ["resale_score", "0–10 (manual — takes priority over zip)"],
              ["commute_collins_min", "minutes (manual — takes priority over zip)"],
              ["commute_coram_deo_min", "minutes (manual — takes priority over zip)"],
            ].map(([field, type]) => (
              <div key={field} className="flex justify-between py-1 border-b border-border">
                <code className="text-xs font-mono font-medium">{field}</code>
                <span className="text-xs text-muted-foreground">{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}