// 离线验证 Step 5 的提取链路：读一张 PDF -> 抽文本 -> 抠字段 -> 打印结果。
// 用法：npm run verify-extract [pdf路径]
// 不传路径时默认用 public/sample-waybill.pdf

import fs from "node:fs";
import path from "node:path";
// Node 环境下必须用 legacy 构建（否则会警告/报错）
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseFields } from "../lib/parse-fields";

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf: any = await (pdfjsLib as any).getDocument({ data }).promise;
  let full = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    full +=
      content.items.map((it: any) => (it.hasEOL ? `${it.str}\n` : it.str)).join("") + "\n";
  }
  return full;
}

async function main() {
  const arg = process.argv[2];
  const pdfPath = arg
    ? path.resolve(arg)
    : path.join(process.cwd(), "public", "sample-waybill.pdf");

  if (!fs.existsSync(pdfPath)) {
    console.error("找不到 PDF:", pdfPath);
    process.exit(1);
  }

  const buf = fs.readFileSync(pdfPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const text = await extractPdfText(ab);
  console.log("=== PDF 原文 ===");
  console.log(text.trim());

  const fields = parseFields(text);
  console.log("\n=== 抽出字段 ===");
  console.log(JSON.stringify(fields, null, 2));

  const keys = Object.keys(fields);
  console.log(
    keys.length > 0
      ? `\n✅ 成功抽出 ${keys.length} 个字段`
      : "\n⚠️ 未抽出字段（可能是扫描件/图片型 PDF，需 OCR 或大模型兜底）"
  );
}

main().catch((e) => {
  console.error("验证失败:", e);
  process.exit(1);
});
