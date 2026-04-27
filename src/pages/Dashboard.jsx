import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Home as HomeIcon, Search, ArrowUpDown } from "lucide-react";
import { scoreHome } from "@/lib/scoringEngine";
import HomeCard from "@/components/HomeCard";
import HomeDetailModal from "@/components/HomeDetailModal";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [selectedHome, setSelectedHome] = useState(null);

  const { data: homes = [], isLoading } = useQuery({
    queryKey: ["homes"],
    queryFn: () => base44.entities.Home.list("-created_date", 100),
  });

  const scoredHomes = useMemo(() => {
    return homes.map((h) => {
      const result = scoreHome(h);
      return { ...h, ...result, _pillars: result.pillars };
    });
  }, [homes]);

  const filtered = useMemo(() => {
    let list = scoredHomes;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) =>
          h.address?.toLowerCase().includes(q) ||
          h.city?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === "score") return (b.overall_score || 0) - (a.overall_score || 0);
      if (sortBy === "price_asc") return (a.price || 0) - (b.price || 0);
      if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
      if (sortBy === "cost") return (a.monthly_true_cost || 0) - (b.monthly_true_cost || 0);
      return 0;
    });
    return list;
  }, [scoredHomes, search, sortBy]);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <HomeIcon className="w-6 h-6" />
            Shortlist
          </h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} home{filtered.length !== 1 ? "s" : ""} evaluated
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search homes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-48 font-body"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Highest Score</SelectItem>
              <SelectItem value="price_asc">Price: Low → High</SelectItem>
              <SelectItem value="price_desc">Price: High → Low</SelectItem>
              <SelectItem value="cost">Lowest True Cost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <HomeIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-heading text-lg font-semibold mb-1">No homes yet</h3>
          <p className="text-sm text-muted-foreground">
            Go to the Sync tab to paste home data from your AI advisor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((home) => (
            <HomeCard key={home.id} home={home} onClick={setSelectedHome} />
          ))}
        </div>
      )}

      <HomeDetailModal
        home={selectedHome}
        open={!!selectedHome}
        onClose={() => setSelectedHome(null)}
      />
    </div>
  );
}