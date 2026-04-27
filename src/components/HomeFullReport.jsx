import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, CheckCircle, XCircle, Flag } from "lucide-react";

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

function buildPrintHTML(home) {
  const scores = home.scores || {};
  const overallColor = (home.overall_score || 0) >= 75 ? "#166534" : (home.overall_score || 0) >= 55 ? "#854d0e" : "#991b1b";
  const overallBg = (home.overall_score || 0) >= 75 ? "#dcfce7" : (home.overall_score || 0) >= 55 ? "#fef9c3" : "#fee2e2";
  const overallBorder = (home.overall_score || 0) >= 75 ? "#22c55e" : (home.overall_score || 0) >= 55 ? "#f59e0b" : "#ef4444";

  const overviewRows = [
    ["List Price", home.price ? fmt(home.price) : "—"],
    ["Sqft", home.sqft ? home.sqft.toLocaleString() : "—"],
    ["Year Built", home.year_built || "—"],
    ["Beds / Baths", `${home.bedrooms || "—"} / ${home.bathrooms || "—"}`],
    ["Pool", home.pool_status || "—"],
    ["Builder", home.builder || "Unknown"],
    ["HOA/mo", home.hoa_monthly ? `$${home.hoa_monthly}` : "$0"],
    ["PID/yr", home.pid_mud_annual ? `$${home.pid_mud_annual}` : "$0"],
    ["City / Zip", `${home.city || "—"} ${home.zip_code || ""}`],
  ];

  const criteriaScores = CRITERIA.map((c) => {
    const v = scores[c.key] || 0;
    const pct = Math.min((v / 10) * 100, 100);
    const barColor = pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
    const textColor = pct >= 70 ? "#166534" : pct >= 50 ? "#854d0e" : "#991b1b";
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-weight:600;font-size:13px;">${c.label}</span>
          <span style="font-weight:700;font-size:13px;color:${textColor};">${v}/10</span>
        </div>
        <div style="background:#eee;border-radius:4px;height:8px;overflow:hidden;">
          <div style="background:${barColor};height:8px;width:${pct}%;border-radius:4px;"></div>
        </div>
      </div>`;
  }).join("");

  const prosHTML = home.pros?.length > 0
    ? `<h2>Pros</h2><ul>${home.pros.map(p => `<li style="color:#15803d;margin-bottom:4px;">${p}</li>`).join("")}</ul>` : "";

  const consHTML = home.cons?.length > 0
    ? `<h2>Cons</h2><ul>${home.cons.map(c => `<li style="color:#b91c1c;margin-bottom:4px;">${c}</li>`).join("")}</ul>` : "";

  const flagsHTML = home.red_flags?.length > 0
    ? `<h2>Red Flags / Open Items</h2>${home.red_flags.map(f => `
        <div style="background:#fee2e2;border:1px solid #fca5a5;padding:8px 10px;border-radius:6px;margin-bottom:6px;font-size:13px;color:#7f1d1d;">
          🚩 ${f}
        </div>`).join("")}` : "";

  const costNote = home.monthly_cost_note ||
    (home.monthly_true_cost ? `VA P&I ${fmt(home.va_mortgage_pi || 0)}/mo + HOA $${home.hoa_monthly || 0}/mo + PID $${Math.round((home.pid_mud_annual || 0) / 12)}/mo = ${fmt(home.monthly_true_cost)}/mo ($0 property tax, $0 PMI)` : null);

  const costHTML = costNote
    ? `<h2>Estimated True Monthly Cost</h2>
       <div style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:13px;line-height:1.7;">${costNote}</div>` : "";

  const marketHTML = home.market_context
    ? `<h2>Forensic History &amp; Market Context</h2>
       <pre style="font-family:inherit;white-space:pre-wrap;font-size:12px;background:#fafaf9;border:1px solid #e7e5e4;padding:12px;border-radius:6px;line-height:1.7;">${home.market_context}</pre>` : "";

  const analystHTML = home.analyst_note
    ? `<h2>Analyst Note</h2>
       <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;font-size:13px;line-height:1.7;">${home.analyst_note}</div>` : "";

  const notesHTML = home.notes
    ? `<h2>Notes</h2>
       <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;font-size:13px;line-height:1.7;">${home.notes}</div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>DFW Home Evaluator — ${home.address}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; padding: 36px; max-width: 820px; margin: 0 auto; font-size: 13px; line-height: 1.6; }
    h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #555; margin-bottom: 24px; }
    h2 { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 20px 0 10px; }
    p, li { font-size: 13px; line-height: 1.6; }
    ul { padding-left: 20px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
    td:first-child { color: #666; width: 40%; }
    td:last-child { font-weight: 600; }
    .score-badge { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; border: 3px solid ${overallBorder}; background: ${overallBg}; color: ${overallColor}; font-size: 22px; font-weight: bold; float: left; margin-right: 16px; }
    .verdict-box { background: #f1f5f9; padding: 14px; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
    .verdict-text { font-size: 15px; font-weight: 600; padding-top: 4px; }
    .verdict-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
    .clearfix::after { content: ""; display: table; clear: both; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
    @media print { body { padding: 18px; } @page { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>DFW Home Evaluator — Full Report</h1>
  <p class="subtitle">${home.address}${home.city ? `, ${home.city}` : ""}${home.zip_code ? ` ${home.zip_code}` : ""} · Generated ${new Date().toLocaleDateString()} · 100% P&T Disabled Veteran Profile</p>

  <h2>Overview</h2>
  <table>
    ${overviewRows.map(([label, val]) => `<tr><td>${label}</td><td>${val}</td></tr>`).join("")}
  </table>

  <div class="verdict-box clearfix">
    <div class="score-badge">${home.overall_score || 0}</div>
    <div>
      <div class="verdict-label">Overall Score / Verdict</div>
      <div class="verdict-text">${home.one_line || home.verdict || "—"}</div>
    </div>
  </div>

  <h2>Criteria Scores</h2>
  ${criteriaScores}

  ${prosHTML}
  ${consHTML}
  ${flagsHTML}
  ${costHTML}
  ${marketHTML}
  ${analystHTML}
  ${notesHTML}

  <div class="footer">DFW Home Evaluator · 100% P&T Disabled Veteran Profile · ${new Date().toLocaleDateString()}</div>
</body>
</html>`;
}

export default function HomeFullReport({ home, open, onClose }) {
  if (!home) return null;

  const scores = home.scores || {};
  const costNote = home.monthly_cost_note ||
    (home.monthly_true_cost ? `VA P&I ${fmt(home.va_mortgage_pi || 0)}/mo + HOA $${home.hoa_monthly || 0}/mo + PID $${Math.round((home.pid_mud_annual || 0) / 12)}/mo = ${fmt(home.monthly_true_cost)}/mo ($0 property tax, $0 PMI)` : null);

  const handlePrint = () => {
    const html = buildPrintHTML(home);
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <DialogTitle className="font-heading text-lg leading-snug">{home.address}</DialogTitle>
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Print / Export PDF
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
                  ${(home.overall_score || 0) >= 75 ? "border-green-500 bg-green-50 text-green-800"
                  : (home.overall_score || 0) >= 55 ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-red-500 bg-red-50 text-red-800"}`}
                style={{ width: 64, height: 64, fontSize: 18 }}
              >
                {home.overall_score || 0}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Overall Score</p>
                <p className="font-heading font-semibold">{home.one_line || home.verdict || "—"}</p>
              </div>
            </div>
          </Section>

          {/* Criteria Scores */}
          <Section title="Criteria Scores">
            {CRITERIA.map((c) => (
              <ScoreBar key={c.key} label={c.label} value={scores[c.key] || 0} />
            ))}
          </Section>

          {/* Pros / Cons */}
          {((home.pros?.length > 0) || (home.cons?.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {home.pros?.length > 0 && (
                <Section title="Pros">
                  <div className="space-y-2">
                    {home.pros.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                        <p className="text-sm leading-snug">{p}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {home.cons?.length > 0 && (
                <Section title="Cons">
                  <div className="space-y-2">
                    {home.cons.map((c, i) => (
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
          {home.red_flags?.length > 0 && (
            <Section title="Red Flags / Open Items">
              <div className="space-y-2">
                {home.red_flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <Flag className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-900">{f}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Monthly Cost */}
          {costNote && (
            <Section title="Estimated True Monthly Cost">
              <div className="bg-secondary rounded-lg p-4 text-sm leading-relaxed">{costNote}</div>
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