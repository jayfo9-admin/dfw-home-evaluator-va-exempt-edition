import React, { useState } from "react";
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
  const [savingNotes, setSavingNotes] = useState(false);
  const queryClient = useQueryClient();

  // Always use live scores — never stale stored values
  const liveScored = scoreHome(home);
  const scores = liveScored.scores;

  const verdict = home.one_line || home.verdict || "";
  const homeIns = home.home_insurance_monthly || Math.round((home.price || 0) * 0.001 / 12);
  const floodIns = home.flood_info?.flood_insurance_required ? (home.flood_info?.estimated_flood_insurance_monthly || 0) : 0;
  const costNote = home.monthly_cost_note ||
    (home.monthly_true_cost ? `Est. true monthly cost: ${fmt(home.monthly_true_cost)}/mo (VA P&I ${fmt(home.va_mortgage_pi || 0)} + HOA $${home.hoa_monthly || 0} + PID $${Math.round((home.pid_mud_annual || 0) / 12)} + Ins $${homeIns}${floodIns > 0 ? ` + Flood $${floodIns}` : ""}, $0 tax)` : null);

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === (home.status || "active")) || STATUS_OPTIONS[0];

  const handleStatusChange = async (val) => {
    await base44.entities.Home.update(home.id, { status: val });
    queryClient.invalidateQueries({ queryKey: ["homes"] });
    toast.success(`Status updated to "${STATUS_OPTIONS.find(s => s.value === val)?.label}".`);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await base44.entities.Home.update(home.id, { notes });
    queryClient.invalidateQueries({ queryKey: ["homes"] });
    setSavingNotes(false);
    setEditingNotes(false);
    toast.success("Notes saved.");
  };

  return (
    <>
      <div className="border-t border-border bg-secondary/30 px-5 py-4 space-y-4">
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

        {/* Score + One-liner */}
        {verdict && (
          <div className="flex items-start gap-3">
            <div
              className={`rounded-full border-2 flex items-center justify-center font-bold shrink-0 text-sm
                ${(home.overall_score || 0) >= 75 ? "border-green-500 bg-green-50 text-green-800"
                : (home.overall_score || 0) >= 55 ? "border-amber-500 bg-amber-50 text-amber-800"
                : "border-red-500 bg-red-50 text-red-800"}`}
              style={{ width: 54, height: 54, fontSize: 15 }}
            >
              {home.overall_score || 0}
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">One-line verdict</p>
              <p className="text-sm text-foreground leading-relaxed">{verdict}</p>
            </div>
          </div>
        )}

        {/* Commute unverified warning */}
        {!home.commute_verified && (
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
        {((home.pros?.length > 0) || (home.cons?.length > 0)) && (
          <div className="grid grid-cols-3 gap-4">
            {home.pros?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Pros</p>
                <div className="space-y-1.5">
                  {home.pros.map((p, i) => (
                    <p key={i} className={`text-xs pl-2 border-l-2 border-green-500 leading-snug ${i === 0 ? 'font-bold text-foreground' : 'text-foreground'}`}>{p}</p>
                  ))}
                </div>
              </div>
            )}
            {home.cons?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Cons</p>
                <div className="space-y-1.5">
                  {home.cons.map((c, i) => (
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

        {/* Red Flags */}
        {home.red_flags?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2">Red Flags</p>
            <div className="space-y-1">
              {home.red_flags.map((f, i) => (
                <p key={i} className="text-xs text-red-800 flex gap-2">
                  <span>⚠</span><span>{f}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Monthly cost note + VA rate indicator */}
        {costNote && (
          <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
            💰 {costNote}
            {home.va_rate_used && (
              <span className="ml-2 inline-block bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold">
                VA {(home.va_rate_used * 100).toFixed(3)}%
              </span>
            )}
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