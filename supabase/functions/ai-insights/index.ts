import "@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { financialData } = await req.json();

    const systemPrompt = `You are FinanceOS AI, a personal financial advisor embedded in a finance tracking app.
You analyze the user's financial data and provide actionable, specific insights.
Keep responses concise (3-5 bullet points max). Use numbers from their actual data.
Focus on: debt reduction strategies, spending patterns, savings opportunities, and risk alerts.
Format your response as markdown bullet points. Be direct and specific — no generic advice.
All monetary values are in COP (Colombian Pesos) unless noted as USD. Exchange rate is provided.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Here's my current financial snapshot:\n\n${JSON.stringify(financialData, null, 2)}\n\nGive me your top insights and recommendations.`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message ?? "Claude API error" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = data.content?.[0]?.text ?? "No insights available.";

    return new Response(
      JSON.stringify({ insights: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
