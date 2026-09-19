/** 与后端 server/src/weaving.ts 对应的通信类型 */

export interface PaletteSymbol {
  symbol: string;
  name: string;
  color: string;
}

export type Direction = 'LTR' | 'RTL';

export interface Run {
  symbol: string;
  count: number;
}

export interface EncodedLine {
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

export type LineErrorCode =
  | 'EMPTY'
  | 'UNEXPECTED_CHAR'
  | 'UNKNOWN_SYMBOL'
  | 'BAD_COUNT'
  | 'COUNT_MISMATCH';

export interface LineError {
  code: LineErrorCode;
  index: number;
  length: number;
  token: string;
  message: string;
}

export interface ParsedRun extends Run {
  index: number;
  length: number;
}

export interface DecodedLine {
  direction: Direction;
  runs: ParsedRun[];
  total: number;
  cells: string[];
  error: LineError | null;
}

export interface DecodeResult {
  width: number;
  height: number;
  ok: boolean;
  lines: DecodedLine[];
  normalized: string[];
}
