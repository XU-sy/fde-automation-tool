// CLI 入口：npm run automate
// 关键坑：Next.js 会自动加载 .env.local，但我们用 tsx 跑的独立 Node 脚本不会。
// 所以这里必须自己用 dotenv 把 .env.local 读进 process.env，否则读不到 TARGET_SYSTEM_URL。
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

// import.meta.url 是当前文件的完整路径；fileURLToPath 转成普通文件路径；
// dirname 取所在目录；再往上一级（..）就是项目根目录，.env.local 在那里。
// 这样无论从项目根目录还是 automation 子目录运行，都能正确定位 .env.local。
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

import { fillWebSystem } from "./fill-web.js";

fillWebSystem({
  tracking_no: "SF1234567890",
  receiver: "张三",
  address: "浙江省杭州市余杭区xxx路1号",
  phone: "13800000000",
  date: "2026-01-01",
  amount: "99.00",
})
  .then(() => console.log("🎉 自动化任务结束"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
