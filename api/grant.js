// /api/grant —— 管理员手动发额度（给测试者/客服补偿用，浏览器直接打开即可）
//   https://你的域名/api/grant?key=ADMIN_KEY的值&email=对方邮箱&credits=20
// 说明：
//   - 对方必须先用 Google 登录过一次（额度挂在账号上）
//   - credits 可为负数（扣回），单次限 ±1000
//   - 发放的是"奖励额度"：永不过期，每日免费用完后自动消耗
import { redis, redisReady } from "./_lib.js";

export default async function handler(req, res) {
  const key = (req.query && req.query.key) || "";
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!redisReady()) return res.status(503).json({ error: "Redis not configured" });

  const email = String((req.query && req.query.email) || "").trim().toLowerCase();
  const credits = parseInt((req.query && req.query.credits) || "0", 10);
  if (!email || !credits || Math.abs(credits) > 1000) {
    return res.status(400).json({ error: "usage: /api/grant?key=ADMIN_KEY&email=user@example.com&credits=20 (credits 为 ±1..1000)" });
  }

  try {
    // 没有 email→sub 索引，用 SCAN 遍历 user:*（用户量小时毫秒级；未来量大再建索引）
    let cursor = "0";
    let userKey = null;
    do {
      const [next, keys] = await redis("SCAN", cursor, "MATCH", "user:*", "COUNT", "100");
      cursor = String(next);
      for (const k of keys) {
        const e = await redis("HGET", k, "email");
        if (e && String(e).toLowerCase() === email) { userKey = k; break; }
      }
    } while (!userKey && cursor !== "0");

    if (!userKey) {
      return res.status(404).json({ error: `找不到 ${email} —— 对方需要先在网站上用 Google 登录一次` });
    }
    const balance = await redis("HINCRBY", userKey, "credits", credits);
    return res.status(200).json({ ok: true, email, granted: credits, balance: parseInt(balance, 10) });
  } catch (e) {
    console.error("grant failed:", e);
    return res.status(500).json({ error: "grant failed" });
  }
}
