// /api/generate —— Vercel Serverless Function
// 职责：1) 把 API Key 藏在服务端  2) 调用 Gemini 2.5 Flash Image 做图生图
//       3) 基础防刷（同 IP 每日限次，内存版；上线建议换 Upstash Redis）
//
// 部署前在 Vercel 项目设置里添加环境变量：GEMINI_API_KEY
// 获取 Key：https://aistudio.google.com/apikey

const DAILY_FREE = 3;                 // 每 IP 每日免费次数
const ipCounter = new Map();          // 简易内存限流（函数冷启动会重置，正式上线换 Redis）

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "API key 未配置" });

  // ---- 限流（测试期间暂时关闭）----
  // const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  // const today = new Date().toISOString().slice(0, 10);
  // const key = `${ip}:${today}`;
  // const used = ipCounter.get(key) || 0;
  // if (used >= DAILY_FREE) {
  //   return res.status(429).json({ error: "今日免费额度已用完" });
  // }

  // ---- 校验输入 ----
  const { image, prompt } = req.body || {};
  if (!image || !prompt) return res.status(400).json({ error: "缺少 image 或 prompt" });
  const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "图片格式不正确" });
  const [, mimeType, base64Data] = match;
  if (base64Data.length > 8 * 1024 * 1024) return res.status(413).json({ error: "图片过大" });

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
      return res.status(502).json({ error: "生成服务暂时不可用，请稍后再试" });
    }

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find(p => p.inlineData || p.inline_data);
    if (!imgPart) return res.status(502).json({ error: "本次生成未返回图片，请换张照片或风格重试" });

    const inline = imgPart.inlineData || imgPart.inline_data;
    // ipCounter.set(key, used + 1);

    return res.status(200).json({
      image: `data:${inline.mimeType || inline.mime_type || "image/png"};base64,${inline.data}`,
      remaining: 999,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "服务器开小差了，请重试" });
  }
}
