import { useEffect, useRef } from 'react';
import type { PaletteSymbol } from '../types';
import { DIRECTION_TEXT, directionOf } from '../direction';

interface GridEditorProps {
  grid: string[][];
  palette: PaletteSymbol[];
  brush: string;
  onBrushChange: (symbol: string) => void;
  onPaint: (row: number, col: number) => void;
}

const CELL_SIZE = 28;

export function GridEditor({
  grid,
  palette,
  brush,
  onBrushChange,
  onPaint,
}: GridEditorProps) {
  const paintingRef = useRef(false);

  // 在 window 上抬起结束拖绘，保证移出格子后也能停止
  useEffect(() => {
    const stop = () => {
      paintingRef.current = false;
    };
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  const colorOf = (symbol: string): string =>
    palette.find((p) => p.symbol === symbol)?.color ?? '#e5e7eb';

  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  return (
    <div className="grid-editor">
      <div className="palette" role="group" aria-label="选择纱线符号">
        {palette.map((p) => (
          <button
            key={p.symbol}
            type="button"
            className={`palette-item${brush === p.symbol ? ' active' : ''}`}
            onClick={() => onBrushChange(p.symbol)}
            title={`${p.symbol} · ${p.name}`}
          >
            <span
              className="swatch"
              style={{ backgroundColor: p.color }}
              aria-hidden
            />
            <span className="palette-label">
              {p.symbol}
              <small>{p.name}</small>
            </span>
          </button>
        ))}
        <span className="palette-hint">单击或按住拖动绘制</span>
      </div>

      <div className="grid-scroll">
        <div className="grid">
          {grid.map((row, r) => {
            const dir = directionOf(r);
            return (
              <div
                className="grid-row"
                key={r}
                style={{
                  gridTemplateColumns: `56px repeat(${width}, ${CELL_SIZE}px)`,
                }}
              >
                <div className="row-label">
                  <span className="row-no">{r + 1}</span>
                  <span className={`row-dir ${dir === 'RTL' ? 'rtl' : 'ltr'}`}>
                    {dir === 'RTL' ? '→ ←' : '← →'}
                    <small>{DIRECTION_TEXT[dir]}</small>
                  </span>
                </div>
                {row.map((cell, c) => (
                  <div
                    key={c}
                    className={`cell${cell === 'E' ? ' empty' : ''}`}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      backgroundColor: colorOf(cell),
                    }}
                    title={`第 ${r + 1} 行 · 第 ${c + 1} 针（视觉坐标）`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      paintingRef.current = true;
                      onPaint(r, c);
                    }}
                    onPointerEnter={() => {
                      if (paintingRef.current) onPaint(r, c);
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <p className="grid-note">
        行号 {height > 0 ? 1 : '—'} 为奇数行（左→右起针），
        {height > 1 ? 2 : '—'} 为偶数行（右→左起针），奇偶交替；
        视觉列坐标固定不随编织方向镜像。
      </p>
    </div>
  );
}
