import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, X, Upload, ImageIcon } from "lucide-react";
import { scoreHome } from "@/lib/scoringEngine";
import { toast } from "sonner";

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs text-muted-foreground block mb-1">{label}</label>
    {children}
  </div>
);

export default function HomeEditForm({ home, onClose }) {
  const [form, setForm] = useState({
   address: home.address || "",
   city: home.city || "",
   zip_code: home.zip_code || "",
   price: home.price || "",
   sqft: home.sqft || "",
   year_built: home.year_built || "",
   bedrooms: home.bedrooms || "",
   bathrooms: home.bathrooms || "",
   hoa_monthly: home.hoa_monthly || "",
   pid_mud_annual: home.pid_mud_annual || "",
   pid_type: home.pid_type || "fixed_assessment",
   pool_status: home.pool_status || "none",
   has_office: home.has_office ?? false,
   builder: home.builder || "",
   school_district: home.school_district || "",
   image_url: home.image_url || "",
   commute_collins_min: home.commute_collins_min ?? "",
   commute_coram_deo_min: home.commute_coram_deo_min ?? "",
   resale_score: home.resale_score ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("image_url", file_url);
      toast.success("Photo uploaded permanently.");
    } catch (err) {
      toast.error("Photo upload failed.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = {
        ...home,
        address: form.address || home.address,
        city: form.city || home.city,
        zip_code: form.zip_code || home.zip_code,
        price: Number(form.price) || home.price,
        sqft: Number(form.sqft) || undefined,
        year_built: Number(form.year_built) || undefined,
        bedrooms: Number(form.bedrooms) || undefined,
        bathrooms: Number(form.bathrooms) || undefined,
        hoa_monthly: Number(form.hoa_monthly) || 0,
        pid_mud_annual: Number(form.pid_mud_annual) || 0,
        pid_type: form.pid_type,
        pool_status: form.pool_status,
        has_office: form.has_office,
        builder: form.builder,
        school_district: form.school_district,
        image_url: form.image_url,
        commute_collins_min: form.commute_collins_min !== "" ? Number(form.commute_collins_min) : undefined,
        commute_coram_deo_min: form.commute_coram_deo_min !== "" ? Number(form.commute_coram_deo_min) : undefined,
        resale_score: form.resale_score !== "" ? Number(form.resale_score) : undefined,
        commute_verified: form.commute_collins_min !== "",
      };
      const scored = scoreHome(updated);
      await base44.entities.Home.update(home.id, {
        ...updated,
        // Explicitly preserve deep-dive fields so a full-replace never wipes them
        conditional_consideration: home.conditional_consideration,
        criteria_score_notes: home.criteria_score_notes,
        estimated_monthly_cost: home.estimated_monthly_cost,
        offer_framework: home.offer_framework,
        flood_info: home.flood_info,
        home_insurance_monthly: home.home_insurance_monthly,
        utilities: home.utilities,
        market_context: home.market_context,
        analyst_note: home.analyst_note,
        footer_details: home.footer_details,
        tax_history: home.tax_history,
        price_history: home.price_history,
        dom_analysis: home.dom_analysis,
        last_deep_dive_at: home.last_deep_dive_at,
        // Recalculated scoring fields
        overall_score: scored.overall_score,
        verdict: scored.verdict,
        one_line: scored.verdict,
        scores: scored.scores,
        pros: scored.pros,
        cons: scored.cons,
        red_flags: scored.red_flags,
        va_mortgage_pi: scored.va_mortgage_pi,
        monthly_true_cost: scored.monthly_true_cost,
      });
      queryClient.invalidateQueries({ queryKey: ["homes"] });
      toast.success("Home updated and scores recalculated.");
      onClose();
    } catch (e) {
      toast.error("Failed to save. Please try again.");
      console.error("HomeEditForm save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-border bg-card px-5 py-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edit Home Details</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Address">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} className="col-span-2" />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Zip Code">
          <Input value={form.zip_code} onChange={(e) => set("zip_code", e.target.value)} />
        </Field>
        <Field label="List Price ($)">
          <Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} />
        </Field>
        <Field label="Sqft">
          <Input type="number" value={form.sqft} onChange={(e) => set("sqft", e.target.value)} />
        </Field>
        <Field label="Year Built">
          <Input type="number" value={form.year_built} onChange={(e) => set("year_built", e.target.value)} />
        </Field>
        <Field label="Bedrooms">
          <Input type="number" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} />
        </Field>
        <Field label="Bathrooms">
          <Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} />
        </Field>
        <Field label="HOA/mo ($)">
          <Input type="number" value={form.hoa_monthly} onChange={(e) => set("hoa_monthly", e.target.value)} />
        </Field>
        <Field label="PID/yr ($)">
          <Input type="number" value={form.pid_mud_annual} onChange={(e) => set("pid_mud_annual", e.target.value)} />
        </Field>
        <Field label="PID Type">
          <Select value={form.pid_type} onValueChange={(v) => set("pid_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed_assessment">Fixed Assessment</SelectItem>
              <SelectItem value="ad_valorem">Ad Valorem (Exempt)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Pool">
          <Select value={form.pool_status} onValueChange={(v) => set("pool_status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="community">Community</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Has Office">
          <Select value={String(form.has_office)} onValueChange={(v) => set("has_office", v === "true")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Builder">
          <Input value={form.builder} onChange={(e) => set("builder", e.target.value)} />
        </Field>
        <Field label="School District">
          <Input value={form.school_district} onChange={(e) => set("school_district", e.target.value)} />
        </Field>
        <Field label="Photo">
          <div className="space-y-1.5">
            <Input placeholder="https://... (paste URL)" value={form.image_url} onChange={(e) => set("image_url", e.target.value)} />
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs h-7 w-full" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}>
                {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingPhoto ? "Uploading..." : "Upload from computer"}
              </Button>
              {form.image_url && <img src={form.image_url} alt="preview" className="w-10 h-10 rounded object-cover shrink-0 border border-border" onError={(e) => e.currentTarget.style.display="none"} />}
            </div>
          </div>
        </Field>
        </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Manual Score Overrides</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Collins Commute (min)">
            <Input type="number" placeholder="e.g. 28" value={form.commute_collins_min} onChange={(e) => set("commute_collins_min", e.target.value)} />
          </Field>
          <Field label="Coram Deo Commute (min)">
            <Input type="number" placeholder="e.g. 32" value={form.commute_coram_deo_min} onChange={(e) => set("commute_coram_deo_min", e.target.value)} />
          </Field>
          <Field label="Resale Score (0-10)">
            <Input type="number" min="0" max="10" placeholder="overrides zip tier" value={form.resale_score} onChange={(e) => set("resale_score", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving} className="gap-2 flex-1">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save & Recalculate
        </Button>
        <Button variant="outline" onClick={onClose} className="gap-2">
          <X className="w-4 h-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}