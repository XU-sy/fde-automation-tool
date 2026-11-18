# FDE 工作流自动化工具

> 一个把今天学的全部技术串成一个真实可交付 MVP 的练习项目。
> 主题：**中小企业的 PDF 字段提取 → 校对 → 网页系统自动录入**（物流/订单录单场景）。
> 定位：这正是"草莽 FDE"进现场、重写工作流的那套打法。

---

## 一、它解决什么（FDE 视角）

客户的老系统只有网页、没有 API，员工每天手动把 PDF 里的单号/地址"抠"进网页表单。
本工具 = 上传 PDF → 自动提取字段 → 人工校对 → **用 CDP 自动把数据录进目标网页系统**。

你不需要求客户开放接口，就能把这条工作流重写掉——这就是 FDE 的核心价值。

---

## 二、架构图（对应你整理的名词留痕）

```
GitHub（代码仓库 / 版本 / 协作）
  ↓ push
npm install（装包 / 管版本 / 跑脚本）
  ↓ 构建出
Next.js（结构）  +  Tailwind / shadcn（外观）  +  Supabase（数据/账号）
  ↓ 需要自动化录入时
MCP（标准接口，AI 可调用）  →  CDP / Playwright（操控浏览器填表）
  ↓ 上线
Vercel（部署 / 托管）  +  Cloudflare（域名 / 加速 / 安全）
```

## 三、技术栈映射（每个概念在本项目用在哪里）

| 你学的概念 | 本项目的位置 | 你要动手的地方 |
|---|---|---|
| **Next.js** | `app/` 下页面（首页、/upload） | 加页面、接 API |
| **Tailwind** | `tailwind.config.ts` + 组件里的原子类 | 调样式 |
| **shadcn/ui** | `components/ui/`（手写 shadcn 风格 button/card/input） | 加新组件 |
| **Supabase** | `lib/supabase/client.ts` + `supabase/schema.sql` | 配项目、跑建表 SQL |
| **npm** | `package.json` 脚本（dev/build/automate/mcp） | 装依赖、跑命令 |
| **GitHub** | 整个仓库 | 建仓、提交、协作 |
| **MCP** | `automation/mcp-server.ts` | 加新工具、接 AI 客户端 |
| **CDP** | `automation/fill-web.ts`（Playwright 底层即 CDP） | 写选择器映射 |
| **Vercel** | `vercel.json` | 连 GitHub 一键部署 |
| **Cloudflare** | 域名 / DNS / 加速（见部署章） | 绑域名、开防护 |

---

## 四、目录结构

```
fde-automation-tool/
├── app/
│   ├── layout.tsx           # 根布局（含 SiteHeader）
│   ├── page.tsx             # 首页
│   ├── globals.css          # Tailwind 入口
│   └── upload/page.tsx      # 上传 + 提取 + 校对（核心交互页）
├── components/
│   ├── site-header.tsx
│   └── ui/{button,card,input}.tsx   # shadcn 风格组件
├── lib/
│   ├── utils.ts             # cn() 工具（clsx + tailwind-merge）
│   ├── supabase/client.ts   # Supabase 浏览器客户端
│   └── extract.ts           # PDF 字段提取骨架（占位）
├── supabase/
│   └── schema.sql           # documents 建表 + RLS
├── automation/
│   ├── fill-web.ts          # CDP/Playwright 自动填表（TODO 选择器）
│   ├── run.ts               # CLI 入口（npm run automate）
│   └── mcp-server.ts        # MCP 服务器（把录入暴露成工具）
├── package.json
├── next.config.mjs  tsconfig.json  tailwind.config.ts  postcss.config.mjs
├── .env.example  .gitignore  vercel.json
└── README.md
```

---

## 五、环境准备（一次性）

1. 装 **Node.js 22**（你已有 managed 运行时）。
2. 装 **Playwright** 浏览器内核：`npx playwright install chromium`（CDP 自动化要用）。
3. 注册 **Supabase** 免费项目，拿到 URL / anon key。
4. 注册 **GitHub**、**Vercel**、**Cloudflare** 账号（部署阶段用）。
5. 复制 `.env.example` 为 `.env.local` 并填值。

---

## 六、端到端流程（**你来完成的全部步骤**）

> 按顺序走。每步都标了练到的概念。✅ 表示脚手架已备好，⚠️ 表示要你填代码。

- [x] **Step 1 · 初始化（npm / GitHub）** ✅ 已完成
  项目根目录 `npm install`；`git init`；GitHub 建空仓库；首次 `git push` 已完成（`main` 分支，已设 upstream）。
  *练：npm 装包管版本、GitHub 存代码与版本。*
  > 安全闸门已过：`.env.local`、`node_modules/`、`.next/` 均未入库，仓库里只有 `.env.example`。

- [x] **Step 2 · 跑起前端（Next.js / Tailwind / shadcn）** ✅ 已完成
  `npm run dev`，打开 http://localhost:3000 ，确认首页与 /upload 能看。
  *练：Next.js 启动、Tailwind 生效、shadcn 组件渲染。*

- [x] **Step 3 · 配 Supabase（Supabase）** ✅ 已完成
  在 Supabase SQL Editor 跑 `supabase/schema.sql` 建表。把 URL/anon 填进 `.env.local`。
  *练：Supabase 建表 + 前端连后端。*
  > 已验证：REST 查询 `documents` 表返回正常、`npm run build` 日志出现 `Environments: .env.local`。

- [x] **Step 4 · 打通数据读写（Supabase + Next.js）** ✅ 已完成
  在 `/upload` 提取后，把结果 `insert` 进 `documents` 表；首页"历史记录"列表读取它。
  *练：前端调 Supabase 客户端做增查。*
  > 已验证：用 REST API 直连做过一次写入测试，成功返回记录 id。

- [x] **Step 5 · 真实 PDF 提取（Next.js / 数据科学）** ✅ 已完成
  `lib/extract.ts` 已替换为真实实现：`pdfjs-dist` 浏览器端解析 PDF → 纯文本 → 正则规则抽字段（运单号/收件人/电话/地址/日期/金额）。
  worker 已复制到 `public/pdf.worker.min.mjs`。
  *练：把你数据科学的"解析/抽取"能力用进来。*
  > 测试：`npm run make-test-pdf` 生成 `public/sample-waybill.pdf`，到 /upload 上传它应抽出 6 个字段。
  > TODO（进阶）：接大模型兜底，处理扫描件/图片型 PDF。

- [x] **Step 6 · 美化与组件化（Tailwind / shadcn）** ✅ 已完成
  新增 `components/ui/table.tsx`（shadcn 风格表格）与 `components/field-review-table.tsx`（可编辑校对表格）。
  未识别字段黄色高亮标"待补"，校对后可点"保存校对结果"把修正值回写数据库（status → `reviewed`）。
  *练：Tailwind 调样式、shadcn 加组件、跨项目复用。*

- [x] **Step 7 · 写自动化脚本（CDP / Playwright）** ✅ 已完成
  在 `automation/fill-web.ts` 里用 DevTools 侦察到 demo-form 的 6 个真实 id，填进 `FIELD_SELECTORS`，并实现"遍历填表 → 点提交 → 截图存证"。
  *练：CDP 操控浏览器、FDE 重写工作流的真功夫。*
  > 选择器来源：`/demo-form` 模拟系统，id 为 `#f-tracking-no` / `#f-receiver` / `#f-phone` / `#f-address` / `#f-date` / `#f-amount`，提交按钮 `#f-submit`。

- [x] **Step 8 · 跑通自动化（npm / CDP）** ✅ 已完成
  `npm run automate` 跑通：终端打印 6 行"↳ 填入…"、点提交、生成 `automation/last-run.png`。
  *练：npm 脚本跑 TS、Playwright 实操。*
  > 踩坑留痕：`tsx` 跑独立 Node 脚本**不会**自动读 `.env.local`（那是 Next.js 的特权），已在 `run.ts` 用 dotenv 手动加载，并用 `import.meta.url` 反推项目根目录，做到与运行目录无关。

- [x] **Step 9 · 包成 MCP 工具（MCP）** ✅ 已封装（未做客户端联调）
  `automation/mcp-server.ts` 已把录入暴露为 `automate_data_entry` 工具，`npm run mcp` 可启动。
  *练：MCP 标准接口——让 AI 能"说话"就驱动浏览器。*
  > 待补：尚未配置到 Claude Desktop / Cursor 做一次真实调用验证。

- [x] **Step 10 · 接成闭环（全栈联动）** ✅ 已完成
  校对页新增"🚀 一键录入系统"，POST 到 `/api/automate` → 服务端调 `fillWebSystem`。
  端到端已实测：上传 PDF → 提取 → 校对 → 一键录入，字段来自真实运单（张三 / 文一西路969号3号楼502室 / 2026-09-18 / 128.50）。
  *练：前端→后端→CDP 全链路。*

- [x] **Step 11a · 部署适配（代码侧）** ✅ 已完成
  因为服务器端要启动 Chromium，而 Vercel 这类 serverless 平台没有，所以采用"云端接单 + 本地执行"架构（见第九节）：
  `/api/automate` 加环境自检，检测到 `VERCEL` 就返回字段交接指引；上传页新增"下载 payload.json"；`run.ts` 支持 `npm run automate -- payload.json`。
  *练：运行时能力探测、部署环境差异处理。*

- [ ] **Step 11b · 在 Vercel 真正点一次部署**
  把 GitHub 仓库导入 Vercel，配 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 两个环境变量，Deploy。
  *练：Vercel 托管。域名走 Cloudflare（DNS + 免费 SSL + 加速 + WAF）。*

- [ ] **Step 12 · 收尾与复盘**
  写一份"这个 MVP 为某行业省了多少人力"的简短 case，存进你公司的案例库（呼应 SEO/GEO 获客）。
  *练：把交付变成可复制、可获客的资产。*

---

## 七、合规提醒（重要）

CDP 自动化**只用于你有权限的系统或公开数据**。爬竞品机密、绕登录、刷量均属违规，政企客户场景尤其要避。本项目 FIELD_SELECTORS 留空即为安全默认。

---

## 八、学习回顾（做完回头看）

走完上面 12 步，你等于亲手验证了今天整理的每一个名词：
**Next.js**（页面）→ **Tailwind/shadcn**（外观）→ **Supabase**（数据）→ **npm/GitHub**（工程地基）
→ **CDP**（自动填表）→ **MCP**（AI 可调）→ **Vercel/Cloudflare**（上线给人用）。

这整套，就是你作为老板带实习生从"教育"复制能力到"物流/制造/零售"的交付武器。

---

## 九、部署架构（路线 A：云端接单 + 本地执行）

### 为什么不能直接全推上云

`fillWebSystem` 依赖**服务端能启动 Chromium**。Vercel 这类 serverless 平台：

- 运行时环境里没有 Chromium 二进制；
- 也没有 Chromium 需要的 Linux 系统库（字体、libnss 等）；
- 函数实例是临时的，跑完就销毁，不适合"开浏览器 → 填表 → 提交"这种多秒级交互。

所以强行部署上去，只会在点"一键录入"时抛一堆看不懂的错。

### 采用的方案

同一份代码，两处部署形态，靠**运行时能力探测**分叉（不是维护两套代码）：

| 环境 | 探测结果 | 行为 |
|---|---|---|
| 本地 / 长驻 Node 服务 | `process.env.VERCEL` 不存在 | 真正启动浏览器，填表 + 提交 + 截图存证 |
| Vercel serverless | `process.env.VERCEL` 有值 | 不启动浏览器，返回 `mode: "cloud-demo"` + 字段交接指引 |

云端只承担"接单 + 校对"，录入引擎留在本地 FDE 机器上执行。这条分工在 RPA 类交付里很常见，不是妥协。

### 两端怎么衔接

1. 云端校对完，点"🚀 一键录入系统" → 页面出现琥珀色提示；
2. 点"⬇️ 下载字段 JSON"，得到 `payload.json`；
3. 放到本地项目根目录，执行：

```bash
npm run automate -- payload.json
```

### 相关环境变量

| 变量 | 用途 | 云端是否需要 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 | 需要 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | 需要 |
| `TARGET_SYSTEM_URL` | 要录入的目标网页系统 | 不需要 |
| `BROWSER_CHANNEL` | 浏览器内核：`chrome` / `msedge`，不填用自带 Chromium | 不需要 |
| `AUTOMATE_DISABLED` | 置 `1` 可手动关闭录入接口 | 可选 |

> 构建期注意：`playwright` 是原生能力库，若在云端构建时被要求下载浏览器二进制会超时。
> `vercel.json` 已设 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`，`next.config.mjs` 已设 `serverExternalPackages: ["playwright"]`。

### 安全提醒

`supabase/schema.sql` 里目前是 `allow all (dev only)` 策略，**任何拿到线上链接的人都能读写 `documents` 表**。
做作品集演示可接受，但对外公开前应改为基于 `auth.uid()` 的细粒度策略。
