// 纯规则抽取：不依赖浏览器 / 不依赖 pdfjs，所以可以在 Node 里直接跑测试。
// 拆出来的好处：规则可单测、可复用；PDF 解析那层换库也不影响这里。

export type ExtractedFields = {
  tracking_no?: string;
  receiver?: string;
  phone?: string;
  address?: string;
  date?: string;
  amount?: string;
};

/** 从纯文本里按规则抽取业务字段 */
export function parseFields(text: string): ExtractedFields {
  const t = text.replace(/\r/g, "");
  const out: ExtractedFields = {};

  const pick = (re: RegExp): string | undefined => {
    const m = t.match(re);
    if (!m) return undefined;
    // 只取匹配到的第一行：PDF 里字段常常上下紧挨，
    // 否则"地址"会把下一行的"下单日期"一起吞进去。
    return m[1].split("\n")[0].trim();
  };

  // 运单号 / 订单号 / 快递单号
  const tracking =
    pick(/(?:运单号|快递单号|物流单号|订单号|单号|Tracking\s*(?:No\.?|Number)?)[^\dA-Za-z]{0,6}([A-Za-z0-9-]{8,30})/i) ??
    pick(/\b(SF\d{10,15})\b/i);
  if (tracking) out.tracking_no = tracking;

  // 手机号 / 电话
  const phone =
    pick(/(?:手机|手机号|联系电话|电话|联系方式|Tel|Phone|Mobile)[^\d]{0,6}(1[3-9]\d{9}|\d{3,4}-?\d{7,8})/i) ??
    pick(/\b(1[3-9]\d{9})\b/);
  if (phone) out.phone = phone;

  // 收件人 / 收货人 / 联系人
  const receiver = pick(
    /(?:收件人|收货人|收件|客户|联系人|姓名|Receiver|Consignee|Name)[^\u4e00-\u9fa5A-Za-z]{0,6}([\u4e00-\u9fa5]{2,8}|[A-Za-z\s]{2,30})/i
  );
  if (receiver) out.receiver = receiver;

  // 地址
  const address = pick(
    /(?:地址|收货地址|收件地址|详细地址|Address)[^\u4e00-\u9fa5]{0,6}([\u4e00-\u9fa5A-Za-z0-9\s#\-栋单元号室楼层路街区县市省]{6,60})/i
  );
  if (address) out.address = address;

  // 日期
  const date = pick(/(\d{4}\s*[-/年]\s*\d{1,2}\s*[-/月]\s*\d{1,2}\s*日?)/);
  if (date) out.date = date;

  // 金额 / 合计
  const amount = pick(
    /(?:金额|合计|总计|总价|应付|实付|运费|Amount|Total)\D{0,8}([0-9]+(?:\.[0-9]{1,2})?)/i
  );
  if (amount) out.amount = amount;

  return out;
}
