import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { scoreHome } from "@/lib/scoringEngine";
import ScoreRing from "@/components/ScoreRing";
import PillarBar from "@/components/PillarBar";
import { GitCompare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const pillarLabels = {
  mustHaves: "Must-Haves (30%)",
  priceValue: "Price Value (20%)",
  resale: "Resale (20%)",
  commute: "Commute (15%)",
  trueCost: "True Cost (10%)",
  buildQuality: "Build Quality (5%)",
};

export default function Compare() {
  const { data: homes = [], isLoading } = useQuery({
    queryKey: ["homes"],
    queryFn: () => base44.entities.Home.list("-created_date", 100),
  });

  const scored = useMemo(() => {
    return homes
      .map((h) => {
        const result = scoreHome(h);
        return { ...h, ...result, _pillars: result.pillars };
      })
      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  }, [homes]);

  const [selectedIds, setSelectedIds] = useState(new Set());

  // Auto-select top 4 if none selected yet
  const displayed = useMemo(() => {
    if (selectedIds.size > 0) {
      return scored.filter((h) => selectedIds.has(h.id));
    }
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

  if (scored.length === 0) {
    return (
      <div className="text-center py-20">
        <GitCompare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-heading text-lg font-semibold">No homes to compare</h3>
        <p className="text-sm text-muted-foreground">Add homes via the Sync tab first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <GitCompare className="w-6 h-6" />
            Side-by-Side Comparison
          </h2>
          <p className="text-sm text-muted-foreground">Select up to 4 homes to compare</p>
        </div>
      </div>

      {/* Home selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {scored.map((h) => (
          <label
            key={h.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all ${
              selectedIds.has(h.id) || (selectedIds.size === 0 && displayed.includes(h))
                ? "border-primary bg-primary/5 font-medium"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Checkbox
              checked={selectedIds.has(h.id) || (selectedIds.size === 0 && displayed.includes(h))}
              onCheckedChange={() => toggleHome(h.id)}
            />
            <span className="truncate max-w-[150px]">{h.address}</span>
          </label>
        ))}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto border border-border rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="text-left p-3 font-heading font-semibold w-40">Metric</th>
              {displayed.map((h) => (
                <th key={h.id} className="p-3 font-heading font-semibold text-center min-w-[160px]">
                  {h.address?.split(",")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Score */}
            <tr className="bg-secondary/50">
              <td className="p-3 font-medium">Overall Score</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center">
                  <div className="flex justify-center">
                    <ScoreRing score={h.overall_score || 0} size={56} strokeWidth={4} />
                  </div>
                </td>
              ))}
            </tr>
            {/* Price */}
            <tr>
              <td className="p-3 font-medium">Price</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center font-heading font-bold">{fmt(h.price)}</td>
              ))}
            </tr>
            {/* True Cost */}
            <tr className="bg-secondary/50">
              <td className="p-3 font-medium">True Cost /mo</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center font-heading font-semibold">{fmt(h.monthly_true_cost || 0)}</td>
              ))}
            </tr>
            {/* Bed/Bath */}
            <tr>
              <td className="p-3 font-medium">Bed / Bath</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center">{h.bedrooms || "—"} / {h.bathrooms || "—"}</td>
              ))}
            </tr>
            {/* SqFt */}
            <tr className="bg-secondary/50">
              <td className="p-3 font-medium">Sq Ft</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center">{h.sqft ? h.sqft.toLocaleString() : "—"}</td>
              ))}
            </tr>
            {/* Pool */}
            <tr>
              <td className="p-3 font-medium">Pool</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center capitalize">{h.pool_status || "—"}</td>
              ))}
            </tr>
            {/* Pillar scores */}
            {Object.keys(pillarLabels).map((key, i) => (
              <tr key={key} className={i % 2 === 0 ? "bg-secondary/50" : ""}>
                <td className="p-3 font-medium text-xs">{pillarLabels[key]}</td>
                {displayed.map((h) => {
                  const p = h._pillars?.[key];
                  return (
                    <td key={h.id} className="p-3">
                      {p ? <PillarBar label="" score={p.score} max={p.max} weight={p.weight} /> : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Verdict */}
            <tr className="bg-secondary/50">
              <td className="p-3 font-medium">Verdict</td>
              {displayed.map((h) => (
                <td key={h.id} className="p-3 text-center text-xs italic text-muted-foreground">
                  {h.verdict}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}