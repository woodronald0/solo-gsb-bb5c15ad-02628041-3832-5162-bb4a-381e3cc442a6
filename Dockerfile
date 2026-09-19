# ---- 阶段 1：构建前端静态资源 ----
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- 阶段 2：编译后端 TypeScript ----
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ ./
RUN npm run build

# ---- 阶段 3：运行镜像（仅生产依赖 + 构建产物）----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# 后端生产依赖（复用构建阶段生成的 lockfile）
COPY --from=server-build /app/server/package.json /app/server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

# 后端编译产物
COPY --from=server-build /app/server/dist ./server/dist

# 前端构建产物（由 Express 托管）
COPY --from=client-build /app/client/dist ./public

ENV PUBLIC_DIR=/app/public
EXPOSE 3000

# 容器内健康检查
HEALTHCHECK --interval=15s --timeout=3s --start-period=8s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
