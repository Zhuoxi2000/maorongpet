// /api/stats —— 私有数据看板（HTML），浏览器直接打开：
//   https://你的域名/api/stats?key=ADMIN_KEY的值
// 展示：每日漏斗（访问→上传→生成→下载）、转化率、注册/邀请、付费、次日回访、各模板表现。
// 需要环境变量 ADMIN_KEY（随便一串随机字符，别泄露）。

import { redis, redisReady } from "./_lib.js";

const DAYS = 14; // 往前看多少天

const dateStr = d => d.toISOString().slice(0, 10);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) + "%" : "–");

export default async function handler(req, res) {
  const key = (req.query && req.query.key) || "";
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!redisReady()) return res.status(503).json({ error: "Redis 未配置" });

  // 日期序列：今天往前 DAYS 天
  const dates = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(Date.now() - i * 864e5);
    dates.push(dateStr(d));
  }

  // 每日指标：一次 MGET 拉全
  const METRICS = ["visit", "upload", "generate", "download", "signup", "ref_signup", "purchase", "revenue"];
  const keys = dates.flatMap(d => METRICS.map(m => `stat:${d}:${m}`));
  const flat = await redis("MGET", ...keys);
  const daily = dates.map((d, i) => {
    const row = { date: d };
    METRICS.forEach((m, j) => { row[m] = parseInt(flat[i * METRICS.length + j] || "0", 10); });
    return row;
  });

  // 次日回访：|昨日活跃 ∩ 今日活跃| / 昨日活跃（dau 集合只留 9 天）
  for (let i = 0; i < Math.min(dates.length - 1, 8); i++) {
    const [base, ret] = await Promise.all([
      redis("SCARD", `dau:${dates[i + 1]}`),
      redis("SINTER", `dau:${dates[i + 1]}`, `dau:${dates[i]}`),
    ]);
    daily[i + 1].retained = base > 0 ? `${Math.round((ret.length / base) * 100)}% (${ret.length}/${base})` : "–";
  }

  // 模板维度：累计生成数 / 下载数
  const [tplGenFlat, tplDlFlat, totalUsers, totalRevenue, totalNewsletter] = await Promise.all([
    redis("HGETALL", "stat:tpl"),
    redis("HGETALL", "stat:tpldl"),
    redis("GET", "stat:total:users"),
    redis("GET", "stat:total:revenue"),
    redis("GET", "stat:total:newsletter"),
  ]);
  const toMap = flat2 => {
    const m = {};
    for (let i = 0; i < (flat2 || []).length; i += 2) m[flat2[i]] = parseInt(flat2[i + 1], 10);
    return m;
  };
  const tplGen = toMap(tplGenFlat), tplDl = toMap(tplDlFlat);
  const templates = Object.keys(tplGen)
    .map(id => ({ id, gen: tplGen[id] || 0, dl: tplDl[id] || 0 }))
    .sort((a, b) => b.gen - a.gen);

  // ---- 渲染极简 HTML 看板 ----
  const td = v => `<td>${v ?? "–"}</td>`;
  const dailyRows = daily.map(r => `<tr>
    ${td(r.date)}${td(r.visit)}${td(r.upload)}${td(r.generate)}${td(r.download)}
    ${td(pct(r.upload, r.visit))}${td(pct(r.generate, r.upload))}${td(`<b>${pct(r.download, r.generate)}</b>`)}
    ${td(r.signup)}${td(r.ref_signup)}${td(r.purchase)}${td(r.revenue ? "$" + (r.revenue / 100).toFixed(2) : "–")}${td(r.retained)}
  </tr>`).join("");
  const tplRows = templates.map(t => `<tr>
    ${td(t.id)}${td(t.gen)}${td(t.dl)}${td(`<b>${pct(t.dl, t.gen)}</b>`)}
  </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>毛茸相馆 · 数据看板</title>
<style>
body{font-family:-apple-system,'PingFang SC',sans-serif;background:#FBF4EA;color:#3E2F25;padding:24px;max-width:1100px;margin:0 auto}
h1{font-size:20px}h2{font-size:16px;margin-top:28px}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:8px;overflow:hidden;font-size:13px;margin-top:10px}
th,td{padding:8px 10px;text-align:right;border-bottom:1px solid #EADDCB}
th{background:#F4DEC9;font-weight:600}
td:first-child,th:first-child{text-align:left}
.kpi{display:flex;gap:14px;margin-top:14px;flex-wrap:wrap}
.kpi div{background:#fff;border:1px solid #EADDCB;border-radius:10px;padding:12px 18px}
.kpi b{font-size:20px;display:block}
small{color:#8C7A6B}
</style></head><body>
<h1>🐾 毛茸相馆 · 数据看板</h1>
<div class="kpi">
  <div><b>${parseInt(totalUsers || "0", 10)}</b><small>累计注册用户</small></div>
  <div><b>$${(parseInt(totalRevenue || "0", 10) / 100).toFixed(2)}</b><small>累计收入</small></div>
  <div><b>${parseInt(totalNewsletter || "0", 10)}</b><small>邮件订阅</small></div>
</div>
<h2>每日漏斗（近 ${DAYS} 天，UTC 日切）</h2>
<table><tr><th>日期</th><th>访问</th><th>上传</th><th>生成</th><th>下载</th>
<th>访问→上传</th><th>上传→生成</th><th>生成→下载</th>
<th>注册</th><th>邀请注册</th><th>付费单</th><th>收入</th><th>次日回访</th></tr>${dailyRows}</table>
<small>生成→下载 是"出图即成品"的核心指标，目标 70%+。访问 = /api/me 被调用次数（≈页面打开次数）。</small>
<h2>各模板表现（累计）</h2>
<table><tr><th>模板</th><th>生成数</th><th>下载数</th><th>下载率</th></tr>${tplRows || "<tr><td colspan=4>暂无数据</td></tr>"}</table>
<small>下载率垫底且生成数不少的模板 → 质量问题，优先改 prompt 或下架；生成数垫底 → 吸引力问题。</small>
</body></html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
}
