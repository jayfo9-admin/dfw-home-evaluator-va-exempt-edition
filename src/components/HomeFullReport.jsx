import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, AlertTriangle, CheckCircle, XCircle, Flag } from "lucide-react";

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

function Section({ title, children, className = "" }) {
  return (
    <div className={`mb-6 ${className}`}>
      <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function HomeFullReport({ home, open, onClose }) {
  const printRef = useRef(null);

  if (!home) return null;

  const scores = home.scores || {};
  const costNote = home.monthly_cost_note ||
    (home.monthly_true_cost ? `VA P&I ${fmt(home.va_mortgage_pi || 0)}/mo + HOA $${home.hoa_monthly || 0}/mo + PID $${Math.round((home.pid_mud_annual || 0) / 12)}/mo = ${fmt(home.monthly_true_cost)}/mo ($0 property tax, $0 PMI)` : null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>DFW Home Evaluator — ${home.address}</title>
          <style>
            body { font-family: Georgia, serif; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 20px 0 10px; }
            h3 { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
            p, li { font-size: 13px; line-height: 1.6; }
            ul { padding-left: 18px; }
            .score-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .bar-bg { background: #eee; border-radius: 4px; height: 8px; margin-top: 3px; }
            .bar-fill { height: 8px; border-radius: 4px; }
            .green { background: #22c55e; } .amber { background: #f59e0b; } .red { background: #ef4444; }
            .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: bold; }
            .badge-green { background: #dcfce7; color: #166534; }
            .badge-amber { background: #fef9c3; color: #854d0e; }
            .badge-red { background: #fee2e2; color: #991b1b; }
            .flag { color: #b91c1c; margin-bottom: 4px; }
            .pro { color: #15803d; margin-bottom: 4px; }
            .con { color: #b91c1c; margin-bottom: 4px; }
            .cost-box { background: #f1f5f9; padding: 12px; border-radius: 6px; margin-top: 8px; font-size: 13px; }
            .note-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin-top: 8px; font-size: 13px; }
            .market-box { white-space: pre-wrap; font-size: 12px; background: #fafaf9; border: 1px solid #e7e5e4; padding: 10px; border-radius: 6px; }
            @media print { body { padding: 16px; } }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const overallColor = (home.overall_score || 0) >= 75 ? "badge-green" : (home.overall_score || 0) >= 55 ? "badge-amber" : "badge-red";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <DialogTitle className="font-heading text-lg leading-snug">{home.address}</DialogTitle>
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Print / Export
            </Button>
          </div>
        </DialogHeader>

        {/* Printable content */}
        <div ref={printRef} className="space-y-0 pt-2">
          {/* Print header (hidden in modal) */}
          <div className="hidden">
            <h1>DFW Home Evaluator — Full Report</h1>
            <p>{home.address}{home.city ? `, ${home.city}` : ""}{home.zip_code ? ` ${home.zip_code}` : ""}</p>
          </div>

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
                ["City", home.city || "—"],
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
              <div className="bg-secondary rounded-lg p-4 text-sm leading-relaxed">
                {costNote}
              </div>
            </Section>
          )}

          {/* Market Context / Forensic History */}
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

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
            DFW Home Evaluator · Generated {new Date().toLocaleDateString()} · 100% P&T Disabled Veteran Profile
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}