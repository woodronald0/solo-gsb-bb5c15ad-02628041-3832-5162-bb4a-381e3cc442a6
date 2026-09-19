import { useEffect, useRef } from 'react';
import type { DecodeResult, PaletteSymbol } from '../types';
import { DIRECTION_TEXT, directionOf } from '../direction';

interface CodeEditorProps {
  lines: string[];
  width: number;
  decode: DecodeResult | null;
  applying: boolean;
  palette: PaletteSymbol[];
  onChange: (row: number, value: string) => void;
  onApply: () => void;
  onNormalize: () => void;
}

export function CodeEditor({
  lines,
  width,
  decode,
  applying,
  palette,
  onChange,
  onApply,
  onNormalize,
}: CodeEditorProps) {
  const firstErrorRef = useRef<HTMLDivElement | null>(null);

  // 首条错误行发生变化时滚动定位（避免用户打字时反复抢占滚动位置）
  const firstErrorRow = decode && !decode.ok
    ? decode.lines.findIndex((l) => l.error)
    : -1;
  const prevFirstErrorRef = useRef(-1);
  useEffect(() => {
    if (firstErrorRow >= 0 && firstErrorRow !== prevFirstErrorRef.current) {
      firstErrorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    prevFirstErrorRef.current = firstErrorRow;
  }, [firstErrorRow]);

  const errorCount = decode?.lines.filter((l) => l.error).length ?? 0;
  const colorOf = (symbol: string): string =>
    palette.find((p) => p.symbol === symbol)?.color ?? '#e5e7eb';

  return (
    <div className="code-editor">
      <div className="code-toolbar">
        <span className="code-summary">
          {decode ? (
            decode.ok ? (
              <span className="summary-ok">✓ 全部 {lines.length} 行针数均为 {width}，可回写网格</span>
            ) : (
              <span className="summary-err">
                {errorCount} 行有误，原图已保留；修正后再回写
              </span>
            )
          ) : (
            <span className="summary-idle">编辑口令后自动校验，针数须恰好等于行宽 {width}</span>
          )}
        </span>
        <button type="button" className="btn ghost" onClick={onNormalize}>
          格式化
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={onApply}
          disabled={applying}
        >
          {applying ? '校验中…' : '解析并回写网格'}
        </button>
      </div>

      <div className="code-list">
        {lines.map((value, r) => {
          const dir = directionOf(r);
          const line = decode?.lines[r] ?? null;
          const err = line?.error ?? null;
          const isFirstError =
            !!err && decode?.lines.findIndex((l) => l.error) === r;

          return (
            <div
              key={r}
              ref={isFirstError ? firstErrorRef : undefined}
              className={`code-line${err ? (err.code === 'COUNT_MISMATCH' ? ' warn' : ' error') : ''}${
                line && !err ? ' valid' : ''
              }`}
            >
              <div className="code-meta">
                <span className="row-no">{r + 1}</span>
                <span className={`row-dir ${dir === 'RTL' ? 'rtl' : 'ltr'}`}>
                  {dir === 'RTL' ? '→ ←' : '← →'}
                  <small>{DIRECTION_TEXT[dir]}</small>
                </span>
              </div>

              <input
                className="code-input"
                type="text"
                value={value}
                spellCheck={false}
                autoComplete="off"
                placeholder={`第 ${r + 1} 行口令，如 A3 B2…`}
                aria-label={`第 ${r + 1} 行口令`}
                onChange={(e) => onChange(r, e.target.value)}
              />

              <div className="code-status">
                {line ? (
                  err ? (
                    <span
                      className={
                        err.code === 'COUNT_MISMATCH' ? 'badge warn' : 'badge error'
                      }
                      title={err.message}
                    >
                      {line.total} / {width} 针
                    </span>
                  ) : (
                    <span className="badge ok">{line.total} 针 ✓</span>
                  )
                ) : (
                  <span className="badge idle">— / {width}</span>
                )}

                {/* 游程着色预览：按实际走针顺序，偶数行预览自右向左 */}
                <div className={`run-preview ${dir === 'RTL' ? 'rtl-preview' : ''}`}>
                  {line?.runs.map((run, i) => (
                    <span
                      key={i}
                      className="run-seg"
                      style={{
                        backgroundColor: colorOf(run.symbol),
                        flexGrow: run.count,
                        flexBasis: `${(run.count / Math.max(width, 1)) * 100}%`,
                      }}
                      title={`${run.symbol} × ${run.count}`}
                    >
                      {run.symbol}
                      {run.count > 1 ? run.count : ''}
                    </span>
                  ))}
                </div>
              </div>

              {err && (
                <p className="line-message">
                  <strong>{err.code === 'COUNT_MISMATCH' ? '数量错误：' : '语法错误：'}</strong>
                  {err.message}
                  <span className="error-snippet">（定位：“{err.token || value || '空行'}”）</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
