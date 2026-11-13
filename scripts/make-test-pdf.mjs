// 生成一张"仿真物流运单"PDF，用来测试 Step 5 的字段提取是否真的能抠出内容。
// 用法：npm run make-test-pdf
// 产物：public/sample-waybill.pdf（之后可在 /upload 页上传它验证）

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const FONT_PATH = "C:\\Windows\\Fonts\\simhei.ttf"; // 黑体，Windows 自带

async function main() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = fs.readFileSync(FONT_PATH);
  const font = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([595, 420]); // A4 横向的一半，够用
  const { width, height } = page.getSize();

  const lines = [
    "物流运单 / DELIVERY ORDER",
    "",
    "运单号：SF1234567890",
    "收件人：张三",
    "联系电话：13800000000",
    "收货地址：浙江省杭州市余杭区文一西路969号3号楼502室",
    "下单日期：2026-09-18",
    "合计金额：128.50",
    "",
    "备注：易碎品，请轻拿轻放",
  ];

  let y = height - 50;
  page.drawText(lines[0], { x: 50, y, size: 18, font });
  y -= 34;

  for (const line of lines.slice(1)) {
    if (line) {
      page.drawText(line, { x: 50, y, size: 13, font });
    }
    y -= 24;
  }

  // 画个边框，更像真实单据
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
  });

  const pdfBytes = await pdfDoc.save();
  const outPath = path.join(process.cwd(), "public", "sample-waybill.pdf");
  fs.writeFileSync(outPath, pdfBytes);
  console.log("✅ 已生成测试运单 PDF:", outPath);
}

main().catch((e) => {
  console.error("生成失败:", e);
  process.exit(1);
});
