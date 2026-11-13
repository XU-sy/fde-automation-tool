import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // 在浏览器里若没配环境变量会报错；这是脚手架的预期提示。
  console.warn("⚠️ 未检测到 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY，请在 .env.local 中配置");
}

export const supabase = createClient(url ?? "", anon ?? "");
