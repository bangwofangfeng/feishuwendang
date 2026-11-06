import { db, nowIso } from '../server/db.js';

const MINUTE = 60 * 1000;

const samples = [
  {
    type: 'docx',
    token: 'demo_docx_roadmap',
    title: 'Q4 产品路线图评审',
    searchText:
      'Q4 产品路线图 评审 工作台 信息架构 移动端 离线阅读 权限模型 设计稿 评审结论 本周确认三个方向：新版工作台的导航收敛、移动端离线阅读、文档权限模型简化。',
    minutesAgo: 12,
  },
  {
    type: 'sheet',
    token: 'demo_sheet_budget',
    title: '2026 市场预算明细',
    searchText:
      '市场预算 渠道 投放 金额 负责人 品牌 内容 活动 上半年 下半年 预算明细 线上投放 线下活动 内容制作 数据工具',
    minutesAgo: 48,
  },
  {
    type: 'bitable',
    token: 'demo_base_crm',
    title: '客户跟进台账',
    searchText:
      '客户名称 阶段 负责人 下次跟进 金额 备注 续约 意向 沟通记录 华东 华南 重点客户 本周需要回访三家续约客户。',
    minutesAgo: 95,
  },
  {
    type: 'docx',
    token: 'demo_docx_onboarding',
    title: '新同事入职手册',
    searchText:
      '入职手册 账号开通 设备领取 团队介绍 第一周任务 导师 制度 报销 流程 新人 指南 欢迎加入团队。',
    minutesAgo: 60 * 26,
  },
  {
    type: 'sheet',
    token: 'demo_sheet_metrics',
    title: '周度增长指标',
    searchText:
      '周度 增长 指标 活跃 留存 转化 新增 用户 渠道 环比 数据看板 第 45 周 数据 本周活跃环比上升。',
    minutesAgo: 60 * 50,
  },
  {
    type: 'bitable',
    token: 'demo_base_recruit',
    title: '招聘进度看板',
    searchText:
      '招聘 进度 候选人 岗位 面试 终面 offer 入职 前端 后端 设计 产品经理 本周安排两场终面。',
    minutesAgo: 60 * 74,
  },
];

let inserted = 0;

for (const sample of samples) {
  const exists = db
    .prepare('SELECT id FROM sources WHERE type = ? AND token = ?')
    .get(sample.type, sample.token);
  if (exists) continue;

  const timestamp = new Date(Date.now() - sample.minutesAgo * MINUTE).toISOString();
  const info = db
    .prepare(
      `INSERT INTO sources (type, token, url, title, wiki_space_id, wiki_node_token, added_at, last_synced_at)
       VALUES (?, ?, NULL, ?, '', '', ?, ?)`
    )
    .run(sample.type, sample.token, sample.title, timestamp, timestamp);
  const sourceId = Number(info.lastInsertRowid);

  db.prepare(
    `INSERT INTO documents (source_id, type, token, title, meta_json, content_json, search_text, synced_at)
     VALUES (?, ?, ?, ?, '{}', '{}', ?, ?)`
  ).run(sourceId, sample.type, sample.token, sample.title, sample.searchText, timestamp);
  inserted += 1;
}

console.log(
  inserted
    ? `已写入 ${inserted} 条演示数据。运行 npm run demo:clear 可以清除。`
    : '演示数据已存在，无需重复写入。'
);
