// 批量评测：把 public/waybills/ 下的每张虚拟运单跑一遍抽取，逐字段比对标准答案。
// 用法：npm run eval-extract
// 退出码：有任一字段不符则 exit 1（便于以后接 CI）

import fs from "node:fs";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseFields } from "../lib/parse-fields";

type Case = {
  id: string;
  file: string;
  note: string;
  expected: Record<string, string>;
};

const FIELDS = ["tracking_no", "receiver", "phone", "address", "date", "amount"];

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

function pad(s: string, n: number): string {
  // 中文占两格宽度，简单处理：按字符数补空格即可，够看
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main() {
  const dir = path.join(process.cwd(), "public", "waybills");
  const manifestPath = path.join(dir, "expected.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("找不到 expected.json，请先运行：npm run make-waybills");
    process.exit(1);
  }

  const cases: Case[] = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  console.log("");
  console.log(
    pad("用例", 20) + pad("单号", 8) + pad("收件人", 8) + pad("电话", 6) +
    pad("地址", 6) + pad("日期", 6) + "金额"
  );
  console.log("-".repeat(62));

  let totalHit = 0;
  let totalField = 0;
  const failures: string[] = [];

  for (const c of cases) {
    const buf = fs.readFileSync(path.join(dir, c.file));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const text = await extractPdfText(ab);
    const got = parseFields(text) as Record<string, string>;

    const cells: string[] = [];
    let hit = 0;
    for (const f of FIELDS) {
      const expect = (c.expected[f] ?? "").trim();
      const actual = (got[f] ?? "").trim();
      const ok = expect === actual;
      if (ok) hit++;
      cells.push(ok ? "OK" : "X");
      if (!ok) {
        failures.push(
          `  ${c.id} / ${f}\n     期望: ${expect || "(空)"}\n     实际: ${actual || "(空)"}`
        );
      }
    }
    totalHit += hit;
    totalField += FIELDS.length;
    console.log(
      pad(c.id, 20) + pad(cells[0], 8) + pad(cells[1], 8) + pad(cells[2], 6) +
      pad(cells[3], 6) + pad(cells[4], 6) + cells[5]
    );
  }

  console.log("-".repeat(62));
  const pct = Math.round((totalHit / totalField) * 100);
  console.log(`字段命中率：${totalHit}/${totalField}（${pct}%）`);

  if (failures.length) {
    console.log("\n=== 未通过明细 ===");
    console.log(failures.join("\n"));
    process.exit(1);
  }
  console.log("\n全部通过");
}

main().catch((e) => {
  console.error("评测失败:", e);
  process.exit(1);
});
