import React from "react";

export default function PillarBar({ label, score, max, weight }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  let barColor;
  if (pct >= 75) barColor = "bg-green-600";
  else if (pct >= 50) barColor = "bg-yellow-500";
  else barColor = "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">{label} ({weight}%)</span>
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium w-10 text-right">{score}/{max}</span>
    </div>
  );
}