// /api/pay —— Stripe 支付（零依赖，直接调 Stripe REST API）
// POST { pack: "small"|"mid"|"large" } → 创建 Checkout Session，返回跳转 url（需登录）
// GET  ?session_id=cs_xxx          → 支付成功跳回后校验并入账（幂等，和 webhook 互为兜底）
//
// 需要环境变量：STRIPE_SECRET_KEY（sk_test_... 先用测试模式跑通，再换 sk_live_...）

import {
  PACKS, redis, redisReady, readSession, getUser, quotaFor, clientIp, bump,
} from "./_lib.js";

const STRIPE = "https://api.stripe.com/v1";

async function stripe(path, params) {
  const r = await fetch(`${STRIPE}${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? params.toString() : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`stripe ${r.status}: ${data?.error?.message || "unknown"}`);
  return data;
}

// 入账（幂等：同一个 session 只记一次，webhook 和跳回校验共用这把锁）
export async function creditSession(session) {
  if (session.payment_status !== "paid") return false;
  const sub = session.metadata?.sub;
  const credits = parseInt(session.metadata?.credits || "0", 10);
  if (!sub || !credits) return false;
  const first = await redis("SET", `stripe:done:${session.id}`, "1", "NX");
  if (!first) return false; // 已入账过
  await redis("HINCRBY", `user:${sub}`, "credits", credits);
  await bump("purchase");
  await bump("revenue", session.amount_total || 0);
  await redis("INCRBY", "stat:total:revenue", session.amount_total || 0);
  return true;
}

export default async function handler(req, res) {
  if (!process.env.STRIPE_SECRET_KEY || !redisReady()) {
    return res.status(503).json({ error: "支付功能未配置" });
  }
  const sub = readSession(req);
  if (!sub) return res.status(401).json({ error: "请先登录再购买" });

  try {
    // ---- 支付成功跳回：校验 session 并入账 ----
    if (req.method === "GET") {
      const sid = req.query?.session_id || "";
      if (!/^cs_[a-zA-Z0-9_]+$/.test(sid)) return res.status(400).json({ error: "无效的 session" });
      const session = await stripe(`/checkout/sessions/${sid}`);
      if (session.metadata?.sub !== sub) return res.status(403).json({ error: "订单与当前账号不符" });
      const credited = await creditSession(session);
      const quota = await quotaFor(sub, clientIp(req));
      return res.status(200).json({
        credited,
        paid: session.payment_status === "paid",
        quota,
      });
    }

    // ---- 创建 Checkout Session ----
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const pack = PACKS[req.body?.pack];
    if (!pack) return res.status(400).json({ error: "未知的套餐" });
    const user = await getUser(sub);
    if (!user) return res.status(401).json({ error: "请先登录再购买" });

    const origin = `https://${req.headers.host}`;
    const p = new URLSearchParams();
    p.set("mode", "payment");
    p.set("line_items[0][quantity]", "1");
    p.set("line_items[0][price_data][currency]", "usd");
    p.set("line_items[0][price_data][unit_amount]", String(pack.amount));
    p.set("line_items[0][price_data][product_data][name]", `毛茸相馆 · ${pack.name}`);
    p.set("success_url", `${origin}/?session_id={CHECKOUT_SESSION_ID}`);
    p.set("cancel_url", `${origin}/`);
    p.set("metadata[sub]", sub);
    p.set("metadata[credits]", String(pack.credits));
    if (user.email) p.set("customer_email", user.email);

    const session = await stripe("/checkout/sessions", p);
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "支付服务暂时不可用，请稍后再试" });
  }
}
