import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Home as HomeIcon, Search, Trash2, Plus, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { scoreHome } from "@/lib/scoringEngine";
import HomeDetailScorecard from "@/components/HomeDetailScorecard";
import { toast } from "sonner";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function verdictLabel(score) {
  if (score >= 75) return { label: "Strong", className: "bg-green-100 text-green-800" };
  if (score >= 55) return { label: "Maybe", className: "bg-amber-100 text-amber-800" };
  return { label: "Pass", className: "bg-red-100 text-red-800" };
}

function ScoreBadge({ score, size = 42 }) {
  const color =
    score >= 75 ? "border-green-500 bg-green-50 text-green-800"
    : score >= 55 ? "border-amber-500 bg-amber-50 text-amber-800"
    : "border-red-500 bg-red-50 text-red-800";
  return (
    <div
      className={`rounded-full border-2 flex items-center justify-center font-bold shrink-0 ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.28 }}
    >
      {score}
    </div>
  );
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [recalcing, setRecalcing] = useState(false);
  const queryClient = useQueryClient();

  const { data: homes = [], isLoading } = useQuery({
    queryKey: ["homes"],
    queryFn: () => base44.entities.Home.list("-created_date", 100),
  });

  const scoredHomes = useMemo(() => {
    return homes
      .map((h) => {
        const result = scoreHome(h);
        return { ...h, ...result, _pillars: result.pillars };
      })
      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  }, [homes]);

  const filtered = useMemo(() => {
    if (!search) return scoredHomes;
    const q = search.toLowerCase();
    return scoredHomes.filter(
      (h) => h.address?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q)
    );
  }, [scoredHomes, search]);

  const handleDelete = async (e, home) => {
    e.stopPropagation();
    await base44.entities.Home.delete(home.id);
    queryClient.invalidateQueries({ queryKey: ["homes"] });
    if (expanded === home.id) setExpanded(null);
    toast.success("Home removed.");
  };

  const toggle = (id) => setExpanded((prev) => (prev === id ? null : id));

  const handleRecalcAll = async () => {
    setRecalcing(true);
    toast.info("Fetching live VA rate from Navy Federal...");

    // Step 1: Fetch live 30-Year VA rate
    let liveRate = null;
    try {
      const rateResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Go to https://www.navyfederal.org/loans-cards/mortgage/mortgage-rates.html and find the current 30-Year VA Loan interest rate (not APR). Return ONLY the numeric rate as a decimal (e.g. 0.05375 for 5.375%). Nothing else.`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: { rate: { type: "number" } },
          required: ["rate"]
        }
      });
      if (rateResult?.rate && rateResult.rate > 0.01 && rateResult.rate < 0.20) {
        liveRate = rateResult.rate;
        toast.info(`Live VA rate: ${(liveRate * 100).toFixed(3)}% — recalculating ${homes.length} home${homes.length !== 1 ? "s" : ""}...`);
      }
    } catch (e) {
      // fallback silently
    }

    // Step 2: Recalc all homes with live rate (or fallback to engine default)
    for (const home of homes) {
      const result = scoreHome(home, liveRate);
      await base44.entities.Home.update(home.id, {
        overall_score: result.overall_score,
        verdict: result.verdict,
        one_line: result.verdict,
        scores: result.scores,
        pros: result.pros,
        cons: result.cons,
        red_flags: result.red_flags,
        va_mortgage_pi: result.va_mortgage_pi,
        monthly_true_cost: result.monthly_true_cost,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["homes"] });
    setRecalcing(false);
    toast.success(`All scores recalculated${liveRate ? ` at ${(liveRate * 100).toFixed(3)}% VA rate` : ""}.`);
  };

  // Stats
  const avgScore = scoredHomes.length
    ? Math.round(scoredHomes.reduce((s, h) => s + (h.overall_score || 0), 0) / scoredHomes.length)
    : 0;
  const under500k = scoredHomes.filter((h) => (h.price || 0) <= 500000).length;
  const topScore = scoredHomes.length ? Math.max(...scoredHomes.map((h) => h.overall_score || 0)) : 0;

  return (
    <div>
      {/* Stats bar */}
      {scoredHomes.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            ["Saved", scoredHomes.length],
            ["Avg Score", avgScore],
            ["Under $500K", under500k],
            ["Top Score", topScore],
          ].map(([label, val]) => (
            <div key={label} className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-bold font-heading">{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <HomeIcon className="w-6 h-6" />
            Shortlist
          </h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} home{filtered.length !== 1 ? "s" : ""} evaluated
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search homes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-52"
            />
          </div>
          {scoredHomes.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={handleRecalcAll} disabled={recalcing}>
              <RefreshCw className={`w-4 h-4 ${recalcing ? "animate-spin" : ""}`} />
              {recalcing ? "Recalculating..." : "Recalc Scores"}
            </Button>
          )}
          <Link to="/sync">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Home
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-xl">
          <HomeIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-heading text-lg font-semibold mb-1">No homes yet</h3>
          <p className="text-sm text-muted-foreground">Go to the Sync tab to research or paste home data.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.map((home, i) => {
            const verdict = verdictLabel(home.overall_score || 0);
            const isOpen = expanded === home.id;
            return (
              <div key={home.id} className={i < filtered.length - 1 ? "border-b border-border" : ""}>
                {/* Row */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isOpen ? "bg-secondary" : "hover:bg-secondary/50"}`}
                  onClick={() => toggle(home.id)}
                >
                  <ScoreBadge score={home.overall_score || 0} size={42} />
                  <div className="flex-1 min-w-0">
                    <a 
                      href={`https://www.zillow.com/homes/search?q=${encodeURIComponent(home.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm truncate text-primary hover:underline block"
                    >
                      {home.address}
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {home.price ? fmt(home.price) : ""}
                      {home.bedrooms ? ` · ${home.bedrooms} bd` : ""}
                      {home.sqft ? ` · ${home.sqft.toLocaleString()} sqft` : ""}
                      {home.year_built ? ` · ${home.year_built}` : ""}
                      {home.pool_status === "private" ? " · pool ✓" : ""}
                    </p>
                    {home.last_deep_dive_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        🔬 Deep dive: {new Date(home.last_deep_dive_at).toLocaleDateString()} {new Date(home.last_deep_dive_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${verdict.className}`}>
                    {verdict.label}
                  </span>
                  <span className={`text-muted-foreground text-sm transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▾</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDelete(e, home)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {/* Scorecard */}
                {isOpen && <HomeDetailScorecard home={home} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}