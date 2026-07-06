# 出海方案:毛茸相馆 → FluffBooth(建议名)

> 2026-07-06 制定。目标:从"面向海外华人的中文站"升级为"面向全球的英文首发产品",并在 2026 Q3–Q4 的两个天然流量窗口(万圣节、圣诞卡季)里打出第一波增长。
>
> 一句话结论:**产品底子已经够硬(30 秒出图、免注册可玩、邀请裂变、Stripe 闭环都在),缺的是英文品牌壳、传播素材的"自带出圈能力"、以及踩准节日的运营节奏。另有一个硬性技术死线:Gemini 2.5 Flash Image 将于 2026-10-02 停服,必须迁移。**

---

## 一、市场调研结论(2026-07)

### 竞品格局

| 竞品 | 模式 | 价格 | 弱点(=我们的机会) |
|---|---|---|---|
| DreamPets(号称 40 万用户) | 上传→100+ 风格 | 免费+付费 | 风格多但同质,无个性品牌声音 |
| Pawcaso | 订阅制无限生成 | $9.99/月 | 低频产品收月费,首单门槛高 |
| Pet Canvas | 单张精品 | $19.99/张 | 贵、慢,面向"挂墙"场景 |
| Adobe Firefly / PixelBin | 大厂免费入口 | 免费 | 通用工具,无宠物社区感、无传播设计 |
| WigglePet | 宠物视频动画 | 付费 | 成本高、等待久(我们暂不跟) |

**定位空档**:"快 + 免注册 + 不存照片 + 有梗"的组合没人占住。竞品要么慢而贵(训练式 avatar 要传 10–20 张图等半小时),要么是无聊的通用工具。我们的差异化叙事:

> **"One photo. 30 seconds. No sign-up, no subscription, and we delete your photo the moment we're done."**

### 需求与时机(数据)

- 2026 年 TikTok 上 AI 变身类视频播放量比 2025 年**高 240%**;最火的格式就是"原图→成片"的 **Reveal(揭晓)** 格式——这正好是我们产品的天然输出物。
- **宠物拟人化(Pet-to-Human)** 是当前最大单一趋势,Instagram #pettohuman 超 1000 万帖——我们还没有这个模板,P0 补上。
- 万圣节:2025 年美国宠物装扮消费 **$8.6 亿,同比 +22.9%**,23% 的人给宠物打扮;Top 装扮:南瓜 9.8%、热狗 5.4%、蜜蜂 4%、幽灵/超人各 3.1%。→ 9 月上"万圣节装扮试穿"包,按这份榜单出模板。
- 圣诞:宠物圣诞贺卡是老牌刚需(Crown & Paw 等实体画布品牌靠它做到数千万美元营收)→ 11 月上"贺卡导出"。

### ⚠️ 技术死线:模型停服

**Gemini 2.5 Flash Image(nano banana,$0.039/张)将于 2026-10-02 关闭**,需迁移到 Gemini 3.1 Flash Image(1K 分辨率 $0.067/张)。影响:

| 套餐 | 现毛利(@$0.039) | 迁移后(@$0.067) | 建议 |
|---|---|---|---|
| 30 张 $4.99 | ~76% | ~51% | 保持 |
| 80 张 $9.99(主推) | ~68% | ~40% | 保持,量大后再看 |
| 200 张 $19.99 | ~60% | **~29%,过薄** | 改为 **150 张 $19.99**(~40%)或 200 张 $24.99 |

策略:10 月前继续用 2.5(便宜,留跑道),**9 月中切换模型 ID 并同步调整大包定价**。改动只在 `api/generate.js` 的模型 URL 和 `api/_lib.js` 的 PACKS,半小时的活,但要提前排期。

---

## 二、品牌与命名(需要你拍板)

英文名不是翻译"毛茸相馆",而是保留它的灵魂:**一间给毛孩子开的照相馆**。候选(均已查过 whois,2026-07-06):

| 候选 | 域名 | 理由 | 风险 |
|---|---|---|---|
| **FluffBooth** ⭐推荐 | fluffbooth.com **可注册** | "photo booth for fluffs",一听就懂、好拼好念、和产品形态(拍立得 UI)完美对齐 | 无同名品牌(仅有 Fluff & Boots 猫用品,名字和品类都不同) |
| FluffParlor | fluffparlor.com **可注册** | "parlor" 更贴"相馆"的复古感 | 美式拼写,英联邦用户会想写 parlour |
| FloofBooth | floofbooth.com **可注册** | "floof" 是宠物圈黑话,梗浓度更高 | 圈外人不认识 floof,拼写易错 |
| Pawlaroid / PawBooth / Pawtrait 系 | 均已被注册 | — | 放弃 |

注册后当天顺手占住:TikTok / Instagram / X / Pinterest / YouTube 的 @fluffbooth,以及 Google OAuth 的正式回调域名。Logo 就用现在的 🐾+衬线字标风格,不用重设计。

**中文站不丢**:同一个站做双语,默认英文,右上角语言切换(首访按 `navigator.language` 自动判),`?lang=zh` + `<link hreflang>` 做 SEO 双语标注。海外华人用户零迁移成本,微信内分享引导只在中文/微信 UA 下出现(现有逻辑已是 UA 触发,不用改)。

---

## 三、英文文案总案(重写,不是翻译)

**语气三原则**:
1. 说"pet parent 的语言":fur baby、the goodest、main character、treats——但每屏最多一个梗,不堆砌。
2. 幽默来自"把宠物当真人郑重其事地对待"(给猫谈片酬、给狗发毕业证),而不是卖萌。
3. 承诺句(隐私、额度)保持直白零修辞——信任文案不开玩笑。

### 3.1 核心界面文案(可直接粘贴)

| 位置 | 现文案 | 英文文案 |
|---|---|---|
| `<title>` | 毛茸相馆 · 给宠物拍一张不一样的照片 | **FluffBooth — Your pet, but legendary** |
| 主标语 H1 | 把你家毛孩子,拍成没见过的样子 | **Your pet has a secret life.**(em 标出 secret life)备选:Every pet is the main character. / One photo in, a whole new pet out. |
| 副标语 | 上传一张照片…发朋友圈的图 | One photo in, one masterpiece out — pick a style, get a share-ready portrait in ~30 seconds. **No sign-up to try.** |
| 上传框 H2 | 把照片放进相框里 | **Drop their best photo here** |
| 上传框说明 | 点击选择,或直接拖拽 | Click to browse, or just drag it in |
| 上传提示 | 正脸、光线好… | Clear, front-facing photos work best · JPG / PNG, up to 10MB |
| 选片后 meta | 就是这张啦!… | **Great choice — they're going to nail this.** Every style is pre-tuned, so what you get is the final shot. |
| 步骤标题 | 挑个风格 | **Pick their vibe**(旁注:Just one — you can re-shoot after) |
| CTA(未选) | 先挑一个风格 🐾 | Pick a style first 🐾 |
| CTA(已选) | 生成「油画」🐾 | Create "Their Majesty" 🐾 |
| 生成等待 small | 一般 10–30 秒,别走开 | Usually 10–30 seconds. Worth every one of them. |
| 拍立得 caption | 油画里的它 | **"{Style} era"**(蹭 "era" 梗:Renaissance era / CEO era),日期改 `toLocaleDateString("en-US")` |
| 保存按钮 | 保存照片 | Save photo |
| 分享按钮 | 分享给朋友 🐾 | Share the glow-up 🐾 |
| 换风格/换照片 | 换个风格/换张照片 | Try another style / New photo |
| 额度 pill(登录) | 今日免费 3/3 张 | **3 free today** (+ 奖励额度显示 "+5 bonus") |
| 额度 pill(未登录) | 免费体验 1/1 张 | 1 free try today |
| 邀请卡 | 分享给朋友——各得 3 张 | Love it? Send a friend — **you each get 3 bonus portraits** 🐾(按钮 Copy invite link → 复制后 Copied 🐾) |
| 购买弹窗标题 | 给毛孩子加餐 🍖 | **Refill the treat jar 🍖** |
| 购买弹窗副标 | 奖励额度永不过期… | Credits never expire — they kick in after your daily free ones. |
| 套餐名 | 小食包/加餐包/豪华包 | **Snack Pack 30 / Feast Pack 80(Best value)/ Buffet Pack 150** |
| 弹窗关闭 | 先不用了 | Maybe later |
| 页脚承诺 | 照片无备份上传自动删除 等三条 | Photos are processed, then gone — **never stored, never used for training** · Free to try, no sign-up · Share-ready, straight out of the booth |
| 页脚落款 | 用 AI 记录毛孩子的另一面 | FluffBooth · The other side of your best friend |

**生成中的等待文案**(每 4 秒轮换一条,现在是随机取一条不动——顺手改成 `setInterval` 轮播,10–30 秒的等待就变成看段子):

```
"Convincing them to sit still…"
"Fluffing every individual hair…"
"Negotiating fees with the talent…"
"Applying a tiny bit of blush…"
"The talent has requested more treats…"
"Almost done — they're extremely photogenic…"
```

**错误与额度提示**:

| 场景 | 英文文案 |
|---|---|
| 匿名额度用完(402) | That was today's free try! **Sign in with Google for 3 free portraits every day.** |
| 登录额度用完(402) | Today's freebies are all used up — invite a friend (you both get +3) or grab a pack 🍖 |
| 格式不对 | That doesn't look like a JPG / PNG / WebP — try another photo |
| 超 10MB | That photo's over 10MB — got a slightly smaller one? |
| 生成失败 | The studio hiccuped — your credit is safe, give it another try |
| 支付到账 | Credits are in — time for a new photoshoot 🎉 |
| 分享文案(navigator.share) | I just gave my pet the "{Style}" treatment 🐾 free, takes 30 seconds: {链接} |

### 3.2 模板重命名(有趣化的主战场)

分类:艺术风格→**Masterpiece**,动漫化→**Toon**,换装配饰→**Dress-Up**,节日限定→**Occasions**,新增分类 **Plot Twist**(反转梗)。

| id | 现名 | 英文名 | 英文一句话(desc) |
|---|---|---|---|
| oil | 古典油画 | Renaissance | Hangs in the Louvre (emotionally) |
| water | 清新水彩 | Watercolor | Soft as a Sunday nap |
| film | 复古胶片 | '90s Film | Shot on dad's camera, 1994 |
| royal | 皇家贵族 | **Their Majesty** 🔥 | Bow before the floof |
| felt | 羊毛毡手作 | Felted | Handmade, huggable, 100% wool |
| clay | 黏土动画 | Claymation | Stop-motion's newest star |
| popart | 波普艺术 | Pop Art | Loud, proud, gallery-approved |
| ghibli | 治愈动画 | **Cozy Anime** 🔥 | Resident of a gentler world |
| manga | 日漫主角 | Anime Lead | Season 1, Episode 1: them |
| threed | 3D 萌系 | 3D Toon | Fresh from the movie premiere |
| cartoon | 美式卡通 | Saturday Cartoon | Cereal sold separately |
| suit | 西装绅士 | **The CEO** | Corner office. Naps at 2pm. |
| scarf | 针织围巾 | Cozy Scarf | Professional lap warmer |
| collar | 珍珠项圈 | Pearls | Old money energy |
| astro | 宇航员 | Astronaut | One small step for paws |
| cowboy | 西部牛仔 | The Sheriff | There's a new sheriff in town |
| grad | 毕业纪念照 | **The Graduate** 🔥 | Top of Good Boy School, class of '26 |
| headshot | 职业形象照 | Pro Headshot | Open to work (mostly napping) |
| bday | 生日派对 | **Birthday Star** 🔥 | It's their party |
| xmas | 圣诞毛衣 | Christmas Card | The annual family flex |
| newyear | 新春拜年 | Lunar New Year(保留,中文模式常驻;英文模式 1–2 月季节性出现) | Dressed for the red envelope |
| beach | 夏日海滩 | **Beach Day** 🔥(现在是 7 月,置顶) | Sunglasses stay ON |

**P0 新增模板 4 个**(直接踩 2026 已验证的梗,prompt 已写好可直接进 TEMPLATES):

```js
// Plot Twist 分类
{cat:"Plot Twist", id:"human", emo:"🧑‍🎤", name:"If They Were Human", desc:"The trend with 10M+ posts", hot:true,
 prompt:"Reimagine this pet as a human person in a studio portrait: hair color and texture matching the pet's fur, same expression, same personality and energy, similar accessories or collar echoed in the clothing, photorealistic, unmistakably the same soul."},
{cat:"Plot Twist", id:"mugshot", emo:"🚨", name:"The Mugshot", desc:"Charged with: crimes against snacks", hot:true,
 prompt:"Edit this pet photo into a playful police booking mugshot: pet holding a booking placard, height chart lines in the background, harsh flash lighting, deadpan expression, keep the pet's face and fur completely unchanged and photorealistic."},
{cat:"Plot Twist", id:"figure", emo:"🧸", name:"Action Figure", desc:"Collector's edition. Mint in box.",
 prompt:"Turn this pet into a collectible action figure sealed in retail blister packaging: molded plastic figure of the pet, accessories (food bowl, favorite toy, leash) in side compartments, bold toy-brand card design, product photography, keep the pet's colors and markings faithful."},
{cat:"Plot Twist", id:"yearbook", emo:"📖", name:"Yearbook '89", desc:"Voted Most Likely to Nap",
 prompt:"Edit this pet photo into a 1980s American school yearbook portrait: retro laser-beam studio background, soft feathered lighting, preppy outfit with big collar, slight head tilt, keep the pet's face and fur clearly recognizable, photorealistic."},
```

**P1 万圣节包(9 月 1 日上线)**——按 NRF 真实装扮排行做 8 款:Pumpkin(第一名,9.8%)、Hot Dog、Bumblebee、Ghost、Superhero、Witch、Vampire、Skeleton。营销角度:"**Try all of America's top pet costumes before buying one**"(试穿 8 套再决定买哪套,反向蹭 $8.6 亿的实体装扮消费)。

### 3.3 prompt 合规清理(出海必做)

现有 prompt 里有 "Studio-Ghibli-inspired"、"Pixar-style"、"Andy-Warhol-inspired"、"LinkedIn-style"——面向美国市场是商标/版权敏感词,且模型侧也可能触发拦截。全部改为描述性写法,效果不变:

- Ghibli → "hand-drawn Japanese animation film style, soft watercolor palette, gentle whimsical atmosphere"
- Pixar → "polished 3D animated feature-film character style, soft global illumination"
- Warhol → "1960s pop-art screen-print style, high-contrast flat color blocks"
- LinkedIn → "professional corporate headshot style"

UI 名称(Cozy Anime / 3D Toon / Pop Art / Pro Headshot)本来就没碰品牌词,不用动。

---

## 四、上线前必修的技术项(按优先级)

1. **生产环境静默降级 bug(P0)**:`index.html` 生成逻辑里,后端 5xx/网络错误会走 `catch` → 本地滤镜 demoRender,而 demo 徽标已被注释,**用户会把一张棕褐色滤镜图当成 AI 结果**,付费用户遇到一次就流失。改法:`auth.configured === true` 时不再降级,直接展示错误 + "try again";只有无后端(本地预览)才走 demo。
2. **分享链接不带邀请码(P0,白捡的增长)**:`shareBtn` 分享的 `url` 是裸 `location.origin`;登录用户应改为 `origin + "/?ref=" + auth.user.refCode`——每一次系统分享面板转发都变成裂变入口。
3. **零 OG/meta 标签(P0)**:现在被分享到 iMessage/WhatsApp/X 时没有预览卡。补 `<meta name="description">`、og:title/description/image、twitter:card;og:image 做一张"六宫格变身对比"静态图(launch 素材通用)。
4. **免费图水印(P0,README 里已计划)**:免费额度出图在角落合成 "🐾 fluffbooth.com"(canvas 合成即可,付费额度出图无水印——顺便成为付费理由)。
5. **i18n 架构(P0)**:单文件内做 `STRINGS = {en:{...}, zh:{...}}` 字典 + `t()` 函数,模板的 name/desc 拆双语字段;`<html lang>` 动态设置;英文显示字体把 ZCOOL XiaoWei 换成 **Fraunces**(暖衬线,和拍立得复古感契合),正文 **Nunito**;`Noto Sans SC` 仅中文模式加载(省首屏)。
6. **模型迁移排期(9 月中,死线 10-02)**:`gemini-2.5-flash-image` → `gemini-3.1-flash-image`,同步把 200 张包改 150 张(见第一节表格)。
7. **法务两页(P1,Google OAuth 正式验证也需要)**:英文 Privacy Policy + Terms(核心三句:照片即处理即删、不训练、用户保证对照片有权利且生成图个人使用)。页脚加链接。
8. **Stripe 收银台开 Apple Pay / Google Pay**(Dashboard 勾选即可,移动端转化立涨)。
9. **Vercel Web Analytics 打开**(README 已提),配合 UTM 看渠道来源;现有 /api/stats 漏斗继续作为北极星看板。

---

## 五、功能扩展:做什么、不做什么

判断标准:**只做"让分享物自带传播力"和"蹭已验证趋势"的功能**;不做重资产功能。

### P0(两周内,配合英文版一起上)

1. **Reveal 分享卡**:下载/分享时可选"Before & After"版式——左原图右成片、底部品牌条+域名(登录用户自动带邀请码短链)。TikTok 2026 最火的就是 Reveal 格式,让用户的默认分享物 = 我们的广告。canvas 客户端合成,零成本。
2. **GIF 揭晓动图**:同素材再导出一个 2 秒交叉溶解 GIF(原图→成片),客户端 canvas 逐帧编码即可,发 iMessage/微信/推特都会动。竞品要做视频 AI 才有动效,我们用 0 成本拿到 80% 效果。
3. **Plot Twist 模板包**(上文 4 个,含 Pet-to-Human 大趋势)。
4. **等待文案轮播**(4 秒一条,见 3.1)。

### P1(8–9 月)

5. **万圣节包 + "Costume Try-On" 活动页**(9/1 上线,10 月是全年最大流量窗口)。
6. **邮件沉淀**:Google 登录已拿到 email,加一个"New styles monthly?"的 opt-in 勾选,用 Resend 免费档发月度上新+节日提醒(万圣节/圣诞召回全靠它)。
7. **风格 SEO 落地页**:`/styles/renaissance-pet-portrait.html` 等 8–10 个静态页(共用样式,写个 20 行的生成脚本),吃 "AI pet portrait"、"pet renaissance painting"、"pet halloween costume ideas" 长尾。首页单文件哲学不破坏,落地页只是薄壳+跳转主站。

### P2(10–12 月,看数据再投)

8. **圣诞贺卡导出**:成片套贺卡版式(4 款),导出可打印 PDF;这是 11–12 月的分享钩子。
9. **宠物档案相册**(README 路线图原有项,留存驱动)。
10. **实体周边(print-on-demand)**:Printful API 接画布/马克杯/贺卡,$39–59 客单、40–60% 毛利。Pet Canvas 单张卖 $19.99、Crown & Paw 靠实体做到规模——这是把"$0.125 的数字图"变成"$49 的礼物"的跳板。**先用最轻方式验证:结果页放一个 "Get it on canvas" 按钮,点击即视为需求信号,埋点计数,超过 3% 再真接。**
11. **人宠合照**(README 二期原计划,时点选在感恩节/圣诞全家福场景)。

### 不做(现在)

- **视频动画**:WigglePet 已占位,成本和等待时间破坏"30 秒"核心体验。
- **训练式 avatar(传 20 张图那种)**:那是竞品的慢车道,我们的护城河就是"一张图、30 秒"。
- **原生 App / 订阅制**:README 的判断依然对——等看板出现"每周回访 3 次+"的核心用户群再说。
- **多语言(英文之外)**:先把英文做透;i18n 字典架构留好,西语/日语是后话。

---

## 六、增长打法与 90 天日历

### 核心飞轮

**每张免费图都是广告**(水印+Reveal 卡+带 ref 的分享链)→ 新用户免注册即玩 → 登录拿每日 3 张 → 邀请再 +3 → 额度弹窗转付费。裂变基建你已经建完了,出海版只是把每个分享出口都接上 ref 码。

### 渠道优先级(按 ROI)

1. **TikTok / Reels / Shorts(主战场)**:产品输出物=平台最火格式。开 @fluffbooth 账号,**每天 1 条 Reveal**:前 1 秒原图+悬念文案("POV: your cat finds out he's royalty"),第 2 秒卡点揭晓成片。选题直接用已验证的 10 个格式:Reveal / Birthday Surprise / POV Promotion(CEO)/ Glow-Up / Halloween Drop / Space Explorer / Breed Niche(每周做一个犬种/猫种专场,吃品种垂类流量)等。素材就是自己生成,一天 10 分钟。
2. **微网红种草(最划算的付费)**:私信 100 个 1–10 万粉宠物账号,送 50 credits + 专属邀请码(后台已支持 ref,给 KOL 的 ref 奖励可以在 `_lib.js` 单独调高)。不给现金,给"你家宠物的 22 种人生"素材包——宠物账号天然缺内容选题。
3. **Reddit / HN / Product Hunt(launch 周)**:
   - r/SideProject、r/InternetIsBeautiful(这类"打开就能玩的小站"是它的最爱)、r/aiArt;犬种/猫种 sub 只发作品不发链接(评论区有人问再给)。
   - Show HN 角度写给工程师:"Two files, no framework, no database for photos — a pet photo booth that deletes your photo after 30 seconds"(极简架构+隐私设计是 HN 的菜)。
   - Product Hunt 选周二/周三发,首图用六宫格对比,tagline: "Your pet, but legendary."
4. **Facebook 犬种/猫种群组**:海外中老年宠物主聚集地,恰好是付费主力(给孙子辈晒宠物图的人群)。以用户身份晒图,不硬广。
5. **Pinterest + SEO**:"pet portrait ideas"、"pet christmas card ideas" 是 Pinterest 长青搜索;把每个风格的样例图钉上去,链到对应 SEO 落地页。慢渠道,但 10 月起就是节日搜索旺季,7 月种树 10 月乘凉。
6. **付费投放:先不投**。唯一例外:TikTok 上哪条自然流量破了 10 万播放,拿 $10–20/天 Spark Ads 加热同一条。

### 90 天日历

| 时间 | 动作 | 目标 |
|---|---|---|
| **W1–2(7 月上)** | 注册域名+社媒号;英文版上线(文案+i18n+字体);P0 四修(降级 bug/ref 分享链/OG/水印);Plot Twist 包;Reveal 卡+GIF 导出 | 英文版可对外 |
| **W3(7 月中)** | 软启动:发 20 个朋友;开 TikTok 日更;r/SideProject 首发;X 上 build-in-public 连载 | 验证漏斗:上传→生成 ≥60%,生成→下载 ≥70%(README 既定生死线) |
| **W4(7 月底)** | **Product Hunt + Show HN 同周发**;Reddit 三个 sub 铺内容;首批 100 个 KOL 私信发出 | 单日 5k+ 访问;拿到首批 100 个注册、10 单付费 |
| **8 月** | 看板砍模板(双低下架,README 既定动作);邮件 opt-in 上线;SEO 落地页 ×10;KOL 第二批;每周上新 2 模板维持日更素材 | 周访问稳定 5k;D1 回访 ≥15%;邀请注册占比 ≥20% |
| **9 月** | **万圣节包 9/1 上线** + Costume Try-On 活动页;Pinterest 铺节日图;**模型迁移到 3.1 + 大包调价**(死线 10-02);邮件第一封节日召回 | 蹭住全年最大宠物内容窗口 |
| **10 月** | 万圣节冲刺:日更两条、Spark Ads 加热爆款、犬种群组晒图 | **单月 1 万美元流水冲刺**;沉淀邮件列表 |
| **11–12 月** | 圣诞贺卡导出上线;"Get it on canvas" 需求验证;人宠合照(全家福场景)| 第二波节日;验证实体周边这条 10 倍客单价曲线 |

### KPI(沿用你现有 /api/stats 看板)

- 访问→上传 ≥25%,上传→生成 ≥60%,**生成→下载 ≥70%**(不达标先改 prompt,README 原则不变)
- 分享点击率(track 里已有 share 事件)≥15%;邀请注册占比 ≥20%
- 登录用户付费转化 2–4%;D1 回访 ≥15%
- 新增维度建议:给 `track` 加 `lang` 字段,中英文漏斗分开看

---

## 七、需要你拍板的三件事

1. **名字与域名**:推荐 FluffBooth(fluffbooth.com 可注册),备选 FluffParlor / FloofBooth。拍板后我可以直接动手做英文版全站(文案照第三节落地)。
2. **默认语言**:建议英文默认 + 首访按浏览器语言自动切中文(海外华人无感,全球用户第一眼是英文)。
3. **匿名免费额度**:launch 周流量脉冲(PH/HN 一天几千人)按 1 张/IP,成本 = 访客数 × $0.039,五千访客约 $200 内,可承受;若想控风险可临时把 `ANON_DAILY` 调 0(登录才免费),但会牺牲 "no sign-up to try" 这个卖点——**建议保 1 张不动**。

## 附:调研主要来源

- 竞品:[DreamPets](https://dreampets.ai/en)、[Pawcaso 等对比评测](https://www.neolemon.com/blog/best-ai-pet-portrait-apps/)、[Pet Canvas 定价](https://create.petcanvas.art/blog/best-ai-pet-portrait-app)、[Adobe Firefly 宠物入口](https://www.adobe.com/products/firefly/features/ai-pet-portrait-generator.html)
- 趋势:[2026 病毒式 AI 宠物视频 10 格式(Tail Frame)](https://tailframe.com/faq/tiktok-pet-video-ideas)、[2026 AI 照片趋势(含 Pet-to-Human 1000 万帖)](https://www.nothron.com/en/blog/top-10-viral-ai-photo-trends-2026)
- 节日数据:[NRF 2025 万圣节创纪录 $13.1B](https://nrf.com/media-center/press-releases/nrf-consumer-survey-finds-halloween-spending-to-reach-record-13-1-billion)、[宠物装扮 $860M、+22.9%(Morning Brew / Retail Brew)](https://www.morningbrew.com/stories/2025/10/26/pet-costumes-are-an-usd860m-business)
- 模型:[Gemini API 官方定价](https://ai.google.dev/gemini-api/docs/pricing)、[Gemini 3.1 Flash Image 每张成本与 2.5 停服时间(2026-10-02)](https://www.aifreeapi.com/en/posts/gemini-flash-image-generation-pricing)
