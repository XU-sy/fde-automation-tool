"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldReviewTable } from "@/components/field-review-table";
import { extractPdfText } from "@/lib/extract";
import { parseFields } from "@/lib/parse-fields";
import { supabase } from "@/lib/supabase/client";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [automating, setAutomating] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "saved" | "error" | "reviewed" | "automated" | "local-only"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  // 云端演示模式下，服务端会回一条"指引"，这里存下来展示给用户
  const [cloudHint, setCloudHint] = useState<string>("");

  async function handleExtract() {
    console.log("[点击] 提取字段按钮被点击", { fileName: file?.name });
    if (!file) return;
    setLoading(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      // Step 5：真实解析 PDF -> 纯文本 -> 规则抽字段
      const buf = await file.arrayBuffer();
      const text = await extractPdfText(buf);
      const result = parseFields(text) as Record<string, string>;

      setRawText(text);
      setFields(result);

      // Step 4：写入 Supabase documents 表（用 select().single() 拿回 id，供后续校对更新）
      const { data, error } = await supabase
        .from("documents")
        .insert({
          filename: file.name,
          raw_text: text.slice(0, 5000),
          extracted: result,
          status: Object.keys(result).length > 0 ? "extracted" : "failed",
        })
        .select()
        .single();

      if (error) {
        console.error("保存到 Supabase 失败:", error);
        setStatus("error");
        setErrorMsg(error.message);
      } else {
        setDocId(data?.id ?? null);
        setStatus("saved");
      }
    } catch (e: any) {
      console.error("PDF 解析失败:", e);
      setStatus("error");
      setErrorMsg(e?.message ?? String(e));
    }

    setLoading(false);
  }

  // Step 6：校对完成后把人工修正的结果回写数据库
  async function handleSaveReview() {
    if (!docId || !fields) return;
    setSaving(true);
    const { error } = await supabase
      .from("documents")
      .update({ extracted: fields, status: "reviewed" })
      .eq("id", docId);

    if (error) {
      console.error("校对结果保存失败:", error);
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("reviewed");
    }
    setSaving(false);
  }

  // Step 10：一键录入 —— 把"已校对的字段"发给服务端 API，由服务端用 Playwright 真正填表。
  // 注意：浏览器里不能直接跑 Playwright（它是 Node 库，且让前端控制客户系统有安全/跨域问题），
  //       所以"动手填表"只能发生在服务器（/api/automate）。
  async function handleAutomate() {
    if (!fields) return;
    setAutomating(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();

      // 云端演示模式：服务端没有 Chromium，不硬跑，改为"下载字段 → 回本地执行"
      if (data.mode === "cloud-demo") {
        setStatus("local-only");
        setCloudHint(data.hint ?? "");
      } else if (data.ok) {
        setStatus("automated");
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "录入失败");
      }
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e?.message ?? String(e));
    }
    setAutomating(false);
  }

  // 把当前校对的字段导出成 payload.json（给本地录入引擎吃）
  function handleDownloadPayload() {
    if (!fields) return;
    const blob = new Blob([JSON.stringify(fields, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payload.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-2xl font-bold">上传并提取</h1>

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <Button onClick={handleExtract} disabled={!file || loading}>
        {loading ? "提取中..." : "提取字段"}
      </Button>

      {status === "saved" && (
        <p className="text-green-600 text-sm">✅ 已保存到 Supabase，请在下方校对</p>
      )}
      {status === "reviewed" && (
        <p className="text-green-600 text-sm">✅ 校对结果已回写数据库</p>
      )}
      {status === "automated" && (
        <p className="text-green-600 text-sm">
          ✅ 已触发自动录入，服务器已在后台填表并提交（证据见 automation/last-run.png）
        </p>
      )}
      {status === "error" && (
        <p className="text-red-600 text-sm">❌ 失败：{errorMsg}</p>
      )}

      {status === "local-only" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 space-y-2">
          <p className="font-medium">
            ⚠️ 云端演示模式：这台服务器没有 Chromium，"动手填表"要回本地跑
          </p>
          <p>
            字段已经校验过了，把下面这份 JSON 交给本地录入引擎即可（本地窗口会自动打开并提交）：
          </p>
          <ol className="list-decimal ml-5 space-y-1">
            <li>点下面的按钮，下载 payload.json</li>
            <li>把它放到项目根目录（fde-automation-tool 下）</li>
            <li>
              在本地终端执行：
              <code className="bg-white px-1 rounded border border-amber-200 mx-1">
                npm run automate -- payload.json
              </code>
            </li>
          </ol>
          {cloudHint && <p className="text-xs text-amber-700">{cloudHint}</p>}
          <Button variant="outline" onClick={handleDownloadPayload}>
            ⬇️ 下载字段 JSON（payload.json）
          </Button>
        </div>
      )}

      {fields && (
        <Card>
          <CardHeader>
            <CardTitle>提取结果（请校对）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 6：可编辑校对表格 */}
            <FieldReviewTable fields={fields} onChange={setFields} />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSaveReview}
                disabled={!docId || saving}
              >
                {saving ? "保存中..." : "保存校对结果"}
              </Button>

              {/* Step 10：校对后一键触发服务端 CDP 录入 */}
              <Button
                onClick={handleAutomate}
                disabled={!fields || automating}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {automating ? "录入中..." : "🚀 一键录入系统"}
              </Button>
            </div>

            {rawText && (
              <details>
                <summary className="text-sm text-slate-600 cursor-pointer">
                  查看 PDF 原文（前 500 字）
                </summary>
                <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto mt-2 whitespace-pre-wrap">
                  {rawText.slice(0, 500)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
