# 提花编织口令校验（Jacquard Pass Validator）

在**定宽符号网格**上绘制提花图案，系统按机头实际编织方向（奇数行左→右、偶数行右→左，逐行交替）生成**逐行游程口令**；也可直接编辑口令，**只有当每行针数恰好等于行宽时**才回写网格，否则保留原图并逐行定位数量错误。偶数行的视觉坐标在网格与口令之间始终不镜像。

技术栈：React 18 + TypeScript + Vite（前端）、Node.js + Express + TypeScript（后端）、Docker 多阶段构建。

## 单条命令启动

```bash
docker compose up --build -d
```

启动后访问： **http://localhost:3000**

- 构建会自动完成前后端依赖安装与编译（无需本机安装 Node）；
- 浏览器只需暴露 3000 一个端口，后端同时托管前端静态资源与 `/api`。

停止：

```bash
docker compose down
```

> 端口可在 `docker-compose.yml` 的 `ports` 中修改（如 `"8080:3000"`）。

## 编织规则

| 行 | 走针方向（机头实际） | 口令起点（视觉） |
|----|--------------------|------------------|
| 第 1、3、5… 奇数行 | 左 → 右 | 视觉最左列 |
| 第 2、4、6… 偶数行 | 右 → 左 | 视觉最右列 |

- 口令格式：`符号+针数`，段间用空格分隔；针数省略表示 1。例如 `A3 B2 A3` 表示 A 纱 3 针、B 纱 2 针、A 纱 3 针；`C D4` 表示 C 纱 1 针、D 纱 4 针。
- 可用符号：`E`（底纱/空针）、`A`（红）、`B`（蓝）、`C`（金）、`D`（绿）。
- **偶数行不镜像**：口令严格按走针先后记录，偶数行从视觉右缘起；回写网格时按右→左落位，因此“网格 → 口令 → 网格”往返后图案完全一致。
  - 例：视觉行为 `A A B B A`，偶数行口令为 `A B2 A2`（右缘起：1 针 A、2 针 B、2 针 A），解析后视觉行仍是 `A A B B A`。
- **针数硬校验**：每行口令各段针数之和必须**恰好等于行宽**。多出或少一针都不会改动网格，错误行会高亮并标注 `实际针数 / 行宽` 与多/少几针；非法字符、未知符号、非正整数针数同样逐行定位。

## 使用方式

1. 顶部设置行宽/行数后点「新建画布」，或点「载入示例」；
2. 在色卡中选择纱线，在网格上单击或按住拖动绘制；
3. 切到「编织口令」：按当前网格自动生成逐行游程（每一行标注方向与起针侧）；
4. 直接修改口令，输入框右侧实时显示每行针数与着色游程条；
5. 点「解析并回写网格」：全部行针数等于行宽才写回网格并自动切回图案视图；任一行失败则保留原图，自动滚动到第一条错误。

## 本地开发（不用 Docker）

需要 Node.js ≥ 20。

```bash
# 终端 1：后端（http://localhost:3000）
cd server
npm install
npm run dev

# 终端 2：前端（http://localhost:5173，/api 自动代理到 3000）
cd client
npm install
npm run dev
```

本地构建前端：`cd client && npm run build`；编译后端：`cd server && npm run build && npm start`。

## HTTP 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/palette` | 色卡（符号、名称、颜色） |
| POST | `/api/encode` | 入参 `{ grid: string[][] }`，返回逐行口令、方向、游程、总针数 |
| POST | `/api/decode` | 入参 `{ lines: string[], width: number }`，返回每行解析结果；`ok=false` 时不含网格（尺寸上限 200×200） |

请求示例：

```bash
curl -s -X POST http://localhost:3000/api/decode \
  -H 'Content-Type: application/json' \
  -d '{"width":5,"lines":["A3 B2","A B2 A2"]}'
```

## 目录结构

```
.
├── Dockerfile              # 多阶段：构建前端 → 编译后端 → 生产运行镜像
├── docker-compose.yml      # 单命令编排，暴露 3000 端口
├── server/                 # Express + TypeScript
│   └── src/
│       ├── weaving.ts      # 核心算法：方向、游程编码、口令解析、针数校验
│       └── index.ts        # API 与静态资源托管
└── client/                 # React + TypeScript + Vite
    └── src/
        ├── App.tsx         # 网格/口令双模式状态编排
        └── components/
            ├── GridEditor.tsx  # 定宽符号网格（拖绘）
            └── CodeEditor.tsx  # 逐行口令编辑与错误定位
```
