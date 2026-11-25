/* 环球躲烟 · 核心逻辑（侧视角，纯逻辑，不碰画面）
 * 「一口气」：主角从左往右自动走，按住憋气就是冲刺；身后有一团大烟雾在追，被追上这一局就结束。
 * 街区一个接一个往前生成（人行道、写字楼、公园、屋顶、地铁，然后进入第二天）。
 * 人行道有三条道：0 靠店面（远）、1 中间、2 靠马路（近）。
 * 世界坐标：x 向右为正；z 是道（可以是小数，换道时连续变化）；h 是离地高度。
 * 浏览器里挂在 window.HYB 上；Node 里 require 后挂在 globalThis.HYB 上，自动试玩脚本也用这一份。
 */
(function (root) {
  'use strict';
  const HYB = root.HYB = root.HYB || {};

  /* ---------- 常量 ---------- */
  const W = 400, ZOOM = 1.4, VW = W / ZOOM, PX = 66, LD = 46, DZ = 50, HEAD = 44, PW = 10;   // 镜头拉近：屏幕上能看到 VW 宽的世界；主角屏幕位置、每条道的纵深、头高、主角半宽
  const CFG = {
    // 气：只在干净空气里回，约 1 秒回满；憋住时越憋越快
    // REGEN / REGEN_WAIT / BUMP_T 由下面的 BREATH_MODES 决定（默认 b），这里的数只是起始值
    RAIN_LIFE: .72,      // 雨天烟散得快：每一团烟只活平时的七成多（第 4 天起的雨天，见 phaseOf）
    // 金币重新设计（2026-11-21，docs/32）：原来一般玩家一周就把东西全买完，金币包不值钱。路上的金币从六成降到三成五，憋气入账奖励最多 36 → 9
    COIN_KEEP: .35,      // 每串金币只摆原来的三成五（见 builder.coins）
    BANK_COINS: 9,       // 一口气入账最多奖励几枚金币
    DAWN_REGEN: 1.3, DUSK_COINS: 2, NIGHT_SMOG: 1.04,      // 每种天一条规则（phaseOf）：黎明回气快三成、傍晚金币算两个、夜里大烟雾快 4%（1.08 时第 3 天一进夜里高手就撞墙，40 局中位从 370 秒掉到 305 秒）；第 1 天白天没有（2026-11-16）。第 3 天的夜里不快（2026-11-21，见 stepSmog）
    PERFECT_T: .3, PERFECT_X: 1.5,      // 冲出烟以后多久之内松手算 PERFECT，这一口吹退大烟雾多几倍（潜水规则）
    BREATH: 4.5, REGEN: 3, REGEN_WAIT: .3, GASP_T: 1, GASP_X: 2.5, GASP_SLOW: .6, BOOST0: 1.25, BOOST1: 1.7, BOOST_T: 3,
    // 走路速度随距离上升
    V0: 118, V1: 172, V_DIST: 26000,
    // 大烟雾：起步距离、最多能甩开多远、它比你走路快多少（随距离上升）
    GAP0: 230, GAP_MAX: 260, SMOG_K0: 1.03, SMOG_K1: 1.5, SMOG_FROM: 1500, SMOG_DIST: 40000,
    // 呛到：吸进这么多烟就咳一下，踉跄、被追近一截，之后短暂免疫
    // 呛到、气用光是最要命的（docs/22 的 A）：大烟雾趁机扑近一大截。原来呛一下只扑 25，撞上才是主要死法
    COUGH_AT: 5, COUGH_STUN: .5, COUGH_LUNGE: 55, GASP_LUNGE: 40, COUGH_INV: 1.5, BANK_PUSH: 8,
    BUMP_LUNGE: 70, CATCH_GAP: 120, TRIP_INV: 1.5, NEAR_Z: 1.3,      // 撞上（docs/24）：大烟雾往前扑多少；它已经在这么近（画面上看得见）时撞上就被追上；撞后几秒不再算；连冲只算隔着不到这么多条道冲过去的
    PARADE_MAX: 8, PARADE_PUSH: .08,      // 戒烟大游行（docs/22 的 B）：最多跟几个人；每跟一个，PHEW 吹得远多少
    // 烟里冲刺（dash 规则，docs/27）：干净空气里憋气只快一点（DASH_AIR 倍），在烟里憋气是大加速：烟浓到 TURBO_D 就是满的 DASH_AIR + DASH_SMOKE 倍；
    // 健康跑哨子吹几秒（这几秒里冲过去的烟民都戒烟跟上来）
    DASH_AIR: 1.15, DASH_SMOKE: .65, TURBO_D: .45, WHISTLE_T: 8,
    SMELL: 24, DMIN: .07, DCAP: 1.6,
    WATER: 4, SHOT_CD: .3, RANGE: 290, DROP_V: 760, BULL_AIR: .8, STEAM_R: 64, REFILL_V: 6,
    LANE_T: .15, BUMP_T: .35, STUN_T: .7,
    B_PUSH: 60, B_MIN: .3,      // 憋气版：在烟里每憋 1 秒，出来松手把大烟雾吹回去多少；少于 B_MIN 秒不算一口
    TR_R: 40, TR_LIFE: 4.6, TR_A: .32, EX_R: 68, EX_LIFE: 4, EX_A: .48, EX_TELE: .6, EX_EVERY: 2.4,
    VAPE_EVERY: 2.8, VAPE_TELE: .8, VAPE_R: 82, VAPE_LIFE: 2, VAPE_A: .62,
    WALK_V: 44, AHEAD_V: 58, PED_V: 52, SCOOT_V: 330, BOSS_HP: 3,
    COIN_R: 18, RING_V: 82, RING_LIFE: 3.6, RED_T: 5, GREEN_T: 3, FLASH_T: 1.1, BUBBLE_AIR: 1.1,
    POWER_T: 5, POWER_UP: 1, SKATE_V: 1.85,    // 道具持续几秒；「道具时长」每升一级四种道具一起多几秒；滑板快多少
    SKATE_SEE: .55, SKATE_COUGH: .8,            // 滑板到跟前前几秒，人就听见轮子声让开；在滑板上呛到还能往前溜多快（相对走路）
    // 局外升级（2026-11-14 重做，见 docs/12）：每一级都要一上手就感觉得到
    LUNG_UP: .5, LUNG_REGEN: .2,                // 肺活量每升一级：气多几秒，回气快几成
    HEAD: [3, 5, 8],                            // 开局滑板：每局一开始踩着滑板冲几秒（第 1、2、3 级）
    DODGE: [20, 12, 6],                         // 侧身：撞上东西时自己闪到旁边那条道，多少秒能用一次（第 1、2、3 级）
    M: 25, DISTRICT: 9, DAY1: 7,   // 多少个单位算 1 米；每个街区最多几段遭遇；第一天每个街区短一些，让雪茄老板早点到
    // 路上的东西（docs/35，试验，默认关）。提议版：CFG='{"ROAD":1,"REST":70,"V_DAY":0.12}'
    //   ROAD 1 打开；ROAD_N 第 1、2、3、4 天起每个街区在干净空气里插几段只有东西的排法；ROAD_GAP 绕桩两样东西隔多远；
    //   ROAD_SMOKE 浓烟段、之字路里放东西；STEADY 侧身改成「撞了扑得少」每级少扑多少（试过，太强，留 0）；
    //   REST 大烟雾自己最多追到离你多远（70 = 顶栏红区的边）；V_DAY 第 4 天起每天走路快多少
    ROAD: 0, ROAD_N: [0, 1, 1, 2], ROAD_GAP: 170, ROAD_SMOKE: 1, STEADY: 0, REST: 0, V_DAY: 0,
    // 烟就是赛道（docs/35 第二版，试验）：COURSE 1 打开。COURSE_N 第 1、2、3、4 天起每个街区几段烟（浓烟段、之字路轮流）；
    // COURSE_HOLD 浓烟段按满速冲刺要憋多久，算成「基础气量」的几成（升级加的气不算进去，升了就是更从容）；TURBO_LOOK 冲刺时镜头往前推多少
    // 第 4 天起浓烟段比一口气还长（1.1、1.3、1.5），一定要在 AIR 格栅换气；干净空气里的东西也一天比一天多（打开时用 COURSE_ON 里的 ROAD_N）
    COURSE: 0, COURSE_N: [2, 3, 4, 4], COURSE_HOLD: [.6, .75, .9, 1.1, 1.3, 1.5], TURBO_LOOK: 0,
    CAM_BACK: 44                // 大烟雾贴到身后时，镜头最多往后拉多少（拉多了前面的路就看不见了）
  };
  /* 「气」的两个版本（2026-11-13 第三次试玩报告：原来 1 秒就回满，大烟雾主要在惩罚撞车，不是气不够）。
   *   a：原来的。松手立刻回，约 1 秒回满；撞一下停 0.45 秒。
   *   b：现在默认。回气慢三成、松手后先喘 0.3 秒才开始回，冲刺要省着用；撞一下只停 0.35 秒，难度大致抵回来。
   * 机器人 40 局中位数（连同第一天地铁、屋顶不以 wall 收尾一起算）：a 高手 235 秒 / 普通 147 秒；b 高手 206 秒 / 普通 140 秒。
   * 机器人从来不会把气用光，所以这里量到的主要是「冲刺要等气回来」；真人憋到见底的情况 b 会更明显。测试者模式的暂停菜单里能切换 */
  const BREATH_MODES = { a: { REGEN: 4.2, REGEN_WAIT: 0, BUMP_T: .45 }, b: { REGEN: 3, REGEN_WAIT: .3, BUMP_T: .35 } };
  function setBreath(k) { k = BREATH_MODES[k] ? k : 'b'; Object.assign(CFG, BREATH_MODES[k]); HYB.breathMode = k; return k; }
  /* 两套规则（2026-11-15，「真的去潜水」）。起因：机器人量出来气从来不紧（路上最长一段烟不到 1.4 秒，气有 4.5 秒）、
   * 连冲入账几乎不吹退大烟雾（8 × 连冲数）、大烟雾的速度涨到 1.5 倍，高手怎么玩都在 1300 米上下被追上。
   *   classic：原来的。
   *   dive：现在默认。路上有成段的浓烟（ENC.haze），中间夹着能换气的 AIR 格栅；松手入账按连冲数的平方吹退大烟雾，
   *         最远能甩开 480；大烟雾在 1660 米涨到走路的 1.3 倍（原来 1.5），之后每 1000 米再快 0.1 倍。
   *         憋气冲刺加回气平均最多约 1.4 倍，所以墙从 1300 米左右挪到 2800 米左右，在那之前被追上多半是自己失误。
   *         机器人（各 12 局）：高手中位 2363 米 / 352 秒（原来 1384 米 / 207 秒），普通玩家 1096 米 / 186 秒（原来 867 米 / 143 秒）。
   *         测试者模式的暂停菜单里能切换 */
  /* 憋气版（breath，2026-11-16，测试者模式的暂停菜单里切换，见 docs/23）：用户玩下来说「本质上还是躲避游戏，憋气只是加速键」。
   * 这一版憋气不加速（BOOST 1），要甩开大烟雾只能钻进烟里憋着：在烟里憋了几秒，出来松手就把它吹回去几秒那么远（B_PUSH）。
   * 烟一段接一段罩住整条街（districtSeq），躲是躲不开的，要算的是「吸满没有、这口够不够、什么时候松」 */
  // PUSH2 10 → 16（docs/24）：连冲只算贴身冲过去的以后，一口气冲过的人少了一半，PHEW 吹得远一点补回来
  const RULES = { classic: { SMOG_K1: 1.5, SMOG_CREEP: 0, GAP_MAX: 260, PUSH2: 0, BOOST0: 1.25, BOOST1: 1.7 }, dive: { SMOG_K1: 1.3, SMOG_CREEP: .1, GAP_MAX: 480, PUSH2: 16, BOOST0: 1.25, BOOST1: 1.7 },
    breath: { SMOG_K1: 1.25, SMOG_CREEP: .1, GAP_MAX: 480, PUSH2: 10, BOOST0: 1, BOOST1: 1, B_PUSH: 80 },
    // 烟里冲刺（2026-11-17，docs/27）：用户说憋气在烟里加速「有爽感」，撞上会不会死判断不了。现在默认。
    // 憋气的加速看你在不在烟里（stepPlayer），人不挡路（blockers），撞东西只有一种结果（mistake），拉人跑靠健康跑哨子（POWERS 的 whistle）
    dash: { SMOG_K1: 1.3, SMOG_CREEP: .1, GAP_MAX: 480, PUSH2: 16, BOOST0: 1.15, BOOST1: 1.15 } };      // 1.3 时高手全死在第二天（没有冲刺，只能靠吹）；1.25：高手 381 秒，七成到第三天
  // 2026-11-16 试过让后面更难（高手机器人一局 375 秒、四分之一超过 7 分钟，比 docs/22 定的 330 秒长），都没留下：
  //   SMOG_K1 1.38：普通玩家的下四分位从 171 秒掉到 97 秒，第一天屋顶就死了 9 局，开头变难了；
  //   SMOG_CREEP .25：高手 336 秒，可 40 局里一次都没打过第三天的老板（原来 8 次），纽约第三颗星和皇冠帽子几乎拿不到。
  // 会玩的人跑得久一点，算奖励
  // 一局四分钟，再来一局的冲动就淡了。1.38：高手 319、普通玩家 182、新手 100、像真人 199 秒
  /* 烟就是赛道（docs/35 第二版，试验）：一次打开或关掉这一套。关掉就是 1.0.1 的样子 */
  const COURSE_OFF = {}, COURSE_ON = { COURSE: 1, ROAD: 1, ROAD_SMOKE: 0, ROAD_N: [0, 1, 2, 3, 4, 5], REST: 70, V_DAY: .15, TURBO_LOOK: 30 };
  for (const k in COURSE_ON) COURSE_OFF[k] = CFG[k];
  function setCourse(on) { Object.assign(CFG, on ? COURSE_ON : COURSE_OFF); HYB.course = !!on; return !!on; }
  function setRules(k) { k = RULES[k] ? k : 'dash'; Object.assign(CFG, RULES[k]); HYB.rules = k; return k; }
  // 装备：开跑前三选一，整局生效。每件只改一条规则，让这一局的打法不一样。text 是选的时候看的整句，tag 是地方小的时候用的短说法
  const GEAR = {
    lungs: { name: 'Big Lungs', tag: '+1.5 s of breath', text: 'Hold your breath 1.5 seconds longer', set: k => { k.breath += 1.5; } },
    /* 第三次试玩报告：水箱和口罩几乎没区别（4 发水通常够用，机器人很少呛到），冲刺鞋对高手太强、对普通玩家太快看不清。
     * 改成每件都有一个一上手就感觉得到的变化：水箱一发化掉一大片烟、口罩在薄烟里照样喘气回气、冲刺鞋换道变快 */
    tank: { name: 'Water Tank', tag: 'big splash, +2 shots', text: 'Every shot splashes wider. Plus 2 shots', set: k => { k.water += 2; k.splash = 2; k.refill = 1.5; } },
    shoes: { name: 'Sprint Shoes', tag: 'quick feet', text: 'Quicker lane switches, faster sprint', set: k => { k.sprint = 1.05; k.laneT = .55; } },
    mask: { name: 'Face Mask', tag: 'breathe in thin smoke', text: 'Breathe freely in thin smoke', set: k => { k.dmin = .35; } },
    magnet: { name: 'Coin Magnet', tag: 'coins fly to you', text: 'Coins fly to you from every lane', set: k => { k.magnet = true; } },
    exhale: { name: 'Big Exhale', tag: 'combos push the smog twice as far', text: 'Combos blow the smog twice as far', set: k => { k.bank = 2; } },
    wind: { name: 'Second Wind', tag: 'one free escape from the smog', text: 'Escape the smog once when it catches you', set: k => { k.revive = 1; } }
  };
  // 每种人：烟头、嘴相对脚底的位置 [x, 高度]，命中点 [x, 高度, 半径]，挡路半宽
  const BODY = {
    stand: { cig: [-15, 12], mouth: [2, 42], hit: [0, 26, 22], half: 13 },
    walk: { cig: [4, 41], mouth: [4, 41], hit: [0, 28, 22], half: 13 },
    ahead: { cig: [4, 41], mouth: [4, 41], hit: [0, 28, 22], half: 13 },
    vape: { cig: [13, 22], mouth: [2, 44], hit: [0, 28, 22], half: 13 },
    scooter: { cig: [13, 24], mouth: [0, 44], hit: [0, 30, 26], half: 18 },
    boss: { cig: [-21, 22], mouth: [-13, 43], hit: [0, 36, 32], half: 22 },
    terrace: { cig: [-11, 21], cig2: [11, 21.5], mouth: [0, 24], hit: [0, 22, 30], half: 0 }      // 两根烟的烟头：按第十一批那桌食客的图量的
  };

  // 侧面走路的两种烟民：卫衣耳机男烟在嘴边，上班族夹在手里垂在腰边（素材朝左，同方向走的人水平翻转）
  const LOOKS = { hoodie: { cig: [-14, 33], mouth: [-8, 35] }, office: { cig: [-15, 19], mouth: [-9, 36] } };
  // 第四批的长相：烟头和嘴的位置直接从素材清单里读（图里的人朝左）。每个街区第一天只多认识一种新面孔，第二天起再加老太太和厨师
  const STAND_SHEET = { office: 'office-side-stand', hoodie: 'hoodie-side-stand', granny: 'granny-side-stand', ring: 'ring-side-stand', chef: 'chef-side-sit', dogwalker: 'dogwalker-side-stand', phone: 'phone-side-walk' };
  const STAND_POOL = { sidewalk: ['office', 'hoodie'], office: ['office', 'hoodie', 'phone', 'phone'], park: ['hoodie', 'office', 'dogwalker', 'dogwalker'], rooftop: ['ring', 'ring', 'hoodie', 'office'], subway: ['office', 'hoodie', 'ring'] };
  const STAND_LATER = { sidewalk: ['granny', 'dogwalker'], office: ['chef'], park: ['granny', 'granny'], rooftop: ['chef'], subway: ['chef', 'granny'] };
  const WALK_POOL = { sidewalk: ['hoodie', 'office'], office: ['hoodie', 'office'], park: ['hoodie', 'office'], rooftop: ['hoodie', 'office'], subway: ['hoodie', 'office', 'commuter', 'commuter'] };
  function lookPts(sheet) {
    const M = HYB.MANIFEST, S = M && M.sheets[sheet];
    if (!S || !S.cig) return null;
    const u = M.unit / M.k, c = S.cig[0], m = (S.mouth || S.cig)[0];
    return { cig: [c[0] * u, -c[1] * u], mouth: [m[0] * u, -m[1] * u] };
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function rngOf(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- 终点建筑：门相对建筑中心的位置 ---------- */
  const DESTS = { 'dest-coffee': 40, 'dest-office': 2, 'dest-cart': 0, 'dest-terrace': -6, 'dest-subway': 12 };

  /* ---------- 五站 ----------
   * seq：按顺序摆放的遭遇；数组表示从里面随机挑一个。speed：自动行走速度。target：第三颗星的里程线。
   */
  const STOPS = [
    { id: 'sidewalk', name: 'Sidewalk stroll', dest: 'the coffee shop', destProp: 'dest-coffee', ground: 'sidewalk', street: 'shops', speed: 118, target: 2200, postcard: 1,
      goal: { id: 'clean', need: 8, text: 'Get past 8 smokers without a whiff' },
      tip: 'Hold your breath and you hurry through. Pass smokers without a whiff to multiply your points.',
      seq: ['calm', 'door', 'walker', 'pair', ['bench', 'ahead'], 'fountain', 'gauntlet', 'vape', ['door', 'walker'], 'wall', 'ahead'] },
    { id: 'office', name: 'Office doors', dest: 'the office lobby', destProp: 'dest-office', ground: 'sidewalk', street: 'shops', speed: 124, target: 3400, postcard: 2,
      goal: { id: 'far', need: 3, text: 'Put out 3 cigarettes from far away' },
      tip: 'Spray early. Get too close and they blow one last puff in your face.',
      seq: ['door', 'office', ['pair', 'bench'], 'gauntlet', 'cross', 'fountain', 'shelter', 'wall', 'office', 'ahead', 'scooter'] },
    { id: 'park', name: 'Park escape', dest: 'the hot dog cart', destProp: 'dest-cart', ground: 'park', street: 'park', speed: 126, target: 2300, postcard: 3,
      goal: { id: 'bubbles', need: 12, text: 'Pop 12 fresh-air bubbles' },
      tip: 'Kids are blowing bubbles. Walk into them to catch your breath.',
      seq: ['bubbles', 'vape', 'gauntlet', 'fountain', 'circle', 'bubbles', 'scooter', 'pair', 'walker', 'bubbles', 'wall', 'vape'] },
    { id: 'rooftop', name: 'Rooftop garden', dest: 'the rooftop garden', destProp: 'dest-terrace', ground: 'rooftop', street: 'roof', speed: 130, target: 2000, postcard: 4,
      goal: { id: 'zones', need: 2, text: 'Pass 2 smoking areas without a whiff' },
      tip: 'Smoking areas are allowed, and your water can’t reach past the fence. Slip past or hold.',
      seq: ['zone', 'vape', 'gauntlet', 'zone', 'fountain', 'crowd', 'vape', 'wall', 'zone'] },      // 第一天不以三道全堵的 wall 收尾，见地铁
    { id: 'subway', name: 'Subway rush', dest: 'the subway', destProp: 'dest-subway', ground: 'sidewalk', street: 'shops', speed: 134, target: 4400, postcard: 5, boss: true,
      goal: { id: 'boss', need: 1, text: 'Beat the cigar boss without a whiff' },
      tip: 'Rush hour, and the cigar boss guards the stairs. Spray him only while he winds up or coughs.',
      // 第一天只用前 7 段。三道全堵的 wall 原来排在老板战正前方，那时大烟雾是这一天最快的时候，撞一下就被追上
      // （第三次试玩：普通玩家 20 局里 6 局死在这一处）。第一天换成门口站着一个，wall 留到第二天起洗牌后再出
      seq: ['cross', 'crowd', 'gauntlet', 'vents', 'fountain', 'shelter', 'door', 'circle', 'wall', 'cross', 'vents'] }
  ];

  /* ---------- 遭遇 ----------
   * 每段用 b.* 摆东西，dx 是距本段起点的距离。lane 0/1/2。
   * 任何位置至少留一条道没有固定障碍；烟民会挡路，但撞上后他会骂一句、吐你一脸，然后让开。
   */
  const rl = r => (r() * 3) | 0;
  // 路上的东西按道挑（docs/35）：靠店那条道放花坛、长椅，中间放垃圾桶、花坛，马路牙子边放消防栓、垃圾桶。
  // 施工路障、自行车架原来是 11-12 的早期图，描边粗了快一半（用户 11-21 指出），第二十四批照第十一批的画法重画了（docs/36），加回来
  const ROAD_PROPS = [['bike-rack', 'planter', 'bench'], ['barricade', 'trash-can', 'planter'], ['barricade', 'hydrant', 'trash-can']];
  const roadProp = (lane, r) => { const L = ROAD_PROPS[lane]; return L[(r() * L.length) | 0]; };
  const ENC = {
    calm: { len: 320, f(b, r) {
      const a = rl(r), c = (a + 1 + ((r() * 2) | 0)) % 3;
      b.coins(a, 20, 140); b.coins(c, 200, 300);
      if (r() < .7) b.birds(rl(r), 170);
    } },
    // flip：这一段整个左右对调（道 0 ↔ 道 2），见 extend。原来这几段站位是写死的，第一天每局一模一样（2026-11-21）
    door: { len: 380, flip: true, f(b, r) {           // 店门口站着一个，朝你吐烟（对调时站在马路牙子边）
      b.smoker('stand', 0, 220);
      const can = r() < .6;
      if (can) b.prop('trash-can', 2, 250);
      b.coins(1, 60, 200); b.coins(can ? 1 : 2, 270, 350);
    } },
    walker: { len: 420, f(b, r) {         // 迎面走来，身后拖着一条烟
      const l = rl(r);
      b.smoker('walk', l, 420);
      b.coins(l, 40, 220);
    } },
    ahead: { len: 500, f(b, r) {          // 同方向慢慢走的人，烟往后飘到你脸上
      const l = rl(r);
      b.smoker('ahead', l, 150);
      b.prop(l === 2 ? 'hydrant' : 'trash-can', l === 1 ? (r() < .5 ? 0 : 2) : 1, 330);
      b.coins(l, 60, 400, 40);
    } },
    pair: { len: 420, flip: true, f(b, r) {           // 两边各一个，中间那条道两头夹击
      b.smoker('stand', 0, 200); b.smoker('stand', 2, 260);
      b.coins(1, 80, 340, 34);
    } },
    bench: { len: 440, f(b, r) {          // 长椅和花箱把路收窄，窄口后面站着一个
      const side = r() < .5 ? 0 : 2;
      b.prop('bench', side, 110); b.prop('planter', 2 - side, 150);
      b.smoker('stand', 1, 320);
      b.coins(1, 50, 210);
      b.pick('bottle', side, 340);
    } },
    vape: { len: 400, f(b, r) {           // 电子烟按节拍喷一大团，看准空档过去
      const l = r() < .5 ? 0 : 2;
      b.smoker('vape', l, 250, { vt: .6 + r() * 1.6 });
      b.coins(1, 100, 360, 32);
    } },
    fountain: { len: 320, f(b, r) {       // 饮水台：贴着店面那条道走过去就补满水
      b.refill(130);
      b.pick('mint', 1 + ((r() * 2) | 0), 230);
      b.coins(0, 30, 110, 30);
      b.birds(2, 200);
    } },
    gauntlet: { len: 460, f(b, r) {       // 三个人错开站在三条道上，烟连成一片，只能边换道边憋
      const o = [0, 1, 2].sort(() => r() - .5);
      b.smoker('stand', o[0], 150); b.smoker('stand', o[1], 240); b.smoker(r() < .5 ? 'vape' : 'stand', o[2], 330, { vt: 1 + r() });
      b.coins(o[2], 60, 200); b.pick('mint', o[0], 400);
    } },
    wall: { len: 440, f(b, r) {           // 两个人加一个障碍，三条道同一个位置全占：滋一个，或者憋着挤过去
      const pl = rl(r), a = (pl + 1) % 3, c2 = (pl + 2) % 3;
      b.prop(pl === 1 ? 'trash-can' : 'planter', pl, 260);
      b.smoker('stand', a, 250); b.smoker('stand', c2, 270);
      b.coins(a, 80, 200); b.pick('bottle', pl, 120);
    } },
    office: { len: 500, flip: true, f(b, r) {         // 写字楼门口一伙人，三条道都被占了：要么滋，要么挤
      b.smoker('stand', 0, 210); b.smoker('stand', 0, 262); b.smoker('stand', 1, 236);
      b.prop('planter', 2, 240);
      b.coins(2, 40, 180); b.coins(1, 300, 440);
      b.pick('bottle', 1, 120);
    } },
    shelter: { len: 520, f(b, r) {        // 公交候车亭：棚下没风，烟散不掉
      b.shelter(150, 200);
      b.smoker('stand', 0, 200); b.smoker('stand', 1, 300);
      b.prop('trash-can', 2, 250);
      b.coins(2, 50, 220);
    } },
    scooter: { len: 400, f(b, r) {        // 滑板车逆行冲过来，拖一条烟
      const l = rl(r);
      b.scooter(l, 40);
      b.coins(l, 120, 300, 30);
      b.smoker('stand', (l + 1 + ((r() * 2) | 0)) % 3, 340);
    } },
    circle: { len: 460, flip: true, f(b, r) {         // 一圈人围着抽，烟连成一片
      b.smoker('stand', 0, 230); b.smoker('stand', 1, 205); b.smoker('stand', 1, 262);
      b.prop(b.flip ? 'trash-can' : 'hydrant', 2, 110);      // 对调到靠店那条道时换成垃圾桶：消防栓立在马路牙子边
      b.pick('mint', 0, 330);
      b.coins(2, 160, 340);
    } },
    cross: { len: 470, where: ['sidewalk'], f(b, r) {   // 路口：红灯时只能停下来等，旁边的人在抽
      b.cross(250);
      b.smoker('stand', 0, 214); b.smoker('stand', 1, 226);
      b.coins(2, 270, 360, 26);
    } },
    zone: { len: 480, f(b, r) {           // 露台吸烟区：贴着店面那条道被围起来，水过不去；旁边还有出来抽的
      b.zone(110, 230);
      b.prop('planter', 2, 210);
      b.smoker('stand', 1, 330);
      b.coins(2, 30, 160); b.coins(2, 270, 420);
    } },
    bubbles: { len: 380, where: ['park'], f(b, r) {   // 小孩吹泡泡：走进泡泡里能回一口气
      b.bubbles(60, 300, 7);
      if (r() < .6) b.smoker('stand', rl(r), 300);
      b.coins(rl(r), 40, 160);
    } },
    vents: { len: 440, where: ['sidewalk'], f(b, r) {   // 地铁通风口：定时往上喷，把头顶的烟吹散
      b.vent(1, 170); b.vent(2, 310);
      b.smoker('stand', 0, 190); b.smoker('stand', 1, 330);
      b.coins(1, 40, 150);
    } },
    /* 浓烟段（只在潜水规则下出）：一伙人在这儿抽了半天，烟罩住整段路、三条道都是。要先吸满一口，憋着一路冲过去；
     * 长的中间有 AIR 格栅（往上吹新鲜空气），可以在那儿松手换口气、把这一段的连冲先入账，也可以贪到底换一个大的。
     * 第一天约 2 秒冲刺能过完，之后每天长一截；烟民隔一百来米站一个，左右错开，任何位置都留一条道 */
    haze: { len: 0, f(b, r) {
      const d = Math.min(3, b.day), jit = ((r() * 4) | 0) * 25, x0 = 70, hd = Math.min(CFG.COURSE_HOLD.length - 1, b.day);
      // 烟就是赛道（docs/35）：长度按「满速冲刺要憋基础气量的几成」算，第 1 天五成多，往后到九成；中间的 AIR 格栅照旧按长度给
      const H = CFG.COURSE ? Math.round(CFG.COURSE_HOLD[hd] * CFG.BREATH * b.speed * (CFG.DASH_AIR + CFG.DASH_SMOKE)) + jit : 400 + 160 * d + jit, x1 = x0 + H;
      // 格栅不放正中间：一个的放在前四成左右，后半截要憋得更久；两个的放在三成和六成多
      const n = H > 840 ? 2 : H > 520 ? 1 : 0, pockets = [], at = n === 1 ? [.38 + r() * .1] : [.26 + r() * .08, .6 + r() * .08];
      for (let i = 0; i < n; i++) pockets.push({ dx: x0 + H * at[i], z: rl(r), w: 90 });
      let side = r() < .5 ? 0 : 2, k = 0;
      for (let x = x0 + 46; x < x1 - 34; x += 104 + r() * 30) {
        let lane = r() < .25 ? 1 : side;
        // AIR 格栅那条道前后不站人：要能停在那儿喘气
        for (let t = 0; t < 3 && pockets.some(q => q.z === lane && Math.abs(q.dx - x) < 100); t++) lane = (lane + 1) % 3;
        if (pockets.some(q => q.z === lane && Math.abs(q.dx - x) < 100)) continue;
        b.smoker('stand', lane, x, { still: true }); side = 2 - side; k++;
        // 烟里也有东西（docs/35）：隔一个人放一样，放在别的道上、不挡 AIR 格栅。冲刺最快的地方东西来得也最快
        if (CFG.ROAD && CFG.ROAD_SMOKE && k % 2 === 0) {
          const pl = [0, 1, 2].filter(L => L !== lane && !pockets.some(q => q.z === L && Math.abs(q.dx - x - 50) < 110));
          if (pl.length) { const L = pl[(r() * pl.length) | 0]; b.prop(roadProp(L, r), L, x + 50); }
        }
      }
      for (const q of pockets) b.coins(q.z, q.dx - 36, q.dx + 36, 24);
      b.coins(1, x1 + 10, x1 + 70, 30);
      b.haze(x0, x1, pockets);
      return x1 + 90;
    } },
    /* 烟的之字路（docs/22 的 A，2026-11-16）：三四段浓烟一段接一段，每段罩住两条道、留一条道空着，空着的那条每段换一个。
     * 段和段之间叠 30：从这一段的空道换到下一段的空道，中间要穿过烟，得憋着换道；也可以吸满一口一条道憋到底。
     * 金币摆在空着的那条道上指路 */
    zigzag: { len: 0, f(b, r) {
      const n = 3 + (b.day > 1 ? 1 : 0) + (CFG.COURSE ? Math.min(2, b.day) : 0), seg = 150 + Math.min(3, b.day) * 15, x0 = 80;      // 烟就是赛道：往后每天多一两段
      let gap = rl(r);
      for (let i = 0; i < n; i++) {
        const a = x0 + i * seg;
        const smoky = [0, 1, 2].filter(L => L !== gap);
        b.haze(a, a + seg + 30, [], smoky, i === 0);
        b.coins(gap, a + 40, a + seg - 20, 30, 1);
        const sl = smoky[(r() * 2) | 0];
        b.smoker('stand', sl, a + seg * .55, { still: true });
        // 之字路（docs/35）：有烟的另一条道上放一样东西。走空道安全但慢，钻烟快但要躲
        if (CFG.ROAD && CFG.ROAD_SMOKE) { const L = smoky.find(q => q !== sl); b.prop(roadProp(L, r), L, a + seg * .35); }      // 烟里站着抽的人：憋着从旁边过去算连冲，PHEW 才吹得动大烟雾
        let ng = rl(r); if (ng === gap) ng = (gap + 1 + ((r() * 2) | 0)) % 3; gap = ng;
      }
      return x0 + n * seg + 140;
    } },
    // 路上的东西（docs/35，试验）：只用东西排，人不算。任何位置都留一条道
    barrier: { len: 380, road: true, f(b, r) {      // 路障：两条道上并排两样，只留一条道；金币摆在留出来的那条
      const open = rl(r);
      for (const l of [0, 1, 2]) if (l !== open) b.prop(roadProp(l, r), l, 220);
      b.coins(open, 140, 300, 30, 1);
    } },
    slalom: { len: 0, road: true, f(b, r) {         // 绕桩：隔一小段一样东西，换着道摆，逼你连着换道
      const n = 3 + Math.min(2, b.day), gap = CFG.ROAD_GAP;
      let l = rl(r);
      for (let i = 0; i < n; i++) { b.prop(roadProp(l, r), l, 120 + i * gap); l = (l + 1 + ((r() * 2) | 0)) % 3; }
      return 120 + n * gap + 80;
    } },
    crowd: { len: 480, f(b, r) {          // 迎面一群路人，中间夹着一个抽烟的
      b.ped(0, 260); b.ped(1, 340); b.ped(2, 430); b.ped(0, 480);
      b.smoker('walk', rl(r), 400);
      b.coins(1, 60, 200);
    } }
  };

  // 人行道后面那一排：8 家店和 4 栋普通的楼，都是方方正正的正面立面，墙挨着墙拼成一条街，中间没有缝
  const SHOPS = ['front-pizza', 'front-bookstore', 'front-laundromat', 'front-florist', 'front-deli', 'front-coffee', 'front-barber', 'front-bodega'];
  const PLAIN = ['front-walkup', 'front-brownstone', 'front-garage', 'front-brickwall'];
  // 写字楼和地铁街区各有三张自己的立面，和通用的店面、普通的楼混着排，这样三个街区的街景不一样
  const OFFICE = ['front-office-lobby', 'front-office-bank', 'front-office-glass'], OFFICE_SHOPS = ['front-coffee', 'front-deli', 'front-barber', 'front-bookstore'];
  const SUBWAY = ['front-subway-newsstand', 'front-subway-tiles', 'front-subway-entrance', 'front-subway-tiles'];
  const ALLEYS = ['alley-dumpster', 'alley-gate', 'alley-boxes'];
  const LANDMARK = 1;      // 地铁口现在是第九批画的正面图，比例和店面一样，不用缩
  // 公园和屋顶的背景：各六张，左右能拼成一条。公园的大门少出一点，树多出一点；屋顶上空着的那张多出一点，免得太满
  const PARKS = ['park-tree-a', 'park-tree-b', 'park-tree-a', 'park-lamp-bench', 'park-fountain', 'park-statue', 'park-tree-b', 'park-gate'];
  const ROOFS = ['roof-watertower', 'roof-plain', 'roof-stairhouse', 'roof-ac', 'roof-plain', 'roof-garden', 'roof-laundry'];

  /* ---------- 一趟旅行：街区一个接一个，边走边往前生成，走过的丢掉 ---------- */
  const LISTS = ['props', 'smokers', 'peds', 'coins', 'refills', 'vents', 'shelters', 'zones', 'crosses', 'scooters', 'birds', 'bubbles', 'blowers', 'facades', 'hazes'];
  function builder(g) {
    const G = g.gen, r = G.r, M = HYB.MANIFEST, at = dx => G.base + dx;
    return {
      flip: false,
      prop(name, lane, dx) {
        if (this.flip) lane = 2 - lane;
        const P = M && M.props[name], w = P && P.collide ? P.collide[0] : 30;
        g.props.push({ name, x: at(dx), z: lane, x0: at(dx) - w / 2, x1: at(dx) + w / 2 });
      },
      smoker(kind, lane, dx, o) {
        if (this.flip) lane = 2 - lane;
        const s = makeSmoker(kind, at(dx) + (r() - .5) * 10, lane, r, G.st.id, G.day);
        if (o && o.vt != null) s.vapeT = o.vt;
        if (s.look === 'phone' && !(o && o.still)) s.pace = { a: lane, b: lane === 1 ? (r() < .5 ? 0 : 2) : 1, t: r() * 1.5, dir: 1 };
        if (s.look === 'dogwalker' && !(o && o.still)) {
          // 狗在相邻的道上，狗绳连着：两条道都过不去。旁边要是已经有东西挡着，就让狗蹲在主人身后，不再多堵一条
          const dl = lane === 1 ? (r() < .5 ? 0 : 2) : 1, third = 3 - lane - dl;
          const clear = L => !g.props.some(q => q.z === L && Math.abs(q.x - s.x) < 60) && !g.smokers.some(q => Math.abs(q.lane - L) < .5 && Math.abs(q.x - s.x) < 60);
          if (clear(dl) && clear(third)) s.dogLane = dl;
        }
        g.smokers.push(s); return s;
      },
      ped(lane, dx) { if (this.flip) lane = 2 - lane; const who = ['stroller', 'tourist', 'courier'][rl(r)]; g.peds.push({ x: at(dx), z: lane, lane, v: CFG.PED_V * (.85 + r() * .3), walk: r() * 4, sheet: who, half: who === 'tourist' ? 12 : 17, on: false, gone: false, aside: 0, say: 0 }); },
      /* 一串金币：只摆原来的 COIN_KEEP 那么多个，均匀铺满原来那一段（2026-11-16）。玩法大改以后（之字路每段一串、傍晚算两个、局更长），
       * 普通玩家机器人一局从 docs/12 定的约 190 涨到约 700，每分钟从 82 涨到 160 左右，升级十来天就能买满、金币包也不值钱了。
       * 随机数照原来的个数取，后面生成的街不变 */
      coins(lane, d0, d1, gap, keep) {      // keep：这一串留多少（之字路空道上那串照原样摆满，金币一路指着空的那条道）
        if (this.flip) lane = 2 - lane;
        const st = gap || 34, n = Math.floor((d1 - d0) / st) + 1, m = Math.max(1, Math.round(n * (keep || CFG.COIN_KEEP))), span = (n - 1) * st;
        for (let i = 0; i < n; i++) { const ph = r() * 6.28; if (i < m) g.coins.push({ x: at(m > 1 ? d0 + span * i / (m - 1) : d0), z: lane, kind: 'coin', got: false, ph }); }
      },
      pick(kind, lane, dx) { if (this.flip) lane = 2 - lane; g.coins.push({ x: at(dx), z: lane, kind, got: false, ph: r() * 6.28 }); },
      refill(dx) { g.refills.push({ x: at(dx), w: 70 }); },
      // 一段浓烟：从 d0 到 d1 三条道都罩着，走近了才生成（见 stepHaze）。pockets 是中间能换气的 AIR 格栅，各占一条道
      // lanes：只罩这几条道（烟的之字路，见 zigzag）；sign：false 时不立「吸烟区」的牌子（一串里只立第一块）
      haze(d0, d1, pockets, lanes, sign) {
        const P = pockets.map(q => ({ x: at(q.dx), z: q.z, w: q.w || 90 }));
        g.hazes.push({ x0: at(d0), x1: at(d1), pockets: P, made: false, warned: sign === false, lanes: lanes || null, sign: sign !== false });
        for (const q of P) g.vents.push({ x: q.x, z: q.z, t: r() * 3.2, on: 1, air: true, w: q.w });
      },
      get day() { return G.day; },
      get speed() { return CFG.V0 + (CFG.V1 - CFG.V0) * clamp(G.base / CFG.V_DIST, 0, 1); },      // 这一段大概的走路速度（烟就是赛道：浓烟段按它算长度）
      birds(lane, dx) { g.birds.push({ x: at(dx), z: lane, n: 3 + ((r() * 3) | 0) }); },
      facade(name, dx) { G.forced.push({ name, x: at(dx) }); },
      shelter(dx, w) { g.shelters.push({ x0: at(dx), x1: at(dx) + w, z0: -.6, z1: 1.5 }); },
      zone(dx, w) {
        const x0 = at(dx), x1 = x0 + w;
        g.zones.push({ x0, x1 });
        g.props.push({ name: 'fence', x: (x0 + x1) / 2, z: 0, x0, x1, hidden: true });
        for (let x = x0 + 50; x < x1 - 30; x += 110) g.smokers.push(makeSmoker('terrace', x, -.05, r));
      },
      bubbles(d0, d1, n) {
        g.blowers.push({ x: at(d0) + 40 });
        for (let i = 0; i < n; i++) g.bubbles.push({ x: at(d0 + (d1 - d0) * i / n) + r() * 30, z: r() * 2.2 - .1, h: 26 + r() * 30, ph: r() * 6.28, r: 9 + r() * 5, got: false, pop: 0 });
      },
      vent(lane, dx) { g.vents.push({ x: at(dx), z: lane, t: r() * 3.2, on: 0 }); },
      cross() { },
      scooter(lane, dx) { g.scooters.push({ x: at(dx), lane, done: false }); }
    };
  }
  // 第一天按每个街区排好的顺序出；第二天起打乱，并且多塞一段难的
  const HARD = ['gauntlet', 'wall', 'circle', 'crowd'];
  // 道具：滑板（飞快、矮东西跳过去、人给你让路）、吹叶机（把前面的烟全吹回去）、泡泡罩（罩里随便呼吸）、大水枪（不花水、自动连射）、
  // 健康跑哨子（只有烟里冲刺规则有）：吹着的这几秒里，冲过去的烟民都把烟一扔，戴上头带跟着你跑（docs/27）
  const POWERS = ['skate', 'blower', 'bubble', 'soaker', 'whistle'];
  const powersOf = g => g.dash ? POWERS : POWERS.slice(0, 4);
  function districtSeq(g, st, day, n0) {
    const r = g.gen.r, ok = k => ENC[k] && k !== 'cross' && (!ENC[k].where || ENC[k].where.includes(st.ground));
    let seq = st.seq.map(s => { if (!Array.isArray(s)) return s; const o = s.filter(ok); return o[(r() * o.length) | 0]; }).filter(ok);
    if (day > 0) {
      seq = seq.filter(k => k !== 'calm').sort(() => r() - .5);
      seq.splice(2 + ((r() * 3) | 0), 0, HARD[(r() * HARD.length) | 0]);
      if (!seq.slice(0, 6).includes('fountain')) seq.splice(3, 0, 'fountain');
    }
    // 潜水规则：第一天每个街区一段浓烟（顶掉最后一段，街区不变长），第二天起两段。第一次玩的第一个街区不放，先学会按住
    if (g.breathy && !(g.tutorial && n0 === 0)) { for (let i = 1; i < seq.length; i += 2) seq.splice(i, 0, 'haze'); }      // 憋气版：每隔一段就是一段浓烟
    else if (g.dive && !(g.tutorial && n0 === 0)) { if (day) { seq.splice(2, 0, 'haze'); seq.splice(6, 0, 'haze'); } else seq.splice(3, 0, 'haze'); }
    // 烟的之字路：从第二个街区起每个街区一段，顶掉一段别的（街区不变长）。放在两段浓烟之后隔开两段：
    // 第 2 天起浓烟在第 2、6 段，原来放第 4 段时三段烟挨着、中间没有干净空气回气，高手 40 局里 25 局死在第 3 天第一个街区
    if (g.dive && (day || n0 % 5 > 0) && !(g.tutorial && n0 < 2)) seq.splice(day ? 9 : 5, 1, 'zigzag');
    if (CFG.COURSE && !(g.tutorial && n0 < 2)) {      // 烟就是赛道（docs/35）：每个街区补够几段烟，浓烟段、之字路轮流，均匀插开
      const want = CFG.COURSE_N[Math.min(CFG.COURSE_N.length - 1, day)], cap = day ? CFG.DISTRICT + Math.min(3, day) : CFG.DAY1;
      let have = seq.filter(k => k === 'haze' || k === 'zigzag').length, hz = seq.includes('zigzag');
      for (let i = 0; have < want && i < 6; i++, have++) { seq.splice(Math.min(seq.length, 1 + Math.round((i + .5) * cap / want)), 0, hz ? 'haze' : 'zigzag'); hz = !hz; }
    }
    if (CFG.ROAD && !(g.tutorial && n0 === 0)) {      // docs/35：每个街区插几段只有东西的排法，均匀插开
      const n = CFG.ROAD_N[Math.min(CFG.ROAD_N.length - 1, day)], cap = day ? CFG.DISTRICT + Math.min(3, day) : CFG.DAY1;
      for (let i = 0; i < n; i++) seq.splice(Math.min(seq.length, 1 + Math.round((i + .5) * cap / n)), 0, r() < .5 ? 'barrier' : 'slalom');
    }
    seq = seq.slice(0, day ? CFG.DISTRICT + Math.min(3, day) + (g.dive ? 1 : 0) : CFG.DAY1);
    // 第一天也打乱（2026-11-21）：原来第一天的顺序是写死的，教新手一样一样学；可每局都从第一天跑起，玩家说「地图永远是固定的」。
    // 现在只有头 3 局照原样（mix 由 main.js 给），之后用的还是这几段，只换顺序。浓烟段、之字路、开头那段空路不动位置
    if (!day && g.mix) {
      const at = seq.map((k, i) => i).filter(i => !['haze', 'zigzag', 'calm'].includes(seq[i])), ks = at.map(i => seq[i]).sort(() => r() - .5);
      at.forEach((i, j) => { seq[i] = ks[j]; });
    }
    return seq;
  }
  function nextDistrict(g) {
    const G = g.gen, n = G.dn++, idx = n % STOPS.length, day = (n / STOPS.length) | 0, st = STOPS[idx];
    g.districts.push({ x: n ? G.base : -1e9, idx, day, st });
    G.st = st; G.day = day; G.queue = districtSeq(g, st, day, n); G.needBoss = !!st.boss; G.encN = 0;
    if (n) G.base += 140;      // 街区之间留一小段空路，喘口气
    // 街区摊位（docs/22 的 C）：从第二个街区起，路口三条道上各一个小摊，跑过哪个拿哪个
    if (n && !g.tutorial && !g.attract) { stallGate(g, G.base + 40); G.base += 150; }
  }
  function extend(g) {
    const G = g.gen, b = builder(g);
    while (G.base < g.p.x + 1500) {
      if (!G.queue.length && G.needBoss) { G.needBoss = false; bossArena(g); continue; }
      if (!G.queue.length) nextDistrict(g);
      const e = ENC[G.queue.shift()], n0 = g.smokers.length, x0 = G.base;
      G.forced = [];
      b.flip = !!(e.flip && g.mix) && G.r() < .5;      // 只在 mix 时取随机数，头 3 局的街和原来一样
      const len = e.f(b, G.r, G.st) || e.len;
      b.flip = false;      // 长度不固定的遭遇（浓烟段）自己报长度
      // 每个街区两件道具，放在烟民身后那条道上：要从他的烟里过才拿得到
      G.encN++;
      if ((G.encN === 3 || G.encN === 6) && !g.tutorial) {
        const PW5 = powersOf(g), s = g.smokers.slice(n0).find(q => q.kind === 'stand' || q.kind === 'vape'), kind = PW5[(G.r() * PW5.length) | 0];
        const z = s ? s.lane : rl(G.r); let x = s ? s.x + 76 : x0 + len * .5;
        if (g.props.some(o => o.z === z && Math.abs(o.x - x) < 34)) x += 70;
        g.coins.push({ x, z, kind, got: false, ph: G.r() * 6.28 });
      }
      offDogs(g, x0 - 80);
      G.base += len;
      facadesTo(g, G.base, G.st);
    }
  }
  /* 狗躺着的那条道上不放金币和道具（2026-11-16）：遛狗的人的狗蹲在旁边那条道上，狗绳连着，那条道过不去；
   * 原来道具有 2.4%、金币有 0.5% 正好生成在狗身上，看得见拿不到，去拿就撞上。道具往后挪，金币直接不要。不用随机数，后面的路不变 */
  function offDogs(g, from) {
    const dogs = g.smokers.filter(s => s.dogLane != null && s.x > from - 60);
    if (!dogs.length) return;
    const onDog = c => dogs.some(s => Math.abs(s.dogLane - c.z) < .5 && Math.abs(s.x - c.x) < 34);
    for (const c of g.coins) if (c.x > from && c.kind !== 'coin') for (let k = 0; k < 3 && onDog(c); k++) c.x += 70;
    g.coins = g.coins.filter(c => c.x <= from || c.kind !== 'coin' || !onDog(c));
  }
  /* ---------- 街区摊位（docs/22 的 C，2026-11-16） ----------
   * 进新街区时路口三条道上各立一个小摊，跑过哪条道就拿哪样，不停下来；拿了一样，另外两个收掉。整局有效，同一样最多两次（磁铁一次）。
   * 让每一局有几次要动脑的选择：缺气就拿三明治，水不够拿消防栓，人多了拿电风扇 */
  const STALLS = {
    // 每样都小：一局能拿十几样，叠起来就很大（第一版每样一成到两成五，高手机器人从 339 秒涨到 655 秒）
    deli: { label: 'MORE AIR', max: 2, set: g => { g.k.breath += .3; g.p.breath = g.k.breath; } },
    hydrant: { label: 'FULL WATER', max: 2, set: g => { g.k.refill *= 1.25; g.water = g.k.water; } },
    sneaker: { label: 'QUICK FEET', max: 2, set: g => { g.k.laneT *= .85; } },
    bagel: { label: 'COIN MAGNET', max: 1, set: g => { g.k.magnet = true; } },
    mint: { label: 'SAVES 1 COUGH', max: 2, set: g => { g.mintLeft = (g.mintLeft || 0) + 1; } },      // 下一次呛到不算（用掉就没了）
    juice: { label: 'FAST BREATH', max: 2, set: g => { g.k.regen *= 1.1; } },
    fan: { label: 'BIG PHEW', max: 2, set: g => { g.k.bank *= 1.1; } },
    news: { label: 'SLOW SMOG', max: 2, set: g => { g.smogK = (g.smogK || 1) * .985; } }
  };
  function stallGate(g, x) {
    // 带着吸金币的装备时不摆百吉饼（也是吸金币，拿了等于白拿，2026-11-16）
    const r = g.gen.r, have = g.perks || {}, pool = Object.keys(STALLS).filter(k => (have[k] || 0) < STALLS[k].max && !(k === 'bagel' && g.k.magnet)), pick = [];
    while (pick.length < 3 && pool.length) pick.push(pool.splice((r() * pool.length) | 0, 1)[0]);
    const gate = (g.gateN = (g.gateN || 0) + 1);
    pick.forEach((perk, lane) => g.coins.push({ x, z: lane, kind: 'stall', perk, gate, got: false, ph: r() * 6.28 }));
  }
  function takeStall(g, c) {
    g.perks = g.perks || {}; g.perks[c.perk] = (g.perks[c.perk] || 0) + 1; STALLS[c.perk].set(g);
    for (const o of g.coins) if (o.kind === 'stall' && o.gate === c.gate && o !== c) { o.got = true; o.poof = 1; }
    g.ev.push({ k: 'perk', perk: c.perk, label: STALLS[c.perk].label, x: c.x, z: c.z, h: 90 });
  }
  function bossArena(g) {
    const G = g.gen, lockX = G.base + 260;
    builder(g).refill(90);
    const s = makeSmoker('boss', lockX + 330, 1, G.r, G.st.id, G.day);
    Object.assign(s, { hp: CFG.BOSS_HP, phase: 'wait', awake: false, mi: -1, n: 0, popped: 0, wf: 0, day: G.day });
    g.smokers.push(s); g.bossQ.push({ lockX, s });
    // 地铁口立在老板正后面（老板站在 lockX + 138，见 stepBoss 的 home）：他守着下楼梯的口子。原来放在 lockX + 240，打老板时几乎全在屏幕外，只露出一条边（2026-11-16）
    G.forced = [{ name: 'subway-entrance-front', x: lockX + 138 }];
    G.base += 560;
    facadesTo(g, G.base, G.st);
  }
  // 后排立面：店面一家挨一家，一直补到 xEnd
  function facadesTo(g, xEnd, st) {
    const G = g.gen, r = G.r, M = HYB.MANIFEST, forced = G.forced.sort((a, c) => a.x - c.x);
    const wOf = n => M && M.props[n] ? M.props[n].w : 112;
    /* 从一组里挑一张，不和最近几栋楼重样：巷子不算一栋，往回数楼，避开最近 组里张数−2 栋（至少 1 栋，最多 3 栋；留几张可挑，不然排成固定的轮换）。
     * 原来只避开前面两条（巷子也算一条），隔一条巷子就能再来一次：一屏半里理发店出现三次（2026-11-15）。
     * 仍然只用一次随机数，后面的路（烟民、道具）不受影响 */
    const front = pool => {
      const L = g.facades, uniq = [...new Set(pool)], alleyPick = pool === ALLEYS, recent = [];
      for (let i = L.length - 1; i >= 0 && recent.length < Math.max(1, Math.min(3, uniq.length - 2)); i--) {
        const n = L[i].name; if (L[i].kind !== 'prop' || (!alleyPick && n.startsWith('alley-')) || (alleyPick && !n.startsWith('alley-'))) continue;
        recent.push(n);
      }
      const ok = pool.filter(n => !recent.includes(n)), u = r();      // 用原来的组（有的图放了两次，多出现一些）
      return ok.length ? ok[(u * ok.length) | 0] : pool[(u * pool.length) | 0];
    };
    // 巷子：两栋楼之间留一条窄缝，里面是暗下去的后墙、垃圾箱、铁门。楼不是一栋紧贴一栋排到头的
    const alley = () => { const name = front(ALLEYS), w = wOf(name); g.facades.push({ kind: 'prop', name, x, w }); x += w; G.sinceAlley = 0; };
    let x = G.facX, fi = 0;
    while (x < xEnd) {
      // 指定位置的地标（地铁口）：它是立在人行道上的东西，不占楼的位置。后面的楼照常一栋接一栋排，地标单独记一笔，画在楼的前面
      while (fi < forced.length && forced[fi].x < xEnd + 200) { const F = forced[fi++], fw = wOf(F.name) * LANDMARK; g.facades.push({ kind: 'landmark', name: F.name, x: F.x - fw / 2, w: fw }); }
      if (st.street === 'shops') {
        // 每隔两到四栋楼留一条巷子
        G.sinceAlley = (G.sinceAlley || 0) + 1;
        // 地铁口后面不放店面也不留巷子，只放素一点的墙和车库：不然一张图盖在另一张图的门窗上，像贴上去的
        const behind = forced.some(F => { const hw = wOf(F.name) * LANDMARK / 2; return x + 112 > F.x - hw && x < F.x + hw; });
        if (!behind && (G.sinceAlley > 2 && r() < .5 || G.sinceAlley > 4)) { alley(); continue; }
        // 这一栋从哪一组里挑：人行道是店面为主；写字楼六成是写字楼自己的立面；地铁街区一半是地铁砖墙和报刊亭
        const u = r(), pool = st.id === 'office' ? (u < .6 ? OFFICE : u < .82 ? OFFICE_SHOPS : PLAIN) : st.id === 'subway' ? (u < .5 ? SUBWAY : u < .78 ? SHOPS : PLAIN) : (u < .68 ? SHOPS : PLAIN);
        const name = behind ? front(st.id === 'subway' ? ['front-subway-tiles', 'front-brickwall'] : ['front-brickwall', 'front-garage']) : front(pool), fw = wOf(name);
        g.facades.push({ kind: 'prop', name, x, w: fw }); x += fw;
      } else {
        // 公园、屋顶：一张接一张，不和前一张重样
        const name = front(st.street === 'park' ? PARKS : ROOFS), fw = wOf(name);
        g.facades.push({ kind: 'prop', name, x, w: fw }); x += fw;
      }
    }
    G.facX = x;
  }
  const endX = o => o.x1 != null ? o.x1 : o.x + (o.w || 0);
  function cull(g) {
    const x = g.camX - 420;
    for (const k of LISTS) if (g[k].length) g[k] = g[k].filter(o => endX(o) >= x && o.state !== 'gone' && !o.gone);
  }

  function makeSmoker(kind, x, lane, r, where, day) {
    return {
      kind, x, z: lane, lane, lit: true, state: 'smoke', st: 0, awake: kind !== 'walk' && kind !== 'ahead', aside: 0, zTo: lane,
      emit: r() * .3, nextEx: .8 + r() * 2, ex: 0, exAcc: 0, exx: -1, exz: 0, lock: false,
      vapeT: 1 + r() * CFG.VAPE_EVERY, doom: 0, fade: 1, walk: r() * 4, hp: 1, hitT: 0, say: '',
      passed: false, near: false, dirtyAt: 0, phase: '', pt: 0, lanes: null, vx: 0, day: day || 0, ...look(kind, r, where, day)
    };
  }
  function look(kind, r, where, day) {
    const pick = a => a[(r() * a.length) | 0];
    if (kind === 'walk' || kind === 'ahead') {
      const name = pick(WALK_POOL[where] || WALK_POOL.sidewalk), L = LOOKS[name] || lookPts(name + '-side-walk') || LOOKS.hoodie, f = kind === 'ahead' ? -1 : 1;
      return { look: LOOKS[name] || lookPts(name + '-side-walk') ? name : 'hoodie', cig: [L.cig[0] * f, L.cig[1]], mouth: [L.mouth[0] * f, L.mouth[1]] };
    }
    if (kind === 'stand') {
      const name = pick((STAND_POOL[where] || STAND_POOL.sidewalk).concat(day > 0 ? STAND_LATER[where] || [] : [])), L = lookPts(STAND_SHEET[name]);
      // 每种新面孔一样本事：老太太一口烟又大又慢；吐烟圈的不喷烟，吐一个沿着道飘过来的烟圈；
      // 厨师身边冒着后厨的白汽（无害）；打电话的在两条道之间踱步；遛狗的狗绳横着挡住两条道（后两样在 builder 里摆）
      return L ? { look: name, cig: L.cig, mouth: L.mouth, big: name === 'granny', ring: name === 'ring', chef: name === 'chef' } : {};
    }
    if (kind === 'vape') { const L = lookPts('vape-side'); return L ? { cig: L.cig, mouth: L.mouth } : {}; }
    return {};
  }

  /* ---------- 一局 ---------- */
  function newRun(seed, viewH, opts) {
    const o = opts || {}, up = o.up || {}, k = { breath: CFG.BREATH + CFG.LUNG_UP * (up.lungs || 0), water: CFG.WATER, sprint: 1, coughAt: CFG.COUGH_AT, dmin: CFG.DMIN, magnet: false, bank: 1, revive: 0, refill: 1, splash: 1, laneT: 1, regen: 1 + CFG.LUNG_REGEN * (up.lungs || 0),
      head: up.start ? CFG.HEAD[Math.min(CFG.HEAD.length, up.start) - 1] : 0, dodge: up.dodge ? (CFG.ROAD ? 1 : CFG.DODGE[Math.min(CFG.DODGE.length, up.dodge) - 1]) : 0,
      dodgeN: CFG.ROAD ? Math.min(3, up.dodge || 0) : Infinity,      // docs/35：侧身改成每局前几次撞上自动躲（1、2、3 级各几次），不再按冷却无限躲
      lunge: CFG.ROAD ? CFG.BUMP_LUNGE - CFG.STEADY * Math.min(3, up.dodge || 0) : CFG.BUMP_LUNGE };
    if (o.gear && GEAR[o.gear]) GEAR[o.gear].set(k);
    const g = {
      seed, rng: rngOf(seed ^ 0x9e3779b9), viewH, k, len: Infinity,
      dive: (o.rules || HYB.rules) !== 'classic',      // 潜水规则：浓烟段、按平方吹退（见 RULES）；憋气版、烟里冲刺在它上面再改
      breathy: (o.rules || HYB.rules) === 'breath',
      dash: (o.rules || HYB.rules) === 'dash',
      // 第一局整条街往后挪 400（2026-11-16）：第一个站着抽烟的人正好在开场后「YOUR TURN!」那张卡还挂着时走过去，
      // 「按住憋气」那步教学被卡片挡着，等卡片收起来他已经在身后，提示说按住、眼前却没有烟
      gen: { r: rngOf(seed * 31 + 7919), base: o.tutorial ? 820 : 420, facX: -300, dn: 0, queue: [], st: null, forced: [], cullT: 0 },
      districts: [], di: 0, stop: STOPS[0], day: 0, parade: [], paradeMax: 0,
      camX: -PX, speed: CFG.V0,
      p: { x: 0, z: 1, lane: 1, v: 0, walk: 0, breath: k.breath, holding: false, holdT: 0, gasp: 0, bump: 0, stun: 0, inv: 0 },
      smog: { x: -CFG.GAP0, gap: CFG.GAP0, awake: !o.tutorial },
      wind: { x: -10, z: .05 }, windNext: null,
      puffs: [], drops: [], warns: [], rings: [], bossQ: [], boss: null, ev: [],
      smell: 0, water: k.water, kills: 0, bulls: 0, shots: 0, coughs: 0,
      score: 0, coinsGot: 0, chain: 0, bestChain: 0, banked: 0, popped: 0,
      dirty: 0, cleanT: 9, lastDirtyT: -9, shotId: 0, blame: {}, hurt: '', hurtT: -99,
      dens: 0, warnAhead: false, target: null, shotCd: 0, hitstop: 0, slow: 0, jet: 0, t: 0, waiting: null, locked: false,
      up: o.up || {},      // 局外升级：start 开局滑板、dodge 侧身、lungs 肺活量、power 道具时长，各升了几级
      dodgeCd: 0,
      gear: o.gear && GEAR[o.gear] ? o.gear : null,
      // 开头的引子：大烟雾从后面追上来、人加快脚步、憋气把它甩开，然后才交给玩家（见 stepIntro）。full 是完整的，short 是再来一局时的快版
      intro: o.attract || o.intro === false ? null : introOf(o.intro, !!o.tutorial),
      attract: !!o.attract, tutorial: !!o.tutorial, over: null,
      // mix：第一天的顺序打乱、几段写死的站位随机左右对调（2026-11-21）。main.js 头 3 局给 false；不说就是打乱（机器人、主页演示）
      mix: o.mix != null ? !!o.mix : !o.tutorial,
      startDay: 1
    };
    for (const name of LISTS) g[name] = [];
    // 有引子：第一帧就是引子的样子（人已经在走，烟雾还在屏幕外），不先闪一下平时的起步距离
    if (g.intro) { g.smog.x = -g.intro.gap[0][1]; g.smog.gap = g.intro.gap[0][1]; g.p.v = g.intro.v0; g.camX -= g.p.v / 8; }
    // 调试用：直接从第几个街区开始（0 人行道、1 写字楼、2 公园、3 屋顶、4 地铁），用来逐个街区看画面
    // 从第几天出发（2026-11-21）：拿到第 N 颗星以后能直接从第 N+1 天跑起（最多第 3 天）。街和那一天一样（打乱、多一段难的、天色、老板更快），
    // 大烟雾和走路的速度照样从头慢慢涨：省掉的是先跑六七分钟才能再试一次，不是那一天的难度
    const sd = o.startDay > 1 ? Math.min(3, o.startDay | 0) : 0;
    if (sd) { o.district = (sd - 1) * STOPS.length; g.startDay = sd; }
    if (o.district) { g.gen.dn = o.district; g.stop = STOPS[o.district % STOPS.length]; g.day = (o.district / STOPS.length) | 0; }
    builder(g).coins(1, -240, -60, 45);
    extend(g);
    // 开场引子里人自己在跑，这一段不捡东西（step 里引子时不走 stepPickups），路上的金币是直接穿过去的。
    // 用户 2026-11-21：「看着吃进去了却没到账」。引子跑到的地方之前不放金币（照 stepIntro 的速度曲线空跑一遍算出来）
    if (g.intro) { const reach = introReach(g) + 40; g.coins = g.coins.filter(c => c.kind !== 'coin' || c.x > reach); }
    if (!g.intro && !g.attract) headStart(g);
    return g;
  }
  function introReach(g) {
    const I = g.intro, W = g.speed, R = g.speed * CFG.BOOST1 * g.k.sprint, dt = 1 / 60;
    let x = g.p.x;
    for (let t = 0; t < I.end; t += dt) x += (I.v0 + (I.vl - I.v0) * ease((t - I.seen) / .3) + (W - I.vl) * ease((t - I.turn) / .5) + (R - W) * (ease((t - I.go) / .8) - ease((t - I.phew) / .7))) * dt;
    return x;
  }
  // 开局滑板：引子放完、交给玩家的那一刻踩上滑板。第一次玩（教学局）不给
  function headStart(g) {
    if (!g.k.head || g.tutorial) return;
    g.power = { kind: 'skate', t: g.k.head, T: g.k.head, head: true };
    g.ev.push({ k: 'power', kind: 'skate', head: true, x: g.p.x, z: g.p.z });
  }

  /* 第几天是什么时辰：第 1 天白天、第 2 天傍晚、第 3 天夜里，第 4 天起黎明、雨天、傍晚、夜里轮着来（2026-11-16）。
   * 画面按这个换颜色（render.js 的 drawDayLight）；雨天烟散得快（RAIN_LIFE）。day 从 0 算 */
  const PHASES = ['dawn', 'rain', 'dusk', 'night'];
  const phaseOf = day => day <= 0 ? 'day' : day === 1 ? 'dusk' : day === 2 ? 'night' : PHASES[(day - 3) % 4];
  function puff(g, x, z, h, vx, vz, vh, r0, r1, life, a, kind) {
    if (g.puffs.length > 700) return;
    if (g.rainy && kind !== 1) life *= CFG.RAIN_LIFE;
    g.puffs.push({ x, z, h, vx, vz, vh, r: r0, r0, r1, age: 0, life, a, s: 0, kind: kind || 0, ph: g.rng() * 6.28, v: (g.rng() * 3) | 0 });
  }

  // kind 0 = 香烟烟雾，1 = 水汽（无害），2 = 电子烟雾
  function density(g, x, z, h) {
    let d = 0; const P = g.puffs;
    for (let i = 0; i < P.length; i++) {
      const q = P[i]; if (q.kind === 1) continue;
      const dx = x - q.x; if (dx > q.r || dx < -q.r) continue;
      const dz = (z - q.z) * DZ, dh = (h - q.h) * .8, rr = q.r * q.r, e = dx * dx + dz * dz + dh * dh;
      if (e < rr) d += q.s * (1 - e / rr);
    }
    return d;
  }

  /* ---------- 挡路的东西：固定物件、站着的人、迎面的人 ---------- */
  /* 烟里冲刺（dash）：挡 Leo 的只有东西（长椅、花坛、垃圾桶、消防栓、围栏）。人和狗不挡，冲过去他们让到一边（brush）。
   * 原来人也挡：撞上人有时自己闪开（侧身升级的冷却看不见）、有时不闪，撞上会不会被追上还要看大烟雾当时离多远，用户说「判断不了」（2026-11-17）。
   * all：人和人之间照旧互相挡（烟民、路人自己走路的时候用） */
  function blockers(g, lane, all) {
    const out = [];
    for (const o of g.props) if (o.z === lane) out.push({ x0: o.x0, x1: o.x1, o, t: 'prop' });
    if (g.dash && !all) return out;
    for (const s of g.smokers) {
      if (s.state !== 'smoke' || (s.aside && s.aside < .35) || s.kind === 'terrace' || s.kind === 'scooter' || !s.awake) continue;
      if (s.dogLane === lane) out.push({ x0: s.x - 34, x1: s.x - 12, o: s, t: 'smoker', dog: true });      // 狗蹲在主人斜前方
      if (Math.abs(s.z - lane) > .5) continue;
      const hw = BODY[s.kind].half; out.push({ x0: s.x - hw, x1: s.x + hw, o: s, t: 'smoker' });
    }
    for (const e of g.peds) { if (e.on && !e.gone && !(e.aside && e.aside < .35) && Math.abs(e.z - lane) < .5) out.push({ x0: e.x - (e.half || 12), x1: e.x + (e.half || 12), o: e, t: 'ped' }); }
    return out;
  }
  function laneFree(g, lane, x0, x1) { return !blockers(g, lane).some(b => b.x1 > x0 && b.x0 < x1); }

  /* 踩滑板的规矩：矮东西（垃圾桶、消防栓、长椅、花坛）小跳过去；人原地蹲下抱头，主角压板大跳、从他头顶飞过去，
   * 落地以后他再站起来；露天座位的围栏和雪茄老板照样挡。
   * （之前是人听见轮子声往路边一闪，有时闪进店面、有时闪到马路牙子上，看着很假。第十二批画了大跳三帧和 11 个人的蹲下图，见 docs/11） */
  const LOW = { 'trash-can': 1, hydrant: 1, bench: 1, planter: 1 };
  const jumpable = b => b.t === 'prop' ? !!LOW[b.o.name] : b.o.kind !== 'boss';
  function skateAhead(g) {
    const p = g.p, reach = Math.max(p.v, g.speed) * CFG.SKATE_SEE + 24;
    let span = null;
    for (const b of blockers(g, p.lane).sort((a, c) => a.x0 - c.x0)) {
      if (b.x1 < p.x - PW || b.x0 > p.x + reach || !jumpable(b)) continue;
      if (b.t !== 'prop') duck(g, b.o);      // 听见轮子声就蹲下，主角飞过去、落地之前一直蹲着
      if (p.hop) continue;
      // 挨得很近的几样连成一段，一跳过去；里面有人就是大跳
      const big = b.t !== 'prop';
      if (!span) span = { x0: b.x0, x1: b.x1, big }; else if (b.x0 < span.x1 + 40) { span.x1 = Math.max(span.x1, b.x1); span.big = span.big || big; }
    }
    // 离前沿 34（跳人留 46）起跳，落在后沿再往后同样远的地方。高度按走过的距离算，跑多快都一定落在后面
    const at = span && span.big ? 46 : 34;
    if (span && span.x0 - p.x < at) {
      const lead = Math.max(12, span.x0 - p.x), L = span.x1 + lead - p.x;
      p.hop = { x0: p.x, x1: p.x + L, H: span.big ? clamp(L * .48, 56, 68) : clamp(L * .36, 36, 48), big: span.big, t: 0 }; p.hopH = 0;
      g.ev.push({ k: 'hop', x: p.x, z: p.z, big: span.big });
    }
  }
  function duck(g, o) {
    if (!(o.duck > 0)) g.ev.push({ k: 'duck', x: o.x, z: o.z, h: 80 });
    o.duck = .35;      // 每一步都续上：人还在主角前面或者正在头顶上就一直蹲着，过去以后 0.35 秒站起来
  }
  // 蹲下用哪张图（第十二批，按长相；电子烟用 vape，路人用 sheet）、蹲下时烟头在哪。厨师没有蹲下图，照常坐着
  const duckSheet = s => { const n = (s.kind === 'vape' ? 'vape' : s.look || s.sheet) + '-side-duck', M = HYB.MANIFEST; return M && M.sheets[n] ? n : null; };
  function duckCig(s) {
    if (s.duckCig === undefined) { const n = duckSheet(s), L = n && lookPts(n), f = s.kind === 'ahead' ? -1 : 1; s.duckCig = L ? [L.cig[0] * f, L.cig[1]] : null; }
    return s.duckCig;
  }
  // 这个东西会不会真的把你停住：踩滑板时只剩围栏和雪茄老板。画面上的「前面挡路」提醒只给这些
  const stopsYou = (g, b) => !(g.power && g.power.kind === 'skate') || !jumpable(b);

  function hitPoint(s) { const h = BODY[s.kind].hit; return { x: s.x + h[0], z: s.z, h: h[1], r: h[2] }; }
  const targetable = s => s.lit && s.state === 'smoke' && s.awake && s.kind !== 'terrace' && s.kind !== 'boss';
  function addPts(g, v, x, z, h, why) { g.score += v; g.ev.push({ k: 'pts', v, x, z, h, why }); return v; }
  /* 跟着节拍喷烟（docs/22 的 D，2026-11-16）：main.js 每帧把音乐的拍子放进 g.beat（每拍几秒、离下一拍几秒，来自 Snd.beatClock）。
   * 烟民、电子烟排下一口时，往后挪到最近的那一拍上：喷烟和鼓点对上，看得出节奏、能卡着拍子过。没有音乐（机器人、暂停）就照原来的间隔 */
  function beatAfter(g, T) {
    const B = g.beat; if (!B || !(B.period > .2)) return T;
    let t = ((B.toNext % B.period) + B.period) % B.period;      // 音乐是提前排好的，离「下一格」可能超过一拍
    if (t < T) t += Math.ceil((T - t) / B.period - 1e-6) * B.period;
    return t;
  }
  // 一口气连冲：憋着气每冲过一个烟民加 1；回到干净空气里松手才入账；呛到或者憋过头就清零
  function chainUp(g, at) {
    // ON BEAT：他刚喷完那一下（0.45 秒内）就憋着从他旁边冲过去，多给 2 个金币
    if (at.puffT != null && g.t - at.puffT < .45 && g.beat) { g.coinsGot += 2; g.onBeats = (g.onBeats || 0) + 1; g.ev.push({ k: 'onbeat', x: at.x, z: at.z, h: 100 }); }
    g.chain++; g.bestChain = Math.max(g.bestChain, g.chain);
    addPts(g, 10 * g.chain, at.x, at.z, 96, 'chain');
    g.ev.push({ k: 'chain', n: g.chain, x: at.x, z: at.z, h: 110 });
  }
  function chainLost(g, why) { if (g.chain > 0) g.ev.push({ k: 'chainLost', n: g.chain, why }); g.chain = 0; g.p.smokeHeld = 0; }

  function douse(g, s, byJet, bull) {
    if (!s.lit) return;
    const hp = hitPoint(s);
    if (s.kind === 'boss') return;
    s.lit = false; s.passed = true; g.kills++;
    if (bull) {
      // 正中烟头：这一发不花水，回一口气，短暂慢动作
      g.bulls++; g.p.breath = Math.min(g.k.breath, g.p.breath + CFG.BULL_AIR); g.slow = .35;
      if (g.p.holding) chainUp(g, s);
      addPts(g, 50, hp.x, hp.z, hp.h + 40, 'bull'); g.ev.push({ k: 'bull', x: hp.x, z: hp.z, h: hp.h + 70 });
    } else addPts(g, 15, hp.x, hp.z, hp.h + 40, 'douse');
    if (s.kind !== 'scooter' && s.kind !== 'terrace') { s.st = .7; s.state = 'stun'; }
    if (bull && !g.dash) joinParade(g, s);      // 烟里冲刺：点烟头只灭烟，拉人跑靠哨子（用户说灭烟和拉人都是点一下，分不清、学起来累）
    steam(g, hp);
    // 烟头灭了，他身边还没散的烟也一起变成水汽：这里就成了一个换气点
    // 带了水箱：化掉的范围大一倍，连旁边那条道的烟也一起化掉
    const sp = g.k.splash;
    for (const q of g.puffs) if (q.kind !== 1 && Math.abs(q.x - hp.x) < 70 * sp && Math.abs(q.z - s.z) < .8 + .7 * (sp - 1)) { q.kind = 1; q.a = .4; q.life = Math.min(q.life, q.age + .5); }
    g.ev.push({ k: 'hit', x: hp.x, z: hp.z, h: hp.h, s, bull: !!bull });
    // 原来每滋中一下整个世界停 0.05 秒（正中 0.09 秒）：跑着的时候背景一顿，看着像掉帧（2026-11-15）。
    // 现在路上滋中不停；正中照旧慢放 0.35 秒（上面的 g.slow），慢放是匀的，不顿。打老板（镜头不动）还停一下
  }
  function steam(g, hp) { for (let i = 0; i < 8; i++) puff(g, hp.x + (g.rng() - .5) * 14, hp.z, hp.h + 6, (g.rng() - .5) * 50, 0, 30 + g.rng() * 30, 6, 26, .9, .7, 1); }

  // 自动瞄准：前方、同一条道优先；身后的人不选
  function pickTarget(g) {
    const p = g.p; let best = null, bd = Infinity;
    for (const s of g.smokers) {
      if (!targetable(s)) continue;
      const dx = s.x - p.x; if (dx < -20 || dx > CFG.RANGE) continue;
      if (s.x - g.camX > VW + 10) continue;
      const cost = Math.max(0, dx) + Math.abs(s.z - p.z) * 70;
      if (cost < bd) { bd = cost; best = s; }
    }
    return best;
  }

  const muzzle = p => ({ x: p.x + 20, z: p.z, h: 32 });   // 举枪姿势的枪口

  // shot：true = 自动瞄最近的；{ s, bull } = 点中了某个烟民（bull 表示点得准，正中烟头）；{ x, z } = 点在一团烟上
  function fire(g, shot) {
    const p = g.p;
    if (g.shotCd > 0) return;
    if (shot && shot.boss) { if (shot.boss.lit && shot.boss.state === 'smoke') bossTap(g, shot); return; }
    if (shot && shot.ring) {
      if (shot.ring.life > 0) { const q = shot.ring; q.life = 0; g.ringsPop = (g.ringsPop || 0) + 1; if (q.boss) q.boss.popped++; g.shots++; g.shotCd = CFG.SHOT_CD; p.sprayT = .28; p.aim = Math.sign(Math.round(q.z - p.z)); addPts(g, 20, q.x, q.z, q.h, 'ring'); g.ev.push({ k: 'shoot' }); g.ev.push({ k: 'ringPop', x: q.x, z: q.z, h: q.h }); }
      return;
    }
    if (shot && shot.x != null && !shot.s) return steamAt(g, shot.x, shot.z);
    let tgt = shot && shot.s && targetable(shot.s) && shot.s.x - p.x > -30 && shot.s.x - p.x < CFG.RANGE + 40 ? shot.s : null;
    const bull = !!(tgt && shot.bull), free = bull || (g.power && g.power.kind === 'soaker');
    if (!tgt) tgt = g.target;
    if (!tgt) { g.ev.push({ k: 'noTarget' }); return; }
    if (!free && g.water < 1) { g.ev.push({ k: 'dry' }); return; }
    const m = muzzle(p), h = hitPoint(tgt);
    const tvx = tgt.vx || 0, dist = Math.hypot(h.x - m.x, (h.z - m.z) * LD, h.h - m.h), t = dist / CFG.DROP_V;
    const ax = h.x + tvx * t, dx = ax - m.x, dz = (h.z - m.z) * LD, dh = h.h - m.h, n = Math.hypot(dx, dz, dh) || 1;
    if (!free) g.water--;
    g.shots++; g.shotCd = free && !bull ? .16 : CFG.SHOT_CD; p.sprayT = .28; p.aim = Math.sign(Math.round(tgt.z - p.z));
    const id = ++g.shotId;
    for (let i = 0; i < 4; i++) {
      const v = CFG.DROP_V * (1 - i * .06), j = (g.rng() - .5) * .05;
      g.drops.push({ x: m.x, z: m.z, h: m.h, vx: dx / n * v, vz: (dz / n + j) * v / LD, vh: (dh / n + j) * v, life: (CFG.RANGE + 100) / CFG.DROP_V + .06, hit: false, shot: id, bull });
    }
    g.ev.push({ k: 'shoot' });
  }
  // 往一团烟上滋：烧出一个水汽洞，可以在里面换气
  function steamAt(g, x, z) {
    if (g.water < 1) { g.ev.push({ k: 'dry' }); return; }
    let n = 0;
    for (const q of g.puffs) if (q.kind !== 1 && Math.abs(q.x - x) < CFG.STEAM_R * g.k.splash && Math.abs(q.z - z) < .75 + .7 * (g.k.splash - 1)) { q.kind = 1; q.a = .42; q.life = Math.min(q.life, q.age + .6 + g.rng() * .3); n++; }
    if (!n) { g.ev.push({ k: 'noTarget' }); return; }
    g.water--; g.shots++; g.shotCd = CFG.SHOT_CD; g.p.sprayT = .28; g.p.aim = Math.sign(Math.round(z - g.p.z));
    g.ev.push({ k: 'shoot' }); g.ev.push({ k: 'steam', x, z, h: HEAD });
  }

  /* 撞上（docs/24，2026-11-16）：踉跄一下，从它旁边挤过去，不会一直被堵在后面；同时算一次失误（mistake），大烟雾扑到身后。
   * 中间试过「憋着气撞上人就挤过去」（docs/22 的 A 第二版）：按住憋气又快、又不怕烟、人也挡不住，用户一条道直走就打到第二个老板，
   * 换道没了用处；改成「挤过去掉一半气」又看不出来。现在撞上就是失误，后果画面上看得见 */
  function bump(g, b) {
    const p = g.p;
    if (sidestep(g, b)) return;
    const fresh = !(g.dive && p.inv > 0);      // 刚失误过（那一下的无敌时间里）再撞上：照样挡住，不算第二次
    p.bump = CFG.BUMP_T; p.v = 0;
    if (fresh) { g.hurt = 'bump'; g.hurtT = g.t; dropParade(g); mistake(g); }
    if (b.t === 'prop') { squeeze(g, b); g.ev.push({ k: 'bump', x: p.x + 16, z: p.z, h: 70 }); return; }
    const s = b.o;
    if (b.t === 'ped') { s.aside = .6; s.say = 1; g.ev.push({ k: 'bumpPed', x: s.x, z: s.z, h: 80 }); return; }
    // 撞上烟民：先冲你脸上吐一口，然后让开（失误的无敌时间里吸进去不呛）
    if (!s.aside) {
      s.aside = .8; s.zTo = s.z < 1 ? -.9 : s.z > 1 ? 2.9 : (g.rng() < .5 ? -.9 : 2.9);
      const B = BODY[s.kind];
      const mo = s.mouth || B.mouth;
      for (let i = 0; i < 6; i++) puff(g, s.x + mo[0] - 6, s.z, mo[1] - 4, -60 - g.rng() * 40, (g.rng() - .5) * .3, 4, 10, CFG.EX_R, 2.6, CFG.EX_A);
      g.ev.push({ k: 'bumpSmoker', x: s.x, z: s.z, h: 84, s });
    }
  }
  /* 失误（docs/24）：撞上东西或人、被滑板车撞。大烟雾往前扑一大截（BUMP_LUNGE，顶栏上那颗头一下子跳近、四周一圈红），
   * 它已经在 CATCH_GAP 以内（画面左边看得见它的脸，顶栏那一格是红的）时撞上，就被追上：「看得见它的时候别撞」。
   * 试过的（2026-11-16，机器人各 30 局）：
   *   呛到、气用光也算：用户手机上一局会呛五到七次、气用光四到九次，「像真人」的机器人只活 40 秒，所以只有撞上算；
   *   撞一下就扑到身后 100 到 140、之后 5 秒里再撞就抓（地铁跑酷的警察）：机器人一局要撞 8 到 15 次，用户一局 170 秒撞过 13 次，
   *   普通玩家机器人 74 到 140 秒、像真人 80 秒，太狠。
   * 第一局 3200 以前只扑不抓（教学）。CLASSIC 规则不走这里（返回 false） */
  function mistake(g) {
    if (!g.dive) return false;
    const S = g.smog, p = g.p;
    p.inv = Math.max(p.inv, CFG.TRIP_INV);
    if (!S.awake || g.over) return true;
    g.mistakes = (g.mistakes || 0) + 1;
    // 烟里冲刺：只有一条规则，扑过来的这一截够得着你才算追上（它本来就离你不到 BUMP_LUNGE）。顶栏上那一截一直标着（render.js 的 drawHud）
    const reach = g.dash ? g.k.lunge : CFG.CATCH_GAP;
    if (S.gap < reach && !(g.tutorial && p.x < 3200)) { S.x = p.x; S.gap = 0; g.ev.push({ k: 'smogCatch', x: p.x, z: p.z }); return true; }
    S.x += g.dash ? g.k.lunge : CFG.BUMP_LUNGE; S.gap = p.x - S.x;
    g.ev.push({ k: 'smogLunge', x: p.x, z: p.z, close: S.gap < reach });
    return true;
  }

  /* 侧身（局外升级）：要撞上的时候，侧过身从它旁边挤过去，不停、不挨那口烟。冷却由等级定。
   * 人还在原来那条道上，只是身子往空着的一边偏出去六成条道，挤过去就回正（p.slip、画面上的 p.zo）。
   * 原来是整个人换到旁边那条道、往哪边随机：玩家没滑，人却换了道，看着像自己乱动（2026-11-15）。
   * 旁边两条道都堵着（三条道全堵的墙）照旧挤不过去 */
  function sidestep(g, b) {
    const p = g.p;
    if (!g.k.dodge || g.dodgeCd > 0 || !(g.k.dodgeN > 0) || p.stun > 0 || !b || !b.o) return false;
    const opts = [1, -1].filter(d => { const l = p.lane + d; return l >= 0 && l <= 2 && laneFree(g, l, b.x0 - PW, b.x1 + PW); });
    if (!opts.length) return false;
    // 往外（画面下方）偏，人画在它前面、看得见；外面那条道堵着才往里偏（那时人会被它挡住一下）
    const side = opts[0];
    p.slip = { o: b.o, side, t: 0 }; g.dodgeCd = g.k.dodge; g.k.dodgeN--; g.dodges = (g.dodges || 0) + 1;
    g.ev.push({ k: 'dodge', x: p.x, z: p.z + side * .6, h: 90 });
    return true;
  }

  /* 烟里冲刺：人不挡路（blockers）。冲到人跟前，他往路边让开、说一句；你不停、不算失误。
   * 没憋气就冲过烟民：他一口烟正喷在你脸上，接着吸就会呛（和平常在烟里喘气一样算）。狗跟着主人一起让开 */
  function brushPast(g) {
    const p = g.p;
    const hit = (x, z, hw) => Math.abs(z - p.z) < .5 && p.x + PW > x - hw && p.x - PW < x + hw;
    for (const s of g.smokers) {
      if (s.brushed || !s.awake || s.state !== 'smoke' || s.kind === 'terrace' || s.kind === 'scooter' || s.kind === 'boss') continue;
      if (!hit(s.x, s.z, BODY[s.kind].half)) continue;
      s.brushed = true; s.aside = .8; s.zTo = s.z < 1 ? -.9 : s.z > 1 ? 2.9 : (p.z <= 1 ? 2.9 : -.9);
      if (!p.holding && s.lit) { const mo = s.mouth || BODY[s.kind].mouth; for (let i = 0; i < 4; i++) puff(g, s.x + mo[0] - 6, s.z, mo[1] - 4, -60 - g.rng() * 40, (g.rng() - .5) * .3, 4, 10, CFG.EX_R, 2.2, CFG.EX_A); }
      g.ev.push({ k: 'brush', x: s.x, z: s.z, h: 84, s, holding: p.holding });
    }
    for (const e of g.peds) {
      if (e.brushed || !e.on || e.gone || !hit(e.x, e.z, e.half || 12)) continue;
      e.brushed = true; e.aside = .6; g.ev.push({ k: 'brush', x: e.x, z: e.z, h: 80, ped: true });
    }
  }
  // 撞上固定的东西以后侧身挤过去：往空着的那边偏（两边都空先往外），两边都堵着也挤，只是慢一点（踉跄完才动）
  function squeeze(g, b) {
    const p = g.p, free = [1, -1].filter(d => { const l = p.lane + d; return l >= 0 && l <= 2 && laneFree(g, l, b.x0 - PW, b.x1 + PW); });
    const side = free.length ? free[0] : (p.lane === 2 ? -1 : 1);
    p.slip = { o: b.o, side, t: 0 };
  }
  // 气用光：大喘一口，慢下来，大烟雾扑近；喘的时候吸进的烟算 GASP_X 倍
  function gasp(g) {
    const p = g.p;
    p.breath = 0; p.holding = false; p.holdT = 0; p.gasp = CFG.GASP_T; g.hurt = 'gasp'; g.hurtT = g.t; chainLost(g, 'gasp'); dropParade(g);
    g.ev.push({ k: 'gasp' });
    if (g.smog.awake && !g.locked) g.smog.x += CFG.GASP_LUNGE;      // 气用光不算失误（docs/24）：真人一局会气用光四到九次，算失误的话一分钟能被追上好几次
  }
  function tryLane(g, d) {
    const p = g.p, to = clamp(p.lane + d, 0, 2);
    if (to === p.lane) { g.ev.push({ k: 'laneEdge', d }); return; }
    if (!laneFree(g, to, p.x - PW - 2, p.x + PW + 4)) { g.ev.push({ k: 'laneBlocked', z: to }); return; }
    p.lane = to; p.slip = null; g.ev.push({ k: 'lane' });
  }

  function stepPlayer(g, dt, inp) {
    const p = g.p, pow = g.power && g.power.kind;
    p.sprayT = Math.max(0, (p.sprayT || 0) - dt); p.landT = Math.max(0, (p.landT || 0) - dt);
    p.gasp = Math.max(0, p.gasp - dt); p.bump = Math.max(0, p.bump - dt); p.stun = Math.max(0, p.stun - dt); p.inv = Math.max(0, p.inv - dt);
    g.dodgeCd = Math.max(0, g.dodgeCd - dt);
    const lane = inp.lane || g.pendLane || 0; g.pendLane = 0;      // pendLane：开场里滑的那一下（stepIntro）
    if (lane && p.stun <= 0) tryLane(g, lane);
    // 憋气 = 冲刺
    const want = inp.hold && p.gasp <= 0 && p.breath > 0 && p.stun <= 0;
    if (want) {
      if (!p.holding) { g.ev.push({ k: 'holdOn' }); p.smokeT = null; p.cleared = false; p.smokeHeld = 0; }
      p.holding = true; p.holdT += dt; p.breath -= dt;
      if (g.dens >= g.k.dmin) { p.smokeT = g.t; p.cleared = false; if (!g.locked) p.smokeHeld = (p.smokeHeld || 0) + dt; }      // smokeHeld：这一口在烟里憋了几秒（憋气版按它吹）。打老板时不算：不会滋水的人靠憋老板的烟把大烟雾一直吹回去，局永远结束不了      // 这一口气里最后一次头在烟里是什么时候
      // 头刚冲出烟、这一口已经冲过人：PERFECT 的 0.3 秒从这一刻开始（画面上教几次，见 main.js 的 clearSmoke）
      else if (g.dive && (g.chain > 0 || (g.breathy && p.smokeHeld >= CFG.B_MIN)) && p.smokeT != null && !p.cleared) { p.cleared = true; g.ev.push({ k: 'clearSmoke', x: p.x, z: p.z }); }
      if (p.breath <= 0) gasp(g);
    } else {
      /* PERFECT：憋着冲过烟、头一出烟 0.3 秒之内松手，这一口吹得远一半（2026-11-16）。
       * 原来什么时候松手都一样，「憋气」这个招牌动作没有手上的讲究；现在出烟那一下松手有回报，憋太久白耗气、在烟里就松会呛 */
      if (p.holding) { g.ev.push({ k: 'holdOff' }); p.wait = CFG.REGEN_WAIT; p.perfect = g.dive && p.smokeT != null && g.dens < g.k.dmin && g.t - p.smokeT < CFG.PERFECT_T; }
      p.holding = false; p.holdT = 0; p.wait = Math.max(0, (p.wait || 0) - dt);
      if (p.gasp > 0) p.breath = Math.min(g.k.breath, p.breath + 2 * dt);
      else if (g.dens < g.k.dmin || pow === 'bubble') {
        if (p.wait <= 0) p.breath = Math.min(g.k.breath, p.breath + CFG.REGEN * g.k.regen * (g.phase === 'dawn' ? CFG.DAWN_REGEN : 1) * dt);      // 刚松手先喘一下，过一会儿才开始回
        // 在干净空气里喘上这一口，连冲入账，顺便把大烟雾吹退一点
        if (g.chain > 0 || (g.breathy && p.smokeHeld >= CFG.B_MIN)) {
          // 潜水规则：憋得越久、冲过的人越多，这一口吹得越远（1 个 10、3 个 90、5 个 250），最远甩开 GAP_MAX
          const n = g.chain, secs = g.breathy ? p.smokeHeld || 0 : 0, v = 20 * n * n + Math.round(40 * secs * secs), perfect = !!p.perfect;
          const push = (g.breathy ? CFG.B_PUSH * secs + CFG.PUSH2 * n * n : g.dive ? CFG.PUSH2 * n * n : CFG.BANK_PUSH * n) * g.k.bank * (perfect ? CFG.PERFECT_X : 1) * (1 + CFG.PARADE_PUSH * paradeN(g)); g.chain = 0; p.smokeHeld = 0; g.banked += n; g.score += v;
          if (g.breathy) g.heldSecs = (g.heldSecs || 0) + secs;
          if (perfect) g.perfects = (g.perfects || 0) + 1;
          const gap0 = g.smog.gap;
          if (g.smog.awake) { g.smog.x = Math.max(g.smog.x - push, p.x - CFG.GAP_MAX); g.smog.gap = p.x - g.smog.x; }
          // 潜水规则：一口气冲过 3 个以上，再给 (连冲数 - 1)² 的金币（3 个 4，4 个 9，5 个 16）。贪那一下除了把大烟雾吹远，还有实打实的回报。
          // 先试过 n²：每局金币普通玩家多两成、高手多三成，升级和帽子会比 docs/12 定的节奏快不少，减成这样（2026-11-15）
          // 最多 36（一口气 7 个）：能憋着挤过人以后，一口气冲十来个不稀奇，(n-1)² 一下给 100 个，金币涨得太快（2026-11-16）
          // 憋气版：一口在烟里憋满 2 秒起给金币（2 秒 4 个、3 秒 9 个、4 秒 16 个），和连冲的金币取大的
          const bonus = Math.max(g.dive && n >= 3 ? Math.min(CFG.BANK_COINS, (n - 1) * (n - 1)) : 0, secs >= 2 ? Math.min(CFG.BANK_COINS, Math.floor(secs * secs)) : 0); g.coinsGot += bonus;
          g.ev.push({ k: 'bank', n, secs, v, coins: bonus, perfect, push: g.smog.awake ? g.smog.gap - gap0 : 0, x: p.x, z: p.z, h: 120 });
        }
        p.perfect = false;      // 只算松手后第一次喘气
      }
    }
    g.speed = (CFG.V0 + (CFG.V1 - CFG.V0) * clamp(p.x / CFG.V_DIST, 0, 1)) * (1 + CFG.V_DAY * Math.max(0, (g.day || 0) - 2));      // V_DAY（docs/35，试验）：第 4 天起每天再快多少
    // 烟里冲刺：憋着气钻进烟里才是大加速，烟越浓越快（到 TURBO_D 封顶）；在干净空气里憋气只快一点。p.turbo 是画面用的（0 到 1，平滑过）
    const sm = g.dash && p.holding && g.dens >= g.k.dmin ? clamp(g.dens / CFG.TURBO_D, 0, 1) : 0;
    if (g.dash) {
      const was = p.turbo || 0; p.turbo = was + (sm - was) * Math.min(1, dt * (sm > was ? 10 : 4));
      if (sm > .3 && !p.turboOn) { p.turboOn = true; g.ev.push({ k: 'turbo', x: p.x, z: p.z, h: 100 }); } else if (sm <= 0 && p.turbo < .1) p.turboOn = false;
    }
    const boost = g.dash ? (p.holding ? (CFG.DASH_AIR + CFG.DASH_SMOKE * sm) * g.k.sprint : 1)
      : p.holding && !g.breathy ? (CFG.BOOST0 + (CFG.BOOST1 - CFG.BOOST0) * clamp(p.holdT / CFG.BOOST_T, 0, 1)) * g.k.sprint : 1;      // 憋气版憋着一点都不加速（冲刺鞋也不）
    let tv = g.speed * boost * (p.gasp > 0 ? CFG.GASP_SLOW : 1) * (pow === 'skate' ? CFG.SKATE_V : 1);
    // 在滑板上呛到：人不下板，只是不蹬了，慢慢往前溜（原来是当场停住、播撞墙的那套踉跄，看着像被人挡住）
    if (p.bump > 0 || g.over) tv = 0;
    else if (p.stun > 0) tv = pow === 'skate' ? g.speed * CFG.SKATE_COUGH : 0;
    p.v += (tv - p.v) * Math.min(1, dt * 8);
    let nx = p.x + p.v * dt;
    if (pow === 'skate') skateAhead(g);
    // 侧身挤过去的那一个：已经走过去了（或者它让开了、主角换了道）就回正，最长 1.5 秒
    if (p.slip) {
      p.slip.t += dt;
      const sb = blockers(g, p.lane).find(b => b.o === p.slip.o);
      if (!sb || sb.x1 < p.x - PW - 4 || p.slip.t > 1.5) p.slip = null;
    }
    for (const b of blockers(g, p.lane)) {
      if (p.hop && jumpable(b)) continue;      // 在空中，从它上面过（矮东西，或者蹲下的人）
      if (p.slip && b.o === p.slip.o) continue;      // 正侧着身从它旁边挤过去
      if (nx + PW > b.x0 && p.x - PW < b.x1 && p.x < b.x0 + 4) {
        if (p.bump <= 0) bump(g, b);
        if (p.slip && b.o === p.slip.o) continue;      // 刚侧身：这一帧照常往前走
        nx = Math.min(nx, b.x0 - PW);
      }
    }
    if (g.locked && g.boss && nx > g.boss.lockX) nx = Math.max(p.x, g.boss.lockX);
    p.x = Math.max(p.x, nx);
    if (g.dash) brushPast(g);
    if (p.hop) {
      const H = p.hop, u = (p.x - H.x0) / (H.x1 - H.x0); H.t += dt;
      if (u >= 1 || H.t > 1) { p.hop = null; p.hopH = 0; p.landT = .14; g.ev.push({ k: 'land', x: p.x, z: p.z, big: H.big }); }      // landT：落地屈膝那一帧再停一下
      else p.hopH = H.H * 4 * u * (1 - u);
    }
    const lt = CFG.LANE_T * g.k.laneT;      // 冲刺鞋换道快
    p.z += clamp(p.lane - p.z, -dt / lt, dt / lt);
    p.zo = (p.zo || 0) + ((p.slip ? p.slip.side * .6 : 0) - (p.zo || 0)) * Math.min(1, dt * 14);      // 侧身时身子偏出去多少（只管画面）      // 侧身、挤过去时身子偏出去多少（只管画面）
    if (p.v > 5) p.walk += dt * p.v * .07;
    g.shotCd = Math.max(0, g.shotCd - dt);
    g.target = pickTarget(g);
    if (inp.shot) fire(g, inp.shot);
    else if (pow === 'soaker' && g.target && g.shotCd <= 0) fire(g, { s: g.target });
  }


  // 吐烟方向：朝着主角（x 和纵深一起算）
  function aimAt(g, s, range) {
    const p = g.p, dx = p.x - s.x, dz = (p.z - s.z) * LD * 2.4, d = Math.hypot(dx, dz);
    if (Math.hypot(dx, dz / 2.4) < range && d > 1) return [dx / d, dz / d];
    return [-1, 0];
  }
  function exhale(g, s, B, v, r1, life, a, kind) {
    const mo = s.mouth || B.mouth;
    puff(g, s.x + mo[0] + s.exx * 8, s.z + s.exz * 6 / LD, mo[1], s.exx * v + (g.rng() - .5) * 26, (s.exz * v + (g.rng() - .5) * 46) / LD, (g.rng() - .5) * 10, 8, r1, life, a, kind);
  }

  /* ---------- 雪茄老板 ----------
   * 守在地铁口，主角被拦在 lockX。他轮流出三招，每招亮出一个要点的地方：
   *   ring    吐两个烟圈      → 把两个都点破（或者憋气冲散）
   *   wave    挥舞雪茄        → 点那颗晃动的火星
   *   lighter 掏打火机重新点烟 → 点火苗；没点到，他就朝两条道喷一大口（先红道预警）
   * 打断三次，他浑身湿透让路，大烟雾被吹回最远。打的时候大烟雾只慢慢挪，但每呛一口还是会扑近。
   */
  const BOSS_MOVES = ['ring', 'wave', 'lighter'], BOSS_T = { ring: 3, wave: 2.6, lighter: 1.9 };
  function bossNext(g, s) {
    s.mi = (s.mi + 1) % BOSS_MOVES.length; s.phase = BOSS_MOVES[s.mi]; s.n = 0; s.popped = 0;
    s.pt = s.pt0 = BOSS_T[s.phase] * Math.max(.6, 1 - .12 * (s.day || 0));
    g.ev.push({ k: 'bossMove', m: s.phase, x: s.x, z: s.z, h: 110 });
  }
  function bossHurt(g, s, at) {
    s.hp--; s.hitT = .5;
    if (g.smog.awake) g.smog.x -= 30;
    addPts(g, 60, s.x, s.z, 100, 'boss'); steam(g, { x: at.x, z: s.z, h: at.h });
    g.hitstop = .08; g.slow = .3;
    if (s.hp > 0) { s.phase = 'cough'; s.pt = 1.3; g.ev.push({ k: 'bossHit', x: at.x, z: s.z, h: at.h, hp: s.hp }); return; }
    // 打完了：让路，大烟雾吹回最远，撒一把金币
    s.lit = false; s.state = 'stun'; s.st = 1.1; g.locked = false; g.boss = null; g.kills++; g.bossDown = (g.bossDown || 0) + 1;
    if (g.smog.awake) g.smog.x = g.p.x - CFG.GAP_MAX;
    g.coinsGot += 60; g.score += 500;
    for (const q of g.puffs) if (q.kind !== 1) { q.kind = 1; q.a = .4; q.life = Math.min(q.life, q.age + .5); }
    g.rings.length = 0;
    g.ev.push({ k: 'bossDown', x: s.x, z: s.z, h: 90 });
  }
  // 点老板：只有点在他正亮着的那个点上才算
  function bossTap(g, shot) {
    const p = g.p, s = shot.boss;
    g.shots++; g.shotCd = CFG.SHOT_CD; p.sprayT = .28; p.aim = Math.sign(Math.round(s.z - p.z)); g.ev.push({ k: 'shoot' });
    if ((shot.part === 'ember' && s.phase === 'wave') || (shot.part === 'flame' && s.phase === 'lighter')) bossHurt(g, s, { x: shot.x, h: shot.h });
    else g.ev.push({ k: 'bossBlock', x: s.x, z: s.z, h: 96 });
  }
  function stepBoss(g, s, dt) {
    const p = g.p, B = BODY.boss, L = g.boss;
    if (s.phase === 'wait') {
      if (L && L.s === s && p.x > L.lockX - 200 && !g.attract) { s.phase = 'enter'; s.awake = true; s.x = Math.max(s.x, g.camX + VW + 30); g.locked = true; g.ev.push({ k: 'bossIn' }); }
      return;
    }
    s.walk += dt * 4; s.pt -= dt; s.wf = Math.floor(g.t * 7) % 4; s.ex = Math.max(0, (s.ex || 0) - dt);
    const home = L ? L.lockX + 138 : s.x, mo = B.mouth;
    switch (s.phase) {
      case 'enter':
        s.x = Math.max(home, s.x - 170 * dt);
        if (s.x <= home) bossNext(g, s);
        break;
      case 'ring':
        // 站到主角那条道上，隔一会儿吐一个
        s.z += clamp(p.lane - s.z, -dt * 1.6, dt * 1.6);
        if (s.n < 2 && s.pt <= s.pt0 - .7 - s.n * .95) {
          s.n++; s.ex = .3;
          g.rings.push({ x: s.x + mo[0] - 10, z: Math.round(s.z), h: mo[1], vx: -CFG.RING_V * 1.15, life: CFG.RING_LIFE, age: 0, boss: s });
          g.ev.push({ k: 'ring', x: s.x, z: s.z, h: mo[1] });
        }
        if (s.pt <= 0) { if (s.popped >= 2) bossHurt(g, s, { x: s.x + mo[0], h: mo[1] }); else bossNext(g, s); }
        break;
      case 'wave':
        // 没点到火星：他把烟灰朝你这条道一甩
        if (s.pt <= 0) {
          for (let i = 0; i < 9; i++) puff(g, s.x - 26, p.lane + (g.rng() - .5) * .3, 34 + (g.rng() - .5) * 14, -250 - g.rng() * 70, 0, 0, 16, 58, 1.6, .42, 3);
          g.ev.push({ k: 'bossFlick', x: s.x, z: s.z, h: 80 }); bossNext(g, s);
        }
        break;
      case 'lighter':
        if (s.pt <= 0) { const a = p.lane, b2 = a === 1 ? (g.rng() < .5 ? 0 : 2) : 1; s.lanes = [a, b2]; s.phase = 'charge'; s.pt = 1.1; g.ev.push({ k: 'bossCharge', x: s.x, z: s.z, h: 110 }); }
        break;
      case 'charge':
        if (s.pt <= 0) { s.phase = 'blow'; s.pt = 1.2; s.exAcc = 0; g.ev.push({ k: 'bossBlow' }); }
        break;
      case 'blow':
        s.exAcc -= dt;
        if (s.exAcc <= 0) {
          // 一道扫过去的烟浪：飞得快、散得也快，躲开那两条道就没事
          s.exAcc = .045;
          for (const ln of s.lanes) puff(g, s.x - 24, ln + (g.rng() - .5) * .25, 36 + (g.rng() - .5) * 16, -320 - g.rng() * 80, (g.rng() - .5) * .15, 0, 18, 62, 1.5, .4, 3);
        }
        if (s.pt <= 0) bossNext(g, s);
        break;
      case 'cough':
        if (s.pt <= 0) bossNext(g, s);
        break;
    }
  }

  function stepSmokers(g, dt) {
    const p = g.p, x0 = g.camX - 260, x1 = g.camX + VW + 220;
    for (const s of g.smokers) {
      if (s.state === 'gone') continue;
      if ((s.kind === 'walk' || s.kind === 'ahead') && !s.awake && s.x < g.camX + VW + 30) s.awake = true;
      if (s.kind !== 'scooter' && s.kind !== 'boss' && (s.x < x0 || s.x > x1 || !s.awake)) continue;
      const B = BODY[s.kind];
      if (s.doom > 0) { s.doom -= dt; if (s.doom <= 0) { s.doom = 0; douse(g, s, true); } }
      s.hitT = Math.max(0, s.hitT - dt);
      if (s.kind === 'boss' && s.state === 'smoke') { stepBoss(g, s, dt); continue; }
      // 被撞的先冲你吐一口再让开
      if (s.aside > 0) { s.aside = Math.max(.001, s.aside - dt); if (s.aside < .3 || s.state !== 'smoke') s.z += (s.zTo - s.z) * Math.min(1, dt * 5); }
      // 滑板从头顶飞过去时蹲着：不走、不踱步、不吐烟，烟头还冒着（位置按蹲下的图）
      if (s.duck > 0) { s.duck -= dt; s.nextEx = Math.max(s.nextEx, CFG.EX_TELE + .3); s.vapeT = Math.max(s.vapeT, CFG.VAPE_TELE + .3); s.lock = false; }
      if (s.kind === 'scooter') {
        s.x += s.vx * dt; s.walk += dt * 22;
        if (s.lit) { s.emit -= dt; if (s.emit <= 0) { s.emit = .04; puff(g, s.x + 14, s.z, 30, 20, 0, 6, 9, 46, 3.4, .32); } }
        if (s.x < g.camX - 120) s.state = 'gone';
        if (!g.attract && p.inv <= 0 && !(g.power && g.power.kind === 'skate') && Math.abs(s.z - p.z) < .5 && Math.abs(s.x - p.x) < 22) {
          p.stun = CFG.STUN_T; p.inv = 1.2; p.v = 0; p.holding = false; p.holdT = 0; g.hurt = 'scooter'; g.hurtT = g.t; chainLost(g, 'scooter'); mistake(g); g.ev.push({ k: 'scooterHit', x: p.x, z: p.z, h: 80 });
        }
        continue;
      }
      // 灭了烟的人靠到人行道边上走开，走出画面才算走了；原来往 -1.4 走（店面玻璃上）一路变淡，像鬼影飘在橱窗上（2026-11-16）
      if (s.state === 'stun') { s.st -= dt; if (s.st <= 0) { s.state = 'leave'; s.lt = 0; s.zTo = s.z < .9 ? -.35 : s.z > 1.1 ? 2.35 : p.z <= 1 ? 2.35 : -.35; } continue; }
      if (s.state === 'leave') {
        s.z += (s.zTo - s.z) * Math.min(1, dt * 2.2); s.x += (s.kind === 'walk' ? -40 : 40) * dt; s.walk += dt * 7; s.lt += dt;
        if (s.x < g.camX - 50 || s.x > g.camX + VW + 50) { s.state = 'gone'; continue; }
        // 走到路口（有车横穿）或者走了 6 秒还在画面里，才慢慢淡掉
        if (s.lt > 6 || g.crosses.some(X => s.x > X.x - 24 && s.x < X.x + X.w + 24)) { s.fade -= dt / .8; if (s.fade <= 0) s.state = 'gone'; }
        continue;
      }
      if (s.kind === 'walk' || s.kind === 'ahead') {
        const fast = s.look === 'commuter' ? (s.day ? 2.2 : 1.8) : 1;      // 赶路的通勤族：迎面来得很快（第一天慢两成，先认识他）
        const v = s.kind === 'walk' ? -CFG.WALK_V * fast : CFG.AHEAD_V;
        // 前面被挡住就停下等
        const ahead = blockers(g, Math.round(s.z), true).some(b => b.o !== s && (v < 0 ? b.x1 < s.x && b.x1 > s.x - 30 : b.x0 > s.x && b.x0 < s.x + 30)) || (v < 0 && Math.abs(s.z - p.z) < .5 && s.x - p.x < 30 && s.x > p.x);
        const stopAt = g.crosses.find(X => X.phase !== 'green' && (v > 0 ? s.x < X.x && s.x + v * dt >= X.x - 14 : s.x > X.x + X.w && s.x + v * dt <= X.x + X.w + 14));
        s.vx = ahead || stopAt || s.aside > .3 || s.duck > 0 ? 0 : v;
        s.x += s.vx * dt; if (s.vx) s.walk += dt * 7 * (fast > 1 ? 1.6 : 1);
        if (s.x > g.len - 60 || s.x < -200) { s.state = 'gone'; continue; }
      }
      // 第一次有拍子时把他下一口挪到拍子上（一开始的间隔是随机的，大多数人在画面里只喷一两口，不挪的话街上看不出节奏）
      if (g.beat && !s.bsync) { s.bsync = true; s.nextEx = beatAfter(g, s.nextEx); s.vapeT = beatAfter(g, s.vapeT); }
      if (s.kind === 'vape') {
        s.vapeT -= dt;
        if (s.vapeT <= CFG.VAPE_TELE && !s.lock) { s.lock = true; [s.exx, s.exz] = aimAt(g, s, 260); }
        if (s.vapeT <= 0) { s.vapeT = beatAfter(g, CFG.VAPE_EVERY); s.ex = .35; s.lock = false; s.puffT = g.t; }
        if (s.ex > 0) { s.ex -= dt; s.exAcc -= dt; if (s.exAcc <= 0) { s.exAcc = .045; exhale(g, s, B, 90 + g.rng() * 50, CFG.VAPE_R, CFG.VAPE_LIFE, CFG.VAPE_A, 2); } }
        continue;
      }
      // 打电话的：在两条道之间来回踱，到头站一会儿
      if (s.pace && !s.aside && !(s.duck > 0)) {
        const P = s.pace; P.t -= dt; s.moving = false;
        if (P.t <= 0) {
          const to = P.dir > 0 ? P.b : P.a;
          s.z += clamp(to - s.z, -dt / .9, dt / .9); s.moving = true; s.walk += dt * 7;
          if (Math.abs(s.z - to) < .01) { s.z = to; P.dir = -P.dir; P.t = 1.3; }
        }
        s.lane = Math.round(s.z);
      }
      // 厨师：身边后厨的排气口冒白汽，无害，但会和他的烟混在一起
      if (s.chef) { s.stm = (s.stm || 0) - dt; if (s.stm <= 0) { s.stm = .13; puff(g, s.x + 20, s.z - .15, 48, -24 - g.rng() * 22, (g.rng() - .25) * .6, 18, 10, 46, 2.4, .5, 1); } }
      // 香烟：烟头一直冒；隔几秒朝你吐一口（吐之前锁定方向，画面上有预告）
      s.emit -= dt;
      if (s.emit <= 0) {
        s.emit = s.kind === 'terrace' ? .24 : .18;
        const cg = (s.duck > 0 && duckCig(s)) || s.cig || B.cig;
        puff(g, s.x + cg[0], s.z, cg[1], (g.rng() - .5) * 6, 0, 9, 4, CFG.TR_R, CFG.TR_LIFE, CFG.TR_A);
        if (B.cig2) puff(g, s.x + B.cig2[0], s.z, B.cig2[1], (g.rng() - .5) * 6, 0, 9, 4, CFG.TR_R, CFG.TR_LIFE, CFG.TR_A);
      }
      if (s.kind === 'terrace') continue;
      s.nextEx -= dt;
      if (s.nextEx <= CFG.EX_TELE && !s.lock) {
        s.lock = true;
        if (s.kind === 'ahead' || s.ring) { s.exx = -1; s.exz = 0; } else [s.exx, s.exz] = aimAt(g, s, 240);
      }
      if (s.nextEx <= 0) {
        s.nextEx = beatAfter(g, CFG.EX_EVERY + g.rng() * 1); s.ex = .42; s.lock = false; s.puffT = g.t;
        if (s.ring) { const mo = s.mouth || B.mouth; g.rings.push({ x: s.x + mo[0] - 8, z: s.z, h: mo[1], vx: -CFG.RING_V, life: CFG.RING_LIFE, age: 0 }); s.nextEx += .8; g.ev.push({ k: 'ring', x: s.x, z: s.z, h: mo[1] }); }
      }
      if (s.ex > 0 && s.ring) s.ex -= dt;
      else if (s.ex > 0) { s.ex -= dt; s.exAcc -= dt; if (s.exAcc <= 0) { s.exAcc = .055; const big = s.big ? 1.3 : 1; exhale(g, s, B, (80 + g.rng() * 40) / (big * big), CFG.EX_R * big, CFG.EX_LIFE * big, CFG.EX_A); } }
    }
  }

  /* ---------- 迎面走来的路人：不抽烟，但会挡路 ---------- */
  function stepPeds(g, dt) {
    for (const e of g.peds) {
      if (e.gone) continue;
      if (!e.on) { if (e.x < g.camX + VW + 40) e.on = true; else continue; }
      if (e.aside > 0) { e.aside -= dt; e.z += ((e.lane === 0 ? -.9 : e.lane === 2 ? 2.9 : 2.9) - e.z) * Math.min(1, dt * 5); if (e.aside <= 0) e.aside = .001; }
      if (e.duck > 0) e.duck -= dt;      // 滑板从头顶飞过去时蹲着，不往前走
      const blocked = !e.aside && blockers(g, e.lane, true).some(b => b.o !== e && b.x1 < e.x && b.x1 > e.x - 26);
      const stopAt = g.crosses.some(X => X.phase !== 'green' && e.x > X.x + X.w && e.x - e.v * dt <= X.x + X.w + 14);
      if (!blocked && !stopAt && !(e.duck > 0) && !(Math.abs(e.z - g.p.z) < .5 && e.x > g.p.x && e.x - g.p.x < 28 && !e.aside)) { e.x -= e.v * dt; e.walk += dt * 7; }
      if (e.x < g.camX - 80) e.gone = true;
    }
  }

  /* ---------- 路口红绿灯：主角走近才变红，保证每次都要停下来等一会儿 ---------- */
  function stepCrosses(g, dt) {
    const p = g.p;
    for (const X of g.crosses) {
      if (!X.trig) { if (X.x - p.x < 330 || g.attract) { X.trig = true; X.phase = 'red'; X.pt = CFG.RED_T + g.rng() * .8; } else continue; }
      X.pt -= dt;
      if (X.pt <= 0) {
        X.phase = { red: 'green', green: 'flash', flash: 'red' }[X.phase];
        X.pt = { red: CFG.RED_T + 1, green: CFG.GREEN_T, flash: CFG.FLASH_T }[X.phase];
        if (X.phase === 'green' && !g.attract && Math.abs(X.x - p.x) < 300) g.ev.push({ k: 'walk', x: X.x, z: 2, h: 90 });
      }
      // 红灯时横街上有车开过（只是画面）
      if (X.phase === 'red' && Math.abs(X.x - p.x) < 600) {
        X.sp -= dt;
        if (X.sp <= 0) { X.sp = .7 + g.rng() * .9; const dir = g.rng() < .5 ? 1 : -1; X.cars.push({ x: X.x + (dir > 0 ? 34 : 86), z: dir > 0 ? -3 : 4.5, vz: dir * (5 + g.rng() * 2), c: ['taxi', 'taxi', '#e85d4a', '#3f7fd8', '#f7f8f5'][(g.rng() * 5) | 0] }); }
      }
      for (let i = X.cars.length - 1; i >= 0; i--) { const c = X.cars[i]; c.z += c.vz * dt; if (c.z > 5 || c.z < -3.5) X.cars.splice(i, 1); }
    }
  }

  /* 浓烟段：走近了才把烟铺上去（三条道，每 26 一团），AIR 格栅那条道前后空出一块。快走到时报一声，画面上提醒先吸满一口 */
  const HAZE_R = 46;
  function stepHaze(g) {
    const p = g.p;
    for (const z of g.hazes) {
      if (!z.made && z.x0 - g.camX < VW + 220) {
        z.made = true;
        for (let x = z.x0; x <= z.x1; x += 26) for (let L = 0; L < 3; L++) {
          if (z.lanes && !z.lanes.includes(L)) continue;
          if (z.pockets.some(q => q.z === L && Math.abs(q.x - x) < q.w / 2 + HAZE_R * .9)) continue;
          const edge = Math.min(1, (x - z.x0 + 20) / 70, (z.x1 - x + 20) / 70);      // 两头淡一点，不是一刀切的墙
          for (let j = 0; j < 2; j++) {
            const hh = j ? 58 + g.rng() * 10 : 34 + g.rng() * 8, r0 = HAZE_R + g.rng() * 6;
            g.puffs.push({ x: x + (g.rng() - .5) * 14, z: L + (g.rng() - .5) * .06, h: hh, vx: 0, vz: 0, vh: 0, r: r0, r0, r1: r0, age: 0, life: Infinity, a: (j ? .07 : .15) * edge, s: 0, kind: 4, ph: g.rng() * 6.28, v: (g.rng() * 3) | 0 });
          }
        }
      }
      if (!z.warned && !g.attract && z.x0 > p.x && z.x0 - p.x < 300) { z.warned = true; g.ev.push({ k: 'hazeAhead', x: z.x0, z: 1, h: 120, len: z.x1 - z.x0, air: z.pockets.length }); }
      for (const q of z.pockets) if (!q.told && !g.attract && q.x > p.x && q.x - p.x < 230) { q.told = true; g.ev.push({ k: 'airAhead', x: q.x, z: q.z, h: 96 }); }
    }
  }

  /* 这一段浓烟要憋几秒（docs/22 的 A 第三版，2026-11-16）：从进烟（或现在）到这条道上第一个 AIR 格栅、或者出烟，按冲刺的速度算。
   * 像真人的机器人量出来：呛到时手里中位只剩 0.4 秒气，大多是进烟前冲刺把气花掉了。前面的烟看不全，不知道这口气够不够，
   * 所以在 Leo 头上的气圈上标一道「要这么多」（render.js），差的那一截是红的，看得出该先松手喘满再进去。
   * 之字路一段接一段罩着同一条道的，连起来算；正站在 AIR 格栅上就从格栅后面算起 */
  function airNeed(g) {
    const p = g.p, L = p.lane;
    if (g.attract || !g.hazes.length || (g.power && g.power.kind === 'bubble')) return null;      // 泡泡罩里随便喘，不用标
    const hs = g.hazes.filter(z => z.x1 > p.x && (!z.lanes || z.lanes.includes(L))).sort((a, b) => a.x0 - b.x0);
    if (!hs.length || hs[0].x0 - p.x > 340) return null;
    let start = Math.max(p.x, hs[0].x0), end = hs[0].x1;
    for (const z of hs) if (z.x0 <= end + 10) end = Math.max(end, z.x1);
    const air = [];
    for (const z of hs) for (const q of z.pockets) if (q.z === L) air.push(q);
    air.sort((a, b) => a.x - b.x);
    for (const q of air) if (Math.abs(q.x - start) < q.w / 2) start = q.x + q.w / 2;      // 站在格栅上：从格栅后面算
    if (start >= end) return null;
    for (const q of air) if (q.x - q.w / 2 > start) { end = Math.min(end, q.x - q.w / 2); break; }
    const skate = g.power && g.power.kind === 'skate', v = Math.max(p.holding ? p.v : 0, g.speed * (g.breathy ? 1 : 1.35 * g.k.sprint) * (skate ? CFG.SKATE_V : 1));      // 憋气版憋着不加速
    return { t: (end - start) / v + .15, d: start - p.x };
  }

  function inShelter(g, q) { for (const z of g.shelters) if (q.x > z.x0 && q.x < z.x1 && q.z > z.z0 && q.z < z.z1) return true; return false; }

  function stepPuffs(g, dt) {
    const P = g.puffs, k = 1 - Math.exp(-dt * 1.5), wx = g.wind.x, wz = g.wind.z;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.age += dt;
      if (q.age >= q.life || q.kind === 4 && q.x < g.camX - 160) { P[i] = P[P.length - 1]; P.pop(); continue; }
      // 浓烟段的烟：不随风走、不往上飘、不变淡，原地轻轻晃。被水、通风口、吹叶机碰过以后 life 变成有限的，就照普通的烟散掉
      if (q.kind === 4 && q.life === Infinity) { q.x += Math.sin(q.age * 1.3 + q.ph) * 3 * dt; q.h += Math.sin(q.age * .9 + q.ph * 2) * 2 * dt; q.s = q.a * Math.min(1, q.age / .5); continue; }
      if (q.kind === 1) { q.vx *= 1 - dt * 1.5; q.vz *= 1 - dt * 1.5; q.vh *= 1 - dt * .5; }
      else if (q.kind === 3) { q.vx *= 1 - dt * .4; }
      else {
        const f = inShelter(g, q) ? .1 : 1;
        q.vx += (wx * f - q.vx) * k; q.vz += (wz * f - q.vz) * k; q.vh += (6 - q.vh) * k;
      }
      q.x += (q.vx + Math.sin(q.age * 1.7 + q.ph) * 4) * dt;
      q.z += q.vz * dt; q.h = clamp(q.h + q.vh * dt, 4, 110);
      const u = q.age / q.life;
      q.r = q.r0 + (q.r1 - q.r0) * Math.sqrt(u);
      q.s = q.a * Math.min(1, q.age / .15) * (1 - u) * (1 - u * .4);
    }
  }

  function stepVents(g, dt) {
    for (const v of g.vents) {
      v.t -= dt;
      if (v.air) { v.on = 1; if (v.t <= 0) v.t = 3.2; }      // 浓烟段里的 AIR 格栅：一直往上吹
      else if (v.t <= 0) { v.t = 3.2; v.on = 1.1; if (Math.abs(v.x - g.p.x) < 400 && !g.attract) g.ev.push({ k: 'vent' }); }
      if (v.on > 0) {
        v.on -= dt;
        if (g.rng() < dt * 16) puff(g, v.x + (g.rng() - .5) * 40, v.z, 4, 0, 0, 160, 6, 26, .7, .5, 1);
        for (const q of g.puffs) {
          if (q.kind === 1) continue;
          if (Math.abs(q.x - v.x) < 50 && Math.abs(q.z - v.z) < .8) { q.vh += 400 * dt; q.life = Math.min(q.life, q.age + .9); }
        }
      }
    }
  }

  function stepDrops(g, dt) {
    const D = g.drops;
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i]; d.life -= dt; d.x += d.vx * dt; d.z += d.vz * dt; d.h += d.vh * dt;
      for (const s of g.smokers) {
        if (!s.lit || s.state !== 'smoke' || !s.awake || s.kind === 'boss') continue;
        const h = hitPoint(s), dx = d.x - h.x, dz = (d.z - h.z) * LD, dh = d.h - h.h;
        if (dx * dx + dz * dz + dh * dh < h.r * h.r) {
          d.hit = true;
          if (s.kind === 'terrace') { g.ev.push({ k: 'fence', x: d.x, z: d.z, h: d.h }); break; }   // 吸烟区的围栏挡住了水
          if (s.lastShot !== d.shot) { s.lastShot = d.shot; douse(g, s, false, d.bull); }
          break;
        }
      }
      if (d.hit || d.life <= 0 || d.h < 0) {
        if (!d.hit) g.ev.push({ k: 'splash', x: d.x, z: d.z, h: Math.max(0, d.h) });
        D[i] = D[D.length - 1]; D.pop();
      }
    }
  }

  function stepScooters(g, dt) {
    const p = g.p;
    for (const e of g.scooters) {
      if (!e.done && p.x > e.x) { e.done = true; g.warns.push({ lane: e.lane, t: 1.2 }); g.ev.push({ k: 'scooterWarn' }); }
    }
    for (let i = g.warns.length - 1; i >= 0; i--) {
      const w = g.warns[i]; w.t -= dt;
      if (w.t <= 0) {
        const s = makeSmoker('scooter', g.camX + VW + 60, w.lane, g.rng);
        s.vx = -CFG.SCOOT_V; s.passed = true; g.smokers.push(s); g.warns.splice(i, 1); g.ev.push({ k: 'scooter' });
      }
    }
  }

  /* ---------- 泡泡：慢慢飘过几条道，走进去回一口气 ---------- */
  function stepBubbles(g, dt) {
    const p = g.p;
    for (const b of g.bubbles) {
      if (b.got) { b.pop += dt; continue; }
      b.ph += dt * 2;
      if (b.x - g.camX > VW + 60) continue;
      b.x += (g.wind.x * .4 - 14) * dt; b.z = clamp(b.z + (Math.sin(b.ph * .7) * .25 + g.wind.z * .3) * dt, -.2, 2.3);
      if (g.attract) continue;
      if (Math.abs(b.z - p.z) < .5 && Math.abs(b.x - p.x) < 18) {
        b.got = true; g.popped++;
        p.breath = Math.min(g.k.breath, p.breath + CFG.BUBBLE_AIR); if (p.gasp > 0) p.gasp = Math.max(0, p.gasp - .5);
        addPts(g, 10, b.x, b.z, b.h, 'bubble'); g.ev.push({ k: 'pop', x: b.x, z: b.z, h: b.h, n: g.popped });
      }
    }
  }

  /* ---------- 烟圈：沿着一条道飘过来。憋着气冲过去就冲散了（算一个连冲），正在换气时撞上就呛一口；也可以点破 ---------- */
  function stepRings(g, dt) {
    const p = g.p;
    for (let i = g.rings.length - 1; i >= 0; i--) {
      const q = g.rings[i]; q.age += dt; q.life -= dt; q.x += q.vx * dt;
      if (!g.attract && q.life > 0 && Math.abs(q.z - p.z) < .5 && Math.abs(q.x - p.x) < 15) {
        q.life = 0;
        if (p.holding) { chainUp(g, q); g.ringsPop = (g.ringsPop || 0) + 1; if (q.boss) q.boss.popped++; g.ev.push({ k: 'ringThrough', x: q.x, z: q.z, h: q.h }); }
        else if (p.inv <= 0 && !(g.power && g.power.kind === 'bubble')) { g.smell += 8; blame(g, 8); g.ev.push({ k: 'ringHit', x: q.x, z: q.z, h: q.h }); cough(g); }
      }
      if (q.life <= 0 || q.x < g.camX - 60) g.rings.splice(i, 1);
    }
  }

  /* ---------- 金币、薄荷糖、水瓶、饮水台 ---------- */
  function stepPickups(g, dt) {
    const p = g.p;
    for (const c of g.coins) {
      if (c.got) continue;
      if (c.vx) c.x += c.vx * dt;
      // 吸金磁铁：附近三条道上的金币都朝主角飞过来
      if (g.k.magnet && c.kind === 'coin' && c.x - p.x < 70 && p.x - c.x < 30) { const u = Math.min(1, dt * 9); c.x += (p.x + 6 - c.x) * u; c.z += (p.z - c.z) * u; }
      if (Math.abs(c.z - p.z) > .5 || Math.abs(c.x - p.x) > CFG.COIN_R) continue;
      c.got = true;
      if (c.kind === 'coin') { const v = g.phase === 'dusk' ? CFG.DUSK_COINS : 1; g.coinsGot += v; g.score += 10; g.ev.push({ k: 'coin', x: c.x, z: c.z, v: 10, m: v }); }
      else if (POWERS.includes(c.kind)) { const T = (c.kind === 'whistle' ? CFG.WHISTLE_T : CFG.POWER_T) + CFG.POWER_UP * (g.up.power || 0); g.power = { kind: c.kind, t: T, T }; g.powers = (g.powers || 0) + 1; addPts(g, 30, c.x, c.z, 70, 'power'); g.ev.push({ k: 'power', kind: c.kind, x: c.x, z: c.z }); }
      else if (c.kind === 'mint') { p.breath = g.k.breath; p.gasp = 0; addPts(g, 30, c.x, c.z, 70, 'mint'); g.ev.push({ k: 'mint', x: c.x, z: c.z }); }
      else if (c.kind === 'stall') takeStall(g, c);
      else { g.water = Math.min(g.k.water, g.water + 2); addPts(g, 10, c.x, c.z, 70, 'bottle'); g.ev.push({ k: 'bottle', x: c.x, z: c.z }); }
    }
    for (const f of g.refills) {
      if (p.z < .5 && Math.abs(p.x - f.x) < f.w / 2 && g.water < g.k.water) {
        g.water = Math.min(g.k.water, g.water + CFG.REFILL_V * g.k.refill * dt);
        f.t = (f.t || 0) - dt; if (f.t <= 0) { f.t = .14; g.ev.push({ k: 'refill', x: f.x, z: 0 }); }
      }
    }
  }

  function stepChain(g) {
    const p = g.p;
    for (const s of g.smokers) {
      if (s.passed || s.kind === 'scooter' || s.kind === 'boss' || !s.awake) continue;
      // 只算贴身冲过去的（docs/24）：他在你这条道或旁边那条道上。原来隔两条道也算，走哪条道都一样，换道没理由
      if (p.x > s.x + 18) {
        s.passed = true; if (p.holding && s.lit && s.state === 'smoke' && p.x - s.x < 80 && (!g.dive || Math.abs(s.z - p.z) < CFG.NEAR_Z)) chainUp(g, s);
        // 健康跑哨子吹着：从他身边（这条道或旁边那条道）跑过去，他就把烟一扔跟上来。冒烟的、灭了烟的都算
        if (g.power && g.power.kind === 'whistle' && p.x - s.x < 80 && Math.abs(s.z - p.z) < CFG.NEAR_Z && s.state !== 'gone') joinParade(g, s);
      }
    }
  }

  /* 开头的引子（不归玩家操作），要让人一眼看懂「他在走，后面有东西追，他加快脚步，把它甩开」：
   *   1. 人在慢慢走，大烟雾从屏幕左边外面慢慢露出来、往前压；
   *   2. seen：烟雾的脸刚露出来，人脚步一顿、扭头往后看（头左右翻过来、张嘴、头顶冒「!」）；
   *      turn：转回头，脚步加快到平时的走速；它还在逼近，最近停在脸露出来、但还没张嘴咬的距离；
   *   3. go：憋住气，0.8 秒里慢慢加速到冲刺，距离先停住再一点点拉开；
   *   4. phew：甩开了，松气，减速回平时的走速，然后交给玩家。第一次玩时它接着退到屏幕外，过十来秒再正式出来追。
   * 烟雾和人的距离按下面的关键帧（时间、距离、变化率）平滑插值，中间不会突然掉头；人的速度也是平滑过渡的，交出时正好是平时的走速。
   * 画面上的距离是压缩过的（见 render 的 drawSmog）：距离 600 以上整团都在屏幕外，55 左右能看见它的脸。
   */
  const INTRO = {
    // v0 慢走的速度，vl 回头看时脚步一顿的速度
    full: { end: 5.5, seen: 1.6, turn: 2.3, go: 2.8, phew: 4.5, v0: 80, vl: 66, gap: [[0, 620, -260], [1.6, 125, -150], [2.3, 80, -45], [3.1, 55, 0], [4.7, 218, 40], [5.5, CFG.GAP0, -4]] },
    short: { end: 3.3, seen: .3, turn: .8, go: 1.1, phew: 2.4, v0: 100, vl: 88, gap: [[0, 330, -220], [.7, 120, -120], [1.45, 60, 0], [2.8, 222, 30], [3.3, CFG.GAP0, -4]] }
  };
  function introOf(kind, tutorial) {
    const P = INTRO[kind === 'short' ? 'short' : 'full'], I = Object.assign({ t: 0, short: kind === 'short' }, P, { gap: P.gap.slice() });
    // 第一次玩：最后不停在起步距离，而是一直退到屏幕外再睡下去，免得它在画面边上一下子消失
    if (tutorial) { I.gap.splice(-1, 1, [I.end + .6, 640, 0]); I.gap[I.gap.length - 2] = [I.phew + .3, 230, 140]; I.end += .6; }
    return I;
  }
  // 三次埃尔米特插值：经过每个关键帧的距离，并且在那一点的变化率就是给定的值，所以整条曲线没有折角
  function keyed(K, t) {
    if (t <= K[0][0]) return K[0][1];
    let i = 1; while (i < K.length - 1 && t > K[i][0]) i++;
    const [t0, y0, m0] = K[i - 1], [t1, y1, m1] = K[i], h = t1 - t0, s = clamp((t - t0) / h, 0, 1), s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m0 + (3 * s2 - 2 * s3) * y1 + (s3 - s2) * h * m1;
  }
  const ease = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  function stepIntro(g, dt, inp) {
    const I = g.intro, p = g.p, S = g.smog; I.t += dt; S.awake = true;
    /* 开场里按住、滑动、点一下，都立刻跳到结尾、把人交给玩家（2026-11-17）。用户说开头分不清什么时候才能操作：
     * 人自己在走、自己开始冲，想上下移动移不了，想按也按不了。原来只有再来一局的短开场能按住跳过，从主页点进来的完整开场（5.5 秒）怎么按都没反应。
     * 第一次玩那局要先看到大烟雾露脸（seen）才让跳，免得点完开场对话那一下就把开场跳没了。滑动的那一下留到能操作的第一帧再换道 */
    if (inp && (inp.hold || inp.lane || inp.shot) && I.t > (g.tutorial ? I.seen + .2 : .15) && I.t < I.end) { I.t = I.end; I.skipped = true; g.pendLane = inp.lane || 0; }
    const t = Math.min(I.t, I.end), W = g.speed, R = g.speed * CFG.BOOST1 * g.k.sprint;
    if (!I.saw && t >= I.seen) { I.saw = I.scared = I.look = true; g.ev.push({ k: 'introSeen', x: p.x, z: p.z }); }
    if (I.look && t >= I.turn) I.look = false;
    if (!I.went && t >= I.go) { I.went = true; p.holding = true; p.holdT = 0; g.ev.push({ k: 'introGo', x: p.x, z: p.z }); }
    if (!I.done && t >= I.phew) { I.done = true; I.scared = false; p.holding = false; p.holdT = 0; g.ev.push({ k: 'introPhew', x: p.x, z: p.z }); }
    if (p.holding) { p.holdT += dt; p.breath = Math.max(g.k.breath * .45, p.breath - dt); }
    else if (I.done) p.breath = Math.min(g.k.breath, p.breath + CFG.REGEN * dt);
    // 慢走 → 回头时脚步一顿 → 转回来加快到平时的走速 → 冲刺 → 回到平时的走速，每一段都是缓起缓停
    p.v = I.v0 + (I.vl - I.v0) * ease((t - I.seen) / .3) + (W - I.vl) * ease((t - I.turn) / .5) + (R - W) * (ease((t - I.go) / .8) - ease((t - I.phew) / .7));
    p.x += p.v * dt; p.walk += dt * p.v * .07;
    S.x = p.x - keyed(I.gap, t); S.gap = p.x - S.x;
    if (I.t >= I.end) {
      p.holding = false; p.holdT = 0; p.breath = g.k.breath; p.v = W; g.intro = null; if (g.tutorial) S.awake = false;
      g.ev.push({ k: 'introEnd', x: p.x, z: p.z, skipped: !!I.skipped });
      headStart(g);
    }
  }

  function step(g, dt, inp) {
    if (g.over) return;
    if (g.hitstop > 0) { g.hitstop -= dt; return; }
    if (g.slow > 0) { g.slow -= dt; dt *= .4; }
    const p = g.p;
    g.t += dt;
    // 第 4 天起每天一种天：横幅上写着这一天有什么不一样（main.js 的 dayLine）。第 1 到 3 天的白天、傍晚、夜里只换颜色
    g.phase = g.attract ? '' : phaseOf(g.day || 0); g.rainy = g.phase === 'rain';      // 第 2 天的傍晚、第 3 天的夜里也照规则来（原来只从第 4 天起算，同叫傍晚规则却不一样）
    extend(g);
    g.gen.cullT -= dt; if (g.gen.cullT <= 0) { g.gen.cullT = 1; cull(g); }
    if (g.intro) {
      stepIntro(g, dt, inp);
      const ix = p.x - PX - CFG.CAM_BACK * clamp(1 - g.smog.gap / 150, 0, 1);
      g.camX += (ix - g.camX) * Math.min(1, dt * 8);
      stepSmokers(g, dt); stepPeds(g, dt); stepPuffs(g, dt);
      return;
    }
    if (!g.attract) stepPlayer(g, dt, inp);
    const tx = p.x - PX - (g.smog.awake && !g.attract && !g.locked ? CFG.CAM_BACK * clamp(1 - g.smog.gap / 150, 0, 1) : 0)
      + CFG.TURBO_LOOK * (p.turbo || 0);      // 烟就是赛道（docs/35）：冲刺时镜头往前推，多看到一截路
    g.camX += (tx - g.camX) * Math.min(1, dt * 8);
    if (!g.boss && g.bossQ.length && p.x > g.bossQ[0].lockX - 320) g.boss = g.bossQ.shift();
    // 走进下一个街区
    const D = g.districts[g.di + 1];
    if (D && p.x >= D.x) { g.di++; g.stop = D.st; g.day = D.day; if (D.day >= 3 && g.creepX == null) g.creepX = D.x; if (!g.attract) g.ev.push({ k: 'district', idx: D.idx, day: D.day, name: D.st.name }); }
    stepSmokers(g, dt);
    stepPeds(g, dt);
    stepHaze(g);
    stepVents(g, dt);
    stepPuffs(g, dt);
    stepDrops(g, dt);
    stepBubbles(g, dt);
    stepRings(g, dt);
    if (g.attract) return;
    stepScooters(g, dt);
    stepPickups(g, dt);

    g.dens = density(g, p.x, p.z, HEAD + (p.hopH || 0));      // 滑板跳在空中时头在烟上面
    const breathing = !p.holding;
    if (breathing && g.dens >= g.k.dmin && p.inv <= 0 && !(g.power && g.power.kind === 'bubble')) {
      const add = Math.min(g.dens, CFG.DCAP) * CFG.SMELL * (p.gasp > 0 ? CFG.GASP_X : 1) * dt;
      g.smell += add; g.dirty += add; g.cleanT = 0; g.lastDirtyT = g.t;
      blame(g, add);
      if (g.dirty >= g.k.coughAt) cough(g);
    } else { g.cleanT += dt; if (g.cleanT > .8) g.dirty = 0; }
    // 前方烟浓：提醒憋气
    g.warnAhead = breathing && p.gasp <= 0 && density(g, p.x + 50, p.z, HEAD) > .2;
    g.airNeed = airNeed(g);
    stepChain(g);
    stepPower(g, dt);
    stepSmog(g, dt);
    stepParade(g, dt);
    if (g.over) g.ev.push({ k: 'over' });
  }
  function stepPower(g, dt) {
    const P = g.power, p = g.p; if (!P) return;
    P.t -= dt;
    if (P.kind === 'blower') {
      // 吹叶机：前面两条道以内的烟全吹回去，烟民被自己的烟呛到，一时半会儿吐不出下一口
      for (const q of g.puffs) if (q.kind !== 1 && q.x > p.x - 20 && q.x < p.x + 250 && Math.abs(q.z - p.z) < 1.4) { q.vx += 700 * dt; q.life = Math.min(q.life, q.age + .8); }
      for (const s of g.smokers) if (s.lit && s.awake && s.state === 'smoke' && s.kind !== 'boss' && s.x > p.x && s.x - p.x < 230 && Math.abs(s.z - p.z) < 1.4) { s.nextEx = Math.max(s.nextEx, 1.6); s.vapeT = Math.max(s.vapeT, 1.6); s.lock = false; if (!s.blown) { s.blown = true; s.say = '*cough*'; s.hitT = .6; } }
      for (const q of g.rings) if (q.x > p.x && q.x - p.x < 230 && !q.boss) q.life = 0;
    }
    if (P.t <= 0 && !(P.kind === 'skate' && p.hop)) { g.ev.push({ k: 'powerEnd', kind: P.kind }); g.power = null; }      // 滑板等落了地再收
  }
  // 呛到：踉跄一下，连冲清零，大烟雾趁机扑近一截
  function cough(g, why) {
    const p = g.p;
    // 薄荷糖摊：下一次呛到不算，只吸一下鼻子（拿一次管一次）
    if (g.mintLeft > 0) { g.mintLeft--; g.dirty = 0; p.inv = 1; g.ev.push({ k: 'mintSave', x: p.x, z: p.z, h: 90 }); return; }
    if (g.cleanX == null) g.cleanX = p.x;      // 第一次呛到之前跑了多远
    g.dirty = 0; g.coughs++; p.stun = CFG.COUGH_STUN; p.inv = CFG.COUGH_INV; p.holding = false; p.holdT = 0;
    if (!(g.power && g.power.kind === 'skate')) p.v = 0;      // 在滑板上不会一下停住，见 stepPlayer
    g.hurt = 'cough'; g.hurtT = g.t; chainLost(g, 'cough'); if (why !== 'bump') dropParade(g);      // 撞上烟民呛到：撞的时候已经掉了一个，不再掉第二个
    g.ev.push({ k: 'cough', x: p.x, z: p.z, h: 90, why });
    if (g.smog.awake) g.smog.x += CFG.COUGH_LUNGE;      // 呛到也不算失误（docs/24），它自己有 *COUGH*、踉跄、被追近一截
  }
  /* ---------- 戒烟大游行（docs/22 的 B，2026-11-16） ----------
   * 正中滋灭一个烟民（bullseye），他扔了烟、戴上头带，跑过来跟着 Leo。跟着的人越多，PHEW 把大烟雾吹得越远（每人多 PARADE_PUSH）。
   * 呛到、气用光、撞上：最后一个掉队；大烟雾贴近时先把最后面那个吞掉。
   * 站位：Leo 只在屏幕左边 66 的地方，排成一长串会排出画面，所以八个位置围在他身后和两边（dx 往后、dz 往上下），人多了像一小队人陪他跑 */
  // 两个在身后两边，然后旁边两条道上与他并排、稍微靠前，再往后补。挤在身后一团的话，左边就是大烟雾，看着像在追他
  // 原来第六个站在 Leo 前面 24、往下 0.6 条道，正好压在他身上；改成最后面那个，在屏幕左边缘半露着，像队伍还在往后排（2026-11-16）
  const PARADE_SLOT = [[-22, .55], [-22, -.55], [6, 1], [6, -1], [-40, 0], [-44, 1], [-44, -1], [-60, .5]];
  // 每种人戒烟以后用自己的那套慢跑图（第二十二批补齐了打电话的、通勤族、遛狗的、厨师、电子烟，2026-11-17）。
  // 原来只有四套，这五种人借上班族或卫衣耳机的样子，用户看到「滋了好几个人，跟上来的总是固定的两个」
  const JOG_LOOK = { office: 'office', phone: 'phone', commuter: 'commuter', hoodie: 'hoodie', chef: 'chef', granny: 'granny', ring: 'ring', dogwalker: 'dogwalker' };
  const paradeN = g => g.parade.filter(f => !f.drop).length;
  function joinParade(g, s) {
    if (s.kind === 'scooter' || s.kind === 'terrace' || s.kind === 'boss' || g.locked) return;
    if (paradeN(g) >= CFG.PARADE_MAX) return;
    const look = s.kind === 'vape' ? 'vape' : JOG_LOOK[s.look] || 'office';
    g.parade.push({ look, x: s.x, z: s.z, ph: g.rng() * 6, drop: 0, joinT: 0 });
    s.state = 'gone';      // 原地换成跑步的那个人，不再走开
    g.paradeMax = Math.max(g.paradeMax, paradeN(g));
    g.ev.push({ k: 'join', n: paradeN(g), x: s.x, z: s.z, h: 96 });
  }
  function dropParade(g) {
    const f = g.parade.filter(f => !f.drop).pop(); if (!f) return;
    f.drop = 1.4; g.ev.push({ k: 'drop', n: paradeN(g), x: f.x, z: f.z, h: 80 });
  }
  function stepParade(g, dt) {
    const p = g.p, P = g.parade; if (!P.length) return;
    let i = 0;
    for (const f of P) {
      f.ph += dt * 9;
      if (f.drop) { f.drop -= dt; f.x += Math.max(0, p.v * .25) * dt; continue; }      // 掉队：喘着慢下来，落到后面
      f.joinT += dt;
      const [dx, dz] = PARADE_SLOT[i++], tx = p.x + dx, tz = clamp(p.z + (p.zo || 0) + dz, -.42, 2.42);
      const k = Math.min(1, dt * (f.joinT < 1 ? 3 : 6));
      f.x += (tx - f.x) * k; f.z += (tz - f.z) * Math.min(1, dt * 5);
    }
    g.parade = P.filter(f => !f.drop || f.drop > 0);
    // 大烟雾贴上来：先吞掉最后面那个。按画面上烟墙前沿算（render.js 的 drawSmog 把远的距离压缩了：近 40 以内是真距离，再远只画 13%）
    const S = g.smog, last = g.parade.filter(f => !f.drop).pop(), gp = S.gap, front = -((gp <= 40 ? gp : 40 + (gp - 40) * .13) + 4);
    if (S.awake && last && last.x - p.x < front && !g.over) { last.drop = .01; g.ev.push({ k: 'eaten', n: paradeN(g), x: last.x, z: last.z, h: 80 }); }
  }

  // 大烟雾：比你走路快一点，比你冲刺慢；追上就结束
  function stepSmog(g, dt) {
    const p = g.p, S = g.smog;
    if (!S.awake) {
      S.x = p.x - CFG.GAP_MAX; S.gap = CFG.GAP_MAX;
      if (!g.tutorial || p.x > 1800) { S.awake = true; g.ev.push({ k: 'smogIn' }); }      // 第一局的街往后挪了 400（见 newRun 的 gen.base），这里和下面跟着挪
      return;
    }
    // 潜水规则：涨到 SMOG_K1 以后每 1000 米再慢慢多 SMOG_CREEP，免得一局永远跑不完。
    // 2026-11-21 起这一截从第 4 天进门才开始算（creepX，见 step 里「走进下一个街区」）：原来从 1660 米起就涨，到第三天它比走路快三成五到五成，
    // 在干净空气里憋气（快一成五）也甩不掉，机器人 20 局里连高手都没拿到过第三颗星，九成九是什么都没做错、被慢慢追上的
    const creepAt = Math.max(CFG.SMOG_FROM + CFG.SMOG_DIST, g.creepX == null ? Infinity : g.creepX);
    const k = CFG.SMOG_K0 + (CFG.SMOG_K1 - CFG.SMOG_K0) * clamp((p.x - CFG.SMOG_FROM) / CFG.SMOG_DIST, 0, 1) + CFG.SMOG_CREEP * Math.max(0, p.x - creepAt) / (1000 * CFG.M);
    // 打老板的时候它被地铁口的风顶着，只能慢慢往前挪。夜里快一点也只从第 4 天起（第 3 天的夜里只换颜色，2026-11-21）
    const sv = g.locked ? 6 : g.speed * k * (g.phase === 'night' && g.day >= 3 ? CFG.NIGHT_SMOG : 1) * (g.smogK || 1);      // smogK：报刊亭摊位，大烟雾慢一点
    // docs/35（试验，REST 不是 0 才用）：它自己追到离你 REST 就不再逼近，只有失误（撞、呛、气用光）扑过来才会更近；
    // 进了 REST 以内就跟着你的走路速度，冲刺、PHEW 才甩得开，停下（撞、呛）它就贴上来。死都是因为一次失误，不会「什么都没做错被慢慢追上」
    if (CFG.REST && !g.locked) S.x = Math.max(S.gap > CFG.REST ? Math.min(S.x + sv * dt, p.x - CFG.REST) : S.x + g.speed * dt, p.x - CFG.GAP_MAX);
    else S.x = Math.max(S.x + sv * dt, p.x - CFG.GAP_MAX);
    // 第一次玩：它刚出场的头十来秒只逼近、不下口，留时间看懂「按住就能甩开」
    if (g.tutorial && p.x < 3200) S.x = Math.min(S.x, p.x - 55);
    S.gap = p.x - S.x;
    if (S.gap <= 6) {
      // 第二口气：被追上的那一下把它吹回去，一局只有一次
      if (g.k.revive > 0) { g.k.revive--; g.revived = (g.revived || 0) + 1; S.x = p.x - 140; S.gap = 140; p.inv = 2; p.stun = 0; p.gasp = 0; p.breath = g.k.breath; g.dirty = 0; g.ev.push({ k: 'secondWind', x: p.x, z: p.z, h: 110 }); }
      else g.over = 'smog';
    }
  }

  // 看完广告复活：把大烟雾吹回去，人站起来接着跑。一局用几次由外面管
  function revive(g) {
    const p = g.p, S = g.smog;
    g.over = null; S.x = p.x - 200; S.gap = 200; g.revived = (g.revived || 0) + 1;
    p.inv = 2; p.stun = 0; p.gasp = 0; p.bump = 0; p.hop = null; p.hopH = 0; p.breath = g.k.breath; p.holding = false; p.holdT = 0; g.dirty = 0; g.chain = 0; g.ev.length = 0;
  }

  // 这口烟算在谁头上：离得最近、还在冒烟的那个
  function blame(g, add) {
    const p = g.p; let best = null, bd = 260;
    for (const s of g.smokers) {
      if (!s.lit || s.state !== 'smoke' || !s.awake) continue;
      const d = Math.abs(s.x - p.x) + Math.abs(s.z - p.z) * 40;
      if (d < bd) { bd = d; best = s; }
    }
    const k = g.locked ? 'boss' : best ? best.kind : 'cloud';
    g.blame[k] = (g.blame[k] || 0) + add;
  }

  /* ---------- 结算 ---------- */
  const cigs = smell => smell * .03;
  function score(g) {
    let top = null, tv = 0; for (const [k, v] of Object.entries(g.blame)) if (v > tv) { tv = v; top = k; }
    const D = g.districts[g.di];
    return { dist: Math.floor(g.p.x / CFG.M), pts: g.score, cigs: cigs(g.smell), district: D.st.name, id: D.st.id, postcard: D.st.postcard, idx: D.idx, day: D.day + 1,
      bestChain: g.bestChain, banked: g.banked, held: Math.round((g.heldSecs || 0) * 10) / 10, kills: g.kills, bulls: g.bulls, coughs: g.coughs, coins: g.coinsGot, time: g.t, blame: top, hurt: g.t - g.hurtT < 6 ? g.hurt : '',
      di: g.di, parade: g.paradeMax || 0, perks: Object.values(g.perks || {}).reduce((a, b) => a + b, 0), gear: g.gear, rings: g.ringsPop || 0, powers: g.powers || 0, bosses: g.bossDown || 0, perfects: g.perfects || 0, onbeats: g.onBeats || 0, clean: Math.floor((g.cleanX != null ? g.cleanX : g.p.x) / CFG.M) };
  }

  HYB.breathMode = 'b';
  setRules('dive');
  Object.assign(HYB, { STALLS, W, ZOOM, VW, PX, LD, DZ, HEAD, CFG, GEAR, BODY, STOPS, ENC, BREATH_MODES, setBreath, RULES, setRules, setCourse, duckSheet, clamp, rngOf, newRun, step, revive, density, score, cigs, hitPoint, muzzle, targetable, blockers, laneFree, stopsYou, phaseOf });
  if (typeof module !== 'undefined') module.exports = HYB;
})(typeof window !== 'undefined' ? window : globalThis);
