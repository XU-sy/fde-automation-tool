// 「录一次就够」：在真正开浏览器之前，先挡掉重复运单。
//
// 为什么这一层必须存在（业务上最致命的一条）：
//   物流/订单系统里，同一张运单被录两遍是**事故**，不是小 bug——
//   会直接产生重复订单、重复对账、重复发货。客户可以容忍"偶尔要人工补录"，
//   但绝不容忍"同一单进了两次系统"。所以幂等不是优化项，是准入门槛。
//
// 设计取舍：把幂等放在"编排层"（本文件），不放进 fill-web.ts。
//   fill-web.ts 只负责"把字段填进网页"这一个动作，保持纯粹；
//   要不要录、能不能录，是业务判断，属于编排层。这样将来换目标系统也不用动防重逻辑。
import { fillWebSystem, type Fields } from "./fill-web.js";
import { appendEntry, findEntered } from "./ledger.js";

export type EnterOutcome =
  | { status: "entered"; tracking_no: string }
  | { status: "skipped"; tracking_no: string; enteredAt: string }
  | { status: "failed"; tracking_no: string; error: string };

export interface EnterOptions {
  /** 字段来源，仅用于台账留痕（如 payload.json 路径、api、cli） */
  source?: string;
  /** 强制录入，跳过防重校验（仅用于测试或客户明确要求补录） */
  force?: boolean;
}

export async function enterOnce(fields: Fields, opts: EnterOptions = {}): Promise<EnterOutcome> {
  // 运单号就是幂等键。没有它，防重复无从谈起——但不能因此直接拒录，
  // 否则一张漏抽了运单号的单子就永远录不进去，现场会骂人。折中：放行 + 警告 + 台账标注。
  const key = (fields.tracking_no ?? "").trim();

  if (!key) {
    console.warn("⚠️ 缺少 tracking_no（运单号），本次无法做防重复校验，仍然继续录入");
  }

  if (key && !opts.force) {
    const hit = findEntered(key);
    if (hit) {
      console.log(`⏭  跳过：运单号 ${key} 已于 ${hit.at} 成功录入过（如需强制重录，加 --force）`);
      return { status: "skipped", tracking_no: key, enteredAt: hit.at };
    }
  }

  try {
    await fillWebSystem(fields);
    if (key) {
      appendEntry({
        tracking_no: key,
        status: "entered",
        receiver: fields.receiver,
        amount: fields.amount,
        source: opts.source,
      });
    }
    return { status: "entered", tracking_no: key };
  } catch (e: any) {
    const error = e?.message ?? String(e);
    if (key) {
      appendEntry({
        tracking_no: key,
        status: "failed",
        receiver: fields.receiver,
        amount: fields.amount,
        source: opts.source,
        error,
      });
    }
    console.error(`❌ 录入失败：${key || "(无运单号)"} — ${error}`);
    return { status: "failed", tracking_no: key, error };
  }
}
