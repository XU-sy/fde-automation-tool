// Step 10：服务端 API —— 接收前端传来的"已校对字段"，在服务端用 Playwright 触发自动录入。
//
// 为什么放在服务端、不在按钮里直接调 fillWebSystem？
//   浏览器环境里没法启动另一个无头浏览器去填网页（Playwright 是 Node 库；
//   而且让前端直接操控客户的网页系统存在安全/跨域问题）。
//   所以"真正动手填表"只能发生在服务器（Node 运行时），前端只负责把字段 POST 过来。
import { NextRequest, NextResponse } from "next/server";
import { fillWebSystem, type Fields } from "@/automation/fill-web";

// 明确使用 Node.js 运行时（Playwright 依赖 Node，不能用 edge 运行时）
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const fields = (await req.json()) as Fields;
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ ok: false, error: "字段格式不正确" }, { status: 400 });
    }

    await fillWebSystem(fields);

    return NextResponse.json({ ok: true, message: "已触发网页系统自动录入" });
  } catch (e: any) {
    console.error("[api/automate] 录入失败:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
