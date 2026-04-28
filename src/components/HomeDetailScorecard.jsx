import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import HomeFullReport from "./HomeFullReport";

const CRITERIA = [
  { key: "must_haves", label: "Must-haves" },
  { key: "price_value", label: "Price value" },
  { key: "resale", label: "Resale" },
  { key: "commute", label: "Commute" },
  { key: "true_cost", label: "True cost" },
  { key: "build_quality", label: "Build quality" },
];

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function CriteriaBar({ label, value }) {
  const pct = Math.min((value / 10) * 100, 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 70 ? "text-green-700" : pct >= 50 ? "text-amber-700" : "text-red-700";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span className={`font-bold ${textColor}`}>{value}/10</span>
      </div>
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function HomeDetailScorecard({ home }) {
  const [reportOpen, setReportOpen] = useState(false);
  // Build scores from pillars if scores object not present
  const scores = home.scores || {
    must_haves: home._pillars?.mustHaves?.score ?? 0,
    price_value: home._pillars?.priceValue?.score ?? 0,
    resale: home._pillars?.resale?.score ?? 0,
    commute: home._pillars?.commute?.score ?? 0,
    true_cost: home._pillars?.trueCost?.score ?? 0,
    build_quality: home._pillars?.buildQuality?.score ?? 0,
  };

  const verdict = home.one_line || home.verdict || "";
  const homeIns = home.home_insurance_monthly || Math.round((home.price || 0) * 0.001 / 12);
  const floodIns = home.flood_info?.flood_insurance_required ? (home.flood_info?.estimated_flood_insurance_monthly || 0) : 0;
  const costNote = home.monthly_cost_note ||
    (home.monthly_true_cost ? `Est. true monthly cost: ${fmt(home.monthly_true_cost)}/mo (VA P&I ${fmt(home.va_mortgage_pi || 0)} + HOA $${home.hoa_monthly || 0} + PID $${Math.round((home.pid_mud_annual || 0) / 12)} + Ins $${homeIns}${floodIns > 0 ? ` + Flood $${floodIns}` : ""}, $0 tax)` : null);

  return (
    <div className="border-t border-border bg-secondary/30 px-5 py-4 space-y-4">
      {/* Score + One-liner */}
      {verdict && (
        <div className="flex items-start gap-3">
          <div
            className={`rounded-full border-2 flex items-center justify-center font-bold shrink-0 text-sm
              ${(home.overall_score || 0) >= 75 ? "border-green-500 bg-green-50 text-green-800"
              : (home.overall_score || 0) >= 55 ? "border-amber-500 bg-amber-50 text-amber-800"
              : "border-red-500 bg-red-50 text-red-800"}`}
            style={{ width: 54, height: 54, fontSize: 15 }}
          >
            {home.overall_score || 0}
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">One-line verdict</p>
            <p className="text-sm text-foreground leading-relaxed">{verdict}</p>
          </div>
        </div>
      )}

      {/* Criteria Bars */}
      <div>
        {CRITERIA.map((c) => (
          <CriteriaBar key={c.key} label={c.label} value={scores[c.key] || 0} />
        ))}
      </div>

      {/* Pros / Cons */}
      {((home.pros?.length > 0) || (home.cons?.length > 0)) && (
        <div className="grid grid-cols-2 gap-4">
          {home.pros?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Pros</p>
              <div className="space-y-1.5">
                {home.pros.map((p, i) => (
                  <p key={i} className="text-xs text-foreground pl-2 border-l-2 border-green-500 leading-snug">{p}</p>
                ))}
              </div>
            </div>
          )}
          {home.cons?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Cons</p>
              <div className="space-y-1.5">
                {home.cons.map((c, i) => (
                  <p key={i} className="text-xs text-foreground pl-2 border-l-2 border-red-500 leading-snug">{c}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Red Flags */}
      {home.red_flags?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2">Red Flags</p>
          <div className="space-y-1">
            {home.red_flags.map((f, i) => (
              <p key={i} className="text-xs text-red-800 flex gap-2">
                <span>⚠</span><span>{f}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Monthly cost note */}
      {costNote && (
        <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
          💰 {costNote}
        </div>
      )}

      {/* Analyst note / full verdict */}
      {home.analyst_note && (
        <div className="bg-card border border-border rounded-lg p-3 text-xs text-foreground leading-relaxed">
          {home.analyst_note}
        </div>
      )}

      {/* Full Report button */}
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setReportOpen(true)}>
        <FileText className="w-4 h-4" />
        View Full Report & Export
      </Button>

      <HomeFullReport home={home} open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}