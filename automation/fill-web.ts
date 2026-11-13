// CDP / Playwright 自动填表骨架。
// 作用：打开目标网页系统，把提取好的字段填进去并提交——
// 这正是 FDE "客户只有网页、没 API、只能人肉点" 场景的自动化解法。
//
// 运行：npm run automate
import { chromium, type Browser, type Page } from "playwright";

// Record<string, string> 是 TypeScript 的"类型注解"：
// 意思是"一个对象，键是字符串、值也是字符串"。
// 比如 { tracking_no: "#f-tracking-no" } 就符合这个类型。
export type Fields = Record<string, string>;

// FIELD_SELECTORS = 字段名 ↔ 目标系统输入框选择器的"翻译表"。
// 左边是我们的字段键（必须和 run.ts / 提取逻辑里的键一致），
// 右边是你在 DevTools 里侦察到的真实 id（前面加 # 就是 id 选择器）。
// 这些 id 来自 demo-form 页面；真实客户系统得你一个个去 DevTools 找。
const FIELD_SELECTORS: Record<string, string> = {
  tracking_no: "#f-tracking-no",
  receiver: "#f-receiver",
  phone: "#f-phone",
  address: "#f-address",
  date: "#f-date",
  amount: "#f-amount",
};

// async 表示"这个函数内部有需要等待的异步操作"（开浏览器、填表都是异步的）；
// Promise<void> 表示"它最终返回一个'什么都不返回'的承诺"，调用方可以用 .then() 等它跑完。
export async function fillWebSystem(fields: Fields): Promise<void> {
  // process.env.XXX 读取环境变量（在 .env.local 里配的）。
  const url = process.env.TARGET_SYSTEM_URL;
  if (!url) {
    throw new Error("请设置 TARGET_SYSTEM_URL 环境变量（目标网页系统地址）");
  }

  // await = "等这个结果回来再继续"。chromium.launch 启动一个无界面浏览器。
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();

  // 打开目标网页，等到网络空闲再往下走。
  await page.goto(url, { waitUntil: "networkidle" });
  console.log("✅ 已打开目标系统：", url);

  // Object.entries(对象) 把 {键: 值} 拆成 [键, 值] 的数组，方便逐个遍历。
  // for...of 是"遍历数组里每一个元素"的写法。
  for (const [key, selector] of Object.entries(FIELD_SELECTORS)) {
    // fields[key] 可能不存在（没提取到），用 ?? "" 兜底成空串，避免报错。
    const value = fields[key] ?? "";
    // page.fill(选择器, 文本) = Playwright 找到那个输入框，把文本"打"进去。
    await page.fill(selector, value);
    console.log(`   ↳ 填入 ${key} = "${value}"  →  ${selector}`);
  }

  // 提交按钮的 id 是 #f-submit，它不在上面的映射表里（不是"字段"，是"动作"），单独点。
  await page.click("#f-submit");
  console.log("✅ 已点击提交按钮 #f-submit");

  // 等 1.5 秒，让页面把"录入成功"提示渲染出来，方便我们观察结果。
  await page.waitForTimeout(1500);

  // 截图存证：把填好并提交后的页面存成图片，headless 模式下也能"看到"结果。
  // 路径相对你运行命令时所在的目录（项目根目录）。
  await page.screenshot({ path: "automation/last-run.png" });
  console.log("📸 已截图存证：automation/last-run.png");

  await browser.close();
  console.log("✅ 浏览器已关闭");
}
