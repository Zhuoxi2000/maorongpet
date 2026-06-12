// /api/auth —— 登录 / 退出
// 两种登录入口：
//   1) JSON POST { credential, ref }（桌面 popup 模式，前端 fetch 调用）
//   2) Google 表单 POST credential + g_csrf_token（手机 redirect 模式，Google 直接打过来，
//      校验 CSRF 后种 cookie 并 303 跳回首页）。注意：redirect 模式要求把
//      https://你的域名/api/auth 加进 OAuth client 的 Authorized redirect URIs。
// DELETE 清除会话 cookie（退出登录）
//
// 新用户注册时若带有效邀请码：本人立即 +REF_BONUS 张奖励；
// 邀请人的奖励在被邀请人第一次真实生成图片后发放（见 generate.js，防注册刷量）。

import crypto from "node:crypto";
import {
  QUOTA, redis, redisReady, signSession, sessionCookie,
  getUser, quotaFor, clientIp, bump,
} from "./_lib.js";

const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 邀请码字符集，去掉易混淆的 I L O 0 1

const cookieVal = (req, name) => {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
};

// 校验 Google ID token → 返回 token 信息；校验失败抛错
async function verifyGoogleToken(credential, clientId) {
  const r = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );
  if (!r.ok) throw new Error(`tokeninfo ${r.status}`);
  const info = await r.json();
  if (info.aud !== clientId || !info.sub) throw new Error("aud mismatch");
  return info;
}

// 取出或创建用户（处理邀请关系），返回用户对象
async function upsertUser(info, ref) {
  const sub = info.sub;
  let user = await getUser(sub);
  if (user) return user;

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

  // 埋点：注册数 / 邀请注册数 / 累计用户
  try {
    await bump("signup");
    if (referredBy) await bump("ref_signup");
    await redis("INCR", "stat:total:users");
  } catch (e) { console.error("signup track failed:", e); }

  return getUser(sub);
}

export default async function handler(req, res) {
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const configured = redisReady() && process.env.SESSION_SECRET && clientId;
  const isForm = (req.headers["content-type"] || "").includes("urlencoded");

  // ---------- 手机 redirect 模式：Google 表单 POST ----------
  if (isForm) {
    const fail = () => {
      res.setHeader("Location", "/?login_error=1");
      return res.status(303).end();
    };
    if (!configured) return fail();
    // CSRF 双提交校验（Google 同时把 g_csrf_token 放在 cookie 和表单里）
    const bodyToken = req.body?.g_csrf_token || "";
    if (!bodyToken || bodyToken !== cookieVal(req, "g_csrf_token")) return fail();
    try {
      const info = await verifyGoogleToken(req.body?.credential || "", clientId);
      const user = await upsertUser(info, cookieVal(req, "mr_ref"));
      res.setHeader("Set-Cookie", [
        sessionCookie(signSession(info.sub)),
        "mr_ref=; Path=/; Max-Age=0", // 邀请码用过即清
      ]);
      res.setHeader("Location", "/");
      return res.status(303).end();
    } catch (e) {
      console.error("redirect login failed:", e);
      return fail();
    }
  }

  // ---------- 桌面 popup 模式：JSON POST ----------
  if (!configured) return res.status(503).json({ error: "登录功能未配置（缺少环境变量）" });
  const { credential, ref } = req.body || {};
  if (!credential) return res.status(400).json({ error: "缺少登录凭证" });

  let info;
  try {
    info = await verifyGoogleToken(credential, clientId);
  } catch (e) {
    console.error("tokeninfo failed:", e);
    return res.status(401).json({ error: "Google 登录校验失败，请重试" });
  }

  try {
    const user = await upsertUser(info, ref || cookieVal(req, "mr_ref"));
    res.setHeader("Set-Cookie", [
      sessionCookie(signSession(info.sub)),
      "mr_ref=; Path=/; Max-Age=0",
    ]);
    const quota = await quotaFor(info.sub, clientIp(req));
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
