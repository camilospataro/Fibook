import "@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a financial data analyst AI for FinanceOS, a personal finance tracking app.

The user will provide raw data extracted from an Excel spreadsheet (as JSON — array of sheets, each sheet is an array of rows).

Your job is to analyze this data and map it to the app's data model. The app tracks:

1. **debt_accounts** — credit cards, loans, etc.
   Fields: name (string), currency ("COP" or "USD"), current_balance (number), minimum_monthly_payment (number), color (hex color string)

2. **income_sources** — salary, freelance, etc.
   Fields: name (string), amount (number, monthly in COP), is_recurring (boolean)

3. **fixed_expenses** — rent, utilities, etc.
   Fields: name (string), amount (number, monthly in COP), category ("housing" | "food" | "transport" | "entertainment" | "health" | "other")

4. **subscriptions** — Netflix, Spotify, etc.
   Fields: name (string), currency ("COP" or "USD"), amount (number), active (boolean)

5. **spending** — individual transactions
   Fields: date (YYYY-MM-DD), description (string), amount (number in COP), category ("groceries" | "transport" | "food" | "entertainment" | "health" | "shopping" | "other"), payment_method ("cash" | "debit" | "credit_mastercard_cop" | "credit_mastercard_usd" | "credit_visa")

6. **settings** — just exchange_rate (number, USD to COP)

Rules:
- Only extract data you are confident about. If unsure, put it in the "skipped" list with a reason.
- For spending entries, infer the category and payment_method from context clues.
- If amounts seem to be in USD (small numbers like $50-$500 for things that should cost more in COP), flag the currency.
- Assign sensible colors to debt accounts (use these: #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7, #DDA0DD).
- For dates, normalize to YYYY-MM-DD format.
- Return ONLY valid JSON, no markdown, no explanation outside the JSON.

Respond with this exact JSON structure:
{
  "exchange_rate": number | null,
  "debt_accounts": [...],
  "income_sources": [...],
  "fixed_expenses": [...],
  "subscriptions": [...],
  "spending": [...],
  "skipped": [{ "data": "original text/value", "reason": "why it was skipped" }],
  "summary": "Brief 2-3 sentence summary of what was found and imported"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { sheets } = await req.json();

    if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
      return new Response(
        JSON.stringify({ error: "No sheet data provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Truncate to avoid token limits — send first 200 rows per sheet
    const truncated = sheets.map(
      (sheet: { name: string; rows: unknown[] }) => ({
        name: sheet.name,
        rows: sheet.rows.slice(0, 200),
        totalRows: sheet.rows.length,
      })
    );

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Here is the Excel data extracted as JSON:\n\n${JSON.stringify(truncated, null, 2)}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data.error?.message ?? "Claude API error",
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const text = data.content?.[0]?.text ?? "{}";

    // Extract JSON from response (in case Claude wraps it)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
