import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  PALETTE,
  encodeGrid,
  decodeGrid,
  normalizeLine,
  isKnownSymbol,
} from './weaving';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const MIN_DIM = 1;
const MAX_DIM = 200;

function badRequest(res: Response, message: string): Response {
  return res.status(400).json({ error: message });
}

/** 校验网格尺寸与单元符号 */
function validateGrid(body: any): string[][] | null {
  const grid = body?.grid;
  if (!Array.isArray(grid)) return null;
  const height = grid.length;
  if (height < MIN_DIM || height > MAX_DIM) return null;
  const width = height > 0 ? grid[0].length : 0;
  if (width < MIN_DIM || width > MAX_DIM) return null;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== width) return null;
    for (const cell of row) {
      if (typeof cell !== 'string' || cell.length !== 1 || !isKnownSymbol(cell)) return null;
    }
  }
  return grid as string[][];
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/api/palette', (_req: Request, res: Response) => {
  res.json({ palette: PALETTE });
});

/** 网格 → 口令 */
app.post('/api/encode', (req: Request, res: Response) => {
  const grid = validateGrid(req.body);
  if (!grid) {
    return badRequest(res, '网格无效：需为非空二维符号数组，且每行列数一致（1–200）');
  }
  res.json(encodeGrid(grid));
});

/** 口令 → 网格（仅当每一行针数恰好等于行宽时才产出网格） */
app.post('/api/decode', (req: Request, res: Response) => {
  const { lines, width } = req.body ?? {};
  if (!Array.isArray(lines) || lines.some((l) => typeof l !== 'string')) {
    return badRequest(res, 'lines 必须是字符串数组，每行一条口令');
  }
  if (!Number.isInteger(width) || width < MIN_DIM || width > MAX_DIM) {
    return badRequest(res, `width 必须是 ${MIN_DIM}–${MAX_DIM} 之间的整数`);
  }
  if (lines.length < MIN_DIM || lines.length > MAX_DIM) {
    return badRequest(res, `行数必须在 ${MIN_DIM}–${MAX_DIM} 之间`);
  }

  const result = decodeGrid(lines, width);
  res.json({
    ...result,
    // 规范化后的口令（段间单空格、统一大写），供前端回显
    normalized: lines.map(normalizeLine),
  });
});

/* 静态资源：生产环境由本服务直接托管前端构建产物 */
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  // SPA 回退：非 /api 路由一律交给前端
  app.get(/^\/(?!api\/).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

// 兜底错误处理
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: '请求体不是合法 JSON' });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`提花口令校验服务已启动: http://0.0.0.0:${PORT}`);
});
