// 纯规则抽取：不依赖浏览器 / 不依赖 pdfjs，所以可以在 Node 里直接跑测试。
// 拆出来的好处：规则可单测、可复用；PDF 解析那层换库也不影响这里。
//
// 2026-11-18 重构：用 8 张不同版式的虚拟运单压测后，重写为「归一化 + 标签优先级」结构。
// 原先的问题（已修）：
//   1. 正则按「文本中位置最靠前」命中，导致 订单号 抢在 运单号 前面；
//   2. 金额遇千分位只截到第一个数字（1,280.00 → "1"）；
//   3. 电话带横线/国家码时匹配不到；
//   4. 地址跨行只取第一行；
//   5. 日期格式不统一（2026年9月18日 原样返回）；
//   6. 标签重叠时捕获到标签本身（"收件人姓名" → 抓到 "姓名"）。
//
// 设计原则：先归一化文本，再按「标签优先级」逐级尝试——高优先级标签存在就用它，
//          而不是谁出现得早用谁。

export type ExtractedFields = {
  tracking_no?: string;
  receiver?: string;
  phone?: string;
  address?: string;
  date?: string;
  amount?: string;
};

/** 把全角符号、全角数字统一成半角，减少规则分支 */
function normalize(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/：/g, ":")
    .replace(/￥/g, "¥")
    .replace(/\u3000/g, " ")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

const onlyFirstLine = (s: string) => s.split("\n")[0].trim();

/** 去掉千分位与货币符号，只留数字和小数点 */
function cleanAmount(raw: string): string | undefined {
  const v = raw
    .replace(/[,，\s]/g, "")
    .replace(/[¥$]/g, "")
    .replace(/^RMB/i, "")
    .replace(/元$/, "");
  const m = v.match(/\d+(?:\.\d{1,2})?/);
  return m ? m[0] : undefined;
}

/** 电话号码归一化：去分隔符、去国家码，最后校验位数 */
function cleanPhone(raw: string): string | undefined {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0086")) d = d.slice(4);
  else if (d.startsWith("86") && d.length > 11) d = d.slice(2);
  if (/^1[3-9]\d{9}$/.test(d)) return d; // 手机
  if (/^0\d{9,11}$/.test(d)) return d; // 座机（带区号）
  return undefined;
}

/** 日期归一化成 YYYY-MM-DD */
function normalizeDate(raw: string): string | undefined {
  const m = raw.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
  if (!m) return undefined;
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  return `${m[1]}-${mm}-${dd}`;
}

/** 标签词，用于判断"这一行是不是另一个字段的开始"，避免把下一行吞进地址 */
const FIELD_LABEL_RE =
  /^(备注|合计|总计|总额|运费|金额|下单|发货|签收|出库|运单|订单|快递|物流|收件人|收货人|联系人|联系电话|电话|手机|日期|Address|Total|Date|Tel)/i;

/**
 * 按标签优先级取值。
 * labels 的顺序就是优先级：靠前的标签存在时，直接用它的值。
 * between 是"标签与值之间允许出现的字符"，默认允许空白和冒号。
 */
function pickByLabels(
  text: string,
  labels: string[],
  valuePattern: string
): string | undefined {
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 中文标签后常跟冒号；英文标签可能是 "No.: " 这种点+冒号组合，所以允许连续出现
    const re = new RegExp(`${esc}\\s*[:.]*\\s*(${valuePattern})`, "i");
    const m = text.match(re);
    if (!m) continue;
    const value = onlyFirstLine(m[1]).trim();
    if (value) return value;
  }
  return undefined;
}

/** 地址专用：允许跨行续接（真实单据里地址经常被排版拆成两行） */
function pickAddress(lines: string[], labels: string[]): string | undefined {
  for (const label of labels) {
    const idx = lines.findIndex((l) => l.includes(label));
    if (idx === -1) continue;

    const line = lines[idx];
    const afterLabel = line.slice(line.indexOf(label) + label.length);
    const head = afterLabel.replace(/^\s*[:.]?\s*/, "").trim();
    if (!head) continue;

    let addr = head;
    // 最多向下续接 2 行；遇到下一个字段标签、空行、含冒号的行就停
    for (let i = idx + 1; i < lines.length && i <= idx + 2; i++) {
      const next = lines[i].trim();
      if (!next) break;
      if (/[:：]/.test(next)) break;
      if (FIELD_LABEL_RE.test(next)) break;
      if (next.length < 4) break;
      addr += next;
    }
    return addr.trim();
  }
  return undefined;
}

/** 从纯文本里按规则抽取业务字段 */
export function parseFields(text: string): ExtractedFields {
  const t = normalize(text);
  const lines = t.split("\n");
  const out: ExtractedFields = {};

  // ── 运单号 ────────────────────────────────────────────────
  // 优先级：运单号类 > 英文 Tracking > 订单号（仅在前者都不存在时兜底）
  const tracking = pickByLabels(
    t,
    ["运单号", "运单编号", "快递单号", "物流单号", "跟踪号", "Tracking No", "Tracking Number", "订单号"],
    "[A-Za-z0-9-]{6,32}"
  );
  if (tracking) out.tracking_no = tracking;
  else {
    const bare = t.match(/\b([A-Z]{2,4}\d{10,15})\b/);
    if (bare) out.tracking_no = bare[1];
  }

  // ── 收件人 ────────────────────────────────────────────────
  // "收件人姓名" 必须排在 "收件人" 前面，否则会先命中 "收件人" 再把 "姓名" 当成人名
  const receiver = pickByLabels(
    t,
    ["收件人姓名", "收货人姓名", "收件人", "收货人", "联系人", "Consignee", "Receiver", "客户名称", "姓名"],
    "[\\u4e00-\\u9fa5]{2,8}|[A-Za-z][A-Za-z.\\s]{1,30}"
  );
  if (receiver && !/^(姓名|收件人|收货人|联系电话|电话|地址)$/.test(receiver)) {
    out.receiver = receiver.replace(/\s+/g, " ").trim();
  }

  // ── 电话 ──────────────────────────────────────────────────
  const phoneRaw = pickByLabels(
    t,
    ["手机号码", "手机号", "联系电话", "联系方式", "电话", "Mobile", "Tel", "Phone"],
    "[+\\d][\\d\\s\\-()]{6,24}"
  );
  const phone = phoneRaw ? cleanPhone(phoneRaw) : undefined;
  if (phone) out.phone = phone;
  else {
    // 兜底：把全文的分隔符去掉再找 11 位手机号
    const flat = t.replace(/[\s\-()]/g, "");
    const m = flat.match(/\b(1[3-9]\d{9})\b/);
    if (m) out.phone = m[1];
  }

  // ── 地址（允许跨行）────────────────────────────────────────
  const address = pickAddress(lines, ["收货地址", "收件地址", "详细地址", "地址", "Address"]);
  if (address) out.address = address;

  // ── 日期 ──────────────────────────────────────────────────
  // 优先级：下单 > 发货/出库 > 通用「日期」> 签收（签收日往往是干扰项）
  const dateRaw =
    pickByLabels(t, ["下单日期", "发货日期", "运单日期", "出库日期", "日期", "Date"], "[^\\n]{0,20}") ??
    t.match(/(\d{4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2})/)?.[1];
  const date = dateRaw ? normalizeDate(dateRaw) : undefined;
  if (date) out.date = date;
  else if (/签收日期|签收时间/.test(t)) {
    const sign = normalizeDate(t.split(/签收日期|签收时间/)[1] ?? "");
    if (sign) out.date = sign;
  }

  // ── 金额 ──────────────────────────────────────────────────
  // 优先级：合计类 > 应付/实付 > 代收货款 > 泛化「金额」> 运费（运费通常是干扰项）
  const amountRaw = pickByLabels(
    t,
    ["合计金额", "合计", "总计", "总额", "应付金额", "应付款", "实付金额", "实付款", "代收货款", "金额", "Total", "Amount", "运费"],
    "[¥$]?\\s*[0-9][0-9,\\.]*"
  );
  const amount = amountRaw ? cleanAmount(amountRaw) : undefined;
  if (amount) out.amount = amount;

  return out;
}
