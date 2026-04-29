import React, { useState, useMemo, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Home as HomeIcon, Search, Trash2, Plus, RefreshCw, ArrowUpDown, MoreVertical, AlertTriangle } from "lucide-react";

const VA_RATE_CACHE_KEY = "dfw_va_rate_cache";

function getCachedVARate() {
  try {
    const raw = localStorage.getItem(VA_RATE_CACHE_KEY);
    if (!raw) return null;
    const { rate, date } = JSON.parse(raw);
    if (date === new Date().toISOString().slice(0, 10)) return rate;
  } catch {}
  return null;
}

function setCachedVARate(rate) {
  try {
    localStorage.setItem(VA_RATE_CACHE_KEY, JSON.stringify({ rate, date: new Date().toISOString().slice(0, 10) }));
  } catch {}
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { scoreHome, VA_RATE_DEFAULT } from "@/lib/scoringEngine";
import HomeDetailScorecard from "@/components/HomeDetailScorecard";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { toast } from "sonner";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function verdictLabel(score) {
  if (score >= 85) return { label: "Strong", className: "bg-green-100 text-green-800" };
  if (score >= 65) return { label: "Maybe", className: "bg-amber-100 text-amber-800" };
  return { label: "Pass", className: "bg-red-100 text-red-800" };
}

function ScoreBadge({ score, size = 42 }) {
  const color =
    score >= 85 ? "border-green-500 bg-green-50 text-green-800"
    : score >= 65 ? "border-amber-500 bg-amber-50 text-amber-800"
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
  const [sortBy, setSortBy] = useState("score");
  const [statusFilter, setStatusFilter] = useState("active");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  // Cancellation ref must be declared before the cleanup effect that references it
  const cancelRecalcRef = useRef(false);
  useEffect(() => () => { cancelRecalcRef.current = true; }, []);

  const { data: homes = [], isLoading, isError } = useQuery({
    queryKey: ["homes"],
    queryFn: () => base44.entities.Home.list("-created_date", 100),
    retry: 2,
    retryDelay: 1500,
  });

  // Issue #1: per-card error boundary — scoreHome() errors don't crash the list
  const scoredHomes = useMemo(() => {
    const mapped = homes.map((h) => {
      try {
        const result = scoreHome(h);
        return { ...h, ...result, _pillars: result.pillars, commute_verified: result.commute_verified, va_rate_used: result.va_rate_used, _scoreError: null };
      } catch (err) {
        console.error("scoreHome failed for", h.address, err);
        return { ...h, overall_score: 0, monthly_true_cost: 0, _scoreError: err?.message || "Scoring error" };
      }
    });
    return mapped.sort((a, b) => {
      if (sortBy === "price") return (a.price || 0) - (b.price || 0);
      if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
      if (sortBy === "cost") return (a.monthly_true_cost || 0) - (b.monthly_true_cost || 0);
      if (sortBy === "year_built") return (b.year_built || 0) - (a.year_built || 0);
      return (b.overall_score || 0) - (a.overall_score || 0); // default: score
    });
  }, [homes, sortBy]);

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const isStale = (home) => home.last_deep_dive_at && (Date.now() - new Date(home.last_deep_dive_at).getTime()) > THIRTY_DAYS_MS;

  const filtered = useMemo(() => {
    let result = scoredHomes;
    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        result = result.filter(h => !h.status || h.status !== "eliminated");
      } else {
        result = result.filter(h => h.status === statusFilter);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(h => h.address?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q));
    }
    return result;
  }, [scoredHomes, search, statusFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await base44.entities.Home.delete(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["homes"] });
      if (expanded === deleteTarget.id) setExpanded(null);
      setDeleteTarget(null);
      toast.success("Home removed.");
    } catch (e) {
      toast.error("Failed to remove home. Please try again.");
    }
  };

  const toggle = (id) => setExpanded((prev) => (prev === id ? null : id));

  const handleRecalcAll = async () => {
    setRecalcing(true);
    cancelRecalcRef.current = false;
    toast.info("Refreshing commute times and VA rate...");
    try {
      // Step 0: Batch calculate commute times
      try {
        await base44.functions.invoke('batchCalculateCommutes', {});
        await queryClient.invalidateQueries({ queryKey: ["homes"] });
        toast.success("Commute times updated.");
      } catch (e) {
        toast.warning(`Commute refresh skipped: ${e?.message?.slice(0, 60)}`);
      }

      // Step 1: Fetch live 30-Year VA rate (cached once per day)
      let liveRate = getCachedVARate();
      if (liveRate) {
        toast.info(`Using today's cached VA rate: ${(liveRate * 100).toFixed(3)}%`);
      } else {
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
            setCachedVARate(liveRate);
            toast.info(`Live VA rate: ${(liveRate * 100).toFixed(3)}% (cached for today) — recalculating ${homes.length} home${homes.length !== 1 ? "s" : ""}...`);
          } else {
            toast.info(`Rate fetch returned no valid value — using fallback ${(VA_RATE_DEFAULT * 100).toFixed(3)}%`);
          }
        } catch (e) {
          toast.warning(`Rate fetch failed — using fallback ${(VA_RATE_DEFAULT * 100).toFixed(3)}%. Reason: ${e?.message?.slice(0, 60) || "unknown"}`);
        }
      }

      // Step 2: Fetch fresh homes (commute times updated above) then recalc
      const freshHomes = queryClient.getQueryData(["homes"]) ?? homes;
      for (const home of freshHomes) {
        if (cancelRecalcRef.current) break;
        try {
          const result = scoreHome(home, liveRate);
          await base44.entities.Home.update(home.id, {
            // Preserve all deep-dive fields so a full-replace never wipes them
            conditional_consideration: home.conditional_consideration,
            criteria_score_notes: home.criteria_score_notes,
            estimated_monthly_cost: home.estimated_monthly_cost,
            offer_framework: home.offer_framework,
            flood_info: home.flood_info,
            home_insurance_monthly: home.home_insurance_monthly,
            utilities: home.utilities,
            market_context: home.market_context,
            analyst_note: home.analyst_note,
            footer_details: home.footer_details,
            tax_history: home.tax_history,
            price_history: home.price_history,
            dom_analysis: home.dom_analysis,
            last_deep_dive_at: home.last_deep_dive_at,
            // Recalculated scoring fields
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
        } catch (e) {
          console.error("Failed to update home during recalc:", home.address, e);
        }
      }
      if (!cancelRecalcRef.current) {
        await queryClient.invalidateQueries({ queryKey: ["homes"] });
        const usedRate = liveRate ?? VA_RATE_DEFAULT;
        toast.success(`All scores recalculated at ${(usedRate * 100).toFixed(3)}% VA rate${liveRate ? "" : " (fallback — live fetch failed)"}.`);
      }
    } finally {
      setRecalcing(false);
    }
  };

  return (
    <div>

      {/* Header */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              Homes
            </h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} home{filtered.length !== 1 ? "s" : ""} evaluated
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scoredHomes.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRecalcAll} disabled={recalcing}>
                <RefreshCw className={`w-4 h-4 ${recalcing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{recalcing ? "Refreshing..." : "Refresh All"}</span>
              </Button>
            )}
            <Link to="/sync">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Home</span>
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search homes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="toured">Toured</SelectItem>
              <SelectItem value="offer_made">Offer Made</SelectItem>
              <SelectItem value="under_contract">Under Contract</SelectItem>
              <SelectItem value="eliminated">Eliminated</SelectItem>
              <SelectItem value="all">All homes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 sm:w-40 gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Score (high→low)</SelectItem>
              <SelectItem value="price">Price (low→high)</SelectItem>
              <SelectItem value="price_desc">Price (high→low)</SelectItem>
              <SelectItem value="cost">True Cost (low→high)</SelectItem>
              <SelectItem value="year_built">Year Built (newest)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <div className="text-center py-20 bg-card border border-border rounded-xl">
          <p className="text-sm font-semibold text-destructive mb-1">Unable to load homes</p>
          <p className="text-xs text-muted-foreground">Check your connection and try refreshing the page.</p>
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
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 cursor-pointer transition-colors ${isOpen ? "bg-secondary" : "hover:bg-secondary/50"}`}
                  onClick={() => toggle(home.id)}
                >
                  {home.image_url && (
                    <img src={home.image_url} alt={home.address} className="w-14 h-14 rounded-md object-cover shrink-0" />
                  )}
                  <ScoreBadge score={home.overall_score || 0} size={42} />
                  <div className="flex-1 min-w-0">
                    <a
                      href={`https://www.zillow.com/homes/search?q=${encodeURIComponent(home.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm truncate text-primary hover:underline block"
                      onClick={e => e.stopPropagation()}
                    >
                      {home.address}
                    </a>
                    {home._scoreError && (
                      <span className="text-[10px] text-destructive font-medium">⚠ Scoring error — edit & re-save to fix</span>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {home.price ? fmt(home.price) : ""}
                      {home.bedrooms ? ` · ${home.bedrooms} bd` : ""}
                      {home.bathrooms ? ` · ${home.bathrooms} ba` : ""}
                      {home.sqft ? ` · ${home.sqft.toLocaleString()} sqft` : ""}
                      {home.year_built ? ` · ${home.year_built}` : ""}
                      {home.pool_status !== "private" && home.pool_status !== "community" ? " · no pool" : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {home.last_deep_dive_at && (
                        <p className="text-xs text-muted-foreground">
                          🔬 {new Date(home.last_deep_dive_at).toLocaleDateString()} {new Date(home.last_deep_dive_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {home.last_deep_dive_at && isStale(home) && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> data may be stale (30+ days)
                        </span>
                      )}
                      {!home.last_deep_dive_at && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">⚠ no deep dive yet</span>
                      )}
                      {!home.commute_verified && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">⏱ commute unverified</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${verdict.className}`}>
                    {verdict.label}
                  </span>
                  <span className={`text-muted-foreground text-sm transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}>▾</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground" onClick={e => e.stopPropagation()}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(home); }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Scorecard */}
                {isOpen && <HomeDetailScorecard home={home} />}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this home?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.address}</strong> will be permanently removed from your shortlist. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}