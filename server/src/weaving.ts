/**
 * 提花编织核心算法
 *
 * 编织约定（机台实际走针方向）：
 *   - 第 1 行为奇数行：沿视觉坐标从左向右走针 → 口令从左缘起；
 *   - 第 2 行为偶数行：机头反向，沿视觉坐标从右向左走针 → 口令从右缘起；
 *   - 奇偶交替，以此类推。
 *
 * 口令始终按「机头实际走针的先后」记录游程；偶数行不做视觉镜像回写，
 * 因此网格视觉图案往返一行后保持一致（编码 → 解析可完整还原）。
 */

export interface PaletteSymbol {
  symbol: string;
  name: string;
  color: string;
}

/** 可选纱线符号；E 为底纱/空针，新网格默认填充 */
export const PALETTE: PaletteSymbol[] = [
  { symbol: 'E', name: '底纱', color: '#f8fafc' },
  { symbol: 'A', name: '红', color: '#ef4444' },
  { symbol: 'B', name: '蓝', color: '#3b82f6' },
  { symbol: 'C', name: '金', color: '#eab308' },
  { symbol: 'D', name: '绿', color: '#22c55e' },
];

const SYMBOL_SET: Set<string> = new Set(PALETTE.map((s) => s.symbol));

export function isKnownSymbol(ch: string): boolean {
  return SYMBOL_SET.has(ch);
}

/** 行方向：奇数行(行号从1计) 左→右；偶数行 右→左 */
export type Direction = 'LTR' | 'RTL';

export function directionOf(rowIndexZeroBased: number): Direction {
  return rowIndexZeroBased % 2 === 0 ? 'LTR' : 'RTL';
}

/* ------------------------------------------------------------------ */
/* 编码：网格 → 逐行游程口令                                          */
/* ------------------------------------------------------------------ */

export interface Run {
  symbol: string;
  count: number;
}

export interface EncodedLine {
  /** 口令文本，按实际走针顺序，如 "A3 B2 A3"；行内无纱线切换时单段 */
  text: string;
  direction: Direction;
  runs: Run[];
  total: number;
}

export interface EncodeResult {
  width: number;
  height: number;
  lines: EncodedLine[];
}

/**
 * 将一行视觉网格（索引 0=视觉最左）按行方向展开为走针序列，
 * 再合并同色相邻针形成游程。
 */
export function encodeRow(cells: string[], rowIndexZeroBased: number): EncodedLine {
  const dir = directionOf(rowIndexZeroBased);
  const sequence = dir === 'LTR' ? cells.slice() : cells.slice().reverse();

  const runs: Run[] = [];
  for (const symbol of sequence) {
    const last = runs[runs.length - 1];
    if (last && last.symbol === symbol) {
      last.count += 1;
    } else {
      runs.push({ symbol, count: 1 });
    }
  }

  return {
    text: runs.map((r) => (r.count === 1 ? r.symbol : `${r.symbol}${r.count}`)).join(' '),
    direction: dir,
    runs,
    total: sequence.length,
  };
}

export function encodeGrid(grid: string[][]): EncodeResult {
  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;
  return {
    width,
    height,
    lines: grid.map((row, i) => encodeRow(row, i)),
  };
}

/* ------------------------------------------------------------------ */
/* 解析：逐行游程口令 → 网格                                          */
/* ------------------------------------------------------------------ */

export type LineErrorCode =
  | 'EMPTY'            // 空行
  | 'UNEXPECTED_CHAR'  // 非法字符
  | 'UNKNOWN_SYMBOL'   // 符号不在色卡内
  | 'BAD_COUNT'        // 针数不是正整数
  | 'COUNT_MISMATCH';  // 针数之和不等于行宽

export interface LineError {
  code: LineErrorCode;
  /** 错误在口令文本中的起止位置（用于前端定位） */
  index: number;
  length: number;
  /** 出错片段原文 */
  token: string;
  message: string;
}

export interface ParsedRun extends Run {
  /** 该游程在口令文本中的起止位置 */
  index: number;
  length: number;
}

export interface DecodedLine {
  direction: Direction;
  runs: ParsedRun[];
  total: number;
  /** 视觉坐标（索引 0=视觉最左）回写结果；偶数行已按 RTL 顺序反向落位 */
  cells: string[];
  error: LineError | null;
}

export interface DecodeResult {
  width: number;
  height: number;
  ok: boolean;
  lines: DecodedLine[];
}

const TOKEN_RE = /([A-Za-z])\s*(\d*)/y;
const SPACE_RE = /\s+/y;

/**
 * 解析一行口令。
 *
 * 词法：符号(单个字母) + 可选针数(正整数，省略=1)，段间用空白分隔，
 * 例如 "A3 B2" 或 "AA B"（每段至少 1 针）。
 *
 * 返回首个结构错误；若无结构错误但针数之和不等于行宽，返回 COUNT_MISMATCH。
 */
export function decodeLine(text: string, width: number, rowIndexZeroBased: number): DecodedLine {
  const dir = directionOf(rowIndexZeroBased);
  const runs: ParsedRun[] = [];
  let error: LineError | null = null;
  let pos = 0;

  const fail = (e: LineError): DecodedLine => ({
    direction: dir,
    runs,
    total: runs.reduce((sum, r) => sum + r.count, 0),
    cells: [],
    error: e,
  });

  while (pos < text.length) {
    // 跳过段间空白
    SPACE_RE.lastIndex = pos;
    const space = SPACE_RE.exec(text);
    if (space) {
      pos = space.index + space[0].length;
      if (pos >= text.length) break;
    }

    const start = pos;
    const ch = text[pos];

    if (!/[A-Za-z]/.test(ch)) {
      return fail({
        code: 'UNEXPECTED_CHAR',
        index: pos,
        length: 1,
        token: ch,
        message: `非法字符“${ch}”，口令应为“符号+针数”（如 A3、B2），段间用空格分隔`,
      });
    }

    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(text);
    if (!m) {
      return fail({
        code: 'UNEXPECTED_CHAR',
        index: pos,
        length: 1,
        token: ch,
        message: `无法识别的片段（起始于“${ch}”）`,
      });
    }

    const symbol = ch.toUpperCase();
    const countText = m[2];
    const tokenEnd = m.index + m[0].length;

    if (!isKnownSymbol(symbol)) {
      return fail({
        code: 'UNKNOWN_SYMBOL',
        index: start,
        length: 1,
        token: ch,
        message: `未知符号“${ch}”，可用符号：${PALETTE.map((s) => s.symbol).join('、')}`,
      });
    }

    let count = 1;
    if (countText !== '') {
      const parsed = Number(countText);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return fail({
          code: 'BAD_COUNT',
          index: tokenEnd - countText.length,
          length: countText.length,
          token: countText,
          message: `针数“${countText}”不是正整数`,
        });
      }
      count = parsed;
    }

    runs.push({ symbol, count, index: start, length: tokenEnd - start });
    pos = tokenEnd;
  }

  const total = runs.reduce((sum, r) => sum + r.count, 0);

  if (runs.length === 0) {
    return fail({
      code: 'EMPTY',
      index: 0,
      length: Math.max(text.length, 1),
      token: text,
      message: '空口令：每行必须恰好织满行宽针数',
    });
  }

  if (total !== width) {
    error = {
      code: 'COUNT_MISMATCH',
      index: 0,
      length: text.length,
      token: text,
      message: `针数 ${total} 与行宽 ${width} 不一致（${total > width ? `多 ${total - width} 针` : `少 ${width - total} 针`}）`,
    };
    return { direction: dir, runs, total, cells: [], error };
  }

  // 按实际走针顺序展开；偶数行从右缘起，故逆序落入视觉坐标
  const sequence: string[] = [];
  for (const r of runs) {
    for (let k = 0; k < r.count; k++) sequence.push(r.symbol);
  }
  const cells = dir === 'LTR' ? sequence : sequence.reverse();

  return { direction: dir, runs, total, cells, error: null };
}

/**
 * 解析全部行。任一行失败则 ok=false 且不产出网格（由后端保留原图）。
 */
export function decodeGrid(lines: string[], width: number): DecodeResult {
  const decoded = lines.map((text, i) => decodeLine(text, width, i));
  const ok = decoded.every((l) => l.error === null);
  return { width, height: lines.length, ok, lines: decoded };
}

/** 规范化口令文本：大写化、统一段间空格（仅用于展示，不改变语义） */
export function normalizeLine(text: string): string {
  const parts: string[] = [];
  const re = /([A-Za-z])\s*(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    parts.push(m[1].toUpperCase() + m[2]);
  }
  return parts.join(' ');
}
