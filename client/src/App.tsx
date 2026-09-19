import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DecodeResult, PaletteSymbol } from './types';
import { decodeLines, encodeGrid, fetchPalette } from './api';
import { GridEditor } from './components/GridEditor';
import { CodeEditor } from './components/CodeEditor';
import { SAMPLE_PATTERN } from './sample';

type Mode = 'grid' | 'code';

function makeGrid(width: number, height: number, fill: string): string[][] {
  return Array.from({ length: height }, () => Array<string>(width).fill(fill));
}

export default function App() {
  const [palette, setPalette] = useState<PaletteSymbol[]>([]);
  const [mode, setMode] = useState<Mode>('grid');

  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(10);
  const [grid, setGrid] = useState<string[][]>(() => makeGrid(10, 10, 'E'));
  const [brush, setBrush] = useState('A');

  // 口令编辑态：lines 为文本，decode 为最近一次服务端校验结果
  const [lines, setLines] = useState<string[]>([]);
  const [decode, setDecode] = useState<DecodeResult | null>(null);

  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchPalette()
      .then(setPalette)
      .catch((e: Error) => flash('err', e.message));
  }, []);

  function flash(kind: 'ok' | 'err', text: string) {
    setNotice({ kind, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }

  /* ------------------------- 网格操作 ------------------------- */

  const newCanvas = useCallback(() => {
    const w = Math.max(1, Math.min(64, Math.round(width)));
    const h = Math.max(1, Math.min(64, Math.round(height)));
    setWidth(w);
    setHeight(h);
    setGrid(makeGrid(w, h, 'E'));
    setDecode(null);
    flash('ok', `已新建 ${w} × ${h} 的空白网格`);
  }, [width, height]);

  const clearGrid = useCallback(() => {
    setGrid((g) => makeGrid(g[0]?.length ?? width, g.length, 'E'));
    flash('ok', '网格已清空（填充底纱 E）');
  }, [width]);

  const loadSample = useCallback(() => {
    const g = SAMPLE_PATTERN.map((r) => r.slice());
    setGrid(g);
    setWidth(g[0].length);
    setHeight(g.length);
    setDecode(null);
    setMode('grid');
    flash('ok', '已载入示例图案，可切换到「编织口令」查看逐行游程');
  }, []);

  const paint = useCallback((r: number, c: number) => {
    setGrid((g) => {
      if (g[r][c] === brush) return g;
      const next = g.map((row) => row.slice());
      next[r][c] = brush;
      return next;
    });
  }, [brush]);

  /* ------------------------- 模式切换 ------------------------- */

  const switchToCode = useCallback(async () => {
    setBusy(true);
    try {
      // 进入口令模式前，以当前网格重新生成口令，保证两边一致
      const result = await encodeGrid(grid);
      setLines(result.lines.map((l) => l.text));
      setDecode(null);
      setMode('code');
    } catch (e) {
      flash('err', e instanceof Error ? e.message : '口令生成失败');
    } finally {
      setBusy(false);
    }
  }, [grid]);

  const switchToGrid = useCallback(() => {
    // 切回网格不回写任何内容，网格保持原图
    setMode('grid');
  }, []);

  /* --------------------- 口令编辑与实时校验 --------------------- */

  const updateLine = useCallback((r: number, value: string) => {
    setLines((prev) => {
      const next = prev.slice();
      next[r] = value;
      return next;
    });
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (mode !== 'code') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      decodeLines(lines, width)
        .then(setDecode)
        .catch(() => setDecode(null));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [lines, width, mode]);

  const normalize = useCallback(() => {
    setLines((prev) =>
      prev.map((text) => {
        const tokens = text.toUpperCase().match(/[A-Z]\s*\d*/g) ?? [];
        return tokens.map((t) => t.replace(/\s+/g, '')).join(' ');
      }),
    );
  }, []);

  /**
   * 解析并回写：仅当每一行针数恰好等于行宽时更新网格，
   * 否则保留原图并定位数量/语法错误。
   */
  const applyDecode = useCallback(async () => {
    setBusy(true);
    try {
      const result = await decodeLines(lines, width);
      setDecode(result);
      if (!result.ok) {
        const count = result.lines.filter((l) => l.error).length;
        flash('err', `校验未通过：${count} 行有误，网格未改动，请查看错误定位`);
        return;
      }
      setGrid(result.lines.map((l) => l.cells.slice()));
      setMode('grid');
      flash('ok', `校验通过：${result.height} 行针数均为 ${width}，已回写网格`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : '解析失败');
    } finally {
      setBusy(false);
    }
  }, [lines, width]);

  const modeBadge = useMemo(
    () => (
      <span className="mode-legend">
        <b>奇数行</b>左→右起针 · <b>偶数行</b>右→左起针（视觉列坐标不镜像）
      </span>
    ),
    [],
  );

  if (palette.length === 0) {
    return <div className="app loading">正在加载色卡…</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>提花编织口令校验</h1>
        <p className="subtitle">
          定宽符号网格 ⇄ 逐行游程口令 · 奇偶行按实际编织方向交替 ·
          针数必须恰好等于行宽 {width}
        </p>
      </header>

      <div className="toolbar">
        <div className="toolbar-group">
          <label>
            行宽
            <input
              type="number"
              min={1}
              max={64}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <label>
            行数
            <input
              type="number"
              min={1}
              max={64}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
          <button type="button" className="btn" onClick={newCanvas}>
            新建画布
          </button>
          <button type="button" className="btn ghost" onClick={clearGrid}>
            清空
          </button>
          <button type="button" className="btn ghost" onClick={loadSample}>
            载入示例
          </button>
        </div>

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'grid'}
            className={`tab${mode === 'grid' ? ' active' : ''}`}
            onClick={switchToGrid}
          >
            图案网格
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'code'}
            className={`tab${mode === 'code' ? ' active' : ''}`}
            onClick={switchToCode}
            disabled={busy}
          >
            {busy ? '处理中…' : '编织口令'}
          </button>
        </div>
      </div>

      {modeBadge}

      {notice && (
        <div className={`notice ${notice.kind}`} role="status">
          {notice.text}
        </div>
      )}

      <main className="panel">
        {mode === 'grid' ? (
          <GridEditor
            grid={grid}
            palette={palette}
            brush={brush}
            onBrushChange={setBrush}
            onPaint={paint}
          />
        ) : (
          <CodeEditor
            lines={lines}
            width={width}
            decode={decode}
            applying={busy}
            palette={palette}
            onChange={updateLine}
            onApply={applyDecode}
            onNormalize={normalize}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          口令格式：<code>符号+针数</code>，段间空格分隔，针数省略表示 1
          （如 <code>A3 B2 A3</code>、<code>C D4</code>）。
          偶数行口令从视觉右缘起读，回写时不镜像——往返一行后图案保持不变。
        </p>
      </footer>
    </div>
  );
}
