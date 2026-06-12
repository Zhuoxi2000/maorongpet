// 本地集成测试：mock 掉 Redis / Google / Gemini / Stripe，全链路过一遍后端逻辑。
// 跑法：node tests/run.mjs   （不需要任何真实 key，不会发任何外部请求）

process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.local";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
process.env.SESSION_SECRET = "test-secret";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GEMINI_API_KEY = "fake-gemini-key";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.ADMIN_KEY = "test-admin";

/* ---------------- 内存版 Redis ---------------- */
const kv = new Map(), hashes = new Map(), sets = new Map();
function redisExec([cmd, ...a]) {
  switch (cmd) {
    case "GET": return kv.has(a[0]) ? kv.get(a[0]) : null;
    case "SET": {
      if (a.includes("NX") && kv.has(a[0])) return null;
      kv.set(a[0], a[1]); return "OK";
    }
    case "INCR": case "INCRBY": {
      const v = parseInt(kv.get(a[0]) || "0", 10) + (cmd === "INCR" ? 1 : parseInt(a[1], 10));
      kv.set(a[0], String(v)); return v;
    }
    case "EXPIRE": return 1;
    case "MGET": return a.map(k => kv.has(k) ? kv.get(k) : null);
    case "HSET": {
      const h = hashes.get(a[0]) || new Map();
      for (let i = 1; i < a.length; i += 2) h.set(a[i], a[i + 1]);
      hashes.set(a[0], h); return 1;
    }
    case "HGETALL": {
      const h = hashes.get(a[0]);
      return h ? [...h.entries()].flat() : [];
    }
    case "HINCRBY": {
      const h = hashes.get(a[0]) || new Map();
      const v = parseInt(h.get(a[1]) || "0", 10) + parseInt(a[2], 10);
      h.set(a[1], String(v)); hashes.set(a[0], h); return v;
    }
    case "SADD": {
      const s = sets.get(a[0]) || new Set();
      const had = s.has(a[1]); s.add(a[1]); sets.set(a[0], s); return had ? 0 : 1;
    }
    case "SCARD": return (sets.get(a[0]) || new Set()).size;
    case "SINTER": {
      const [s1, s2] = [sets.get(a[0]) || new Set(), sets.get(a[1]) || new Set()];
      return [...s1].filter(x => s2.has(x));
    }
    default: throw new Error(`mock redis: 未实现 ${cmd}`);
  }
}

/* ---------------- mock fetch（拦截全部外部请求） ---------------- */
const stripeSessions = new Map();
let stripeSeq = 0;
const json = obj => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://fake-redis.local")) {
    return json({ result: redisExec(JSON.parse(opts.body)) });
  }
  if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
    // token 约定格式 tok:<sub>:<email>，非法 token 返回 400
    const tok = decodeURIComponent(url.split("id_token=")[1]);
    const m = tok.match(/^tok:([\w-]+):(\S+)$/);
    if (!m) return { ok: false, status: 400, json: async () => ({}), text: async () => "bad" };
    return json({ aud: process.env.GOOGLE_CLIENT_ID, sub: m[1], email: m[2], name: m[1], picture: "" });
  }
  if (url.includes("generativelanguage.googleapis.com")) {
    return json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "ZmFrZQ==" } }] } }] });
  }
  if (url === "https://api.stripe.com/v1/checkout/sessions" && opts.method === "POST") {
    const p = new URLSearchParams(opts.body);
    const id = `cs_test_${++stripeSeq}`;
    const session = {
      id, url: `https://checkout.stripe.com/pay/${id}`, payment_status: "paid",
      amount_total: parseInt(p.get("line_items[0][price_data][unit_amount]"), 10),
      metadata: { sub: p.get("metadata[sub]"), credits: p.get("metadata[credits]") },
    };
    stripeSessions.set(id, session);
    return json(session);
  }
  const cs = url.match(/api\.stripe\.com\/v1\/checkout\/sessions\/(cs_\w+)/);
  if (cs) {
    const s = stripeSessions.get(cs[1]);
    return s ? json(s) : { ok: false, status: 404, json: async () => ({ error: { message: "no such session" } }) };
  }
  const ev = url.match(/api\.stripe\.com\/v1\/events\/(evt_\w+)/);
  if (ev) {
    const sid = ev[1].replace("evt_for_", "");
    const s = stripeSessions.get(sid);
    return s
      ? json({ id: ev[1], type: "checkout.session.completed", data: { object: s } })
      : { ok: false, status: 404, json: async () => ({}) };
  }
  throw new Error(`mock fetch: 未拦截的请求 ${url}`);
};

/* ---------------- mock req/res ---------------- */
function makeReq({ method = "GET", body, headers = {}, query = {} } = {}) {
  return { method, body, query, headers: { "x-forwarded-for": "1.2.3.4", ...headers } };
}
function makeRes() {
  const r = { statusCode: 200, headers: {}, body: null };
  r.status = c => { r.statusCode = c; return r; };
  r.json = o => { r.body = o; return r; };
  r.send = o => { r.body = o; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; return r; };
  return r;
}
const sessionOf = res => {
  const sc = res.headers["set-cookie"];
  const arr = Array.isArray(sc) ? sc : [sc];
  const c = arr.find(x => x && x.startsWith("mr_session="));
  return c ? c.split(";")[0] : "";
};

/* ---------------- 断言 ---------------- */
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}

const [auth, me, generate, pay, webhook, track, stats] = await Promise.all([
  import("../api/auth.js"), import("../api/me.js"), import("../api/generate.js"),
  import("../api/pay.js"), import("../api/stripe-webhook.js"),
  import("../api/track.js"), import("../api/stats.js"),
]).then(ms => ms.map(m => m.default));

const IMG = "data:image/jpeg;base64,aGVsbG8=";
const gen = (cookie, ip = "1.2.3.4", templateId = "oil") => {
  const res = makeRes();
  return generate(makeReq({
    method: "POST",
    body: { image: IMG, prompt: "p", templateId },
    headers: { cookie, "x-forwarded-for": ip },
  }), res).then(() => res);
};
const login = tok => {
  const res = makeRes();
  return auth(makeReq({ method: "POST", body: { credential: tok, ref: "" }, headers: { "content-type": "application/json" } }), res).then(() => res);
};

console.log("\n[1] /api/me 匿名");
{
  const res = makeRes();
  await me(makeReq(), res);
  check("configured=true", res.body.configured === true);
  check("匿名额度 1/天", res.body.quota.dailyLimit === 1 && res.body.quota.loggedIn === false);
  check("返回套餐表", res.body.packs.length === 3 && res.body.payEnabled === true);
}

console.log("\n[2] 桌面 JSON 登录（Alice，无邀请码）");
let alice, aliceCookie, aliceRefCode;
{
  const res = await login("tok:alice:alice@x.com");
  alice = res.body.user; aliceCookie = sessionOf(res); aliceRefCode = alice.refCode;
  check("登录成功", res.statusCode === 200 && alice.email === "alice@x.com");
  check("发了会话 cookie", aliceCookie.startsWith("mr_session="));
  check("有邀请码", /^[A-Z2-9]{6}$/.test(aliceRefCode));
  check("无邀请注册 credits=0", alice.credits === 0);
  check("非法 token 被拒", (await login("garbage")).statusCode === 401);
}

console.log("\n[3] 匿名额度：1 张后 402 quota_anon");
{
  const r1 = await gen("", "9.9.9.9");
  check("第 1 张成功", r1.statusCode === 200 && r1.body.image.startsWith("data:image/png"));
  const r2 = await gen("", "9.9.9.9");
  check("第 2 张 402", r2.statusCode === 402 && r2.body.code === "quota_anon");
  check("不同 IP 不受影响", (await gen("", "8.8.8.8")).statusCode === 200);
}

console.log("\n[4] 登录额度：3 张/天后 402 quota");
{
  for (let i = 1; i <= 3; i++) {
    const r = await gen(aliceCookie);
    check(`Alice 第 ${i} 张成功`, r.statusCode === 200);
  }
  const r4 = await gen(aliceCookie);
  check("第 4 张 402 quota", r4.statusCode === 402 && r4.body.code === "quota");
}

console.log("\n[5] 邀请注册：Bob 用 Alice 的码");
let bobCookie;
{
  const res = makeRes();
  await auth(makeReq({
    method: "POST",
    body: { credential: "tok:bob:bob@x.com", ref: aliceRefCode },
    headers: { "content-type": "application/json" },
  }), res);
  bobCookie = sessionOf(res);
  check("Bob 注册立得 3 张", res.body.user.credits === 3);
  check("Alice 此时还没拿到奖励", (await (async () => {
    const r = makeRes(); await me(makeReq({ headers: { cookie: aliceCookie } }), r); return r.body.user.credits;
  })()) === 0);
}

console.log("\n[6] Bob 第一次生成 → Alice 才拿到奖励");
{
  const r = await gen(bobCookie, "7.7.7.7");
  check("Bob 生成成功（走每日免费）", r.statusCode === 200 && r.body.quota.usedToday === 1);
  const r2 = makeRes(); await me(makeReq({ headers: { cookie: aliceCookie } }), r2);
  check("Alice +3 奖励", r2.body.user.credits === 3);
  await gen(bobCookie, "7.7.7.7");
  const r3 = makeRes(); await me(makeReq({ headers: { cookie: aliceCookie } }), r3);
  check("Bob 再生成不重复奖励", r3.body.user.credits === 3);
}

console.log("\n[7] 每日免费用完后自动消耗奖励 credits");
{
  await gen(bobCookie); // Bob 第 3 张（每日免费用完）
  for (let i = 1; i <= 3; i++) {
    const r = await gen(bobCookie);
    check(`Bob 奖励第 ${i} 张成功`, r.statusCode === 200);
  }
  const r = await gen(bobCookie);
  check("免费+奖励全用完 → 402", r.statusCode === 402 && r.body.code === "quota");
}

console.log("\n[8] 手机 redirect 登录（Google 表单 POST）");
{
  const ok = makeRes();
  await auth(makeReq({
    method: "POST",
    body: { credential: "tok:carol:carol@x.com", g_csrf_token: "csrf123" },
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: "g_csrf_token=csrf123; mr_ref=" + aliceRefCode },
  }), ok);
  check("303 跳回首页", ok.statusCode === 303 && ok.headers["location"] === "/");
  check("种了会话 cookie", (ok.headers["set-cookie"] || []).some?.(c => c.startsWith("mr_session=")) || String(ok.headers["set-cookie"]).includes("mr_session="));
  const carolMe = makeRes();
  const carolCookie = (Array.isArray(ok.headers["set-cookie"]) ? ok.headers["set-cookie"] : [ok.headers["set-cookie"]]).find(c => c.startsWith("mr_session=")).split(";")[0];
  await me(makeReq({ headers: { cookie: carolCookie } }), carolMe);
  check("redirect 注册也吃到了 cookie 里的邀请码", carolMe.body.user.credits === 3);

  const bad = makeRes();
  await auth(makeReq({
    method: "POST",
    body: { credential: "tok:mallory:m@x.com", g_csrf_token: "csrf123" },
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: "g_csrf_token=不一致" },
  }), bad);
  check("CSRF 不匹配 → 跳 login_error", bad.statusCode === 303 && bad.headers["location"] === "/?login_error=1");
}

console.log("\n[9] Stripe：下单 → 跳回校验入账 → 幂等");
{
  const create = makeRes();
  await pay(makeReq({ method: "POST", body: { pack: "mid" }, headers: { cookie: aliceCookie } }), create);
  check("创建 Checkout 返回 url", create.statusCode === 200 && create.body.url.includes("checkout.stripe.com"));
  const sid = create.body.url.split("/").pop();

  const before = makeRes(); await me(makeReq({ headers: { cookie: aliceCookie } }), before);
  const verify = makeRes();
  await pay(makeReq({ method: "GET", query: { session_id: sid }, headers: { cookie: aliceCookie } }), verify);
  check("校验入账 +80", verify.body.credited === true && verify.body.quota.credits === before.body.user.credits + 80);

  const again = makeRes();
  await pay(makeReq({ method: "GET", query: { session_id: sid }, headers: { cookie: aliceCookie } }), again);
  check("重复校验不重复入账", again.body.credited === false && again.body.quota.credits === verify.body.quota.credits);

  const wh = makeRes();
  await webhook(makeReq({ method: "POST", body: { id: `evt_for_${sid}` } }), wh);
  const after = makeRes(); await me(makeReq({ headers: { cookie: aliceCookie } }), after);
  check("webhook 同单也不重复入账", wh.statusCode === 200 && after.body.user.credits === verify.body.quota.credits);

  const noLogin = makeRes();
  await pay(makeReq({ method: "POST", body: { pack: "mid" } }), noLogin);
  check("未登录不能下单", noLogin.statusCode === 401);

  const bobSteal = makeRes();
  await pay(makeReq({ method: "GET", query: { session_id: sid }, headers: { cookie: bobCookie } }), bobSteal);
  check("别人的订单不能冒领", bobSteal.statusCode === 403);
}

console.log("\n[10] 埋点与看板");
{
  const t = makeRes();
  await track(makeReq({ method: "POST", body: { event: "download", template: "oil" } }), t);
  check("download 埋点", t.statusCode === 200);
  const bad = makeRes();
  await track(makeReq({ method: "POST", body: { event: "hack" } }), bad);
  check("非白名单事件被拒", bad.statusCode === 400);

  const noKey = makeRes();
  await stats(makeReq({ query: {} }), noKey);
  check("无 key 看板 401", noKey.statusCode === 401);
  const dash = makeRes();
  await stats(makeReq({ query: { key: "test-admin" } }), dash);
  check("看板渲染（含模板表）", dash.statusCode === 200 && String(dash.body).includes("oil"));
  check("看板统计到生成数", /访问/.test(String(dash.body)));
}

console.log(`\n========== 通过 ${pass} / ${pass + fail} ==========`);
process.exit(fail ? 1 : 0);
