// Step 5：真实 PDF 字段提取（替换掉原来的占位返回）
//
// 思路（FDE 做法）：
//   1. 用 pdfjs-dist 在浏览器里把 PDF 逐页解析成纯文本（不需要后端、不上传文件）
//   2. 用正则/规则从文本里"抠"出业务字段（运单号、收件人、电话、地址、日期、金额）
//   3. 后面可以把文本再喂给大模型做兜底抽取（见文件末尾 TODO）
//
// 为什么用规则而不是一上来就用大模型：
//   - 规则可解释、可调试、零成本、离线可用——中小企业现场常常没网/没预算
//   - 规则跑通后再接大模型兜底，才是工程上稳的做法
//
// ⚠️ 修复记录（2026-10-20）：
//   legacy 版在浏览器端仍然要求提供 worker（报 No "GlobalWorkerOptions.workerSrc" specified）。
//   现已在文件顶部显式 new Worker("/pdf.worker.min.mjs", { type: "module" }) 并通过
//   GlobalWorkerOptions.workerPort 交给 pdf.js —— worker 文件与主库同为 legacy 版本，保持协议一致。

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseFields, type ExtractedFields } from "./parse-fields";

// 显式创建一个 module 类型的 Worker（worker 文件在 public/ 下，与主库同为 legacy 版本）
// 用 workerPort 直接把 worker 交给 pdf.js，绕开它自己创建 classic worker 导致的 .mjs 加载问题
if (typeof window !== "undefined") {
  const worker = new Worker("/pdf.worker.min.mjs", { type: "module" });
  pdfjsLib.GlobalWorkerOptions.workerPort = worker;
}

export { parseFields };
export type { ExtractedFields };

/** 把 PDF 解析成纯文本（所有页拼接） */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  console.log("[extract] ① 开始解析 PDF，字节数:", buffer.byteLength);
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  console.log("[extract] ② PDF 加载成功，页数:", pdf.numPages);

  let full = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // items 里每个是 TextItem，str 是文字；hasEOL 表示这里该换行
    const pageText = content.items
      .map((item: any) => (item.hasEOL ? `${item.str}\n` : item.str))
      .join("");
    full += pageText + "\n";
  }
  return full;
}

/**
 * 对外主函数：给一个 PDF 的 ArrayBuffer，返回抽出的字段。
 * 保留原函数签名，前端不用改调用方式。
 */
export async function extractFieldsFromPdf(
  buffer: ArrayBuffer
): Promise<Record<string, string>> {
  const text = await extractPdfText(buffer);
  console.log("[extract] ③ 提取到的纯文本长度:", text.length);
  console.log("[extract] ③-预览前200字:", JSON.stringify(text.slice(0, 200)));
  const fields = parseFields(text);
  console.log("[extract] ④ parseFields 抽出的字段:", fields);
  // 如果规则什么都没抠出来（比如扫描件/图片型 PDF），给个提示字段，
  // 避免出现"提取成功但一片空白"的假成功。
  if (Object.keys(fields).length === 0) {
    return {
      _warning:
        "未能识别到字段：可能是扫描件/图片型 PDF（无文字层），需接 OCR 或大模型兜底",
      _text_preview: text.slice(0, 200) || "(PDF 无文字层)",
    };
  }
  return fields as Record<string, string>;
}

// TODO（Step 5 进阶）：接大模型兜底
//  - 把 extractPdfText 的结果 POST 到 /api/extract
//  - 服务端调用大模型，用 JSON Schema 约束输出同样 6 个字段
//  - 规则抽不到时自动走大模型，抽到时用规则结果（省钱且稳定）
