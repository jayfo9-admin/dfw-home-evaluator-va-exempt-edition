import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { scoreHome, calculateTrueCost, VA_RATE_DEFAULT } from "@/lib/scoringEngine";
import { GitCompare, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const CRITERIA = [
  { key: "must_haves", label: "Must-haves" },
  { key: "price_value", label: "Price value" },
  { key: "resale", label: "Resale" },
  { key: "commute", label: "Commute" },
  { key: "true_cost", label: "True cost" },
  { key: "build_quality", label: "Build quality" },
];

export default function Compare() {
  const { data: homes = [], isLoading } = useQuery({
    queryKey: ["homes"],
    queryFn: () => base44.entities.Home.list("-created_date", 100),
  });

  // Fix 1: Always recalc live — never use stale stored scores
  // Fix 2: Compute true cost live at current VA rate so it's never stale
  const scored = useMemo(() => {
    return homes
      .map((h) => {
        const result = scoreHome(h, VA_RATE_DEFAULT);
        const live_monthly_true_cost = Math.round(calculateTrueCost(h, VA_RATE_DEFAULT));
        return { ...h, ...result, monthly_true_cost: live_monthly_true_cost, va_rate_used: VA_RATE_DEFAULT };
      })
      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  }, [homes]);

  // Fix 3: Default selection is top 4 — initialise selectedIds so checkboxes are honest
  const [selectedIds, setSelectedIds] = useState(() =>
    new Set() // empty = "auto top-4 display mode"
  );

  // When in auto mode (no selection), display top 4 but don't mark checkboxes
  const autoMode = selectedIds.size === 0;

  const displayed = useMemo(() => {
    if (!autoMode) return scored.filter((h) => selectedIds.has(h.id));
    return scored.slice(0, 4);
  }, [scored, selectedIds, autoMode]);

  const exportCSV = () => {
    const rows = [
      ["Address", "Price", "True Cost/mo", "VA Rate", "Overall", ...CRITERIA.map(c => c.label), "Verdict"],
      ...displayed.map(h => [
        h.address,
        h.price || "",
        h.monthly_true_cost || "",
        h.va_rate_used ? `${(h.va_rate_used * 100).toFixed(3)}%` : `${(VA_RATE_DEFAULT * 100).toFixed(3)}%`,
        h.overall_score || 0,
        ...CRITERIA.map(c => h.scores?.[c.key] || 0),
        h.one_line || h.verdict || "",
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dfw-compare-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleHome = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (scored.length < 2) {
    return (
      <div className="text-center py-20 bg-card border border-border rounded-xl">
        <GitCompare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-heading text-lg font-semibold">Save at least 2 homes to compare.</h3>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <GitCompare className="w-6 h-6" />
            Compare
          </h2>
          <p className="text-sm text-muted-foreground">Select up to 4 homes</p>
        </div>
        {displayed.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={exportCSV}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Home selector */}
      <div className="flex flex-wrap gap-2 mb-2">
        {scored.map((h) => {
          // Fix 3: checkbox reflects actual selectedIds — auto mode shows top-4 in table but checkboxes are unchecked
          const isChecked = selectedIds.has(h.id);
          return (
            <label
              key={h.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all ${
                isChecked ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/50"
              }`}
            >
              <Checkbox checked={isChecked} onCheckedChange={() => toggleHome(h.id)} />
              <span className="truncate max-w-[150px]">{h.address?.split(",")[0]}</span>
            </label>
          );
        })}
      </div>
      <div className="flex gap-2 mb-1">
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setSelectedIds(new Set(scored.slice(0, 4).map(h => h.id)))}
        >
          Select top 4
        </button>
        <span className="text-xs text-muted-foreground">·</span>
        <button
          className="text-xs text-muted-foreground hover:underline"
          onClick={() => setSelectedIds(new Set())}
        >
          Clear
        </button>
      </div>
      {autoMode && (
        <p className="text-xs text-muted-foreground italic mb-4">Showing top 4 by score — select homes to customize.</p>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-xl bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-xs text-muted-foreground font-bold uppercase tracking-wider w-36">Criteria</th>
              {displayed.map((h) => (
                <th key={h.id} className="p-3 text-center font-semibold min-w-[150px]">
                  {h.address?.split(",")[0]}
                  <div className="text-xs font-normal text-muted-foreground mt-1">
                    {h.price ? fmt(h.price) : ""}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Overall */}
            <tr className="border-b border-border bg-secondary/40">
              <td className="p-3 font-semibold">Overall</td>
              {displayed.map((h) => {
                const score = h.overall_score || 0;
                const cls = score >= 75 ? "bg-green-100 text-green-800" : score >= 55 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
                return (
                  <td key={h.id} className="p-3 text-center">
                    <span className={`inline-block px-3 py-0.5 rounded-full text-sm font-bold ${cls}`}>{score}</span>
                  </td>
                );
              })}
            </tr>
            {/* Criteria rows */}
            {CRITERIA.map((c, i) => {
              const vals = displayed.map((h) => (h.scores?.[c.key] || 0));
              const max = Math.max(...vals);
              return (
                <tr key={c.key} className={`border-b border-border ${i % 2 === 0 ? "" : "bg-secondary/20"}`}>
                  <td className="p-3 text-xs text-muted-foreground">{c.label}</td>
                  {displayed.map((h) => {
                    const v = h.scores?.[c.key] || 0;
                    const isWinner = v === max && vals.filter((x) => x === max).length === 1;
                    return (
                      <td key={h.id} className={`p-3 text-center ${isWinner ? "font-bold text-green-700" : "text-muted-foreground"}`}>
                        {v}/10
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Price */}
            <tr className="border-b border-border bg-secondary/40">
              <td className="p-3 text-xs text-muted-foreground">List price</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center font-semibold">{h.price ? fmt(h.price) : "—"}</td>
              ))}
            </tr>
            {/* True cost — always live-calculated at current VA rate */}
            <tr className="border-b border-border">
              <td className="p-3 text-xs text-muted-foreground">
                True cost /mo
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{(VA_RATE_DEFAULT * 100).toFixed(3)}% VA rate</div>
              </td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center">
                  <div className="font-semibold">{h.monthly_true_cost ? fmt(h.monthly_true_cost) : "—"}</div>
                  {h.va_rate_used && Math.abs(h.va_rate_used - VA_RATE_DEFAULT) > 0.0001 && (
                    <div className="text-[10px] text-amber-600 font-mono mt-0.5">stored at {(h.va_rate_used * 100).toFixed(3)}%</div>
                  )}
                </td>
              ))}
            </tr>
            {/* Verdict */}
            <tr className="border-b border-border">
              <td className="p-3 text-xs text-muted-foreground">Verdict</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center text-xs italic text-muted-foreground">{h.one_line || h.verdict || "—"}</td>
              ))}
            </tr>
            {/* Opening Offer */}
            <tr className="border-b border-border bg-secondary/40">
              <td className="p-3 text-xs text-muted-foreground font-semibold">Opening Offer</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center text-xs font-medium">{h.offer_framework?.opening_offer || "—"}</td>
              ))}
            </tr>
            {/* Walk-Away */}
            <tr className="border-b border-border">
              <td className="p-3 text-xs text-muted-foreground font-semibold">Walk-Away</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center text-xs font-medium text-red-700">{h.offer_framework?.walk_away || "—"}</td>
              ))}
            </tr>
            {/* Flood Risk */}
            <tr className="border-b border-border bg-secondary/40">
              <td className="p-3 text-xs text-muted-foreground">Flood Risk</td>
              {displayed.map((h) => {
                const risk = h.flood_info?.flood_risk || "unknown";
                const cls = risk === "high" ? "text-red-700 font-bold" : risk === "moderate" ? "text-orange-600 font-semibold" : "text-muted-foreground";
                return <td key={h.id} className={`p-3 text-center text-xs ${cls}`}>{h.flood_info?.fema_zone ? `${h.flood_info.fema_zone} (${risk})` : "—"}</td>;
              })}
            </tr>
            {/* HOA + PID */}
            <tr>
              <td className="p-3 text-xs text-muted-foreground">HOA + PID/mo</td>
              {displayed.map((h) => {
                const hoa = h.hoa_monthly || 0;
                const pid = h.pid_type === "ad_valorem" ? 0 : Math.round((h.pid_mud_annual || 0) / 12);
                return <td key={h.id} className="p-3 text-center text-xs">{hoa + pid > 0 ? fmt(hoa + pid) : "$0"}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}