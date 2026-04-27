import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, BedDouble, Bath, Ruler, Calendar, DollarSign, Waves } from "lucide-react";
import ScoreRing from "./ScoreRing";
import ProConList from "./ProConList";

const poolLabels = { private: "Private Pool", community: "Community Pool", none: "No Pool" };

export default function HomeCard({ home, onClick }) {
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <Card
      className="group cursor-pointer hover:shadow-lg transition-all duration-300 border border-border overflow-hidden"
      onClick={() => onClick?.(home)}
    >
      <CardContent className="p-0">
        {/* Header bar */}
        <div className="bg-primary px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-foreground">
            <MapPin className="w-4 h-4" />
            <span className="font-heading text-sm font-semibold truncate">
              {home.address}
            </span>
          </div>
          {home.city && (
            <Badge variant="secondary" className="text-xs font-body shrink-0">
              {home.city}
            </Badge>
          )}
        </div>

        <div className="p-5">
          {/* Score + Price row */}
          <div className="flex items-center justify-between mb-4">
            <ScoreRing score={home.overall_score || 0} size={72} strokeWidth={5} />
            <div className="text-right">
              <p className="font-heading text-2xl font-bold">{fmt(home.price)}</p>
              <p className="text-xs text-muted-foreground">
                True Cost: <span className="font-semibold text-foreground">{fmt(home.monthly_true_cost || 0)}/mo</span>
              </p>
            </div>
          </div>

          {/* Verdict */}
          {home.verdict && (
            <p className="text-sm font-heading italic text-muted-foreground mb-4 border-b border-border pb-3">
              "{home.verdict}"
            </p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <BedDouble className="w-3.5 h-3.5" />
              <span>{home.bedrooms || "—"} bd</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Bath className="w-3.5 h-3.5" />
              <span>{home.bathrooms || "—"} ba</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Ruler className="w-3.5 h-3.5" />
              <span>{home.sqft ? `${home.sqft.toLocaleString()} sf` : "—"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{home.year_built || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5" />
              <span>HOA {fmt(home.hoa_monthly || 0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Waves className="w-3.5 h-3.5" />
              <span>{poolLabels[home.pool_status] || "—"}</span>
            </div>
          </div>

          {/* Pros/Cons */}
          <ProConList
            pros={(home.pros || []).slice(0, 3)}
            cons={(home.cons || []).slice(0, 2)}
            redFlags={home.red_flags || []}
          />
        </div>
      </CardContent>
    </Card>
  );
}