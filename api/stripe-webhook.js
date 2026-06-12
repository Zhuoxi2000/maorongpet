// /api/stripe-webhook —— Stripe 回调（可选但推荐配置，防用户付完款没跳回导致漏入账）
// Stripe Dashboard → Developers → Webhooks → Add endpoint：
//   URL 填 https://你的域名/api/stripe-webhook ，事件选 checkout.session.completed
//
// 安全说明：不依赖签名校验（Vercel 函数拿原始 body 比较绕），而是只取回调里的
// event id，再用自己的密钥去 Stripe 反查这个事件——伪造的 id 查不到，天然可信。
// 入账逻辑与 /api/pay 的跳回校验共用同一把幂等锁，不会重复加额度。

import { redisReady } from "./_lib.js";
import { creditSession } from "./pay.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.STRIPE_SECRET_KEY || !redisReady()) return res.status(200).json({ ok: true });

  const eventId = req.body?.id;
  if (!/^evt_[a-zA-Z0-9_]+$/.test(eventId || "")) return res.status(400).json({ error: "bad event" });

  try {
    // 反查 Stripe 拿权威事件内容，不信任回调 body 本身
    const r = await fetch(`https://api.stripe.com/v1/events/${eventId}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (!r.ok) return res.status(400).json({ error: "unknown event" });
    const event = await r.json();

    if (event.type === "checkout.session.completed") {
      await creditSession(event.data.object);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("webhook failed:", e);
    return res.status(500).json({ error: "retry" }); // 非 2xx，Stripe 会自动重试
  }
}
