import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import './db.js';
import { FeishuApiError, describeFeishuError } from './feishu/client.js';
import aiRoutes from './routes/ai.js';
import bitableRoutes from './routes/bitable.js';
import docxRoutes from './routes/docx.js';
import documentRoutes from './routes/documents.js';
import metaRoutes from './routes/meta.js';
import sheetRoutes from './routes/sheets.js';
import sourceRoutes from './routes/sources.js';
import { syncStale } from './services/sync.js';

const app = express();
app.disable('x-powered-by');

// 图片上传走原始二进制，其余接口走 JSON
app.use('/api/docx/:token/images', express.raw({ type: 'image/*', limit: '20mb' }));
app.use(express.json({ limit: '25mb' }));

app.use('/api', metaRoutes);
app.use('/api', sourceRoutes);
app.use('/api', documentRoutes);
app.use('/api', docxRoutes);
app.use('/api', sheetRoutes);
app.use('/api', bitableRoutes);
app.use('/api', aiRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `接口不存在：${req.method} ${req.originalUrl}` });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status =
    error instanceof FeishuApiError
      ? error.status && error.status >= 400 && error.status < 600
        ? error.status
        : 502
      : error.status || 500;
  console.error(`[api] ${req.method} ${req.originalUrl}`, error);
  res.status(status).json({
    error: describeFeishuError(error),
    code: error.code,
    hint: error.hint || undefined,
  });
});

const distDir = path.join(config.root, 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

let timer = null;
if (config.syncIntervalMinutes > 0) {
  timer = setInterval(
    () => {
      syncStale(config.syncIntervalMinutes).catch((error) => {
        console.error('[sync] 定时同步失败', error);
      });
    },
    config.syncIntervalMinutes * 60 * 1000
  );
  timer.unref();
}

app.listen(config.port, '127.0.0.1', () => {
  console.log(`\n  飞书文档汇总平台 API → http://127.0.0.1:${config.port}`);
  if (!config.isFeishuConfigured) {
    console.log('  提示：尚未配置 FEISHU_APP_ID / FEISHU_APP_SECRET，接口会返回配置提示。');
  }
  if (existsSync(distDir)) {
    console.log(`  静态站点 → http://127.0.0.1:${config.port}`);
  } else {
    console.log('  前端开发地址请使用 npm run dev 输出的 Vite 地址（默认 5173）。');
  }
  if (config.isFeishuConfigured && config.syncIntervalMinutes > 0) {
    setTimeout(() => {
      syncStale(config.syncIntervalMinutes)
        .then((result) => {
          if (result.total) console.log(`[sync] 启动同步完成：${result.succeeded}/${result.total}`);
        })
        .catch((error) => console.error('[sync] 启动同步失败', error));
    }, 4000).unref();
  }
});
