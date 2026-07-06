// /api/me —— 前端启动时拉取：登录态、额度快照、Google Client ID、套餐表
// 同时记一次"访问"埋点和当日活跃（算次日回访用）。
// PATCH { newsletter:true/false } 更新"每月上新邮件"订阅偏好（需登录）。
// 未配置环境变量时返回 { configured:false }，前端自动回退到无账号的演示行为。

import {
  QUOTA, PACKS, redis, redisReady, readSession, getUser, quotaFor, clientIp,
  sessionCookie, bump, dauTouch, anonVisitorId,
} from "./_lib.js";

export default async function handler(req, res) {
  // ---- 订阅偏好开关 ----
  if (req.method === "PATCH") {
    if (!redisReady()) return res.status(503).json({ error: "Not configured" });
    const sub = readSession(req);
    const user = sub ? await getUser(sub) : null;
    if (!user) return res.status(401).json({ error: "Please sign in first" });
    const on = !!(req.body || {}).newsletter;
    try {
      if ((user.newsletter === "1") !== on) {
        await redis("HSET", `user:${sub}`, "newsletter", on ? "1" : "0");
        await redis("INCRBY", "stat:total:newsletter", on ? 1 : -1); // 看板计数
      }
      return res.status(200).json({ ok: true, newsletter: on });
    } catch (e) {
      console.error("newsletter toggle failed:", e);
      return res.status(500).json({ error: "Couldn't save — try again" });
    }
  }

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  if (!redisReady() || !process.env.SESSION_SECRET || !clientId) {
    return res.status(200).json({ configured: false });
  }

  try {
    const sub = readSession(req);
    const user = sub ? await getUser(sub) : null;
    if (sub && !user) res.setHeader("Set-Cookie", sessionCookie("", 0)); // 会话指向已不存在的用户，清掉

    // 埋点：访问 + 当日活跃（失败不影响主流程）
    try {
      await bump("visit");
      await dauTouch(user ? sub : anonVisitorId(req));
    } catch (e) { console.error("visit track failed:", e); }

    const quota = await quotaFor(user ? sub : null, clientIp(req));
    const body = {
      configured: true,
      googleClientId: clientId,
      quota,
      refBonus: QUOTA.REF_BONUS,
      packs: Object.entries(PACKS).map(([id, p]) => ({
        id, name: p.name, credits: p.credits, amount: p.amount, popular: !!p.popular,
      })),
      payEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    };
    if (user) {
      body.user = {
        name: user.name, email: user.email, picture: user.picture,
        refCode: user.refCode, credits: user.credits,
        newsletter: user.newsletter === "1",
      };
    }
    return res.status(200).json(body);
  } catch (e) {
    console.error(e);
    return res.status(200).json({ configured: false });
  }
}
