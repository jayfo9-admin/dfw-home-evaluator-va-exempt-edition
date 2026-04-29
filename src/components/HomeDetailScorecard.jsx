import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Edit2, Save, X } from "lucide-react";
import HomeFullReport from "./HomeFullReport";
import HomeEditForm from "./HomeEditForm";
import SchoolsCommutesTable from "./SchoolsCommutesTable";
import { toast } from "sonner";
import { scoreHome } from "@/lib/scoringEngine";

const CRITERIA = [
  { key: "must_haves", label: "Must-haves" },
  { key: "price_value", label: "Price value" },
  { key: "resale", label: "Resale" },
  { key: "commute", label: "Commute" },
  { key: "true_cost", label: "True cost" },
  { key: "build_quality", label: "Build quality" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active", className: "bg-blue-100 text-blue-800" },
  { value: "toured", label: "Toured", className: "bg-purple-100 text-purple-800" },
  { value: "offer_made", label: "Offer Made", className: "bg-amber-100 text-amber-800" },
  { value: "under_contract", label: "Under Contract", className: "bg-green-100 text-green-800" },
  { value: "eliminated", label: "Eliminated", className: "bg-red-100 text-red-800" },
];

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function CriteriaBar({ label, value }) {
  const pct = Math.min((value / 10) * 100, 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 70 ? "text-green-700" : pct >= 50 ? "text-amber-700" : "text-red-700";
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span className={`font-bold ${textColor}`}>{value}/10</span>
      </div>
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function HomeDetailScorecard({ home }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(home.notes || "");
  useEffect(() => { setNotes(home.notes || ""); }, [home.notes]);
  const [savingNotes, setSavingNotes] = useState(false);
  const queryClient = useQueryClient();

  // Always use live scores — memoized to avoid freezing on mobile
  const liveScored = useMemo(() => scoreHome(home), [home.id, home.price, home.sqft, home.bedrooms, home.bathrooms, home.hoa_monthly, home.pid_mud_annual, home.pid_type, home.pool_status, home.has_office, home.year_built, home.zip_code, home.school_district, home.builder, home.commute_collins_min, home.commute_coram_deo_min, home.resale_score, home.flood_info, home.home_insurance_monthly]);
  const scores = liveScored.scores;

  const verdict = liveScored.verdict;
  const homeIns = home.home_insurance_monthly || Math.max(250, Math.round((home.price || 0) * 0.005 / 12));
  const floodIns = home.flood_info?.flood_insurance_required ? (home.flood_info?.estimated_flood_insurance_monthly || 0) : 0;

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === (home.status || "active")) || STATUS_OPTIONS[0];

  const handleStatusChange = async (val) => {
    await base44.entities.Home.update(home.id, { status: val });
    queryClient.invalidateQueries({ queryKey: ["homes"] });
    toast.success(`Status updated to "${STATUS_OPTIONS.find(s => s.value === val)?.label}".`);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await base44.entities.Home.update(home.id, { notes });
      queryClient.invalidateQueries({ queryKey: ["homes"] });
      setEditingNotes(false);
      toast.success("Notes saved.");
    } catch (e) {
      toast.error("Failed to save notes. Please try again.");
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <>
      <div className="border-t border-border bg-secondary/30 px-5 py-4 space-y-4">
        {/* Monthly Cost Card */}
        {liveScored.monthly_true_cost > 0 && (
          <div className="bg-primary text-primary-foreground rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider opacity-90 mb-1">Est. True Monthly Cost</p>
            <p className="text-2xl font-bold mb-2">${liveScored.monthly_true_cost.toLocaleString()}/mo</p>
            <p className="text-xs opacity-75 leading-relaxed">
              P&I {fmt(liveScored.va_mortgage_pi || 0)} + HOA {fmt(home.hoa_monthly || 0)} + PID {fmt(Math.round((home.pid_mud_annual || 0) / 12))} + Ins {fmt(homeIns)}
              {floodIns > 0 && ` + Flood ${fmt(floodIns)}`}
              {liveScored.va_rate_used && (
                <span className="ml-2 inline-block bg-black/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">
                  VA {(liveScored.va_rate_used * 100).toFixed(3)}%
                </span>
              )}
            </p>
          </div>
        )}

        {/* Status + Edit row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select value={home.status || "active"} onValueChange={handleStatusChange}>
              <SelectTrigger className={`h-7 text-xs border-0 px-2 py-0 rounded-full font-semibold ${currentStatus.className}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.className}`}>{s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setEditOpen((v) => !v)}>
              <Edit2 className="w-3.5 h-3.5" />
              {editOpen ? "Close Edit" : "Edit Details"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setReportOpen(true)}>
              <FileText className="w-3.5 h-3.5" />
              Full Report
            </Button>
          </div>
        </div>

        {/* One-liner */}
        {verdict && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Verdict</p>
            <p className="text-sm text-foreground leading-relaxed">{verdict}</p>
          </div>
        )}

        {/* Commute unverified warning */}
        {!liveScored.commute_verified && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span><strong>Commute unverified</strong> — commute score is zip-tier estimate only. Measure actual drive to Collins Aerospace (3200 E Renner Rd) at <strong>7:30am Tuesday</strong> before deciding.</span>
          </div>
        )}

        {/* Criteria Bars */}
        <div>
          {CRITERIA.map((c) => (
            <CriteriaBar key={c.key} label={c.label} value={scores[c.key] || 0} />
          ))}
        </div>

        {/* Pros / Cons / Schools */}
        {((liveScored.pros?.length > 0) || (liveScored.cons?.length > 0)) && (
          <div className="grid grid-cols-3 gap-4">
            {liveScored.pros?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Pros</p>
                <div className="space-y-1.5">
                  {liveScored.pros.map((p, i) => (
                    <p key={i} className={`text-xs pl-2 border-l-2 border-green-500 leading-snug ${i === 0 ? 'font-bold text-foreground' : 'text-foreground'}`}>{p}</p>
                  ))}
                </div>
              </div>
            )}
            {liveScored.cons?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Cons</p>
                <div className="space-y-1.5">
                  {liveScored.cons.map((c, i) => (
                    <p key={i} className="text-xs text-foreground pl-2 border-l-2 border-red-500 leading-snug">{c}</p>
                  ))}
                </div>
              </div>
            )}
            <div>
              <SchoolsCommutesTable home={home} />
            </div>
          </div>
        )}

        {/* Cautions */}
        {liveScored.cautions?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Cautions</p>
            <div className="space-y-1">
              {liveScored.cautions.map((c, i) => (
                <p key={i} className="text-xs text-amber-800 flex gap-2">
                  <span>⚠</span><span>{c}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Red Flags */}
        {liveScored.red_flags?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2">Red Flags</p>
            <div className="space-y-1">
              {liveScored.red_flags.map((f, i) => (
                <p key={i} className="text-xs text-red-800 flex gap-2">
                  <span>🚩</span><span>{f}</span>
                </p>
              ))}
            </div>
          </div>
        )}



        {/* Offer Framework */}
        {home.offer_framework && (home.offer_framework.opening_offer || home.offer_framework.target_close || home.offer_framework.walk_away) && (
          <div className="bg-primary text-primary-foreground rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider opacity-80 mb-2 font-semibold">Offer Framework</p>
            <div className="space-y-1.5">
              {home.offer_framework.opening_offer && (
                <div className="flex justify-between text-sm border-b border-white/20 pb-1.5">
                  <span className="opacity-70">Opening Offer</span>
                  <span className="font-semibold">{home.offer_framework.opening_offer}</span>
                </div>
              )}
              {home.offer_framework.target_close && (
                <div className="flex justify-between text-sm border-b border-white/20 pb-1.5">
                  <span className="opacity-70">Target Close</span>
                  <span className="font-semibold">{home.offer_framework.target_close}</span>
                </div>
              )}
              {home.offer_framework.walk_away && (
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">Walk-Away</span>
                  <span className="font-semibold text-red-300">{home.offer_framework.walk_away}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Market Context / Forensic History */}
        {home.market_context && (
          <div className="bg-card border border-border rounded-lg p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Market Context & Price History</p>
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{home.market_context}</p>
          </div>
        )}

        {/* Analyst note */}
        {home.analyst_note && (
          <div className="bg-card border border-border rounded-lg p-3 text-xs text-foreground leading-relaxed">
            {home.analyst_note}
          </div>
        )}

        {/* Notes section */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Notes</p>
            {!editingNotes && (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setEditingNotes(true)}>
                <Edit2 className="w-3 h-3" />{notes ? "Edit" : "Add Note"}
              </Button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tour notes, observations, questions to ask agent..."
                className="text-sm min-h-[80px]"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="gap-1.5 text-xs h-7">
                  <Save className="w-3 h-3" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingNotes(false); setNotes(home.notes || ""); }} className="text-xs h-7">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : notes ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">No notes yet. Click "Add Note" to record observations.</p>
          )}
        </div>
      </div>

      {/* Edit form inline below scorecard */}
      {editOpen && <HomeEditForm home={home} onClose={() => setEditOpen(false)} />}

      <HomeFullReport home={home} open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  );
}