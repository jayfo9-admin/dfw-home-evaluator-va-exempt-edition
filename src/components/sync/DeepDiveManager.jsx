import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, AlertCircle, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";


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

    let completed = 0;
    let failed = 0;

    for (const home of targets) {
      setProgressMsg(`Researching ${home.address} (${completed + 1} of ${targets.length})...`);
      try {
        await base44.functions.invoke('deepDiveHomes', { homeIds: [home.id] });
        completed++;
        queryClient.invalidateQueries({ queryKey: ["homes"] });
      } catch (err) {
        console.error(`Deep dive failed for ${home.address}:`, err?.message);
        failed++;
      }
    }

    setIsLoading(false);
    setProgressMsg("");
    setSelectedHomes([]);

    if (failed === 0) {
      setStatus("success");
      setResultMsg(`Deep dive complete for ${completed} home${completed !== 1 ? "s" : ""}.`);
      toast.success(`Deep dive complete for ${completed} home${completed !== 1 ? "s" : ""}.`);
    } else {
      setStatus(completed > 0 ? "success" : "error");
      setResultMsg(`${completed} succeeded, ${failed} failed. Check console for details.`);
      toast.warning(`${completed} succeeded, ${failed} failed.`);
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