import "@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const { message, currentData } = await req.json();

    const systemPrompt = `You are FinanceOS AI, an assistant embedded in a personal finance app.
The user will describe financial updates in natural language. Your job is to parse their message
and return ONLY a JSON object with the specific actions to take.

Current financial data is provided for context so you can match names to IDs.

Return a JSON object with this exact structure:
{
  "actions": [
    {
      "type": "updateDebtAccount",
      "id": "<account id>",
      "updates": { "currentBalance": <number> }
    },
    {
      "type": "updateSnapshot",
      "month": "YYYY-MM",
      "updates": { "savings": <number>, "cashOnHand": <number> }
    },
    {
      "type": "updateSavingsTarget",
      "amount": <number>
    },
    {
      "type": "updateFixedExpense",
      "id": "<expense id>",
      "updates": { "amount": <number> }
    },
    {
      "type": "updateIncomeSource",
      "id": "<source id>",
      "updates": { "amount": <number> }
    },
    {
      "type": "updateSubscription",
      "id": "<subscription id>",
      "updates": { "amount": <number>, "active": <boolean> }
    },
    {
      "type": "addSpending",
      "data": { "date": "YYYY-MM-DD", "description": "<string>", "amount": <number>, "category": "<groceries|transport|food|entertainment|health|shopping|other>", "paymentMethod": "<cash|debit|credit_mastercard_cop|credit_mastercard_usd|credit_visa>" }
    }
  ],
  "summary": "Brief human-readable summary of what will be updated"
}

Rules:
- All monetary amounts in COP unless the user specifies USD
- Match account/expense/income names to IDs from the provided data (fuzzy match is OK)
- For snapshot updates, use the current month (provided in data) unless user specifies otherwise
- If the user mentions savings account balance, update the snapshot's "savings" field
- If the user mentions cash on hand, update the snapshot's "cashOnHand" field
- Only include actions you're confident about. If something is ambiguous, mention it in the summary
- Return ONLY valid JSON, no markdown, no code fences, no extra text
- For spending entries, infer the category and default payment method to "debit" unless specified
- Today's date is provided in the data for spending entries`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Here is my current financial data:\n\n${JSON.stringify(currentData, null, 2)}\n\nUser message: "${message}"`,
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

    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: text }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
