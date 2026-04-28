export function sanitizeUtilities(u) {
  const toStr = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.provider || v.value || v.description || v.availability || JSON.stringify(v);
    return String(v);
  };
  return {
    internet: toStr(u?.internet),
    electricity: toStr(u?.electricity),
    water_sewer: toStr(u?.water_sewer),
    gas_heating: toStr(u?.gas_heating),
    concerns: toStr(u?.concerns),
  };
}