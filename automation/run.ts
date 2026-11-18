// CLI 入口：npm run automate
//
// 用法：
//   1) npm run automate                        → 用内置示例字段跑一遍（演示；重复跑会被防重挡下）
//   2) npm run automate -- payload.json        → 读取云端演示页"下载字段 JSON"得到的真实字段
//   3) npm run automate -- batch.json          → 批量：文件内容是字段对象数组 [{...},{...}]
//   4) npm run automate -- batch.json --force  → 忽略台账，强制重录（仅测试/客户明确要求补录）
//   5) npm run automate -- --retry-failed      → 只重试上一次失败的条目（读 automation/failures.json）
//
// 本文件是"编排层"：它决定录哪些、跳哪些、失败了怎么记；不负责怎么填表（那是 fill-web.ts）。
//
// 关键坑（Step 7 踩过）：Next.js 会自动加载 .env.local，但 tsx 跑的独立 Node 脚本不会，
// 所以这里必须自己用 dotenv 读进来，否则读不到 TARGET_SYSTEM_URL。
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import dotenv from "dotenv";
import { enterOnce, type EnterOutcome } from "./enter-once.js";
import { LEDGER_PATH, readFailures, writeFailures, type FailedItem } from "./ledger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

type Fields = Record<string, string>;

const DEMO_FIELDS: Fields = {
  tracking_no: "SF1234567890",
  receiver: "张三",
  address: "浙江省杭州市余杭区xxx路1号",
  phone: "13800000000",
  date: "2026-01-01",
  amount: "99.00",
};

interface Batch {
  items: Fields[];
  source: string;
}

/** 把用户给的东西统一成"字段对象数组"：单条、数组、{items:[]}、{fields:{}} 都收 */
function normalize(raw: unknown, source: string): Batch {
  const asFields = (v: unknown): Fields => {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      throw new Error(`字段格式不对（应是 {字段:值} 对象）：${JSON.stringify(v)}`);
    }
    return v as Fields;
  };

  if (Array.isArray(raw)) {
    return { items: raw.map(asFields), source };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) return { items: obj.items.map(asFields), source };
    if (obj.fields && typeof obj.fields === "object") return { items: [asFields(obj.fields)], source };
    return { items: [asFields(obj)], source };
  }
  throw new Error("payload 无法解析：应为字段对象、对象数组，或 {items:[...]}");
}

function loadBatch(positional: string[]): Batch {
  const arg = positional[0];
  if (!arg) return { items: [DEMO_FIELDS], source: "内置示例字段" };

  const trimmed = arg.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return normalize(JSON.parse(trimmed), "命令行内联 JSON");
  }

  const filePath = resolve(process.cwd(), trimmed);
  if (!existsSync(filePath)) {
    throw new Error(
      `找不到字段文件：${filePath}\n提示：把下载的 payload.json 放到项目根目录，再执行 npm run automate -- payload.json`
    );
  }
  return normalize(JSON.parse(readFileSync(filePath, "utf8")), filePath);
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--")).map((a) => a.replace(/^--/, "")));
  const positional = argv.filter((a) => !a.startsWith("--"));

  const force = flags.has("force");

  // 重试模式：只处理上次失败的条目
  let batch: Batch;
  if (flags.has("retry-failed")) {
    const failed = readFailures();
    if (failed.length === 0) {
      console.log("✅ 没有待重试的失败条目（automation/failures.json 为空或不存在）");
      return;
    }
    batch = { items: failed.map((f) => f.fields), source: `重试失败清单（${failed.length} 条）` };
  } else {
    batch = loadBatch(positional);
  }

  console.log(`📥 字段来源：${batch.source}`);
  console.log(`🗂  本批共 ${batch.items.length} 条${force ? "（--force：忽略台账）" : ""}`);

  const outcomes: EnterOutcome[] = [];
  const failedItems: FailedItem[] = [];

  for (let i = 0; i < batch.items.length; i++) {
    const fields = batch.items[i];
    const label = fields.tracking_no?.trim() || "(无运单号)";
    console.log(`\n──────── [${i + 1}/${batch.items.length}] 运单 ${label} ────────`);

    const outcome = await enterOnce(fields, { source: batch.source, force });
    outcomes.push(outcome);

    if (outcome.status === "failed") {
      failedItems.push({
        tracking_no: outcome.tracking_no,
        fields,
        error: outcome.error,
        at: new Date().toISOString(),
      });
    }
  }

  // 失败清单只保留"本次仍失败"的，避免历史噪音越滚越大
  writeFailures(failedItems);

  const entered = outcomes.filter((o) => o.status === "entered").length;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;

  console.log("\n════════════════ 本批结果 ════════════════");
  console.log(`✅ 成功录入：${entered}`);
  console.log(`⏭  跳过（已录过）：${skipped}`);
  console.log(`❌ 失败：${failed}`);
  console.log(`🗂  台账：${LEDGER_PATH}`);
  if (failed > 0) {
    console.log(`⚠️ 失败清单：automation/failures.json（共 ${failed} 条）`);
    console.log("   修复原因后执行：npm run automate -- --retry-failed");
  }
  console.log("═════════════════════════════════════════");

  // 有失败就用非零退出码，便于脚本/CI 判断
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
