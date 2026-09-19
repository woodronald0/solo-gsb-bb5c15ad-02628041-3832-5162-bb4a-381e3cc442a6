export function directionOf(rowIndexZeroBased: number): 'LTR' | 'RTL' {
  return rowIndexZeroBased % 2 === 0 ? 'LTR' : 'RTL';
}

export const DIRECTION_TEXT = {
  LTR: '左 → 右',
  RTL: '右 → 左',
} as const;
