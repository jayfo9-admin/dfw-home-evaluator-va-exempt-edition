import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, AlertCircle, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { scoreHome } from "@/lib/scoringEngine";
import { normalizeHome } from "@/lib/normalizeHome";
import { sanitizeUtilities } from "@/lib/sanitizeUtilities";

export default function DeepDiveManager({ allHomes }) {
  const [selectedHomes, setSelectedHomes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [status, setStatus] = useState(null);
  const [resultMsg, setResultMsg] = useState("");
  const queryClient = useQueryClient();

  const toggleHome = (id) => {
    setSelectedHomes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedHomes(allHomes.map(h => h.id));
  const deselectAll = () => setSelectedHomes([]);

  const handleDeepDive = async () => {
    const targets = allHomes.filter(h => selectedHomes.includes(h.id));
    setIsLoading(true);
    setStatus(null);
    setResultMsg("");
    setProgressMsg("Starting deep dive in background (may take a while)...");

    try {
      await base44.functions.invoke('deepDiveHomes', { homeIds: targets.map(h => h.id) });
      setProgressMsg("Deep dive is running in background. Check back in a few minutes.");
      toast.info(`Deep dive started for ${targets.length} home${targets.length !== 1 ? "s" : ""}. Refresh the list in a few minutes to see updates.`);
      setSelectedHomes([]);
      setIsLoading(false);
      setStatus("success");
      setResultMsg("Deep dive initiated — check back soon for results.");
    } catch (err) {
      setIsLoading(false);
      setStatus("error");
      setResultMsg(`Failed to start deep dive: ${err?.message?.slice(0, 60)}`);
      toast.error(`Failed to start deep dive: ${err?.message?.slice(0, 60)}`);
    }
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base flex items-center gap-2 text-destructive">
          <Zap className="w-4 h-4" />
          Extensive Deep Dive Refresh
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select homes to re-run full AI forensic research with live web data. Uses integration credits per home.
        </p>
        {allHomes.length > 0 && (
          <div className="flex gap-3 pt-1">
            <button onClick={selectAll} className="text-xs text-primary hover:underline">Select all</button>
            <span className="text-xs text-muted-foreground">·</span>
            <button onClick={deselectAll} className="text-xs text-muted-foreground hover:underline">Deselect all</button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {allHomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No homes in your shortlist yet.</p>
        ) : (
          <div className="space-y-2">
            {allHomes.map(home => (
              <div key={home.id} className="flex items-center gap-3 p-2.5 rounded-md bg-secondary">
                <Checkbox
                  id={`dd-${home.id}`}
                  checked={selectedHomes.includes(home.id)}
                  onCheckedChange={() => toggleHome(home.id)}
                />
                <label htmlFor={`dd-${home.id}`} className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium block">{home.address}{home.city ? `, ${home.city}` : ""}{home.zip_code ? ` ${home.zip_code}` : ""}</span>
                  {home.last_deep_dive_at
                    ? <span className="text-xs text-muted-foreground">🔬 Last dive: {new Date(home.last_deep_dive_at).toLocaleDateString()} {new Date(home.last_deep_dive_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    : <span className="text-xs text-orange-500">No deep dive yet</span>
                  }
                </label>
              </div>
            ))}
          </div>
        )}

        {/* Progress indicator */}
        {isLoading && progressMsg && (
          <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>{progressMsg}</span>
          </div>
        )}

        <Button
          onClick={handleDeepDive}
          disabled={selectedHomes.length === 0 || isLoading}
          className="w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Researching... this may take a while</>
            : <><Zap className="w-4 h-4" /> Deep Dive Refresh ({selectedHomes.length} selected)</>
          }
        </Button>

        {status && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${status === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {status === "success" ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{resultMsg}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}