// CLI 入口：npm run automate
//
// 两种用法：
//   1) npm run automate                    → 用内置示例字段跑一遍（演示用）
//   2) npm run automate -- payload.json    → 读取云端演示页"下载字段 JSON"得到的真实字段
//
// 关键坑（Step 7 踩过）：Next.js 会自动加载 .env.local，但我们用 tsx 跑的独立 Node 脚本不会。
// 所以这里必须自己用 dotenv 把 .env.local 读进 process.env，否则读不到 TARGET_SYSTEM_URL。
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import dotenv from "dotenv";
import { fillWebSystem } from "./fill-web.js";

// import.meta.url 是当前文件的完整路径；fileURLToPath 转成普通文件路径；
// dirname 取所在目录；再往上一级（..）就是项目根目录，.env.local 在那里。
// 这样无论从项目根目录还是 automation 子目录运行，都能正确定位 .env.local。
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

// 演示用的示例字段（不带参数时用这套）
const DEMO_FIELDS: Record<string, string> = {
  tracking_no: "SF1234567890",
  receiver: "张三",
  address: "浙江省杭州市余杭区xxx路1号",
  phone: "13800000000",
  date: "2026-01-01",
  amount: "99.00",
};

/**
 * 决定这次要填哪些字段：
 *   - 不带参数        → 用示例字段
 *   - 参数是一段 JSON → 直接解析（形如 {"receiver":"张三"}）
 *   - 参数是一个文件  → 读文件再解析（形如 payload.json，云端演示页下载下来的就是这个）
 */
function loadFields(): { fields: Record<string, string>; source: string } {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  if (!arg) return { fields: DEMO_FIELDS, source: "内置示例字段" };

  const trimmed = arg.trim();
  if (trimmed.startsWith("{")) {
    return { fields: JSON.parse(trimmed), source: "命令行内联 JSON" };
  }

  // 文件路径：相对"你执行命令时所在目录"解析（用 relative 的直觉最不容易搞错）
  const filePath = resolve(process.cwd(), trimmed);
  if (!existsSync(filePath)) {
    throw new Error(`找不到字段文件：${filePath}\n提示：把下载的 payload.json 放到项目根目录，再执行 npm run automate -- payload.json`);
  }
  return { fields: JSON.parse(readFileSync(filePath, "utf8")), source: filePath };
}

async function main() {
  const { fields, source } = loadFields();
  console.log(`📥 字段来源：${source}`);
  await fillWebSystem(fields as any);
  console.log("🎉 自动化任务结束");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
