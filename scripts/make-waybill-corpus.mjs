// 生成一批「版式各不相同」的虚拟物流运单 PDF，用于压测字段抽取规则。
// 目的：真实客户的单据不会长得跟我们那张样本一样。标签叫法、日期格式、
//       金额写法、电话号码写法、地址换行、干扰字段（订单号/运费/签收日期）都可能不同。
//
// 用法：npm run make-waybills
// 产物：public/waybills/v1..v8.pdf + public/waybills/expected.json（标准答案）

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const FONT_PATH = "C:\\Windows\\Fonts\\simhei.ttf";

/** 每一张单子：lines 逐行绘制，expected 是"正确答案" */
const CASES = [
  {
    id: "v1-standard",
    note: "基准版：和现有样本一致，用于回归",
    lines: [
      "物流运单 / DELIVERY ORDER",
      "",
      "运单号：SF1234567890",
      "收件人：张三",
      "联系电话：13800000000",
      "收货地址：浙江省杭州市余杭区文一西路969号3号楼502室",
      "下单日期：2026-09-18",
      "合计金额：128.50",
    ],
    expected: {
      tracking_no: "SF1234567890",
      receiver: "张三",
      phone: "13800000000",
      address: "浙江省杭州市余杭区文一西路969号3号楼502室",
      date: "2026-09-18",
      amount: "128.50",
    },
  },
  {
    id: "v2-label-variants",
    note: "标签叫法不同 + 冒号前有空格 + 全角符号",
    lines: [
      "电子运单",
      "",
      "快递单号 :  JD8899001122",
      "收件人姓名：李四",
      "手机号码：13911112222",
      "详细地址：广东省深圳市南山区科技园南路8号A栋1203",
      "发货日期：2026/9/5",
      "应付金额：￥86.00",
    ],
    expected: {
      tracking_no: "JD8899001122",
      receiver: "李四",
      phone: "13911112222",
      address: "广东省深圳市南山区科技园南路8号A栋1203",
      date: "2026-09-05",
      amount: "86.00",
    },
  },
  {
    id: "v3-cn-date",
    note: "日期用「年月日」中文写法",
    lines: [
      "物 流 运 单",
      "",
      "运单号：YT2026091800012",
      "收件人：王五",
      "联系电话：13700001111",
      "收货地址：江苏省南京市鼓楼区中山北路100号",
      "下单日期：2026年9月18日",
      "合计金额：45.60",
    ],
    expected: {
      tracking_no: "YT2026091800012",
      receiver: "王五",
      phone: "13700001111",
      address: "江苏省南京市鼓楼区中山北路100号",
      date: "2026-09-18",
      amount: "45.60",
    },
  },
  {
    id: "v4-amount-comma",
    note: "金额带千分位与货币符号",
    lines: [
      "物流运单",
      "",
      "运单号：ZTO5566778899",
      "收件人：陈七",
      "联系电话：13500003333",
      "收货地址：四川省成都市武侯区天府大道北段1700号",
      "下单日期：2026-09-12",
      "合计金额：¥1,280.00",
    ],
    expected: {
      tracking_no: "ZTO5566778899",
      receiver: "陈七",
      phone: "13500003333",
      address: "四川省成都市武侯区天府大道北段1700号",
      date: "2026-09-12",
      amount: "1280.00",
    },
  },
  {
    id: "v5-phone-separated",
    note: "电话号码带横线/空格/国家码",
    lines: [
      "物流运单",
      "",
      "运单号：YD3322110099",
      "收件人：刘八",
      "联系电话：138-0000-1234",
      "收货地址：湖北省武汉市洪山区珞喻路1037号",
      "下单日期：2026-09-08",
      "合计金额：59.90",
    ],
    expected: {
      tracking_no: "YD3322110099",
      receiver: "刘八",
      phone: "13800001234",
      address: "湖北省武汉市洪山区珞喻路1037号",
      date: "2026-09-08",
      amount: "59.90",
    },
  },
  {
    id: "v6-address-wrapped",
    note: "地址跨两行（真实单据最常见）",
    lines: [
      "物流运单",
      "",
      "运单号：STO6677889900",
      "收件人：周九",
      "联系电话：13300004444",
      "收货地址：浙江省宁波市鄞州区",
      "首南街道天童南路666号B座9楼",
      "下单日期：2026-09-10",
      "合计金额：72.30",
    ],
    expected: {
      tracking_no: "STO6677889900",
      receiver: "周九",
      phone: "13300004444",
      address: "浙江省宁波市鄞州区首南街道天童南路666号B座9楼",
      date: "2026-09-10",
      amount: "72.30",
    },
  },
  {
    id: "v7-distractors",
    note: "干扰项：订单号与运单号并存、运费与合计并存、发货日与签收日并存",
    lines: [
      "物流运单",
      "",
      "订单号：ORD20260918001",
      "运单号：SF7788990011",
      "收件人：赵六",
      "联系电话：13600002222",
      "收货地址：北京市朝阳区建国路88号SOHO现代城C座",
      "下单日期：2026-09-17",
      "签收日期：2026-09-19",
      "运费：12.00",
      "代收货款：300.00",
      "合计金额：312.00",
    ],
    expected: {
      tracking_no: "SF7788990011",
      receiver: "赵六",
      phone: "13600002222",
      address: "北京市朝阳区建国路88号SOHO现代城C座",
      date: "2026-09-17",
      amount: "312.00",
    },
  },
  {
    id: "v8-english",
    note: "英文单据 + 国际号码",
    lines: [
      "DELIVERY ORDER",
      "",
      "Tracking No.: DHL1234567890",
      "Consignee: John Smith",
      "Tel: +86 138 0000 5678",
      "Address: 88 Jianguo Road, Chaoyang District, Beijing",
      "Date: 2026-09-18",
      "Total: 1,050.00",
    ],
    expected: {
      tracking_no: "DHL1234567890",
      receiver: "John Smith",
      phone: "13800005678",
      address: "88 Jianguo Road, Chaoyang District, Beijing",
      date: "2026-09-18",
      amount: "1050.00",
    },
  },
];

async function buildPdf(fontBytes, lines) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes);

  const pageH = 140 + lines.length * 26;
  const page = pdfDoc.addPage([595, pageH]);
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 30,
    y: 24,
    width: width - 60,
    height: height - 48,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 1,
  });

  let y = height - 56;
  lines.forEach((line, i) => {
    if (line) {
      page.drawText(line, { x: 50, y, size: i === 0 ? 18 : 13, font });
    }
    y -= i === 0 ? 34 : 26;
  });

  return pdfDoc.save();
}

async function main() {
  const fontBytes = fs.readFileSync(FONT_PATH);
  const outDir = path.join(process.cwd(), "public", "waybills");
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = [];
  for (const c of CASES) {
    const bytes = await buildPdf(fontBytes, c.lines);
    const file = `${c.id}.pdf`;
    fs.writeFileSync(path.join(outDir, file), bytes);
    manifest.push({ id: c.id, file, note: c.note, expected: c.expected });
    console.log(`✅ ${file}  —— ${c.note}`);
  }

  fs.writeFileSync(
    path.join(outDir, "expected.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  console.log(`\n共生成 ${manifest.length} 张，标准答案已写入 public/waybills/expected.json`);
}

main().catch((e) => {
  console.error("生成失败:", e);
  process.exit(1);
});
