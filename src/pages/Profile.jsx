import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scoreHome } from "@/lib/scoringEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserCircle, Shield, DollarSign, MapPin, GraduationCap, Briefcase, Heart, RefreshCw, Loader2, Edit2, Check, X, Percent } from "lucide-react";
import { VA_RATE_DEFAULT } from "@/lib/scoringEngine";
import { toast } from "sonner";

const VA_RATE_STORAGE_KEY = "dfw_manual_va_rate";

const DEFAULT_CRITERIA = [
  { icon: Shield, label: "VA Status", key: "vaStatus", value: "100% P&T Disabled Veteran", detail: "$0 Property Tax in Texas", color: "text-green-600" },
  { icon: DollarSign, label: "Budget Range", key: "budgetRange", value: "Sweet spot: $500k, Hard cap: $700k", detail: "Closer to $500k = better value & scoring", color: "text-accent" },
  { icon: MapPin, label: "Target Area", key: "targetArea", value: "Plano, Richardson, Rockwall, Allen, McKinney", detail: "Primary tier 1-2 zip codes", color: "text-blue-600" },
  { icon: Briefcase, label: "Work Location", key: "workLocation", value: "Collins Aerospace — 3200 E Renner Rd", detail: "≤ 30 min commute required", color: "text-purple-600" },
  { icon: GraduationCap, label: "School", key: "school", value: "Coram Deo Academy — 1301 Abrams Rd", detail: "≤ 30 min commute for teenagers", color: "text-orange-600" },
  { icon: Heart, label: "Family", key: "family", value: "5 (couple + 3 teens)", detail: "Need 4+ BR, office, ideally a pool", color: "text-red-500" },
];

// Derive scoring rubric from the engine itself so it never goes stale
// scoreHome returns pillars with { score, max, weight, label } per pillar
const RUBRIC_DESCRIPTIONS = {
  mustHaves:    "4+ BR, 2.5+ BA, Office, Pool Rule (>$500k needs private pool)",
  priceValue:   "Under $500k = perfect, over $700k = 0",
  resale:       "School district quality — Plano/Rockwall top tier",
  commute:      "≤ 30 min to Collins Aerospace + Coram Deo",
  trueCost:     "VA P&I + HOA + PID/12 + Insurance ($0 tax, $0 PMI)",
  buildQuality: "Year built + builder reputation — age drives inspection risk",
};

export default function Profile() {
  const [patterns, setPatterns] = useState(() => {
    try { return localStorage.getItem("dfw_shortlist_patterns") || ""; } catch { return ""; }
  });
  const [vaRateInput, setVaRateInput] = useState(() => {
    try {
      const stored = localStorage.getItem(VA_RATE_STORAGE_KEY);
      return stored || (VA_RATE_DEFAULT * 100).toFixed(3);
    } catch { return (VA_RATE_DEFAULT * 100).toFixed(3); }
  });
  const [pLoading, setPLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [saving, setSaving] = useState(false);
  const savedCriteriaRef = useRef(DEFAULT_CRITERIA);
  const queryClient = useQueryClient();

  const { data: homes = [] } = useQuery({
    queryKey: ["homes"],
    queryFn: () => base44.entities.Home.list("-created_date", 100),
  });

  // Fix 3: memoize so it doesn't recalc on every render
  const scoredHomes = useMemo(() => homes.map((h) => ({ ...h, ...scoreHome(h) })), [homes]);

  // Fix 1: derive rubric from a real scoreHome() call on a dummy home so weights are always accurate
  const liveRubric = useMemo(() => {
    const result = scoreHome({ price: 550000, bedrooms: 4, bathrooms: 3, sqft: 3200, pool_status: "private", has_office: true, year_built: 2020, zip_code: "75094" });
    return Object.entries(result.pillars || {}).map(([key, p]) => ({
      key,
      label: p.label,
      weight: `${p.weight}%`,
      desc: RUBRIC_DESCRIPTIONS[key] || "",
    }));
  }, []);

  useEffect(() => {
    const loadCriteria = async () => {
      try {
        const user = await base44.auth.me();
        if (user.buyer_criteria) {
          savedCriteriaRef.current = user.buyer_criteria;
          setCriteria(user.buyer_criteria);
        }
      } catch (e) {
        // Silent fallback to defaults
      }
    };
    loadCriteria();
  }, []);

  const handleSaveCriteria = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ buyer_criteria: criteria });
      savedCriteriaRef.current = criteria;
      setEditMode(false);
    } catch (e) {
      console.error("Failed to save criteria:", e);
    } finally {
      setSaving(false);
    }
  };

  const updateCriterion = (key, field, value) => {
    setCriteria(c => c.map(item => item.key === key ? { ...item, [field]: value } : item));
  };

  const getPatterns = async () => {
    if (scoredHomes.length < 2) return;
    setPLoading(true);
    try {
      const summary = scoredHomes
        .map((h) => [
          `Address: ${h.address}`,
          `Price: $${(h.price || 0).toLocaleString()}`,
          `True monthly cost: $${(h.monthly_true_cost || 0).toLocaleString()}/mo`,
          `ZIP: ${h.zip_code || "?"}`,
          `ISD: ${h.school_district || "unknown"}`,
          `Score: ${h.overall_score}/100`,
          `Pool: ${h.pool_status || "none"}`,
          `Pros: ${(h.pros || []).join("; ")}`,
          `Cons: ${(h.cons || []).join("; ")}`,
        ].join(" | "))
        .join("\n");
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify 3-5 sharp patterns from these saved homes to refine my DFW home search for a 100% P&T Disabled Veteran. Focus on price vs true cost, school districts, pool availability, and commute tradeoffs. Be direct and specific.\n\n${summary}`,
      });
      setPatterns(result);
      try { localStorage.setItem("dfw_shortlist_patterns", result); } catch {}
    } catch (e) {
      console.error("Pattern analysis failed:", e);
    } finally {
      setPLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <UserCircle className="w-6 h-6" />
            Buyer Profile
          </h2>
          <p className="text-sm text-muted-foreground">Criteria powering every home evaluation.</p>
        </div>
        {!editMode && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditMode(true)}>
            <Edit2 className="w-4 h-4" />
            Edit
          </Button>
        )}
      </div>

      {/* Criteria */}
      <div className="grid gap-4 mb-8">
        {criteria.map(({ icon: Icon, label, key, value, detail, color }) => (
          <Card key={key}>
            <CardContent className="flex items-start gap-4 p-4">
              <div className={`p-2.5 rounded-lg bg-secondary ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                {editMode ? (
                  <div className="space-y-2 mt-2">
                    <Input value={value} onChange={(e) => updateCriterion(key, "value", e.target.value)} placeholder="Main value" />
                    <Input value={detail} onChange={(e) => updateCriterion(key, "detail", e.target.value)} placeholder="Detail" />
                  </div>
                ) : (
                  <>
                    <p className="font-heading font-semibold">{value}</p>
                    <p className="text-sm text-muted-foreground">{detail}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editMode && (
        <div className="flex gap-2 mb-8">
          <Button onClick={handleSaveCriteria} disabled={saving} className="gap-2 flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Criteria
          </Button>
          <Button variant="outline" onClick={() => { setCriteria(savedCriteriaRef.current); setEditMode(false); }} className="gap-2 flex-1">
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      )}

      {/* Scoring Rubric */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Scoring Rubric</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {liveRubric.map(({ key, label, weight, desc }) => (
              <div key={key} className="flex items-start gap-3">
                <Badge variant="secondary" className="font-heading font-bold shrink-0 min-w-[48px] justify-center">{weight}</Badge>
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Patterns from shortlist */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Patterns from your shortlist</CardTitle>
        </CardHeader>
        <CardContent>
          {homes.length < 2 ? (
            <p className="text-sm text-muted-foreground">Save at least 2 homes to discover patterns.</p>
          ) : pLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
            </div>
          ) : patterns ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{patterns}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Click below to generate patterns.</p>
          )}
          {homes.length >= 2 && !pLoading && (
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={getPatterns}>
              <RefreshCw className="w-4 h-4" />
              {patterns ? "Refresh patterns" : "Generate patterns"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* VA Rate */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Percent className="w-4 h-4" />
            VA Loan Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Set the current 30-year VA loan interest rate. Used in all monthly cost calculations across every home.</p>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              step="0.001"
              min="2"
              max="15"
              value={vaRateInput}
              onChange={(e) => setVaRateInput(e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button size="sm" onClick={() => {
              const parsed = parseFloat(vaRateInput);
              if (parsed > 2 && parsed < 15) {
                localStorage.setItem(VA_RATE_STORAGE_KEY, vaRateInput);
                localStorage.setItem("dfw_va_rate_cache", JSON.stringify({ rate: parsed / 100, date: new Date().toISOString().slice(0, 10) }));
                toast.success(`VA rate set to ${vaRateInput}%. Reload the page to see updated costs.`);
              }
            }} className="gap-1.5">
              <Check className="w-3.5 h-3.5" /> Apply
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Default: {(VA_RATE_DEFAULT * 100).toFixed(3)}%</p>
        </CardContent>
      </Card>

      {/* VA Note */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <p className="font-heading font-semibold text-green-900">VA Exemption Advantage</p>
            <p className="text-sm text-green-800 mt-1">
              As a 100% P&T disabled veteran in Texas, your property tax is <strong>$0</strong>.
              This saves you thousands per year and dramatically lowers your true monthly cost compared to non-exempt buyers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}