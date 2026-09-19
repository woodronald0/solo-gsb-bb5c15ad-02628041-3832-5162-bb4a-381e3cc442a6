import type {
  DecodeResult,
  EncodeResult,
  PaletteSymbol,
} from './types';

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? `请求失败（HTTP ${res.status}）`);
  }
  return data as T;
}

export async function fetchPalette(): Promise<PaletteSymbol[]> {
  const res = await fetch('/api/palette');
  if (!res.ok) throw new Error('无法加载色卡');
  const data = await res.json();
  return data.palette as PaletteSymbol[];
}

export function encodeGrid(grid: string[][]): Promise<EncodeResult> {
  return postJSON<EncodeResult>('/api/encode', { grid });
}

export function decodeLines(
  lines: string[],
  width: number,
): Promise<DecodeResult> {
  return postJSON<DecodeResult>('/api/decode', { lines, width });
}
