import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FALLBACK_RATE = 0.05375;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch live 30-Year VA rate from Navy Federal
    let liveRate = null;
    try {
      const rateResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Go to https://www.navyfederal.org/loans-cards/mortgage/mortgage-rates.html and find the current 30-Year VA Loan interest rate (not APR). Return ONLY the numeric rate as a decimal (e.g. 0.05375 for 5.375%). Nothing else.`,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: { rate: { type: "number" } },
          required: ["rate"]
        }
      });
      if (rateResult?.rate && rateResult.rate > 0.01 && rateResult.rate < 0.20) {
        liveRate = rateResult.rate;
      }
    } catch (e) {
      console.warn("Rate fetch failed, using fallback:", e.message);
    }

    return Response.json({
      message: 'VA rate refreshed',
      va_rate: ((liveRate ?? FALLBACK_RATE) * 100).toFixed(3) + '%',
      is_live: liveRate !== null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});