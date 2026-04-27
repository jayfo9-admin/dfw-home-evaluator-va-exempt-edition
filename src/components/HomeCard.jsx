import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, BedDouble, Bath, Ruler, Calendar, DollarSign, Waves, Phone, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import ScoreRing from "./ScoreRing";
import ProConList from "./ProConList";
import { getCADInfo } from "@/lib/scoringEngine";

const poolLabels = { private: "Private Pool 🏊", community: "Community Pool", none: "No Pool" };

export default function HomeCard({ home, onClick }) {
  const [flagsOpen, setFlagsOpen] = useState(false);
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const cad = getCADInfo(home.zip_code); // returns array
  const hasFlags = (home.red_flags || []).length > 0;

  return (
    <Card className="group cursor-pointer hover:shadow-lg transition-all duration-300 border border-border overflow-hidden">
      <CardContent className="p-0">
        {/* Dark header bar */}
        <div
          className="bg-primary px-4 py-3 flex items-center justify-between gap-2"
          onClick={() => onClick?.(home)}
        >
          <div className="flex items-center gap-2 text-primary-foreground min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="font-heading text-sm font-semibold truncate">{home.address}</span>
          </div>
          {home.zip_code && (
            <Badge variant="secondary" className="text-xs shrink-0">{home.zip_code}</Badge>
          )}
        </div>

        <div className="p-4" onClick={() => onClick?.(home)}>
          {/* Score + Price row */}
          <div className="flex items-center justify-between mb-3">
            <ScoreRing score={home.overall_score || 0} size={70} strokeWidth={5} />
            <div className="text-right">
              <p className="font-heading text-2xl font-bold">{fmt(home.price)}</p>
              <p className="text-xs text-muted-foreground">
                True Cost: <span className="font-semibold text-foreground">{fmt(home.monthly_true_cost || 0)}/mo</span>
              </p>
              <p className="text-xs text-muted-foreground">
                VA P&I: <span className="font-medium text-foreground">{fmt(home.va_mortgage_pi || 0)}/mo</span>
              </p>
            </div>
          </div>

          {/* Verdict */}
          {home.verdict && (
            <p className="text-sm font-heading italic text-muted-foreground mb-3 pb-3 border-b border-border">
              "{home.verdict}"
            </p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <StatItem icon={BedDouble} label={`${home.bedrooms || "—"} bd`} />
            <StatItem icon={Bath} label={`${home.bathrooms || "—"} ba`} />
            <StatItem icon={Ruler} label={home.sqft ? `${home.sqft.toLocaleString()} sf` : "—"} />
            <StatItem icon={Calendar} label={home.year_built || "—"} />
            <StatItem icon={DollarSign} label={`HOA ${fmt(home.hoa_monthly || 0)}`} />
            <StatItem icon={Waves} label={poolLabels[home.pool_status] || "—"} />
          </div>

          {/* Builder badge */}
          {home.builder && (
            <p className="text-xs text-muted-foreground mb-3">
              Builder: <span className="font-medium text-foreground">{home.builder}</span>
              {home.builder_modifier > 0 && <span className="text-green-600 ml-1">(+{home.builder_modifier} pts)</span>}
              {home.builder_modifier < 0 && <span className="text-red-500 ml-1">({home.builder_modifier} pts)</span>}
            </p>
          )}

          {/* Pros/Cons preview */}
          <ProConList
            pros={(home.pros || []).slice(0, 3)}
            cons={(home.cons || []).slice(0, 2)}
            redFlags={[]}
          />
        </div>

        {/* Red Flags expandable — outside click zone */}
        {hasFlags && (
          <div className="border-t border-border">
            <button
              className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              onClick={(e) => { e.stopPropagation(); setFlagsOpen((v) => !v); }}
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {(home.red_flags || []).length} Red Flag{(home.red_flags || []).length > 1 ? "s" : ""}
              </span>
              {flagsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {flagsOpen && (
              <div className="px-4 pb-3 space-y-1 bg-red-50/50">
                {(home.red_flags || []).map((f, i) => (
                  <p key={i} className="text-xs text-red-700 font-medium flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">🚩</span>{f}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CAD / Contact buttons */}
        <div className="border-t border-border px-4 py-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          {cad.map((c) => (
            <a key={c.phone} href={`tel:${c.phone.replace(/-/g, "")}`} className="block">
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs font-body">
                <Phone className="w-3.5 h-3.5" />
                {c.name}: {c.phone}
              </Button>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatItem({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}