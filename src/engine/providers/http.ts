/** fetch with timeout + retries on 429/5xx (exponential backoff). */
export async function fetchRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const { timeoutMs = 60000, retries = 2, ...rest } = init;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const onAbort = () => ac.abort();
    rest.signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(url, { ...rest, signal: ac.signal });
      if ((res.status === 429 || res.status >= 500) && i < retries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (rest.signal?.aborted) throw e;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    } finally {
      clearTimeout(t);
      rest.signal?.removeEventListener("abort", onAbort);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function okJson<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}
