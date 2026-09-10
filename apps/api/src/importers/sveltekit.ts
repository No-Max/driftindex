/** Hydrate SvelteKit __data.json compact node arrays. */
export function hydrateSvelteKitNode<T = unknown>(root: unknown[]): T {
  return hydrateValue(root, 0) as T;
}

function hydrateValue(arr: unknown[], index: number, seen = new Map<number, unknown>()): unknown {
  if (seen.has(index)) return seen.get(index);

  const val = arr[index];
  if (val === null || typeof val !== 'object') return val;

  if (Array.isArray(val)) {
    const out = val.map((item) => (typeof item === 'number' ? hydrateValue(arr, item, seen) : item));
    seen.set(index, out);
    return out;
  }

  const obj: Record<string, unknown> = {};
  seen.set(index, obj);

  for (const [key, raw] of Object.entries(val as Record<string, unknown>)) {
    obj[key] = typeof raw === 'number' ? hydrateValue(arr, raw, seen) : raw;
  }

  return toArrayIfNumericKeys(obj);
}

function toArrayIfNumericKeys(obj: Record<string, unknown>): unknown {
  const keys = Object.keys(obj);
  if (keys.length === 0 || !keys.every((k) => /^\d+$/.test(k))) return obj;
  return keys
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => obj[k]);
}

export async function fetchSvelteKitPage<T>(url: string): Promise<T> {
  const dataUrl = url.endsWith('__data.json') ? url : `${url.replace(/\/$/, '')}/__data.json`;
  const response = await fetch(dataUrl, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${dataUrl}: ${response.status}`);
  }

  const json = (await response.json()) as { nodes: Array<{ type: string; data?: unknown[] }> };
  const dataNodes = json.nodes.filter(
    (n) => n.type === 'data' && Array.isArray(n.data) && n.data.length > 0,
  );

  if (dataNodes.length === 0) {
    throw new Error(`No data node in ${dataUrl}`);
  }

  // Layout is usually first; page payload is the last data node.
  const node = dataNodes[dataNodes.length - 1]!;
  return hydrateSvelteKitNode<T>(node.data!);
}
