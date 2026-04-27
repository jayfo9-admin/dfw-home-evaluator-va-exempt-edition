import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ScoreRing from "./ScoreRing";
import ProConList from "./ProConList";
import PillarBar from "./PillarBar";

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const pillarLabels = {
  mustHaves: "Must-Haves",
  priceValue: "Price Value",
  resale: "Resale Potential",
  commute: "Commute",
  trueCost: "True Cost",
  buildQuality: "Build Quality",
};

export default function HomeDetailModal({ home, open, onClose }) {
  if (!home) return null;

  const pillars = home._pillars || {};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">{home.address}</DialogTitle>
          {home.city && <Badge variant="secondary" className="w-fit">{home.city}</Badge>}
        </DialogHeader>

        <div className="space-y-5">
          {/* Score + Verdict */}
          <div className="flex items-center gap-4">
            <ScoreRing score={home.overall_score || 0} size={90} strokeWidth={6} />
            <div>
              <p className="font-heading text-2xl font-bold">{fmt(home.price)}</p>
              <p className="text-sm text-muted-foreground italic">"{home.verdict}"</p>
            </div>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-3 gap-3 bg-secondary rounded-lg p-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">VA P&I</p>
              <p className="font-heading font-bold">{fmt(home.va_mortgage_pi || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">HOA + PID</p>
              <p className="font-heading font-bold">{fmt((home.hoa_monthly || 0) + (home.pid_mud_annual || 0) / 12)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">True Cost</p>
              <p className="font-heading font-bold text-accent">{fmt(home.monthly_true_cost || 0)}/mo</p>
            </div>
          </div>

          {/* Pillar Breakdown */}
          <div className="space-y-2">
            <h3 className="font-heading font-semibold text-sm">Scoring Breakdown</h3>
            {Object.entries(pillars).map(([key, val]) => (
              <PillarBar key={key} label={val.label || pillarLabels[key] || key} score={val.score} max={val.max} weight={val.weight} />
            ))}
          </div>

          {/* Pros / Cons */}
          <ProConList pros={home.pros} cons={home.cons} redFlags={home.red_flags} />
        </div>
      </DialogContent>
    </Dialog>
  );
}