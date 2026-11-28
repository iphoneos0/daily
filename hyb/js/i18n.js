/* 环球躲烟 · 多语言（2026-11-17）
 * 代码里照旧写英文，显示前过一下 HYB.L：L('Run {n} m in one run', { n: 200 }) → 中文时是「一局跑 200 米」。
 * 英文原句就是查表的键，表里没有的照原样显示英文，所以漏翻的地方不会空着，只是露出英文。
 *   {名字}：换成第二个参数里的值。同一句英文在不同地方意思不一样时，键写成「场合|英文」，英文里显示「|」后面那段。
 *   页面上写死的字（index.html）：元素上加 data-t（文字）或 data-ta（读屏用的 aria-label），切换语言时 HYB.applyStatic() 换一遍。
 * 语言怎么定：玩家在暂停菜单或「怎么玩」里选过就用选的（存在 hyb-lang）；没选过跟系统语言走，中文系统就是中文。
 *   App 里系统语言由 iOS 壳挂在 window.hybSysLang（GameStorage.swift）：WKWebView 的 navigator.language 只认 App 自己带了哪些语言，靠不住。
 * 漏翻检查：浏览器控制台看 HYB.L.miss（中文时查不到的英文都记在这里）。
 * 加一种语言：LANGS 里加一行，DICT 里加一张同样的表。
 */
(function () {
  'use strict';
  const H = window.HYB = window.HYB || {};
  const store = H.store || { get() { return null; }, set() { } };

  const ZH = {
    // ---------- 页面上写死的 ----------
    'Turn your phone upright': '请把手机竖过来',
    'City street, side view': '城市街道侧视图',
    'Pause': '暂停', 'Sound': '声音', 'Story': '故事', 'Daily rewards': '七日签到', 'Music test': '试听配乐', 'Home': '主页',
    'Packing…': '收拾行李…',
    'PLAY': '开跑',
    'Daily': '每日', 'Missions': '任务', 'Upgrades': '升级', 'Hats': '帽子', 'Store': '商店',
    'Take five.': '歇一会儿。', 'Keep running': '接着跑', 'How to play': '怎么玩', 'Quit run': '结束这一局',
    'm': '米', 'RUN AGAIN': '再来一局', 'DAILY AGAIN': '再跑每日',
    'Keep going?': '接着跑？', '▶︎ Watch an ad': '▶︎ 看段广告', 'Pay coins': '花金币', 'No thanks': '不用了',
    'Done': '好', 'Skip': '跳过', 'Wear it': '戴上',
    'Daily Rewards': '七日签到', 'Claim': '领取', '▶︎ Claim ×2': '▶︎ 双倍领取', 'Later': '等会儿',
    'Tomorrow’s run?': '明天还来跑吗？',
    'There’s a new daily street every day. Want a nudge tomorrow at 6 pm, so your streak doesn’t break?': '每天都有一条新的每日街道。明天傍晚 6 点提醒你一下，免得断了连续天数？',
    'Remind me': '提醒我', 'Not now': '先不用',
    'Your trip': '你的旅行',
    'same tune · 4 styles': '同一首曲子 · 4 种编曲', 'Use this one': '就用这个',
    'Daily run': '每日挑战', 'Play today’s run': '开始今天的挑战', 'Back': '返回',
    'Test build: set my coins back to 0': '测试版：把金币清零', 'Restore purchases': '恢复购买',
    'Permanent. Every run starts stronger.': '永久有效，每局都更强。',
    'Pick your gear': '选装备', 'One item, for this run only.': '选一件，只管这一局。', 'Run without gear': '不带装备', 'Reroll': '换一批',
    'Got it': '知道了', 'Privacy policy': '隐私政策', 'Ad privacy choices': '广告隐私选项',
    'Playtest log': '试玩记录', 'Copy': '复制', 'Clear': '清空', 'Close': '关闭',
    'Ad placeholder': '广告占位',
    'Language: {l}': '语言：{l}',

    // ---------- 街区、城市、天 ----------
    'Sidewalk stroll': '人行道', 'Office doors': '写字楼', 'Park escape': '公园', 'Rooftop garden': '屋顶花园', 'Subway rush': '地铁口',
    'New York': '纽约', 'London': '伦敦', 'Paris': '巴黎', 'Tokyo': '东京',
    'Day': '白天', 'Dusk': '傍晚', 'Night': '夜里', 'Dawn': '黎明', 'Rain': '雨天',
    'Day {n}': '第 {n} 天',

    // ---------- 任务 ----------
    'Pass {n} smokers on one breath': '一口气冲过 {n} 个烟民',
    'Run {n} m in one run': '一局跑 {n} 米',
    'Run {n} m without coughing': '不呛一下跑 {n} 米',
    'Reach the Office doors': '走到写字楼', 'Reach the Park': '走到公园', 'Reach the Rooftop': '走到屋顶', 'Reach the Subway': '走到地铁口',
    '{n} stop to go': '还差 {n} 站', '{n} stops to go': '还差 {n} 站',
    'Hit {n} bullseyes': '正中烟头 {n} 次',
    'Put out {n} cigarettes': '灭掉 {n} 根烟',
    'Pass {n} smokers on held breaths': '憋着气冲过 {n} 个烟民',
    'Get {n} PERFECTs in one run': '一局里出 {n} 次「完美」',
    'Lead a parade of {n}': '戒烟游行带上 {n} 个人',
    'Grab {n} stall perks in one run': '一局拿 {n} 个摊位加成',
    'Dash past {n} smokers ON BEAT': '踩着节拍冲过 {n} 个烟民',
    'Collect {n} coins': '捡 {n} 个金币',
    'Grab {n} power-ups': '捡 {n} 个道具',
    'Pop {n} smoke rings': '戳破 {n} 个烟圈',
    'Beat the Cigar Boss {n} times': '打败雪茄老板 {n} 次', 'Beat the Cigar Boss': '打败雪茄老板',
    '★ Mission done: {m}': '★ 任务完成：{m}',
    'done': '完成', 'Swap this mission': '换一个任务', '↻ ▶︎ Ad': '↻ ▶︎ 广告',
    'Missions · rank {n}': '任务 · 第 {n} 级',
    'Finish all three for {c} coins and a new set. Every rank adds 5% to the coins you earn per run, up to 25%. Stuck? ↻ swaps a mission.': '三个都完成：得 {c} 金币，再换一组新任务。每升一级，每局的金币多 5%，最多多 25%。做不到？点 ↻ 换一个。',

    // ---------- 升级 ----------
    'Head start': '开局滑板', 'Start every run on a skateboard': '每局开头踩着滑板冲一段',
    'Sidestep': '侧身', 'Dodge what you would bump into': '快撞上时侧身挤过去',
    'Lungs': '肺活量', 'Longer breath, faster recovery': '气更长，回得更快',
    'Power-ups': '道具时长', 'All four last longer': '四种道具都更久',
    '{n} s': '{n} 秒', 'up|off': '没有', 'every {n} s': '每 {n} 秒一次', 'max': '满级', 'MAX': '满级',
    'Upgrades are new! The {c} coins you spent on the old ones are back.': '升级换新了！以前花在旧升级上的 {c} 金币已经退回。',

    // ---------- 装备 ----------
    'Big Lungs': '大肺', 'Hold your breath 1.5 seconds longer': '多憋 1.5 秒', '+1.5 s of breath': '气多 1.5 秒',
    'Water Tank': '大水箱', 'Every shot splashes wider. Plus 2 shots': '每一发化掉更大一片烟，再多 2 发', 'big splash, +2 shots': '水花更大，多 2 发',
    'Sprint Shoes': '冲刺鞋', 'Quicker lane switches, faster sprint': '换道更快，冲刺更快', 'quick feet': '脚下飞快',
    'Face Mask': '口罩', 'Breathe freely in thin smoke': '薄烟里照样喘气', 'breathe in thin smoke': '薄烟里照样喘气',
    'Coin Magnet': '吸金磁铁', 'Coins fly to you from every lane': '三条道的金币都飞过来', 'coins fly to you': '金币自己飞过来',
    'Big Exhale': '大口呼气', 'Combos blow the smog twice as far': '连冲把大烟雾吹得远一倍', 'combos push the smog twice as far': '连冲吹得远一倍',
    'Second Wind': '第二口气', 'Escape the smog once when it catches you': '被追上时逃掉一次', 'one free escape from the smog': '被追上能逃一次',
    'Your first gear today is free. It lasts one run.': '今天第一件装备免费，管一局。',
    'Gear you have never worn is free to try once.': '没用过的装备可以免费试一次。',
    'One item, for this run only. Or keep your coins and run without.': '选一件，只管这一局。也可以不花钱，直接跑。',
    ' You have {n} free gear ticket.': '你有 {n} 张免费装备券。', ' You have {n} free gear tickets.': '你有 {n} 张免费装备券。',
    'FREE TRY': '免费试', 'FREE': '免费', 'TICKET': '用券',
    'Reroll · {n} coins': '换一批 · {n} 金币', 'Reroll · watch ad': '换一批 · 看广告',

    // ---------- 每日挑战 ----------
    'Daily run · {d}': '每日挑战 · {d}',
    'Everyone gets the same street and the same gear today. Run it as often as you like.': '今天所有人跑同一条街、带同一件装备，想跑几次就跑几次。',
    '🔥 {n}-day streak': '🔥 连续 {n} 天', 'Start a streak': '开始连续打卡', 'see you tomorrow': '明天见', '+{c} coins for today’s run': '今天跑一次 +{c} 金币',
    'Today: {g}': '今天：{g}', 'Run {m} m': '跑 {m} 米', '+{c} coins': '+{c} 金币', 'Today’s best': '今天最好',
    'DAILY RUN · {d}': '每日挑战 · {d}',

    // ---------- 七日签到 ----------
    'NEW HAT!': '新帽子！', 'TODAY': '今天', 'NEXT': '明天', 'DAY {n}': '第 {n} 天', 'Claimed': '已领',
    'Week {n} · check in every day': '第 {n} 轮 · 每天来签到',
    'Check in every day · Day 7: a new hat!': '每天来签到 · 第 7 天送新帽子！',
    'Day 7! Claim your new hat.': '第 7 天！领你的新帽子。',
    'Day {n}: {c} coins': '第 {n} 天：{c} 金币',
    'Come back tomorrow for a new hat.': '明天再来领新帽子。', 'Come back tomorrow for {c} coins.': '明天再来领 {c} 金币。',
    'New hat: {h}! You’re wearing it.': '新帽子：{h}！已经戴上了。', 'New hat: {h}! Put it on in Hats.': '新帽子：{h}！去「帽子」里戴上。',
    '+{c} coins!': '+{c} 金币！',
    // 第二天的提醒（系统通知）
    '🎁 Day {n} gift is ready': '🎁 第 {n} 天的礼物到了', '{c} coins are waiting. The Big Smog is already out on the street…': '{c} 金币等你来拿。大烟雾已经在街上转悠了……',
    '🎁 Day 7: a brand-new hat!': '🎁 第 7 天：一顶新帽子！', 'Grab it before the Big Smog does 😤': '赶在大烟雾之前抢到它 😤',
    '🔥 {n}-day streak on the line': '🔥 连续 {n} 天，别断了', 'One quick run today keeps it alive.': '今天跑一局就能接上。',
    'The Big Smog is back 😤': '大烟雾又回来了 😤', 'New street, new gear. Can you outrun it today?': '新街道、新装备。今天甩得掉它吗？',
    'Settings': '设置', 'Language': '语言', 'Daily reminder: on': '每日提醒：开', 'Daily reminder: off': '每日提醒：关',

    // ---------- 商店和广告 ----------
    'Coin doubler': '金币翻倍', 'Every coin counts twice. Forever.': '每个金币都算两个，永久有效。',
    'Remove ads': '去广告', 'No ads between runs.': '两局之间不再插广告。',
    '1,500 coins': '1,500 金币', '8,000 coins': '8,000 金币', '25,000 coins': '25,000 金币',
    'Your first upgrades': '先买几样升级', 'A big upgrade': '一大步升级', 'Weeks of running': '够跑好几个星期',
    'A reward video plays here': '这里会放一段奖励视频', 'Afterwards you are back in the run.': '看完接着跑。', 'Afterwards your coins are doubled.': '看完金币翻倍。',
    'Afterwards you get three new items.': '看完换三件新装备。', 'Afterwards you get a new mission.': '看完换一个新任务。', 'Afterwards you get {n} coins.': '看完得 {n} 金币。',
    'Afterwards today’s reward is doubled.': '看完今天的奖励翻倍。', 'An ad between runs shows here': '这里会放一条两局之间的广告',
    'It can be closed after a moment. “Remove ads” takes these away.': '过一会儿就能关。买了「去广告」就没有了。',
    'Collect reward': '领取奖励', 'Loading video…': '视频加载中…', 'No video right now': '现在没有视频', 'Try again in a bit.': '过一会儿再试试。', 'OK': '好',
    'Free coins': '免费金币', '{n} video left today': '今天还能看 {n} 次', '{n} videos left today': '今天还能看 {n} 次', 'Back tomorrow': '明天再来', 'free|Done': '已领完',
    'Owned': '已拥有', 'Test build: purchases are free and ads are placeholders.': '测试版：购买不花钱，广告是占位的。',
    'Nothing to restore in this test build.': '测试版里没有可恢复的购买。', 'Purchases restored.': '已恢复购买。', 'Nothing to restore.': '没有可恢复的购买。',
    'Could not reach the store. Try again later.': '连不上商店，稍后再试。',

    // ---------- 开场故事 ----------
    'LEO': '里奥', 'OFFICE GUY': '上班族', 'HOODIE KID': '卫衣小子', 'THE BIG SMOG': '大烟雾',
    'New York! I saved up all year for this walk.': '纽约！我攒了一整年的钱，就为了来这儿走一走。',
    'Fresh air, here I come!': '新鲜空气，我来啦！',
    'Morning, kid. *puff*': '早啊，小伙子。*呼——*',
    '…What is that smell?': '……这是什么味儿？',
    '*puff* …Sup.': '*呼——* ……嘿。',
    'Is EVERYONE on this street smoking?!': '这条街上的人全都在抽烟？！',
    'Heh heh heh…': '嘿嘿嘿……',
    'Who said that?!': '谁在说话？！',
    'All that smoke had to go somewhere. Now I go wherever YOU go.': '这么多烟总得有个去处。现在，你走到哪儿，我就跟到哪儿。',
    'Mmmph! (Hold your breath, Leo. And RUN!)': '唔！（憋住气，里奥。快跑！）',

    // ---------- 城市页 ----------
    'NEW YORK': '纽约', ' · MORE CITIES SOON': ' · 更多城市即将开放', 'New York, {n} of 3 stars': '纽约，{n} / 3 颗星',
    // 从第几天出发（2026-11-21）
    ' · START AT DAY {d}': ' · 可从第 {d} 天出发', 'Start from a day you’ve reached:': '从到过的一天出发：', 'Beat Day {d} boss': '打败第 {d} 天老板', 'Daytime': '白天',
    // 金币重新设计（2026-11-21，docs/32）
    '{x} Lv {n}': '{x}\u00a0{n}\u00a0级', 'Next: {x}': '下一样：{x}', '{x}': '{x}', 'You can buy it!': '买得起了！', '{n} to go': '还差 {n}',
    'Buys {x}': '够买：{x}', 'Buys {n} things, incl. {x}': '够买 {n} 样，包括{x}', 'Best value': '最划算',
    'dbl|Watch ad': '看广告再拿', 'picked up {n}': '捡到 {n}', 'rank +{p}%': '任务等级 +{p}%', 'doubler ×2': '金币翻倍 ×2',
    'missions +{n}': '任务 +{n}', 'daily +{n}': '每日 +{n}', 'ad +{n}': '广告 +{n}',
    'DAY {d} AGAIN': '再跑第 {d} 天', '▶︎ Start at Day {d}': '▶︎ 从第 {d} 天出发', 'Beat today’s Cigar Boss for {s}': '打败今天的雪茄老板，拿 {s}',
    'All three stars! The next cities are on their way.': '三颗星全拿到了！下一座城市在路上。',
    'Every day ends at the Cigar Boss, and every day he’s faster. Beat him on Day {d} for {s}.': '每一天的尽头都是雪茄老板，而且一天比一天快。在第 {d} 天打败他，拿 {s}。',
    'All stars · Cigar Boss beaten {n}×': '星星全满 · 打败雪茄老板 {n} 次',
    'Next {s}: beat the Day {d} boss · +{c}': '下一颗 {s}：打败第 {d} 天的老板\u00a0·\u00a0+{c}',
    'Best run {n} m': '最远 {n} 米', 'Coming soon': '敬请期待',

    // ---------- 帽子 ----------
    'Ball cap': '棒球帽', 'Beanie': '毛线帽', 'Taxi light': '出租车顶灯', 'Swim cap': '泳帽', 'Liberty crown': '自由女神冠', 'Fire helmet': '消防头盔',
    'Headphones': '大耳机', 'Chef hat': '厨师帽', 'Snorkel': '潜水镜', 'Propeller cap': '螺旋桨帽', 'Space helmet': '宇航员头盔', 'Crown': '皇冠',
    '{c} coins': '{c} 金币', 'Beat the Day {d} boss · {s}': '打败第 {d} 天的老板 · {s}', 'Finish your first three missions': '完成第一组三个任务',
    'Reach mission rank {n}': '任务等级到 {n} 级', 'Day 7 of Daily Rewards (the gift box)': '七日签到第 7 天（左上角的礼包）',
    'Rank {n}': '{n} 级', 'Day 7': '第 7 天', '✓ ON': '✓ 戴着',
    'You’re wearing it.': '正戴着。', 'Yours. Tap Wear to put it on.': '已经拿到，点「戴上」就戴上。', 'Take it off': '摘下',
    'Buy · {c}': '买 · {c}', '{c} coins · you have {h}': '{c} 金币 · 你有 {h}', 'Locked': '还没解锁',

    // ---------- 设置 ----------
    'Music: on': '音乐：开', 'Music: off': '音乐：关', 'Sound effects: on': '音效：开', 'Sound effects: off': '音效：关',
    'Vibration: on': '震动：开', 'Vibration: off': '震动：关', 'Music style: ': '音乐风格：',
    'Breath: A · old, refills in 1 s': '气：A · 旧版，1 秒回满', 'Breath: B · tighter, refills in 1.8 s': '气：B · 更紧，1.8 秒回满',
    'Rules: BREATH · no sprint, dive into smoke': '规则：憋气版 · 不冲刺，钻进烟里', 'Rules: DIVE · thick smoke, big PHEW': '规则：潜水 · 浓烟、大口呼', 'Rules: CLASSIC · the old game': '规则：原来的',
    'What you have now': '现在用的', 'Swing beat, oom-pah bass, skipping along': '摇摆节奏、嘭嚓低音，一蹦一跳', 'A whistled tune over soft brushes': '口哨旋律配轻刷鼓', 'Faster, four-on-the-floor, being chased': '更快、四拍底鼓，被追着跑',
    'Running': '跑步', 'Boss': '老板',
    'Copied': '已复制', 'Select the text to copy': '选中文字复制', 'Tap again to clear': '再点一下清空', 'No runs yet.': '还没有记录。',

    // ---------- 跑的时候：教学和提示 ----------
    'HOLD the left side to hold your breath': '按住屏幕左边憋气', 'Hold SPACE to hold your breath': '按住空格键憋气',
    'Clean air! Let go to breathe': '空气干净了！松手喘口气',
    'Swipe up or down to change lanes': '上下滑动换道', 'Press ↑ or ↓ to change lanes': '按 ↑ 或 ↓ 换道',
    'TAP a glowing cigarette to put it out': '点一下发光的烟头，把它滋灭', 'Click a glowing cigarette to put it out': '点一下发光的烟头，把它滋灭',
    'FAST! ←': '快！←', 'LEASH!': '狗绳！', 'RINGS': '烟圈', 'PACING ↕︎': '踱步 ↕︎', 'BIG CLOUDS': '大团烟', 'BIG PUFFS': '大口烟', 'STEAM IS OK': '白汽没事',
    'Oh! Sorry!': '哦！抱歉！', 'My bad.': '我的错。', 'Fair enough.': '行吧。', 'Oops.': '哎呀。', 'Okay, okay.': '好好好。',
    'Watch it!': '看着点！', '*cough*': '*咳*', 'Whoa!': '哇！', 'Sorry!': '抱歉！',
    'GOTCHA!': '抓到你了！',
    'The boss says hi! Heh heh!': '老板向你问好！嘿嘿！', 'Out of breath already? Heh!': '这就没气了？嘿！',
    'My doorway pals say hi! Heh!': '门口那帮兄弟向你问好！嘿！', 'Walked right into that one!': '自己一头撞进来了！',
    'Stuck behind a smoker? Heh!': '被烟民堵在后面了？嘿！', 'Mmm, vanilla cloud! Heh heh!': '嗯～香草味的烟！嘿嘿！',
    'Nice patio, huh? Heh heh!': '露台不错吧？嘿嘿！', 'Vroom vroom! Heh heh!': '嗡嗡嗡！嘿嘿！', 'Smoky, isn’t it? Heh heh!': '烟挺大的吧？嘿嘿！',
    'Watch where you’re going!': '走路看着点！', 'Beep beep! Heh heh heh!': '嘀嘀！嘿嘿嘿！', 'Too slow, kid! Heh heh!': '太慢啦，小子！嘿嘿！',
    'dawn: fresh air, breath comes back faster': '黎明：空气新鲜，回气更快', 'rain: smoke fades faster': '雨天：烟散得更快',
    'dusk: every coin counts double': '傍晚：每个金币算两个', 'night: the smog moves faster': '夜里：大烟雾更快',
    'New neighborhood': '新街区', 'smokier': '烟更多',
    'Tip: let go in clean air before the ring runs out.': '提示：气圈用完之前，到干净空气里松手。',
    'Tip: start holding a step before the smoke.': '提示：进烟前一步就开始憋气。',
    'Tip: keep holding until you’re out of the smoke.': '提示：一直憋到出了烟再松手。',
    'Tip: let go right as you clear the smoke. A PERFECT blows the smog much further back.': '提示：刚出烟就松手，「完美」能把大烟雾吹得很远。',
    'Tip: pass more smokers on one breath. Big PHEWs blow the smog way back.': '提示：一口气多冲几个烟民，「呼」得越大吹得越远。',
    'Tip: dive into the smoke. Every second you hold in there blows the smog farther back.': '提示：钻进烟里憋着，多憋一秒，大烟雾就退得更远。',
    'Tip: dodge whatever is in your lane. Every bump lets the smog jump closer.': '提示：躲开道上的东西，每撞一下大烟雾就扑近一截。',
    'Tip: every lane blocked? Tap a smoker to put him out.': '提示：三条道都堵住了？点烟民，把他的烟滋灭。',
    'Tip: a lane flashes red? Get out of it.': '提示：哪条道闪红，就赶紧离开那条道。',
    'Tip: hold to sprint. It’s the only way to pull away.': '提示：按住冲刺，只有这样才甩得开它。',

    // ---------- 复活和结算 ----------
    'New best! {m} m and counting.': '新纪录！{m} 米，还在涨。',
    'Only {g} m to your best ({b} m)!': '离最好成绩（{b} 米）只差 {g} 米！',
    'The Cigar Boss is right there!': '雪茄老板就在前面！',
    '{m} m to {place}.': '离{place}还有 {m} 米。', 'the Cigar Boss': '雪茄老板',
    'Blow the smog back and keep running?': '把大烟雾吹回去，接着跑？',
    'Pay {c} coins': '花 {c} 金币', 'No thanks ({n})': '不用了（{n}）',
    'BACK IN THE RUN!': '接着跑！',
    'Best {m} m': '最好 {m} 米', 'Can you beat it?': '能超过它吗？', 'NEW BEST!': '新纪录！',
    'Only {m} m short of your best!': '离最好成绩只差 {m} 米！', 'Tied your best!': '追平最好成绩！',
    '★ New York cleared!': '★ 走通纽约！', '{s} Day {d} boss beaten!': '{s} 打败第 {d} 天的老板！',
    'Cigar Boss beaten ×{n}': '打败雪茄老板 ×{n}', 'Cigar Boss beaten!': '打败雪茄老板！',
    '{n} new hats!': '{n} 顶新帽子！', 'New hat: {h}!': '新帽子：{h}！', 'RANK UP! +{c}': '升级！+{c}',
    '★ {n} missions done!': '★ 完成 {n} 个任务！', '★ Mission done!': '★ 任务完成！',
    'Parade of {n}': '游行 {n} 人', 'PERFECT ×{n}': '完美 ×{n}', 'PERFECT!': '完美！', 'Daily +{c}': '每日 +{c}',
    'Today’s best {m} m': '今天最好 {m} 米',
    'So close! Beat the Cigar Boss for {s}': '就差一点！打败雪茄老板拿 {s}', 'So close! Beat the Cigar Boss next time': '就差一点！下次打败雪茄老板',
    '{m} m to {place}': '离{place}还有 {m} 米', '{m} m to the Cigar Boss': '离雪茄老板还有 {m} 米', '{m} m to the Cigar Boss for {s}': '离雪茄老板还有 {m} 米，打败他拿 {s}',
    'Mission: {m} · {p}': '任务：{m} · {p}',
    'Free': '免费', 'Got it!': '到手！',

    // ---------- 跑的时候：飘字、横幅 ----------
    'PSSST!': '嗤！', 'FSSH!': '噗！', 'SPLASH!': '哗！', 'FSSSH': '嗤——',
    'BULLSEYE!': '正中！', 'Bullseye! Free shot, plus some air': '正中！这一发不花水，还回一点气',
    'PERFECT! {s}s': '完美！{s} 秒', 'PERFECT! ×{n}': '完美！×{n}', 'PERFECT! Let go right as you leave the smoke': '完美！刚出烟就松手',
    'PHEW! {s}s': '呼！{s} 秒', 'PHEW! ×{n}': '呼！×{n}', 'PHEW!': '呼！',
    'SMOG -{n} m': '大烟雾 -{n} 米', 'SMOG −{n} m': '大烟雾 −{n} 米', '+{n} coins': '+{n} 金币', 'MEGA PHEW!': '超级大呼！',
    'PHEW! The longer you hold in smoke, the farther it goes': '呼！在烟里憋得越久，吹得越远',
    'PHEW! Every smoker passed on that breath counts': '呼！这口气冲过的每个烟民都算数',
    '×{n} lost': '×{n} 没了', '*COUGH*': '*咳咳*',
    'You let go inside the smoke! Hold until you’re out': '你在烟里松手了！憋到出了烟再松',
    'Hold your breath BEFORE the cloud': '进烟之前就要憋气',
    'HAAAH': '哈——', 'Out of air! Let go sooner, in clean air': '气用光了！早点在干净空气里松手',
    'It’s behind you. HOLD to sprint away': '它就在你身后。按住冲刺，甩开它', 'It’s behind you. Hold SPACE to sprint away': '它就在你身后。按住空格冲刺，甩开它',
    'THE CIGAR BOSS': '雪茄老板', 'CIGAR BOSS IN SHADES': '戴墨镜的雪茄老板', 'GOLDEN CIGAR BOSS': '金墨镜雪茄老板', 'CIGAR BOSS': '雪茄老板',
    'Tap what he shows you: rings, ember, flame': '他亮出什么就点什么：烟圈、火星、火苗',
    'Day {d}: faster than yesterday': '第 {d} 天：比昨天更快', 'Day {d}: top speed': '第 {d} 天：最快了',
    'HAT OFF!': '帽子掉了！', 'GOT HIM!': '打中了！', 'Not there!': '不是那里！',
    'NEW HAT: {h}!': '新帽子：{h}！', '{s} NEW YORK!': '{s} 纽约！', 'ROAD CLEAR!': '路通了！',
    'NEW YORK CLEARED! ★': '走通纽约！★', 'DAY {d} BOSS BEATEN! {s}': '打败第 {d} 天的老板！{s}', 'CIGAR BOSS BEATEN': '打败雪茄老板',
    'Day {d} starts now, faster. Beat its boss for {s}.': '第 {d} 天开始了，更快。打败这一天的老板拿 {s}。',
    'Day {d} starts now: faster and smokier. How far can you go?': '第 {d} 天开始了：更快、烟更多。你能跑多远？',
    'POP!': '啪！', 'The fence blocks water. HOLD past it': '栅栏挡水。憋着气过去',
    'Nothing to spray': '没东西可滋', 'Empty!': '没水了！', 'Out of water! Refill in the shop-side lane': '没水了！到靠店面那条道补水',
    '{p}!': '{p}！',
    'MORE AIR': '气更长', 'FULL WATER': '水加满', 'QUICK FEET': '换道快', 'COIN MAGNET': '吸金币', 'SAVES 1 COUGH': '免呛一次',
    'FAST BREATH': '回气快', 'BIG PHEW': '呼更大', 'SLOW SMOG': '烟雾变慢',
    'ON BEAT!': '踩点！', 'Smokers puff on the beat. Dash past right after a puff': '烟民跟着节拍吐烟。刚吐完就冲过去',
    '*sniff* Fresh!': '*吸* 好清新！', 'FULL PARADE!': '游行满员！', 'I QUIT!': '我戒了！',
    'He quit! Runners with you make PHEW bigger': '他戒烟了！跟着你跑的人越多，「呼」越大',
    // 烟里冲刺（2026-11-17）
    'Tip: hold your breath and dive INTO the smoke. Inside it you go TURBO and leave the smog behind.': '提示：憋住气钻进烟里。在烟里会加速，把大烟雾甩在后面。',
    'Tip: people step aside, things don’t. Watch for benches, bins and fences in your lane.': '提示：人会让开，东西不会。留神你这条道上的长椅、垃圾桶和围栏。',
    'TURBO!': '加速！', 'TURBO! Holding your breath inside smoke makes you fast': '加速！憋着气钻进烟里，跑得飞快',
    'People step aside. Only things trip you': '人会让开，只有东西会绊倒你',
    'He puffed right at you! Hold your breath when you dash past smokers': '他一口烟正喷你脸上！从烟民旁边冲过去时要憋着气',
    'Tripped! Things trip you. Swipe toward the yellow arrow': '绊倒了！东西会绊你，往黄色箭头那边滑',
    'It’s inside the red zone now. Trip again and it gets you': '它已经在红区里了，再绊一下就被它抓住',
    'Tripped! The smog jumped closer. If it’s in the red zone, it gets you': '绊倒了！大烟雾扑近了一截。它在红区里时绊倒，就会被抓住',
    'RUN CLUB!': '健康跑！', 'Whistle: every smoker you run past quits and runs with you': '哨子：跑过的烟民都会戒烟，跟着你跑',
    'Rules: DASH · turbo in smoke, people step aside': '规则：冲刺 · 烟里加速，人会让开',
    '{how}: smoke can’t hurt you, for {s} s. Inside smoke you go TURBO.': '{how}：烟伤不到你，能撑 {s} 秒。在烟里憋气会加速。',
    'People step aside. Things (benches, bins, fences, scooters) trip you and it jumps closer; if it’s already that close, it gets you.': '人会让开。东西（长椅、垃圾桶、围栏、滑板车）会绊倒你，大烟雾就扑近一截；它本来就离那么近，就会抓住你。',
    'Wait up…': '等等我……', 'Nooo!': '不——！', 'Oof!': '哎哟！',
    'Blocked! Swipe toward the yellow arrow': '堵住了！往黄色箭头那边滑',
    'It’s right behind you now. Bump again and it gets you': '它就贴在你身后了。再撞一下就被追上',
    'Bumped! The smog jumped closer. Bump while you can see it and it gets you': '撞上了！大烟雾扑近了一截。看得见它时再撞，就被追上',
    'OUCH!': '好痛！', 'glug': '咕嘟',
    'SKATEBOARD!': '滑板！', 'Skateboard: hop over low stuff and people. HOLD in smoke': '滑板：跳过矮东西和人。进了烟照样要憋气',
    'LEAF BLOWER!': '吹叶机！', 'Leaf blower: blows the smoke back at them': '吹叶机：把烟吹回他们那边',
    'BUBBLE!': '泡泡罩！', 'Bubble: breathe freely inside it': '泡泡罩：罩里随便呼吸',
    'SUPER SOAKER!': '大水枪！', 'Super soaker: free water, fires by itself': '大水枪：不花水，自己连射',
    'HEAD START!': '开局滑板！', 'SIDESTEP!': '侧身！',
    'THE SMOG IS COMING!': '大烟雾来了！', 'HOLD YOUR BREATH!': '憋住气！', 'GO!': '跑！', 'YOUR TURN!': '轮到你了！',
    'HOLD the left side to hold your breath and sprint': '按住屏幕左边，憋气冲刺', 'Hold SPACE to hold your breath and sprint': '按住空格，憋气冲刺',
    'SECOND WIND!': '第二口气！', 'Second Wind used. Next catch ends the run': '第二口气用掉了。再被追上就结束',
    'FRESH!': '清新！', '+2 water': '+2 水', 'Scooter! Get out of the red lane': '滑板车！离开红色那条道',
    'Thick smoke! HOLD through, breathe at the AIR vent': '浓烟！憋着气过去，到换气格栅喘气', 'Thick smoke! Full breath, then HOLD through': '浓烟！先吸满气，再憋着气过去',
    'THICK SMOKE!': '浓烟！', 'AIR vent: let go here to breathe': '换气格栅：在这里松手喘气',
    'The smog is gaining! Hold your breath through smoke to blow it back': '大烟雾追上来了！憋着气穿过烟，把它吹回去',
    'The smog is gaining! HOLD to sprint': '大烟雾追上来了！按住冲刺', 'The smog is gaining! Hold SPACE to sprint': '大烟雾追上来了！按住空格冲刺',
    'Vapers puff on a beat. Go between puffs': '电子烟一阵一阵喷。趁两口之间过去',
    'Smoking area: no spraying. HOLD past it': '吸烟区：不能滋水。憋着气过去',
    'He paces. Pass where he just left': '他在来回踱步。从他刚走开的地方过',
    'The leash blocks two lanes. Take the third': '狗绳挡住两条道。走第三条',
    'Smoke rings! Tap to pop, or sprint through': '烟圈！点破它，或者冲过去',
    'Commuters are fast. Change lanes early': '通勤族走得快。早点换道',
    'White steam is harmless. Grey smoke isn’t': '白汽没事，灰烟有事',
    'Big slow puffs. Take a full breath first': '又大又慢的烟。先吸满气',
    'Air bubbles! Run into them for air': '空气泡泡！撞上去回气',
    'Run past the blue REFILL for water': '从蓝色的「补水」那里走过去补水',
    'TODAY’S BEST!': '今天最好！', 'CLOSE CALL!': '好险！',
    'Stalls! Run through one. It lasts all run': '摊位！穿过一个，整局有效',
    'All 3 missions done!': '三个任务都完成了！', '★ DAILY GOAL': '★ 每日目标', 'Run {m} m today': '今天跑 {m} 米',
    '{d} / {m} m · +{c} coins': '{d} / {m} 米 · +{c} 金币', 'All daily goals done!': '每日目标都完成了！', 'Coins at the end of the run': '这局结束时发金币',
    '★ Daily goal: {m} m! +{c} coins at the end': '★ 每日目标：{m} 米！结束时 +{c} 金币',
    'Red on your ring: not enough air for this smoke. Breathe first!': '气圈上有红色：这段烟气不够。先喘口气！',
    'The white mark on your ring: air this smoke needs': '气圈上的白线：过这段烟要用的气',

    // ---------- 怎么玩 ----------
    'Hold your breath': '憋气', 'Hold the left side of the screen': '按住屏幕左边', 'Hold SPACE': '按住空格',
    '{how}: smoke can’t hurt you and you sprint, for {s} s.': '{how}：烟伤不到你，还会冲刺，能憋 {s} 秒。',
    '{how}: smoke can’t hurt you, for {s} s.': '{how}：烟伤不到你，能憋 {s} 秒。',
    'Let go in clean air': '到干净空气里松手',
    'Air comes back outside the smoke or on an AIR grate. Let go right as you clear the smoke: PERFECT!': '出了烟，或者站在换气格栅上，气就回来。刚出烟就松手：完美！',
    'Stay ahead of the Big Smog': '别被大烟雾追上',
    'Bump into things and it jumps closer; bump while you can see it and it gets you. ': '撞到东西它就扑近一截；看得见它时再撞，就被追上。',
    'Hold your breath through smoke to blow it back.': '憋着气穿过烟，把它吹回去。',
    'Pass close to smokers on one breath to blow it back.': '一口气贴着烟民冲过去，把它吹回去。',
    'Swipe up or down': '上下滑', 'Press ↑ or ↓': '按 ↑ 或 ↓', 'Change lanes, one lane at a time.': '换道，一次换一条。',
    'Tap a smoker': '点烟民', 'Click a smoker': '点烟民',
    'Spray the cigarette out, or punch a hole in a cloud. Hit the glowing ring for a free shot.': '把烟头滋灭，或者在烟里打个洞。点中发光的小圈，这一发不花水。',

    // ---------- 画面上的字（render.js） ----------
    'SCOOTER!': '滑板车！', 'TAP': '点', 'TAP!': '点！', '{s}s': '{s}秒', 'SWIPE': '滑', 'REFILL': '补水', '▲ AIR ▲': '▲ 换气 ▲',
    'SMOKING AREA': '吸烟区', 'BEST': '最好', '{n} m': '{n} 米', 'WATER': '水',
    'TAP THE EMBER!': '点火星！', 'TAP THE FLAME!': '点火苗！', 'POP THE RINGS!': '点破烟圈！', 'GET OUT OF THE RED LANES!': '离开红色的道！', 'NICE HIT! GET READY…': '打得好！准备……',
    'Hold SPACE = hold your breath and sprint  ·  ↑ ↓ lanes  ·  click a cigarette': '按住空格 = 憋气冲刺  ·  ↑ ↓ 换道  ·  点烟头滋水',
    'GASP!': '喘！', 'HOLDING': '憋着', 'HOLD': '按住',
    'catching your breath': '正在大喘气', 'let go in clean air': '出了烟再松手', 'to start': '开始', 'your breath': '憋气',
    'SWIPE  ↑ ↓  change lanes': '上下滑  换道', 'TAP  a cigarette': '点烟头  滋水',
    '★ MISSION': '★ 任务', 'RANK UP AT THE END OF THIS RUN': '这局结束就升级',
    // 第三轮（2026-11-21）：商店「已购买」一栏、结算页看广告按钮、每日连签（不用 emoji 了）
    'Purchased': '已购买', 'Ad ×{n}': '看广告 ×{n}', '{n}-day streak': '连续 {n} 天',
    // 窗口统一和开奖（2026-11-21，docs/33）
    'Collect': '收下', 'Thanks, boss!': '谢啦老板！', 'Let’s go!': '冲啊！', 'Woo-hoo!': '耶——！', 'Best day ever!': '今天太棒了！', 'Thank you!': '谢谢你！',
    'Coins delivered!': '金币到账！', 'Enough for {x}': '够买{x}', 'Enough for {n} things, incl. {x}': '够买 {n} 样，包括{x}',
    'Every coin ×2!': '每个金币 ×2！', 'From now on, every coin you pick up counts twice. Forever.': '从现在起，捡到的每个金币都算两个。永久有效。',
    'No more ads!': '广告没了！', 'No ads between runs, ever. Thank you for supporting a tiny team!': '两局之间再也不插广告。谢谢你支持我们这个小团队！',
    'On! Every coin counts twice.': '已开启！每个金币都算两个。', 'POPULAR': '最受欢迎', 'Buys {n} things': '够买 {n} 样', 'Buys 1 thing': '够买 1 样',
    '{n} more videos today': '今天还能看 {n} 次', '{n} more video today': '今天还能看 {n} 次', 'That’s all for today. Back tomorrow!': '今天的看完了，明天再来！',
    'Afterwards you pick one item for free.': '看完这一次随便挑一件，免费。', 'Afterwards you wear this hat for 3 runs.': '看完先戴这顶帽子跑 3 局。',
    'All three done:': '三个都做完：', 'rank {n}': '升到 {n} 级', 'Every rank: +5% coins per run (up to +25%). Stuck? ↻ swaps one.': '每升一级，每局金币多 5%（最多 25%）。做不到？点 ↻ 换一个。',
    'Shop': '商店', 'Mission reward': '任务奖励', 'Daily gift': '签到礼物', 'Boss reward': '打老板奖励', 'TRY ON': '试戴',
    'Trying it on · {n} runs left': '试戴中 · 还剩 {n} 局', 'Trying it on · last run': '试戴中 · 最后一局', '{n} to go · Get coins': '还差 {n} · 去拿金币', '▶︎ Try it for {n} runs': '▶︎ 看广告先戴 {n} 局',
    'New hat!': '新帽子！', 'You’re wearing it. Looking sharp!': '已经戴上了，真帅！', 'Hat trial over: {h}': '{h}试戴结束',
    'Claim ×{n}': '领 ×{n}', 'ad ×{v} +{n}': '广告 ×{v} +{n}', 'Lucky ×{n}!': '幸运 ×{n}！', '▶︎ Watch ad · keep running': '▶︎ 看广告 · 接着跑',
    'Pick any one, free. It lasts one run.': '随便挑一件，免费，管这一局。', '▶︎ Watch ad · pick one free': '▶︎ 看广告 · 免费挑一件',
    'Pick gear': '选装备', 'Music': '音乐', 'Sound effects': '音效', 'Vibration': '震动', 'Daily reminder': '每日提醒'
  };

  const LANGS = [['en', 'English'], ['zh', '中文']];
  const DICT = { zh: ZH };
  const known = l => LANGS.some(x => x[0] === l);
  function pick() {
    const saved = store.get('hyb-lang');
    if (known(saved)) return saved;
    const sys = window.hybSysLang || (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return /^zh/i.test(sys) ? 'zh' : 'en';
  }
  H.LANGS = LANGS;
  H.lang = pick();
  const miss = new Set();
  // 「场合|英文」：英文时显示「|」后面那段
  H.L = (s, v) => {
    if (s == null || s === '') return '';
    const D = DICT[H.lang];
    let o = D ? D[s] : null;
    if (o == null) { if (D && !miss.has(s)) miss.add(s); const i = s.indexOf('|'); o = i > 0 && !s.includes(' |') ? s.slice(i + 1) : s; }
    if (v) o = o.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
    return o;
  };
  H.L.miss = miss;
  // 页面上写死的字换一遍。第一次换时把英文原句记在 data-t / data-ta 里
  H.applyStatic = () => {
    document.documentElement.lang = H.lang === 'zh' ? 'zh-Hans' : 'en';
    for (const el of document.querySelectorAll('[data-t]')) { if (!el.dataset.t) el.dataset.t = el.textContent; el.textContent = H.L(el.dataset.t); }
    for (const el of document.querySelectorAll('[data-ta]')) { if (!el.dataset.ta) el.dataset.ta = el.getAttribute('aria-label') || ''; el.setAttribute('aria-label', H.L(el.dataset.ta)); }
  };
  H.setLang = l => { if (!known(l)) return; H.lang = l; store.set('hyb-lang', l); H.applyStatic(); };
  // 下一种语言（现在只有两种：英文 ↔ 中文）
  H.nextLang = () => LANGS[(LANGS.findIndex(x => x[0] === H.lang) + 1) % LANGS.length][0];
  H.langName = l => (LANGS.find(x => x[0] === (l || H.lang)) || LANGS[0])[1];
  H.locale = () => (H.lang === 'zh' ? 'zh-CN' : 'en-US');

  /* 两行字挑断点（顶上的提示、被追上时大烟雾的那句话）：英文只在空格处断；中文每两个字之间都能断，
   * 但「，。！？」这些不放在行首，「（「」不放在行尾。返回所有能断的 [第一行, 第二行] */
  const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;
  const NO_START = /^[，。！？、：；）」』…—,.!?:;)\]]/, NO_END = /[（「『(]$/;
  H.splits = s => {
    const tk = s.match(/[⺀-鿿豈-﫿＀-￯　-〿]|\s+|[^\s⺀-鿿豈-﫿＀-￯　-〿]+/g) || [s], out = [];
    const solid = (i, d) => { while (tk[i] && /^\s+$/.test(tk[i])) i += d; return tk[i] || ''; };
    for (let i = 1; i < tk.length; i++) {
      const a = tk[i - 1], b = tk[i];
      // 数字和后面的单位不分开（「300 米」「20 秒」）
      if (/\d$/.test(solid(i - 1, -1)) && CJK.test(solid(i, 1))) continue;
      const ok = /^\s/.test(b) || /\s$/.test(a) || ((CJK.test(a) || CJK.test(b)) && !NO_START.test(b) && !NO_END.test(a));
      if (ok) { const x = tk.slice(0, i).join('').trim(), y = tk.slice(i).join('').trim(); if (x && y) out.push([x, y]); }
    }
    return out;
  };
})();
