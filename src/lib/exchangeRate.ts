const API_URL = 'https://open.er-api.com/v6/latest/USD';

export async function fetchUSDtoCOP(): Promise<number | null> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates?.COP ?? null;
  } catch {
    return null;
  }
}
