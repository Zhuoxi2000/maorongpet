# 毛茸相馆 / FluffBooth · 部署与运营手册

宠物照片 AI 风格化网站。两个文件，五分钟上线。

## 〇、2026-07 出海版（FluffBooth）变更速览

战略与文案总案见 `GLOBAL_PLAN.md`（已加入 `.vercelignore`，不会被部署到线上）。本次代码变更：

- **英文默认 + 中文自动切换**：`?lang=` 参数 > localStorage > 浏览器语言；右上角可手动切换（切换即整页刷新，照片与已选风格经 sessionStorage 自动恢复）。文案全部集中在 `index.html` 的 `STRINGS` 字典，模板名称/描述为双语字段。
- **英文品牌 FluffBooth**：Stripe 商品名、OG 标签、水印、文件名均已使用；`og.png`（1200×630 分享卡）已生成在仓库根目录。**上线前需注册 fluffbooth.com 并在 Google OAuth / hreflang 处替换正式域名**（head 里已按 fluffbooth.com 预填）。
- **新增「Plot Twist / 反转梗」分类 4 模板**：拟人写真（pet-to-human 大趋势）、疑犯登记照、限量手办、复古毕业册。新春模板改为季节限定（中文模式常驻，英文模式仅 1–2 月出现）。
- **免费图水印**：非付费 credit 生成的图，右下角合成 "🐾 fluffbooth.com" 胶囊（后端新增返回字段 `viaCredit`，付费 credit 出图无水印）。
- **前后对比卡（Reveal）**：结果页新增按钮，客户端 canvas 合成"原图+成片+品牌条"，为短视频 Reveal 格式和群聊转发准备的分享物。
- **分享链接自动带邀请码**：登录用户的所有分享出口 URL 均为 `/?ref=邀请码`，转发即裂变。
- **两处修复**：① 后端已配置时生成失败不再静默降级为本地滤镜假图，改为明确报错+重试；② 未登录时结果页不再出现空邀请卡（`.invite[hidden]` 被 `display:flex` 覆盖的问题，与 d6c425c 修的 modal 同类）。
- **prompt 合规清理**：移除 Ghibli / Pixar / Warhol / LinkedIn 等品牌词，改描述性写法。
- ⚠️ **模型死线**：Gemini 2.5 Flash Image 于 **2026-10-02 停服**，9 月中需切到 `gemini-3.1-flash-image`（$0.067/张）并同步调整大包定价，详见 GLOBAL_PLAN.md 第一节。

## 一、本地预览（不接 AI，演示模式）

直接用浏览器打开 `index.html` 即可。检测不到后端时会自动走"演示模式"（本地模拟滤镜），完整交互流程都能跑通，结果图上会标注"演示模式"。

## 二、正式部署（Vercel，免费档即可起步）

1. 把整个文件夹推到一个 GitHub 仓库（保持 `index.html` 在根目录、`api/` 目录原样）。
2. 到 vercel.com 用 GitHub 登录，Import 这个仓库，一路默认，Deploy。
3. 到 https://aistudio.google.com/apikey 创建一个 Gemini API Key。
4. 在 Vercel 项目 Settings → Environment Variables 添加 `GEMINI_API_KEY`，重新部署。
5. 打开你的域名，上传照片测试——此时已经是真实 AI 生成。

国内访问优化：Vercel 在国内不稳定时，可换 Cloudflare Pages + Functions（代码几乎不用改），或前端放国内 OSS、后端函数放腾讯云函数。

## 二点五、开启账号 / 额度 / 邀请（可选，不配则回到无账号模式）

账号体系是渐进增强的：下面 4 个环境变量配齐才启用；缺任何一个，`/api/me` 返回
`configured:false`，前端自动隐藏登录入口，行为和老版本一样。

**1. 存储：Upstash Redis（免费档够用）**
在 Vercel 项目 → Storage → 选 Upstash for Redis → Create & Connect，
`UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN` 会自动注入（兼容旧版 `KV_REST_API_*`）。

**2. Google 登录**
到 https://console.cloud.google.com/apis/credentials 创建 OAuth client ID（类型选 Web application）：
- **Authorized JavaScript origins** 填你的正式域名（如 `https://maorong.vercel.app`，本地调试再加 `http://localhost:3000`）
- **Authorized redirect URIs** 填 `https://你的域名/api/auth` ——**必填**，手机端登录走
  redirect 模式（popup 在手机浏览器上会跳不回来），Google 只允许跳到这里登记过的地址

把 client ID 填进环境变量 `GOOGLE_CLIENT_ID`。

**本地回归测试**：改完代码跑 `node tests/run.mjs`，不需要任何真实 key（Redis/Google/
Gemini/Stripe 全部 mock），39 项断言覆盖登录、额度、邀请、支付、看板的完整链路。

**3. 会话密钥**
`openssl rand -hex 32` 生成一个随机串，填进 `SESSION_SECRET`。

**额度规则（改 `api/_lib.js` 顶部的 QUOTA 常量即可）：**

| 身份 | 额度 |
|---|---|
| 未登录 | 1 张/天（按 IP，保留"打开就能用"的体验） |
| 登录 | 3 张/天（按账号，UTC 日切） |
| 被邀请注册 | 注册立得 +3 张奖励 |
| 邀请人 | 被邀请人**第一次生成成功**后 +3 张（防注册刷量），累计上限 30 张 |

邀请链接格式：`https://你的域名/?ref=邀请码`。登录用户在结果页和头像菜单里都能一键复制。
额度只在生成成功后才扣；奖励额度不过期，在每日免费用完后自动消耗。

## 二点七、支付（Stripe，面向北美，美元计价）

1. 到 https://dashboard.stripe.com 注册，先用**测试模式**：Developers → API keys，
   把 `sk_test_...` 填进环境变量 `STRIPE_SECRET_KEY`。
2. （推荐）配置 webhook 兜底：Developers → Webhooks → Add endpoint，
   URL 填 `https://你的域名/api/stripe-webhook`，事件勾选 `checkout.session.completed`。
   不配也能用（付款跳回时会校验入账），配了更保险（用户付完关掉页面也能到账）。
3. 测试卡号 `4242 4242 4242 4242` 走一单，确认额度到账，再换 `sk_live_...` 正式收款。

**定价（改 `api/_lib.js` 顶部的 PACKS 即可）：**

| 套餐 | 价格 | 单张 | 毛利（成本 $0.04/张） |
|---|---|---|---|
| 小食包 30 张 | $4.99 | $0.166 | ~76% |
| 加餐包 80 张（主推） | $9.99 | $0.125 | ~68% |
| 豪华包 200 张 | $19.99 | $0.10 | ~60% |

为什么用 credit 包不用订阅：这是低频、情感驱动的产品，用户不愿为"可能用不到的月费"付钱；
credit 永不过期降低了首单心理门槛，$4.99 起步价接近冲动消费区间。等数据证明有高频核心用户
（每周回访 3 次以上的群体成型）再考虑加月度会员档。

购买入口：额度用完时自动弹窗（转化最高的时机）+ 头像菜单里的"购买额度"。必须登录后才能买
（credit 挂在账号上）。

## 三、成本账

| 项目 | 费用 |
|---|---|
| Gemini 2.5 Flash Image | 约 $0.04/张 |
| Vercel Hobby | 免费（日活几百内够用） |
| Upstash Redis 免费档 | 免费（50 万条命令/月，前期足够） |
| Stripe | 无月费，成交收 2.9% + $0.30/笔 |
| 域名 | ~$10/年 |

## 四、数据看板（上线后每天看这里）

浏览器打开 **`https://你的域名/api/stats?key=ADMIN_KEY的值`**（环境变量 `ADMIN_KEY`
自己设一串随机字符）。看板包含：

- **每日漏斗**：访问 → 上传 → 生成 → 下载，以及三步转化率
  - 上传→生成 低于 60%：模板吸引力不够
  - **生成→下载 是"出图即成品"的生死指标，目标 70%+**；低了先怀疑模型和 prompt
- **注册数 / 邀请注册数**：邀请注册占比看 referral 是否真的在转
- **付费单数 / 收入**（日维度 + 累计）
- **次日回访率**：验证每日免费额度这个回访钩子
- **各模板表现**：生成数排行 + 每个模板的下载率。下载率垫底且量不小的模板是质量问题，
  优先改 prompt 或下架；生成数垫底是吸引力问题，下次上新换方向

实现上是 Redis 里的匿名计数器（不存任何用户隐私），埋点已经埋好：页面打开、选片、生成
（按模板）、下载（按模板）、注册、邀请、付费。流量来源分析（用户从哪来）这里看不了，
需要的话在 Vercel 项目里一键开 Web Analytics 作为补充。

## 五、迭代路线（按验证优先级）

1. **第 1–2 周**：模板每周上新 2–3 个，重点测节日类；~~免费图加可爱水印（角落小爪印 + 域名）~~（出海版已完成）。
2. **看数据砍模板**：每周看一次看板的模板表现表，下载率和生成数双低的下架。
3. **有留存后**：宠物档案——同一只宠物的生成历史攒成相册（已有 Google 账号体系，直接挂在用户名下）；
   验证出高频用户群后再考虑加订阅档。
4. **二期再做**：人宠互动合成（"小狗趴头上"）。需要双图上传，人脸相似度容错极低，等模板类功能跑通现金流后再投入。

## 六、必须做的合规小事

- 首页底部"照片 24 小时内自动删除"的承诺要兑现：当前架构图片不落库（base64 直传直回），天然合规；若日后存对象存储，设 24h 生命周期规则。
- 加一行《用户协议》：用户保证对上传照片拥有权利、生成图仅供个人使用。
