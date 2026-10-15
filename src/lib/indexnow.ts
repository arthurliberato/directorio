const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Pings changed/new/removed URLs (SPEC §8). Batches of <= 10,000 per the protocol. */
export async function pingIndexNow(urls: string[], opts: { host: string; key: string; fetchImpl?: typeof fetch }): Promise<{ sent: number; status: number[] }> {
  const f = opts.fetchImpl ?? fetch;
  const status: number[] = [];
  for (let i = 0; i < urls.length; i += 10_000) {
    const batch = urls.slice(i, i + 10_000);
    const res = await f(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: opts.host, key: opts.key, keyLocation: `https://${opts.host}/${opts.key}.txt`, urlList: batch }),
    });
    status.push(res.status);
  }
  return { sent: urls.length, status };
}
