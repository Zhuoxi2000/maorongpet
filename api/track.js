// /api/track —— 前端埋点（只收白名单事件，匿名计数，不存任何个人信息）
// upload：用户成功选好照片；download：点了保存；share：点了分享给朋友（带模板 id）

import { redisReady, redis, bump } from "./_lib.js";

const EVENTS = new Set(["upload", "download", "share"]);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!redisReady()) return res.status(200).json({ ok: true });

  const { event, template } = req.body || {};
  if (!EVENTS.has(event)) return res.status(400).json({ error: "unknown event" });

  try {
    await bump(event);
    if ((event === "download" || event === "share") && typeof template === "string" && /^[a-z0-9_-]{1,24}$/i.test(template)) {
      await redis("HINCRBY", event === "share" ? "stat:tplshare" : "stat:tpldl", template, 1);
    }
  } catch (e) {
    console.error("track failed:", e);
  }
  return res.status(200).json({ ok: true });
}
