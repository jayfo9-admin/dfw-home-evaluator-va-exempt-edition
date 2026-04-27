import React from "react";
import { CheckCircle, XCircle } from "lucide-react";

export default function ProConList({ pros = [], cons = [], redFlags = [] }) {
  return (
    <div className="space-y-3">
      {pros.length > 0 && (
        <div className="border-l-3 border-l-green-600 pl-3 space-y-1">
          {pros.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
              <span>{p}</span>
            </div>
          ))}
        </div>
      )}
      {cons.length > 0 && (
        <div className="border-l-3 border-l-red-500 pl-3 space-y-1">
          {cons.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}
      {redFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2 space-y-1">
          {redFlags.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-700 font-medium">
              <span className="shrink-0">🚩</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}