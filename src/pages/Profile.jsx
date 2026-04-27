import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Shield, DollarSign, MapPin, GraduationCap, Briefcase, Heart } from "lucide-react";

const criteria = [
  {
    icon: Shield,
    label: "VA Status",
    value: "100% P&T Disabled Veteran",
    detail: "$0 Property Tax in Texas",
    color: "text-green-600",
  },
  {
    icon: DollarSign,
    label: "Budget Range",
    value: "Under $600k preferred",
    detail: "Hard ceiling: $700k",
    color: "text-accent",
  },
  {
    icon: MapPin,
    label: "Target Area",
    value: "DFW Metroplex",
    detail: "Plano, Richardson, Rockwall, Allen, McKinney",
    color: "text-blue-600",
  },
  {
    icon: Briefcase,
    label: "Work Location",
    value: "Collins Aerospace — 75082",
    detail: "≤ 30 min commute required",
    color: "text-purple-600",
  },
  {
    icon: GraduationCap,
    label: "School",
    value: "Coram Deo Academy — Richardson",
    detail: "≤ 30 min commute for teenagers",
    color: "text-orange-600",
  },
  {
    icon: Heart,
    label: "Family",
    value: "Teenagers in household",
    detail: "Need 4+ BR, office, ideally a pool",
    color: "text-red-500",
  },
];

const scoringWeights = [
  { pillar: "Must-Haves", weight: "30%", desc: "4+ BR, 2.5+ BA, Office, Pool Rule" },
  { pillar: "Price Value", weight: "20%", desc: "Under $500k = perfect, over $700k = 0" },
  { pillar: "Resale Potential", weight: "20%", desc: "School district quality (Plano/Rockwall top tier)" },
  { pillar: "Commute", weight: "15%", desc: "≤ 30 min to Collins Aerospace + Coram Deo" },
  { pillar: "True Cost", weight: "10%", desc: "VA P&I + HOA + PID/12 (No property tax)" },
  { pillar: "Build Quality", weight: "5%", desc: "Preference for 2015+ construction" },
];

export default function Profile() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <UserCircle className="w-6 h-6" />
          Buyer Profile
        </h2>
        <p className="text-sm text-muted-foreground">
          Fixed criteria powering every home evaluation.
        </p>
      </div>

      {/* Criteria Cards */}
      <div className="grid gap-4 mb-8">
        {criteria.map(({ icon: Icon, label, value, detail, color }) => (
          <Card key={label}>
            <CardContent className="flex items-start gap-4 p-4">
              <div className={`p-2.5 rounded-lg bg-secondary ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="font-heading font-semibold">{value}</p>
                <p className="text-sm text-muted-foreground">{detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scoring Rubric */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Scoring Rubric</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scoringWeights.map(({ pillar, weight, desc }) => (
              <div key={pillar} className="flex items-start gap-3">
                <Badge variant="secondary" className="font-heading font-bold shrink-0 min-w-[48px] justify-center">
                  {weight}
                </Badge>
                <div>
                  <p className="font-medium text-sm">{pillar}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* VA Note */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <p className="font-heading font-semibold text-green-900">VA Exemption Advantage</p>
            <p className="text-sm text-green-800 mt-1">
              As a 100% P&T disabled veteran in Texas, your property tax is <strong>$0</strong>.
              This saves you thousands per year and dramatically lowers your true monthly cost
              compared to non-exempt buyers. All scores in this engine reflect this advantage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}