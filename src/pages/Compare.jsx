import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { scoreHome } from "@/lib/scoringEngine";
import { GitCompare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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

  const scored = useMemo(() => {
    return homes
      .map((h) => {
        const result = scoreHome(h);
        const scores = h.scores || {
          must_haves: result.pillars?.mustHaves?.score ?? 0,
          price_value: result.pillars?.priceValue?.score ?? 0,
          resale: result.pillars?.resale?.score ?? 0,
          commute: result.pillars?.commute?.score ?? 0,
          true_cost: result.pillars?.trueCost?.score ?? 0,
          build_quality: result.pillars?.buildQuality?.score ?? 0,
        };
        return { ...h, ...result, scores };
      })
      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  }, [homes]);

  const [selectedIds, setSelectedIds] = useState(new Set());

  const displayed = useMemo(() => {
    if (selectedIds.size > 0) return scored.filter((h) => selectedIds.has(h.id));
    return scored.slice(0, 4);
  }, [scored, selectedIds]);

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
      <div className="mb-5">
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <GitCompare className="w-6 h-6" />
          Compare
        </h2>
        <p className="text-sm text-muted-foreground">Select up to 4 homes</p>
      </div>

      {/* Home selector */}
      <div className="flex flex-wrap gap-2 mb-2">
        {scored.map((h) => {
          const isChecked = selectedIds.has(h.id) || (selectedIds.size === 0 && displayed.includes(h));
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
      <div className="flex gap-2 mb-5">
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
          Clear selection
        </button>
      </div>

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
            {/* True cost */}
            <tr className="border-b border-border">
              <td className="p-3 text-xs text-muted-foreground">True cost /mo</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center font-semibold">{h.monthly_true_cost ? fmt(h.monthly_true_cost) : "—"}</td>
              ))}
            </tr>
            {/* Verdict */}
            <tr>
              <td className="p-3 text-xs text-muted-foreground">Verdict</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center text-xs italic text-muted-foreground">{h.one_line || h.verdict || "—"}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}