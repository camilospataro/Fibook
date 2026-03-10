export async function fetchUSDtoCOP(): Promise<number | null> {
  // Try multiple sources for reliability
  const sources = [
    async () => {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) return null;
      const data = await res.json();
      return data.rates?.COP ?? null;
    },
    async () => {
      const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      if (!res.ok) return null;
      const data = await res.json();
      return data.usd?.cop ?? null;
    },
  ];

  for (const source of sources) {
    try {
      const rate = await source();
      if (rate && rate > 0) return rate;
    } catch {
      continue;
    }
  }
  return null;
}
