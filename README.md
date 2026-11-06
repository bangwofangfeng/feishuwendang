# 文档台 · 飞书文档汇总平台

把飞书里的云文档、电子表格、多维表格汇总到一个本地工作台：统一浏览、搜索、预览，并直接编辑回写飞书。另带一个 AI 助手，通过飞书官方 MCP Server 和本地补位工具用自然语言读写文档。

## 功能

- **汇总**：粘贴飞书链接导入 docx / sheets / base，或从知识库空间批量导入节点。
- **索引**：统一列表、按类型筛选、标题与正文搜索、定时同步与手动同步。
- **云文档**：块级渲染标题、正文、列表、待办、引用、代码、分割线、图片、表格；支持段落富文本编辑、插入/删除内容块、上传图片、插入表格。
- **电子表格**：工作表切换、单元格编辑、多行多列粘贴、按单元格批量保存、插入/删除行列、末尾追加行。
- **多维表格**：数据表切换、记录分页、按字段类型新增/编辑/删除记录（文本、数字、单选、多选、日期、复选框、电话、链接）。
- **AI 助手**：DeepSeek + 飞书 MCP，支持读取文档、修改块、操作多维表格记录；电子表格单元格与本地搜索由平台自己的工具补齐。写操作会在对话里显示工具调用记录。

## 环境

- Node.js **24+**（使用内置 `node:sqlite`，无需编译原生模块）
- npm

## 快速开始

```bash
npm install
cp .env.example .env
```

编辑 `.env`，填入飞书自建应用凭证：

```env
FEISHU_APP_ID=cli_xxxxxxxx
FEISHU_APP_SECRET=xxxxxxxx
```

启动开发环境（API 3001，前端 5173）：

```bash
npm run dev
```

打开 `http://localhost:5173`。前端由 Vite 代理 `/api` 到本地服务。

生产模式：

```bash
npm run build
npm start
```

此时 Express 直接托管 `dist/`，访问 `http://127.0.0.1:3001`。

## 飞书应用配置

1. 打开[飞书开放平台](https://open.feishu.cn/)，创建**企业自建应用**，在「凭证与基础信息」复制 App ID / App Secret。
2. 在「权限管理」开通以下权限（读写版本即可覆盖只读场景）：
   - `docx:document` 云文档读写
   - `sheets:spreadsheet` 电子表格读写
   - `bitable:app` 多维表格读写
   - `wiki:wiki` 知识库读写
   - `drive:drive` 云空间文件与素材（图片下载/上传）
3. 发布应用，等待企业管理员审核通过。
4. **把应用加为文档协作者**：在飞书文档右上角「分享」→ 添加协作者 → 搜索应用名称 → 授予可阅读或可编辑。电子表格、多维表格同理。
5. 知识库：进入知识空间设置 → 成员 → 添加应用，授予阅读或编辑权限。
6. 回到「数据源」页粘贴文档链接。应用未被授权时会返回飞书的具体错误和授权提示。

> 租户身份（tenant_access_token）只能访问显式授权给应用的文档。个人空间文档如果无法授权给应用，需要改用用户 OAuth，本项目暂未实现。
>
> 使用 Lark 国际版时，在 `.env` 中加上 `FEISHU_BASE_URL=https://open.larksuite.com`。

## AI 助手

默认使用 DeepSeek 的 OpenAI 兼容接口。在 `.env` 中填写：

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
# DEEPSEEK_BASE_URL=https://api.deepseek.com
MCP_ENABLED=true
```

- 官方 DeepSeek API 的基地址是 `https://api.deepseek.com`；使用第三方网关时改成对应的 OpenAI 兼容地址。
- 需要工具调用能力，建议使用 `deepseek-chat`；`deepseek-reasoner` 等模型对 function calling 的支持以服务商为准。
- 想切回 Claude 时设置 `AI_PROVIDER=anthropic`，并填写 `ANTHROPIC_API_KEY` 与 `ANTHROPIC_MODEL`。
- 使用 Anthropic 兼容网关（例如 OpenCode Go）时：设置 `AI_PROVIDER=anthropic`、`AI_GATEWAY_BASE_URL=https://opencode.ai/inference/go/anthropic`、`AI_GATEWAY_MODEL=deepseek-v4.1-flash`，并把网关 Key 填到 `AI_GATEWAY_API_KEY`；如需固定会话路由，可设置 `AI_GATEWAY_SESSION_ID`。`AI_GATEWAY_*` 优先于 `ANTHROPIC_*`，不会覆盖原来的 `ANTHROPIC_API_KEY`。
- OpenCode Go 会按 `x-opencode-session` 路由请求；`AI_GATEWAY_SESSION_ID` 留空时服务会自动生成裸 UUID。手工设置时请使用 UUID，不要加业务前缀，否则可能被路由到过载的上游。

重启 API 进程后打开「AI 助手」。首次对话会拉起官方 MCP Server：

```bash
node node_modules/@larksuiteoapi/lark-mcp/dist/cli.js mcp -a <APP_ID> -s <APP_SECRET> -d https://open.feishu.cn -l zh -c snake -t <工具列表>
```

说明：

- 官方 `@larksuiteoapi/lark-mcp` 目前没有电子表格单元格读写工具，因此项目额外注册了 `hub_sheets_*` 本地工具；文档块、多维表格记录优先走 MCP。
- MCP 启动失败或工具变更时，AI 仍可通过 `hub_*` 本地工具完成基础读写。
- AI 工具允许列表排除了删除类、权限类工具；删除内容请在页面里手动操作。

## 目录结构

```
feishu/
  server/
    index.js                 Express 入口、静态托管、定时同步
    config.js  db.js         .env 配置与 SQLite 初始化（node:sqlite）
    feishu/                  飞书 OpenAPI 封装：client/docx/sheets/bitable/wiki/drive
    services/                数据源导入、快照同步
    routes/                  REST 接口
    ai/                      MCP 客户端、DeepSeek/Claude 工具循环、本地补位工具
  shared/docx.js             docx 块类型与文本提取（前后端共用）
  src/
    pages/                   汇总、数据源、docx、sheets、bitable、AI、设置
    docx/                    块渲染器、DOM 与飞书 elements 互转
    ai/sse.js                SSE 解析
    styles.css               设计系统
  scripts/                   演示数据
  data/app.db                本地索引数据库（自动创建，gitignore）
```

## 主要接口

| 接口 | 说明 |
|---|---|
| `GET /api/status` | 配置状态与数量 |
| `GET /api/documents?type=&q=` | 汇总列表与搜索 |
| `GET /api/sources` / `POST /api/sources` / `DELETE /api/sources/:id` | 数据源管理 |
| `POST /api/sources/:id/sync` / `POST /api/sync` | 单个/全部同步 |
| `GET /api/wiki/spaces` / `GET /api/wiki/spaces/:id/nodes` / `POST /api/wiki/import` | 知识库浏览与导入 |
| `GET /api/docx/:token` | 文档元信息与全部块 |
| `PATCH /api/docx/:token/blocks/:blockId` | 更新文本块 |
| `POST/DELETE .../blocks/:parentId/children` | 插入/删除块 |
| `POST /api/docx/:token/images` | 上传图片并插入图片块 |
| `GET /api/media/:fileToken` | 图片代理 |
| `GET /api/sheets/:token` / `GET .../values?range=` | 工作表与单元格读取 |
| `PUT .../values` / `POST .../values/batch` / `POST .../values/append` | 单元格写入 |
| `POST/DELETE .../dimensions/*` | 行列插入与删除 |
| `GET /api/bitable/:token` 及 `/tables/:tableId/...` | 数据表、字段、记录 CRUD |
| `POST /api/ai/chat` | AI 对话（SSE 流） |
| `GET /api/ai/status` | AI 与 MCP 状态 |

## 演示数据

没有飞书凭证时，可以先看界面：

```bash
npm run demo:seed    # 写入 6 条演示索引（仅列表/搜索可用）
npm run demo:clear   # 清除演示数据
```

演示数据只写入本地 SQLite，不会访问飞书；打开详情页仍会提示凭证未配置。

## 已知限制

- 旧版飞书文档（链接含 `/docs/`）不支持，请先在飞书内转换为新版文档。
- docx 块移动/排序未实现；块类型转换请删除后重新插入。
- docx 插入表格依赖飞书创建块的嵌套结构，接口拒绝时会在页面提示；图片块同理。
- 表格只加载前 120 行 × 24 列，可逐步加载到 500 行；超大表请直接在飞书中查看。
- 表格保存按单元格写入，编辑公式单元格会把它变成值。
- 多维表格的公式、查找引用、人员、附件、关联字段为只读。
- 同步是快照：别人刚改的内容需要刷新或等待定时同步。编辑冲突以飞书最新版本为准，保存失败时刷新即可。
- 本地服务只监听 `127.0.0.1`，没有登录鉴权，请勿直接暴露到公网。
- `.env` 中的 App Secret 与 AI 提供方 Key 只存在服务端，不会下发到浏览器。

## 验证清单

1. `npm run build` 通过，`npm start` 后 `/api/health` 返回 `{"ok":true}`。
2. 配置凭证后，在「设置」点「测试连接」应返回正常 token 预览。
3. 粘贴一篇已授权给应用的 docx / sheets / base 链接，列表出现并按类型计数。
4. 打开详情页读取成功；编辑一个段落、一个单元格、一条记录，回飞书原文确认已变更。
5. 从知识库导入节点，列表出现对应文档。
6. 配置 DeepSeek Key 后，在 AI 助手选择一篇文档，问「总结要点」，确认出现读取工具调用与流式回答。
