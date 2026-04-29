import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, CheckCircle, XCircle, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { scoreHome } from "@/lib/scoringEngine";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const CRITERIA = [
  { key: "must_haves", label: "Must-Haves Met" },
  { key: "price_value", label: "Price / Value" },
  { key: "resale", label: "Resale Potential" },
  { key: "commute", label: "Commute" },
  { key: "true_cost", label: "True Cost (PID/HOA)" },
  { key: "build_quality", label: "Build Quality / Age" },
];

function ScoreBar({ label, value }) {
  const pct = Math.min((value / 10) * 100, 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 70 ? "text-green-700" : pct >= 50 ? "text-amber-700" : "text-red-700";
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className={`font-bold ${textColor}`}>{value}/10</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Native jsPDF Report Builder ─────────────────────────────────────────────
function buildPDF(home) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const ML = 14;
  const MR = 14;
  const CW = W - ML - MR;
  const scores = home.scores || {};

  let y = 16;

  const checkPage = (needed = 8) => {
    if (y + needed > H - 14) { pdf.addPage(); y = 16; }
  };

  const sectionHeader = (title) => {
    checkPage(12);
    y += 3;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(ML, y, W - MR, y);
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(title.toUpperCase(), ML, y);
    y += 5;
    pdf.setTextColor(20, 20, 20);
  };

  const row = (label, value, labelColor = [100, 100, 100]) => {
    checkPage(7);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...labelColor);
    pdf.text(label, ML, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(20, 20, 20);
    const val = String(value || "—");
    const lines = pdf.splitTextToSize(val, CW - 58);
    lines.forEach((line, i) => {
      if (i > 0) { checkPage(6); }
      pdf.text(line, ML + 55, y + i * 5);
    });
    y += Math.max(6, lines.length * 5);
  };

  const bodyText = (text, options = {}) => {
    if (!text) return;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(options.size || 9);
    pdf.setTextColor(...(options.color || [30, 30, 30]));
    const lines = pdf.splitTextToSize(String(text), CW - (options.indent || 0));
    lines.forEach(line => {
      checkPage(6);
      pdf.text(line, ML + (options.indent || 0), y);
      y += 5;
    });
    if (options.gap !== false) y += 1;
  };

  const scoreBar = (label, value, note) => {
    checkPage(14);
    const pct = Math.min(value / 10, 1);
    const barW = CW - 20;
    const barH = 3;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(20, 20, 20);
    pdf.text(label, ML, y);
    const scoreColor = pct >= 0.7 ? [22, 101, 52] : pct >= 0.5 ? [133, 77, 14] : [153, 27, 27];
    pdf.setTextColor(...scoreColor);
    pdf.text(`${value}/10`, W - MR, y, { align: "right" });
    y += 4;
    pdf.setFillColor(220, 220, 220);
    pdf.roundedRect(ML, y, barW, barH, 1, 1, "F");
    const fillColor = pct >= 0.7 ? [34, 197, 94] : pct >= 0.5 ? [245, 158, 11] : [239, 68, 68];
    pdf.setFillColor(...fillColor);
    if (pct > 0) pdf.roundedRect(ML, y, barW * pct, barH, 1, 1, "F");
    y += 6;
    if (note) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const noteLines = pdf.splitTextToSize(note, CW - 4);
      noteLines.forEach(line => {
        checkPage(5);
        pdf.text(line, ML + 2, y);
        y += 4.5;
      });
    }
    y += 2;
  };

  const bulletList = (items, color = [30, 30, 30], prefix = "•") => {
    items.forEach(item => {
      const lines = pdf.splitTextToSize(String(item), CW - 6);
      lines.forEach((line, i) => {
        checkPage(6);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...color);
        pdf.text(i === 0 ? prefix : " ", ML + 1, y);
        pdf.text(line, ML + 5, y);
        y += 5;
      });
    });
    y += 1;
  };

  const flagItem = (text) => {
    const lines = pdf.splitTextToSize(String(text), CW - 8);
    const boxH = lines.length * 5 + 5;
    checkPage(boxH + 2);
    pdf.setFillColor(254, 226, 226);
    pdf.setDrawColor(252, 165, 165);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(ML, y - 3, CW, boxH, 2, 2, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(127, 29, 29);
    lines.forEach((line, i) => {
      pdf.text((i === 0 ? "! " : "  ") + line, ML + 2, y + i * 5);
    });
    y += boxH + 2;
  };

  // ── Header ────────────────────────────────────────────────────────────────
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(20, 20, 20);
  pdf.text("DFW Home Evaluator — Full Report", ML, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `${home.address}${home.city ? `, ${home.city}` : ""}${home.zip_code ? ` ${home.zip_code}` : ""} · Generated ${new Date().toLocaleDateString()} · 100% P&T Disabled Veteran`,
    ML, y
  );
  y += 8;

  // ── Score badge ───────────────────────────────────────────────────────────
  const score = home.overall_score || 0;
  const badgeColor = score >= 75 ? [220, 252, 231] : score >= 55 ? [254, 249, 195] : [254, 226, 226];
  const badgeBorder = score >= 75 ? [34, 197, 94] : score >= 55 ? [245, 158, 11] : [239, 68, 68];
  const badgeText = score >= 75 ? [22, 101, 52] : score >= 55 ? [133, 77, 14] : [153, 27, 27];
  pdf.setFillColor(...badgeColor);
  pdf.setDrawColor(...badgeBorder);
  pdf.setLineWidth(0.8);
  pdf.circle(ML + 8, y + 5, 8, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...badgeText);
  pdf.text(String(score), ML + 8, y + 6.5, { align: "center" });
  if (home.one_line || home.verdict) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(20, 20, 20);
    pdf.text(home.one_line || home.verdict, ML + 20, y + 3);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text("Overall Score / Verdict", ML + 20, y + 8);
  }
  y += 20;

  // ── Overview ──────────────────────────────────────────────────────────────
  sectionHeader("Overview");
  [
    ["List Price", home.price ? fmt(home.price) : "—"],
    ["Sqft", home.sqft ? home.sqft.toLocaleString() : "—"],
    ["Year Built", home.year_built || "—"],
    ["Beds / Baths", `${home.bedrooms || "—"} / ${home.bathrooms || "—"}`],
    ["Pool", home.pool_status || "—"],
    ["Builder", home.builder || "Unknown"],
    ["HOA/mo", home.hoa_monthly ? `$${home.hoa_monthly}` : "$0"],
    ["PID/yr", home.pid_mud_annual ? `$${home.pid_mud_annual}` : "$0"],
    ["City / Zip", `${home.city || "—"} ${home.zip_code || ""}`],
    ["School District", home.school_district || "—"],
  ].forEach(([l, v]) => row(l, v));
  y += 2;

  // ── Criteria Scores ───────────────────────────────────────────────────────
  sectionHeader("Criteria Scores");
  const noteKeys = ["must_haves", "price_value", "resale_potential", "commute", "true_cost", "build_quality"];
  CRITERIA.forEach((c, i) => {
    scoreBar(c.label, scores[c.key] || 0, home.criteria_score_notes?.[noteKeys[i]]);
  });

  // ── Conditional Consideration ─────────────────────────────────────────────
  if (home.conditional_consideration) {
    sectionHeader("Conditional Consideration");
    bodyText(home.conditional_consideration, { color: [120, 53, 15] });
  }

  // ── Pros ──────────────────────────────────────────────────────────────────
  if (home.pros?.length > 0) {
    sectionHeader("Pros");
    bulletList(home.pros, [21, 128, 61], "+");
  }

  // ── Cons ──────────────────────────────────────────────────────────────────
  if (home.cons?.length > 0) {
    sectionHeader("Cons");
    bulletList(home.cons, [185, 28, 28], "-");
  }

  // ── Red Flags ─────────────────────────────────────────────────────────────
  if (home.red_flags?.length > 0) {
    sectionHeader("Red Flags / Open Items");
    home.red_flags.forEach(flagItem);
  }

  // ── Monthly Cost ──────────────────────────────────────────────────────────
  const emc = home.estimated_monthly_cost;
  if (emc?.total) {
    sectionHeader("Estimated True Monthly Cost (Detailed)");
    [
      ["P&I (at list price)", emc.pi_list_price],
      ["P&I (at offer price)", emc.pi_offer_price],
      ["Property Tax", emc.property_tax],
      ["PMI", emc.pmi],
      ["HOA", emc.hoa],
      ["PID", emc.pid],
      ["Home Insurance", emc.home_insurance],
      ["Flood Insurance", emc.flood_insurance],
    ].filter(([, v]) => v).forEach(([l, v]) => row(l, v));
    row("TOTAL (at offer)", emc.total, [22, 101, 52]);
  } else {
    const costNote = home.monthly_cost_note ||
      (home.monthly_true_cost ? `VA P&I ${fmt(home.va_mortgage_pi || 0)}/mo + HOA $${home.hoa_monthly || 0}/mo + PID $${Math.round((home.pid_mud_annual || 0) / 12)}/mo = ${fmt(home.monthly_true_cost)}/mo ($0 tax, $0 PMI)` : null);
    if (costNote) {
      sectionHeader("Estimated True Monthly Cost");
      bodyText(costNote);
    }
  }

  // ── Offer Framework ───────────────────────────────────────────────────────
  if (home.offer_framework?.opening_offer) {
    sectionHeader("Offer Framework");
    [
      ["Opening Offer", home.offer_framework.opening_offer],
      ["Target Close", home.offer_framework.target_close],
      ["Walk-Away", home.offer_framework.walk_away],
    ].filter(([, v]) => v).forEach(([l, v]) => row(l, v));
  }

  // ── Flood Zone ────────────────────────────────────────────────────────────
  const fi = home.flood_info;
  if (fi) {
    sectionHeader("Flood Zone & Insurance");
    [
      ["FEMA Zone", fi.fema_zone || "Unknown"],
      ["Flood Risk", fi.flood_risk || "unknown"],
      ["Insurance Required", fi.flood_insurance_required ? "YES — lender-mandated" : "Not required"],
      ["Est. Flood Insurance/mo", fi.estimated_flood_insurance_monthly > 0 ? `$${fi.estimated_flood_insurance_monthly}/mo` : "$0 (minimal risk)"],
    ].forEach(([l, v]) => row(l, v, fi.flood_insurance_required && l === "Insurance Required" ? [153, 27, 27] : [100, 100, 100]));
    if (fi.notes) bodyText(fi.notes, { color: [100, 100, 100], size: 8 });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  const u = home.utilities;
  if (u?.internet || u?.electricity || u?.water_sewer || u?.gas_heating) {
    sectionHeader("Utilities & Infrastructure");
    [
      ["Internet / Fiber", u.internet],
      ["Electricity", u.electricity],
      ["Water & Sewer", u.water_sewer],
      ["Gas / Heating", u.gas_heating],
    ].filter(([, v]) => v).forEach(([l, v]) => row(l, v));
    if (u.concerns) bodyText(`! ${u.concerns}`, { color: [154, 52, 18], size: 8 });
  }

  // ── Market Context ────────────────────────────────────────────────────────
  if (home.market_context) {
    sectionHeader("Forensic History & Market Context");
    bodyText(home.market_context, { size: 8, color: [50, 50, 50] });
  }

  // ── Analyst Note ─────────────────────────────────────────────────────────
  if (home.analyst_note) {
    sectionHeader("Analyst Note");
    bodyText(home.analyst_note);
  }

  // ── Property Details ──────────────────────────────────────────────────────
  if (home.footer_details) {
    sectionHeader("Property Details");
    bodyText(home.footer_details, { size: 8, color: [100, 100, 100] });
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (home.notes) {
    sectionHeader("Notes");
    bodyText(home.notes);
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(150, 150, 150);
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.line(ML, H - 10, W - MR, H - 10);
    pdf.text(`DFW Home Evaluator · 100% P&T Disabled Veteran · ${new Date().toLocaleDateString()}`, ML, H - 6);
    pdf.text(`Page ${p} of ${totalPages}`, W - MR, H - 6, { align: "right" });
  }

  return pdf;
}

// ─── React Component ──────────────────────────────────────────────────────────
export default function HomeFullReport({ home, open, onClose }) {
  const [exporting, setExporting] = useState(false);
  if (!home) return null;

  // Always use live-computed scores so the report matches the scorecard sidebar
  const liveScored = scoreHome(home);
  const liveHome = { ...home, ...liveScored, scores: liveScored.scores };

  const scores = liveScored.scores;
  const costNote = home.monthly_cost_note ||
    (liveScored.monthly_true_cost ? `VA P&I ${fmt(liveScored.va_mortgage_pi || 0)}/mo + HOA $${home.hoa_monthly || 0}/mo + PID $${Math.round((home.pid_mud_annual || 0) / 12)}/mo = ${fmt(liveScored.monthly_true_cost)}/mo ($0 property tax, $0 PMI)` : null);

  const handleExportPDF = () => {
    setExporting(true);
    try {
      const pdf = buildPDF(liveHome);
      const filename = `DFW-Report-${home.address.replace(/[^a-z0-9]/gi, "-").slice(0, 40)}.pdf`;
      pdf.save(filename);
      toast.success("PDF downloaded.");
    } catch (err) {
      toast.error("PDF export failed: " + (err?.message || "unknown error"));
    }
    setExporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <DialogTitle className="font-heading text-lg leading-snug">{home.address}</DialogTitle>
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {exporting ? "Generating..." : "Export PDF"}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-0 pt-2">
          {/* Overview */}
          <Section title="Overview">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm mb-4">
              {[
                ["List Price", home.price ? fmt(home.price) : "—"],
                ["Sqft", home.sqft ? home.sqft.toLocaleString() : "—"],
                ["Year Built", home.year_built || "—"],
                ["Beds / Baths", `${home.bedrooms || "—"} / ${home.bathrooms || "—"}`],
                ["Pool", home.pool_status || "—"],
                ["Builder", home.builder || "Unknown"],
                ["HOA/mo", home.hoa_monthly ? `$${home.hoa_monthly}` : "$0"],
                ["PID/yr", home.pid_mud_annual ? `$${home.pid_mud_annual}` : "$0"],
                ["City / Zip", `${home.city || "—"} ${home.zip_code || ""}`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg">
              <div
                className={`rounded-full border-2 flex items-center justify-center font-bold shrink-0
                  ${liveScored.overall_score >= 85 ? "border-green-500 bg-green-50 text-green-800"
                  : liveScored.overall_score >= 65 ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-red-500 bg-red-50 text-red-800"}`}
                style={{ width: 64, height: 64, fontSize: 18 }}
              >
                {liveScored.overall_score}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Overall Score</p>
                <p className="font-heading font-semibold">{liveScored.verdict || "—"}</p>
              </div>
            </div>
          </Section>

          {/* Criteria Scores */}
          <Section title="Criteria Scores">
            {CRITERIA.map((c, i) => {
              const noteKey = ["must_haves","price_value","resale_potential","commute","true_cost","build_quality"][i];
              const note = home.criteria_score_notes?.[noteKey];
              return (
                <div key={c.key}>
                  <ScoreBar label={c.label} value={scores[c.key] || 0} />
                  {note && <p className="text-xs text-muted-foreground -mt-2 mb-3 leading-snug">{note}</p>}
                </div>
              );
            })}
          </Section>

          {/* Pros / Cons */}
          {((liveScored.pros?.length > 0) || (liveScored.cons?.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {liveScored.pros?.length > 0 && (
                <Section title="Pros">
                  <div className="space-y-2">
                    {liveScored.pros.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                        <p className="text-sm leading-snug">{p}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {liveScored.cons?.length > 0 && (
                <Section title="Cons">
                  <div className="space-y-2">
                    {liveScored.cons.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm leading-snug">{c}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Red Flags */}
          {liveScored.red_flags?.length > 0 && (
            <Section title="Red Flags / Open Items">
              <div className="space-y-2">
                {liveScored.red_flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <Flag className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-900">{f}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Conditional Consideration */}
          {home.conditional_consideration && (
            <Section title="Conditional Consideration">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 leading-relaxed">
                {home.conditional_consideration}
              </div>
            </Section>
          )}

          {/* Detailed Monthly Cost from AI */}
          {home.estimated_monthly_cost?.total && (
            <Section title="Estimated True Monthly Cost (Detailed)">
              <div className="space-y-1 text-sm">
                {[
                  ["P&I (at list price)", home.estimated_monthly_cost.pi_list_price],
                  ["P&I (at offer price)", home.estimated_monthly_cost.pi_offer_price],
                  ["Property Tax", home.estimated_monthly_cost.property_tax],
                  ["PMI", home.estimated_monthly_cost.pmi],
                  ["HOA", home.estimated_monthly_cost.hoa],
                  ["PID", home.estimated_monthly_cost.pid],
                  ["Home Insurance", home.estimated_monthly_cost.home_insurance],
                  ["Flood Insurance", home.estimated_monthly_cost.flood_insurance],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold text-green-700">
                  <span>TOTAL (at offer)</span>
                  <span>{home.estimated_monthly_cost.total}</span>
                </div>
              </div>
            </Section>
          )}

          {/* Fallback cost note */}
          {!home.estimated_monthly_cost?.total && costNote && (
            <Section title="Estimated True Monthly Cost">
              <div className="bg-secondary rounded-lg p-4 text-sm leading-relaxed">{costNote}</div>
            </Section>
          )}

          {/* Offer Framework */}
          {home.offer_framework?.opening_offer && (
            <Section title="Offer Framework">
              <div className="bg-primary text-primary-foreground rounded-lg p-4 space-y-2">
                {[
                  ["Opening Offer", home.offer_framework.opening_offer],
                  ["Target Close", home.offer_framework.target_close],
                  ["Walk-Away", home.offer_framework.walk_away],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm border-b border-white/20 pb-2 last:border-0">
                    <span className="opacity-70">{label}</span>
                    <span className="font-semibold">{val}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Market Context */}
          {home.market_context && (
            <Section title="Forensic History & Market Context">
              <pre className="text-xs leading-relaxed whitespace-pre-wrap bg-secondary rounded-lg p-4 font-sans">
                {home.market_context}
              </pre>
            </Section>
          )}

          {/* Analyst Note */}
          {home.analyst_note && (
            <Section title="Analyst Note">
              <div className="bg-card border border-border rounded-lg p-4 text-sm leading-relaxed">
                {home.analyst_note}
              </div>
            </Section>
          )}

          {/* Flood Zone */}
          {home.flood_info && (
            <Section title="Flood Zone & Insurance">
              <div className={`rounded-lg p-3 border text-sm space-y-1 ${home.flood_info.flood_risk === "high" ? "bg-red-50 border-red-300" : home.flood_info.flood_risk === "moderate" ? "bg-orange-50 border-orange-300" : "bg-secondary border-border"}`}>
                {[
                  ["FEMA Zone", home.flood_info.fema_zone || "Unknown"],
                  ["Flood Risk", home.flood_info.flood_risk || "unknown"],
                  ["Insurance Required", home.flood_info.flood_insurance_required ? "YES — lender-mandated" : "Not required"],
                  ["Est. Flood Insurance/mo", home.flood_info.estimated_flood_insurance_monthly > 0 ? `$${home.flood_info.estimated_flood_insurance_monthly}/mo` : "$0 (minimal risk)"],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between border-b border-border/50 py-1 last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${label === "Insurance Required" && home.flood_info.flood_insurance_required ? "text-red-600 font-bold" : ""}`}>{val}</span>
                  </div>
                ))}
                {home.flood_info.notes && <p className="text-xs text-muted-foreground pt-1">{home.flood_info.notes}</p>}
              </div>
            </Section>
          )}

          {/* Utilities */}
          {home.utilities?.internet && (
            <Section title="Utilities & Infrastructure">
              <div className="space-y-1 text-sm">
                {[
                  ["Internet / Fiber", home.utilities.internet],
                  ["Electricity", home.utilities.electricity],
                  ["Water & Sewer", home.utilities.water_sewer],
                  ["Gas / Heating", home.utilities.gas_heating],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-border">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-right">{val}</span>
                  </div>
                ))}
                {home.utilities.concerns && (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                    <p className="text-xs text-orange-900">⚠️ {home.utilities.concerns}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Footer / Property Details */}
          {home.footer_details && (
            <Section title="Property Details">
              <p className="text-xs text-muted-foreground leading-relaxed">{home.footer_details}</p>
            </Section>
          )}

          {/* Notes */}
          {home.notes && (
            <Section title="Notes">
              <div className="bg-card border border-border rounded-lg p-4 text-sm leading-relaxed">
                {home.notes}
              </div>
            </Section>
          )}

          <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
            DFW Home Evaluator · Generated {new Date().toLocaleDateString()} · 100% P&T Disabled Veteran Profile
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}