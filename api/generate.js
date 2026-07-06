// /api/generate —— Vercel Serverless Function
// 职责：1) 把 API Key 藏在服务端  2) 调用 Gemini 2.5 Flash Image 做图生图
//       3) 额度控制：未登录每 IP 每天 ANON_DAILY 张；登录后每天 USER_DAILY 张，
//          用完再扣邀请奖励 credits；额度只在生成成功后才扣。
//       4) 邀请奖励发放：被邀请人第一次生成成功时，给邀请人 +REF_BONUS（防注册刷量）。
//
// 部署前在 Vercel 项目设置里添加环境变量：GEMINI_API_KEY（见 README，还有登录相关的几个）
// 获取 Key：https://aistudio.google.com/apikey

import {
  QUOTA, redis, redisReady, readSession,
  getUser, usedToday, bumpUsed, clientIp, quotaFor, bump,
} from "./_lib.js";

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "API key not configured" });

  // ---- 校验输入 ----
  const { image, prompt, templateId } = req.body || {};
  if (!image || !prompt) return res.status(400).json({ error: "Missing image or prompt" });
  const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "Unsupported image format" });
  const [, mimeType, base64Data] = match;
  if (base64Data.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Image too large" });

  // ---- 额度检查（Redis 未配置时跳过，便于本地/初期测试） ----
  const ip = clientIp(req);
  const sub = redisReady() ? readSession(req) : null;
  let user = null;
  let useCredit = false;
  if (redisReady()) {
    try {
      if (sub) user = await getUser(sub);
      if (user) {
        const used = await usedToday("u", sub);
        if (used >= QUOTA.USER_DAILY) {
          if (user.credits > 0) {
            useCredit = true;
          } else {
            return res.status(402).json({
              error: `Today's free portraits are used up — invite a friend (you both get +${QUOTA.REF_BONUS}) or grab a pack`,
              code: "quota",
            });
          }
        }
      } else {
        const used = await usedToday("ip", ip);
        if (used >= QUOTA.ANON_DAILY) {
          return res.status(402).json({
            error: `That was today's free try — sign in for ${QUOTA.USER_DAILY} free portraits every day`,
            code: "quota_anon",
          });
        }
      }
    } catch (e) {
      console.error("quota check failed:", e); // Redis 故障时放行，不挡生成
    }
  }

  // ---- 调用 Gemini 2.5 Flash Image（图生图，宠物身份保持效果最佳）----
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64Data } },
              { text: prompt },
            ],
          }],
        }),
      }
    );

    if (!r.ok) {
      const detail = await r.text();
      console.error("Gemini error:", r.status, detail.slice(0, 500));
      return res.status(502).json({ error: "The studio hiccuped — please try again in a moment" });
    }

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find(p => p.inlineData || p.inline_data);
    if (!imgPart) return res.status(502).json({ error: "No image came back — try another photo or style" });
    const inline = imgPart.inlineData || imgPart.inline_data;

    // ---- 生成成功，记账 + 邀请奖励 ----
    let quota = null;
    if (redisReady()) {
      try {
        if (user) {
          if (useCredit) await redis("HINCRBY", `user:${sub}`, "credits", -1);
          else await bumpUsed("u", sub);

          // 被邀请人第一次生成成功 → 给邀请人发奖励（有上限）
          if (user.referredBy && user.refRewarded !== "1") {
            await redis("HSET", `user:${sub}`, "refRewarded", "1");
            const referrer = await getUser(user.referredBy);
            if (referrer && referrer.refEarned < QUOTA.REF_EARN_CAP) {
              await redis("HINCRBY", `user:${user.referredBy}`, "credits", QUOTA.REF_BONUS);
              await redis("HINCRBY", `user:${user.referredBy}`, "refEarned", QUOTA.REF_BONUS);
            }
          }
        } else {
          await bumpUsed("ip", ip);
        }

        // 埋点：生成总数 + 各模板生成数
        await bump("generate");
        if (typeof templateId === "string" && /^[a-z0-9_-]{1,24}$/i.test(templateId)) {
          await redis("HINCRBY", "stat:tpl", templateId, 1);
        }

        quota = await quotaFor(user ? sub : null, ip);
      } catch (e) {
        console.error("quota consume failed:", e);
      }
    }

    return res.status(200).json({
      image: `data:${inline.mimeType || inline.mime_type || "image/png"};base64,${inline.data}`,
      quota,
      viaCredit: useCredit, // 前端据此决定是否加水印（付费 credit 出图无水印）
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error — please try again" });
  }
}
