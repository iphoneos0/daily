/* 环球躲烟 · 流程、操作和界面（「一口气」版）
 * 标题 → 开跑 → 被大烟雾追上 → 结算卡 → 再来一局。
 * 没有固定的操作区：左边四成屏幕按住是憋气，右边上下滑换道、点一下滋水。
 */
(function () {
  'use strict';
  const H = HYB, R = H.R, Snd = H.Snd, store = H.store, CFG = H.CFG, L = H.L;      // L：多语言（js/i18n.js），英文原句进去，当前语言出来
  /* 画出来的小图标（2026-11-21 用户：游戏里不要用 emoji，锁那个很丑）。和主页齿轮、礼物一样：白或彩色填充、深墨描边。
   * 原来设置里是 🌐🎵🔊📳⏰，每日连签是 🔥，锁是 🔒：iPhone 上是彩色表情，和游戏的画法不是一套 */
  const SV = (body, cls) => `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" stroke="#1c2230" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
  const ICON = {
    lock: SV('<path d="M7.6 10.6V8.2a4.4 4.4 0 0 1 8.8 0v2.4" fill="none" stroke-width="2.6"/><rect x="4.6" y="10.6" width="14.8" height="10.4" rx="2.6" fill="#ffd23f"/><path d="M12 14.6v2.4" stroke-width="2.4"/>', 'lock'),
    flame: SV('<path d="M12 2.8c.8 3.4 5.6 5.4 5.6 10.9a5.6 5.6 0 0 1-11.2 0c0-2.9 1.7-4.4 2.5-6.4.7 1.5 1.3 2.3 2.2 2.7-.2-2.4-.2-4.6.9-7.2z" fill="#ff8a00"/><path d="M12 13.2c1.1 1.3 2.2 2.3 2.2 3.8a2.2 2.2 0 0 1-4.4 0c0-1.4.9-2.4 2.2-3.8z" fill="#ffd23f" stroke-width="1.6"/>', 'flame'),
    globe: SV('<circle cx="12" cy="12" r="8.6" fill="#8fd8ff"/><path d="M3.6 12h16.8M12 3.4c2.6 2.6 3.6 5.6 3.6 8.6s-1 6-3.6 8.6c-2.6-2.6-3.6-5.6-3.6-8.6s1-6 3.6-8.6z" fill="none" stroke-width="1.8"/>'),
    music: SV('<path d="M9.2 17.4V5.8l9.6-2.2v11.6" fill="none"/><ellipse cx="6.6" cy="17.6" rx="2.8" ry="2.3" fill="#c4a8ff"/><ellipse cx="16.2" cy="15.4" rx="2.8" ry="2.3" fill="#c4a8ff"/>'),
    sound: SV('<path d="M3.8 9.2h3.6l4.8-4v13.6l-4.8-4H3.8z" fill="#ffd23f"/><path d="M15.6 8.6a4.8 4.8 0 0 1 0 6.8M18.2 6a8.4 8.4 0 0 1 0 12" fill="none" stroke-width="2"/>'),
    buzz: SV('<rect x="7.6" y="3.4" width="8.8" height="17.2" rx="2.2" fill="#8fd8ff"/><path d="M11 17.6h2M4.2 8.6v6.8M19.8 8.6v6.8" fill="none" stroke-width="2"/>'),
    clock: SV('<circle cx="12" cy="13" r="7.4" fill="#fff"/><path d="M12 9.4V13l2.4 1.8M5 6.2 7.6 4M19 6.2 16.4 4" fill="none"/>'),
    play: SV('<path d="M8 5.4v13.2L18.6 12z" fill="#fff" stroke="none"/>', 'tri')
  };
  const coinIco = () => `<img class="coinico" src="${H.MANIFEST.images['item-coin']}" alt="">`;
  const $ = id => document.getElementById(id);
  const app = $('app'), stage = $('stage'), cv = $('cv');
  let TOUCH = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
  const CALM = matchMedia('(prefers-reduced-motion:reduce)').matches;
  R.init(cv);

  let VH = 760, g = null, mode = 'loading', last = 0, endT = 0, hint = null, pfA = 0, pfN = 0, beatT = 0, mT = 0;
  let runs = +(store.get('hyb3-runs') || 0), best = +(store.get('hyb3-best') || 0);
  let showHints = runs < 3;
  /* 测试者模式：连点五下「How to play」标题打开或关上。打开后才看得到试听配乐（主页 ♪）、暂停菜单里换音乐风格和换「气」的版本、
   * 商店里的测试说明和金币清零。平时这些都藏着，主页和商店就是正式包的样子 */
  let tester = store.get('hyb3-tester') === '1';

  /* ---------- 局外：金币、三个滚动任务、道具升级 ----------
   * 金币：路上捡的和打老板掉的，结算时进钱包；任务等级每高一级，每局金币多一成。
   * 任务：同时挂三个。one 的要在一局里做到，其余的多局累计。三个都完成就升一级、发一笔金币、换三个新的。
   *       做不到的可以换一个（看一段广告，或者花 50 金币），免得卡死（docs/12）。
   * 升级：四样，每一级都要一上手就感觉得到（2026-11-14 重做，见 docs/12）。
   */
  const MISSIONS = {
    // 最难的几档降了一档（docs/12：机器人模拟里高手卡在一口气 7 个，普通玩家卡在正中烟头）
    chain: { one: true, n: [3, 4, 5, 6], text: n => L('Pass {n} smokers on one breath', { n }), stat: r => r.bestChain },
    dist: { one: true, n: [200, 350, 500, 700, 1000, 1400], text: n => L('Run {n} m in one run', { n }), stat: r => r.dist },
    clean: { one: true, n: [100, 150, 250, 400], text: n => L('Run {n} m without coughing', { n }), stat: r => r.clean },
    // 进度不写「0 / 2」（看着像「到两次」），写还差几站（2026-11-16）
    reach: { one: true, n: [1, 2, 3, 4], text: n => L(`Reach ${['', 'the Office doors', 'the Park', 'the Rooftop', 'the Subway'][n]}`), stat: r => r.di,
      prog: (v, n) => L(n - v > 1 ? '{n} stops to go' : '{n} stop to go', { n: n - v }) },
    bulls: { from: 1, n: [3, 6, 10], text: n => L('Hit {n} bullseyes', { n }), stat: r => r.bulls },
    kills: { n: [10, 20, 35, 50], text: n => L('Put out {n} cigarettes', { n }), stat: r => r.kills },
    banked: { from: 1, n: [10, 20, 35, 60], text: n => L('Pass {n} smokers on held breaths', { n }), stat: r => r.banked },
    // 出烟那一下松手（PERFECT，2026-11-16）：给这一招一个目标，玩家才有理由去练
    perfect: { one: true, from: 1, n: [2, 3, 5, 8], text: n => L('Get {n} PERFECTs in one run', { n }), stat: r => r.perfects },
    // 戒烟大游行（docs/22 的 B）：一局里最多同时有几个人跟着跑
    parade: { one: true, from: 1, n: [2, 3, 5, 8], text: n => L('Lead a parade of {n}', { n }), stat: r => r.parade },
    // 街区摊位、跟着节拍（docs/22 的 C、D）也给个目标（2026-11-16）：原来新玩法只有游行进了任务，另外两样没人带着去试
    perks: { one: true, from: 1, n: [2, 3, 4, 6], text: n => L('Grab {n} stall perks in one run', { n }), stat: r => r.perks },
    onbeat: { from: 2, n: [3, 6, 10, 15], text: n => L('Dash past {n} smokers ON BEAT', { n }), stat: r => r.onbeats },
    coins: { n: [60, 120, 200, 300], text: n => L('Collect {n} coins', { n }), stat: r => r.coins },
    powers: { from: 1, n: [2, 4, 6, 10], text: n => L('Grab {n} power-ups', { n }), stat: r => r.powers },
    rings: { from: 2, n: [3, 6, 10], text: n => L('Pop {n} smoke rings', { n }), stat: r => r.rings },
    boss: { from: 3, n: [1, 2, 3], text: n => n > 1 ? L('Beat the Cigar Boss {n} times', { n }) : L('Beat the Cigar Boss'), stat: r => r.bosses }
  };
  /* 金币花在哪（2026-11-21 重新设计，docs/32）：
   *   原来一般玩家（「像真人」机器人）第 1 天拿约 1 万，第 6 天升级全买满、第 8 天帽子全买满，之后金币攒着没用，金币包也不值钱。
   *   现在：路上的金币摆三成五（core.js COIN_KEEP）、憋气入账奖励最多 9、任务等级每级 +5% 最多 +25%；升级合计约 11.9 万、帽子 4.35 万。
   *   模拟（scratchpad 的 econ.js，机器人真跑，会买升级变强）：「像真人」不看广告每分钟约 170，第 31 天升级买满、第 43 天帽子买满；
   *   一半的局看广告翻倍：第 18、25 天。真人大概拿一半。前几级照旧便宜，第一天能买到两三样。
   *   永久升级：四样。开局滑板：每局一开始踩着滑板冲几秒。侧身：要撞上东西时侧过身从旁边挤过去（人不换道），隔几秒能用一次。
   *     肺活量：气更长、回得更快。道具时长：四种道具一起变长。
   *   每局开跑前的装备：50 到 120 一件，每件第一次试用免费，另外每天第一件免费；
   *   被追上以后花金币接着跑：300、800、2000，一局里越来越贵。
   */
  const UPS = {
    start: { name: 'Head start', img: 'item-skateboard', cost: [500, 3000, 18000], what: 'Start every run on a skateboard',
      val: lv => lv ? L('{n} s', { n: CFG.HEAD[lv - 1] }) : L('up|off') },
    dodge: { name: 'Sidestep', img: 'upgrade-sidestep', cost: [800, 6000, 30000], what: 'Dodge what you would bump into',
      val: lv => lv ? L('every {n} s', { n: CFG.DODGE[lv - 1] }) : L('up|off') },
    lungs: { name: 'Lungs', img: 'upgrade-lungs', cost: [300, 2500, 15000], what: 'Longer breath, faster recovery',
      val: lv => L('{n} s', { n: (CFG.BREATH + CFG.LUNG_UP * lv).toFixed(1) }) },
    power: { name: 'Power-ups', imgs: ['item-skateboard', 'item-blower', 'item-bubble', 'item-soaker'], cost: [400, 2500, 10000, 30000], what: 'All four last longer',
      val: lv => L('{n} s', { n: (CFG.POWER_T + CFG.POWER_UP * lv).toFixed(0) }) }
  };
  // 旧存档（重做前的六种升级）：花掉的金币全退回来，按新的四样重新买
  const OLD_UPS = { lungs: [300, 700, 1500, 3500, 8000], canteen: [300, 1200], skate: [150, 400, 1000, 2500, 6000], blower: [150, 400, 1000, 2500, 6000], bubble: [150, 400, 1000, 2500, 6000], soaker: [150, 400, 1000, 2500, 6000] };
  function migrate(m) {
    if (m.upV === 2) return false;
    let back = 0;
    for (const k in m.up || {}) for (let i = 0; i < (m.up[k] || 0); i++) back += (OLD_UPS[k] || [])[i] || 0;
    m.coins += back; m.up = {}; m.upV = 2; if (back) m.refund = back;
    return true;
  }
  const upCost = k => UPS[k].cost[meta.up[k] || 0];
  /* 升级的红点只在「有一样新买得起了」时亮（2026-11-16）：原来只要买得起任何一样就一直亮着，打开看过、不想买也还亮，红点就没人看了。
   * 打开升级页时记下这会儿买得起的（哪一样、第几级），之后又有新的买得起才再亮 */
  const upAfford = () => Object.keys(UPS).filter(k => upCost(k) != null && meta.coins >= upCost(k)).map(k => `${k}${meta.up[k] || 0}`);
  const upNew = () => upAfford().some(x => !(meta.upSeen || []).includes(x));
  function newSet(rank, avoid) {
    // 第一组固定是三个最容易懂的：跑一段、连冲三个、捡金币。正中烟头这些等玩家熟了再出
    if (!rank && !avoid) return [{ t: 'dist', n: 200, p: 0, done: false }, { t: 'chain', n: 3, p: 0, done: false }, { t: 'coins', n: 60, p: 0, done: false }];
    // 一个一局内的、两个累计的；难度跟着等级走；刚做过的那几种先不重复
    const ok = k => (MISSIONS[k].from || 0) <= rank && !(avoid || []).includes(k) && !(k === 'perfect' && H.rules === 'classic'), keys = Object.keys(MISSIONS).filter(ok);      // 旧规则（测试者模式）没有 PERFECT
    const pick = list => list.splice((Math.random() * list.length) | 0, 1)[0];
    const one = keys.filter(k => MISSIONS[k].one), sum = keys.filter(k => !MISSIONS[k].one);
    return [pick(one), pick(sum), pick(sum)].map(t => { const N = MISSIONS[t].n; return { t, n: N[Math.min(N.length - 1, (rank / 2 | 0) + (Math.random() < .35 ? 1 : 0))], p: 0, done: false }; });
  }
  function loadMeta() {
    try {
      const m = JSON.parse(store.get('hyb3-meta') || 'null');
      if (m && Array.isArray(m.missions) && m.missions.every(x => MISSIONS[x.t])) {
        const M = Object.assign({ coins: 0, rank: 0, up: {} }, m);
        for (const x of M.missions) { const N = MISSIONS[x.t].n; if (x.n > N[N.length - 1]) x.n = N[N.length - 1]; }      // 降了档的任务，旧存档里的目标跟着降
        return M;
      }
    } catch (_) { }
    return { coins: 0, rank: 0, up: {}, upV: 2, missions: newSet(0) };
  }
  let meta = loadMeta();
  const saveMeta = () => store.set('hyb3-meta', JSON.stringify(meta));
  if (migrate(meta)) saveMeta();
  const missionValue = (m, r) => Math.min(m.n, (MISSIONS[m.t].one ? 0 : m.p) + (r ? MISSIONS[m.t].stat(r) : 0));
  const progText = (m, v, sep) => MISSIONS[m.t].prog ? (v < m.n ? MISSIONS[m.t].prog(v, m.n) : L('done')) : `${Math.min(v, m.n).toLocaleString()}${sep}${m.n.toLocaleString()}`;
  // 结算页上那一行：还没做完的任务里离完成最近的一个。一局内的任务看这一局做到多少（累计的在 settle 里已经加过这一局）
  const shownValue = (m, r) => MISSIONS[m.t].one ? missionValue(m, r) : missionValue(m);
  const nextMission = r => meta.missions.filter(m => !m.done).sort((a, b) => shownValue(b, r) / b.n - shownValue(a, r) / a.n)[0];
  // 跑的过程中每隔一会儿看一眼：做到了就当场打勾、弹一条提示
  function checkMissions(r) {
    let hit = false;
    for (const m of meta.missions) if (!m.done && missionValue(m, r) >= m.n) { m.done = true; m.fresh = true; hit = true; if (mode === 'play') toastQ.push({ s: L('★ Mission done: {m}', { m: MISSIONS[m.t].text(m.n) }), star: true }); }      // 排队，见主循环里的 toastQ
    if (hit) saveMeta();
  }
  // 一局结束：累计的任务记上这一局的数；三个都完成就升级
  function settle(r) {
    checkMissions(r);
    const shown = meta.missions.map(m => Object.assign({ v: missionValue(m, r) }, m));      // 结算卡上显示的是加上这一局以后的进度
    for (const m of meta.missions) if (!m.done && !MISSIONS[m.t].one) m.p += MISSIONS[m.t].stat(r);
    // 一局内的任务记下目前最好的一局：任务页上原来一律从 0 算，结算页刚说「Reach the Park · 1 stop to go」，任务页却写「2 stops to go」（2026-11-16）
    for (const m of meta.missions) if (!m.done && MISSIONS[m.t].one) m.best = Math.max(m.best || 0, Math.min(m.n, MISSIONS[m.t].stat(r)));
    // 每级任务等级多 5%，最多多 25%（2026-11-21 起，原来每级一成、最多五成，docs/32）；买了金币翻倍再乘 2
    const earned = Math.round(r.coins * rankMul() * (meta.doubler ? 2 : 1));
    let bonus = 0;
    if (meta.missions.every(m => m.done)) { meta.rank++; bonus = 100 + 50 * meta.rank; meta.missions = newSet(meta.rank, shown.map(m => m.t)); }
    for (const m of meta.missions) delete m.fresh;
    meta.coins += earned + bonus; saveMeta();
    return { earned, bonus, shown, hats: bonus ? grantHats() : [] };      // 任务等级到了送帽子
  }
  function missionList(el, list, r, swap) {
    // 任务页上每个任务下面一条进度条（2026-11-21，docs/33）：原来只有「0 / 200」，看不出差多少
    const bar = (m, v) => swap ? `<i class="mbar"><i style="width:${m.done ? 100 : Math.min(100, Math.max(0, v / m.n * 100)).toFixed(0)}%"></i></i>` : '';
    el.innerHTML = list.map((m, i) => { const v = m.v != null ? m.v : !r && MISSIONS[m.t].one ? m.best || 0 : missionValue(m, r); return `<li class="${m.done ? 'done' : ''}${m.fresh ? ' fresh' : ''}"><span>${m.done ? '✓ ' : ''}${MISSIONS[m.t].text(m.n)}${bar(m, v)}</span><b>${m.done ? L('done') : progText(m, m.v != null ? m.v : !r && MISSIONS[m.t].one ? m.best || 0 : missionValue(m, r), ' / ')}</b>`
      + (swap && !m.done ? `<button class="swap" type="button" data-swap="${i}" aria-label="${L('Swap this mission')}">${meta.coins >= SWAP ? `↻ ${SWAP}` : L('↻ ▶︎ Ad')}</button>` : '') + '</li>'; }).join('');
  }
  /* 换一个任务：做不到的目标会让等级永远卡住（docs/12）。换成同一类（一局内 / 多局累计）里另一种，目标比这个等级平常低一档。
   * 金币够就花 50，不够就看一段广告 */
  const SWAP = 50;
  function swapMission(i) {
    const m = meta.missions[i]; if (!m || m.done) return;
    const have = meta.missions.map(x => x.t), one = !!MISSIONS[m.t].one;
    let keys = Object.keys(MISSIONS).filter(k => !have.includes(k) && !!MISSIONS[k].one === one && (MISSIONS[k].from || 0) <= meta.rank);
    if (!keys.length) keys = Object.keys(MISSIONS).filter(k => !have.includes(k) && (MISSIONS[k].from || 0) <= meta.rank);
    const t = keys[(Math.random() * keys.length) | 0], N = MISSIONS[t].n;
    meta.missions[i] = { t, n: N[Math.min(N.length - 1, Math.max(0, (meta.rank / 2 | 0) - 1))], p: 0, done: false, fresh: true };
    saveMeta(); showMissions(); for (const x of meta.missions) delete x.fresh;
  }
  // 所有显示金币的地方一起刷新
  /* 钱包数字：金币变了就滚过去（半秒），钱包弹一下（2026-11-16）。原来买升级、商店领金币时数字一下跳过去，看不出花了多少、进了多少。
   * coinHold：金币要从卡上飞过来时，等飞到了再滚 */
  const COIN_IDS = ['tCoins', 'sCoins', 'gCoins', 'mCoins', 'stCoins', 'dCoins', 'hCoins', 'ciCoins'];
  let coinShown = null, coinRun = 0, coinHold = 0, coinBusy = false;
  function coinsUI() {
    $('tGoal').hidden = true;      // 主页「下一样」那条不出了（2026-11-21 用户：没必要这么优先放在开跑上面）。买得起新东西时「升级」「帽子」上的小红点照旧提醒
    const to = meta.coins, from = coinShown == null ? to : coinShown, hold = coinHold; coinShown = to; coinHold = 0;
    const set = v => { for (const id of COIN_IDS) $(id).textContent = v.toLocaleString(); };
    if (from === to) { if (!coinBusy) set(to); return; }      // 连着刷新几个面板：正在滚的别打断
    const run = ++coinRun; coinBusy = true;
    set(from);
    setTimeout(() => {
      if (run !== coinRun) return;
      if (document.hidden) { set(to); coinBusy = false; return; }      // 切到后台了：动画帧不走，直接写上最后的数
      for (const id of COIN_IDS) { const el = $(id).closest('.coin') || $(id); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
      const t0 = performance.now();
      const step = now => { if (run !== coinRun) return; const u = Math.min(1, (now - t0) / 500); set(Math.round(from + (to - from) * (1 - (1 - u) * (1 - u)))); if (u < 1) requestAnimationFrame(step); else coinBusy = false; };
      requestAnimationFrame(step);
    }, hold);
    setTimeout(() => { if (run === coinRun && coinBusy) { set(to); coinBusy = false; } }, hold + 800);      // 动画帧没走（后台、被节流）也保证最后是对的数
  }
  // 主页：金币、最好成绩，和三个提醒用的小红点（任务做完几个、今天的每日挑战还没跑、有升级买得起）
  function showMeta() {
    showDaily(); coinsUI();
    const done = meta.missions.filter(m => m.done).length;
    $('tMDone').hidden = !done; $('tMDone').textContent = `${done}/3`; $('tMDone').classList.add('ok');
    $('tUpBadge').hidden = !upNew();
    $('tHatBadge').hidden = !meta.hatNew;      // 新拿到帽子还没去看
    $('tGiftBadge').hidden = !ciCan();      // 今天的签到奖励还没领
    // 买了金币翻倍：主页钱包左上角一直挂着 ×2，每次看到都记得自己有这个（docs/33）
    if (meta.doubler && !$('bCoins').querySelector('.x2b')) $('bCoins').insertAdjacentHTML('beforeend', '<i class="x2b">×2</i>');
    $('keys').hidden = !best; $('tBest').textContent = L('{n} m', { n: best.toLocaleString() });
    // 能从后面的天出发了：条上写出来，点开旅行卡就能选（2026-11-21）
    const s3 = starsOf();
    $('bCities').innerHTML = `${L('NEW YORK')} ${starHTML(s3)}${s3 >= 3 ? L(' · MORE CITIES SOON') : s3 ? L(' · START AT DAY {d}', { d: topDay() }) : ''}`;
    $('bCities').setAttribute('aria-label', L('New York, {n} of 3 stars', { n: starsOf() }));      // 灰星也是 ★ 字符，读屏会念成三颗
  }
  function showMissions() {
    $('tRank').innerHTML = `${L('Missions')} <small>Lv ${meta.rank + 1}</small>`;      // 标题带里放不下「任务 · 第 3 级」（右边还有钱包和 ✕），等级缩成小字
    missionList($('tMissions'), meta.missions, null, true);
    // 做完三个给什么放在最上面一行（金币签 + 升到几级），规则那段缩成一句（docs/33）
    $('mNote').innerHTML = `<span class="mreward">${L('All three done:')} <span class="coin">+${(100 + 50 * (meta.rank + 1)).toLocaleString()}</span> ${L('rank {n}', { n: meta.rank + 2 })}</span>`
      + `<br>${L('Every rank: +5% coins per run (up to +25%). Stuck? ↻ swaps one.')}`;
    Snd.open();
    coinsUI(); $('missions').hidden = false;
  }
  // 每行写清楚这一样管什么、现在多少、买了变成多少
  // bought：刚买的那一样，那一行弹一下、新点亮的那一格跳一下、新的数值闪绿（2026-11-16，原来买了只响一声）
  function showShop(bought) {
    coinsUI(); meta.upSeen = upAfford(); saveMeta();
    const img = artSrc;
    $('sList').innerHTML = Object.keys(UPS).map(k => {
      const U = UPS[k], lv = meta.up[k] || 0, cost = U.cost[lv];
      const icon = U.imgs ? `<div class="quad">${U.imgs.map(i => `<img src="${img(i)}" alt="">`).join('')}</div>` : `<img src="${img(U.img)}" alt="">`;
      const now = cost == null ? `<em><u>${U.val(lv)}</u> · ${L('max')}</em>` : `<em><u>${U.val(lv)}</u> → <i>${U.val(lv + 1)}</i></em>`;
      return `<div class="shoprow up${k === bought ? ' bought' : ''}">${icon}<div><b>${L(U.name)}</b><span>${L(U.what)}</span>${now}<div class="pips">${U.cost.map((_, i) => `<i class="${i < lv ? 'on' : ''}${k === bought && i === lv - 1 ? ' new' : ''}"></i>`).join('')}</div></div>`
        // 买不起：价钱下面写还差多少（2026-11-21，docs/32），原来只是灰掉
        + `<button class="buy" type="button" data-up="${k}" ${cost == null || meta.coins < cost ? 'disabled' : ''}>${cost == null ? L('MAX') : cost.toLocaleString()}${cost != null && meta.coins < cost ? `<small>${L('{n} to go', { n: (cost - meta.coins).toLocaleString() })}</small>` : ''}</button></div>`;
    }).join('');
    // 旧存档：升级重做了，退回的金币说一声（看过一次就不再说）
    $('sNote').textContent = meta.refund ? L('Upgrades are new! The {c} coins you spent on the old ones are back.', { c: meta.refund.toLocaleString() }) : L('Permanent. Every run starts stronger.');
    if (meta.refund) { delete meta.refund; saveMeta(); }
    Snd.open();
    $('shop').hidden = false;
  }

  /* ---------- 装备三选一 ----------
   * 跑过两局以后，每次开跑前从七件里随机摆出三件，选一件，这一局有效。不满意可以花金币重摇。
   * 每件装备改了哪条规则写在 core.js 的 GEAR 里；这里只有界面。图标是美术画的装备图标。
   */
  const GEAR = H.GEAR, GEARS = Object.keys(GEAR), GEAR_AT = 2, REROLL = 30;
  // 第三次试玩报告：80–220 太贵，新玩家试不完七件。降一档，而且每件第一次用都免费（试过一次才知道值不值得买）
  const GEAR_COST = { wind: 120, magnet: 100, shoes: 80, lungs: 70, exhale: 60, tank: 50, mask: 50 };
  const gearTried = k => (meta.tried || []).includes(k);
  let adGear = false;      // 看过广告：这一次三件里随便挑一件免费（docs/33）
  const gearFree = k => adGear || !gearTried(k) || meta.gearDay !== dayKey(new Date());      // 没试过的免费；另外每天第一件免费
  const gearTag = k => adGear ? L('FREE') : !gearTried(k) ? L('FREE TRY') : meta.gearDay !== dayKey(new Date()) ? L('FREE') : (meta.tix || 0) > 0 ? L('TICKET') : GEAR_COST[k];      // TICKET：签到送的免费装备券
  const GEAR_IMG = { lungs: 'gear-lung-capacity', tank: 'gear-water-tank', shoes: 'gear-running-shoes', mask: 'gear-mask', exhale: 'gear-hand-fan', wind: 'gear-second-wind', magnet: 'gear-coin-magnet' };
  let offer = [], gearFrom = 'title';
  function rollGear() { const pool = GEARS.slice(); offer = [0, 1, 2].map(() => pool.splice((Math.random() * pool.length) | 0, 1)[0]); }
  function showGear() {
    coinsUI();
    const day = meta.gearDay !== dayKey(new Date()), trial = offer.some(k => !gearTried(k));
    $('gNote').textContent = L(adGear ? 'Pick any one, free. It lasts one run.' : day ? 'Your first gear today is free. It lasts one run.' : trial ? 'Gear you have never worn is free to try once.' : 'One item, for this run only. Or keep your coins and run without.')
      + (meta.tix > 0 ? L(meta.tix > 1 ? ' You have {n} free gear tickets.' : ' You have {n} free gear ticket.', { n: meta.tix }) : '');
    $('gList').innerHTML = offer.map(k => { const free = gearFree(k);
      return `<button class="gearpick" type="button" data-gear="${k}" ${!free && !(meta.tix > 0) && meta.coins < GEAR_COST[k] ? 'disabled' : ''}><img src="${H.MANIFEST.images[GEAR_IMG[k]]}" alt=""><div><b>${L(GEAR[k].name)}</b><span>${L(GEAR[k].text)}</span></div><i class="cost${free ? ' free' : ''}">${gearTag(k)}</i></button>`; }).join('');
    // 金币不够重摇时，可以看一段广告换一次
    $('bReroll').textContent = meta.coins >= REROLL ? L('Reroll · {n} coins', { n: REROLL }) : L('Reroll · watch ad');
    // 三件都要花钱的时候：一个绿按钮，看段广告这一次随便挑一件免费。每局开跑前都有一次，不靠死（docs/33：一局三四分钟，死得少，广告位跟着少）
    $('bGearAd').hidden = adGear || offer.some(gearFree) || meta.tix > 0;
    $('bGearAd').textContent = L('▶︎ Watch ad · pick one free');
    Snd.open();
    $('gear').hidden = false;
  }

  /* ---------- 每日挑战 ----------
   * 同一天所有人是同一条街、同一件装备（都由日期算出来）。一天可以跑很多次，只记当天最远。
   * 奖励：当天第一次跑完发连续天数奖励（连续第几天就乘 30，最多 150）；跑到 250、500、900 米各发一次 60、120、250。
   */
  const DAILY_GOALS = [[250, 60], [500, 120], [900, 250]];
  const two = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  function hashOf(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function daily() {
    const now = new Date(), key = dayKey(now), h = hashOf('hyb-daily-' + key);
    return { key, seed: h % 1e9, gear: GEARS[(h >>> 8) % GEARS.length], label: now.toLocaleDateString(H.locale(), { month: 'short', day: 'numeric' }), before: dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) };
  }
  // 今天的进度。换了一天就从头算；昨天没跑，连续天数归零
  function dailyState(D) {
    const s = meta.daily || {};
    if (s.key === D.key) return s;
    return { key: D.key, best: 0, got: 0, streak: s.key === D.before ? s.streak || 0 : 0, played: false };
  }
  function settleDaily(r) {
    const s = dailyState(daily()), lines = []; let coins = 0;
    if (!s.played) { s.played = true; s.streak++; const b = 30 * Math.min(5, s.streak); coins += b; lines.push(`day ${s.streak} streak +${b}`); }
    while (s.got < DAILY_GOALS.length && r.dist >= DAILY_GOALS[s.got][0]) { coins += DAILY_GOALS[s.got][1]; lines.push(`${DAILY_GOALS[s.got][0]} m goal +${DAILY_GOALS[s.got][1]}`); s.got++; }
    s.best = Math.max(s.best, r.dist);
    meta.daily = s; meta.coins += coins; saveMeta();
    return { coins, lines, s, hats: grantHats() };      // 连续 7 天送帽子
  }
  const nextGoal = s => s.got < DAILY_GOALS.length ? `next goal ${DAILY_GOALS[s.got][0]} m (+${DAILY_GOALS[s.got][1]})` : 'all goals done';
  function showDaily() {
    $('bDaily').hidden = runs < GEAR_AT;
    // 今天还没跑：红点；已经连着跑了几天就写火苗和天数，提醒别断。跑过了：绿色的火苗和天数（docs/15「把明天再来露出来」）
    const s = dailyState(daily()), b = $('tDailyBadge');
    b.hidden = s.played && !s.streak;
    b.innerHTML = s.streak ? `${ICON.flame}${s.streak}` : '!';
    b.classList.toggle('ok', !!s.played);
  }
  function showDailyCard() {
    const D = daily(), s = dailyState(D), G = GEAR[D.gear];
    $('dTitle').innerHTML = `${L('Daily run')} <small>${D.label}</small>`;      // 日期缩成小字，标题带里放得下（docs/33）
    $('dNote').textContent = L('Everyone gets the same street and the same gear today. Run it as often as you like.');
    // 连续天数一行字（七日签到搬到了单独的面板，见 showCheckin）
    const sk = s.streak || 0, bonus = 30 * Math.min(5, s.played ? sk : sk + 1);
    $('dStreak').innerHTML = `<span>${sk ? ICON.flame + L('{n}-day streak', { n: sk }) : L('Start a streak')}\u00a0· ${s.played ? L('see you tomorrow') : L('+{c} coins for today’s run', { c: bonus })}</span>`;
    $('dGear').innerHTML = `<img src="${H.MANIFEST.images[GEAR_IMG[D.gear]]}" alt=""><div><b>${L('Today: {g}', { g: L(G.name) })}</b><span>${L(G.text)}</span></div>`;
    $('dGoals').innerHTML = DAILY_GOALS.map(([m, c], i) => `<li class="${i < s.got ? 'done' : ''}"><span>${i < s.got ? '✓ ' : ''}${L('Run {m} m', { m })}</span><b>${i < s.got ? L('done') : L('+{c} coins', { c })}</b></li>`).join('')
      + (s.played ? `<li><span>${L('Today’s best')}</span><b>${L('{n} m', { n: s.best.toLocaleString() })}</b></li>` : '');
    Snd.open();
    coinsUI(); $('daily').hidden = false;
  }

  /* ---------- 试玩记录（docs/02 的 5 人试玩用）----------
   * 每局结束记一条，存在本机（hyb3-log，最多 120 条，不往外发）。测试者模式里 How to play 下面多一个「Playtest log」，按每次打开 App 分组：
   * 从点 PLAY 到能操作用了几秒、跑了几局、每局多长、死在哪、怎么死的。找人试玩时不用一直盯着，事后看这里，也可以复制出来贴给我。
   */
  const LOG_KEY = 'hyb3-log', SESSION = Date.now();
  let runLog = (() => { try { const a = JSON.parse(store.get(LOG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } })();
  let playTapAt = 0, ctrlSecs = null;
  let bootSecs = null;      // 这次打开 App 到主页出来用了几秒（试玩记录用，2026-11-16：素材 16 MB 进主页前全部加载完，手机上要多久没量过）
  const runStat = { turbos: 0, bumps: 0, slips: 0, gasps: 0, coughs: 0, banks: 0, perfects: 0, bigPush: 0, hitch: 0, fr: 0, frT: 0 };      // hitch：一帧超过 50 毫秒（卡一下）；fr、frT：帧数和总时长，算平均一帧多少毫秒
  let wallAt = -99, gaspAt = -99, relSmokeAt = -99;      // gaspAt、relSmokeAt：这一局最近一次气用光、在烟里松手的时刻（呛到时按这个换提示）      // 最近一次撞在三条道全堵的墙上是什么时候（结算页按这个换提示）
  let nearAt = -99, closeAt = -99;      // 死里逃生：大烟雾贴到 35 以内的时刻、上一次喊 CLOSE CALL 的时刻
  /* ---------- 统计（2026-11-20，docs/30）----------
   * 上线后靠次日留存定继续还是收工（docs/02）。留存、每天多少人、玩多久，Firebase 自己就算（first_open、user_engagement），这里只补它看不到的：
   * 一局跑了多久、死在哪、第几局走的、看没看广告、买了什么、升级了什么、进主页用了几秒。
   * App 里壳挂 window.hybTrack(name, params)（iOS：GameViewController.swift 的 AnalyticsBridge，安卓：Telemetry.kt）；网页里没有就不发，测试者模式下打在控制台。
   * 只发数字和短字（Firebase 的参数值最长 100 个字），不发任何能认出人的东西。 */
  function track(name, params) {
    try {
      const p = {};
      for (const [k, v] of Object.entries(params || {})) if (v != null) p[k] = typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? v : String(v).slice(0, 100);
      if (window.hybTrack) window.hybTrack(name, p); else if (tester) console.debug('[track]', name, p);
    } catch (_) {}
  }
  function logRun(r, extra) {
    track('run_end', { run: runs, secs: Math.round(r.time), meters: r.dist, why: r.hurt || 'slow', district: r.district, day: r.day, chain: r.bestChain,
      daily: !!runDaily, gear: g.gear || '', revive: (extra && extra.revive) || '', ctrl: ctrlSecs, start_day: g.startDay || 1 });
    runLog.push(Object.assign({ s: SESSION, at: Date.now(), n: runs, secs: Math.round(r.time), m: r.dist, why: r.hurt || 'slow', where: `${r.district} d${r.day}${g.startDay > 1 ? ` (from d${g.startDay})` : ''}`,
      gear: g.gear || '', daily: !!runDaily, chain: r.bestChain, stars: g.newStar || 0, ctrl: ctrlSecs, boot: bootSecs }, runStat, extra));
    bootSecs = null;      // 只记在这次打开后的第一局上
    ctrlSecs = null;
    if (runLog.length > 120) runLog = runLog.slice(-120);
    store.set(LOG_KEY, JSON.stringify(runLog));
  }
  function logText() {
    const out = [], bySess = {};
    for (const e of runLog) (bySess[e.s] = bySess[e.s] || []).push(e);
    const ss = Object.keys(bySess).sort((a, b) => b - a);
    if (!ss.length) return L('No runs yet.');
    for (const s of ss) {
      const L = bySess[s], d = new Date(+s), secs = L.map(e => e.secs).sort((a, b) => a - b), why = {};
      for (const e of L) why[e.why] = (why[e.why] || 0) + 1;
      const far = L.reduce((a, e) => e.m > a.m ? e : a, L[0]), ctrl = L.find(e => e.ctrl != null), boot = L.find(e => e.boot != null);
      out.push(`■ ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toTimeString().slice(0, 5)} · ${L.length} runs · ${Math.round(secs.reduce((a, b) => a + b, 0) / 60)} min`
        + `\n  run length median ${secs[secs.length >> 1]} s · farthest ${far.m} m (${far.where})` + (ctrl ? ` · PLAY→control ${ctrl.ctrl} s` : '') + (boot ? ` · open→home ${boot.boot} s` : '')
        + `\n  died of: ${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      for (const e of L) out.push(`  #${e.n} ${e.secs}s ${e.m}m ${e.where} · ${e.why}${e.gear ? ' · ' + e.gear : ''}${e.daily ? ' · daily' : ''} · bumps ${e.bumps}${e.slips != null ? ` slips ${e.slips}` : ''} coughs ${e.coughs} gasps ${e.gasps} · banks ${e.banks || 0} perfect ${e.perfects || 0} · best chain ${e.chain}${e.fr ? ` · ${Math.round(e.frT / e.fr * 1000)} ms/frame, hitches ${e.hitch}` : ''}${e.revive ? ' · revive ' + e.revive : ''}${e.stars ? ' · ★' + e.stars : ''}`);
    }
    return out.join('\n');
  }
  function showLog() {
    $('logText').textContent = logText();
    Snd.open(); $('log').hidden = false;
  }

  /* ---------- 七日签到（2026-11-16）----------
   * 你说原来的七个小圆点「一点都没有想要打卡的感觉」，让照国产游戏的七日签到做。所以：
   *   单独一个面板，七张奖励卡排开，越往后越值钱，第 7 天是一张大卡（Leo 戴着潜水镜的全身像，新帽子）；
   *   今天那张卡在发光、一跳一跳；按「领取」印章盖上去、金币一枚枚飞进钱包；可以看视频领双倍；
   *   每天第一次回到主页自动弹出来（第一局还没跑过不弹，免得挡住第一次开跑），主页左上角有礼包按钮带红点；
   *   累计签到，漏一天不清零，签满 7 天就拿到大奖，然后从第 1 天再来一轮（第 7 天换成 1,000 金币）。
   * 存档：meta.ci = { n: 一共领过几次, last: 最后领的那天 }。（meta.tix 免费装备券：试过一版，签到已经不送了；装备页里还认，旧存档有的照样能用）
   */
  // 只给一眼就懂的东西：金币越往后越多（金币堆越来越大），第 7 天是帽子。
  // 先试过第 3、5 天给「免费装备券」，你说看不懂那是什么（2026-11-16），改成金币
  const CI = [
    { coins: 100, art: 'coins-1' }, { coins: 150, art: 'coins-1' }, { coins: 200, art: 'coins-1' }, { coins: 250, art: 'coins-2' },
    { coins: 300, art: 'coins-2' }, { coins: 400, art: 'coins-3' }, { hat: 'hat-snorkel', coins: 500, art: 'prize' }
  ];
  // 升级页和商店的无底小图标（第二十批，game/tools/ui_art.py 拷进 assets/ui/）；别的名字照旧查 manifest
  const UI_PNG = { 'upgrade-sidestep': 'assets/ui/upgrade-sidestep.png', 'upgrade-lungs': 'assets/ui/upgrade-lungs.png', 'store-noads': 'assets/ui/store-noads.png' };
  const artSrc = k => UI_PNG[k] || H.MANIFEST.images[k];
  const CI_ART = { 'coins-1': 'assets/ui/reward-coins-1.png', 'coins-2': 'assets/ui/reward-coins-2.png', 'coins-3': 'assets/ui/reward-coins-3.png', prize: 'assets/ui/prize-snorkel.png', claimed: 'assets/ui/reward-claimed.png' };
  const ciState = () => meta.ci || { n: 0, last: '' };
  const ciCan = () => ciState().last !== dayKey(new Date());
  // 第 i 张卡（0..6）这一轮给什么：第 7 天的帽子已经有了就换成 1,000 金币
  // 第一轮的第 7 天是潜水镜帽子；之后每一轮（或者帽子早就有了）第 7 天换成 1,000 金币。w：第几轮（0 起）
  function ciReward(i, w) { const R = CI[i]; return R.hat && (w > 0 || (ownHat(R.hat) && !meta.ciHatGot)) ? { coins: 1000, art: 'coins-3' } : R; }
  function ciLabel(R) { return R.hat ? L('NEW HAT!') : `×${R.coins.toLocaleString()}`; }      // 卡很窄，字要短
  function showCheckin() {
    const S = ciState(), can = ciCan(), today = S.n % 7;
    // 显示的是哪一轮：今天已经领过、而且刚好领完第 7 天，还显示刚领完的这一轮（七张都盖了章）
    const week = Math.floor((can ? S.n : S.n - 1) / 7), nextI = can || today === 0 ? -1 : today;      // 明天那张标 TOMORROW
    $('ciGrid').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const R = ciReward(i, week), d = can ? i < today : (today === 0 || i < today), t = can && i === today, big = i === 6;
      // 第 7 天只放奖品本身（潜水镜放在小绒垫上），不放人：放 Leo 的全身像，你说像在送一个人（2026-11-16）
      const pic = R.hat ? `<img class="ciprize" src="${CI_ART.prize}" alt="">` : `<img class="ciimg" src="${CI_ART[R.art]}" alt="">`;
      return `<div class="cicard${d ? ' got' : ''}${t ? ' today' : ''}${big ? ' wide' : ''}${i === nextI ? ' next' : ''}" data-i="${i}">`
        + `<b class="ciday">${t ? L('TODAY') : i === nextI ? L('NEXT') : L('DAY {n}', { n: i + 1 })}</b>${big ? '<i class="rays"></i>' : ''}${pic}`
        + `<i class="ciamt">${big && R.hat ? `${L('NEW HAT!')} <em>+${R.coins}</em>` : ciLabel(R)}</i>`
        + `${d ? `<img class="cistamp" src="${CI_ART.claimed}" alt="${L('Claimed')}">` : ''}</div>`;
    }).join('');
    $('ciSub').textContent = week ? L('Week {n}\u00a0· check in every day', { n: week + 1 }) : L('Check in every day\u00a0· Day 7: a new hat!');      // · 粘在前一个词后面：原来小屏上第二行以「·」开头（2026-11-16）
    const R = ciReward(today, Math.floor(S.n / 7));
    $('ciNote').textContent = can ? (R.hat ? L('Day 7! Claim your new hat.') : L('Day {n}: {c} coins', { n: today + 1, c: R.coins.toLocaleString() }))
      : (() => { const N = ciReward(S.n % 7, Math.floor(S.n / 7)); return N.hat ? L('Come back tomorrow for a new hat.') : L('Come back tomorrow for {c} coins.', { c: N.coins.toLocaleString() }); })();
    $('bCiClaim').hidden = !can; $('bCiDouble').hidden = !can || !!R.hat;
    coinsUI(); Snd.open(); $('checkin').hidden = false;
  }
  let ciBusy = false;
  function ciClaim(double) {
    if (!ciCan() || ciBusy) return;
    const go = () => {
      const S = ciState(), i = S.n % 7, W = ciReward(i, Math.floor(S.n / 7)), k = double ? 2 : 1;
      if (W.coins) meta.coins += W.coins * (W.hat ? 1 : k);
      let hat = null;
      if (W.hat && !ownHat(W.hat)) { meta.hats = (meta.hats || []).concat(W.hat); wearHat(W.hat); meta.hatNew = true; meta.ciHatGot = true; hat = HATS.find(h => h.id === W.hat); }      // 第 7 天的大奖领了就戴上，马上看得到
      meta.ci = { n: S.n + 1, last: dayKey(new Date()) }; saveMeta();
      const card = $('ciGrid').querySelector(`[data-i="${i}"]`), from = card ? card.getBoundingClientRect() : null;
      if (W.coins && from) coinHold = 650;
      showCheckin(); showMeta();
      const nc = $('ciGrid').querySelector(`[data-i="${i}"]`); if (nc) nc.classList.add('just');      // 印章「啪」地盖下去
      Snd.star(3);
      if (W.coins && from) flyCoins(from, Math.min(12, 4 + Math.round(W.coins * (W.hat ? 1 : k) / 100)));
      if (hat) { R.confettiScreen(110); Snd.win(); $('ciNote').textContent = L(meta.hat === hat.id ? 'New hat: {h}! You’re wearing it.' : 'New hat: {h}! Put it on in Hats.', { h: L(hat.name) }); }
      else $('ciNote').textContent = L('+{c} coins!', { c: (W.coins * k).toLocaleString() });
      scheduleRemind();
      // 第一次领完：问一句明天要不要提醒（只在 App 里，问过就不再问）
      if (window.hybRemind && !meta.remindAsked) setTimeout(() => { if (!$('checkin').hidden) showRemind(true); }, 1600);
    };
    if (!double) return go();
    ciBusy = true;
    showAd('checkin').then(ok => { ciBusy = false; if (ok) go(); });
  }
  // 金币一枚枚从卡上飞进右上角的钱包
  function flyCoins(from, n, target) {
    const tid = target || 'ciCoins', to = $(tid).getBoundingClientRect(), img = H.MANIFEST.images['item-coin'];
    for (let j = 0; j < n; j++) {
      const c = document.createElement('img'); c.src = img; c.className = 'flycoin'; document.body.appendChild(c);
      const x0 = from.left + from.width / 2 + (Math.random() - .5) * from.width * .5, y0 = from.top + from.height / 2 + (Math.random() - .5) * from.height * .4;
      const x1 = to.left + 12, y1 = to.top + to.height / 2, mx = (x0 + x1) / 2 + (Math.random() - .5) * 80, my = Math.min(y0, y1) - 60 - Math.random() * 60;
      const a = c.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 24}px) scale(1.1)`, opacity: 1, offset: .15 },
        { transform: `translate(${mx}px, ${my}px) scale(1)`, opacity: 1, offset: .55 },
        { transform: `translate(${x1}px, ${y1}px) scale(.6)`, opacity: .9 }
      ], { duration: 700 + j * 60, delay: j * 55, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
      a.onfinish = () => { c.remove(); Snd.coin(); const w = $(tid); w.classList.remove('pop'); void w.offsetWidth; w.classList.add('pop'); };
      setTimeout(() => c.remove(), 1500 + j * 115);      // 动画被节流没跑完也别留在屏幕上
    }
  }
  $('bCiClaim').addEventListener('click', () => { Snd.init(); ciClaim(false); });
  $('bCiDouble').addEventListener('click', () => { Snd.init(); ciClaim(true); });
  $('bCiClose').addEventListener('click', () => { Snd.click(); $('checkin').hidden = true; showMeta(); });
  $('bGift').addEventListener('click', () => { Snd.init(); Snd.click(); showCheckin(); });

  /* ---------- 第二天的提醒（docs/15「把明天再来露出来」）----------
   * 只在 App 里有（iOS 壳挂 window.hybRemind，本地通知，不连网）。同类游戏靠每日挑战加一条提醒把人叫回来。
   * 第一次跑完每日挑战，先在游戏里问一句要不要提醒，说好了才弹系统的通知权限：一打开就弹系统框，多数人会点不允许，而且以后再也问不了。
   * 之后每跑完一次每日挑战，排一条第二天傍晚 6 点的通知（同一个 id，新的盖旧的）。人不来，就只提醒这一次，不天天刷。
   */
  const REMIND_HOUR = 18;
  let askRemind = false;
  function scheduleRemind() {
    const N = window.hybRemind; if (!N || !meta.remindOn) return;
    const s = dailyState(daily()), at = new Date(); at.setDate(at.getDate() + 1); at.setHours(REMIND_HOUR, 0, 0, 0);
    // 明天能领签到奖励就写奖励（第几天、给什么），不然写每日挑战
    const C = meta.ci, nx = C && C.n % 7, W = C ? ciReward(nx, Math.floor(C.n / 7)) : null;
    // 通知的字带上游戏里的角色（2026-11-17）：原来是「第 N 天的签到奖励到了」「新的每日挑战来了」，像系统消息。现在让大烟雾出来挑衅一句
    const T = W ? (W.hat ? [L('🎁 Day 7: a brand-new hat!'), L('Grab it before the Big Smog does 😤')] : [L('🎁 Day {n} gift is ready', { n: nx + 1 }), L('{c} coins are waiting. The Big Smog is already out on the street…', { c: W.coins.toLocaleString() })])
      : s.streak > 1 ? [L('🔥 {n}-day streak on the line', { n: s.streak }), L('One quick run today keeps it alive.')] : [L('The Big Smog is back 😤'), L('New street, new gear. Can you outrun it today?')];
    N.schedule({ id: 'daily', at: at.getTime(), title: T[0], body: T[1] });      // 通知的字按排的时候的语言写
  }
  function showRemind(fromCheckin) {
    if (!fromCheckin && (mode !== 'over' || $('over').hidden)) return;      // 已经点了再来一局或回主页，就不问了（下次跑完每日挑战再问）
    Snd.open(); $('remind').hidden = false;
  }
  $('bRemindYes').addEventListener('click', () => {
    Snd.click(); $('remind').hidden = true; meta.remindAsked = true; saveMeta();
    window.hybRemind.ask().then(ok => { meta.remindOn = ok; saveMeta(); scheduleRemind(); });
  });
  $('bRemindNo').addEventListener('click', () => { Snd.click(); $('remind').hidden = true; meta.remindAsked = true; saveMeta(); });

  /* ---------- 广告和内购 ----------
   * 广告：App 里是 Google AdMob（ios/HoldYourBreath/Ads.swift，见 docs/14），iOS 壳往网页里挂 window.hybAds：
   *   window.hybAds   = { prepare({ noInter }) → Promise, show(kind) → Promise<{ ok, noAd }>, privacyRequired() → Promise<boolean>, privacyForm() → Promise }
   *   kind：'revive' 复活、'double' 金币翻倍、'reroll' 重摇装备、'swap' 换任务、'coins' 商店里领金币、'inter' 两局之间的插屏
   *   网页里（没有 hybAds）还是一张几秒钟的占位卡。
   * 内购还是占位：点了直接到账、不扣钱。接 StoreKit 时 iOS 壳挂上这个就行，这里不用改：
   *   window.hybStore = { buy(id) → Promise<boolean>, restore() → Promise<string[]>, price(id) → string | null }
   * 激励视频五处：被追上后看一段复活（一局一次）；结算时看一段金币翻倍；金币不够重摇装备时看一段；金币不够换任务时看一段；
   * 商店里看一段领 100 金币（每天 3 次）。
   * 插屏：从第 5 局起每 3 局在开跑前插一条，而且离上一条广告（包括激励视频）至少 2 分钟；买了去广告就没有。
   */
  // bonus：比最小那档每块钱多给多少，写在名字旁边让人一眼看出哪档划算
  const PRODUCTS = [
    { id: 'doubler', name: 'Coin doubler', text: 'Every coin counts twice. Forever.', price: '$4.99', img: 'item-coin', x2: true },
    { id: 'noads', name: 'Remove ads', text: 'No ads between runs.', price: '$2.99', img: 'store-noads' },
    { id: 'coins1', name: '1,500 coins', text: 'Your first upgrades', price: '$0.99', coins: 1500 },
    { id: 'coins2', name: '8,000 coins', text: 'A big upgrade', price: '$3.99', coins: 8000, bonus: '+32%' },
    { id: 'coins3', name: '25,000 coins', text: 'Weeks of running', price: '$9.99', coins: 25000, bonus: '+65%' }
  ];
  // 商店里看广告领金币：每天 3 次，每次 100
  const FREE_N = 3, FREE_COINS = 100;
  const freeLeft = () => meta.freeDay === dayKey(new Date()) ? Math.max(0, FREE_N - (meta.freeN || 0)) : FREE_N;
  const AD_TEXT = {
    revive: ['A reward video plays here', 'Afterwards you are back in the run.'], double: ['A reward video plays here', 'Afterwards your coins are doubled.'],
    reroll: ['A reward video plays here', 'Afterwards you get three new items.'], swap: ['A reward video plays here', 'Afterwards you get a new mission.'],
    coins: ['A reward video plays here', 'Afterwards you get {n} coins.'], checkin: ['A reward video plays here', 'Afterwards today’s reward is doubled.'],
    gear: ['A reward video plays here', 'Afterwards you pick one item for free.'], hat: ['A reward video plays here', 'Afterwards you wear this hat for 3 runs.'], inter: ['An ad between runs shows here', 'It can be closed after a moment. “Remove ads” takes these away.']
  };
  let sinceAd = 0, adTimer = null, lastAdAt = Date.now();      // 插屏至少隔 2 分钟：从打开游戏算起，看过任何一条广告重新算
  const AD_GAP = 120000;
  function fakeAd(kind) {
    return new Promise(done => {
      const wait = kind === 'inter' ? 2 : 3, btn = $('bAdClose'); let left = wait;
      $('adTitle').textContent = L(AD_TEXT[kind][0]); $('adText').textContent = L(AD_TEXT[kind][1], { n: FREE_COINS });
      btn.disabled = true; btn.textContent = String(left); $('ad').hidden = false;
      adTimer = setInterval(() => { left--; if (left > 0) btn.textContent = String(left); else { clearInterval(adTimer); btn.disabled = false; btn.textContent = L(kind === 'inter' ? 'Close' : 'Collect reward'); } }, 1000);
      btn.onclick = () => { $('ad').hidden = true; done(true); };
    });
  }
  // 真广告（App 里）。激励视频是玩家自己点的，没加载好要等几秒：先盖一张「Loading video…」，免得这几秒里点到别的。
  // 这会儿没有视频：卡上说一句，点 OK 关掉。插屏没加载好就这次不放，接着开跑
  let noVideo = false;
  function realAd(kind) {
    const reward = kind !== 'inter', box = $('ad').querySelector('.adbox'), btn = $('bAdClose');
    const close = () => { $('ad').hidden = true; box.classList.remove('wait'); btn.hidden = false; };
    if (reward) { box.classList.add('wait'); $('adTitle').textContent = L('Loading video…'); $('adText').textContent = ''; btn.hidden = true; $('ad').hidden = false; }
    return window.hybAds.show(kind).then(r => new Promise(done => {
      noVideo = !!(r && r.noAd);
      if (reward && noVideo) {
        $('adTitle').textContent = L('No video right now'); $('adText').textContent = L('Try again in a bit.');
        btn.hidden = false; btn.disabled = false; btn.textContent = L('OK');
        btn.onclick = () => { Snd.click(); close(); done(false); };
        return;
      }
      close(); done(!!(r && r.ok));
    }));
  }
  function showAd(kind) {
    Snd.music(false); noVideo = false;
    return Promise.resolve(window.hybAds ? realAd(kind) : fakeAd(kind)).catch(() => false).then(ok => { if (ok) { sinceAd = 0; lastAdAt = Date.now(); } track('ad', { kind, ok: !!ok, run: runs }); return ok; });
  }
  // 广告的两个弹窗（只在 App 里）：欧洲、英国的玩家先问同不同意，再问苹果的「允许追踪」（问过的不再问），然后后台预加载。
  // 新玩家第一局跑完、讲完开场故事以后才问（afterFirst，2026-11-21）；问过的人每次打开 App 第一次点开跑时在后台再走一遍，看不到弹窗，不等它。
  // 网太慢 12 秒还没问完也先往下走
  let adsAsked = null, adsWait = false;
  function askAds() {
    if (!adsAsked) adsAsked = window.hybAds ? Promise.race([window.hybAds.prepare({ noInter: !!meta.noAds }), new Promise(r => setTimeout(r, 12000))]) : Promise.resolve();
    return adsAsked;
  }
  // 问过弹窗没有。meta.ads：新玩家第一次点开跑时记 false，第一局完了问过记 true。1.0 的老存档没有这一项：看过故事就是问过（原来故事前先问）
  const adsDone = () => meta.ads === true || (meta.ads == null && !!meta.story);
  // 第一局被追上以后：先讲三句开场故事（大烟雾说它是谁，Leo 说憋住气跑），再问广告的两个弹窗，然后出结算。
  // 第一局不问复活、结算前没有广告，所以这之前不需要广告
  function afterFirst(then) {
    mode = 'adwait';
    if (!meta.story) return showStory(() => afterFirst(then), true);
    if (!adsDone()) { adsWait = true; return askAds().then(() => { adsWait = false; meta.ads = true; saveMeta(); then(); }); }
    then();
  }
  /* ---------- 开奖（2026-11-21，docs/33）----------
   * 用户说充完钱「没有非常快乐」：原来买到金币只是十枚小金币飞进右上角、响一声，不到一秒，商店还是原样。
   * 同类游戏（地铁跑酷、皇室战争、Royal Match）买到东西都有一个整屏的「开奖」：背后转的光、东西大大地弹出来、数字往上滚、彩纸、一句谢谢，
   * 点「收下」以后东西才飞进钱包。这里买金币包、金币翻倍、去广告、看广告领金币、结算看广告领几倍、买帽子都走这一个。
   * o：kick 上面一行小字；pic 大图的 HTML；cls 图的样式（hat 是竖长的全身像）；count 数字从 0 滚上去（金币）；title 不滚的大字；sub 下面一句；
   *    say Leo 说的话；fly { n, target } 收下时飞几枚金币、飞到哪个钱包；after 收下以后做什么；next false 不出「下一样」那条 */
  const SAY = ['Thanks, boss!', 'Let’s go!', 'Woo-hoo!', 'Best day ever!'];
  const CONF = ['#ffd23f', '#f0433a', '#2fb85a', '#1c9bf0', '#8a5cf6', '#ff9fb6', '#ffffff'];
  let rwNow = null, rwT = 0;
  const rwQ = [];
  // 跑着、被追上那几秒、讲故事的时候不开奖（内购可能在跑到一半才到账，比如家长批准购买）：先排着，回主页或结算时再开
  const rwBusy = () => ['play', 'ending', 'revive', 'adwait'].includes(mode) || !$('story').hidden;
  function flushReward() { if (!rwNow && rwQ.length && !rwBusy()) reward(rwQ.shift()); }
  function reward(o) {
    if (rwNow || rwBusy()) { rwQ.push(o); return; }      // 连着到了两样（恢复购买、补发）：一样一样开
    rwNow = o;
    $('rwKick').textContent = o.kick || '';
    $('rwPic').className = 'rwpic' + (o.cls ? ' ' + o.cls : ''); $('rwPic').innerHTML = o.pic || '';
    $('rwTitle').className = 'rwtitle' + (o.count != null ? '' : ' w'); $('rwTitle').textContent = o.count != null ? '+0' : o.title || '';
    $('rwSub').textContent = o.sub || '';
    $('rwSay').textContent = o.say === '' ? '' : o.say || L(SAY[(Math.random() * SAY.length) | 0]);
    $('reward').classList.toggle('solo', o.cls === 'hat');      // 大图就是 Leo 本人（新帽子）：左下角不再冒一个 Leo
    $('rwConf').innerHTML = CALM ? '' : Array.from({ length: 46 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--c:${CONF[i % CONF.length]};--t:${(2.2 + Math.random() * 1.8).toFixed(2)}s;--d:${(.15 + Math.random() * .9).toFixed(2)}s;--dx:${((Math.random() - .5) * 160).toFixed(0)}px;--r:${((Math.random() - .5) * 1440).toFixed(0)}deg"></i>`).join('');
    const nx = $('bRwNext'); nx.hidden = true;
    if (o.next !== false) showGoal(nx);      // 下一样在攒的：买得起了就是绿的，点了直接去买
    $('reward').hidden = false;
    Snd.init(); Snd.fanfare(); buzz('perk');
    // 数字从 0 滚上去，一路叮叮响
    if (o.count != null) {
      const t0 = performance.now(), run = ++rwT, D = 950, N = o.count;
      let lastTick = -1;
      const stepN = now => {
        if (run !== rwT) return;
        const u = Math.min(1, Math.max(0, (now - t0 - 380) / D)), v = Math.round(N * (1 - Math.pow(1 - u, 3)));
        $('rwTitle').textContent = '+' + v.toLocaleString();
        const k = Math.floor(u * 9); if (k !== lastTick && u > 0 && u < 1) { lastTick = k; Snd.coin(); }
        if (u < 1) requestAnimationFrame(stepN);
      };
      requestAnimationFrame(stepN);
      setTimeout(() => { if (run === rwT) $('rwTitle').textContent = '+' + N.toLocaleString(); }, 380 + D + 300);      // 动画帧没走也写上最后的数
    }
  }
  function closeReward(then) {
    const o = rwNow; if (!o) return;
    rwT++;
    const from = $('rwPic').getBoundingClientRect();
    $('reward').hidden = true; rwNow = null; Snd.click();
    if (o.fly && o.fly.n) coinHold = 650;
    if (o.after) o.after();
    if (o.fly && o.fly.n && $(o.fly.target)) flyCoins(from, o.fly.n, o.fly.target);
    if (then) then();
    if (rwQ.length) setTimeout(flushReward, 350);
  }
  $('bRwGo').addEventListener('click', () => closeReward());
  $('bRwNext').addEventListener('click', () => { const el = $('bRwNext'); closeReward(() => openGoal(el)); });
  // 现在开着哪个钱包，金币就飞到哪个
  const walletId = () => !$('store').hidden ? 'stCoins' : !$('hats').hidden ? 'hCoins' : !$('shop').hidden ? 'sCoins' : !$('over').hidden ? 'oCoins' : 'tCoins';
  const packImg = P => CI_ART[P.coins >= 20000 ? 'coins-3' : P.coins >= 5000 ? 'coins-2' : 'coins-1'];
  function buysLine(have) {
    const b = buysWith(have), top = b.filter(x => x.up).pop() || b[b.length - 1];
    return !b.length ? '' : b.length === 1 ? L('Enough for {x}', { x: top.name }) : L('Enough for {n} things, incl. {x}', { n: b.length, x: top.name });
  }
  function grant(id) {
    const P = PRODUCTS.find(x => x.id === id); if (!P) return;
    track('iap', { id, run: runs });
    if (P.coins) meta.coins += P.coins; else if (P.id === 'doubler') meta.doubler = true; else meta.noAds = true;
    saveMeta();      // 先存下来：开奖画面还没点「收下」就被关掉，东西也已经到手
    const after = () => { if (!$('store').hidden) showStore(); showMeta(); };
    if (P.coins) reward({ kick: L('Coins delivered!'), pic: `<img src="${packImg(P)}" alt="">`, count: P.coins, sub: buysLine(meta.coins), fly: { n: 14, target: walletId() }, after });
    else if (P.id === 'doubler') reward({ kick: L('Coin doubler'), pic: `<div class="x2"><img src="${H.MANIFEST.images['item-coin']}" alt=""><i>×2</i></div>`, title: L('Every coin ×2!'), sub: L('From now on, every coin you pick up counts twice. Forever.'), after });
    else reward({ kick: L('Remove ads'), pic: `<img src="${artSrc('store-noads')}" alt="">`, title: L('No more ads!'), sub: L('No ads between runs, ever. Thank you for supporting a tiny team!'), say: L('Thank you!'), after });
  }
  function showStore() {
    coinsUI();
    const left = freeLeft(), coinImg = H.MANIFEST.images['item-coin'];
    const price = P => (window.hybStore && window.hybStore.price(P.id)) || P.price, byId = id => PRODUCTS.find(P => P.id === id);
    /* 排法（2026-11-21，docs/33）：原来六样一样大、一样白地排成一列，看不出哪个是主角。现在分四块：
     *   最上面金色大卡：金币翻倍（最划算，背后转的光）；买过了变绿，写「已开启」。
     *   一条绿色大按钮：看广告领金币（今天还剩几次）。
     *   三个金币包并排，越往右越大，中间那个标「最受欢迎」；每个写够买几样。整张卡都能点。
     *   最下面一行小的：去广告。恢复购买是卡片最底下的小字链接 */
    /* 第三轮（2026-11-21，用户在手机上看）：「卖的东西很多，但是很乱，每个按钮都不太一样：有的整个能点，有的后面这个能点，有的很小；去广告的已拥有超出去了」。
     * 现在一条规矩：每样东西是一张卡片，整张都能点；右边一个同样大小的按钮——价钱是黄的，看广告是绿的带 ▶︎。
     * 已经买了的不是按钮：挪到最下面「已购买」，右边一个小绿字标签。金币包还是三张并排，价钱按钮和别的一样大、一样黄 */
    const D = byId('doubler'), dOwn = !!meta.doubler, N = byId('noads'), nOwn = !!meta.noAds;
    const act = (cls, inner) => `<i class="act ${cls}">${inner}</i>`;
    const card = (attrs, cls, img, name, text, right) => `<button class="stcard${cls ? ' ' + cls : ''}" type="button" ${attrs}>${img}<span class="sc"><b>${name}</b><span>${text}</span></span>${right}</button>`;
    const owned = (img, name, text) => `<div class="stcard owned">${img}<span class="sc"><b>${name}</b><span>${text}</span></span>${act('own', L('Owned'))}</div>`;
    const x2 = `<span class="x2"><img src="${coinImg}" alt=""><i>×2</i></span>`;
    const feat = dOwn ? '' : card('data-buy="doubler"', 'feat', `<i class="tagbest">${L('Best value')}</i>${x2}`, L(D.name), L(D.text), act('pay', price(D)));
    const free = card(`data-free="1" ${left ? '' : 'disabled'}`, 'free', `<img src="${coinImg}" alt="">`, L('Free coins'),
      left ? L(left > 1 ? '{n} videos left today' : '{n} video left today', { n: left }) : L('Back tomorrow'), left ? act('ad', `${ICON.play}+${FREE_COINS}`) : act('off', L('free|Done')));
    const packs = `<div class="stpacks">${['coins1', 'coins2', 'coins3'].map(id => { const P = byId(id), hot = id === 'coins2', n = buysWith(meta.coins + P.coins).length;
      return `<button class="pack${hot ? ' hot' : ''}" type="button" data-buy="${id}">${hot ? `<i class="hottag">${L('POPULAR')}</i>` : ''}${P.bonus ? `<i class="bonus">${P.bonus}</i>` : ''}<img src="${packImg(P)}" alt=""><b>${P.coins.toLocaleString()}</b>`
        + `<span>${n ? L(n > 1 ? 'Buys {n} things' : 'Buys 1 thing', { n }) : L(P.text)}</span>${act('pay', price(P))}</button>`; }).join('')}</div>`;
    const noads = nOwn ? '' : card('data-buy="noads"', '', `<img src="${artSrc(N.img)}" alt="">`, L(N.name), L(N.text), act('pay', price(N)));
    const mine = (dOwn ? owned(x2, L(D.name), L('On! Every coin counts twice.')) : '') + (nOwn ? owned(`<img src="${artSrc(N.img)}" alt="">`, L(N.name), L(N.text)) : '');
    $('stList').innerHTML = feat + free + packs + noads + (mine ? `<p class="stsec">${L('Purchased')}</p>${mine}` : '');
    // 测试用的说明和清零按钮：只在测试者模式里出现（连点五下「How to play」标题打开），正式包里玩家看不到
    $('stNote').textContent = window.hybStore || !tester ? '' : L('Test build: purchases are free and ads are placeholders.');
    $('bResetCoins').hidden = !!window.hybStore || !tester;
    Snd.open();
    $('store').hidden = false;
  }

  /* ---------- 开场：第一次点 PLAY 之前的一段对话，以后可以从主页左上角的书再看 ----------
   * 整屏的场景，人物的半身像站在对话框上面：主角在左，别人在右，谁说话谁亮着。
   * 字一个一个打出来。点一下：没打完就直接打完，打完了就下一句。
   */
  const WHO = {
    leo: { name: 'LEO', side: 'l', tag: '#1c9bf0' },
    man: { name: 'OFFICE GUY', side: 'r', tag: '#5d6675' },
    kid: { name: 'HOODIE KID', side: 'r', tag: '#5d6675' },
    smog: { name: 'THE BIG SMOG', side: 'r', tag: '#3a3550' }
  };
  // [场景, 谁在说, 左边主角的表情, 右边站着谁, 台词, 名牌上临时改叫什么]
  const TALK = [
    ['scene-1', 'leo', 'leo-happy', null, 'New York! I saved up all year for this walk.'],
    ['scene-1', 'leo', 'leo-happy', null, 'Fresh air, here I come!'],
    ['scene-2', 'man', 'leo-sniff', 'office', 'Morning, kid. *puff*'],
    ['scene-2', 'leo', 'leo-sniff', 'office', '…What is that smell?'],
    ['scene-2', 'kid', 'leo-shock', 'hoodie', '*puff* …Sup.'],
    ['scene-2', 'leo', 'leo-angry', 'hoodie', 'Is EVERYONE on this street smoking?!'],
    ['scene-3', 'smog', 'leo-shock', 'smog-smirk', 'Heh heh heh…', '???'],
    ['scene-3', 'leo', 'leo-shock', 'smog-smirk', 'Who said that?!'],
    ['scene-3', 'smog', 'leo-shock', 'smog-angry', 'All that smoke had to go somewhere. Now I go wherever YOU go.'],
    ['scene-3', 'leo', 'leo-hold', 'smog-angry', 'Mmmph! (Hold your breath, Leo. And RUN!)']
  ];
  // 第一次点 PLAY 只放这三句就开跑：前 30 秒应该让人自己冲过第一团烟，而不是点十下对话
  const TEASER = [TALK[0], TALK[8], TALK[9]];
  let talkI = 0, talkN = 0, talkT = null, storyThen = null, LINES = TALK;
  // 换半身像：新人物从旁边滑进来，同一个人换表情或者开口说话就跳一下；不说话的暗下去
  function setBust(el, name, speaking) {
    if (!name) { el.removeAttribute('src'); el.dataset.n = ''; return; }
    const was = el.dataset.n || '', kick = c => { el.classList.remove('enter', 'hop'); void el.offsetWidth; el.classList.add(c); };
    if (was !== name) { el.src = H.MANIFEST.images['bust-' + name]; el.dataset.n = name; const same = was.split('-')[0] === name.split('-')[0]; kick(same ? 'hop' : 'enter'); if (!same && was !== '') Snd.pop(2); }
    else if (speaking) kick('hop');
    el.classList.toggle('dim', !speaking);
  }
  function showLine() {
    const [bg, who, left, right, en, alias] = LINES[talkI], text = L(en), P = WHO[who], img = H.MANIFEST.images, box = $('story'), pic = $('stBg'), dlg = $('stDlg');
    if (!pic.src.endsWith(img[bg])) {
      // 旧场景垫在下面，新场景淡进来。大烟雾出场不淡入：画面直接切过去抖一下，来一声低吼
      if (pic.getAttribute('src')) box.style.backgroundImage = `url(${pic.getAttribute('src')})`;
      pic.src = img[bg]; pic.classList.remove('in'); box.classList.remove('quake'); void pic.offsetWidth;
      if (who === 'smog') { box.classList.add('quake'); Snd.smog(); } else { pic.classList.add('in'); Snd.open(); }
    }
    setBust($('stL'), left, P.side === 'l'); setBust($('stR'), right, P.side === 'r');
    dlg.classList.toggle('r', P.side === 'r'); dlg.style.setProperty('--tag', P.tag);
    $('stName').textContent = alias || L(P.name);
    talkN = 0; $('stText').textContent = ''; $('stMore').hidden = true;
    clearInterval(talkT);
    talkT = setInterval(() => {
      talkN++; $('stText').textContent = text.slice(0, talkN);
      if (talkN % 2 === 0 && text[talkN - 1] !== ' ') Snd.blip(who === 'smog' ? 0 : who === 'leo' ? 2 : 1);
      if (talkN >= text.length) { clearInterval(talkT); talkT = null; $('stMore').hidden = false; }
    }, 26);
  }
  function showStory(then, short) {
    talkI = 0; storyThen = then; LINES = short ? TEASER : TALK;
    const box = $('story'); box.style.backgroundImage = ''; box.classList.remove('quake'); $('stBg').removeAttribute('src');
    for (const id of ['stL', 'stR']) { $(id).removeAttribute('src'); $(id).dataset.n = ''; }
    box.hidden = false; showLine();
  }
  function endStory() {
    clearInterval(talkT); talkT = null; $('story').hidden = true; meta.story = true; saveMeta();
    const then = storyThen; storyThen = null; if (then) then();
  }
  function tapStory() {
    Snd.init();
    // 点一下就是下一句，字还在往外打也一样（2026-11-21）。原来打字时点一下只是把这句补全，再点才翻，性急的人一句要点两下
    clearInterval(talkT); talkT = null;
    if (talkI < LINES.length - 1) { talkI++; showLine(); return; }
    endStory();
  }

  /* ---------- 城市 ----------
   * 现在只有纽约。打败地铁口的雪茄老板算把这座城市走通（之后是第二天，更快更密，一直跑下去）。
   * 后面三座城市先占个位置，让玩家知道这趟旅行还有下文；做出来以后，走通上一座才开下一座。
   */
  const CITIES = [['New York', 'city-newyork'], ['London'], ['Paris'], ['Tokyo']];
  /* 纽约的三颗星（docs/15）：每一天的尽头都有雪茄老板，一天比一天快。在一局里打败第 1 天的老板是一颗星（= 走通纽约），
   * 第 2 天的两颗，第 3 天的三颗。机器人量的：普通玩家头几局就拿第一颗，第二颗要练或者买升级，第三颗是高手的事。
   * 原来第一局就「走通纽约」，之后再也没有大目标；同类跑酷靠任务等级、收集和这种关卡星撑住长线 */
  const STAR_COINS = [300, 600, 1000];
  const rankMul = () => Math.min(1.25, 1 + .05 * meta.rank);      // 任务等级加成：每级 5%，最多 25%（docs/32）
  /* 「在攒什么」（2026-11-21，docs/32）：还没买的升级（下一级）和金币买的帽子里最便宜的那一样。主页开跑上面一条、结算页钱包下面一条，
   * 点了去升级页或帽子页。原来主页上看不出自己在攒什么、还差多少，金币多了少了都没感觉 */
  function goalOf(extra) {
    const c = [];
    for (const k in UPS) { const lv = meta.up[k] || 0, cost = UPS[k].cost[lv]; if (cost != null) c.push({ kind: 'up', k, cost, name: L('{x} Lv {n}', { x: L(UPS[k].name), n: lv + 1 }), img: artSrc(UPS[k].img || UPS[k].imgs[0]) }); }
    for (const h of HATS) if (h.cost && !ownHat(h.id)) c.push({ kind: 'hat', k: h.id, cost: h.cost, name: L(h.name), img: (H.HATS.hats[h.id] || {}).icon || artSrc('item-coin') });
    return c.sort((a, b) => a.cost - b.cost)[0] || null;
  }
  // 拿 have 枚金币，从最便宜的开始能连着买下几样（商店金币包上写「够买：…」）
  function buysWith(have) {
    const up = Object.assign({}, meta.up), hats = (meta.hats || []).slice(), got = [];
    for (; ;) {
      const c = [];
      for (const k in UPS) { const lv = up[k] || 0, cost = UPS[k].cost[lv]; if (cost != null) c.push({ cost, up: true, name: L('{x} Lv {n}', { x: L(UPS[k].name), n: lv + 1 }), go: () => { up[k] = lv + 1; } }); }
      for (const h of HATS) if (h.cost && !hats.includes(h.id)) c.push({ cost: h.cost, name: L(h.name), go: () => hats.push(h.id) });
      const n = c.sort((a, b) => a.cost - b.cost)[0];
      if (!n || n.cost > have) return got;
      have -= n.cost; n.go(); got.push(n);
    }
  }
  function showGoal(el, sm) {
    const G = goalOf(), hide = !G || (el.id === 'tGoal' && runs < 1);      // 第一次打开主页先不出，只留开跑
    el.hidden = hide; if (hide) return;
    const have = meta.coins, ok = have >= G.cost, near = !ok && have >= G.cost * .8;
    el.dataset.kind = G.kind; el.dataset.k = G.k;
    el.classList.toggle('ready', ok);
    el.innerHTML = `<img src="${G.img}" alt=""><span class="gt"><b>${L(sm ? '{x}' : 'Next: {x}', { x: G.name })}</b><i class="gbar"><i style="width:${Math.min(100, have / G.cost * 100).toFixed(1)}%"></i></i></span>`
      + `<em>${ok ? L('You can buy it!') : near ? L('{n} to go', { n: (G.cost - have).toLocaleString() }) : `${have.toLocaleString()} / ${G.cost.toLocaleString()}`}</em>`;
  }
  function openGoal(el) {
    Snd.init(); Snd.click();
    if (el.dataset.kind === 'hat') { hatSel = el.dataset.k; showHats(); } else showShop();
  }
  const starsOf = () => Math.max(meta.stars || 0, meta.cleared ? 1 : 0);      // 旧存档只记了打败过几次老板，算一颗
  // 从第几天出发（2026-11-21）：打过第 N 天的老板（第 N 颗星）就能从第 N+1 天跑起，最多第 3 天。想再试第三颗星不用先跑六七分钟
  const dayOpen = d => d === 1 || (d >= 2 && d <= 3 && starsOf() >= d - 1);
  const topDay = () => Math.min(3, starsOf() + 1);
  let wantDay = 1;      // 下一局从第几天出发：主页的开跑是第 1 天，旅行卡和结算页上的按钮改它，「再来一局」照这一局的天
  const starHTML = n => `<i class="st">${'★'.repeat(n)}</i><i class="st off">${'★'.repeat(3 - n)}</i>`;      // 拿到的金色，没拿到的灰
  /* ---------- 帽子：收集（docs/15、docs/16）----------
   * 同类跑酷的长线靠收集撑（地铁跑酷的角色和滑板、过马路的角色），我们原来什么都没有。帽子只是好看，不改玩法。
   * 十二顶：八顶是第四批就画好的（一直没用），四顶纽约的是第十四批。拿星、任务等级到 2（第一组任务）、5 和 10、连续 7 天跑每日挑战各送一顶，另外五顶用金币买。
   * 送的那顶如果头上还空着就直接戴上：打赢老板的那一刻帽子就扣到头上。戴着的那顶跑的时候、主页演示、被追上那一幕里都在（render.js 的 hatOn）。
   * 存档：meta.hats 有哪些，meta.hat 戴着哪顶（null 没戴），meta.hatNew 有新的还没去看
   */
  const HATS = [
    // 第一行、第二行：金币买的，从便宜到贵；第三行：靠本事拿的。taxi、liberty、fire、propeller 是第十四批（Codex 画的）
    // 毛线帽：做完第一组任务就送（任务等级 2）。打不到老板的玩家也能在头几局拿到第一顶帽子，看见这一页是干什么的
    { id: 'hat-baseball', name: 'Ball cap', get: { star: 1 } },
    { id: 'hat-beanie', name: 'Beanie', get: { rank: 2 } },
    // 价钱 2026-11-21 起翻了几倍（docs/32）：原来 1,000 到 4,000，一般玩家第 8 天就全买下了
    { id: 'hat-taxi', name: 'Taxi light', cost: 2500 },
    { id: 'hat-swim', name: 'Swim cap', cost: 5000 },
    { id: 'hat-liberty', name: 'Liberty crown', cost: 8000 },
    { id: 'hat-fire', name: 'Fire helmet', cost: 12000 },
    { id: 'hat-headphones', name: 'Headphones', cost: 16000 },
    { id: 'hat-chef', name: 'Chef hat', get: { rank: 5 } },
    { id: 'hat-snorkel', name: 'Snorkel', get: { checkin: 7 } },      // 七日签到第 7 天
    { id: 'hat-propeller', name: 'Propeller cap', get: { rank: 10 } },
    { id: 'hat-astronaut', name: 'Space helmet', get: { star: 2 } },
    { id: 'hat-crown', name: 'Crown', get: { star: 3 } }
  ].filter(h => H.HATS && H.HATS.hats[h.id]);
  const hatHow = h => h.cost ? L('{c} coins', { c: h.cost.toLocaleString() }) : h.get.star ? L('Beat the Day {d} boss · {s}', { d: h.get.star, s: '★'.repeat(h.get.star) }) : h.get.rank ? (h.get.rank === 2 ? L('Finish your first three missions') : L('Reach mission rank {n}', { n: h.get.rank })) : L('Day 7 of Daily Rewards (the gift box)');
  const hatTag = h => h.cost ? h.cost.toLocaleString() : h.get.star ? '★'.repeat(h.get.star) : h.get.rank ? L('Rank {n}', { n: h.get.rank }) : L('Day 7');
  const ownHat = id => (meta.hats || []).includes(id);
  // 帽子的小图：用 SVG 的 viewBox 只框住帽子实际占的那一块（帽子图四周空白不一样多，直接缩会有的偏下、压到字）
  function hatThumb(id) {
    const h = H.HATS.hats[id], iw = h.iw || 256, ih = h.ih || 256, b = h.bb || [0, 0, iw, ih], m = Math.max(b[2] - b[0], b[3] - b[1]) * .08, w = b[2] - b[0] + 2 * m, hh = b[3] - b[1] + 2 * m;
    return `<svg class="thumb" viewBox="${b[0] - m} ${b[1] - m} ${w} ${hh}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href="${h.file}" width="${iw}" height="${ih}"/></svg>`;
  }
  /* 看广告试戴（2026-11-21，docs/33）：金币买的帽子没钱买，可以看一段广告先戴 3 局（meta.rent = { id, left }）。戴够了自己摘下来，换回原来那顶。
   * 同类游戏靠「先试再买」把想要变成真买，也多一个人人都愿意看的广告位 */
  const RENT_RUNS = 3;
  const renting = () => meta.rent && meta.rent.left > 0 && !ownHat(meta.rent.id) ? meta.rent.id : null;
  const wornHat = () => renting() || meta.hat || null;
  function wearHat(id) { meta.hat = id || null; if (meta.rent && meta.rent.id !== id) meta.rent = null; R.hat = wornHat(); }
  const hatKind = h => h.cost ? 'coin' : h.get.star ? 'star' : h.get.rank ? 'rank' : 'checkin';
  const HAT_RAR = { coin: ['Shop', '#1c9bf0'], rank: ['Mission reward', '#2fa35a'], checkin: ['Daily gift', '#f97316'], star: ['Boss reward', '#c98a00'] };
  // 达到条件的送出去，返回这次新送的几顶
  function grantHats() {
    const streak = (meta.daily && meta.daily.streak) || 0, got = [];
    for (const h of HATS) {
      if (!h.get || ownHat(h.id)) continue;
      const ok = h.get.star ? starsOf() >= h.get.star : h.get.rank ? meta.rank + 1 >= h.get.rank : false;      // 签到的帽子在领第 7 天时给
      if (ok) { meta.hats = (meta.hats || []).concat(h.id); got.push(h); }
    }
    if (got.length) { meta.hatNew = true; if (!meta.hat) wearHat(got[0].id); saveMeta(); }
    return got;
  }
  let hatSel = null;
  let hatAnim = 0, hatT0 = 0;
  function hatStage(now) {
    const cv = $('hStage');
    if (!cv || $('hats').hidden) { hatAnim = 0; return; }
    hatAnim = requestAnimationFrame(hatStage);
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if (!hatT0) hatT0 = now;
    // 走一趟 + 转身前站一下：往右走、站 0.6 秒、转身往左走、站 0.6 秒
    const k = h / 118, m = 34 * k, span = Math.max(10, w - 2 * m), v = 44 * k, walk = span / v, stand = .6, T = 2 * (walk + stand);
    const t = ((now - hatT0) / 1000) % T, half = walk + stand, back = t >= half, u = back ? t - half : t;
    const moving = u < walk, p = moving ? u / walk : 1, x = back ? w - m - span * p : m + span * p;
    const frame = moving ? Math.floor((now - hatT0) / 1000 * 11) % 8 : 0, y = h - 10 * k;
    ctx.fillStyle = 'rgba(28,34,48,.16)'; ctx.beginPath(); ctx.ellipse(x, y, 22 * k, 5 * k, 0, 0, 6.2832); ctx.fill();
    R.miniLeo(ctx, frame, x, y, y - 7 * k, back, hatSel);      // 脚底到最高那顶帽子的顶，上面留 7
  }
  function showHats() {
    coinsUI();
    if (!hatSel) hatSel = wornHat() || (HATS.find(h => ownHat(h.id)) || HATS[0]).id;
    const rid = renting();
    $('hGrid').innerHTML = HATS.map(h => {
      const own = ownHat(h.id), on = wornHat() === h.id;
      return `<button class="hcell k-${hatKind(h)}${own ? ' own' : ' lock'}${on ? ' on' : ''}${hatSel === h.id ? ' sel' : ''}" type="button" data-hat="${h.id}" aria-label="${L(h.name)}">`
        + `${H.HATS.hats[h.id].icon ? `<img class="pt" src="${H.HATS.hats[h.id].icon}" alt="">` : hatThumb(h.id)}<i>${on ? L('✓ ON') : own ? '' : hatTag(h)}</i></button>`;      // 格子里只画帽子本身
    }).join('');
    $('hCount').textContent = `${HATS.filter(h => ownHat(h.id)).length}/${HATS.length}`;      // 收集了几顶
    const h = HATS.find(x => x.id === hatSel), own = ownHat(h.id), on = wornHat() === h.id, go = $('bHatGo'), rent = $('bHatRent'), rk = HAT_RAR[hatKind(h)];
    $('hName').textContent = L(h.name);
    $('hRar').textContent = L(rk[0]); $('hRar').style.setProperty('--rc', rk[1]);
    $('hTry').hidden = own || rid === h.id; $('hTry').textContent = L('TRY ON');      // 没拿到的先戴上看看：斜角一条红带
    $('hHow').textContent = rid === h.id ? L(meta.rent.left > 1 ? 'Trying it on · {n} runs left' : 'Trying it on · last run', { n: meta.rent.left }) : own ? L(on ? 'You’re wearing it.' : 'Yours. Tap Wear to put it on.') : hatHow(h);
    go.disabled = false; go.dataset.act = '';
    if (on && own) go.textContent = L('Take it off');
    else if (own) go.textContent = L('Wear it');
    else if (h.cost) {      // 没买的（包括正在试戴的）：买，或者还差多少、去商店
      // 钱不够：按钮写还差多少、点了去商店（原来是一个灰掉的按钮，到这里就停了）
      if (meta.coins >= h.cost) go.textContent = L('Buy\u00a0· {c}', { c: h.cost.toLocaleString() });
      else { go.textContent = L('{n} to go\u00a0· Get coins', { n: (h.cost - meta.coins).toLocaleString() }); go.dataset.act = 'store'; }
    }
    else { go.textContent = L('Locked'); go.disabled = true; }
    // 买的帽子还没拿到：下面一个绿按钮，看广告先戴 3 局
    rent.hidden = !(h.cost && !own && rid !== h.id && meta.coins < h.cost);
    rent.textContent = L('▶︎ Try it for {n} runs', { n: RENT_RUNS });
    // 舞台（第三轮，2026-11-21）：原来是一张 124×220 的静态全身像，用户说人物太大。现在是一条矮舞台，Leo 戴着这顶帽子来回走，走到头转身。
    // 用的是游戏里的走路图和帽子对位（render.js 的 R.miniLeo），和跑的时候一模一样。用户想要的「往前、往后走」要补正面、背面的走路图和每顶帽子的正背面，先不做
    if (!hatAnim) hatAnim = requestAnimationFrame(hatStage);
    if (meta.hatNew) { meta.hatNew = false; saveMeta(); showMeta(); }
    $('hats').hidden = false;
  }
  function hatGo() {
    const h = HATS.find(x => x.id === hatSel); if (!h) return;
    let bought = false;
    if ($('bHatGo').dataset.act === 'store') { Snd.click(); showStore(); return; }      // 钱不够：去商店
    if (wornHat() === h.id && ownHat(h.id)) { wearHat(null); Snd.click(); }
    else if (ownHat(h.id)) { wearHat(h.id); Snd.star(1); }
    else if (h.cost && meta.coins >= h.cost) { meta.coins -= h.cost; meta.hats = (meta.hats || []).concat(h.id); wearHat(h.id); bought = true; }
    else return;
    saveMeta(); showHats(); showMeta();
    // 买下来：开奖，Leo 戴着新帽子大大地弹出来（docs/33）
    if (bought) reward({ kick: L('New hat!'), cls: 'hat', pic: `<img src="${H.HATS.hats[h.id].full || ''}" alt="">`, title: L(h.name), sub: L('You’re wearing it. Looking sharp!'), say: '', next: false });
    // 买下来、戴上：上面的小人弹一下，格子里那顶跳一下（2026-11-16，原来只响一声）
    if (bought || meta.hat === h.id) { const card = $('hStage').parentElement, cell = $('hGrid').querySelector(`[data-hat="${h.id}"]`); for (const el of [card, cell]) if (el) { el.classList.remove('bought'); void el.offsetWidth; el.classList.add('bought'); } }
  }

  $('bHatRent').addEventListener('click', () => {
    const h = HATS.find(x => x.id === hatSel); if (!h || !h.cost || ownHat(h.id)) return;
    showAd('hat').then(ok => {
      if (!ok) return;
      meta.rent = { id: h.id, left: RENT_RUNS }; R.hat = wornHat(); saveMeta(); Snd.star(2); showHats();
      const card = $('hStage').parentElement; card.classList.remove('bought'); void card.offsetWidth; card.classList.add('bought');
    });
  });
  function showCities() {
    const n = meta.cleared || 0, s = starsOf();
    $('cNote').textContent = s >= 3 ? L('All three stars! The next cities are on their way.') : L('Every day ends at the Cigar Boss, and every day he’s faster. Beat him on Day {d} for {s}.', { d: s + 1, s: '★'.repeat(s + 1) });
    $('cList').innerHTML = CITIES.map(([name, img], i) => i === 0
      ? `<div class="cityrow"><span class="cthumb"><img src="${H.MANIFEST.images[img]}" alt="">${s ? `<img class="stamp" src="${H.MANIFEST.images['stamp-cleared']}" alt="">` : ''}</span><div><b>${L(name)}</b><span class="stars cs">${[0, 1, 2].map(i => `<i class="${i < s ? 'on' : ''}"></i>`).join('')}</span><span class="${s ? 'ok' : ''}">${s >= 3 ? L('All stars · Cigar Boss beaten {n}×', { n }) : L('Next {s}: beat the Day {d}\u00a0boss\u00a0·\u00a0+{c}', { s: '★'.repeat(s + 1), d: s + 1, c: STAR_COINS[s] })}</span><span>${L('Best run {n} m', { n: best.toLocaleString() })}</span></div></div>`
      : '').join('')
      // 没开的城市收成一行小的（docs/33）：原来三张和纽约一样大的灰卡，把纽约和下面「从第几天出发」挤得很小
      + `<div class="soon">${CITIES.slice(1).map(([name]) => `<span><i>?</i>${L(name)}</span>`).join('')}<em>${L('Coming soon')}</em></div>`;
    // 从哪天出发：第 1 天白天、第 2 天傍晚、第 3 天夜里。没解锁的灰着，写打过哪天的老板就开
    $('cDays').innerHTML = [1, 2, 3].map(d => { const ok = dayOpen(d);
      return `<button class="ghost dayb d${d}" type="button" data-day="${d}"${ok ? '' : ' disabled'}><b>${ok ? '' : ICON.lock}${L('Day {n}', { n: d })}</b><span>${ok ? L(['Daytime', 'Dusk', 'Night'][d - 1]) : L('Beat Day {d} boss', { d: d - 1 })}</span></button>`; }).join('');
    $('cDaysNote').hidden = !s;
    Snd.open();
    $('cities').hidden = false;
  }

  /* ---------- 尺寸 ---------- */
  let lowQ = false;
  function lowerNow() { if (lowQ && R.lowerQuality()) fit(); lowQ = false; }
  function fit() {
    ({ VH } = R.fit(app, stage, TOUCH));
    const land = TOUCH && innerWidth > innerHeight && innerHeight < 520;
    $('turn').hidden = !land;
    if (land && mode === 'play') setPause(true);
    if (g) g.viewH = VH;
  }

  /* ---------- 输入 ---------- */
  const K = new Set();
  let qShot = null, qLane = 0;
  const holds = new Set();
  const swipe = new Map();
  const NONE = { lane: 0, hold: false, shot: null };
  const HOLD_W = .42;      // 屏幕左边这么宽的一条是憋气
  function readInput() {
    const i = { lane: qLane, hold: K.has('Space') || holds.size > 0, shot: qShot };
    qShot = null; qLane = 0;
    return i;
  }
  addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    K.add(e.code);
    if (mode === 'play') {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') qLane = -1;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') qLane = 1;
      if (e.code === 'KeyJ' || e.code === 'KeyF') qShot = true;
      if (e.code === 'Escape' || e.code === 'KeyP') setPause(true);
    } else if (mode === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) setPause(false);
    else if (mode === 'gear') {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0 && offer[i]) buyGear(offer[i]); else if (e.code === 'Escape') $('bGearBack').click();
    }
    else if (e.code === 'Enter') {
      const btn = { title: 'bStart', over: 'bRetry', paused: 'bResume' }[mode];
      if (btn) $(btn).click();
    }
  });
  addEventListener('keyup', e => K.delete(e.code));
  addEventListener('blur', () => { K.clear(); holds.clear(); swipe.clear(); if (mode === 'play' && !TOUCH) setPause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setPause(true); });
  // 离开 App（回桌面、切到别的 App、下拉通知）：游戏暂停，声音引擎也停掉，系统才不会当它还在播放
  addEventListener('hyb-native-pause', () => { if (mode === 'play') setPause(true); Snd.sleep(); });
  addEventListener('pagehide', () => Snd.sleep());
  // 声音：任何一次触摸、回到前台，都顺手把被系统停掉的声音叫醒
  addEventListener('pointerdown', () => Snd.wake(), true);
  addEventListener('hyb-native-resume', () => Snd.wake());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Snd.sleep(); else Snd.wake(); });
  // 安卓的返回键 / 返回手势（android/…/MainActivity.kt 调它，docs/28）：关掉最上面那一层；跑的时候暂停；暂停页接着跑；结算页回主页。
  // 回 false = 没东西可关（在主页），App 退到后台。广告、复活、故事这几层不让返回键误关，回 true 吞掉
  const BACK = [['policy', 'bPolicyClose'], ['log', 'bLogClose'], ['how', 'bHowClose'], ['settings', 'bSetClose'], ['remind', 'bRemindNo'],
    ['checkin', 'bCiClose'], ['gear', 'bGearBack'], ['shop', 'bShopClose'], ['store', 'bStoreClose'], ['daily', 'bDailyClose'], ['tunes', 'bTunesClose'],
    ['cities', 'bCitiesClose'], ['hats', 'bHatsClose'], ['missions', 'bMissionsClose'], ['pause', 'bResume'], ['over', 'bHome']];
  window.hybBack = () => {
    if (['ad', 'revive', 'story'].some(id => !$(id).hidden)) return true;
    for (const [id, btn] of BACK) if (!$(id).hidden) { const b = $(btn); if (b && !b.hidden && !b.disabled) b.click(); return true; }
    if (mode === 'play') { setPause(true); return true; }
    return mode !== 'title';
  };

  function pt(e) { const r = cv.getBoundingClientRect(), s = r.width / H.W; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; }
  cv.addEventListener('pointerdown', e => {
    if (mode !== 'play') return;
    e.preventDefault(); Snd.init();
    const q = pt(e);
    if (e.pointerType === 'mouse') { if (e.button === 0) qShot = R.pick(g, q); return; }
    try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    if (q.x < H.W * HOLD_W) holds.add(e.pointerId);
    else { const t = performance.now(); swipe.set(e.pointerId, { x0: q.x, y0: q.y, t, moved: false, laned: false, h: [[t, q.x, q.y]] }); }
  });
  /* 滑动换道只认「快的、竖着的」一划：量最近 0.18 秒里手指竖着走了多远，超过 22 并且竖的比横的多才换道。
   * 原来是从按下的地方算起，竖着累计超过 24 就换道、不管多慢：拇指歇在右半边、压着压着滚了一点，或者点烟头时手指往上一带，
   * 人就自己换了道（2026-11-15，「明明我没有往上移，它自己又往上移」）。现在慢慢挪多远都不换，正常的一划照样一下就换。
   * h 里留着最近的几个点，h[0] 是 0.18 秒之前最后一个点（手指停过一会儿再划，从停的地方算） */
  const FLICK_T = 180, FLICK_D = 22;
  cv.addEventListener('pointermove', e => {
    const s = swipe.get(e.pointerId); if (!s) return;
    const q = pt(e), now = performance.now();
    if (Math.hypot(q.x - s.x0, q.y - s.y0) > 12) s.moved = true;
    s.h.push([now, q.x, q.y]);
    while (s.h.length > 2 && now - s.h[1][0] > FLICK_T) s.h.shift();
    // 一次滑动只换一条道，抬起手指再滑下一次
    if (s.laned) return;
    const dy = q.y - s.h[0][2], dx = q.x - s.h[0][1];
    // 另外：按下后 0.6 秒内，从按下的地方竖着累计划过 34 也算一划。慢一点但确实在划的手（0.4 秒划 40）只靠上面那条会不认，像划了没反应（2026-11-16 量的）。
    // 拇指歇着慢慢滚，通常是按住很久以后的事，0.6 秒内滚不到 34
    const ty = q.y - s.y0, tx = q.x - s.x0, early = now - s.t < 600 && Math.abs(ty) > 34 && Math.abs(ty) > Math.abs(tx) * 1.5;
    if (early || (Math.abs(dy) > FLICK_D && Math.abs(dy) > Math.abs(dx))) { const d = early ? ty : dy; qLane = d < 0 ? -1 : 1; s.laned = true; s.moved = true; }
  });
  function end(e) {
    holds.delete(e.pointerId);
    const s = swipe.get(e.pointerId);
    if (s) { swipe.delete(e.pointerId); if (!s.moved && performance.now() - s.t < 400 && e.type === 'pointerup' && mode === 'play') qShot = R.pick(g, { x: s.x0, y: s.y0 }); }
  }
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('lostpointercapture', end);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('touchstart', e => { if (mode === 'play' && e.target === cv) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !TOUCH) { TOUCH = true; fit(); } }, true);
  $('bPause').addEventListener('click', () => { if (mode === 'play') setPause(true); });
  $('bMute').addEventListener('click', () => { Snd.init(); Snd.toggle(); muteLabel(); });
  $('bMusic').addEventListener('click', () => { Snd.init(); Snd.setMusic(!Snd.musicOn); Snd.click(); muteLabel(); });
  $('bSfx').addEventListener('click', () => { Snd.init(); Snd.setSfx(!Snd.sfxOn); Snd.click(); muteLabel(); });
  $('sMusic').addEventListener('click', () => $('bMusic').click());      // 设置里的两个和暂停菜单里的是同一个开关
  $('sSfx').addEventListener('click', () => $('bSfx').click());
  function muteLabel() {
    $('bMute').classList.toggle('off', !Snd.on);
    // 设置和暂停菜单里都是一行一个开关（docs/33）：左边写是什么，右边的小开关表示开没开
    for (const id of ['sMusic', 'bMusic']) { $(id).innerHTML = `<span class="sl">${ICON.music}${L('Music')}</span>`; $(id).classList.toggle('on', Snd.musicOn); }
    for (const id of ['sSfx', 'bSfx']) { $(id).innerHTML = `<span class="sl">${ICON.sound}${L('Sound effects')}</span>`; $(id).classList.toggle('on', Snd.sfxOn); }
  }

  /* ---------- 提示 ---------- */
  // 前几局的教学：一次只出一条，挂着不走，直到玩家真的做了一次
  const did = { hold: false, release: false, lane: false, hit: false };
  const HINTS = [
    { when: g => smokeAhead(g, 250), until: () => did.hold, get s() { return L(TOUCH ? 'HOLD the left side to hold your breath' : 'Hold SPACE to hold your breath'); } },
    { when: g => g.p.holding && g.dens < CFG.DMIN && g.p.breath < 3.2 && !smokeAhead(g, 120), until: () => did.release, get s() { return L('Clean air! Let go to breathe'); } },
    { when: g => blockedAhead(g), until: () => did.lane, get s() { return L(TOUCH ? 'Swipe up or down to change lanes' : 'Press ↑ or ↓ to change lanes'); } },
    { when: g => g.target && g.water >= 1 && g.target.x - g.p.x > 120, until: () => did.hit, get s() { return L(TOUCH ? 'TAP a glowing cigarette to put it out' : 'Click a glowing cigarette to put it out'); } }
  ];
  const seen = {};
  const PERFECT_TEACH = 5;      // 做到几次 PERFECT 以后不再亮「现在松手」的金圈
  // 新面孔第一次出现时头顶的短标签（第三次试玩：通勤族、狗绳、烟圈第一次见要有个记号）。打开游戏后每种只出一次
  const FACE_TAGS = [
    ['commuter', s => s.look === 'commuter', 'FAST! ←'], ['dog', s => s.dogLane != null, 'LEASH!'], ['ringer', s => s.ring, 'RINGS'],
    ['phone', s => s.look === 'phone' && s.pace, 'PACING ↕︎'], ['vape', s => s.kind === 'vape', 'BIG CLOUDS'], ['granny', s => s.big, 'BIG PUFFS'], ['chef', s => s.chef, 'STEAM IS OK']
  ], faceSeen = {};
  function showHint(s, life, until) { if (!showHints) return; hint = { s, t: life || 3.4, life: life || 3.4, until }; }
  // 教学提示挂着的时候，别的提示先排队，不要盖掉它
  // 教学的那一步最多等 8 秒（2026-11-16）：原来一直等到玩家做了才走，不用换道的人头上「Swipe…」挂了 15 秒以上，后面的教学和提示全被压着出不来。
  // 等过 8 秒就收起来，这一步先跳过（撞上东西时还有「Blocked! Swipe toward the yellow arrow」）
  const TUTOR_WAIT = 8;
  const tutorialUp = () => hint && hint.until && !hint.until() && hint.t > 0;
  /* 每条提示一共最多出两次（存在 meta.hints 里，2026-11-16）。原来只记在这次打开里：带 always 的提示（挤过去、白线、浓烟、狗绳……）
   * 不管跑了多少局，每次打开 App 都再说一遍，老玩家天天看同样的话 */
  const HINT_MAX = 2;
  /* 不急的提示（新面孔、道具、摊位这类介绍）离上一条至少隔 HINT_GAP 秒；没轮到就先不说、也不记成说过，下次碰到再说（2026-11-16）。
   * 清空存档跑第一局（像真人的机器人）：150 秒里出了 25 条，前 70 秒 20 条，提示框几乎一直挂着，常常两条同一秒冒出来。
   * 要紧的（怎么憋气、为什么呛、气用光、浓烟、白线、大烟雾逼近、没水了）照常马上说 */
  const HINT_GAP = 7, HINT_NOW = new Set(['haze', 'need', 'gasp', 'cough', 'coughLetGo', 'bumpCough', 'bump', 'smog', 'scoot', 'dry', 'air', 'parade']);      // parade：有人刚戒烟跟上来，当场说他有什么用
  let hintAt = -99, smogCard = false;      // smogCard：第一局大烟雾醒了、等它进画面再出卡片
  const toastQ = [];      // 等着出的提示：「★ Mission done」和被前一条要紧提示挡住的那条
  function hintOnce(key, s, life, always) {
    if (seen[key] || tutorialUp()) return;
    s = L(s);      // 调用的地方都传英文原句
    if (!HINT_NOW.has(key) && g && (g.t - hintAt < HINT_GAP || (hint && hint.t > .3))) return;      // 屏幕上正挂着一条（教学、任务完成也算）也先不说
    seen[key] = 1;
    const HS = meta.hints || (meta.hints = {});
    if ((HS[key] || 0) >= HINT_MAX) return;
    // 要紧的一条刚出来不到 1.6 秒，另一条要紧的排在它后面（2026-11-16）：第一局进烟呛到，「进烟前先憋气」出来 0.1 秒就被「大烟雾追上来了」顶掉
    if (always && hint && !hint.until && hint.t > 0 && hint.life - hint.t < 1.6) toastQ.push({ s, life: life || 3 });
    else if (always) hint = { s, t: life || 3, life: life || 3 };
    else { if (!showHints) return; showHint(s, life); }
    HS[key] = (HS[key] || 0) + 1; saveMeta(); hintAt = g ? g.t : 0;
  }
  function smokeAhead(g, range) {
    const p = g.p;
    return g.smokers.some(s => s.lit && s.awake && s.state === 'smoke' && s.x > p.x && s.x - p.x < range) || H.density(g, p.x + 90, p.z, H.HEAD) > .1;
  }
  const blockedAhead = g => H.blockers(g, g.p.lane).some(b => b.x0 > g.p.x && b.x0 - g.p.x < 150 && !(b.o && b.o.lit === false) && H.stopsYou(g, b));

  /* ---------- 一局 ---------- */
  const SAYS = ['Oh! Sorry!', 'My bad.', 'Fair enough.', 'Oops.', 'Okay, okay.'];
  let saidAt = -9;      // 上一个烟民开口的时刻（g.t）
  /* 叠着的窗口（2026-11-21 用户：帽子页点「去拿金币」，商店盖上来，两个窗口右上角的叉号叠在一起）：
   * 同时开着几个居中的窗口时，只显示最上面那个，下面的整个藏起来（不是关掉）；上面那个关了，下面的再露出来。
   * 帽子 → 商店、暂停 → 怎么玩、设置 → 怎么玩、商店 → 开奖都是这样 */
  const winStack = [];
  function restack() {
    for (let i = winStack.length - 1; i >= 0; i--) if (winStack[i].hidden) winStack.splice(i, 1);
    for (const s of document.querySelectorAll('section.veil.center')) if (!s.hidden && !winStack.includes(s)) winStack.push(s);
    winStack.forEach((s, i) => s.classList.toggle('under', i < winStack.length - 1));
  }
  { const wso = new MutationObserver(restack); for (const s of document.querySelectorAll('section.veil.center')) wso.observe(s, { attributes: true, attributeFilter: ['hidden'] }); }
  function hideAll() { for (const id of ['title', 'pause', 'over', 'loading', 'how', 'shop', 'gear', 'missions', 'story', 'store', 'revive', 'daily', 'cities', 'tunes', 'hats', 'remind', 'log', 'checkin', 'settings']) $(id).hidden = true; $('pad').hidden = true; }
  /* 主页背后不是一张图，是一局自己在跑的游戏：高手水平的自动驾驶在憋气、换道、滋水，大烟雾贴在身后追。
   * 看几秒就知道这游戏是干什么的。它永远追不上（每帧把它按在身后一段固定的距离里），卡住或者跑太久就换一局。 */
  const LIFT = 104;      // 主页上整幅画面往上抬多少，把下面让给按钮
  let demoX = 0, demoT = 0;
  function demoGame() {
    const d = H.newRun((Math.random() * 1e9) | 0, VH, { intro: false });
    d.demo = true; d.smog.awake = true; demoX = 0; demoT = 0;
    for (let i = 0; i < 50; i++) stepDemo(d, 1 / 30);
    d.ev.length = 0;
    return d;
  }
  function stepDemo(d, dt) {
    H.step(d, dt, window.HYB_BOT ? window.HYB_BOT(H, d, 0) : NONE);
    const S = d.smog, p = d.p;
    S.x = H.clamp(S.x, p.x - 112, p.x - 70); S.gap = p.x - S.x;
  }
  /* 主页背后的演示只放碎屑和金光，不冒字（2026-11-16）：「PHEW!」「BULLSEYE!」这些字飘在人头上，正好半截压在标题和「NEW YORK」按钮后面。
   * 主页要看的是标题和开跑按钮，演示是背景 */
  function demoEvents() {
    for (const e of g.ev) {
      if (e.k === 'hit') R.burst(e.x, Y(e), e.bull ? 22 : 14, 190);
      else if (e.k === 'bank') { R.relief(); if (e.n >= 3) R.smogBlown(); }
      else if (e.k === 'cough') R.cough();
      else if (e.k === 'steam') R.burst(e.x, Y(e), 12, 130, '#ffffff');
      else if (e.k === 'coin') R.burst(e.x, R.yOf(e.z, 18), 4, 70, '#f6c624');
      else if (e.k === 'power') R.burst(e.x, R.yOf(e.z, 30), 14, 160, '#f6c624');
    }
    g.ev.length = 0;
  }
  // 点「开跑」：每日挑战直接开（装备是当天定好的）；平常的局跑过两局以后先选装备
  let runDaily = null, startCard = null, dailyHit = 0;      // dailyHit：这一局跑过了第几个每日目标
  function begin(isDaily, afterAd) {
    if (adsWait) return;
    if (!playTapAt) playTapAt = performance.now();      // 试玩记录：这次打开 App 第一次点 PLAY 的时刻
    Snd.init(); Snd.click();
    // 第一次点 PLAY 直接开跑（2026-11-21，docs/15）：开场故事和广告的两个弹窗都挪到第一局结束以后（afterFirst）。
    // 原来是 PLAY → 苹果的「允许追踪」→ 三句故事（打字时点一下只是把字补全，性急的人一句点两下）→ 5.5 秒引子，点 5 到 8 下才摸得到人；
    // 用户的弟弟试玩说「要点好几下 PLAY 才能玩」，地铁跑酷点一下就跑。问过弹窗的人照旧在后台问（不会再弹出来），不等它
    if (adsDone()) askAds();
    else if (runs > 0) { adsWait = true; askAds().then(() => { adsWait = false; meta.ads = true; saveMeta(); begin(isDaily, afterAd); }); return; }      // 跑过却还没问过（不该有）：先问完再开，免得弹窗盖在跑的半路
    else if (meta.ads == null) { meta.ads = false; saveMeta(); }      // 新玩家：记下「还没问」，第一局跑完再问
    // 两局之间的插屏广告
    if (!afterAd && !meta.noAds && runs >= 4 && sinceAd >= 3 && Date.now() - lastAdAt >= AD_GAP) { showAd('inter').then(() => begin(isDaily, true)); return; }
    const fromTitle = mode === 'title';
    if (isDaily) { const D = daily(); return start({ daily: D, gear: D.gear, seed: D.seed, fromTitle }); }
    if (runs < GEAR_AT) return start({ fromTitle });
    // 装备页不每局都挡在「再来一局」和开跑之间（同类跑酷点一下就开跑）：点过「不带装备」就歇两局，第三局再问；买了就照常每局问
    if ((meta.gearRest || 0) > 0) { meta.gearRest--; saveMeta(); return start({ fromTitle }); }
    gearFrom = mode === 'gear' ? gearFrom : mode; mode = 'gear'; rollGear(); showGear();
  }
  function start(o) {
    hideAll(); lowerNow(); runM = null; runMT = 0; mT = 0; saidAt = -9;
    runDaily = o.daily || null; dailyHit = 0;
    track('run_start', { run: runs + 1, daily: !!o.daily, gear: o.gear || '', start_day: o.daily || !dayOpen(wantDay) ? 1 : wantDay });
    // 开头的引子：从主页进来、头三局放完整的；结算卡上再来一局放快版，不耽误重开
    // mix：头 3 局第一天照原样教，之后打乱；每日挑战大家同一条街，一律打乱（core.js districtSeq）
    const sd = o.daily || !dayOpen(wantDay) ? 1 : wantDay;
    g = H.newRun(o.seed != null ? o.seed : (Math.random() * 1e9) | 0, VH, { tutorial: runs < 1, up: meta.up, gear: o.gear, intro: o.intro === false ? false : runs < 3 ? 'full' : 'short', district: o.district, startDay: sd, mix: o.mix != null ? !!o.mix : runs >= 3 || !!o.daily });      // o.mix：商店截图脚本给 false，照原来的街拍      // 完整开场（5.5 秒）只放头三局；原来从主页点进来每次都放完整的，试玩记录里每局「PLAY→control 5.5 s」
    for (const m of meta.missions) delete m.fresh;
    R.clearFx(); hint = null; showHints = runs < 3;
    // 路上的最好成绩旗子：跑过 100 米以上才插（每日挑战插当天的最好，没跑过就不插）
    const bm = o.daily ? (dailyState(daily()).best || 0) : best;
    R.best = bm >= 100 ? { x: bm * CFG.M, m: bm, passed: false, daily: !!o.daily } : null;
    // 装备的横幅等引子放完再出，免得和引子里的字挤在一起
    // 从后面的天出发：开跑那张卡写第几天、什么时辰，和这一天的老板给不给新星（2026-11-21）。带了装备，第二行写装备
    const sdd = g.startDay || 1, sdPh = H.phaseOf(sdd - 1), sdStar = sdd <= 3 && sdd > starsOf() ? '★'.repeat(sdd) : '';
    startCard = sdd > 1 ? [`${L('Day {n}', { n: sdd })} · ${L(sdPh[0].toUpperCase() + sdPh.slice(1))}`.toUpperCase(),
      g.gear ? `${L(GEAR[g.gear].name)}${H.lang === 'zh' ? '：' : ': '}${L(GEAR[g.gear].tag)}` : sdStar ? L('Beat today’s Cigar Boss for {s}', { s: sdStar }) : dayLine(sdd - 1)]
      : g.gear ? [runDaily ? L('DAILY RUN · {d}', { d: runDaily.label.toUpperCase() }) : L(GEAR[g.gear].name).toUpperCase(), runDaily ? `${L(GEAR[g.gear].name)}${H.lang === 'zh' ? '：' : ': '}${L(GEAR[g.gear].tag)}` : L(GEAR[g.gear].text)] : null;
    for (const h of HINTS) h.done = false;
    for (const k in seen) delete seen[k];
    hintAt = -99; toastQ.length = 0; smogCard = false;
    for (const k in did) did[k] = false;
    holds.clear(); swipe.clear(); K.clear(); beatT = 0;
    for (const k in runStat) runStat[k] = 0; reviveHow = ''; wallAt = gaspAt = relSmokeAt = -99; nearAt = closeAt = -99;      // 试玩记录：这一局的数从零记
    R.hat = wornHat();
    mode = 'play'; Snd.go(); Snd.track('run'); Snd.music(true); Snd.fast(false); Snd.muffle(false); $('pad').hidden = false;
  }
  function setPause(v) {
    // 暂停时看一眼三个任务做到哪了（算上这一局到现在的数，2026-11-16）。原来暂停页只有按钮，想知道还差多少得退出这一局
    if (v) { mode = 'paused'; lowerNow(); missionList($('pMissions'), meta.missions, H.score(g)); $('pause').hidden = false; Snd.open(); Snd.music(false); Snd.muffle(false); K.clear(); holds.clear(); swipe.clear(); readInput(); }
    else { mode = 'play'; $('pause').hidden = true; Snd.init(); Snd.click(); Snd.music(true); }
  }
  /* 被追上：镜头推近，人一屁股坐到地上冒星星，大烟雾贴在他背后坏笑，说一句风凉话（见 render.js 的 R.caught）。
   * 结算画面压在下半截，上半截一直演着这一幕。2026-11-15 用户：原来只看到一团乌云盖住，下面一大堆数据，完全不想再来一次 */
  function finish() {
    buzz('warning');      // 被追上
    mode = 'ending'; endT = 1.6; $('pad').hidden = true; holds.clear(); swipe.clear();
    Snd.music(false); Snd.muffle(false); Snd.caught(); Snd.sting('caught');
    const p = g.p;
    R.caught(L(tauntOf(H.score(g)))); R.clearTexts(); hint = null;      // 路上还飘着的字（Watch it! 之类）别压在这一幕上
    for (const s of g.smokers) s.say = '';      // 撞到的烟民头上那句「Watch it!」也收掉，这一幕只留大烟雾那一句
    R.shake(10); R.say(L('GOTCHA!'), p.x + 4, R.yOf(p.z, 64), 26, '#fff', .8, 'big');
    R.burst(p.x, R.yOf(p.z, 4), 14, 110, '#d9dde3');
  }
  // 大烟雾的风凉话：说的就是这次栽在哪儿。比一行「你吸了太多烟」好记，也更想扳回来
  function tauntOf(r) {
    if (g.locked || g.boss) return 'The boss says hi! Heh heh!';
    switch (r.hurt) {
      case 'gasp': return 'Out of breath already? Heh!';
      case 'cough': return { stand: 'My doorway pals say hi! Heh!', walk: 'Walked right into that one!', ahead: 'Stuck behind a smoker? Heh!', vape: 'Mmm, vanilla cloud! Heh heh!', terrace: 'Nice patio, huh? Heh heh!', scooter: 'Vroom vroom! Heh heh!' }[r.blame] || 'Smoky, isn’t it? Heh heh!';
      case 'bump': return 'Watch where you’re going!';
      case 'scooter': return 'Beep beep! Heh heh heh!';
      default: return 'Too slow, kid! Heh heh!';
    }
  }
  // 头几局在按钮上面加一行怎么躲，一行说完
  /* 换街区横幅的第二行：第 2、3 天写「更快、烟更多」；第 4 天起难度不再涨，写这一天是什么时辰（core.js 的 phaseOf），雨天说一句烟散得快（2026-11-16） */
  // 第 4 天起每天一种天，各有一点不一样（core.js 的 DAWN_REGEN、RAIN_LIFE、DUSK_COINS、NIGHT_SMOG），横幅上说清楚
  const PHASE_LINE = { dawn: 'dawn: fresh air, breath comes back faster', rain: 'rain: smoke fades faster', dusk: 'dusk: every coin counts double', night: 'night: the smog moves faster' };
  // 第 2、3 天的傍晚、夜里也照规则来，横幅写规则，再说一句更难了（2026-11-16）
  // 第 3 天的夜里大烟雾不再快（2026-11-21，core.js stepSmog），横幅不写那条规则
  const dayLine = d => !d ? L('New neighborhood') : [L('Day {n}', { n: d + 1 }), d < 3 ? L('smokier') : '', d < 3 && H.phaseOf(d) === 'night' ? '' : L(PHASE_LINE[H.phaseOf(d)] || '')].filter(Boolean).join(' · ');
  const TIPS = {
    gasp: 'Tip: let go in clean air before the ring runs out.', cough: 'Tip: start holding a step before the smoke.', letgo: 'Tip: keep holding until you’re out of the smoke.',
    slowPerfect: 'Tip: let go right as you clear the smoke. A PERFECT blows the smog much further back.',
    slowChain: 'Tip: pass more smokers on one breath. Big PHEWs blow the smog way back.',
    slowBreath: 'Tip: dive into the smoke. Every second you hold in there blows the smog farther back.',      // 憋气版：没有冲刺，只能靠在烟里憋
    slowDash: 'Tip: hold your breath and dive INTO the smoke. Inside it you go TURBO and leave the smog behind.',      // 烟里冲刺
    trip: 'Tip: people step aside, things don’t. Watch for benches, bins and fences in your lane.',
    bump: 'Tip: dodge whatever is in your lane. Every bump lets the smog jump closer.', wall: 'Tip: every lane blocked? Tap a smoker to put him out.', scooter: 'Tip: a lane flashes red? Get out of it.', '': 'Tip: hold to sprint. It’s the only way to pull away.'
  };
  // 被追上以后问一句要不要接着跑：看一段广告（一局一次），或者花金币（150、400、1000，一局里越来越贵）。
  // 前两局不问，跑得太短也不问；广告用过了、金币又不够下一次的价钱，也不问
  const REVIVE_COST = [300, 800, 2000];      // 2026-11-21 起翻倍（docs/32），原来 150 / 400 / 1000
  let reviveT = 0, reviveHow = '';      // reviveHow：这一局怎么复活的（试玩记录用）
  function askRevive() {
    const r = H.score(g), cost = REVIVE_COST[g.paidRevives || 0], canAd = !g.adRevived && !g.noVideo, canPay = cost != null && meta.coins >= cost;
    if (runs < 2 || r.dist < 150 || (!canAd && !canPay)) return runs < 1 ? afterFirst(showOver) : showOver();      // 第一局：先讲故事、问广告弹窗（afterFirst）
    mode = 'revive'; reviveT = 7;
    // 说清楚接着跑能拿到什么（2026-11-16）：离最好成绩还差几米，或者已经破了纪录；不然写离下一站还有几米。原来只写跑了多少米
    const rt = routeOf(), gap = best - r.dist;
    const goal = r.dist > best && best > 0 ? L('New best! {m} m and counting.', { m: r.dist.toLocaleString() })
      : gap > 0 && gap <= 300 ? L('Only {g} m to your best ({b} m)!', { g: gap.toLocaleString(), b: best.toLocaleString() })
      : rt.atBoss ? L('The Cigar Boss is right there!')
      : L('{m} m to {place}.', { m: rt.left.toLocaleString(), place: L(rt.idx < 4 ? H.STOPS[rt.idx + 1].name : 'the Cigar Boss') });
    $('rvText').innerHTML = `<b>${goal}</b><br>${L('Blow the smog back and keep running?')}`;
    $('bRevive').hidden = !canAd; $('bRevive').textContent = L('▶︎ Watch ad · keep running');
    $('bRevivePay').hidden = cost == null; $('bRevivePay').disabled = !canPay;
    $('bRevivePay').textContent = cost == null ? '' : canPay ? L('Pay {c} coins', { c: cost.toLocaleString() }) : L('{c} coins\u00a0· you have {h}', { c: cost.toLocaleString(), h: meta.coins.toLocaleString() });
    Snd.open(); $('revive').hidden = false;
  }
  function comeBack() {
    H.revive(g); hideAll();
    R.clearFx(); holds.clear(); swipe.clear(); K.clear(); readInput();
    mode = 'play'; $('pad').hidden = false; Snd.init(); Snd.music(true); Snd.win();
    R.flash(); R.smogBlown(); R.say(L('BACK IN THE RUN!'), g.p.x + 40, R.yOf(g.p.z, 110), 26, '#8fe0a8', 1.5, 'big');
  }
  function doRevive() {
    if (mode !== 'revive') return;
    $('revive').hidden = true; mode = 'adwait';
    showAd('revive').then(ok => {
      if (ok) { g.adRevived = true; reviveHow += 'ad '; return comeBack(); }
      // 这会儿没有视频：看广告这条路关掉，金币够的话回到问一句那里，还能花金币接着跑
      if (noVideo) { g.noVideo = true; return askRevive(); }
      showOver();
    });
  }
  function payRevive() {
    const cost = REVIVE_COST[g.paidRevives || 0];
    if (mode !== 'revive' || cost == null || meta.coins < cost) return;
    meta.coins -= cost; saveMeta(); Snd.buy(); g.paidRevives = (g.paidRevives || 0) + 1; reviveHow += 'coins '; comeBack();
  }
  /* 结算画面：上半截是被追上的那一幕，下半截只有一个大数字、一句离目标多远、一条路、一个大按钮。
   * 路：纽约五个街区加最后的雪茄老板，小人头停在被追上的地方，旗子插在最好成绩那里，下面写离下一站还有几米 */
  const ROUTE_ICON = {
    sidewalk: '<path d="M4.5 10.500h15V20h-15z" fill="#f3e2c0"/><path d="M10 20v-5.500h4V20" fill="#6fd3ff"/><path d="M3 5.500h18l-1 4.500c-.800 1.200-2.400 1.200-3.200 0-.800 1.200-2.400 1.200-3.200 0-.800 1.200-2.400 1.200-3.200 0-.800 1.200-2.400 1.200-3.200 0-.800 1.200-2.400 1.200-3.200 0z" fill="#f0433a"/>',
    office: '<path d="M6.500 3h11v18h-11z" fill="#a8bdd3"/><path d="M9.500 7h1.500M13 7h1.500M9.500 11h1.500M13 11h1.500M9.500 15h1.500M13 15h1.500" stroke-width="2.400"/>',
    park: '<path d="M12 14.500V21" stroke-width="2.800"/><circle cx="12" cy="9.500" r="6.500" fill="#2fbf71"/>',
    rooftop: '<path d="M12 11v9.500M8 20.500h8" fill="none"/><path d="M2.500 11.500a9.500 7.500 0 0 1 19 0z" fill="#ffb703"/><path d="M12 4v7.500" fill="none"/>',
    subway: '<rect x="5" y="3" width="14" height="15" rx="4" fill="#1c9bf0"/><path d="M8 6.500h8v4.500H8z" fill="#fff"/><path d="M8.500 18 6.500 21M15.500 18l2 3" fill="none"/><circle cx="9" cy="14.500" r="1" fill="#1c2230"/><circle cx="15" cy="14.500" r="1" fill="#1c2230"/>'
  };
  function routeOf() {
    const p = g.p, D = g.districts[g.di], N = g.districts[g.di + 1], G = g.gen, B = g.boss || g.bossQ[0];
    const start = D.x < -1e8 ? 0 : D.x;
    let end = D.idx === 4 ? (B ? B.lockX : null) : N ? N.x : null;
    // 下一站还没生成出来：把这个街区剩下的遭遇长度加起来
    if (end == null) end = G.base + G.queue.reduce((a, q) => a + ((H.ENC[q] && H.ENC[q].len) || 0), 0) + (D.idx === 4 ? 260 : 0);
    const atBoss = D.idx === 4 && (g.locked || !!g.boss);
    const pos = D.idx + (atBoss ? 1 : H.clamp((p.x - start) / Math.max(1, end - start), .04, .94));
    return { day: D.day, idx: D.idx, pos, atBoss, left: Math.max(1, Math.ceil((end - p.x) / CFG.M)) };
  }
  function routeHTML(rt, bestAt) {
    const at = v => `${(v / 5 * 100).toFixed(1)}%`;
    let h = `<div class="rtrack"><i class="rfill" style="--w:${at(rt.pos)}"></i></div>`;
    H.STOPS.forEach((s, i) => { h += `<span class="rnode${i < rt.idx ? ' done' : i === rt.idx ? ' here' : ''}" style="left:${at(i)}"><svg viewBox="0 0 24 24" fill="none" stroke="#1c2230" stroke-width="1.800" stroke-linejoin="round" stroke-linecap="round">${ROUTE_ICON[s.id] || ''}</svg></span>`; });
    h += `<span class="rnode boss${rt.atBoss ? ' here' : ''}" style="left:100%"><i></i></span>`;
    // 最好成绩的旗子：同一天、还在前面才插
    if (bestAt != null && Math.floor(bestAt / 5) === rt.day && bestAt % 5 > rt.pos + .05) h += `<span class="rbest" style="left:${at(bestAt % 5)}"></span>`;
    h += `<span class="rme" style="left:${at(rt.pos)}"><img src="${H.MANIFEST.images['hud-leo-scared']}" alt=""></span>`;
    return h;
  }
  // 看一段广告至少给 50（2026-11-16）：原来至少 10，商店里看一段给 100，同样看广告这里只给 10 显得很亏。
  // 故意一开跑就死、只看广告：一局十来秒加一段广告约 40 秒拿 50，每分钟约 75，比好好跑（普通玩家约 110）还少，不值得刷
  const DOUBLE_MIN = 50;
  // 结算页的倍数条：[倍数, 宽度%]。针匀速来回走，所以停在哪一格的机会和格子宽度成正比：期望 = 2×.48 + 3×.4 + 5×.12 ≈ 2.76 倍
  const LUCKY = [[2, 24], [3, 20], [5, 12], [3, 20], [2, 24]], LUCK_SWEEP = .85;      // 从一头走到另一头几秒
  let luck = null;
  const luckyAt = p => { let a = 0; for (const [v, w] of LUCKY) { a += w; if (p * 100 < a) return v; } return LUCKY[LUCKY.length - 1][0]; };
  // 按钮上写领几倍、多拿多少（这一局的金币乘几，多出来的那部分）
  // 第三轮（2026-11-21）：用户问「领多少，这个是金币吗」。写成「看广告 ×3 +100」，后面带金币图标。+N 是看完多拿的金币
  function luckyLabel(v) { if (!luck || luck.v === v) return; luck.v = v; $('bDouble').innerHTML = `${ICON.play}${L('Ad ×{n}', { n: v })} <b class="n">+${(lastEarned * (v - 1)).toLocaleString()}</b>${coinIco()}`; }
  function stepLucky(dt) {
    if (!luck || luck.stop || $('over').hidden) return;
    luck.t += dt;
    const u = (luck.t / LUCK_SWEEP) % 2, p = u < 1 ? u : 2 - u;      // 三角波：来回匀速
    const n = $('oNeedle'); if (n) n.style.left = (p * 100).toFixed(2) + '%';
    luckyLabel(luckyAt(p));
  }
  let lastEarned = 0, ov = null, earnSum = 0, earnParts = [];
  function showOver() {
    const r = H.score(g), rt = routeOf();
    runs++; store.set('hyb3-runs', String(runs));
    const isBest = r.dist > best, was = best;
    if (isBest) { best = r.dist; store.set('hyb3-best', String(best)); store.set('hyb3-bestAt', (rt.day * 5 + rt.pos).toFixed(3)); }
    hideAll(); sinceAd++;
    const mul0 = rankMul(), S = settle(r); lastEarned = Math.max(DOUBLE_MIN, S.earned);      // mul0：这一局按升级前的任务等级算的加成      // 看广告多给的金币：翻一倍，至少 DOUBLE_MIN 枚
    logRun(r, { revive: reviveHow.trim() });
    // 一个大数字。下面一句：破纪录 / 差几米就破纪录 / 最好成绩
    let line = L('Best {m} m', { m: best.toLocaleString() }), cls = '';
    const short = was - r.dist;
    if (runs === 1) line = L('Can you beat it?');
    else if (isBest) { line = L('NEW BEST!'); cls = 'best'; }
    else if (short <= Math.max(25, was * .2)) { line = short ? L('Only {m} m short of your best!', { m: short.toLocaleString() }) : L('Tied your best!'); cls = 'near'; }
    // 小旗子：新星、升级、做完任务、每日挑战的奖励，一条一条从左上角弹出来。最多三条，按分量排（原来任务排前面，三个任务就把「走通纽约」挤掉了）
    const flags = [], md = S.shown.filter(m => m.fresh).length;
    if (g.newStar) flags.push(g.newStar === 1 ? L('★ New York cleared!') : L('{s} Day {d} boss beaten!', { s: '★'.repeat(g.newStar), d: g.newStar }));
    else if (r.bosses) flags.push(r.bosses > 1 ? L('Cigar Boss beaten ×{n}', { n: r.bosses }) : L('Cigar Boss beaten!'));
    const dailyR = runDaily ? settleDaily(r) : null, hats = (g.newHats || []).concat(S.hats || [], (dailyR && dailyR.hats) || []);
    if (hats.length) flags.push(hats.length > 1 ? L('{n} new hats!', { n: hats.length }) : L('New hat: {h}!', { h: L(hats[0].name) }));      // 新帽子排在星后面
    if (S.bonus) flags.push(L('RANK UP! +{c}', { c: S.bonus }));      // 升级就是三个任务都做完了，不再另说
    else if (md) flags.push(md > 1 ? L('★ {n} missions done!', { n: md }) : L('★ Mission done!'));
    if (r.parade >= 2) flags.push(L('Parade of {n}', { n: r.parade }));      // 一局里最多几个人跟着跑
    if (r.perfects) flags.push(r.perfects > 1 ? L('PERFECT ×{n}', { n: r.perfects }) : L('PERFECT!'));
    // 试戴的帽子：这一局算一局，戴够了说一声（这一幕里还戴着，下一局开跑或回主页时摘）
    if (renting()) { meta.rent.left--; if (meta.rent.left <= 0) flags.push(L('Hat trial over: {h}', { h: L((HATS.find(x => x.id === meta.rent.id) || {}).name || '') })); saveMeta(); }      // 一次就写 PERFECT!，不写「×1」（2026-11-16）      // 这一局出烟那一下松手了几次：分量最轻，前面满三条就不出
    if (runDaily) {
      const d = dailyR;
      if (d.coins) flags.unshift(L('Daily +{c}', { c: d.coins }));      // 每日挑战最要紧的是这一笔，排第一条（原来排最后，前面满三条就被挤掉）
      scheduleRemind();      // 跑完每日挑战：排明天傍晚的提醒（同意过的话）
      askRemind = !!window.hybRemind && !meta.remindAsked;      // 第一次跑完每日挑战：结算落定以后问一句要不要提醒
      line = isBest ? line : L('Today’s best {m} m', { m: d.s.best.toLocaleString() }); cls = isBest ? cls : '';
    }
    $('oFlags').innerHTML = flags.slice(0, 3).map((s, i) => `<span style="--d:${(1.1 + i * .25).toFixed(2)}s">${s}</span>`).join('');
    $('oDist').textContent = '0';
    $('oLine').textContent = line; $('oLine').className = 'oline ' + cls;
    $('oRoute').innerHTML = routeHTML(rt, store.get('hyb3-bestAt') != null && !isBest ? +store.get('hyb3-bestAt') : null);
    // 这一天的老板还能给新星，就把星挂在「离老板还有几米」后面
    const pend = rt.day < 3 && rt.day + 1 > starsOf() ? '★'.repeat(rt.day + 1) : '';
    // 第 2 天起写上是哪种天（傍晚、夜里、黎明、雨天），各有一条规则，看得出这一局是在什么天里输的（2026-11-16）
    const ph = rt.day ? H.phaseOf(rt.day) : '', phName = ph ? ' · ' + L(ph[0].toUpperCase() + ph.slice(1)) : '', left = rt.left.toLocaleString();
    $('oNext').textContent = (rt.day ? `${L('Day {n}', { n: rt.day + 1 })}${phName}\u00a0· ` : '') + (rt.atBoss ? (pend ? L('So close! Beat the Cigar Boss for {s}', { s: pend }) : L('So close! Beat the Cigar Boss next time'))
      : rt.idx < 4 ? L('{m} m to {place}', { m: left, place: L(H.STOPS[rt.idx + 1].name) }) : pend ? L('{m} m to the Cigar Boss for {s}', { m: left, s: pend }) : L('{m} m to the Cigar Boss', { m: left }));
    /* 按钮上面一行：头几局按这次怎么输的教一句怎么躲（每种最多说两次）；教完了换成下一个任务还差多少。
     * 同类跑酷（地铁跑酷、疯狂喷气机、神庙逃亡 2）的结算页都把任务进度摆在眼前，这是「再来一局」最直接的理由 */
    /* 被慢慢追上（不是撞、呛、气用光）：看这一局是怎么跑的再教。没入账过：教按住冲刺；入账过但没有 PERFECT：教出烟那一下松手；都会了：教一口气多冲几个。
     * 原来一律是「按住冲刺」，一局憋了很多气、做了 3 次 PERFECT 的人也看到这一句（2026-11-16） */
    // 烟里冲刺：慢慢被追上，多半是没往烟里钻（加速全靠烟）；钻过、也 PHEW 过了，再教 PERFECT
    const slowKey = g.dash ? ((runStat.turbos || 0) < 3 ? 'slowDash' : !runStat.perfects && runStat.banks ? 'slowPerfect' : 'slowChain')
      : g.breathy ? (!runStat.perfects && runStat.banks ? 'slowPerfect' : 'slowBreath') : !runStat.banks ? '' : !runStat.perfects ? 'slowPerfect' : 'slowChain';
    // 最后是呛死的：气用光以后在烟里呛的算「气用光」，在烟里松手呛的另教一句（同上面跑的时候的提示）
    const hk = r.hurt === 'cough' && g.hurtT - gaspAt < 1.5 ? 'gasp' : r.hurt === 'cough' && g.hurtT - relSmokeAt < 1.2 ? 'letgo' : r.hurt;
    const rr = S.bonus ? null : r, tk = hk === 'bump' && g.dash ? 'trip' : hk === 'bump' && g.t - wallAt < 6 ? 'wall' : hk || slowKey, said = (meta.tips || {})[tk] || 0, nm = nextMission(rr);      // 刚升级换了一组新任务：新任务和这一局无关，从 0 算
    let goal = '', isM = false;
    if (runs <= 6 && said < 2 && !runDaily) { goal = L(TIPS[tk] || TIPS['']); meta.tips = Object.assign({}, meta.tips, { [tk]: said + 1 }); saveMeta(); }
    else if (nm) { goal = L('Mission: {m} · {p}', { m: MISSIONS[nm.t].text(nm.n), p: progText(nm, shownValue(nm, rr), '/') }); isM = true; }
    $('oTip').textContent = goal; $('oTip').hidden = !goal || isM; $('oTip').classList.toggle('m', isM);      // 第三轮：任务进度在暂停菜单、任务页里看，结算页只留头几局教怎么躲的那一句
    $('bRetry').querySelector('span').textContent = runDaily ? L('DAILY AGAIN') : wantDay > 1 && dayOpen(wantDay) ? L('DAY {d} AGAIN', { d: wantDay }) : L('RUN AGAIN');
    // 这一局死在第 2、3 天，而那一天已经能直接出发：路下面多一个小按钮，点了从那一天跑起（2026-11-21）
    const dd = rt.day + 1, dayGo = !runDaily && dd >= 2 && dd <= 3 && dayOpen(dd) && dd !== (g.startDay || 1);
    $('bDayGo').hidden = !dayGo;
    if (dayGo) { $('bDayGo').dataset.day = dd; $('bDayGo').textContent = L('▶︎ Start at Day {d}', { d: dd }); }
    // 看广告金币翻倍：这一局不到 10 枚也能点，看完给 10 枚（原来不到 10 枚就灰掉，玩家看到一个灰的「×2 +8」，像坏了，2026-11-16）
    // 原来写「×2 +N」，看不懂是什么翻倍（2026-11-21，docs/32）。现在写看广告再拿多少
    /* 看广告领几倍（2026-11-21，docs/33）：原来是固定「看广告再拿 +90」，金币不缺的时候没人点。
     * 现在一根针在 ×2 ×3 ×5 ×3 ×2 上来回走，按下去停在哪就领几倍，按钮上的数跟着针变。平均约 ×2.8 */
    $('oBar').innerHTML = LUCKY.map(([v, w]) => `<span class="v${v}" style="flex:${w}">×${v}</span>`).join('') + '<i class="needle" id="oNeedle"></i>';
    luck = { t: Math.random() * 2, stop: false, v: 0 }; $('oLucky').classList.remove('done');
    $('bDouble').disabled = false; luckyLabel(2);
    $('oUpBadge').hidden = !upNew();
    const w0 = meta.coins - S.earned - S.bonus - (dailyR ? dailyR.coins : 0);      // 钱包从这一局之前的数滚上去：每日挑战的那一笔也算在里面
    $('oCoins').textContent = w0.toLocaleString();
    // 钱包下面把这一局进了多少拆开写（2026-11-21，docs/32）：捡到几枚、任务等级加成、金币翻倍、升级任务、每日挑战
    const parts = [L('picked up {n}', { n: r.coins.toLocaleString() })];
    if (mul0 > 1) parts.push(L('rank +{p}%', { p: Math.round((mul0 - 1) * 100) }));
    if (meta.doubler) parts.push(L('doubler ×2'));
    if (S.bonus) parts.push(L('missions +{n}', { n: S.bonus.toLocaleString() }));
    if (dailyR && dailyR.coins) parts.push(L('daily +{n}', { n: dailyR.coins.toLocaleString() }));
    earnSum = meta.coins - w0; earnParts = parts;
    // 第三轮（2026-11-21）：结算页东西太多，拆开的明细（捡到几枚、任务加成、翻倍）不再写，只留一行带金币图标的「+18」
    $('oEarn').innerHTML = `<b>${coinIco()}+${earnSum.toLocaleString()}</b>`;
    $('oGoal').hidden = true;      // 第三轮（2026-11-21）：「买得起了」只在主页那条上说，结算页不再重复（用户：到处都在说买得起）
    $('over').classList.remove('landed', 'gold');
    $('over').hidden = false; mode = 'over';
    ov = { t: 0, dist: r.dist, shown: -1, landed: false, isBest: isBest && runs > 1, flags: flags.length, w0, w1: meta.coins, wT: 1.05 };
    setTimeout(flushReward, 1800);      // 跑的时候到账的东西：结算落定以后再开
    Snd.card();
  }
  // 结算画面上的动画由主循环推：数字从 0 滚到这一局的米数，滚完「咚」一下；破纪录撒彩带；金币一个个数进钱包
  function stepOver(dt) {
    if (!ov) return;
    ov.t += dt; stepLucky(dt);
    const u = Math.min(1, ov.t / .75), n = Math.round(ov.dist * (1 - Math.pow(1 - u, 3)));
    if (n !== ov.shown) { if (Math.floor(n / Math.max(1, ov.dist) * 12) !== Math.floor(ov.shown / Math.max(1, ov.dist) * 12)) Snd.tick(); ov.shown = n; $('oDist').textContent = n.toLocaleString(); }
    if (u >= 1 && !ov.landed) {
      ov.landed = true; $('over').classList.add('landed');
      if (ov.isBest) { $('over').classList.add('gold'); R.confettiScreen(90); Snd.win(); } else Snd.card();
      if (ov.flags) setTimeout(() => Snd.star(2), 300);
      if (askRemind) { askRemind = false; setTimeout(() => { if (mode === 'over' && !$('over').hidden) showRemind(); }, 1200); }
    }
    if (ov.t > ov.wT && ov.w1 !== ov.w0) {
      const v = Math.min(1, (ov.t - ov.wT) / .6), w = Math.round(ov.w0 + (ov.w1 - ov.w0) * v);
      $('oCoins').textContent = w.toLocaleString();
      if (!ov.coinSnd) { ov.coinSnd = true; Snd.coin(); $('oWallet').classList.remove('pop'); void $('oWallet').offsetWidth; $('oWallet').classList.add('pop'); }
      if (v >= 1) ov.w0 = ov.w1;
    }
  }
  function toTitle() {
    hideAll(); R.clearFx(); R.hat = wornHat();
    g = demoGame();
    showMeta();
    $('title').hidden = false; mode = 'title';
    Snd.track('title'); Snd.music(true); Snd.muffle(false);
    ciPopToday(); setTimeout(flushReward, 600);
  }
  /* 今天第一次看到主页、还没签到：签到面板自己弹出来（第一局还没跑过不弹，第一次打开先让人去玩）。
   * 原来只在「回到主页」那一刻看：手机上第二天点开 App，多半是 iOS 把挂在后台的游戏接着放，没有重新回主页，签到就不弹（2026-11-17 用户说）。
   * 现在 App 回到前台时也看一次：停在主页上就弹；开着别的面板（商店、帽子……）先不弹，下次回到主页（跑完一局）再弹；跑到一半不打扰 */
  function ciPopToday() {
    if (!(ciCan() && runs >= 1 && meta.ciPop !== dayKey(new Date()))) return;
    meta.ciPop = dayKey(new Date()); saveMeta();
    setTimeout(() => { if (mode === 'title' && $('checkin').hidden) showCheckin(); }, 450);
  }
  function onForeground() {
    if (mode !== 'title' || document.hidden) return;
    showMeta();      // 过了一天：每日挑战、签到的红点、连续天数跟着换
    const busy = ['settings', 'how', 'shop', 'gear', 'missions', 'story', 'store', 'daily', 'cities', 'tunes', 'hats', 'remind', 'log', 'checkin', 'policy'].some(id => $(id) && !$(id).hidden);
    if (!busy) ciPopToday();
  }
  addEventListener('hyb-native-resume', onForeground);
  document.addEventListener('visibilitychange', onForeground);
  $('bStart').addEventListener('click', () => { wantDay = 1; begin(false); });
  // 旅行卡上的「第 N 天」、结算页上的「从第 N 天出发」
  function startAt(d) { if (!dayOpen(d)) return; wantDay = d; $('cities').hidden = true; begin(false); }
  $('cDays').addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-day]'); if (b && !b.disabled) startAt(+b.dataset.day); });
  $('bDayGo').addEventListener('click', () => startAt(+$('bDayGo').dataset.day));
  $('bDaily').addEventListener('click', () => { Snd.init(); Snd.click(); showDailyCard(); });
  $('bRetry').addEventListener('click', () => begin(!!runDaily));
  function buyGear(k) {
    const free = gearFree(k);
    const tix = !free && meta.tix > 0;      // 有签到送的装备券：先用券，不花金币
    if (!free && !tix && meta.coins < GEAR_COST[k]) return;
    if (tix) meta.tix--; else if (!free) meta.coins -= GEAR_COST[k];
    // 免费试用先用掉「没试过」这一次，每天第一件免费留着给已经试过的
    if (!gearTried(k)) meta.tried = (meta.tried || []).concat(k); else meta.gearDay = dayKey(new Date());
    meta.gearRest = 0; adGear = false; saveMeta(); if (free) Snd.click(); else Snd.buy(); start({ gear: k, fromTitle: gearFrom === 'title' });
  }
  $('gList').addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-gear]'); if (b && !b.disabled) buyGear(b.dataset.gear); });
  $('bGearSkip').addEventListener('click', () => { Snd.click(); meta.gearRest = 2; adGear = false; saveMeta(); start({ fromTitle: gearFrom === 'title' }); });
  $('bGearAd').addEventListener('click', () => showAd('gear').then(ok => { if (!ok) return; adGear = true; Snd.star(2); showGear(); for (const c of $('gList').children) { c.classList.remove('bought'); void c.offsetWidth; c.classList.add('bought'); } }));
  $('bReroll').addEventListener('click', () => {
    if (meta.coins >= REROLL) { meta.coins -= REROLL; saveMeta(); Snd.star(1); rollGear(); showGear(); showMeta(); return; }
    showAd('reroll').then(ok => { if (ok) { Snd.star(1); rollGear(); showGear(); } });
  });
  $('bGearBack').addEventListener('click', () => { Snd.click(); $('gear').hidden = true; mode = gearFrom; });
  $('bResume').addEventListener('click', () => setPause(false));
  $('bQuit').addEventListener('click', () => { Snd.music(false); toTitle(); });
  $('bHome').addEventListener('click', () => { Snd.click(); toTitle(); });
  $('oTip').addEventListener('click', () => { if ($('oTip').classList.contains('m')) { Snd.init(); Snd.click(); showMissions(); } });
  for (const id of ['bShop', 'bShop2']) $(id).addEventListener('click', () => { Snd.init(); Snd.click(); showShop(); });
  for (const id of ['tGoal', 'oGoal']) $(id).addEventListener('click', () => openGoal($(id)));
  $('bShopClose').addEventListener('click', () => { Snd.click(); $('shop').hidden = true; showMeta(); });
  $('bMissions').addEventListener('click', () => { Snd.init(); Snd.click(); showMissions(); });
  $('tMissions').addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-swap]'); if (!b) return;
    const i = +b.dataset.swap;
    if (meta.coins >= SWAP) { meta.coins -= SWAP; Snd.buy(); swapMission(i); showMeta(); return; }
    showAd('swap').then(ok => { if (ok) { Snd.star(1); swapMission(i); showMeta(); } });
  });
  $('bMissionsClose').addEventListener('click', () => { Snd.click(); $('missions').hidden = true; });
  $('sStory').addEventListener('click', () => { Snd.init(); Snd.click(); $('settings').hidden = true; showStory(null); });      // 故事从设置里重看（原来是主页左上角一个书本按钮）
  $('story').addEventListener('click', e => { if (e.target.id !== 'bStorySkip') tapStory(); });
  $('bStorySkip').addEventListener('click', () => { Snd.init(); Snd.click(); endStory(); });
  for (const id of ['bStore', 'bCoins']) $(id).addEventListener('click', () => { Snd.init(); Snd.click(); showStore(); });
  $('bDailyGo').addEventListener('click', () => begin(true));
  $('bDailyClose').addEventListener('click', () => { Snd.click(); $('daily').hidden = true; });
  $('bCities').addEventListener('click', () => { Snd.init(); Snd.click(); showCities(); });
  $('bCitiesClose').addEventListener('click', () => { Snd.click(); $('cities').hidden = true; });
  /* 试听配乐（测试用）。同一份谱子的几种编曲，见 audio.js 的 STYLE。主页左上角的 ♪ 打开：点一种就换过去，下面一排选听哪一首；
   * 暂停菜单里也能换，跑着听。选的是哪一种记在存档里。定下来以后这一段、两个按钮和 audio.js 里没选上的风格一起删。 */
  const TUNE_NOTE = { a: 'What you have now', b: 'Swing beat, oom-pah bass, skipping along', c: 'A whistled tune over soft brushes', d: 'Faster, four-on-the-floor, being chased' };
  const tuneName = k => { const s = Snd.styles().find(x => x[0] === k); return `${k.toUpperCase()} · ${s ? s[1] : ''}`; };
  let hear = 'title';
  function drawTunes() {
    $('tuStyles').innerHTML = Snd.styles().map(([k, name]) => `<button class="tune${k === Snd.style ? ' on' : ''}" type="button" data-k="${k}"><i>${k.toUpperCase()}</i><b>${name}</b><span>${L(TUNE_NOTE[k] || '')}</span></button>`).join('');
    $('tuSongs').innerHTML = [['title', 'Home'], ['run', 'Running'], ['boss', 'Boss']].map(([k, name]) => `<button class="ghost${k === hear ? ' on' : ''}" type="button" data-s="${k}">${L(name)}</button>`).join('');
    $('bStyle').textContent = L('Music style: ') + tuneName(Snd.style);
  }
  function setTune(k) { Snd.init(); Snd.setStyle(k); meta.style = k; saveMeta(); drawTunes(); }
  if (meta.style) Snd.setStyle(meta.style);
  // 测试者模式下才露出来的东西，见最上面 tester 的说明
  function testerUI() {
    $('bTunes').hidden = !tester; $('bStyle').hidden = !tester; $('bLog').hidden = !tester;
    $('bCourse').hidden = !tester; $('bCourse').textContent = H.course ? L('Track: smoke course') : L('Track: old (1.0)');
  }
  /* 规则冻结（2026-11-20，docs/02）：1.0 只有烟里冲刺（docs/27）、气 B。测试者菜单里切规则、切气的两个按钮拿掉了，
   * 以前切过的存档也一律换回来；之后只修 bug、调数值，不再改核心规则。DIVE、BREATH、CLASSIC 的代码留在 core.js 的 RULES 里，给 bot.js 比数用 */
  if (meta.rules !== 'dash' || meta.breath !== 'b') { meta.rules = 'dash'; meta.breath = 'b'; meta.rulesV = 3; saveMeta(); }
  H.setBreath('b');
  H.setRules('dash');
  // 烟就是赛道（docs/35）：1.1 起默认打开（用户 2026-11-21 定的，随 1.1 上线）；测试者菜单里能切回原来的赛道比一比
  H.setCourse(meta.course !== false);
  $('bCourse').addEventListener('click', () => { meta.course = !H.course; H.setCourse(meta.course); saveMeta(); testerUI(); Snd.click(); });
  testerUI();
  drawTunes();
  $('bTunes').addEventListener('click', () => { Snd.init(); Snd.open(); Snd.fast(false); hear = 'title'; drawTunes(); $('tunes').hidden = false; });
  $('tuStyles').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) setTune(b.dataset.k); });
  $('tuSongs').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; Snd.init(); hear = b.dataset.s; Snd.track(hear); Snd.music(true); drawTunes(); });
  $('bTunesClose').addEventListener('click', () => { Snd.click(); $('tunes').hidden = true; hear = 'title'; Snd.track('title'); });
  $('bStyle').addEventListener('click', () => { const ks = Snd.styles().map(x => x[0]); setTune(ks[(ks.indexOf(Snd.style) + 1) % ks.length]); Snd.click(); });
  $('bStoreClose').addEventListener('click', () => { Snd.click(); $('store').hidden = true; showMeta(); if (!$('hats').hidden) showHats(); });
  $('stList').addEventListener('click', e => {
    // 看广告领金币
    const fb = e.target.closest && e.target.closest('[data-free]');
    if (fb) {
      if (!freeLeft() || fb.disabled) return;
      showAd('coins').then(ok => {
        if (!ok) return;
        const today = dayKey(new Date()); if (meta.freeDay !== today) { meta.freeDay = today; meta.freeN = 0; }
        meta.freeN++; meta.coins += FREE_COINS; saveMeta();
        const l = freeLeft();      // 看完一段也开奖：看广告的人也该高兴一下，下次才愿意再看（docs/33）
        reward({ kick: L('Free coins'), pic: `<img src="${CI_ART['coins-1']}" alt="">`, count: FREE_COINS, sub: l ? L(l > 1 ? '{n} more videos today' : '{n} more video today', { n: l }) : L('That’s all for today. Back tomorrow!'), fly: { n: 6, target: 'stCoins' }, after: () => { showStore(); showMeta(); } });
      });
      return;
    }
    const bb = e.target.closest && e.target.closest('[data-buy]'), id = bb && !bb.disabled && bb.dataset.buy; if (!id) return;
    Snd.click();
    Promise.resolve(window.hybStore ? window.hybStore.buy(id) : true).catch(() => false).then(ok => { if (ok) grant(id); });
  });
  $('bRestore').addEventListener('click', () => {
    if (!window.hybStore) { $('stNote').textContent = L('Nothing to restore in this test build.'); return; }
    window.hybStore.restore().then(ids => { if (ids.includes('noads')) meta.noAds = true; if (ids.includes('doubler')) meta.doubler = true; saveMeta(); showStore(); $('stNote').textContent = L(ids.length ? 'Purchases restored.' : 'Nothing to restore.'); }).catch(() => { $('stNote').textContent = L('Could not reach the store. Try again later.'); });
  });
  // App 里的内购（iOS 壳的 StoreBridge）：打开时悄悄认回已经买过的永久商品（重装、换手机）；买到一半被打断的金币包，下次打开补发；价格到了刷新商店
  if (window.hybStore) {
    const own = ids => { let ch = false; if (ids.includes('noads') && !meta.noAds) { meta.noAds = true; ch = true; } if (ids.includes('doubler') && !meta.doubler) { meta.doubler = true; ch = true; } if (ch) { saveMeta(); if (!$('store').hidden) showStore(); } };
    if (window.hybStore.owned) window.hybStore.owned().then(own);
    window.addEventListener('hyb-store-owned', e => own(e.detail || []));
    window.addEventListener('hyb-store-grant', e => grant(e.detail));
    window.addEventListener('hyb-store-prices', () => { if (!$('store').hidden) showStore(); });
    window.hybStoreReady = true;
  }
  $('bRevive').addEventListener('click', doRevive);
  $('bRevivePay').addEventListener('click', payRevive);
  $('bResetCoins').addEventListener('click', () => { meta.coins = 0; saveMeta(); showStore(); showMeta(); });
  $('bNoRevive').addEventListener('click', () => { Snd.click(); showOver(); });
  $('bDouble').addEventListener('click', () => {
    if ($('bDouble').disabled || !luck) return;
    $('bDouble').disabled = true; luck.stop = true;      // 针停下来，停在的那一格亮一下
    const v = luck.v, seg = [...$('oBar').querySelectorAll('span')], p = parseFloat($('oNeedle').style.left) || 50;
    let a = 0; for (let i = 0; i < LUCKY.length; i++) { a += LUCKY[i][1]; if (p < a || i === LUCKY.length - 1) { seg[i].classList.add('hit'); break; } }
    Snd.star(v === 5 ? 4 : v - 1);
    showAd('double').then(ok => {
      if (!ok) { $('bDouble').disabled = false; luck.stop = false; for (const s2 of seg) s2.classList.remove('hit'); return; }
      const add = lastEarned * (v - 1);
      meta.coins += add; saveMeta(); $('oLucky').classList.add('done');
      $('bDouble').innerHTML = `${L('Got it!')} <b>+${add.toLocaleString()}</b>${coinIco()}`;
      earnSum += add; earnParts = earnParts.concat(L('ad ×{v} +{n}', { v, n: add.toLocaleString() }));
      $('oEarn').innerHTML = `<b>${coinIco()}+${earnSum.toLocaleString()}</b>`;
      // 开奖，收下以后钱包再数一遍
      reward({ kick: L('Lucky ×{n}!', { n: v }), pic: `<img src="${CI_ART[v >= 5 ? 'coins-3' : v >= 3 ? 'coins-2' : 'coins-1']}" alt="">`, count: add, sub: buysLine(meta.coins), fly: { n: 8, target: 'oCoins' }, next: false,
        after: () => { if (ov) { ov.w0 = +$('oCoins').textContent.replace(/\D/g, ''); ov.w1 = meta.coins; ov.wT = ov.t; ov.coinSnd = false; } } });
    });
  });
  $('sList').addEventListener('click', e => {
    const k = e.target && e.target.dataset && e.target.dataset.up; if (!k) return;
    const lv = meta.up[k] || 0, cost = upCost(k);
    if (cost == null || meta.coins < cost) return;
    meta.coins -= cost; meta.up[k] = lv + 1; saveMeta(); Snd.buy(); showShop(k);
    track('upgrade', { id: k, level: lv + 1, run: runs });
  });

  /* ---------- 震动（2026-11-16）：App 里（iOS 壳挂上 window.hybHaptic）跑的时候手里有反馈，暂停页能关；网页里没有 ----------
   * 轻：换道、换道没换成、滋中、捡道具；中：PHEW、呛到、打中老板；重：撞上；成功：PERFECT、打败老板、Second Wind；警告：气用光、被追上。
   * 轻的一下 60 毫秒内只震一次（连着捡、连着滋不会嗡嗡响） */
  const BUZZ = { perk: 'success', mintSave: 'light', join: 'success', lane: 'light', laneBlocked: 'light', laneEdge: 'light', hit: 'light', power: 'light', mint: 'light', bank: 'medium', cough: 'medium', bossHit: 'medium', bump: 'heavy', bumpSmoker: 'heavy', bumpPed: 'heavy', scooterHit: 'heavy', gasp: 'warning', bossDown: 'success', secondWind: 'success' };
  let buzzOn = store.get('hyb-buzz') !== '0', buzzAt = 0;
  function buzz(k) {
    if (!buzzOn || !window.hybHaptic) return;
    const now = performance.now(); if (k === 'light' && now - buzzAt < 60) return; buzzAt = now;
    window.hybHaptic(k);
  }
  const buzzLabel = () => { for (const id of ['bBuzz', 'sBuzz']) { $(id).hidden = !window.hybHaptic; $(id).innerHTML = `<span class="sl">${ICON.buzz}${L('Vibration')}</span>`; $(id).classList.toggle('on', buzzOn); } };
  $('bBuzz').addEventListener('click', () => { buzzOn = !buzzOn; store.set('hyb-buzz', buzzOn ? '1' : '0'); Snd.click(); buzzLabel(); buzz('medium'); });
  $('sBuzz').addEventListener('click', () => $('bBuzz').click());
  buzzLabel();

  /* ---------- 事件 → 声音和特效 ---------- */
  const lastFx = {};
  function once(k, gap) { const t = performance.now() / 1000; if (lastFx[k] && t - lastFx[k] < gap) return false; lastFx[k] = t; return true; }
  const Y = e => R.yOf(e.z == null ? g.p.z : e.z, e.h || 0);
  function handleEvents() {
    const p = g.p;
    for (const e of g.ev) {
      const bz = e.k === 'bank' && e.perfect ? 'success' : BUZZ[e.k]; if (bz) buzz(bz);
      // 试玩记录：这一局撞了几次、呛了几次、气用光几次、入账几次
      // 撞在三条道全堵的墙上记 wallAt。（呛、气用光的计数原来写进了这行的注释里，一直没算过，2026-11-16 挪出来）
      if (e.k === 'bump' || e.k === 'bumpSmoker' || e.k === 'bumpPed') { runStat.bumps++; if (![0, 1, 2].some(l => l !== g.p.lane && H.laneFree(g, l, g.p.x - 14, g.p.x + 60))) wallAt = g.t; }
      else if (e.k === 'gasp') runStat.gasps++; else if (e.k === 'cough') runStat.coughs++; else if (e.k === 'smogLunge') runStat.slips++;
      else if (e.k === 'bank') { runStat.banks++; if (e.perfect) runStat.perfects++; if ((e.push || 0) >= 250) runStat.bigPush++; }
      switch (e.k) {
        case 'shoot': Snd.shoot(); break;
        case 'hit':
          did.hit = true;
          Snd.hit(); Snd.oops(); R.shake(e.bull ? 5 : 2);      // 跑着的时候整屏乱晃也像卡，晃得轻一点
          // 滋中的那声字和烟民的一句话（2026-11-16）：超级水枪自己连着滋，一下一个「PSSST!」「SPLASH!」，再加上每个烟民一句「My bad.」，
          // 三四行字堆在一起。现在水枪自己滋的不冒字；烟民说话隔 1.2 秒才轮到下一个（屏幕上同时只冒一个这种字，见 render.js 的 fx）
          if (!e.bull && !(g.power && g.power.kind === 'soaker')) R.say(L(['PSSST!', 'FSSH!', 'SPLASH!'][(Math.random() * 3) | 0]), e.x, Y(e) - 30, 20, '#fff', .55, 'fx');
          R.burst(e.x, Y(e), e.bull ? 22 : 14, 190);
          if (!e.s.say && g.t - saidAt > 1.2) { e.s.say = SAYS[(Math.random() * SAYS.length) | 0]; saidAt = g.t; }
          break;
        case 'bull': R.say(L('BULLSEYE!'), e.x, Y(e), 22, '#7fd0ff', .9, 'good'); Snd.bull(); if (!g.ev.some(x => x.k === 'join')) hintOnce('bull', 'Bullseye! Free shot, plus some air', 3); break;      // 这一下他就戒烟跟着跑了：说跟着跑的那句，这句留到下次
        case 'steam': R.burst(e.x, Y(e), 12, 130, '#ffffff'); Snd.steam(); R.say(L('FSSSH'), e.x, Y(e) - 10, 16, '#fff', .6, 'fx'); break;
        case 'coin': Snd.coin(1); R.burst(e.x, R.yOf(e.z, 18), 4, 70, '#f6c624'); if (e.m > 1) R.say(`+${e.m}`, e.x, R.yOf(e.z, 66), 12, '#f6c624', .55); break;      // 傍晚一个金币算两个，捡的时候头顶上冒个 +2
        case 'chain': Snd.chain(e.n); break;
        case 'bank':
          did.release = true;
          // 出烟那一下松手（PERFECT，core.js）：字换成金色的 PERFECT!，多一声；第一次顺手讲一句是怎么来的
          if (e.perfect) {
            R.say(g.breathy ? L('PERFECT! {s}s', { s: e.secs.toFixed(1) }) : e.n > 1 ? L('PERFECT! ×{n}', { n: e.n }) : L('PERFECT!'), p.x + 40, R.yOf(p.z, 120), 22 + Math.min(14, g.breathy ? e.secs * 3 : e.n * 2), '#ffd23f', 1.1, 'big'); Snd.star(1); hintOnce('perfect', 'PERFECT! Let go right as you leave the smoke', 3.4);
            if ((meta.perfects || 0) < PERFECT_TEACH) { meta.perfects = (meta.perfects || 0) + 1; saveMeta(); }
          }
          else if (g.breathy) R.say(L('PHEW! {s}s', { s: e.secs.toFixed(1) }), p.x + 40, R.yOf(p.z, 120), 20 + Math.min(14, e.secs * 3), '#8fe0a8', 1, e.secs >= 2.5 ? 'big' : 'good');      // 憋气版：写在烟里憋了几秒
          else R.say(e.n > 1 ? L('PHEW! ×{n}', { n: e.n }) : L('PHEW!'), p.x + 40, R.yOf(p.z, 120), 20 + Math.min(14, e.n * 2), '#8fe0a8', 1, e.n >= 3 ? 'big' : 'good');      // 「×1」什么也没乘，只过了一个人就不写
          // 潜水规则下分数没用，写这一口把大烟雾吹回去多少米
          if (g.dive) { if (e.push >= 75) R.say(L('SMOG -{n} m', { n: Math.round(e.push / CFG.M) }), p.x + 44, R.yOf(p.z, 92), 13 + Math.min(5, e.n), '#fff', .9, 'pts'); }
          else R.say(`+${e.v}`, p.x + 44, R.yOf(p.z, 92), 13, '#fff', .8, 'pts');
          { const big = g.breathy ? e.secs >= 2.5 : e.n >= 3; Snd.bank(g.breathy ? Math.max(1, Math.round(e.secs)) : e.n); R.relief(); if (big) { R.shake(4); R.smogBlown(); } }
          // 一口气冲过 5 个以上：最难得的那一下，金色大字、一阵风从身后吹出去、晃得更狠（量的：只占入账的 2% 到 4%）
          // 大连冲的金币。字用 good 不用 pts：pts 会和旁边的「SMOG -8 m」合并成一个数
          if (e.coins) { R.say(L('+{n} coins', { n: e.coins }), p.x + 40, R.yOf(p.z, 70), 13, '#ffd23f', 1, 'good'); R.burst(p.x + 8, R.yOf(p.z, 60), Math.min(16, e.coins / 2 | 0), 140, '#f6c624'); Snd.coin(); }      // 大连冲的金币
          if (e.n >= 5) { R.say(L('MEGA PHEW!'), p.x + 30, R.yOf(p.z, 150), 26, '#ffd23f', 1.3, 'big'); R.burst(p.x - 24, R.yOf(p.z, 40), 26, 300, '#ffffff'); R.shake(8); Snd.blow(); }
          hintOnce('bank', g.breathy ? 'PHEW! The longer you hold in smoke, the farther it goes' : 'PHEW! Every smoker passed on that breath counts', 3.4);
          break;
        case 'chainLost': if (e.n >= 2) R.say(L('×{n} lost', { n: e.n }), p.x + 20, R.yOf(p.z, 118), 14, '#c6ccd4', .9, 'info'); Snd.lost(); break;
        case 'cough':
          R.cough(); Snd.cough(); R.shake(6);
          R.say(L('*COUGH*'), e.x + 10, Y(e), 22, '#f6d04d', .8, 'big');
          // 呛到的提示看是怎么呛的（2026-11-16）：原来一律「进烟前先憋气」。气用光了在烟里喘才呛的，那句「气用光了」刚出来就被这句顶掉；
          // 在烟里就松了手的，人明明憋过了。气用光的不再说（那句已经说了），烟里松手的另说一句
          if (g.t - gaspAt < 1.5) { /* 气用光那句已经说了 */ }
          else if (g.t - relSmokeAt < 1.2) hintOnce('coughLetGo', 'You let go inside the smoke! Hold until you’re out', 3.6, true);
          else hintOnce('cough', 'Hold your breath BEFORE the cloud', 3.6, true);
          break;
        case 'gasp': gaspAt = g.t; R.say(L('HAAAH'), p.x, R.yOf(p.z, 80), 24, '#fff', 1, 'big'); Snd.gasp(); R.shake(4); hintOnce('gasp', 'Out of air! Let go sooner, in clean air', 3.4, true); break;
        case 'holdOn': did.hold = true; Snd.hold(); Snd.muffle(true); beatT = .25; break;
        case 'holdOff': Snd.muffle(false); Snd.exhale(); if (g.dens < CFG.DMIN) did.release = true; else relSmokeAt = g.t; break;
        // 换街区：那一下挡住背景换图（第 3 天起是夜里，用深蓝，不闪白）、横幅写街区名和这一天、响一声。
        // （2026-11-16 修：上一版把横幅、声音和 break 写进了这行的注释里，换街区时不出街区名，还掉进下一个分支弹出 THE BIG SMOG）
        case 'district':
          if ((e.day || 0) >= 2) R.flash(.6, '#141a33'); else R.flash(.6);
          lowerNow(); R.card(L(e.name).toUpperCase(), dayLine(e.day)); Snd.star(e.idx);
          break;
        // 第一局：大烟雾醒来时还在屏幕外很远（480），这时说「它在你身后」画面上什么都没有，还正好压在「按住憋气」那步教学上。
        // 等它进了画面（见主循环的 smogCard）再出这张卡（2026-11-16）
        case 'smogIn': if (g.tutorial) { smogCard = true; break; } R.card(L('THE BIG SMOG'), L(TOUCH ? 'It’s behind you. HOLD to sprint away' : 'It’s behind you. Hold SPACE to sprint away')); Snd.smog(); R.shake(5); break;
        case 'pop': Snd.pop(e.n); R.burst(e.x, Y(e), 8, 120, '#bfe9ff'); break;
        case 'bossIn': {
          // 横幅写这是第几天的老板（第 2 天戴黑墨镜、第 3 天起金墨镜，docs/17）；能给新星的话写上几颗星
          Snd.horn(); Snd.track('boss'); R.clearTexts();
          const d = g.day || 0, st = d < 3 && d + 1 > starsOf() ? ` · ${'★'.repeat(d + 1)}` : '';
          R.card(L(d === 0 ? 'THE CIGAR BOSS' : d === 1 ? 'CIGAR BOSS IN SHADES' : 'GOLDEN CIGAR BOSS'),
            (d === 0 ? L('Tap what he shows you: rings, ember, flame') : L(d <= 4 ? 'Day {d}: faster than yesterday' : 'Day {d}: top speed', { d: d + 1 })) + st);      // 老板第 5 天起不再变快（core.js 的 BOSS_T 乘 0.6 封顶）
          break;
        }
        // 老板换招：要点什么写在他头上（TAP THE EMBER! 这些，render.js），顶上不再重复一遍（2026-11-16：两处说同一句话）
        case 'bossMove': break;
        case 'bossHit': Snd.boss(); Snd.hit(); R.shake(7); R.say(L(e.hp === 1 ? 'HAT OFF!' : 'GOT HIM!'), e.x, Y(e) - 20, 22, '#fff', .9, 'good'); R.burst(e.x, Y(e), 16, 190); break;
        case 'bossBlock': if (once('bb', .6)) { R.say(L('Not there!'), e.x, Y(e), 15, '#fff', .6, 'info'); Snd.dry(); } break;
        case 'bossFlick': Snd.blow(); R.shake(3); break;
        case 'bossCharge': Snd.charge(); break;
        case 'bossBlow': Snd.blow(); R.shake(5); break;
        case 'bossDown': {
          // 打败雪茄老板：第 1 天的算走通纽约。第几天的老板就是第几颗星，新星有一笔奖励；之后进入下一天，更快更密
          const d = Math.min(2, g.day || 0), star = d + 1 > starsOf() ? d + 1 : 0, bonus = star ? STAR_COINS[d] : 0;
          meta.cleared = (meta.cleared || 0) + 1; if (star) { meta.stars = star; meta.coins += bonus; g.newStar = star; } saveMeta();
          hint = null;      // 「点打火机的火苗」之类打老板的提示，打完了还挂着就是错的
          // 新星送的帽子：头上空着就当场扣上去
          const nh = star ? grantHats() : [];
          if (nh.length) { g.newHats = (g.newHats || []).concat(nh); R.say(L('NEW HAT: {h}!', { h: L(nh[0].name).toUpperCase() }), p.x + 30, R.yOf(p.z, 150), 18, '#ffd23f', 1.8, 'big'); }
          Snd.track('run'); if (!Snd.sting('cleared')) Snd.win(); R.flash(); R.shake(10); R.smogBlown(); R.confetti(e.x, Y(e), star ? 120 : 60);
          R.say(star ? L('{s} NEW YORK!', { s: '★'.repeat(star) }) : L('ROAD CLEAR!'), e.x - 40, Y(e) - 30, 28, '#f6c624', 1.6, 'big'); R.say(L('+{n} coins', { n: 60 + bonus }), e.x - 40, Y(e), 15, '#fff', 1.4, 'pts');
          const pend = (g.day || 0) + 2 <= 3 && (g.day || 0) + 2 > starsOf() ? (g.day || 0) + 2 : 0;      // 下一天的老板还能给一颗新星
          R.card(star === 1 ? L('NEW YORK CLEARED! ★') : star ? L('DAY {d} BOSS BEATEN! {s}', { d: d + 1, s: '★'.repeat(star) }) : L('CIGAR BOSS BEATEN'),
            // 第 4 天起难度不再涨（core.js：街区长度、浓烟段都封顶在第 4 天），横幅写下一天是什么天，和换街区的横幅一样（2026-11-16，原来一直写 faster and smokier）
            pend ? L('Day {d} starts now, faster. Beat its boss for {s}.', { d: g.day + 2, s: '★'.repeat(pend) }) : g.day + 1 < 3 ? L('Day {d} starts now: faster and smokier. How far can you go?', { d: g.day + 2 }) : dayLine(g.day + 1));
          break;
        }
        case 'ring': Snd.tick(); break;
        case 'ringPop': Snd.pop(3); R.burst(e.x, Y(e), 12, 130, '#c9c5d6'); R.say(L('POP!'), e.x, Y(e) - 16, 18, '#fff', .6, 'good'); break;
        case 'ringThrough': R.burst(e.x, Y(e), 10, 150, '#c9c5d6'); break;
        case 'ringHit': R.burst(e.x, Y(e), 10, 110, '#6a6578'); break;
        case 'fence': if (once('fence', .8)) { R.burst(e.x, Y(e), 5, 80); Snd.dry(); } hintOnce('fence', 'The fence blocks water. HOLD past it', 3, true); break;
        case 'splash': R.burst(e.x, Y(e), 3, 70); break;
        case 'noTarget': if (once('nt', .7)) R.say(L('Nothing to spray'), p.x + 30, R.yOf(p.z, 80), 13, '#fff', .55, 'info'); Snd.dry(); break;
        case 'dry': if (once('dry', .7)) R.say(L('Empty!'), p.x + 20, R.yOf(p.z, 80), 16, R.C.sky, .6, 'info'); Snd.dry(); hintOnce('dry', 'Out of water! Refill in the shop-side lane', 3.6, true); break;
        case 'lane': did.lane = true; Snd.lane(); break;
        // 戒烟大游行（docs/22 的 B）：正中滋灭的人扔了烟跟上来；呛到、撞上、气用光掉一个；大烟雾贴上来先吞最后一个
        // 正中那一下的「BULLSEYE!」换成「I QUIT!」（他就是因为这一下戒的），不叠两行字；人数看顶栏 Leo 头像旁的 +n
        // 街区摊位（docs/22 的 C）：拿到的那样写在头上，另外两个噗地收掉
        case 'perk': R.say(L('{p}!', { p: L(e.label) }), e.x, Y(e), 20, '#ffd23f', 1.1, 'big'); for (let z = 0; z < 3; z++) if (z !== e.z) R.burst(e.x, R.yOf(z, 36), 8, 110, '#fff6cf'); Snd.star(2); break;
        case 'onbeat': Snd.onbeat(); if (once('obeat', .5)) R.say(L('ON BEAT!'), e.x, Y(e), 16, '#b48cff', .8, 'good'); hintOnce('onbeat', 'Smokers puff on the beat. Dash past right after a puff', 3.4); break;
        case 'mintSave': if (once('msave', .6)) R.say(L('*sniff* Fresh!'), e.x, Y(e), 14, '#35d0cf', .9, 'good'); Snd.mint(); break;
        // 有人戒烟跟着跑了：马上说跟着的人有什么用。原来这句只在头三局说，之后第一次有人跟上来，没人告诉你身后这队人是干什么的
        case 'join': if (!g.dash) R.drop(L('BULLSEYE!')); R.say(L(e.n >= CFG.PARADE_MAX ? 'FULL PARADE!' : 'I QUIT!'), e.x, Y(e), 20, '#8fe0a8', .9, 'good'); Snd.mint(); hintOnce('parade', 'He quit! Runners with you make PHEW bigger', 3.6, true); break;
        case 'drop': if (once('pdrop', .5)) R.say(L('Wait up…'), e.x, Y(e), 12, '#c6ccd4', .8, 'info'); break;
        case 'eaten': if (once('peat', .5)) R.say(L('Nooo!'), e.x, Y(e), 12, '#c6ccd4', .8, 'info'); Snd.lost(); break;
        // 换道没换成（2026-11-16）：往最边上那条道外面滑，人往那边一歪、轻轻一声；要去的道上有东西，那里亮一个红叉。原来滑到边上什么反应都没有，像没滑到
        case 'laneBlocked': R.blocked(e.z); if (once('lb', .4)) { Snd.dry(); R.shake(2); } break;
        case 'laneEdge': R.nudge(e.d || 0); if (once('le', .35)) Snd.dry(); break;
        case 'bump': Snd.bump(); if (once('oof', 1.2)) R.say(L('Oof!'), e.x, Y(e), 16, '#fff', .6, 'info'); R.shake(3); hintOnce('bump', g.dash ? 'Tripped! Things trip you. Swipe toward the yellow arrow' : 'Blocked! Swipe toward the yellow arrow', 3, true); break;
        case 'bumpSmoker': Snd.bump(); e.s.say = 'Watch it!'; R.shake(3); break;      // 没憋气撞上：当场呛到，提示在 cough 里
        // 失误（docs/24）：大烟雾扑到身后。屏幕晃一下、它吼一声、四周一圈红，头两次说清楚是怎么回事
        case 'smogLunge': R.shake(7); Snd.smog(); R.flash(.35, '#e8453c'); buzz('heavy');
          hintOnce(e.close ? 'lungeClose' : 'lunge', g.dash ? (e.close ? 'It’s inside the red zone now. Trip again and it gets you' : 'Tripped! The smog jumped closer. If it’s in the red zone, it gets you')
            : e.close ? 'It’s right behind you now. Bump again and it gets you' : 'Bumped! The smog jumped closer. Bump while you can see it and it gets you', 4, true); break;
        case 'smogCatch': R.shake(9); break;
        case 'bumpPed': Snd.bump(); break;
        // 烟里冲刺：冲进烟里加速（头几次头上写 TURBO!，顶上说一句为什么）；从人旁边擦过去（人不挡路，说清楚一次）
        case 'turbo': runStat.turbos++; Snd.turbo(); if (once('turboSay', 6)) R.say(L('TURBO!'), p.x + 34, R.yOf(p.z, 110), 18, '#7fd0ff', .7, 'good');
          hintOnce('turbo', 'TURBO! Holding your breath inside smoke makes you fast', 3.4, true); break;
        case 'brush': Snd.brush(); if (!e.ped && e.s && !e.s.say && g.t - saidAt > 1.2) { e.s.say = e.holding ? 'Whoa!' : '*cough*'; saidAt = g.t; }
          hintOnce(e.holding ? 'brush' : 'brushSmoke', e.holding ? 'People step aside. Only things trip you' : 'He puffed right at you! Hold your breath when you dash past smokers', 3.6, true); break;
        case 'hop': Snd.ollie(); if (e.big) Snd.lane(); break;      // 从人头顶飞过去：压板一声，再带一声风
        case 'land': Snd.land(); break;      // 滑板每跳一下落地都晃屏，连着跳就是一直在抖，去掉了（2026-11-15）
        case 'duck': if (once('whoa', .3)) Snd.lane(); break;
        case 'scooterHit': Snd.bump(); Snd.horn(); R.say(L('OUCH!'), e.x, Y(e), 22, '#fff', .8, 'big'); R.shake(8); break;
        case 'refill': if (once('glug', .5)) R.say(L('glug'), e.x + 26, R.yOf(0, 50), 13, R.C.sky, .5, 'fx'); Snd.refill(); break;
        case 'power': {
          const N = { whistle: ['RUN CLUB!', 'Whistle: every smoker you run past quits and runs with you'], skate: ['SKATEBOARD!', 'Skateboard: hop over low stuff and people. HOLD in smoke'], blower: ['LEAF BLOWER!', 'Leaf blower: blows the smoke back at them'], bubble: ['BUBBLE!', 'Bubble: breathe freely inside it'], soaker: ['SUPER SOAKER!', 'Super soaker: free water, fires by itself'] }[e.kind];
          R.say(L(e.head ? 'HEAD START!' : N[0]), e.x + 20, R.yOf(e.z, 100), 24, e.kind === 'whistle' ? '#8fe0a8' : '#f6c624', 1.1, 'big'); Snd.mult(3); if (e.kind === 'whistle') Snd.whistle(); R.shake(4); R.burst(e.x, R.yOf(e.z, 30), 14, 160, '#f6c624');
          hintOnce('pw-' + e.kind, N[1], 3.4, true);
          break;
        }
        // 侧身（升级）：要撞上的时候自己闪到旁边那条道
        case 'dodge': Snd.lane(); R.say(L('SIDESTEP!'), e.x + 10, Y(e), 18, '#8fe0a8', .8, 'good'); R.burst(e.x, Y(e) + 20, 8, 120, '#ffffff'); break;
        case 'powerEnd': Snd.lost(); break;
        // 开头的引子：字钉在路上，人往前走字会往后退，所以放在人前面一点，读的时候正好在人头上
        case 'introSeen': Snd.smog(); R.say(L('THE SMOG IS COMING!'), e.x + 110, R.yOf(e.z, 128), 17, '#fff', 1.3, 'big'); break;
        case 'introGo': Snd.hold(); Snd.muffle(true); R.shake(2); R.drop(L('THE SMOG IS COMING!')); R.say(L('HOLD YOUR BREATH!'), e.x + 140, R.yOf(e.z, 128), 22, '#35d0cf', 1.3, 'big'); break;
        case 'introPhew': Snd.muffle(false); Snd.exhale(); R.relief(); break;
        case 'introEnd':
          // 交到玩家手上的那一下要看得出来（2026-11-17）：一声、手机轻震、Leo 头上一个大「GO!」
          Snd.ready(); buzz('light'); if (!startCard && !(runs < 3 && !holds.size && !K.has('Space'))) R.say(L('GO!'), p.x + 30, R.yOf(p.z, 130), 30, '#ffd23f', .9, 'big');      // 下面出卡片的时候不再写 GO!
          // 「YOUR TURN!」只在头三局、而且这会儿手没按着的时候出：老玩家按住憋气跳过了开场、已经在冲了，再教「按住左边」是多余的（2026-11-16）
          if (startCard) R.card(startCard[0], startCard[1]);
          else if (runs < 3 && !holds.size && !K.has('Space')) R.card(L('YOUR TURN!'), L(TOUCH ? 'HOLD the left side to hold your breath and sprint' : 'Hold SPACE to hold your breath and sprint'));
          startCard = null;
          break;
        case 'secondWind':
          Snd.win(); R.flash(); R.shake(9); R.smogBlown(); R.burst(e.x, Y(e), 26, 220, '#8fe0a8');
          R.say(L('SECOND WIND!'), e.x + 30, Y(e), 26, '#8fe0a8', 1.5, 'big');
          hint = { s: L('Second Wind used. Next catch ends the run'), t: 3.6, life: 3.6 };
          break;
        case 'mint': R.say(L('FRESH!'), e.x, R.yOf(e.z, 70), 20, '#35d0cf', .8, 'good'); Snd.mint(); break;
        case 'bottle': R.say(L('+2 water'), e.x, R.yOf(e.z, 60), 16, R.C.sky, .7, 'good'); Snd.refill(); break;
        case 'scooterWarn': Snd.horn(); hintOnce('scoot', 'Scooter! Get out of the red lane', 3, true); break;
        case 'scooter': Snd.scooter(); break;
        case 'vent': Snd.vent(); break;
        // 教 PERFECT：头刚冲出烟、这一口冲过人了，气圈外面亮一下金色，提示「现在松手」。做到 5 次 PERFECT 以后就不再亮（一直亮会烦，见 docs 里去掉 LET GO 那次）
        case 'clearSmoke': if ((meta.perfects || 0) < PERFECT_TEACH) R.perfectCue(); break;
        // 浓烟段：这次打开 App 第一次见到，顶上讲一句怎么过；之后快到时路上冒一行 THICK SMOKE!。
        // 不两块一起出（原来顶上横幅、路上大字、墙上吸烟区的牌子三样同时说一件事，2026-11-16）
        case 'hazeAhead':
          if (!seen.haze && !tutorialUp() && ((meta.hints || {}).haze || 0) < HINT_MAX) hintOnce('haze', e.air ? 'Thick smoke! HOLD through, breathe at the AIR vent' : 'Thick smoke! Full breath, then HOLD through', 3.8, true);
          else { seen.haze = 1; R.say(L('THICK SMOKE!'), e.x + 30, R.yOf(1, 128), 20, '#fff', 1.3, 'big'); }      // 提示出满两次以后，第一段也只喊一声
          break;
        case 'airAhead': if (g.p.holding) hintOnce('air', 'AIR vent: let go here to breathe', 3.4, true); break;
        case 'over': finish(); break;
      }
    }
    g.ev.length = 0;
  }
  function proximityHints() {
    const p = g.p;
    if (g.intro) return;      // 开头的引子里不出提示，画面上已经有两句大字了
    if (showHints && !tutorialUp()) {
      const h = HINTS.find(x => !x.until() && !x.skip);
      if (h && !h.done && h.when(g)) { h.done = true; showHint(h.s, 3.6, h.until); if (hint) hint.step = h; }
    }
    if (g.smog.awake && g.smog.gap < 120) hintOnce('smog', g.breathy ? 'The smog is gaining! Hold your breath through smoke to blow it back' : TOUCH ? 'The smog is gaining! HOLD to sprint' : 'The smog is gaining! Hold SPACE to sprint', 3.2, true);
    // 新面孔第一次走进画面：头顶先冒一个短标签（一局一次），比顶上那行字更快让人对上号
    for (const s of g.smokers) {
      if (!s.lit || !s.awake || s.x < p.x || s.x - p.x > 215 || s.tagged) continue;
      const tag = FACE_TAGS.find(t => t[1](s));
      if (tag && !faceSeen[tag[0]]) { faceSeen[tag[0]] = 1; s.tagged = 1; R.say(L(tag[2]), s.x, R.yOf(s.z, 98), 14, '#fff', 1.1, 'info'); }
    }
    for (const s of g.smokers) {
      if (!s.lit || !s.awake || Math.abs(s.x - p.x) > 190 || s.x < p.x) continue;      // 人已经在画面里了才出他的提示：原来隔着 280 就出，说的人还没进画面，容易安到别人头上
      if (s.kind === 'vape') hintOnce('vape', 'Vapers puff on a beat. Go between puffs', 3.4);
      if (s.kind === 'terrace') hintOnce('zone', 'Smoking area: no spraying. HOLD past it', 3.6, true);
      if (s.look === 'phone' && s.pace) hintOnce('phone', 'He paces. Pass where he just left', 3.6, true);
      if (s.dogLane != null) hintOnce('dog', 'The leash blocks two lanes. Take the third', 3.6, true);
      if (s.ring) hintOnce('ringer', 'Smoke rings! Tap to pop, or sprint through', 3.8, true);
      if (s.look === 'commuter') hintOnce('commuter', 'Commuters are fast. Change lanes early', 3.2, true);
      if (s.chef) hintOnce('chef', 'White steam is harmless. Grey smoke isn’t', 3.6, true);
      if (s.big) hintOnce('granny', 'Big slow puffs. Take a full breath first', 3.4, true);
    }
    if (g.bubbles.some(b => !b.got && b.x - p.x < 260 && b.x > p.x)) hintOnce('bubble', 'Air bubbles! Run into them for air', 3.4, true);
    for (const f of g.refills) if (g.water < g.k.water && f.x - p.x < 260 && f.x > p.x) hintOnce('refill', 'Run past the blue REFILL for water', 3.2);
  }

  /* ---------- 主循环 ---------- */
  let runM = null, runMT = 0;      // 这一局底部盯着的任务、它做完以后又过了几秒
  const ui = { hint: null, touch: false, calm: CALM }, AMB = { sidewalk: 'city', office: 'city', park: 'park', rooftop: 'roof', subway: 'subway' };
  let stepN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!g) return;
    const raw = (now - last) / 1000, dt = Math.min(.05, raw > 0 ? raw : .016); last = now;      // 时间不许倒着走
    if (mode === 'play' && raw < .2) {
      pfA += raw; pfN++;
      // 试玩记录：这一局平均一帧多少毫秒、卡了几下（2026-11-16：电脑上量到个别帧 30 到 80 毫秒，查不出是什么，要在手机上看）
      runStat.fr++; runStat.frT += raw; if (raw > .05) runStat.hitch++;
      // 老手机跑不动（60 帧平均一帧超过 24 毫秒）：画布降一档清晰度。降的那一下要重建画布、清晰度一跳，
      // 所以不在跑的半路降，等下一个街区横幅闪白光、暂停、或者下一局开跑时再降；实在太卡（超过 40 毫秒）才当场降（2026-11-15）
      if (pfN >= 60) { const a = pfA / pfN; if (a > .024) lowQ = true; if (a > .04) lowerNow(); pfA = pfN = 0; }
    }
    const demo = g.demo && (mode === 'title' || mode === 'gear');
    if (demo) {
      // 主页背后的实机演示
      g.viewH = VH; stepDemo(g, dt); demoEvents();
      demoT += dt; if (demoT > 4) { if (g.p.x - demoX < 60) g.over = 'stuck'; demoX = g.p.x; demoT = 0; }
      if (g.over || g.t > 150) { R.clearFx(); g = demoGame(); }
    } else if (mode === 'play') {
      g.viewH = VH;
      // 调试用的自动驾驶负责走位和憋气；手动点的那一下照样算数
      const mine = readInput(), inp = H.debug.bot != null && window.HYB_BOT ? Object.assign(window.HYB_BOT(H, g, H.debug.bot), mine.shot ? { shot: mine.shot } : null) : mine;
      H.step(g, dt, inp);
      // 冲过自己的最好成绩：金色大字、彩带、一声，顶上的米数变金色（render.js 的 R.best）
      if (R.best && !R.best.passed && g.p.x >= R.best.x) {
        R.best.passed = true; const p = g.p;
        R.say(L(R.best.daily ? 'TODAY’S BEST!' : 'NEW BEST!'), p.x + 30, R.yOf(p.z, 130), 26, '#ffd23f', 1.4, 'big');
        R.confetti(p.x + 10, R.yOf(p.z, 90), 70); Snd.win();
      }
      // 死里逃生：大烟雾都贴到背上了（35 以内），3 秒内又被甩开到 120 以外。金色大字、加 10 金币，15 秒内不再喊。
      // 量的：普通玩家大约 3 分钟一次，12 局里 7 局有；高手几乎碰不到（2026-11-15）
      if (g.smog.awake && !g.intro && !g.locked) {
        if (g.smog.gap < 35) nearAt = g.t;
        if (g.t - nearAt < 3 && g.smog.gap > 120 && g.t - closeAt > 15) {
          closeAt = g.t; nearAt = -99; g.coinsGot += 10; const p = g.p;
          R.say(L('CLOSE CALL!'), p.x + 30, R.yOf(p.z, 140), 22, '#ffd23f', 1.2, 'big'); R.say(L('+10 coins'), p.x + 30, R.yOf(p.z, 112), 12, '#fff', 1, 'good'); Snd.star(3);
        }
      }
      if (playTapAt && !g.intro && ctrlSecs == null && playTapAt > 0) { ctrlSecs = Math.round((performance.now() - playTapAt) / 100) / 10; playTapAt = -1; }      // 从点 PLAY 到能操作
      proximityHints();
      // 底部操作区右边放的任务进度：算上这一局（累计的任务也是：以前几局的加这一局的），选离做完最近的那个，跑着跑着进度条会往前走
      /* 底部的任务：一局里盯住同一个，做完了留 2 秒（满格、绿的）再换下一个。原来每半秒重挑「离做完最近的」，跑着跑着字就在两个任务之间跳（2026-11-16） */
      mT -= dt; if (mT <= 0) {
        mT = .5; const sc = H.score(g); checkMissions(sc);
        if (!seen.stall && g.coins.some(c => c.kind === 'stall' && !c.got && c.x > g.p.x && c.x - g.p.x < 320)) hintOnce('stall', 'Stalls! Run through one. It lasts all run', 3.4);
        if (runM && runM.done) runMT += .5;
        if (!runM || !meta.missions.includes(runM) || runMT > 2) { runM = meta.missions.filter(m => !m.done).sort((a, b) => missionValue(b, sc) / b.n - missionValue(a, sc) / a.n)[0] || null; runMT = 0; }
        ui.mission = runM ? { s: MISSIONS[runM.t].text(runM.n), v: runM.done ? runM.n : missionValue(runM, sc), n: runM.n, lab: progText(runM, runM.done ? runM.n : missionValue(runM, sc), ' / ') } : { s: L('All 3 missions done!'), v: 1, n: 1, all: true };      // 三个都做完了：写跑完这一局升级（原来这时候底部又变回操作说明）
        // 每日挑战：底部盯今天的距离目标（250、500、900 米），跑过一个当场说一声（2026-11-16，原来底部还是平常的任务，跑过目标也没动静，到结算才知道）
        if (runDaily) {
          const ds = dailyState(daily());
          for (let i = Math.max(ds.got, dailyHit); i < DAILY_GOALS.length && sc.dist >= DAILY_GOALS[i][0]; i++) { dailyHit = i + 1; hint = { s: L('★ Daily goal: {m} m! +{c} coins at the end', { m: DAILY_GOALS[i][0], c: DAILY_GOALS[i][1] }), t: 3, life: 3 }; Snd.star(2); }
          const i = Math.max(ds.got, dailyHit);
          ui.mission = i < DAILY_GOALS.length ? { head: L('★ DAILY GOAL'), s: L('Run {m} m today', { m: DAILY_GOALS[i][0] }), v: sc.dist, n: DAILY_GOALS[i][0], lab: L('{d} / {m} m · +{c} coins', { d: sc.dist.toLocaleString(), m: DAILY_GOALS[i][0], c: DAILY_GOALS[i][1] }) }
            : { head: L('★ DAILY GOAL'), s: L('All daily goals done!'), v: 1, n: 1, lab: L('Coins at the end of the run') };
        }
      }
      // 音乐的拍子给游戏用（docs/22 的 D）：烟民按拍子喷烟；音乐关着（静音）也照样有拍子，只是听不见
      g.beat = Snd.beatClock ? Snd.beatClock() : null; ui.beat = g.beat;
      handleEvents();
      // 气圈上的那道白线（docs/22 的 A 第三版）：第一段浓烟有自己的提示，从第二段起第一次看到这道线时说一句
      /* 任务完成的那一句排队说（2026-11-16）：原来直接盖掉屏幕上的提示，第一局「Clean air! Let go to breathe」那一步教学刚出来就被盖掉；
       * 两个任务同时完成，前一个也看不到。等教学和别的提示放完再出 */
      if (smogCard && g.smog.awake && g.smog.gap < 200 && !tutorialUp()) { smogCard = false; seen.smog = 1; R.card(L('THE BIG SMOG'), L(TOUCH ? 'It’s behind you. HOLD to sprint away' : 'It’s behind you. Hold SPACE to sprint away')); Snd.smog(); R.shake(5); }
      if (toastQ.length && !tutorialUp() && !(hint && hint.t > .3)) { const q = toastQ.shift(); hint = { s: q.s, t: q.life || 3, life: q.life || 3 }; if (q.star) Snd.star(2); }
      { const A = g.airNeed; if (A && A.d > 60 && seen.haze && !(hint && hint.t > 0) && !g.locked) hintOnce('need', g.p.breath < A.t ? 'Red on your ring: not enough air for this smoke. Breathe first!' : 'The white mark on your ring: air this smoke needs', 3.6, true); }
      // 道具还剩 1.5 秒：叫一声，人身上那圈闪起来（render.js），泡泡在烟里突然没了就呛，要提前知道
      if (g.power && g.power.t < 1.5 && !g.power.warned) { g.power.warned = true; Snd.tick(); }
      // 憋气时的心跳：气越少跳得越快。大烟雾逼近时音乐加快
      if (g.p.holding) { beatT -= dt; if (beatT <= 0) { const u = g.p.breath / g.k.breath; beatT = .3 + .42 * u; Snd.beat(1 - u); } }
      Snd.fast(g.smog.awake && g.smog.gap < 110);
    } else if (mode === 'ending') {
      endT -= dt; if (endT <= 0) askRevive();
    } else if (mode === 'over') {
      stepOver(dt);
    } else if (mode === 'revive') {
      const was = Math.ceil(reviveT); reviveT -= dt; if (Math.ceil(reviveT) !== was && reviveT > 0) Snd.tick();
      $('bNoRevive').textContent = L('No thanks ({n})', { n: Math.max(0, Math.ceil(reviveT)) });
      if (reviveT <= 0) showOver();
    }
    // 同一时间只出一块字：横幅（新街区、老板、大烟雾来了）挂着的时候，提示先等着，横幅走了再出（第一局开头两块字叠在一起，2026-11-15）
    const banner = R.cardUp();
    if (mode !== 'paused') { R.stepFx(dt); if (hint && !banner) {
      if (hint.until && !hint.until()) {
        hint.held = (hint.held || 0) + dt;
        if (hint.held < TUTOR_WAIT) hint.t = Math.max(hint.t, 1);
        else { if (hint.step) hint.step.skip = true; hint.until = null; hint.life = 9; }      // 等够了：变回普通提示，一秒内淡掉
      } else hint.t -= dt;
    } }
    ui.hint = banner ? null : hint; ui.touch = TOUCH; ui.lift = demo ? LIFT : 0; ui.help = runs < 4;      // 头四局底部写操作说明，之后写任务
    Snd.growl(mode === 'play' && g.smog.awake ? H.clamp(1 - g.smog.gap / 150, 0, 1) : 0);
    Snd.amb(mode === 'play' ? AMB[g.stop.id] || 'city' : null);
    Snd.rain(mode === 'play' ? R.rainLevel() : 0);      // 雨天的雨声，跟着画面上的雨起落
    if (mode === 'play') {
      // 脚步：走路循环每过半圈一下。踩着滑板、被撞停的时候没有
      const sn = Math.floor(g.p.walk / 4);
      if (sn !== stepN && g.p.v > 20 && !(g.power && g.power.kind === 'skate')) Snd.step(sn & 1);
      stepN = sn;
    }
    R.frame(g, mode === 'paused' ? 0 : dt, mode, ui);
  }

  function boot() {
    muteLabel(); fit();
    // 主页的标题字和四个图标是美术画的图
    $('tLogo').src = H.MANIFEST.images.logo;
    for (const el of document.querySelectorAll('[data-img]')) el.src = H.MANIFEST.images[el.dataset.img];
    // 帽子：图标用棒球帽；旧存档该有的帽子补上（拿过星、任务等级够了）；头上戴着的那顶交给画面
    if (HATS.length) $('tHatImg').src = H.HATS.icon || H.HATS.hats['hat-baseball'].file; else $('bHats').hidden = true;      // 图标是第十六批画的（docs/19）
    grantHats(); R.hat = wornHat();
    // 在系统设置里关掉了通知：不再排提醒
    if (window.hybRemind && meta.remindOn) window.hybRemind.status().then(st => { if (st !== 'authorized' && st !== 'provisional') { meta.remindOn = false; saveMeta(); } });
    $('bHats').addEventListener('click', () => { Snd.init(); Snd.open(); hatSel = null; showHats(); });
    $('hGrid').addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-hat]'); if (!b) return; Snd.click(); hatSel = b.dataset.hat; showHats(); });
    $('bHatGo').addEventListener('click', hatGo);
    $('bLog').addEventListener('click', () => { Snd.click(); showLog(); });
    $('bLogClose').addEventListener('click', () => { Snd.click(); $('log').hidden = true; });
    $('bLogCopy').addEventListener('click', () => { Snd.click(); const t = logText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { $('bLogCopy').textContent = L('Copied'); }, () => { $('bLogCopy').textContent = L('Select the text to copy'); }); });
    $('bLogClear').addEventListener('click', () => { if ($('bLogClear').dataset.sure !== '1') { $('bLogClear').dataset.sure = '1'; $('bLogClear').textContent = L('Tap again to clear'); return; } runLog = []; store.set(LOG_KEY, '[]'); $('bLogClear').dataset.sure = ''; $('bLogClear').textContent = L('Clear'); showLog(); });
    $('bHatsClose').addEventListener('click', () => { Snd.click(); $('hats').hidden = true; showMeta(); });
    // 最下面那行排查声音用的小字平时不显示，连点五下「How to play」这个标题才出来
    let diagN = 0;
    /* 怎么玩：五行，每行一张小图、一句话（2026-11-16）。原来是五段大字，手机上也写着 SPACE、↑ ↓ 键，
     * 「一口气大约 4 秒」也和升级页写的 4.5 秒对不上：秒数现在照着肺活量的等级算 */
    const howList = () => {
      const T = TOUCH, sec = (CFG.BREATH + CFG.LUNG_UP * (meta.up.lungs || 0)).toFixed(1).replace(/\.0$/, '');
      const rows = [
        ['assets/ui/upgrade-lungs.png', L('Hold your breath'), L(H.rules === 'dash' ? '{how}: smoke can’t hurt you, for {s} s. Inside smoke you go TURBO.' : H.rules === 'breath' ? '{how}: smoke can’t hurt you, for {s} s.' : '{how}: smoke can’t hurt you and you sprint, for {s} s.', { how: L(T ? 'Hold the left side of the screen' : 'Hold SPACE'), s: sec })],
        ['assets/props/air-grate-0.png', L('Let go in clean air'), L('Air comes back outside the smoke or on an AIR grate. Let go right as you clear the smoke: PERFECT!')],
        [artSrc('hud-smog'), L('Stay ahead of the Big Smog'), H.rules === 'dash' ? L('People step aside. Things (benches, bins, fences, scooters) trip you and it jumps closer; if it’s already that close, it gets you.')
          : L('Bump into things and it jumps closer; bump while you can see it and it gets you. ') + L(H.rules === 'breath' ? 'Hold your breath through smoke to blow it back.' : 'Pass close to smokers on one breath to blow it back.')],
        [artSrc('hud-leo'), L(T ? 'Swipe up or down' : 'Press ↑ or ↓'), L('Change lanes, one lane at a time.')],
        [artSrc('item-soaker'), L(T ? 'Tap a smoker' : 'Click a smoker'), L('Spray the cigarette out, or punch a hole in a cloud. Hit the glowing ring for a free shot.')]
      ];
      $('howList').innerHTML = rows.map(([src, b, t]) => `<li><img src="${src}" alt=""><div><b>${b}</b><span>${t}</span></div></li>`).join('');
    };
    const how = () => {
      Snd.init(); Snd.open(); diagN = 0; $('diag').textContent = ''; howList(); $('how').hidden = false;
    };
    // t= 后面是声音引擎的时钟：再点一下标题，数字变大了说明引擎在跑
    $('howHead').addEventListener('click', () => {
      if (++diagN < 5) return;
      if (diagN === 5) { tester = !tester; store.set('hyb3-tester', tester ? '1' : '0'); testerUI(); Snd.click(); }
      $('diag').textContent = `v1.1 · ${H.course ? 'smoke course' : 'old track'} · sound: ${Snd.state} · tester tools ${tester ? 'ON' : 'off'}`;
    });
    /* 设置（2026-11-17）：主页左上角的齿轮。用户说语言藏得太深（原来在暂停菜单和「怎么玩」里，点一下换下一种），
     * 换语言的人很少会在跑的时候换。现在语言、声音、震动、每日提醒、怎么玩、故事、隐私政策都在这一块；主页左上角只剩设置和签到两个圆按钮。
     * 语言直接列出来点（每种语言用它自己的写法），开着的面板当场换字 */
    const langLabel = () => {
      $('sLangs').innerHTML = H.LANGS.map(([k, n]) => `<button class="ghost${k === H.lang ? ' on' : ''}" type="button" data-lang="${k}">${n}</button>`).join('');
    };
    const setLang = l => {
      if (l === H.lang) return;
      Snd.init(); Snd.click(); H.setLang(l);
      langLabel(); muteLabel(); buzzLabel(); remindLabel(); testerUI(); drawTunes(); showMeta();
      if (!$('how').hidden) howList();
      if (meta.remindOn) scheduleRemind();      // 已经排好的提醒按新语言重写
    };
    $('sLangs').addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
    // 每日提醒：原来只能在第一次领完签到时答应一次，之后没地方关、也没地方再打开
    const remindLabel = () => { $('sRemind').hidden = !window.hybRemind; $('sRemind').innerHTML = `<span class="sl">${ICON.clock}${L('Daily reminder')}</span>`; $('sRemind').classList.toggle('on', !!meta.remindOn); };
    $('sRemind').addEventListener('click', () => {
      Snd.click();
      if (meta.remindOn) { meta.remindOn = false; meta.remindAsked = true; saveMeta(); window.hybRemind.cancel('daily'); remindLabel(); return; }
      window.hybRemind.ask().then(ok => { meta.remindOn = ok; meta.remindAsked = true; saveMeta(); scheduleRemind(); remindLabel(); });
    });
    const settings = () => {
      Snd.init(); Snd.open(); langLabel(); muteLabel(); buzzLabel(); remindLabel(); $('settings').hidden = false;
      // 欧洲、英国的玩家要能随时改广告的同意：这个按钮只在需要时露出来
      $('bAdChoices').hidden = true;
      if (window.hybAds) window.hybAds.privacyRequired().then(need => { $('bAdChoices').hidden = !need; });
    };
    langLabel();
    $('bSettings').addEventListener('click', settings);
    $('bSetClose').addEventListener('click', () => { Snd.click(); $('settings').hidden = true; });
    $('sHow').addEventListener('click', how);      // 「怎么玩」盖在设置上面，点「知道了」回到设置
    $('bHowClose').addEventListener('click', () => { Snd.click(); $('how').hidden = true; });
    $('bHowPause').addEventListener('click', how);
    $('bPolicy').addEventListener('click', () => { Snd.click(); $('policyFrame').src = 'privacy.html'; $('policy').hidden = false; });
    $('bPolicyClose').addEventListener('click', () => { Snd.click(); $('policy').hidden = true; });
    $('bAdChoices').addEventListener('click', () => { Snd.click(); if (window.hybAds) window.hybAds.privacyForm(); });
    addEventListener('resize', fit);
    addEventListener('orientationchange', () => setTimeout(fit, 250));
    // WebKit may update the safe-area padding after the initial viewport layout.
    if (document.documentElement.classList.contains('hyb-ios')) new ResizeObserver(fit).observe(stage);
    R.load(p => { $('loadBar').style.width = (p * 100).toFixed(0) + '%'; }).then(() => { bootSecs = Math.round(performance.now() / 100) / 10; track('boot', { secs: bootSecs }); Snd.load(); toTitle(); setTimeout(R.loadLater, 400); });
    requestAnimationFrame(frame);
  }
  // 调试用：H.debug.bot = 0（高手）/ 1（普通）/ 2（新手）并载入 tools/bot.js，游戏就自己玩
  // tick(秒)：不等浏览器的动画帧，直接往前推这么多秒并画出来。预览窗口不在前台时浏览器不给动画帧，测试靠它
  H.debug = { get g() { return g; }, get mode() { return mode; }, begin: o => start(o || {}), bot: null, tick(secs) { let t = last; for (let i = 0; i < secs * 60; i++) { t += 1000 / 60; frame(t); } } };
  boot();
})();
