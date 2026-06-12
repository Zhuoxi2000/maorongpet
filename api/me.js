// /api/me —— 前端启动时拉取：登录态、额度快照、Google Client ID
// 未配置环境变量时返回 { configured:false }，前端自动回退到无账号的演示行为。

import {
  redisReady, readSession, getUser, quotaFor, clientIp, sessionCookie,
} from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  if (!redisReady() || !process.env.SESSION_SECRET || !clientId) {
    return res.status(200).json({ configured: false });
  }

  try {
    const sub = readSession(req);
    const user = sub ? await getUser(sub) : null;
    if (sub && !user) res.setHeader("Set-Cookie", sessionCookie("", 0)); // 会话指向已不存在的用户，清掉

    const quota = await quotaFor(user ? sub : null, clientIp(req));
    const body = { configured: true, googleClientId: clientId, quota };
    if (user) {
      body.user = {
        name: user.name, email: user.email, picture: user.picture,
        refCode: user.refCode, credits: user.credits,
      };
    }
    return res.status(200).json(body);
  } catch (e) {
    console.error(e);
    return res.status(200).json({ configured: false });
  }
}
