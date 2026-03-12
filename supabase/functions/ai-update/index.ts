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
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured", actions: [] }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { message, currentData, files } = await req.json();

    const systemPrompt = `You are FinanceOS AI, an assistant embedded in a personal finance app.
The user will describe financial updates in natural language, and may also attach files (bank statements, CSV exports, screenshots, etc.).
Your job is to parse the user's message AND any attached file content to extract financial data points, then return ONLY a JSON object with the specific actions to take.

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
      "type": "updateCheckingAccount",
      "id": "<account id>",
      "updates": { "currentBalance": <number> }
    },
    {
      "type": "addSpending",
      "data": { "date": "YYYY-MM-DD", "description": "<string>", "amount": <number>, "category": "<groceries|transport|food|entertainment|health|shopping|other>", "paymentMethod": "<cash|debit|credit_mastercard_cop|credit_mastercard_usd|credit_visa|checking_ACCOUNT_ID|debt_ACCOUNT_ID>" }
    }
  ],
  "summary": "Brief human-readable summary of what will be updated"
}

Rules:
- All monetary amounts in COP unless the user specifies USD or the file data is clearly in USD
- Match account/expense/income names to IDs from the provided data (fuzzy match is OK)
- For snapshot updates, use the current month (provided in data) unless user specifies otherwise
- If the user mentions a specific checking account balance (e.g. "I have 5M in Bancolombia"), update the checkingAccount's currentBalance
- For spending with a checking account payment, use "checking_<account_id>" as the paymentMethod
- For spending with a credit card, use "debt_<account_id>" as the paymentMethod
- If the user mentions cash on hand, update the snapshot's "cashOnHand" field
- Only include actions you're confident about. If something is ambiguous, mention it in the summary
- Return ONLY valid JSON, no markdown, no code fences, no extra text
- For spending entries, infer the category and default payment method to "debit" unless specified
- Today's date is provided in the data for spending entries

FILE HANDLING:
- The user may attach files like CSV bank statements, text exports, or screenshots of balances
- For CSV/text files: parse rows to extract transaction data, balances, or amounts
- For bank statements: extract account balances, recent transactions, or payment confirmations
- Follow the user's instructions on what to do with the file data
- If the file contains multiple transactions, create an "addSpending" action for each one
- Match any account names in the file to the user's existing accounts by fuzzy matching
- If the file has dates, use them; otherwise default to today
- If you're unsure about a data point from the file, mention it in the summary rather than guessing
- For large files, focus on the most relevant/recent data points`;

    // Build the user message content parts
    const contentParts: Array<{ type: string; text?: string; source?: Record<string, unknown> }> = [];

    // Add text files as text content
    const fileTexts: string[] = [];
    const imageFiles: Array<{ name: string; mediaType: string; data: string }> = [];

    if (files && Array.isArray(files)) {
      for (const file of files) {
        if (file.content.startsWith("data:image/")) {
          // Extract base64 data and media type from data URL
          const match = file.content.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (match) {
            imageFiles.push({
              name: file.name,
              mediaType: match[1],
              data: match[2],
            });
          }
        } else {
          // Text content
          fileTexts.push(`--- FILE: ${file.name} ---\n${file.content}\n--- END FILE ---`);
        }
      }
    }

    // Build user message text
    let userText = `Here is my current financial data:\n\n${JSON.stringify(currentData, null, 2)}`;

    if (fileTexts.length > 0) {
      userText += `\n\nATTACHED FILES:\n\n${fileTexts.join("\n\n")}`;
    }

    if (message) {
      userText += `\n\nUser instructions: "${message}"`;
    } else if (files?.length > 0) {
      userText += `\n\nUser instructions: "Process the attached file(s) and update my financial data accordingly."`;
    }

    contentParts.push({ type: "text", text: userText });

    // Add image files as image content blocks
    for (const img of imageFiles) {
      contentParts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType,
          data: img.data,
        },
      });
      contentParts.push({
        type: "text",
        text: `(The image above is from file: ${img.name})`,
      });
    }

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
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: contentParts,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data.error?.message ?? `Claude API error (${response.status})`,
          actions: [],
        }),
        {
          status: 200,
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
      // Try to extract JSON from the response if it has extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response", actions: [] }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "Failed to parse AI response", actions: [] }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message, actions: [] }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
