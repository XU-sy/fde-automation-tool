// Step 10 + Step 11（路线 A）：服务端 API —— 接收前端传来的"已校对字段"，触发自动录入。
//
// 为什么放在服务端、不在按钮里直接调 fillWebSystem？
//   浏览器环境里没法启动另一个无头浏览器去填网页（Playwright 是 Node 库；
//   而且让前端直接操控客户的网页系统存在安全/跨域问题）。
//   所以"真正动手填表"只能发生在服务器（Node 运行时），前端只负责把字段 POST 过来。
//
// Step 11 路线 A 的新增：环境自检（canLaunchBrowser）
//   部署到 Vercel 这类 serverless 平台时，环境里既没有 Chromium 也没有对应的系统依赖，
//   硬跑 fillWebSystem 必然报一堆看不懂的错。所以先判断"这台机器有没有能力开浏览器"：
//     - 有能力  → 正常填表（本地 npm run dev / 长驻 Node 服务）
//     - 没能力  → 返回 mode: "cloud-demo"，让前端提示用户"下载字段 JSON，回本地执行"
//   这样同一个部署既能在云端演示，又不会在演示时抛 500 崩溃。
import { NextRequest, NextResponse } from "next/server";

// 明确使用 Node.js 运行时（Playwright 依赖 Node，不能用 edge 运行时）
export const runtime = "nodejs";

// 这个路由永远不能被静态化/缓存：它是"动手干活"的动作接口。
export const dynamic = "force-dynamic";

/**
 * 当前这台机器，能不能真的启动一个浏览器？
 * - Vercel 部署后会自动注入 VERCEL=1 这个环境变量 → 说明在 serverless 上，不能开浏览器
 * - 也允许用 AUTOMATE_DISABLED=1 手动关掉（比如在不想被触发的环境里）
 */
function canLaunchBrowser(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.AUTOMATE_DISABLED === "1") return false;
  return true;
}

export async function POST(req: NextRequest) {
  // ① 先校验请求体，坏数据不进业务逻辑
  let fields: Record<string, string>;
  try {
    fields = (await req.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return NextResponse.json({ ok: false, error: "字段格式不正确" }, { status: 400 });
  }

  // ② 环境自检：云端没有 Chromium → 不硬跑，交还一条可执行的指路信息
  if (!canLaunchBrowser()) {
    console.warn("[api/automate] 当前环境无浏览器能力（serverless），返回本地执行指引");
    return NextResponse.json({
      ok: false,
      mode: "cloud-demo",
      error: "当前部署在云端：环境里没有 Chromium，录入引擎需在本地 FDE 机器上运行",
      hint: "下载字段 JSON（payload.json）放到本地项目根目录，然后运行：npm run automate -- payload.json",
    });
  }

  // ③ 有能力才真正动浏览器
  try {
    // 动态 import：只有真的要开浏览器时才加载 fill-web / playwright，
    // 避免构建阶段就把浏览器相关代码拉进产物。
    const { fillWebSystem } = await import("@/automation/fill-web");
    await fillWebSystem(fields as any);

    return NextResponse.json({ ok: true, message: "已触发网页系统自动录入" });
  } catch (e: any) {
    console.error("[api/automate] 录入失败:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
