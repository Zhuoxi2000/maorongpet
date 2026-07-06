// api/_lib.js —— 共享工具（下划线开头的文件不会被 Vercel 暴露为接口）
// 包含：额度常量、Upstash Redis REST 客户端、会话签名、用户读写
//
// 需要的环境变量：
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN （Vercel 市场开通 Upstash 后自动注入，
//   也兼容旧版 Vercel KV 的 KV_REST_API_URL / KV_REST_API_TOKEN）
//   SESSION_SECRET  会话签名密钥，`openssl rand -hex 32` 生成一个即可

import crypto from "node:crypto";

/* ---------- 额度规则（调整额度只改这里） ---------- */
export const QUOTA = {
  ANON_DAILY: 1,    // 未登录：每 IP 每天免费张数（保留"打开就能用"的体验）
  USER_DAILY: 3,    // 登录后：每天免费张数
  REF_BONUS: 3,     // 邀请奖励：双方各得的张数
  REF_EARN_CAP: 30, // 单个用户通过邀请最多赚的张数（防刷上限）
};

/* ---------- 付费包（Stripe，单位美分；调价只改这里） ---------- */
export const PACKS = {
  small: { credits: 30,  amount: 499,  name: "Snack Pack · 30 portraits" },
  mid:   { credits: 80,  amount: 999,  name: "Feast Pack · 80 portraits", popular: true },
  large: { credits: 200, amount: 1999, name: "Buffet Pack · 200 portraits" },
};

/* ---------- Redis（Upstash REST，无需 npm 依赖） ---------- */
const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const redisReady = () => Boolean(REDIS_URL && REDIS_TOKEN);

export async function redis(...cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis http ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(`redis: ${data.error}`);
  return data.result;
}

/* ---------- 会话（HMAC 签名的轻量 token，存 HttpOnly cookie） ---------- */
const SECRET = process.env.SESSION_SECRET || "";

export function signSession(sub, days = 30) {
  const payload = Buffer.from(
    JSON.stringify({ sub, exp: Date.now() + days * 864e5 })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token) {
  if (!token || !SECRET) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig.length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return exp > Date.now() ? sub : null;
  } catch {
    return null;
  }
}

export function readSession(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)mr_session=([^;]+)/);
  return m ? verifySession(decodeURIComponent(m[1])) : null;
}

export function sessionCookie(token, maxAge = 30 * 86400) {
  return `mr_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/* ---------- 用户与额度 ---------- */
export const today = () => new Date().toISOString().slice(0, 10); // UTC 日切

export function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
}

export async function getUser(sub) {
  const flat = await redis("HGETALL", `user:${sub}`);
  if (!flat || flat.length === 0) return null;
  const u = {};
  for (let i = 0; i < flat.length; i += 2) u[flat[i]] = flat[i + 1];
  u.credits = parseInt(u.credits || "0", 10);
  u.refEarned = parseInt(u.refEarned || "0", 10);
  return u;
}

export async function usedToday(kind, id) {
  const n = await redis("GET", `used:${kind}:${id}:${today()}`);
  return parseInt(n || "0", 10);
}

export async function bumpUsed(kind, id) {
  const key = `used:${kind}:${id}:${today()}`;
  const n = await redis("INCR", key);
  if (n === 1) await redis("EXPIRE", key, 90000); // 25h 自动过期
  return n;
}

/* ---------- 埋点（日维度计数器 + 模板维度累计，/api/stats 汇总展示） ---------- */
export async function bump(name, by = 1) {
  const key = `stat:${today()}:${name}`;
  const n = await redis("INCRBY", key, by);
  if (n === by) await redis("EXPIRE", key, 60 * 86400); // 留 60 天
  return n;
}

// 记录今日活跃访客（登录用 sub，匿名用 ip+ua 的哈希），算次日回访用
export async function dauTouch(visitorId) {
  const key = `dau:${today()}`;
  await redis("SADD", key, visitorId);
  await redis("EXPIRE", key, 9 * 86400);
}

export function anonVisitorId(req) {
  const raw = clientIp(req) + "|" + (req.headers["user-agent"] || "");
  return "a:" + crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

// 给前端展示用的额度快照（只含公开字段）
export async function quotaFor(sub, ip) {
  if (sub) {
    const [user, used] = await Promise.all([getUser(sub), usedToday("u", sub)]);
    if (user) {
      return {
        loggedIn: true,
        dailyLimit: QUOTA.USER_DAILY,
        usedToday: used,
        credits: user.credits,
      };
    }
  }
  const used = await usedToday("ip", ip);
  return { loggedIn: false, dailyLimit: QUOTA.ANON_DAILY, usedToday: used, credits: 0 };
}
