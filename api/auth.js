// /api/auth —— 登录 / 退出
// POST   body: { credential: <Google ID token>, ref?: <邀请码> } → 校验并下发会话 cookie
// DELETE 清除会话 cookie（退出登录）
//
// 新用户注册时若带有效邀请码：本人立即 +REF_BONUS 张奖励；
// 邀请人的奖励在被邀请人第一次真实生成图片后发放（见 generate.js，防注册刷量）。

import crypto from "node:crypto";
import {
  QUOTA, redis, redisReady, signSession, sessionCookie,
  getUser, quotaFor, clientIp,
} from "./_lib.js";

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 邀请码字符集，去掉易混淆的 I L O 0 1

export default async function handler(req, res) {
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!redisReady() || !process.env.SESSION_SECRET || !clientId) {
    return res.status(503).json({ error: "登录功能未配置（缺少环境变量）" });
  }

  const { credential, ref } = req.body || {};
  if (!credential) return res.status(400).json({ error: "缺少登录凭证" });

  // ---- 校验 Google ID token ----
  let info;
  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!r.ok) throw new Error(`tokeninfo ${r.status}`);
    info = await r.json();
  } catch (e) {
    console.error("tokeninfo failed:", e);
    return res.status(401).json({ error: "Google 登录校验失败，请重试" });
  }
  if (info.aud !== clientId || !info.sub) {
    return res.status(401).json({ error: "登录凭证无效" });
  }

  const sub = info.sub;
  try {
    let user = await getUser(sub);

    if (!user) {
      // 生成唯一邀请码（SET NX 保证不撞）
      let refCode = "";
      for (let i = 0; i < 5 && !refCode; i++) {
        const c = Array.from(crypto.randomBytes(6))
          .map(b => ALPHA[b % ALPHA.length]).join("");
        if (await redis("SET", `ref:${c}`, sub, "NX")) refCode = c;
      }

      // 邀请关系：码有效且不是自己 → 新用户立得奖励
      let referredBy = "", credits = 0;
      if (ref && /^[A-Z0-9]{4,12}$/i.test(String(ref))) {
        const owner = await redis("GET", `ref:${String(ref).toUpperCase()}`);
        if (owner && owner !== sub) {
          referredBy = owner;
          credits = QUOTA.REF_BONUS;
        }
      }

      await redis("HSET", `user:${sub}`,
        "email", info.email || "",
        "name", info.name || "",
        "picture", info.picture || "",
        "credits", String(credits),
        "refCode", refCode,
        "referredBy", referredBy,
        "refRewarded", "0",
        "refEarned", "0",
        "createdAt", new Date().toISOString());
      user = await getUser(sub);
    }

    res.setHeader("Set-Cookie", sessionCookie(signSession(sub)));
    const quota = await quotaFor(sub, clientIp(req));
    return res.status(200).json({
      user: {
        name: user.name, email: user.email, picture: user.picture,
        refCode: user.refCode, credits: user.credits,
      },
      quota,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "登录失败，请稍后重试" });
  }
}
