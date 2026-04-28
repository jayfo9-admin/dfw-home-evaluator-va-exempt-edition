import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Search, FileJson, Zap, Upload } from "lucide-react";
import ResearchAddress from "@/components/ResearchAddress";
import JsonSyncInput from "@/components/sync/JsonSyncInput";
import DeepDiveManager from "@/components/sync/DeepDiveManager";

export default function Sync() {
  const [tab, setTab] = useState("research");

  const { data: allHomes = [] } = useQuery({
    queryKey: ["homes"],
    queryFn: () => base44.entities.Home.list("-created_date", 100),
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Upload className="w-6 h-6" />
          Add Homes
        </h2>
        <p className="text-sm text-muted-foreground">
          Research an address with live web data, or paste JSON manually.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-5">
        <button
          onClick={() => setTab("research")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tab === "research" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Search className="w-4 h-4" /> Research Address
        </button>
        <button
          onClick={() => setTab("json")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tab === "json" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <FileJson className="w-4 h-4" /> Paste JSON
        </button>
        <button
          onClick={() => setTab("deepDive")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tab === "deepDive" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Zap className="w-4 h-4" /> Deep Dive Refresh
        </button>
      </div>

      {tab === "research" && (
        <Card>
          <CardContent className="pt-5">
            <ResearchAddress />
          </CardContent>
        </Card>
      )}

      {tab === "json" && <JsonSyncInput />}

      {tab === "deepDive" && <DeepDiveManager allHomes={allHomes} />}
    </div>
  );
}