/* 环球躲烟 · 画面（侧视角；只读游戏状态，鸽子、路上的车这类纯装饰自己记状态）
 * 屏幕从上到下：天空和天际线 → 一排店面 → 三条道的人行道 → 路缘和马路 → 操作区。
 */
(function () {
  'use strict';
  const H = HYB, M = H.MANIFEST, CFG = H.CFG, clamp = H.clamp;
  const W = H.W, DZ = H.DZ;
  const U = M.unit / M.k;            // 帧格像素 → 世界单位
  const CW = M.cell[0], CH = M.cell[1], AX = M.anchor[0], AY = M.anchor[1];
  const C = {
    ink: '#1c2230', paper: '#f7f8f5', sky: '#a9e4ee', water: '#1c9bf0', nic: '#e3b505', alarm: '#f0433a', go: '#2fbf71',
    slate: '#2b3140', muted: '#5d6675', vape: '#7a4bc4'
  };
  const FONT = '"Arial Rounded MT Bold","Nunito","Avenir Next","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,-apple-system,"Segoe UI",sans-serif';      // 中文字落到苹方（英文字母和数字照旧是圆体）
  const L = (s, v) => (H.L ? H.L(s, v) : s);      // 多语言（js/i18n.js）
  // 两行字的断点：英文在空格处，中文每两个字之间（i18n.js 的 splits）
  const splits = t => H.splits ? H.splits(t) : t.split(' ').map((_, i, w) => [w.slice(0, i).join(' '), w.slice(i).join(' ')]).slice(1);
  const IMG = {};
  const R = H.R = { C, FONT, IMG };
  const TAU = 6.2832, LY = 58;        // LY：每条道在画面上的高度（只管画面，逻辑里的道宽不变）

  /* ---------- 载入 ---------- */
  R.load = function (onProgress) {
    const list = [];
    for (const [k, v] of Object.entries(M.sheets)) list.push(['s:' + k, v.file]);
    for (const [k, v] of Object.entries(M.props)) list.push(['p:' + k, v.file]);
    /* M.images 里画布只用道具（item-*）和顶栏小头像（hud-*）；别的（开场对话的半身像、明信片、开场插图、装备卡、印章、标题字……）
     * 是网页界面用 <img> 显示的，不用等它们加载完才进主页。主页出来以后再在后台加载（R.loadLater），用到时已经在缓存里了。
     * 原来全部 16 MB 加载完才进主页，其中这些约 4.7 MB（2026-11-16） */
    const later = [];
    for (const [k, v] of Object.entries(M.images)) (/^(item-|hud-|icon-|city-|logo$)/.test(k) ? list.push(['i:' + k, v]) : later.push(v));      // 主页上就看得到的小图标、标题字照样先加载
    const first = v => /\/(scene-|bust-)/.test(v) ? 0 : /\/postcard-/.test(v) ? 1 : 2;      // 第一次点 PLAY 紧接着是开场对话：插图和半身像先来，然后结算的明信片
    R.later = later.sort((a, b) => first(a) - first(b));
    for (const [st, L] of Object.entries(M.bg || {})) for (const [k, v] of Object.entries(L)) list.push([`bg:${st}:${k}`, v.file]);
    for (const [k, v] of Object.entries((H.HATS || {}).hats || {})) list.push(['h:' + k, v.file]);      // 帽子（js/hats.js）
    for (const [k, v] of Object.entries((H.BOSSFIT || {}).shades || {})) list.push(['b:' + k, v.file]);      // 老板的墨镜（js/bossfit.js）
    let done = 0;
    return Promise.all(list.map(([key, src]) => new Promise(res => {
      const im = new Image();
      im.onload = im.onerror = () => { done++; onProgress && onProgress(done / list.length); res(); };
      im.decoding = 'async'; im.src = src; IMG[key] = im;
    })));
  };

  // 主页出来以后，慢慢把只给网页界面用的图加载进缓存：一张接一张，不和跑的时候抢
  R.loadLater = function () {
    const L = (R.later || []).slice(); R.later = [];
    const next = () => { const src = L.shift(); if (!src) return; const im = new Image(); im.onload = im.onerror = () => setTimeout(next, 30); im.decoding = 'async'; im.src = src; };
    next();
  };

  /* ---------- 画布与缩放 ---------- */
  let cv, c, S = 1, VH = 780, DPR = 1, QUAL = 2, GT = 450;
  let safeTop = 0, safeBottom = 0;
  const WH = LY * 3, RD = 82;                 // 人行道三条道的总高度、马路图条高度
  const laneY = z => GT + LY / 2 + z * LY;
  const dsc = z => .9 + .05 * clamp(z, -1.5, 3.5);
  R.yOf = (z, h) => laneY(z) - (h || 0) * dsc(z);
  R.init = function (canvas) { cv = canvas; c = cv.getContext('2d', { alpha: false }); };
  R.fit = function (app, stage, touch) {
    const r = app.getBoundingClientRect(), vw = r.width || 360, vh = r.height || 640;
    if (vh / vw >= 1.6 || (touch && vh / vw >= 1.3)) { S = vw / W; VH = Math.min(980, vh / S); }
    else { VH = 780; S = vh / VH; if (S * W > vw) { S = vw / W; VH = Math.max(600, vh / S); } }
    const style = getComputedStyle(stage);
    safeTop = parseFloat(style.paddingTop) / S;
    safeBottom = parseFloat(style.paddingBottom) / S;
    GT = Math.round(VH - safeBottom - 348);    // 人行道放大后高约 244，下面给马路和两个拇指留 104
    DPR = Math.min(window.devicePixelRatio || 1, QUAL);
    stage.style.width = (W * S) + 'px'; stage.style.height = (VH * S) + 'px';
    document.documentElement.style.setProperty('--u', S + 'px');
    cv.width = Math.round(W * S * DPR); cv.height = Math.round(VH * S * DPR);
    FC.width = cv.width; FC.height = cv.height;      // 画烟用的，和画布一样大
    return { S, VH };
  };
  R.lowerQuality = function () { if (QUAL > 1.5) { QUAL = 1.5; return true; } return false; };

  /* ---------- 小工具 ---------- */
  const perf = () => performance.now();
  function rr(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function circ(x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function ell(x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot || 0, 0, TAU); }
  function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { const A = hex(a), B = hex(b); t = clamp(t, 0, 1); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
  function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function label(s, x, y, size, col, bg, weight) {
    c.font = `${weight || 800} ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = size * .28; c.strokeStyle = bg || '#fff'; c.lineJoin = 'round'; c.strokeText(s, x, y); c.fillStyle = col || C.ink; c.fillText(s, x, y);
  }
  function inkFill(fill, lw) { c.fillStyle = fill; c.fill(); c.strokeStyle = C.ink; c.lineWidth = lw || 2; c.stroke(); }
  function sheetImg(im, frame, x, y, scale, flip, alpha) {
    if (!im || !im.width) return;
    const s = U * (scale || 1), w = CW * s, h = CH * s;
    c.save(); c.translate(x, y);
    if (flip) c.scale(-1, 1);
    if (alpha != null && alpha < 1) c.globalAlpha = Math.max(0, alpha);
    c.drawImage(im, frame * CW, 0, CW, CH, -AX * s, -AY * s, w, h);
    c.restore();
  }
  const sheet = (name, frame, x, y, scale, flip, alpha) => sheetImg(IMG['s:' + name], frame, x, y, scale, flip, alpha);
  /* 帽子（docs/16）：tools/hat_fit.py 量好了 Leo 每张图每一帧头顶在哪、歪多少度，帽子画在和这一帧同一个坐标系里，跟着头走、跟着头歪。
   * 帽子图画多大、对准哪一点都写在 js/hats.js 里（帧格像素）；第十六批是照着 Leo 重画的、和走路第 0 帧对齐的整张帽子层。R.hat 是现在戴的那顶，没戴是 null */
  R.hat = null;
  function hatOn(name, frame, x, y, scale, flip, alpha, id) {
    const HS = H.HATS, hid = id || R.hat; if (!HS || !hid) return;
    const P = HS.pose[name], h = HS.hats[hid], im = IMG['h:' + hid]; if (!P || !P[frame] || !h || !im || !im.width) return;
    const [hx, hy, deg] = P[frame], s = U * (scale || 1);
    c.save(); c.translate(x, y); if (flip) c.scale(-1, 1);
    if (alpha != null && alpha < 1) c.globalAlpha = Math.max(0, alpha);
    c.translate((hx - AX) * s, (hy - AY) * s); c.rotate(-deg * Math.PI / 180);
    c.drawImage(im, -h.ax * s, -h.ay * s, h.w * s, h.h * s);      // w/h/ax/ay 都是帧格像素（tools/hat_fit.py）
    c.restore();
  }
  /* 雪茄老板按天换样子（docs/17）：第 2 天戴黑墨镜，第 3 天起戴金墨镜、身边一圈金光。
   * tools/boss_fit.py 量好了老板每张图每一帧眼睛在哪、头歪多少度，墨镜画在和这一帧同一个坐标系里 */
  function bossShades(name, frame, x, y, scale, alpha, day) {
    const BF = H.BOSSFIT, id = day >= 2 ? 'shades-gold' : 'shades-black'; if (!BF || day < 1) return;
    const P = BF.pose[name], sh = BF.shades[id], im = IMG['b:' + id]; if (!P || !P[frame] || !sh || !im || !im.width) return;
    const [ex, ey, deg] = P[frame], s = U * (scale || 1);
    c.save(); c.translate(x, y); if (alpha != null && alpha < 1) c.globalAlpha = Math.max(0, alpha);
    c.translate((ex - AX) * s, (ey - AY) * s); c.rotate(-deg * Math.PI / 180);
    c.drawImage(im, -sh.ax * s, -sh.ay * s, sh.w * s, sh.h * s);
    c.restore();
  }
  // 第 3 天起的老板：身后一圈慢慢转的金光，几颗闪光绕着他转
  function bossAura(x, y, k) {
    const t = perf() * .001, cy = y - 58 * k, r = 62 * k;
    const gr = c.createRadialGradient(x, cy, r * .2, x, cy, r);
    gr.addColorStop(0, 'rgba(255,196,50,.62)'); gr.addColorStop(.6, 'rgba(255,176,30,.3)'); gr.addColorStop(1, 'rgba(255,176,30,0)');      // 人行道颜色浅，淡了看不出来
    c.fillStyle = gr; circ(x, cy, r); c.fill();
    for (let i = 0; i < 5; i++) {
      const a = t * 1.3 + i * TAU / 5, sx = x + Math.cos(a) * r * .8, sy = cy + Math.sin(a) * r * .55, tw = .5 + .5 * Math.sin(t * 6 + i * 2);
      c.save(); c.translate(sx, sy); c.rotate(Math.PI / 4); c.fillStyle = `rgba(255,214,60,${.7 + .3 * tw})`;
      const z = (4.5 + 3 * tw) * k; c.fillRect(-z / 2, -z / 2, z, z); c.strokeStyle = C.ink; c.lineWidth = 1.4; c.strokeRect(-z / 2, -z / 2, z, z); c.restore();
    }
  }
  // 画 Leo 的一帧，戴着帽子就顺手把帽子画上
  const pSheet = (name, frame, x, y, scale, flip, alpha) => { sheet(name, frame, x, y, scale, flip, alpha); hatOn(name, frame, x, y, scale, flip, alpha); };
  /* 帽子页的舞台（main.js 的 hatStage，2026-11-21）：在另一块小画布上画一个戴着帽子走路的 Leo，用的是跑的时候同一套走路图和帽子对位。
   * scale 是相对游戏里的大小；(x, y) 是脚底中点，画布坐标。hid 是要戴的帽子，空的就不戴 */
  // fitH：从脚底到最高那顶帽子顶上一共多少像素。大小按 12 顶里最高的那顶（螺旋桨帽，比头顶还高 16 个帧格像素）定，每顶都放得下，换帽子时 Leo 不会忽大忽小
  // （2026-11-21 用户：有些帽子太高，超出上面的展示框）
  let miniTop = null;
  R.miniLeo = function (ctx, frame, x, y, fitH, flip, hid) {
    if (miniTop == null) { const HS = H.HATS, P = HS && HS.pose['player-side-walk-full']; miniTop = 0; if (P) for (const h of Object.values(HS.hats)) for (const f of P) miniTop = Math.min(miniTop, f[1] + h.bb[1] * h.w / h.iw - h.ay); }
    const keep = c; c = ctx;
    try { const s = fitH / (AY - miniTop) / U; sheet('player-side-walk-full', frame, x, y, s, flip); if (hid) hatOn('player-side-walk-full', frame, x, y, s, flip, 1, hid); }
    finally { c = keep; }
  };
  function propAt(name, cx, by, k, alpha) {
    const P = M.props[name], im = IMG['p:' + name]; if (!P || !im || !im.width) return;
    k = k || 1;
    if (alpha != null) c.globalAlpha = alpha;
    c.drawImage(im, cx - (P.w / 2 + (P.ax || 0)) * k, by - P.h * k, P.w * k, P.h * k);      // ax：对准点比画布中线偏右多少（开着的消防栓右边多出一截水）
    c.globalAlpha = 1;
  }
  // 一格一格的小图（金币转动、鸽子）：每格多大记在清单里（cell 是像素，u 是游戏里的单位）。cx 是格子的中线，by 是格子的底边
  function cellAt(name, frame, cx, by, flip, alpha) {
    const A = M.sheets[name], im = IMG['s:' + name]; if (!A || !im || !im.width) return;
    const cw = A.cell[0], ch = A.cell[1], u = A.u, h = u * ch / cw;
    c.save(); c.translate(cx, by); if (flip) c.scale(-1, 1);
    if (alpha != null && alpha < 1) c.globalAlpha = Math.max(0, alpha);
    c.drawImage(im, frame * cw, 0, cw, ch, -u / 2, -h, u, h);
    c.restore();
  }
  function shadow(x, y, rx, a) { c.fillStyle = `rgba(28,34,48,${a || .2})`; ell(x, y, rx, rx * .3); c.fill(); }
  const SHADE = (() => { const s = document.createElement('canvas'); s.width = s.height = 64; const x = s.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(52,46,70,1)'); gr.addColorStop(.6, 'rgba(52,46,70,.55)'); gr.addColorStop(1, 'rgba(52,46,70,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return s; })();

  /* ---------- 天空、天际线 ---------- */
  const SKY = {
    sidewalk: ['#9fdcf0', '#e6f6fa'], office: ['#a8d8ee', '#eaf4f8'], park: ['#9fe0e8', '#eefaf0'],
    rooftop: ['#ffb38a', '#ffe6c4'], subway: ['#8e9fd6', '#e9d6ee']
  };
  function bgImg(g, layer) { const im = IMG[`bg:${g.stop.id}:${layer}`]; return im && im.width ? im : null; }
  /* 横向循环贴一条图：par 是视差速度。
   * 每一张的左右边按屏幕像素对齐，后一张压住前一张一个像素，接缝处不露缝。
   * 原来是 Math.floor 到游戏里的整格：放大以后一格是两三个屏幕像素，跑快了每帧挪 2 格、3 格交替，
   * 脚下的地面相对人物一抖一抖，远处的楼一步一步地跳（2026-11-15，「快速移动的时候是否会卡顿」） */
  function pxGrid() { const T = c.getTransform ? c.getTransform() : null; return T ? [T.a, T.e] : [1, 0]; }
  const snapX = (x, q, e) => (Math.round(e + x * q) - e) / q;
  function tile(im, x, w, y, h, q, e) { const a = snapX(x, q, e); c.drawImage(im, 0, 0, im.width, im.height, a, y, snapX(x + w, q, e) - a + 1 / q, h); }
  function strip(im, y, h, par, cx) {
    const w = im.width * h / im.height, off = ((cx * par) % w + w) % w, [q, e] = pxGrid();
    for (let x = -off; x < W; x += w) tile(im, x, w, y, h, q, e);
  }
  // 同上，但是 A、B 两张首尾相接，按 A、B、A、B 排下去（天际线用）
  function strip2(a, b, y, h, par, cx) {
    const wa = a.width * h / a.height, wb = b.width * h / b.height, w = wa + wb, off = ((cx * par) % w + w) % w, [q, e] = pxGrid();
    for (let x = -off; x < W; x += w) {
      if (x + wa > 0) tile(a, x, wa, y, h, q, e);
      if (x + wa < W) tile(b, x + wa, wb, y, h, q, e);
    }
  }
  function drawSky(g) {
    const fa = bgImg(g, 'skyline-far-a'), fb = bgImg(g, 'skyline-far-b'), na = bgImg(g, 'skyline-near-a'), nb = bgImg(g, 'skyline-near-b'), st = g.stop.street;
    const q20 = v => Math.round(v * 20) / 20, dq = q20(dusk), aq = q20(dawn), rq = q20(rain), key = g.stop.id + ':' + GT + ':' + DPR + ':' + S + ':' + dq + ':' + aq + ':' + rq;      // 傍晚、黎明、雨天的天色烤进天空这张缓存图（换天时慢慢变，每 5% 重烤一次）
    if (skyKey !== key) bakeSky((M.sky && M.sky[g.stop.id]) || (SKY[g.stop.id] || SKY.sidewalk)[0], key, dq, aq, rq);
    c.drawImage(SKYC, 0, 0, SKYC.width, SKYC.height, 0, 0, W, GT + 2);
    clouds(g);
    if (fa && fb && na && nb) {
      // 远近两层楼群各自慢慢滚，按原图大约 2/3 的比例画：线条比前景的店面细，楼退在远处。
      // 底边按这一站前排有多高来抬。店面那几站：最矮的是巷子（82 高，放大后 115），底边藏在它顶上的后面，不能悬在半空。
      // 原来按最矮的店面（放大后 134）抬到 124：每条巷子顶上和楼群底边之间漏出一截天，看着是一道蓝缝，远处的楼像浮在半空（2026-11-17 用户在手机上看到）
      const base = GT - (st === 'shops' ? 110 : st === 'roof' ? 30 : 6);
      strip2(fa, fb, base - 128, 112, .07, g.camX);      // 远层的底边压在近层的矮楼后面，只露出上半截
      haze(.34);
      strip2(na, nb, base - 140, 140, .2, g.camX);
      // 空气透视：远处的楼蒙一层天色，颜色变淡、对比变弱，街边这一排才跳得出来。不蒙的话三层楼一样鲜艳，叠成一片
      haze(st === 'shops' ? .38 : .24);
    }
  }
  // 把天空再盖一层在已经画好的楼上面：a 越大，楼越淡
  function haze(a) { c.globalAlpha = a; c.drawImage(SKYC, 0, 0, SKYC.width, SKYC.height, 0, 0, W, GT + 2); c.globalAlpha = 1; }
  const SKYC = document.createElement('canvas');
  let skyKey = '';
  /* 天空：上深下浅的渐变，烤成一张图每帧贴。傍晚（d 从 0 到 1）三个色标往晚霞的紫、粉、橙靠。
   * 原来晚霞是每帧在整片天和远处的楼上用 'color' 混合模式盖一层：每个像素都要读回来换算色相，老手机上最费的一步（2026-11-16）。
   * 现在天空图本身就是晚霞色，盖在远处楼群上的那两层天色（空气透视）也跟着是晚霞色，效果一样 */
  const mixHex = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join(''); };
  function bakeSky(col, key, d, a, r) {
    skyKey = key;
    const k = DPR * S, dd = (d || 0) * .62, da = (a || 0) * .6, dr = (r || 0) * .72;
    // 只是上下的渐变，烤成 2 像素宽的一条，贴的时候横着拉满（2026-11-16）：原来和画面一样宽（788×855），每进一个街区、天色每变 5% 重烤一次，
    // 第一次贴上去要 37 到 84 毫秒，正好是跑着跑着卡一下
    const hh = Math.max(1, Math.round((GT + 2) * k));
    if (SKYC.width !== 2 || SKYC.height !== hh) { SKYC.width = 2; SKYC.height = hh; }
    const x = SKYC.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, SKYC.height);
    // 三个色标各自往晚霞（紫、粉、橙）、黎明（浅蓝、桃、浅金）、雨天（灰蓝、灰、浅灰）靠
    const st = (base, du, dw, rn) => mixHex(mixHex(mixHex(base, du, dd), dw, da), rn, dr);
    gr.addColorStop(0, st(mixHex(col, '#5a7fb0', .18), '#7a5cc4', '#a8bce8', '#7f8ea4')); gr.addColorStop(.6, st(col, '#f08880', '#ffc2aa', '#a9b4c3')); gr.addColorStop(1, st(mixHex(col, '#ffffff', .45), '#ffc68a', '#ffe6bf', '#ced5de'));
    x.fillStyle = gr; x.fillRect(0, 0, SKYC.width, SKYC.height);
  }
  function clouds(g) {
    const off = g.camX * .04 + perf() * .004;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 131 - off * (1 + i * .15)) % (W + 160) + W + 160) % (W + 160) - 80, y = GT * (.2 + .1 * (i % 4)), k = .7 + (i % 3) * .2;
      c.fillStyle = rain > .3 ? 'rgba(206,212,222,.92)' : 'rgba(255,255,255,.78)'; for (const [ox, oy, r] of [[0, 0, 18], [18, -6, 22], [38, 2, 16], [18, 6, 18]]) { circ(x + ox * k, y + oy * k, r * k); c.fill(); }      // 雨天的云是灰的
    }
  }

  /* ---------- 后排：店面一家挨一家 ---------- */
  const TILE = /^(front|park|roof|alley)-/;      // 一张接一张拼成一条的背景图：街边的店面和巷子、公园的边、屋顶的后沿
  function drawFacades(g) {
    const cx = g.camX;
    // 屋顶上的东西：画在楼的后面，只有高出屋顶的那一截露出来
    for (const f of g.facades) {
      const x = f.x - cx; if (x > W + 20 || x + f.w < -20) continue;
      if (f.kind === 'prop') roofTop(f, x);
    }
    for (const f of g.facades) {
      const x = f.x - cx; if (x > W + 20 || x + f.w < -20) continue;
      if (f.kind === 'landmark') continue;
      if (f.kind === 'prop' && TILE.test(f.name)) {
        // 店面墙挨着墙（公园、屋顶的背景也一样是一张接一张）：每张往右多画一丝，被下一张盖住，免得两张之间在某些位置露出一条发丝宽的缝
        const P = M.props[f.name], im = IMG['p:' + f.name];
        if (P && im && im.width) c.drawImage(im, x, GT + 2 - P.h, P.w + .5, P.h);
      } else if (f.kind === 'prop' || f.kind === 'dest') {
        propAt(f.name, x + f.w / 2, GT + 2, 1);
      }
    }
    if (g.stop.street === 'shops') streetDecor(g);
    // 立在人行道上的地标（地铁口）：画在楼和路灯的前面
    for (const f of g.facades) {
      if (f.kind !== 'landmark') continue;
      const x = f.x - cx; if (x > W + 20 || x + f.w < -20) continue;
      propAt(f.name, x + f.w / 2, GT + 5, f.w / M.props[f.name].w);
    }
    // 墙根的阴影
    const gr = c.createLinearGradient(0, GT, 0, GT + 16); gr.addColorStop(0, 'rgba(28,34,48,.28)'); gr.addColorStop(1, 'rgba(28,34,48,0)');
    c.fillStyle = gr; c.fillRect(0, GT, W, 16);
  }
  /* 店面屋顶上的东西：水塔、烟囱、楼梯间、空调外机、卫星锅、广告牌（第十批的图）。店面的图顶上是一条平线，
   * 一排平顶接在一起像切出来的；加上这些，屋顶的轮廓才有高有低。按楼的位置固定挑一样，大约三成的楼空着；
   * 图里自己带了屋顶物件的那三栋不加，巷子也不加。画在楼的后面，底边压在屋顶线下面一点。 */
  const OWN_ROOF = ['front-pizza', 'front-bookstore', 'front-garage'];
  /* 洗衣店、熟食店的图顶上自带一个小通风箱（右边四分之三处），真正的屋顶线比图的上沿低 34/491、34/522（约 7.5）。
   * 原来屋顶上的东西都按图的上沿放：这两栋上面的卫星锅、空调底下露一条天，浮在屋顶上（2026-11-17 用户在手机上看到）。
   * 这两栋按真正的屋顶线放，并且只放在左半边，不和自带的通风箱挤在一起 */
  const ROOF_DROP = { 'front-laundromat': 34 / 491, 'front-deli': 34 / 522 };
  const TOPS = ['top-watertower', 'top-chimneys', 'top-stairhouse', 'top-ac', 'top-dish', 'top-billboard'];
  function roofTop(f, x) {
    if (!f.name.startsWith('front-') || OWN_ROOF.includes(f.name)) return;
    const P = M.props[f.name]; if (!P) return;
    const k = Math.round(f.x), pick = (hash(k, 61) * (TOPS.length + 3)) | 0; if (pick >= TOPS.length) return;
    const drop = ROOF_DROP[f.name] || 0, at = drop ? .24 + .16 * hash(k, 9) : .26 + .48 * hash(k, 9);
    propAt(TOPS[pick], x + f.w * at, GT + 2 - P.h * (1 - drop) + 2.5, 1);
  }
  /* 立在人行道后沿的东西（第十批的图）：路灯每隔一段一根，隔一根挂路牌；两根路灯中间按位置固定放一样：
   * 邮筒、报箱、过街信号灯、小树，或者空着。位置由 x 算出来，不占道、不挡路。地铁口前面和补水的消防栓旁边不放。 */
  const BETWEEN = ['street-mailbox', 'street-newsbox', 'street-signal', 'street-tree', null, 'street-mailbox', null, 'street-newsbox', null];
  const LAMPS = [];      // 这一帧画了的路灯灯头（晚上要点亮，见 drawDayLight）
  /* 邮筒、报箱、信号灯、小树立在两栋楼交界的那段墙前面。原来按固定间隔摆、不看后面是什么，
   * 常常正好挡在门口、压在巷子里的猫和纸箱上、贴着栏杆（2026-11-15）。两边都得是店面的楼（巷子口不放），离得最近的那条交界线 40 以内才放，没有就空着 */
  const lampX = i => i * 118 + 30 + hash(i, 5) * 46;
  function joinNear(g, wx) {
    let best = null;
    for (let j = 1; j < g.facades.length; j++) {
      const a = g.facades[j - 1], b = g.facades[j];
      if (Math.abs(b.x - wx) > 40 || a.kind !== 'prop' || b.kind !== 'prop' || !a.name.startsWith('front-') || !b.name.startsWith('front-') || Math.abs(a.x + a.w - b.x) > 1) continue;
      if (best == null || Math.abs(b.x - wx) < Math.abs(best - wx)) best = b.x;
    }
    return best;
  }
  function streetDecor(g) {
    const GAP = 118, cx = g.camX, lamp = M.props['street-lamp']; if (!lamp) return;
    const blocked = wx => g.facades.some(f => f.kind === 'landmark' && wx > f.x - 22 && wx < f.x + f.w + 22) || g.refills.some(f => Math.abs(f.x - wx) < 34) || g.shelters.some(s => wx > s.x0 - 40 && wx < s.x1 + 40);
    for (let i = Math.floor((cx - 60) / GAP); i * GAP - cx < H.VW + 60; i++) {
      const wx = lampX(i), x = wx - cx;
      if (blocked(wx)) continue;
      // 路灯的杆子在画布宽度的 61/200 处，不在正中
      if (i % 2 === 0) { propAt(i % 4 === 0 ? 'street-lamp-sign' : 'street-lamp', x + lamp.w * (.5 - 61 / 200), GT + 4, 1); LAMPS.push([x + lamp.w * .445, GT + 4 - lamp.h * .83]); }      // 灯罩在图的 75%、17% 处
      else {
        const name = BETWEEN[(hash(i, 23) * BETWEEN.length) | 0]; if (!name) continue;
        const jx = joinNear(g, wx);
        if (jx == null || blocked(jx) || Math.abs(jx - lampX(i - 1)) < 28 || Math.abs(jx - lampX(i + 1)) < 28) continue;      // 不贴着路灯杆
        propAt(name, jx - cx, GT + 4, 1);
      }
    }
  }

  /* ---------- 人行道、路口、马路 ---------- */
  const GROUND = { sidewalk: ['#d5dade', '#b9c0c8'], park: ['#e8d3a0', '#cdb47e'], rooftop: ['#dcb77e', '#bf9a62'] };
  function drawStreet(g) {
    const walk = bgImg(g, 'walkway'), road = bgImg(g, 'road');
    if (walk && road) {
      strip(walk, GT, WH, 1, g.camX);
      decals(g);
      strip(road, GT + WH, RD, 1, g.camX);
      c.drawImage(road, 0, road.height - 6, road.width, 6, 0, GT + WH + RD - 1, W, VH - GT);
      for (const X of g.crosses) drawCross(g, X);
      return;
    }
    const cx = g.camX, [base, line] = GROUND[g.stop.ground], y0 = GT, y1 = laneY(2) + 30;
    c.fillStyle = base; c.fillRect(0, y0, W, y1 - y0);
    c.strokeStyle = line; c.lineWidth = 1.4; c.beginPath();
    for (let z = -.5; z <= 2.5; z += 1) { const y = laneY(z); c.moveTo(0, y); c.lineTo(W, y); }
    const step = g.stop.ground === 'rooftop' ? 90 : 64;
    for (let z = -.5; z < 2.5; z += 1) {
      const ya = laneY(z), yb = laneY(z + 1), off = z * 23;
      for (let x = -(((cx + off) % step) + step) % step; x < W; x += step) { c.moveTo(x, ya); c.lineTo(x, yb); }
    }
    c.stroke();
    decals(g);
    // 路缘 + 马路
    c.fillStyle = '#c9ced6'; c.fillRect(0, y1, W, 9); c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y1); c.lineTo(W, y1); c.moveTo(0, y1 + 9); c.lineTo(W, y1 + 9); c.stroke();
    c.fillStyle = g.stop.street === 'roof' ? '#8f9bb0' : g.stop.street === 'park' ? '#6cc070' : '#3a4150'; c.fillRect(0, y1 + 9, W, VH - y1);
    if (g.stop.street === 'shops') {
      c.strokeStyle = '#e3b505'; c.lineWidth = 3; c.setLineDash([22, 16]); c.lineDashOffset = cx; c.beginPath(); c.moveTo(0, y1 + 62); c.lineTo(W, y1 + 62); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
    } else if (g.stop.street === 'park') {
      c.fillStyle = '#4fa45a'; for (let x = -((cx % 30) + 30) % 30; x < W; x += 30) for (let y = y1 + 20; y < VH; y += 26) c.fillRect(x + ((y * 7) % 13), y, 3, 8);
    }
    for (const X of g.crosses) drawCross(g, X);
  }
  function decals(g) {
    const cx = g.camX, CELL = 110, seed = g.seed % 9973, k0 = Math.floor(cx / CELL) - 1, k1 = Math.floor((cx + W) / CELL) + 1;
    for (let k = k0; k <= k1; k++) for (let ln = 0; ln < 3; ln++) {
      const h = hash(k * 3 + ln, seed), x = k * CELL + hash(ln, k + seed) * 80 - cx, y = laneY(ln) + (hash(k, ln) - .5) * 20;
      if (g.stop.ground === 'sidewalk') {
        if (h < .06) { ell(x, y, 16, 6); inkFill('#9aa1ab', 1); }
        else if (h < .16) { c.fillStyle = 'rgba(70,74,84,.28)'; for (let i = 0; i < 4; i++) { ell(x + (hash(i, k) - .5) * 30, y + (hash(k, i) - .5) * 10, 2.2, 1.2); c.fill(); } }
        else if (h < .21) { c.fillStyle = 'rgba(120,190,230,.5)'; ell(x, y, 22, 6); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 10, y - 1); c.lineTo(x - 2, y - 2); c.stroke(); }
        else if (h < .27) leaves(x, y, k + ln);
      } else if (g.stop.ground === 'park') {
        if (h < .2) { c.fillStyle = 'rgba(150,130,100,.45)'; for (let i = 0; i < 3; i++) { ell(x + (hash(i, k) - .5) * 24, y + (hash(k, i) - .5) * 8, 3, 1.6); c.fill(); } }
        else if (h < .32) leaves(x, y, k + ln);
      } else if (h < .12) { c.fillStyle = 'rgba(120,80,40,.25)'; ell(x, y, 8, 3); c.fill(); }
    }
  }
  function leaves(x, y, k) {
    const cols = ['#e08a2e', '#c8553d', '#e3b505'];
    for (let i = 0; i < 3; i++) { c.fillStyle = cols[(k + i) % 3]; ell(x + (i - 1) * 9, y + ((i * 7) % 5) - 2, 4.4, 2, i * 1.1 + k); c.fill(); }
  }
  // 路口：横街从后面伸过来，斑马线横在三条道上，红绿灯立在路边
  function drawCross(g, X) {
    const x0 = X.x - g.camX, x1 = x0 + X.w, yb = GT + WH;
    if (x1 < -60 || x0 > W + 60) return;
    c.fillStyle = '#3a4150';
    const far = GT - 84;   // 横街往远处延伸，消失在天际线后面
    c.beginPath(); c.moveTo(x0 - 10, GT); c.lineTo(x0 + 22, far); c.lineTo(x1 - 22, far); c.lineTo(x1 + 10, GT); c.lineTo(x1, yb + 9); c.lineTo(x0, yb + 9); c.closePath(); c.fill();
    c.strokeStyle = '#e3b505'; c.lineWidth = 2.4; c.setLineDash([12, 10]); c.beginPath(); c.moveTo((x0 + x1) / 2, far + 4); c.lineTo((x0 + x1) / 2, GT); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(247,248,245,.93)';
    for (let x = x0 + 8; x < x1 - 12; x += 22) { c.beginPath(); c.moveTo(x + 2, GT + 10); c.lineTo(x + 14, GT + 10); c.lineTo(x + 12, yb - 4); c.lineTo(x, yb - 4); c.closePath(); c.fill(); }
    const walk = X.phase === 'green' || X.phase === 'flash', blink = X.phase === 'flash' && Math.sin(perf() * .025) < 0;
    c.fillStyle = walk ? (blink ? 'rgba(47,191,113,.3)' : 'rgba(47,191,113,.9)') : 'rgba(240,67,58,.85)';
    c.fillRect(x0 - 8, GT + 8, 6, yb - GT - 10);
    // 信号灯：立在路口后排的拐角，不挡人
    const px = x0 - 16, py = GT + 44;
    c.fillStyle = '#2b3140'; c.fillRect(px - 2, py - 120, 4, 120);
    rr(px - 16, py - 160, 32, 40, 6); inkFill('#2b3140', 2.4);
    if (walk && !blink) {
      c.strokeStyle = '#e8fff1'; c.fillStyle = '#e8fff1'; c.lineWidth = 3; c.lineCap = 'round';
      circ(px, py - 151, 3.4); c.fill();
      c.beginPath(); c.moveTo(px, py - 147); c.lineTo(px - 1, py - 137); c.lineTo(px - 6, py - 129); c.moveTo(px - 1, py - 137); c.lineTo(px + 5, py - 130); c.moveTo(px, py - 144); c.lineTo(px - 6, py - 140); c.moveTo(px, py - 144); c.lineTo(px + 6, py - 141); c.stroke();
    } else if (!walk) {
      c.fillStyle = '#ff7a52'; rr(px - 6, py - 147, 12, 13, 3); c.fill(); for (let i = 0; i < 4; i++) { rr(px - 6 + i * 3.2, py - 155, 2.6, 9, 1.3); c.fill(); }
      label(String(Math.ceil(X.pt)), px + 22, py - 156, 13, C.alarm, C.ink);
    }
  }

  /* ---------- 车：侧面（马路上）和正面（横街上） ---------- */
  function carSide(x, y, len, col, dir) {
    const taxi = col === 'taxi', body = taxi ? '#f6c624' : col, h = 22;
    shadow(x, y + 2, len * .5, .22);
    c.save(); c.translate(x, y); if (dir < 0) c.scale(-1, 1);
    c.beginPath(); c.moveTo(-len / 2 + 6, 0); c.lineTo(len / 2 - 4, 0); c.quadraticCurveTo(len / 2 + 2, 0, len / 2, -10); c.lineTo(len / 2 - 6, -h + 6);
    c.lineTo(-len / 2 + 4, -h + 6); c.quadraticCurveTo(-len / 2 - 2, -10, -len / 2 + 6, 0); c.closePath(); inkFill(body, 2.4);
    c.beginPath(); c.moveTo(-len / 4, -h + 6); c.lineTo(-len / 6, -h - 8); c.lineTo(len / 5, -h - 8); c.lineTo(len / 3, -h + 6); c.closePath(); inkFill(body, 2.2);
    c.beginPath(); c.moveTo(-len / 4 + 6, -h + 5); c.lineTo(-len / 6 + 3, -h - 5); c.lineTo(len / 5 - 2, -h - 5); c.lineTo(len / 3 - 6, -h + 5); c.closePath(); inkFill('#bfe6f3', 1.6);
    c.beginPath(); c.moveTo(len * .02, -h - 5); c.lineTo(len * .02, -h + 5); c.stroke();
    if (taxi) { rr(-7, -h - 15, 14, 7, 2); inkFill('#fff', 1.6); c.fillStyle = C.ink; for (let i = -len / 2 + 10; i < len / 2 - 10; i += 8) c.fillRect(i, -9, 4, 3); }
    c.fillStyle = '#fff3a8'; circ(len / 2 - 3, -9, 2.6); c.fill();
    for (const wx of [-len / 3, len / 3]) { circ(wx, 0, 7); inkFill('#2b3140', 2); c.fillStyle = '#aab1bb'; circ(wx, 0, 2.6); c.fill(); }
    c.restore();
  }
  function carFront(x, y, k, col) {
    const body = col === 'taxi' ? '#f6c624' : col;
    c.save(); c.translate(x, y); c.scale(k, k);
    shadow(0, 2, 22, .25);
    rr(-20, -26, 40, 24, 6); inkFill(body, 2.2);
    rr(-14, -40, 28, 16, 5); inkFill(body, 2);
    rr(-11, -37, 22, 10, 3); inkFill('#bfe6f3', 1.4);
    c.fillStyle = '#fff3a8'; circ(-13, -14, 3.4); c.fill(); circ(13, -14, 3.4); c.fill();
    c.fillStyle = '#2b3140'; c.fillRect(-18, -3, 7, 5); c.fillRect(11, -3, 7, 5);
    if (col === 'taxi') { rr(-6, -46, 12, 6, 2); inkFill('#fff', 1.2); }
    c.restore();
  }
  const amb = []; let ambG = null;
  function drawRoadCars(g, dt) {
    if (g.stop.street !== 'shops') return;
    if (ambG !== g) { amb.length = 0; ambG = g; }
    const y1 = GT + WH - 8;
    if (dt > 0 && Math.random() < dt * .5 && amb.length < 3) {
      const dir = Math.random() < .5 ? 1 : -1;
      amb.push({ x: dir > 0 ? -80 : W + 80, v: dir * (160 + Math.random() * 140), col: ['taxi', 'taxi', '#e85d4a', '#3f7fd8', '#f7f8f5', '#58b26b'][(Math.random() * 6) | 0], y: dir > 0 ? y1 + 78 : y1 + 44 });
    }
    amb.sort((a, b) => a.y - b.y);
    for (let i = amb.length - 1; i >= 0; i--) { const a = amb[i]; a.x += (a.v + (g.p.v || 0) * -.0) * dt; if (a.x < -120 || a.x > W + 120) amb.splice(i, 1); }
    for (const a of amb) carSide(a.x, a.y, 76, a.col, Math.sign(a.v));
  }

  /* ---------- 地面提示：烟的影子、吐烟预告、警告、补水点 ---------- */
  function drawGroundCues(g) {
    const cx = g.camX, now = perf();
    // 最好成绩那条线：金白相间，横过三条道
    const B = R.best;
    if (B && !quiet && B.x - cx > -20 && B.x - cx < W / Z + 20) {      // 冲过去以后也照画，让它自己滚出画面（踩上去就消失会闪一下）
      const bx = B.x - cx, y0 = laneY(-.5) + 2, y1 = laneY(2.5) - 2, n = 9;
      c.save(); c.globalAlpha = .9;
      for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#fff' : '#ffc21a'; c.fillRect(bx - 3, y0 + (y1 - y0) * i / n, 6, (y1 - y0) / n + .5); }
      c.strokeStyle = C.ink; c.lineWidth = 1.2; c.strokeRect(bx - 3, y0, 6, y1 - y0); c.restore();
    }
    if (g.stop.street) {
      // 第三次试玩：新瓷砖很细，原来半透明的白虚线看不出来。先垫一条深色的缝，再在上面画亮一点的白虚线
      c.save(); c.strokeStyle = 'rgba(40,46,62,.2)'; c.lineWidth = 4;
      for (const z of [.5, 1.5]) { c.beginPath(); c.moveTo(0, laneY(z)); c.lineTo(W, laneY(z)); c.stroke(); }
      c.setLineDash([14, 12]); c.lineDashOffset = cx; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.2;
      for (const z of [.5, 1.5]) { c.beginPath(); c.moveTo(0, laneY(z)); c.lineTo(W, laneY(z)); c.stroke(); }
      c.restore();
      if (!g.attract && !g.over) {
        // 玩家这条道：一条淡青色的带子从脚下往前铺，上下两道细边，再往前慢慢淡掉；脚下一小块亮一点
        const px = g.p.x - cx, ly = laneY(g.p.z), y0 = ly - LY / 2 + 2, h = LY - 4, x0 = Math.max(0, px - 34), x1 = H.VW;
        const lg = c.createLinearGradient(x0, 0, x1, 0); lg.addColorStop(0, 'rgba(53,208,207,0)'); lg.addColorStop(.12, 'rgba(53,208,207,.2)'); lg.addColorStop(.7, 'rgba(53,208,207,.13)'); lg.addColorStop(1, 'rgba(53,208,207,.04)');
        c.fillStyle = lg; c.fillRect(x0, y0, x1 - x0, h);
        const le = c.createLinearGradient(x0, 0, x1, 0); le.addColorStop(0, 'rgba(28,160,170,0)'); le.addColorStop(.12, 'rgba(28,160,170,.55)'); le.addColorStop(1, 'rgba(28,160,170,.08)');
        c.fillStyle = le; c.fillRect(x0, y0, x1 - x0, 2); c.fillRect(x0, y0 + h - 2, x1 - x0, 2);
        c.fillStyle = 'rgba(53,208,207,.28)'; ell(px, ly, 26, 8); c.fill();
      }
    }
    // 烟在地上的影子：一眼看出烟罩着哪条道
    for (const q of g.puffs) {
      if (q.kind === 1 || q.s < .04) continue;
      const x = q.x - cx; if (x < -q.r || x > W + q.r) continue;
      const rx = q.r * 1.05, ry = q.r / DZ * LY;
      c.globalAlpha = Math.min(.2, q.s * .28); c.drawImage(SHADE, x - rx, laneY(q.z) - ry, rx * 2, ry * 2);      // 烟换成干净的描边云以后，深的影子像地上一摊脏东西，只留一点点（2026-11-16）
    }
    c.globalAlpha = 1;
    // 补水点：贴着店面那条道
    for (const f of g.refills) {
      const x = f.x - cx; if (x < -80 || x > W + 80) continue;
      c.fillStyle = 'rgba(28,155,240,.14)'; rr(x - f.w / 2, laneY(0) - 20, f.w, 40, 12); c.fill();
      c.setLineDash([8, 6]); c.lineDashOffset = -now * .03; c.strokeStyle = 'rgba(28,155,240,.85)'; c.lineWidth = 2.4; rr(x - f.w / 2, laneY(0) - 20, f.w, 40, 12); c.stroke(); c.setLineDash([]);
      propAt('hydrant-open-' + (Math.floor(now / 200) % 2), x, GT + 8, 1.15);      // 开着的消防栓（两帧水流轮流放），立在虚线框的后沿
    }
    for (const v of g.vents) {
      const x = v.x - cx; if (x < -60 || x > W + 60) continue;
      // 换气格栅（第十三批，3 帧风扇在转）和冒蒸汽的铁格栅分开画；新图还没到就先用铁格栅
      const ag = v.air && M.props['air-grate-0'] && IMG['p:air-grate-0'] && IMG['p:air-grate-0'].width;
      propAt(ag ? 'air-grate-' + (Math.floor(now / 70) % 3) : 'ground-vent', x, laneY(v.z) + 9.3, 1);      // 平铺在地上，中心对着这条道的中线
      if (v.on > 0 && !v.air) steamColumn(v, x, now);
    }
    for (const z of g.zones) {
      const x0 = z.x0 - cx, x1 = z.x1 - cx; if (x1 < -20 || x0 > W + 20) continue;
      c.fillStyle = 'rgba(227,181,5,.18)'; c.fillRect(x0, laneY(-.6), x1 - x0, laneY(.5) - laneY(-.6));
      c.setLineDash([10, 7]); c.strokeStyle = 'rgba(176,138,0,.9)'; c.lineWidth = 2.4; c.strokeRect(x0, laneY(-.6), x1 - x0, laneY(.5) - laneY(-.6)); c.setLineDash([]);
    }
    for (const s of g.smokers) {
      if (!s.lit || s.state !== 'smoke' || !s.awake || g.over) continue;      // 被追上以后不再画「要吐烟了」的扇形
      const x = s.x - cx; if (x < -200 || x > W + 200) continue;
      // 人还没进画面：不先伸进来一块扇形（看不到人，只看到一块云形状的东西）；右边的预警标签已经说了这条道有人（2026-11-16）
      if (x > H.VW - 4 && !(s.kind === 'boss')) continue;
      if (s.kind === 'boss' && s.phase === 'charge' && s.lanes) {
        const u = 1 - s.pt / 1.1, pulse = .55 + .45 * Math.sin(now * .03);
        for (const ln of s.lanes) {
          c.fillStyle = `rgba(240,67,58,${(.3 + .35 * u) * pulse})`; c.fillRect(0, laneY(ln) - 21, x, 42);
          c.strokeStyle = 'rgba(240,67,58,.95)'; c.lineWidth = 2.6; c.setLineDash([10, 8]); c.strokeRect(-4, laneY(ln) - 21, x + 4, 42); c.setLineDash([]);
          for (let ax = x - 40; ax > 10; ax -= 56) { c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.moveTo(ax - 10, laneY(ln)); c.lineTo(ax + 4, laneY(ln) - 9); c.lineTo(ax + 4, laneY(ln) + 9); c.closePath(); c.fill(); }
        }
      } else if (s.lock && (s.kind === 'vape' || ((s.kind === 'stand' || s.kind === 'walk' || s.kind === 'ahead') && s.nextEx > 0))) {
        const vape = s.kind === 'vape', u = vape ? 1 - s.vapeT / CFG.VAPE_TELE : 1 - s.nextEx / CFG.EX_TELE;
        const rad = vape ? 70 + 110 * u : 50 + 60 * u, a = Math.atan2(s.exz, s.exx), half = vape ? .5 : .38, gy = laneY(s.z);
        /* 要吐烟了：地上铺一块扇形，远处那条边是一个个云的鼓包，颜色和墨线跟真的烟一样，越快吐越浓（2026-11-16）。
         * 原来是半透明的深色扇面加虚线，换了卡通的烟以后像一块贴上去的界面 */
        const pt = (t, r) => [x + Math.cos(t) * r, gy + Math.sin(t) * r * .55], NB = 5, L = vape ? VAPOR_LOOK : SMOKE_LOOK;
        c.beginPath(); c.moveTo(x, gy); c.lineTo(...pt(a - half, rad));
        for (let i = 0; i < NB; i++) { const t0 = a - half + 2 * half * i / NB, t1 = t0 + 2 * half / NB, m = pt((t0 + t1) / 2, rad * 1.16), e = pt(t1, rad); c.quadraticCurveTo(m[0], m[1], e[0], e[1]); }
        c.closePath();
        c.globalAlpha = .28 + .42 * u; c.fillStyle = L.fill[0]; c.fill();
        c.globalAlpha = .45 + .45 * u; c.strokeStyle = L.ink; c.lineWidth = 1.8; c.lineJoin = 'round'; c.stroke(); c.globalAlpha = 1;
      }
    }
    if (!g.over) for (const w of g.warns) {
      const a = .3 + .3 * Math.sin(now * .03), y = laneY(w.lane);
      c.fillStyle = `rgba(240,67,58,${a})`; c.fillRect(0, y - LY / 2, W, LY);
      label(L('SCOOTER!'), W - 60, y - 34, 15, C.alarm);
      c.fillStyle = C.alarm; c.beginPath(); c.moveTo(W - 8, y); c.lineTo(W - 28, y - 12); c.lineTo(W - 28, y + 12); c.closePath(); c.fill();
    }
  }

  /* ---------- 金币、薄荷糖、水瓶 ---------- */
  // 金币转一圈：正面 → 斜 → 更斜 → 翻到另一面的更斜 → 斜 → 正面。原来中间有一帧正侧面，只剩一根细竖线，看着像根针（2026-11-16）
  const COIN_SEQ = [0, 1, 2, 2, 1, 0];
  const ITEM = { skate: 'item-skateboard', blower: 'item-blower', bubble: 'item-bubble', soaker: 'item-soaker', whistle: 'item-whistle' };
  // 摊位的图标（第二十一批，game/tools/ui_art.py 拷进 assets/ui/）。图到了才在 STALL_ART 里列上，免得去要不存在的文件
  const STALL_ART = ['deli', 'hydrant', 'sneaker', 'bagel', 'mint', 'juice', 'fan', 'news'], STALL_IMG = {};
  for (const id of STALL_ART) { const im = new Image(); im.src = `assets/ui/stall-${id}.png`; STALL_IMG[id] = im; }
  R.stallImg = id => STALL_IMG[id];
  function drawPickup(k, x, t) {
    const gy = laneY(k.z), bob = Math.sin(t * 3 + k.ph) * 2.2, y = gy - 18 + bob;
    c.fillStyle = 'rgba(28,34,48,.16)'; ell(x, gy, 7, 2.4); c.fill();
    if (k.kind === 'coin') {
      // 金币：第十一批画的转动分帧。正面、转 35 度、转 65 度、只剩侧边，再把 65、35 两格左右翻过来，就是转了一整圈，看得到币的厚度。
      // 一排金币一个接一个错开一格，像一道波浪传过去。（原来是把一张图左右压扁假装在转，像纸片。）
      const step = ((Math.floor(t * 10 - k.x * .03) % 6) + 6) % 6, A = M.sheets['coin-spin'];
      if (A) cellAt('coin-spin', COIN_SEQ[step], x, y + A.u / 2, step > 2);
    } else if (k.kind === 'mint' || k.kind === 'bottle') {
      // 薄荷糖、水瓶：第四批美术画的图标（原来是代码画的圆片和方瓶子）。薄荷糖左右轻轻晃，外面一圈薄荷色的光；水瓶只上下浮
      const im = IMG['i:item-' + k.kind], mint = k.kind === 'mint';
      if (mint) { c.strokeStyle = 'rgba(53,208,207,.7)'; c.lineWidth = 2; circ(x, y - 4, 15 + Math.sin(t * 5) * 2); c.stroke(); }
      if (im && im.width) { c.save(); c.translate(x, y - 4); if (mint) c.rotate(Math.sin(t * 2.4 + k.ph) * .3); c.drawImage(im, -12.5, -12.5, 25, 25); c.restore(); }
    } else if (k.kind === 'stall') {
      // 街区摊位（docs/22 的 C）：路口立一块小牌子，上面是第二十一批画的图标，牌子上面一行写拿了有什么用
      const y0 = gy - 36 + bob * .5, im = STALL_IMG[k.perk];
      c.fillStyle = C.ink; c.fillRect(x - 1.3, y0 + 15, 2.6, gy - y0 - 15);
      rr(x - 17, y0 - 17, 34, 34, 8); inkFill('#fff6cf', 1.6);
      if (im && im.complete && im.naturalWidth) c.drawImage(im, x - 14, y0 - 14, 28, 28);
      else label(k.perk[0].toUpperCase(), x, y0 + 1, 17, C.nic, C.ink, 900);
      // 说明写在牌子左边（迎着 Leo 那一边），三条道的牌子上下挨得近，写在上面会压到上一条道的牌子
      // 牌子还没进画面时不写：字在牌子左边，会先一步滑进来，在屏幕边上飘着一截没头没尾的字（2026-11-16）
      c.font = `900 9px ${FONT}`; const sl = L(H.STALLS[k.perk].label), lw = c.measureText(sl).width;
      if (x - 17 < H.VW) { label(sl, x - 22 - lw / 2, y0 + 1, 9, '#fff', C.ink, 900); reserve(x - 22 - lw / 2, lw / 2 + 3, y0 + 1, 7); }
    } else if (ITEM[k.kind]) {
      // 道具：一圈跳动的黄光，中间是图标
      const im = IMG['i:' + ITEM[k.kind]], r = 15 + Math.sin(t * 5 + k.ph) * 1.2;
      c.fillStyle = 'rgba(246,198,36,.3)'; circ(x, y - 8, r + 4); c.fill();
      circ(x, y - 8, r); inkFill('#fff6cf', 1.1);      // 圈的描边和里面图标的一样粗（原来是 2.4）
      if (im && im.width) c.drawImage(im, x - 13, y - 21, 26, 26);
      else if (k.kind === 'whistle') whistleIcon(x, y - 8, 1);
    }
  }
  /* 侧身（局外升级）的冷却：Leo 脚后跟旁边一个小圆牌。灰的、一圈慢慢转满是还在冷却，彩色的是下次绊到东西会自己侧身躲开。
   * 原来看不见：用户只觉得「有时候会闪开、有时候不会」（2026-11-17） */
  const SIDESTEP_IMG = new Image(); SIDESTEP_IMG.src = 'assets/ui/upgrade-sidestep.png';
  function sidestepBadge(g, x, y) {
    const cd = clamp(g.dodgeCd / g.k.dodge, 0, 1), ready = cd <= 0;
    circ(x, y, 8); inkFill(ready ? '#e5f8ec' : '#e3e7eb', 1.4);
    if (SIDESTEP_IMG.complete && SIDESTEP_IMG.naturalWidth) { c.globalAlpha = ready ? 1 : .35; c.drawImage(SIDESTEP_IMG, x - 6, y - 6, 12, 12); c.globalAlpha = 1; }
    if (!ready) { c.strokeStyle = '#2fb85a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 8, -1.5708, -1.5708 + TAU * (1 - cd)); c.stroke(); }
    if (isFinite(g.k.dodgeN)) label('×' + g.k.dodgeN, x - 17, y + 1, 11, '#fff', C.ink, 900);      // 烟就是赛道：还剩几次。写在圆牌左边（右边是 Leo 的鞋，会被盖住）；白字黑边
  }
  /* 健康跑哨子（烟里冲刺规则的道具，docs/27）：第二十三批的图（item-whistle）；图没加载出来时代码画一个——银色哨子、绿色挂绳。s 是缩放，中心在 (x, y) */
  function whistleIcon(x, y, s) {
    const im = IMG['i:item-whistle'];
    if (im && im.width) { c.drawImage(im, x - 13 * s, y - 13 * s, 26 * s, 26 * s); return; }
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = '#2fb85a'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, -2); c.quadraticCurveTo(-9, -12, 0, -11); c.stroke();
    c.beginPath(); c.moveTo(-8, -3); c.lineTo(3, -3); c.lineTo(3, -6.5); c.lineTo(10, -6.5); c.lineTo(10, -2); c.quadraticCurveTo(10, 7, 1, 7); c.quadraticCurveTo(-8, 7, -8, -3); c.closePath(); inkFill('#dfe6ee', 1.6);
    c.fillStyle = C.ink; circ(1, 1.5, 2); c.fill();
    c.restore();
  }

  /* ---------- 鸽子 ---------- */
  // 四格：站着、低头啄地、飞（翅膀朝上）、飞（翅膀朝下）。图是朝右的
  function bird(b, x, dt) {
    b.t += dt;
    const gy = laneY(b.z);
    if (!b.fly) shadow(x, gy + 1, 6, .18);
    const f = b.fly ? 2 + (Math.floor(b.t * 14) % 2) : Math.sin(b.t * 4 + b.x) > .7 ? 1 : 0;
    cellAt('pigeon-side', f, x, gy + 1 - b.lift, b.dir < 0, b.a);
  }

  /* ---------- 人物 ---------- */
  // 每种站着抽的长相，在各个状态用哪张图的哪几帧
  const st4 = (n, ex, idle) => ({ idle: [`${n}-side-${idle || 'stand'}`, [0, 1]], ex: [`${n}-side-exhale`, ex], wet: [`${n}-side-soaked`, [0]], leave: [`${n}-side-leave`, [0]] });
  const STAND = {
    office: { idle: ['office-side-stand', [0, 1]], ex: ['office-side-stand', [2, 3]], wet: ['office-side-stand', [4]], leave: ['office-side-leave', [0]] },
    hoodie: { idle: ['hoodie-side-stand', [0, 1]], ex: ['hoodie-side-stand', [2, 3]], wet: ['hoodie-side-stand', [4]], leave: ['hoodie-side-leave', [0]] },
    granny: st4('granny', [0, 1]), ring: st4('ring', [0, 1, 2]), chef: st4('chef', [0, 1], 'sit'), dogwalker: st4('dogwalker', [0, 1]),
    phone: { idle: ['phone-side-walk', [1]], ex: ['phone-side-walk', [1]], wet: ['phone-side-soaked', [0]], leave: ['phone-side-leave', [0]] }
  };
  // 遛狗的人身后蹲着他的狗，牵引绳从手连到狗脖子；人走开时狗跟着走
  function dogAt(s, x, y, k, leave) {
    const dx = x + 25 * k;
    if (leave) { sheet('dog-side-walk', Math.floor(s.walk) % 4, dx + 8, y, k, true, s.fade); return; }
    const L = M.sheets[s.duck > 0 && M.sheets['dogwalker-side-duck'] ? 'dogwalker-side-duck' : 'dogwalker-side-stand'], lp = L && L.leash, u = U * k;      // 蹲下时绳子接到蹲着攥绳的手
    if (lp) { c.strokeStyle = C.ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + lp[0] * u, y + lp[1] * u); c.quadraticCurveTo(x + 14 * k, y - 6 * k, dx - 5 * k, y - 13 * k); c.stroke(); }
    sheet('dog-side-sit', Math.floor(perf() * .003 + s.x * .01) % 2, dx, y, k);
  }
  function dogOnLane(s, wxPos) {
    const x = wxPos - 23, dz = s.dogLane + (s.z - s.lane), y = laneY(dz), k = dsc(dz), wy = laneY(s.z), wk = dsc(s.z), leave = s.state === 'leave';
    if (leave || s.state === 'stun' || !s.lit) { shadow(x, y, 9 * k, .14); sheet('dog-side-walk', Math.floor(perf() * .008) % 4, x, y, k, true, leave ? s.fade : 1); return; }
    const L = M.sheets[s.duck > 0 && M.sheets['dogwalker-side-duck'] ? 'dogwalker-side-duck' : 'dogwalker-side-stand'], lp = (L && L.leash) || [-6, -69], u = U * wk, hx = wxPos + lp[0] * u, hy = wy + lp[1] * u, cx2 = x + 4 * k, cy2 = y - 13 * k;
    c.lineCap = 'round';
    // 地上一道红色虚线，一眼看出这两条道被连着挡住了
    c.setLineDash([6, 5]); c.strokeStyle = 'rgba(240,67,58,.75)'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(wxPos, wy + 2); c.lineTo(x, y + 2); c.stroke(); c.setLineDash([]);
    for (const [w, col] of [[4.4, C.ink], [2.2, C.alarm]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + cx2) / 2 - 6, (hy + cy2) / 2 + 9, cx2, cy2); c.stroke(); }
    shadow(x, y, 9 * k, .16);
    sheet('dog-side-sit', Math.floor(perf() * .003 + s.x * .01) % 2, x, y, k);
  }
  // 烟圈：侧面看是一个竖着的椭圆，沿着道飘过来；外面一圈虚线表示能点
  // 老板吐的烟圈（第三次试玩：灰色的小竖圈不像能点的东西）：画大一号，外面一圈白底的虚线点选圈，下面写 TAP
  function smokeRing(q, x) {
    const big = !!q.boss, s = big ? 1.4 : 1;
    const k = dsc(q.z), y = laneY(q.z) - q.h * k, ry = (13 + Math.min(5, q.age * 2)) * s, rx = (9 + Math.sin(q.age * 6) * 1) * s, a = Math.min(1, q.life * 2.5);      // 侧着看的圈：宽 9，中间的洞露得出来
    c.globalAlpha = a;
    c.fillStyle = 'rgba(28,34,48,.14)'; ell(x, laneY(q.z), 9 * s, 3 * s); c.fill();
    const tr = ry + (big ? 9 + Math.sin(perf() * .012) * 2 : 7);
    if (big) { c.fillStyle = 'rgba(255,255,255,.28)'; circ(x, y, tr); c.fill(); }
    // 烟圈画成一圈鼓鼓的小云团，颜色和墨线跟路上的烟一样（2026-11-16）。原来是深灰的实心圈，换了新烟以后像个轮胎
    const N = 13, pr = 3.5 * s, sp = q.age * 1.6;
    c.beginPath();
    for (let i = 0; i < N; i++) { const a = i / N * TAU + sp, px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry, r = pr * (1 + .14 * Math.sin(i * 2.3)); c.moveTo(px + r, py); c.arc(px, py, r, 0, TAU); }
    c.lineWidth = 3.2; c.strokeStyle = SMOKE_LOOK.ink; c.stroke();
    const rg = c.createLinearGradient(0, y - ry - pr, 0, y + ry + pr); rg.addColorStop(0, RING[0]); rg.addColorStop(1, RING[1]);
    c.fillStyle = rg; c.fill();
    if (big) { c.lineWidth = 4.6; c.strokeStyle = C.ink; c.setLineDash([7, 5]); c.lineDashOffset = perf() * .03; circ(x, y, tr); c.stroke(); }
    c.lineWidth = big ? 2.6 : 1.8; c.strokeStyle = '#fff'; c.setLineDash(big ? [7, 5] : [5, 5]); c.lineDashOffset = perf() * .03; circ(x, y, tr); c.stroke(); c.setLineDash([]);
    if (big) label(L('TAP'), x, y + tr + 11, 11, '#fff', C.ink, 900);
    c.globalAlpha = 1;
  }
  // 老板这一招要点的地方（相对脚底的游戏帧格像素）：挥雪茄 = 这一帧的火星，点火 = 火苗
  function bossPoint(s) {
    if (s.phase === 'wave') { const A = M.sheets['boss-side-wave']; return A && A.ember && A.ember[s.wf]; }
    if (s.phase === 'lighter') { const A = M.sheets['boss-side-lighter']; return A && A.flame && (A.flame[s.pt < s.pt0 * .7 ? 1 : 0] || A.flame[0]); }
    return null;
  }
  function drawSmoker(g, s, x) {
    const y = laneY(s.z), k = dsc(s.z) * (s.kind === 'boss' ? 1.2 : 1), fr = Math.floor(s.walk) % 4;
    const leave = s.state === 'leave', stun = s.state === 'stun';
    if (s.kind !== 'terrace') shadow(x, y, (s.kind === 'boss' ? 20 : 13) * k, leave ? .2 * s.fade : 0);      // 走开的人也贴着地走，影子跟着淡
    // 滑板从头顶飞过去：原地蹲下抱头（第十二批的图）。遛狗的狗照样蹲在旁边，绳子接到蹲下时攥绳的手
    const dk = s.duck > 0 && s.lit && !leave && !stun && H.duckSheet(s);
    if (dk) {
      sheet(dk, 0, x, y, k, s.kind === 'ahead');
      if (s.look === 'dogwalker' && s.dogLane == null) dogAt(s, x, y, k, false);
      if (Math.abs(g.p.x - s.x) > 34) speech(L('Whoa!'), x, y - 52 * k, 14);      // 主角到了头顶上就不挡着他
      return;
    }
    switch (s.kind) {
      case 'stand': {
        const L = STAND[s.look] || STAND.office, bob = leave ? Math.abs(Math.sin(s.walk * 1.6)) * 2 : 0;
        const [nm, fs] = leave ? L.leave : stun || !s.lit ? L.wet : s.ex > 0 || s.lock ? L.ex : L.idle;
        // 吐烟：预告时是倒数第二帧（吸气、鼓嘴），真吐出来是最后一帧；平时两帧慢慢换
        const fi = leave || stun || !s.lit ? 0 : s.ex > 0 ? fs.length - 1 : s.lock ? Math.max(0, fs.length - 2) : Math.floor(perf() * .0025 + s.x * .01) % fs.length;
        // 打电话的踱步时用走路帧
        sheet(nm, s.moving && nm === 'phone-side-walk' ? Math.floor(s.walk) % 8 : fs[fi], x, y - bob, k, false, leave ? s.fade : 1);
        if (s.look === 'dogwalker' && s.dogLane == null) dogAt(s, x, y, k, leave);
        break;
      }
      case 'walk': case 'ahead': {
        const lk = s.look || 'hoodie', f8 = Math.floor(s.walk) % 8, back = s.kind === 'ahead';
        if (leave) sheet(`${lk}-side-leave`, 0, x, y - Math.abs(Math.sin(s.walk * 1.6)) * 2, k, s.kind === 'walk', s.fade);      // 走开的图朝右；迎面来的人往左走开要翻过来，不然倒着走
        else if (stun || !s.lit) sheet(`${lk}-side-soaked`, 0, x, y, k, back);
        else sheet(`${lk}-side-walk`, s.vx ? f8 : 1, x, y, k, back);
        break;
      }
      case 'vape': {
        // 图集顺序：站着两帧、吸、喷、淋湿、走开
        const f = leave ? 5 : stun || !s.lit ? 4 : s.ex > 0 ? 3 : s.lock ? 2 : Math.floor(perf() * .003 + s.x * .01) % 2;
        sheet('vape-side', f, x, y - (leave ? Math.abs(Math.sin(s.walk * 1.6)) * 2 : 0), k, false, leave ? s.fade : 1);
        if (s.lit && s.lock && !stun && !leave) { const u = 1 - s.vapeT / CFG.VAPE_TELE, cg = s.cig || [13, 22]; c.fillStyle = `rgba(190,140,255,${.4 + .5 * u})`; circ(x + cg[0] * k, y - cg[1] * k, 4 + 5 * u); c.fill(); }
        break;
      }
      case 'scooter':
        sheet('scooter-side-left', Math.floor(s.walk * .25) % 2, x, y + Math.sin(s.walk * .7) * .8, k);
        break;
      case 'boss': {
        const t6 = perf() * .001, ph = s.phase, down = leave || stun || !s.lit;
        const name = down ? 'boss-side-soaked' : ph === 'ring' ? 'boss-side-ring' : ph === 'wave' ? 'boss-side-wave' : ph === 'lighter' ? 'boss-side-lighter'
          : ph === 'charge' ? 'boss-side-charge' : ph === 'blow' ? 'boss-side-blow' : ph === 'cough' ? (s.hp === 1 ? 'boss-side-hatoff' : 'boss-side-cough') : 'boss-side-walk';
        const A = M.sheets[name];
        const f = name === 'boss-side-wave' ? s.wf : name === 'boss-side-ring' ? (s.ex > 0 ? 1 : 0) : name === 'boss-side-lighter' ? (s.pt < s.pt0 * .7 ? 1 : 0)
          : name === 'boss-side-charge' ? Math.min(2, Math.floor((1 - s.pt / 1.1) * 3)) : name === 'boss-side-walk' ? (ph === 'enter' ? fr : 0) : down ? (leave ? 1 : 0) : Math.floor(t6 * 6) % A.frames;
        const by0 = y - (leave ? Math.abs(Math.sin(s.walk * 1.6)) * 2 : 0), bd = s.day || 0;
        if (bd >= 2 && !leave) bossAura(x, y, k);
        sheet(name, f % A.frames, x, by0, k, false, leave ? s.fade : 1);
        bossShades(name, f % A.frames, x, by0, k, leave ? s.fade : 1, bd);      // 第 2 天起戴墨镜
        if (!down && ph !== 'wait') {
          // 要点的地方：挥雪茄时的火星、点火时的火苗。亮一个跳动的黄圈
          const tp = bossPoint(s), by = y - 96 * k;
          if (tp) {
            const tx = x + tp[0] * U * k, ty = y + tp[1] * U * k, r = 13 + Math.sin(perf() * .02) * 2.5;
            c.fillStyle = 'rgba(255,170,40,.9)'; circ(tx, ty, 5); c.fill();
            c.lineWidth = 5; c.strokeStyle = C.ink; circ(tx, ty, r); c.stroke();
            c.lineWidth = 2.6; c.strokeStyle = C.nic; circ(tx, ty, r); c.stroke();
          }
          // 这一招要做什么、还剩几格血：挪到顶栏下面的老板条（drawHud 的 bossBar）。原来写在老板头上，地铁口挪到他身后以后正好压在地铁口的招牌上（2026-11-16）
        }
        break;
      }
      case 'terrace':
        propAt(s.lit ? 'terrace-lit' : 'terrace-doused', x, y + 6, 1);      // 第十一批的一桌食客，按原图大小
        break;
    }
    // 跟着节拍（docs/22 的 D）：音乐每一拍，点着的烟头亮一下（拍子一到最亮，很快暗下去），看得出这条街的节奏，喷烟也落在拍子上
    if (beatNow && s.lit && s.state === 'smoke' && s.kind !== 'boss' && s.kind !== 'terrace' && s.kind !== 'scooter') {
      const u = beatPulse(), cg = s.cig || (H.BODY[s.kind] && H.BODY[s.kind].cig) || [0, 30];
      if (u > .05) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = u * .85; c.fillStyle = '#ff9d2e'; circ(x + cg[0] * k, y - cg[1] * k, 2 + 4 * u); c.fill(); c.restore(); }
    }
    if (s.say && (stun || s.aside > .3 || g.t < (s.sayTo || 0))) speech(s.say, x, y - 76, 14);      // sayTo：被挤开的那一下（shove）
  }
  // 头：0 正常、1 鼓腮、2 憋红、3 发紫、4 大喘、5 咳嗽
  function playerHead(g) {
    const p = g.p, u = p.breath / g.k.breath;
    if (p.gasp > 0 || (g.intro && g.intro.scared && !p.holding)) return 4;      // 开头回头看见大烟雾、吓一跳，用的是张嘴的那张脸
    if (p.holding) return u > .6 ? 1 : u > .28 ? 2 : 3;
    if (g.dens >= CFG.DMIN) return 5;
    return 0;
  }
  let arriveT = 0;
  let chainSeen = 0, chainPop = 0, reliefT = 0, blownT = 0;
  /* 最好成绩（2026-11-15）：路上在最好成绩那里插一面金旗、地上横一条线，远远就看得到它过来；冲过去以后顶上的米数变成金色。
   * 同类跑酷里最让人想再来一局的，就是跑着跑着看见自己的纪录。R.best 由 main.js 每局开跑时给：{ x 世界坐标, m 米数, passed } */
  R.best = null;
  R.relief = () => { reliefT = .7; };
  R.smogBlown = () => { blownT = .9; };
  // 头（咳嗽、大喘、松一口气这些表情）：按这一帧身体的偏移叠在走路的身体上
  function headOn(g, x, y, k, a, off) {
    const s = U * k, ox = off ? off[0] * s : 0, oy = off ? off[1] * s : 0, p = g.p;
    // 刚在干净空气里喘上一口：松一口气的表情
    if (reliefT > 0 && !p.holding && p.gasp <= 0 && g.dens < CFG.DMIN) pSheet('player-side-heads-extra', 0, x + ox, y + oy, k, false, a);
    // 开头回头看大烟雾：头左右翻过来朝后看。头在帧格里偏左 14.5 格，翻过来会跑到右边，所以往左挪回两倍
    else if (g.intro && g.intro.look) pSheet('player-side-heads', 4, x + ox - 29 * s, y + oy, k, true, a);
    else pSheet('player-side-heads', playerHead(g), x + ox, y + oy, k, false, a);
  }
  /* 跟着跑的人：第二十一批的慢跑图（jog-office 这些，6 帧朝右）；图没到之前用走开的那张（朝右）一颠一颠地顶着。
   * 掉队的慢慢变淡、往后落；PHEW（人多的时候）一起蹦一下 */
  function drawJogger(g, f, x) {
    const k = dsc(f.z), y = laneY(f.z), a = f.drop ? Math.max(0, f.drop / 1.4) : Math.min(1, f.joinT * 3);
    const cheer = reliefT > 0 && g.parade.length >= 3 ? Math.abs(Math.sin((.7 - reliefT) * 12)) * 7 : 0;
    shadow(x, y, 11 * k, .16 * a);
    const J = M.sheets['jog-' + f.look];
    if (J && IMG['s:jog-' + f.look] && IMG['s:jog-' + f.look].width) sheet('jog-' + f.look, Math.floor(f.ph) % J.frames, x, y - cheer, k, false, a);
    else sheet(`${f.look}-side-leave`, 0, x, y - Math.abs(Math.sin(f.ph * .5)) * 3 - cheer, k, false, a);
  }
  function drawPlayer(g) {
    // 踩滑板跳过矮东西时人在空中：影子留在地上、跟着变小
    const p = g.p, x = p.x - g.camX, pz = p.z + (p.zo || 0), gy = laneY(pz), k = dsc(pz), y = gy - (p.hopH || 0) * k, run = p.holding && !g.over, skate = !!g.power && g.power.kind === 'skate' && !g.over;
    let a = 1;
    shadow(x + (skate ? 3.5 * k : 0), gy, (skate ? 19 : 13) * k * (1 - (p.hopH || 0) / 110));
    if (g.over === 'smog') return;      // 被追上：坐在地上的那张画在大烟雾上面，见 drawCaught
    if (g.k.dodge && !g.attract && !quiet && g.k.dodgeN > 0) sidestepBadge(g, x - 24 * k, gy - 6 * k);      // 烟就是赛道：侧身是每局几次，用完就不画
    if (p.inv > 0 && Math.sin(perf() * .05) > 0) a *= .55;
    const hurt = Math.min(1, Math.max(p.bump / CFG.BUMP_T, p.stun / CFG.COUGH_STUN));
    if (hurt > 0 && !(skate && p.bump <= 0)) pSheet('player-side-trip', hurt > .6 ? 0 : hurt > .25 ? 1 : 2, x, y, k, false, a);      // 前扑、单脚跳、站稳
    else if (skate) {
      // 踩滑板：带头的整身图，板和人画在一起。平时在两帧滑行之间轻轻起伏，隔一会儿蹬一下地；憋气时换成蹲低的那套
      // 跳起来（跳矮东西、从人头顶飞过去）换成第十二批的三帧：压板起跳、空中抓板、落地屈膝，落地那一帧多停一下。
      // 上升时整个人略微抬头、下落时略微低头，跳人时幅度大一点；在板上呛到不下板，只是人晃几下
      const st = playerHead(g), H = p.hop, hu = H ? clamp((p.x - H.x0) / (H.x1 - H.x0), 0, 1) : 0, air = (H || p.landT > 0) && M.sheets['player-side-skate-air-full'];
      const face = air ? 'player-side-skate-air' : 'player-side-skate';
      const nm = !run ? face + '-full' : st === 3 ? face + '-hold-purple' : st === 2 ? face + '-hold-red' : face + '-hold-full';
      const u = ((g.power.T || CFG.POWER_T) - g.power.t) % 1.7;
      const f = air ? (!H ? 2 : hu < .14 ? 0 : hu < .82 ? 1 : 2) : u < .16 ? 0 : u < .34 ? 1 : 2 + (Math.floor(u / .28) % 2);
      const tilt = (H && air ? (H.big ? .16 : .08) * (hu - .5) : 0) + (p.stun > 0 ? Math.sin(perf() * .03) * .1 * (p.stun / CFG.COUGH_STUN) : 0);
      const pv = 30 * k;      // 绕着腰转，不绕着脚
      c.save(); c.translate(x, y - pv); c.rotate(tilt);
      pSheet(nm, f, 0, pv, k, false, a);
      c.restore();
    }
    else if (p.sprayT > 0) pSheet('player-side-spray-aim', p.aim < 0 ? 0 : p.aim > 0 ? 2 : 1, x, y, k, false, a);      // 朝上、水平、朝下
    else if (run) {
      // 冲刺：带头的整身图，头跟着身体前倾。脸随着气量从鼓腮到憋红到发紫（后两套是素材脚本改色出来的）
      const st = playerHead(g), nm = st === 3 ? 'player-side-run-purple' : st === 2 ? 'player-side-run-red' : 'player-side-run-full', A = M.sheets[nm];
      pSheet(nm, Math.floor(p.walk) % A.frames, x + (A.dx || 0) * U * k, y, k, false, a);
    } else {
      // 走路：正常脸直接用带头的整身图；咳嗽、大喘、松一口气这些表情，把旧的头叠在新身体上
      const f = p.v > 5 ? Math.floor(p.walk) % 8 : 0, BW = M.sheets['player-side-body-walk'], wx = x + (BW.dx || 0) * U * k;
      const plain = playerHead(g) === 0 && !(reliefT > 0 && p.gasp <= 0 && g.dens < CFG.DMIN);
      if (plain && M.sheets['player-side-walk-full']) pSheet('player-side-walk-full', f, wx, y, k, false, a);
      else { sheet('player-side-body-walk', f, wx, y, k, false, a); headOn(g, wx, y, k, a, BW.headOffset ? BW.headOffset[f] : null); }
    }
    // 开头回头看大烟雾：头顶冒一个「!」，先弹大一下再落定
    if (g.intro && g.intro.look) {
      const u = g.intro.t - g.intro.seen, sz = 24 * (u < .12 ? .5 + u / .12 * .7 : 1.2 - Math.min(u - .12, .1) * 2);
      label('!', x + (M.sheets['player-side-body-walk'].dx || 0) * U * k - 9 * k, y - 68 * k, sz, C.alarm, '#fff', 900);
    }
    // 憋住气冲刺：身后的速度线，越憋越长。烟里冲刺规则在烟里加速时（p.turbo）多两根、更粗、带一点天蓝，一眼看得出「在烟里更快」
    if (run && p.v > g.speed * 1.1) {
      const tb = p.turbo || 0, n = tb > .2 ? 7 : 5, len = 10 + (p.v / g.speed - 1) * 46;
      c.strokeStyle = tb > .2 ? `rgba(${Math.round(255 - 100 * tb)},${Math.round(255 - 30 * tb)},255,.9)` : 'rgba(255,255,255,.8)'; c.lineCap = 'round'; c.lineWidth = 2.4 + tb * 1.2;
      for (let i = 0; i < n; i++) { const yy = y - 4 - i * (n > 5 ? 8 : 10), l = len * (.6 + ((perf() * .05 + i * 7) % 12) / 20); c.beginPath(); c.moveTo(x - 20, yy); c.lineTo(x - 20 - l, yy); c.stroke(); }
    }
    // 道具生效中：外面一圈黄色的倒计时，各有各的样子
    const P = g.power;
    if (P && !g.over) {
      const t = perf() * .001, cy = y - 30 * k;
      c.globalAlpha = P.t < 1.5 ? (Math.sin(t * 18) > 0 ? 1 : .3) : 1;      // 最后 1.5 秒闪：道具快没了
      if (P.kind === 'whistle') { whistleIcon(x + (run ? 22 : 14) * k, y - (run ? 44 : 52) * k, .7); const u = (t * 2) % 1; c.globalAlpha = 1 - u; label('♪', x + 30 * k + u * 14, y - 62 * k - u * 16, 12, '#2fb85a', '#fff', 900); c.globalAlpha = P.t < 1.5 ? (Math.sin(t * 18) > 0 ? 1 : .3) : 1; }
      if (P.kind === 'bubble') { c.fillStyle = 'rgba(190,235,255,.24)'; circ(x, cy, 37); c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = 'rgba(120,200,255,.8)'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, cy, 33, -2.4, -1.5); c.stroke(); }
      if (P.kind === 'blower') { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineCap = 'round'; c.lineWidth = 2.6; for (let i = 0; i < 5; i++) { const u = (t * 2.2 + i / 5) % 1, yy = y - 12 - i * 9; c.globalAlpha = 1 - u; c.beginPath(); c.moveTo(x + 22 + u * 150, yy); c.lineTo(x + 22 + u * 150 + 26, yy); c.stroke(); } c.globalAlpha = 1; }
      c.lineCap = 'round'; c.lineWidth = 3.2; c.strokeStyle = C.nic; c.beginPath(); c.arc(x + (run ? 7 * k : 0), y - (run ? 40 : 50) * k, 29, -1.5708, -1.5708 + TAU * clamp(P.t / (P.T || CFG.POWER_T), 0, 1)); c.stroke();
      c.globalAlpha = 1;
    }
    // 气圈：冲刺时头在前面，圈跟过去
    // 前面这段浓烟要憋多少（core.js 的 airNeed）：气圈上一道白线标出来，手里的气不够，差的那一截是红的、一闪一闪
    const A = !quiet && !g.locked ? g.airNeed : null;
    if ((p.holding || p.breath < g.k.breath - .01 || A) && !g.over) {
      const u = p.breath / g.k.breath, cx2 = x + (run ? 7 * k : 0), cy = y - (run ? 40 : 50) * k, low = u < .3 && p.holding;
      c.lineCap = 'round'; c.lineWidth = 4.2; c.strokeStyle = 'rgba(28,34,48,.55)'; circ(cx2, cy, 23); c.stroke();
      c.strokeStyle = low ? (Math.sin(perf() * .03) > 0 ? C.alarm : '#fff') : '#35d0cf'; c.beginPath(); c.arc(cx2, cy, 23, -1.5708, -1.5708 + TAU * u); c.stroke();
      if (A) {
        const un = Math.min(1, A.t / g.k.breath), a1 = -1.5708 + TAU * un, short = u < un - .005, ca = Math.cos(a1), sa = Math.sin(a1);
        // 红的那截闪到最暗也看得见（原来最暗 0.25，模拟器里截到过几乎没有）
        if (short) { c.globalAlpha = .75 + .25 * Math.sin(perf() * .02); c.strokeStyle = C.alarm; c.beginPath(); c.arc(cx2, cy, 23, -1.5708 + TAU * u, a1); c.stroke(); c.globalAlpha = 1; }
        c.beginPath(); c.moveTo(cx2 + ca * 19, cy + sa * 19); c.lineTo(cx2 + ca * 29, cy + sa * 29);
        c.strokeStyle = C.ink; c.lineWidth = 5.4; c.stroke(); c.strokeStyle = short ? '#ffd9d2' : '#fff'; c.lineWidth = 2.8; c.stroke();
      }
      // 教 PERFECT 的那一圈：画在道具倒计时那圈（半径 29、金黄）外面，浅一点的亮黄，往外扩着淡出，两圈不叠在一起（2026-11-16）
      if (cueT > 0 && p.holding) { const w = cueT / CFG.PERFECT_T; c.globalAlpha = w; c.lineWidth = 3.6; c.strokeStyle = C.ink; circ(cx2, cy, 37 + (1 - w) * 6); c.stroke(); c.lineWidth = 2.2; c.strokeStyle = '#fff3a6'; c.stroke(); c.globalAlpha = 1; }
    }
    // 这口气已经连冲了几个
    if (g.chain !== chainSeen) { if (g.chain > chainSeen) chainPop = .25; chainSeen = g.chain; }
    // 憋气版（docs/23）：头上写这一口在烟里憋了几秒，下面一行是现在出烟松手能吹回去多远
    const held = g.breathy && g.p.holding ? g.p.smokeHeld || 0 : 0;
    if (held >= CFG.B_MIN && !g.over && !quiet) {
      const cs = 17 + Math.min(9, held * 2.2), txt = L('{s}s', { s: held.toFixed(1) });
      c.font = `900 ${cs}px ${FONT}`; reserve(x + 2, c.measureText(txt).width / 2 + 6, y - 92 * k + cs * .35, cs * 1.05 + 2);
      c.save(); c.translate(x + 2, y - 92 * k);
      label(txt, 0, 0, cs, '#35d0cf', C.ink, 900);
      const S = g.smog, can = S.awake ? Math.min((CFG.B_PUSH * held + CFG.PUSH2 * g.chain * g.chain) * (g.k.bank || 1), CFG.GAP_MAX - S.gap) : 0;
      if (can >= CFG.M) label(L('SMOG −{n} m', { n: Math.round(can / CFG.M) }), 0, 17 + Math.min(9, held * 2.2) * .75, 11, '#fff', C.ink, 900);
      c.restore();
    }
    else if (g.chain > 0 && !g.over && !quiet) {      // 主页背后的演示不写连冲（压在标题下面，乱）
      const kk = 1 + chainPop * 2, cs = 17 + Math.min(9, g.chain * 1.5);
      c.font = `900 ${cs}px ${FONT}`; reserve(x + 2, c.measureText(`×${g.chain}`).width / 2 + 6, y - 92 * k + (g.dive && g.chain >= 2 ? cs * .35 : 0), cs * (g.dive && g.chain >= 2 ? 1.05 : .62) + 2);
      c.save(); c.translate(x + 2, y - 92 * k); c.scale(kk, kk);
      label(`×${g.chain}`, 0, 0, cs, C.nic, C.ink, 900);
      // 潜水规则：连冲两个起，下面一行写现在松手能把大烟雾吹回多远（按连冲数的平方涨）。
      // 量的：入账八成是一两个，吹退 10 米以上的一分钟不到一次；看得见「再冲一个就多吹好几米」，贪的那一下才有理由
      // 写的是真能吹回去的：大烟雾最远只能甩开 GAP_MAX，已经很远了就按剩下的算（不然预告写 14 米、松手只吹 8 米）；还没醒、或者已经甩到最远，就不写
      const S = g.smog, can = S.awake ? Math.min(CFG.PUSH2 * g.chain * g.chain * (g.k.bank || 1), CFG.GAP_MAX - S.gap) : 0;
      if (g.dive && g.chain >= 2 && can >= CFG.M) label(L('SMOG −{n} m', { n: Math.round(can / CFG.M) }), 0, 17 + Math.min(9, g.chain * 1.5) * .75, 11, '#fff', C.ink, 900);
      c.restore();
    }
    blockedArrow(g, x);
  }
  // 被追上：一屁股坐到地上，先压扁再弹回来，头上转着星星。结算画面上镜头推得很近，用两倍清晰度的那张
  function drawCaught(g) {
    const p = g.p, x = p.x - g.camX, y = laneY(p.z), k = dsc(p.z), f = Math.floor(perf() * .004) % 2;
    const b = caughtT >= 0 && caughtT < .32 ? Math.sin(caughtT / .32 * Math.PI) : 0;
    const A = M.sheets['player-side-caught-hi'], im = IMG['s:player-side-caught-hi'];
    shadow(x, y, 17 * k);      // drawPlayer 画的影子被大烟雾前面那层烟盖住了，这里再画一次，人才坐得住地
    c.save(); c.translate(x, y); c.scale(1 + .14 * b, 1 - .2 * b);
    if (A && im && im.width) {
      const cw = A.cell[0], ch = A.cell[1], s = U * k * CW / cw;
      c.drawImage(im, f * cw, 0, cw, ch, -AX * cw / CW * s, -AY * ch / CH * s, cw * s, ch * s);
      hatOn('player-side-caught', f, 0, 0, k);      // 帽子被撞歪了还扣在头上（tools/hat_fit.py 里手动改过这两帧）
    } else pSheet('player-side-caught', f, 0, 0, k);
    c.restore();
  }
  // 前面这条道被挡了：在能走的那条道上闪一个箭头
  function blockedArrow(g, x) {
    // 打老板时人被锁在原地、老板就站在你这条道上：这里的红条和换道箭头没有意义，只会让人以为是要点的东西（第三次试玩）
    const p = g.p; if (g.over || quiet || g.locked) return;
    // 提前多远开始提醒：按现在的速度留出 1 秒（迎面走来的路人按两个人的速度加起来算）。原来最多 210 个单位，冲刺时只剩 0.7 秒；
    // 还没进画面的交给右边缘的 edgeHints（2026-11-15 量的：撞上的东西从露出屏幕到撞上，高手中位数只有 0.83 秒，六成是在憋气冲刺时撞的）
    const look = b => (b.t === 'ped' ? p.v + (b.o.v || 0) : p.v) * 1;
    const hit = H.blockers(g, p.lane).filter(b => b.x0 > p.x && b.x0 - p.x < Math.max(80, look(b)) && b.x0 - g.camX < H.VW + 6 && !(b.o && b.o.lit === false) && H.stopsYou(g, b)).sort((a, b) => a.x0 - b.x0)[0];
    if (!hit && p.bump <= 0) return;
    /* 2026-11-16 重画：原来是地上一根半透明红条、头顶一个红色「!」圆点、旁边车道一个黄三角，三样都没字，看不懂（第三次试玩报告也说过），
     * 「!」还常压在上面那条道的道具上。现在：
     * - 要撞上的东西前面，地上立一块红白斜纹的路障牌（就是「此路不通」）；
     * - 从 Leo 脚下往能走的那条道弯过去一个粗箭头（就是「往这边换道」），箭头一伸一缩。第一局（教学局）箭头旁边写 SWIPE */
    if (hit) {
      const hx = hit.x0 - g.camX - 9, hy = laneY(p.lane), pu = .5 + .5 * Math.sin(perf() * .03), bw = 12, bh = LY - 18;
      c.save(); c.globalAlpha = .78 + .22 * pu;
      rr(hx - bw / 2, hy - bh / 2, bw, bh, 3); c.fillStyle = '#fff'; c.fill();
      c.save(); c.clip(); c.fillStyle = C.alarm; for (let k = -3; k < 6; k++) { const yy = hy - bh / 2 + k * 9; c.beginPath(); c.moveTo(hx - bw / 2, yy); c.lineTo(hx + bw / 2, yy - 6); c.lineTo(hx + bw / 2, yy - 1.5); c.lineTo(hx - bw / 2, yy + 4.5); c.closePath(); c.fill(); } c.restore();
      c.strokeStyle = C.ink; c.lineWidth = 2; rr(hx - bw / 2, hy - bh / 2, bw, bh, 3); c.stroke();
      c.restore();
    }
    const free = [p.lane - 1, p.lane + 1].filter(l => l >= 0 && l <= 2 && H.laneFree(g, l, p.x - 14, p.x + 60));
    if (!free.length) return;
    const to = free.sort((a, b) => H.density(g, p.x + 40, a, H.HEAD) - H.density(g, p.x + 40, b, H.HEAD))[0];
    // 弯箭头：从 Leo 前面一点、他这条道的地面，弯到要去的那条道，箭头尖在那条道的中线上
    const d = Math.sign(to - p.lane), x0 = x + 18, y0 = laneY(p.lane) - 4, stretch = .85 + .15 * Math.sin(perf() * .012), x1 = x0 + 34 * stretch, y1 = laneY(to) - 2;
    c.save(); c.globalAlpha = .85;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const curve = () => { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + 2, y1, x1 - 8, y1); };
    curve(); c.strokeStyle = C.ink; c.lineWidth = 9; c.stroke();
    curve(); c.strokeStyle = C.nic; c.lineWidth = 5; c.stroke();
    c.beginPath(); c.moveTo(x1 + 3, y1); c.lineTo(x1 - 9, y1 - 8); c.lineTo(x1 - 9, y1 + 8); c.closePath(); inkFill(C.nic, 2.2);
    if (g.tutorial) label(L('SWIPE'), x1 + 26, y1 - d * 2, 11, '#fff', C.ink, 900);
    c.restore();
  }

  /* 屏幕右缘的小箭头：还没进画面、但按现在的速度 1.5 秒内就到的烟民、障碍和迎面走来的路人，在它那条道的右边缘先露一个小标签，
   * 让人知道「下一个在这条道」。烟民是深色标签带一点橙色火星，挡路的东西和路人是红色标签。玩家这条道的亮，别的道淡一点。
   * 原来只看画面外 84 个单位，冲刺时只早 0.3 秒；改成按时间算，跑得越快露得越早（2026-11-15） */
  const WARN_T = 1.5;
  function edgeHints(g) {
    if (g.over || quiet || g.locked || g.intro) return;
    const p = g.p, cx = g.camX, R0 = H.VW - 4, px = p.x - cx, v = Math.max(60, p.v), near = [null, null, null];
    const take = (lane, sx, t, vv) => {
      if (lane < 0 || lane > 2 || sx < R0) return;
      const tt = (sx - px) / (v + (vv || 0)); if (tt > WARN_T) return;
      if (!near[lane] || tt < near[lane].tt) near[lane] = { sx, t, tt, t0: (R0 - px) / (v + (vv || 0)) };
    };
    for (const o of g.props) take(o.z, o.x0 - cx, 'prop');
    for (const s of g.smokers) if (s.lit && s.state === 'smoke' && s.kind !== 'scooter' && s.kind !== 'boss') take(Math.round(s.z), s.x - cx, 'smoker');
    if (!H.CFG.COURSE) for (const e of g.peds) if (!e.gone && !e.aside) take(e.lane, e.x - (e.half || 12) - cx, 'prop', e.v);      // 烟就是赛道：路人会让开，不再亮红色的「!」
    const pu = .5 + .5 * Math.sin(perf() * .012);
    for (let lane = 0; lane < 3; lane++) {
      const n = near[lane]; if (!n) continue;
      const mine = Math.round(p.z) === lane, y = laneY(lane) - 16, x = H.VW, u = clamp(1 - (n.tt - n.t0) / Math.max(.2, WARN_T - n.t0), 0, 1);      // 越近越亮
      /* 贴着屏幕右边的一个箭头标签，尖朝左（朝着 Leo）：「这条道有东西过来了」。障碍写「!」，烟民画一根点着的烟。
       * 原来是圆角方块里一个「>」，看着像能点的「下一页」按钮（2026-11-16） */
      c.save(); c.globalAlpha = (mine ? .8 + .2 * pu : .62) * (.65 + .35 * u);
      c.beginPath(); c.moveTo(x + 3, y - 11); c.lineTo(x - 11, y - 11); c.lineTo(x - 20, y); c.lineTo(x - 11, y + 11); c.lineTo(x + 3, y + 11); c.closePath();
      inkFill(n.t === 'prop' ? C.alarm : '#4a4560', 2);
      if (n.t === 'prop') label('!', x - 7, y + .5, 14, '#fff', C.ink, 900);
      else { c.fillStyle = '#fff'; c.fillRect(x - 12, y - 1.6, 10, 3.2); c.fillStyle = '#ff9d2e'; circ(x - 13, y, 2.4); c.fill(); }
      c.restore();
    }
  }

  /* ---------- 烟（按道分三层，和人物交错画） ---------- */
  function blob(rgb, seed) {
    const s = document.createElement('canvas'); s.width = s.height = 96;
    const x = s.getContext('2d'), r = H.rngOf(seed);
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28, d = 8 + r() * 22, cx = 48 + Math.cos(a) * d, cy = 48 + Math.sin(a) * d, rad = 15 + r() * 11;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, `rgba(${rgb},.62)`); gr.addColorStop(.62, `rgba(${rgb},.5)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, 96, 96);
    }
    return s;
  }
  const SMOKE = [blob('92,88,104', 3), blob('104,98,114', 8), blob('82,78,94', 21)];
  const STEAM = blob('250,253,255', 5);
  const BANDS = [-99, .5, 1.5, 99];
  /* 烟画成卡通的云团（2026-11-16）：会呛人的烟（香烟、电子烟、浓烟段）每一团画成一个实心圆，半径就是「浓到会呛」的那一圈
   * （单独一团烟浓度 s，离中心 r·√(1−0.07/s) 以内超过呛人的门槛，和 core.js 的 density 一样算），一个道里的圆合成一整块，
   * 外面描一圈墨线、里面上亮下暗。描边的地方就是会呛到的边，薄到不呛人的烟不画。
   * 原来是一团团模糊的灰紫色晕，没有轮廓，和描黑边的人物、房子放在一起像照片上的污渍。
   * 水汽（灭了烟、滋出来的洞、格栅的蒸汽）不伤人，照旧是软的白团：有描边的会呛，软的不会。
   * 做法：一个道里同一种烟的圆（大的加两个跟着慢慢转的小鼓包，边缘起伏像云）放进一条路径，
   * 在一张和画布一样大的 FC 上先描边、再用不透明的颜色填充（圆和圆重叠处的线被盖住，只剩外面一圈），
   * 然后只把这几团占的那一块半透明地贴回画布。直接在画布上半透明地画，里面的圆圈线会透出来，像一团毛线；
   * 用半分辨率的小画布，线是糊的。每个道最多两组（灰的、紫的），没有烟的道不画 */
  const FC = document.createElement('canvas'), fc = FC.getContext('2d');
  // body：整块贴回去的不透明度。和原来软烟最浓处差不多（约 0.65），在烟里的人（Leo、烟民）还看得清
  const SMOKE_LOOK = { fill: ['#cfcad9', '#8a8498'], ink: '#4a4460', body: .68 };
  const VAPOR_LOOK = { fill: ['#f0e7fb', '#b8a0de'], ink: '#6f53a3', body: .64 };
  /* 烟的颜色跟着天色变（2026-11-16）：原来天和地面压暗了，烟还是白天的浅紫，夜里整条人行道像一条发亮的带子，Leo 在里面只剩个影子。
   * 现在和地面压一样的颜色（夜里压得重一点，像暗处的雾），每帧在 drawDayLight 里算一次 */
  const SMOKE_DAY = SMOKE_LOOK.fill.slice(), VAPOR_DAY = VAPOR_LOOK.fill.slice(), RING_DAY = ['#e2dfea', '#9a94a9'], RING = RING_DAY.slice();
  // hole：Leo 在这块烟后面时，烟在他身上薄一点（2026-11-16）。原来整块烟 0.68 盖在他身上，夜里烟一暗，他在烟里只剩个影子
  function smokeGroup(list, n, L, hole) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < n; i += 3) {
      const x = list[i], y = list[i + 1], R = list[i + 2];
      if (x - R < x0) x0 = x - R; if (x + R > x1) x1 = x + R; if (y - R * 1.06 < y0) y0 = y - R * 1.06; if (y + R * 1.06 > y1) y1 = y + R * 1.06;
    }
    const T = c.getTransform(), m = 4;
    const X0 = Math.max(0, Math.floor(T.a * (x0 - m) + T.e)), X1 = Math.min(FC.width, Math.ceil(T.a * (x1 + m) + T.e));
    const Y0 = Math.max(0, Math.floor(T.d * (y0 - m) + T.f)), Y1 = Math.min(FC.height, Math.ceil(T.d * (y1 + m) + T.f));
    if (X1 <= X0 || Y1 <= Y0) return;
    fc.setTransform(1, 0, 0, 1, 0, 0); fc.clearRect(X0, Y0, X1 - X0, Y1 - Y0);
    fc.setTransform(T.a, T.b, T.c, T.d, T.e, T.f);
    fc.beginPath();
    for (let i = 0; i < n; i += 3) { const x = list[i], y = list[i + 1], R = list[i + 2]; fc.moveTo(x + R, y); fc.ellipse(x, y, R, R * 1.06, 0, 0, TAU); }
    fc.strokeStyle = L.ink; fc.lineWidth = 3.2; fc.stroke();
    const gr = fc.createLinearGradient(0, GT - 150, 0, laneY(2.6));
    gr.addColorStop(0, L.fill[0]); gr.addColorStop(1, L.fill[1]);
    fc.fillStyle = gr; fc.fill();
    if (hole) {
      const [hx, hy, hr] = hole; fc.save(); fc.globalCompositeOperation = 'destination-out'; fc.translate(hx, hy); fc.scale(1, 1.5);
      const hg = fc.createRadialGradient(0, 0, 0, 0, 0, hr); hg.addColorStop(0, 'rgba(0,0,0,.6)'); hg.addColorStop(.55, 'rgba(0,0,0,.5)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = hg; fc.fillRect(-hr, -hr, hr * 2, hr * 2); fc.restore();
    }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = L.body;
    c.drawImage(FC, X0, Y0, X1 - X0, Y1 - Y0, X0, Y0, X1 - X0, Y1 - Y0);
    c.restore();
  }
  const SG = new Float32Array(14700), VG = new Float32Array(14700);      // 每帧复用：700 团烟 × 最多 7 个圆 × (x, y, 半径)
  /* 一团烟：一个圆，大一点的再加两个小鼓包，跟着这团烟自己的相位慢慢转。
   * 很大的一团（电子烟吐的、浓烟段的）沿边上加六个小鼓包，一圈波浪边（2026-11-16）：原来也是两个，半个屏幕宽的一团只有一侧鼓两下，
   * 看着像一个浅紫色的大气球，不像烟 */
  function lumps(A, n, x, y, R, ph) {
    const k = R > 34 ? 6 : R > 9 ? 2 : 0;
    if (n + 3 * (k + 1) > A.length) return n;
    A[n++] = x; A[n++] = y; A[n++] = R;
    if (k === 2) for (let j = 0; j < 2; j++) { const a = ph + j * 2.6, r2 = R * (.6 - .12 * j); A[n++] = x + Math.cos(a) * R * .6; A[n++] = y + Math.sin(a) * R * .52; A[n++] = r2; }
    else for (let j = 0; j < k; j++) { const a = ph * .5 + j * TAU / k + .25 * Math.sin(j * 2.1), r2 = R * (.34 - .06 * (j & 1)); A[n++] = x + Math.cos(a) * R * .8; A[n++] = y + Math.sin(a) * R * .8; A[n++] = r2; }
    return n;
  }
  function drawSmokeBand(g, b) {
    const cx = g.camX, P = g.puffs, lo = BANDS[b], hi = BANDS[b + 1];
    let ns = 0, nv = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i]; if (q.z < lo || q.z >= hi) continue;
      const k = dsc(q.z), x = q.x - cx, y = laneY(q.z) - q.h * k;
      if (q.kind === 1) {      // 水汽：软的白团，直接画
        const r = q.r * 1.15 * k; if (x < -r || x > W + r || y < -r || y > VH + r) continue;
        c.globalAlpha = Math.min(1, q.s * 1.15); c.drawImage(STEAM, x - r, y - r, r * 2, r * 2); continue;
      }
      if (q.s < .075) continue;
      const R = q.r * k * Math.sqrt(1 - CFG.DMIN / q.s);
      if (x < -R || x > W + R || y < -R || y > VH + R || R < 1) continue;
      const ph = q.ph + q.age * .7;
      if (q.kind === 2) nv = lumps(VG, nv, x, y, R, ph); else ns = lumps(SG, ns, x, y, R, ph);
    }
    c.globalAlpha = 1;
    // 这一道的烟画在 Leo 前面（他在这道或更靠里的道）：在他身上开一个软的薄处
    const p = g.p, pz = p.z + (p.zo || 0), pk = dsc(pz), hole = g.over !== 'smog' && pz < hi ? [p.x - cx, laneY(pz) - (p.hopH || 0) * pk - 26 * pk, 26 * pk] : null;
    if (nv) smokeGroup(VG, nv, VAPOR_LOOK, hole);
    if (ns) smokeGroup(SG, ns, SMOKE_LOOK, hole);
  }

  function drawWorld(g, dt) {
    const cx = g.camX, t = perf() * .001, list = [];
    const vis = (x, m) => x - cx > -(m || 60) && x - cx < W + (m || 60);
    // 被追上、镜头推近的时候：Leo 身边的人一起被大烟雾吞掉，不再站在坐地上的 Leo 身后、和他叠在一起（2026-11-16 结算页看到的）
    const gulp = g.over === 'smog' && caughtT > .12, near = x => gulp && Math.abs(x - g.p.x) < 110;
    for (const o of g.props) if (!o.hidden && vis(o.x, 120)) list.push({ z: o.z, x: o.x, f: () => { const P = M.props[o.name]; shadow(o.x - cx, laneY(o.z), P ? P.w * .42 : 14, .16); propAt(o.name, o.x - cx, laneY(o.z) + 4, dsc(o.z)); } });
    for (const z of g.zones) if (z.x1 - cx > -20 && z.x0 - cx < W + 20) list.push({ z: .45, x: z.x0, f: () => fence(z.x0 - cx, z.x1 - cx) });
    for (const sh of g.shelters) if (sh.x1 - cx > -60 && sh.x0 - cx < W + 60) list.push({ z: -.4, x: sh.x0, f: () => shelter(sh.x0 - cx, sh.x1 - cx) });
    for (const s of g.smokers) {
      if (s.state === 'gone' || !s.awake && s.kind !== 'boss') continue;
      if (s.kind === 'boss' && s.phase === 'wait') continue;
      if (!vis(s.x, 80) || (near(s.x) && s.kind !== 'boss')) continue;
      list.push({ z: s.z, x: s.x, f: () => drawSmoker(g, s, s.x - cx) });
      if (s.dogLane != null) list.push({ z: s.dogLane + (s.z - s.lane) + .01, x: s.x, f: () => dogOnLane(s, s.x - cx) });
    }
    for (const q of g.rings) if (vis(q.x, 30)) list.push({ z: q.z + .02, x: q.x, f: () => smokeRing(q, q.x - cx) });
    for (const v of g.vents) if (v.air && vis(v.x, 80)) list.push({ z: v.z - .005, x: v.x - 60, f: () => airColumn(v, v.x - cx, t) });
    for (const hz of g.hazes || []) if (hz.sign !== false && vis(hz.x0, 90)) list.push({ z: -.42, x: hz.x0, f: () => hazeSign(hz.x0 - cx) });
    if (R.best && !quiet && vis(R.best.x, 90)) list.push({ z: -.44, x: R.best.x, f: () => bestFlag(R.best.x - cx, R.best.m) });
    for (const e of g.peds) if (e.on && !e.gone && vis(e.x) && !near(e.x)) list.push({ z: e.z, x: e.x, f: () => {
      const ex = e.x - cx, ey = laneY(e.z), dk = e.duck > 0 && H.duckSheet(e);      // 滑板从头顶飞过去时蹲下（第十二批）
      shadow(ex, ey, (e.half || 13) * dsc(e.z));
      if (dk) { sheet(dk, 0, ex, ey, dsc(e.z)); if (Math.abs(g.p.x - e.x) > 34) speech(L('Whoa!'), ex, ey - 50 * dsc(e.z), 13); return; }
      sheet(`${e.sheet}-side-walk`, Math.floor(e.walk) % 8, ex, ey, dsc(e.z)); if (e.say && (e.aside > .2 || g.t < (e.sayTo || 0))) speech(L('Sorry!'), ex, ey - 74, 13);
    } });
    for (const k of g.coins) if (!k.got && vis(k.x, 30)) list.push({ z: k.z - .01, x: k.x, f: () => drawPickup(k, k.x - cx, t) });
    for (const X of g.crosses) for (const car of X.cars) if (vis(car.x)) list.push({ z: car.z, x: car.x, f: () => carFront(car.x - cx, laneY(car.z), dsc(car.z) * .95, car.c) });
    if (!g._birds) g._birds = [];
    for (const b of g.birds) if (!b.made) { b.made = true; for (let i = 0; i < b.n; i++) g._birds.push({ x: b.x + (Math.random() - .5) * 60, z: clamp(b.z + (Math.random() - .5) * .6, -.3, 2.3), lift: 0, fly: false, t: Math.random() * 6, a: 1, dir: Math.random() < .5 ? -1 : 1, vx: 0, vl: 0 }); }
    if (g._birds.length > 40) g._birds = g._birds.filter(b => b.a > 0 && b.x > cx - 120);
    for (const b of g._birds) {
      if (b.a <= 0 || !vis(b.x)) continue;
      if (!b.fly && (Math.abs(g.p.x - b.x) < 90 && Math.abs(g.p.z - b.z) < 1.4 || g.jet > 0)) { b.fly = true; b.dir = 1; b.vx = 90 + Math.random() * 90; b.vl = 120 + Math.random() * 80; if (!quiet && H.Snd && Math.random() < .5) H.Snd.flap(); }
      if (b.fly) { b.x += b.vx * dt; b.lift += b.vl * dt; b.a -= dt * .7; }
      list.push({ z: b.z, x: b.x, f: () => bird(b, b.x - cx, dt) });
    }
    for (const b of g.bubbles) if ((!b.got || b.pop < .3) && vis(b.x, 30)) list.push({ z: b.z, x: b.x, f: () => bubble(b, b.x - cx) });
    // 补水点的字：框和消防栓画在地上（drawGroundCues），字放到最后画：原来人站在框里就把字盖住了（2026-11-16）
    for (const f of g.refills) if (vis(f.x, 60)) list.push({ z: 2.9, x: f.x, f: () => label(L('REFILL'), f.x - cx, laneY(0) + 8, 10, C.water) });
    for (const m of g.blowers) if (vis(m.x, 60)) list.push({ z: -.6, x: m.x, f: () => blower(m.x - cx, t) });
    // 戒烟大游行：跟着 Leo 跑的人（docs/22 的 B）。被追上那一幕不画（镜头推近，只演 Leo 和大烟雾）
    // 侧身挤过去时按偏出去的位置排前后；往里（店面那边）偏时照样画在它前面，不然人被它挡住大半，看不见自己（2026-11-16）
    const leoZ = (g.p.zo || 0) < -.05 ? g.p.z + .015 : g.p.z + (g.p.zo || 0) + .001;
    // 贴着 Leo 的那几个（前后 36 以内、比他靠下不到一条道）一律画在他后面：人多时下面那条道的人头会压住 Leo 的腿和身子（2026-11-16）
    if (!g.over) for (const f of g.parade || []) list.push({ z: Math.abs(f.x - g.p.x) < 36 && f.z > leoZ - .2 && f.z < leoZ + 1.2 ? Math.min(f.z, leoZ - .002) : f.z, x: f.x, f: () => drawJogger(g, f, f.x - cx) });
    list.push({ z: leoZ, x: g.p.x, f: () => {
      if (nudgeT <= 0) return drawPlayer(g);
      c.save(); c.translate(0, nudgeD * 6 * Math.sin(Math.PI * (1 - nudgeT / .2))); drawPlayer(g); c.restore();      // 滑到边上：往那边歪一下又回来
    } });
    list.sort((a, b) => a.z - b.z || a.x - b.x);
    let band = 0;
    for (const it of list) { while (it.z >= BANDS[band + 1]) drawSmokeBand(g, band++); it.f(); }
    while (band < 3) drawSmokeBand(g, band++);
    // 烟就是赛道（docs/35）：东西被前面那条道的烟盖住时，在烟上面再淡淡画一遍，透得出来
    if (H.CFG.COURSE) for (const o of g.props) if (!o.hidden && vis(o.x, 40) && Math.max(H.density(g, o.x, o.z, 30), o.z < 2 ? H.density(g, o.x, o.z + 1, 30) : 0) > .06) {
      c.globalAlpha = .55; propAt(o.name, o.x - cx, laneY(o.z) + 4, dsc(o.z)); c.globalAlpha = 1;
    }
  }
  // 浓烟段里的 AIR 格栅：一根往上吹的淡青色气柱，几颗亮点往上飘，顶上写 AIR。在这条道上松手就能换气
  function airColumn(v, x, t) {
    const y = laneY(v.z), k = dsc(v.z), w = (v.w || 90) * .5, top = y - 96 * k;
    const gr = c.createLinearGradient(0, y, 0, top);
    gr.addColorStop(0, 'rgba(160,240,236,.55)'); gr.addColorStop(.6, 'rgba(190,248,244,.28)'); gr.addColorStop(1, 'rgba(220,255,252,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(x - w * .62, y); c.lineTo(x - w, top); c.lineTo(x + w, top); c.lineTo(x + w * .62, y); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 7; i++) { const u = (t * .55 + i / 7) % 1, sx = x + Math.sin(i * 2.3 + t * 2) * w * .55 * (.4 + u * .6), sy = y - u * 90 * k; c.globalAlpha = (1 - u) * .9; circ(sx, sy, 2.2 + (i % 3)); c.fill(); }
    c.globalAlpha = 1;
    const by = top + 8 + Math.sin(t * 4) * 2;
    label(L('▲ AIR ▲'), x, by, 13 * Math.max(.9, k), '#0f8f8a', '#ffffff', 900); reserve(x, c.measureText(L('▲ AIR ▲')).width / 2 + 4, by, 13 * Math.max(.9, k) * .62 + 2);
  }
  /* 地铁格栅喷一阵蒸汽（每 3.2 秒喷 1.1 秒）：一团往上冲、越往上越散越淡，开头一下冲起来、最后慢慢散掉。
   * 原来是一块半透明的白色梯形，硬边、一下出现一下消失，看着像一道光柱（2026-11-15） */
  function steamColumn(v, x, now) {
    const y = laneY(v.z), k = dsc(v.z), u = 1.1 - v.on, env = Math.min(1, u / .18) * Math.min(1, v.on / .45), top = y - 118 * k * Math.min(1, .35 + u / .3);
    if (env <= 0) return;
    const gr = c.createLinearGradient(0, y, 0, top);
    gr.addColorStop(0, `rgba(255,255,255,${.42 * env})`); gr.addColorStop(.55, `rgba(255,255,255,${.2 * env})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(x - 20, y);
    // 两边是鼓鼓的弧线，跟着时间慢慢扭，不是直线
    const t = now * .004;
    c.bezierCurveTo(x - 30 + Math.sin(t) * 6, y - 40 * k, x - 46 + Math.sin(t + 1) * 8, (y + top) / 2, x - 30, top);
    c.quadraticCurveTo(x, top - 18 * k, x + 30, top);
    c.bezierCurveTo(x + 46 + Math.sin(t + 2) * 8, (y + top) / 2, x + 30 + Math.sin(t + 3) * 6, y - 40 * k, x + 20, y);
    c.closePath(); c.fill();
    // 往上翻的几小团：软边的白团（先画好的小图），越往上越大越淡
    for (let i = 0; i < 6; i++) {
      const w = (now * .0011 + i / 6) % 1, sx = x + Math.sin(i * 2.1 + now * .003) * 16 * (.4 + w), sy = y - w * 110 * k, r = (9 + w * 18) * k;
      c.globalAlpha = env * (1 - w) * .7; c.drawImage(WISP, sx - r, sy - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
  }
  const WISP = (() => { const s = document.createElement('canvas'); s.width = s.height = 48; const x = s.getContext('2d'), gr = x.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 48, 48); return s; })();
  function bubble(b, x) {
    const y = laneY(b.z) - b.h - Math.sin(b.ph) * 5;
    if (b.got) { const u = b.pop / .3; c.strokeStyle = `rgba(255,255,255,${1 - u})`; c.lineWidth = 2; circ(x, y, b.r * (1 + u * .8)); c.stroke(); return; }
    c.fillStyle = 'rgba(28,34,48,.1)'; ell(x, laneY(b.z), b.r * .7, b.r * .22); c.fill();
    const gr = c.createRadialGradient(x - b.r * .3, y - b.r * .3, 1, x, y, b.r);
    gr.addColorStop(0, 'rgba(255,255,255,.5)'); gr.addColorStop(.7, 'rgba(190,235,255,.18)'); gr.addColorStop(1, 'rgba(255,170,230,.35)');
    c.fillStyle = gr; circ(x, y, b.r); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.6; circ(x, y, b.r); c.stroke();
    c.strokeStyle = 'rgba(120,200,255,.7)'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, b.r - 2, .3, 1.4); c.stroke();
  }
  /* 候车亭：第十一批画的正面平视的一整座，200 个单位宽，正好盖满棚下那一段，按原图大小画。
   * 立在人行道的后沿，画在最靠里那条道的人的后面。（第一批那座是带侧面的画法，线条粗一倍，已经不用了。） */
  function shelter(x0, x1) {
    const P = M.props['shelter-front']; if (!P) return;
    const x = (x0 + x1) / 2, by = GT + 7;
    c.fillStyle = 'rgba(28,34,48,.13)'; ell(x, by - 1, P.w * .49, 4.5); c.fill();
    propAt('shelter-front', x, by, 1);
  }
  // 吹泡泡的小孩（第十一批）：站在人行道的后沿，三帧轮流放：吸气、鼓着腮吹、抬头看。小泡泡从泡泡棒的圆环里冒出来
  function blower(x, t) {
    const y = GT + 11, A = M.sheets['kid-side-bubbles']; if (!A) return;
    const K = 1.15, f = Math.floor(t * (A.fps || 3)) % A.frames, w = A.wand[1], wx = x + w[0] * U * K, wy = y + w[1] * U * K;      // 放大一点点：46 个单位高，到主角的肩膀
    shadow(x, y, 10, .18);
    sheet('kid-side-bubbles', f, x, y, K);
    for (let i = 0; i < 3; i++) { const u = ((t * .6 + i / 3) % 1); c.strokeStyle = `rgba(255,255,255,${1 - u})`; c.lineWidth = 1.2; circ(wx + 3 + u * 30, wy - 2 - u * 30, 2.5 + u * 5); c.stroke(); }
  }
  // 吸烟区的围栏（第十一批）：一段图左右接起来。段数取整，每段稍微拉一点点，让围栏正好从 x0 排到 x1、两头都收在横档上。
  // 牌子立在围栏后面靠左的位置，杆子的下半截被围栏挡住
  function fence(x0, x1) {
    const y = laneY(.45), P = M.props['zone-fence'], im = IMG['p:zone-fence'];
    propAt('zone-sign', x0 + 20, y - 3, 1);
    if (P && im && im.width) {
      const n = Math.max(1, Math.round((x1 - x0) / P.w)), w = (x1 - x0) / n;
      for (let i = 0; i < n; i++) c.drawImage(im, x0 + i * w, y - P.h, w + .4, P.h);
    }
    label(L('SMOKING AREA'), (x0 + x1) / 2, y - 122, 10, '#8a6a00', 'rgba(255,255,255,.95)'); reserve((x0 + x1) / 2, c.measureText(L('SMOKING AREA')).width / 2 + 4, y - 122, 8);      // 飘字绕开它
  }

  // 最好成绩的旗子：人行道后沿一根杆子，顶上一面金色三角旗，旗下写 BEST 和米数，轻轻飘
  function bestFlag(x, m) {
    const y = laneY(-.45), top = y - 86, w = Math.sin(perf() * .006) * 2.5;
    shadow(x, y, 6, .18);
    c.fillStyle = C.ink; rr(x - 2, top, 4, y - top, 2); c.fill();
    c.beginPath(); c.moveTo(x + 2, top + 2); c.quadraticCurveTo(x + 18, top + 8 + w, x + 34, top + 13 + w); c.quadraticCurveTo(x + 18, top + 18 + w, x + 2, top + 26); c.closePath(); inkFill('#ffc21a', 2.2);
    label(L('BEST'), x + 15, top + 13 + w * .5, 9, C.ink, '#ffe58a', 900);
    label(L('{n} m', { n: m.toLocaleString() }), x, top - 10, 11, '#8a6a00', 'rgba(255,255,255,.95)', 900);
  }
  // 浓烟段的入口：人行道后沿立一块吸烟区的牌子（第十一批吸烟区那块），在路上就看得出前面为什么是一整片烟，不全靠顶上那行 THICK SMOKE!
  function hazeSign(x) {
    const y = laneY(-.42);
    shadow(x, y, 9, .16); propAt('zone-sign', x, y + 2, 1);
    label(L('SMOKING AREA'), x, y - 100, 10, '#8a6a00', 'rgba(255,255,255,.95)');      // 紧贴在牌子上面，公园里不要飘到天上
    reserve(x, c.measureText(L('SMOKING AREA')).width / 2 + 4, y - 100, 8);      // 「THICK SMOKE!」就喊在这块牌子上方，原来正好压在这行字上（2026-11-16）
  }

  /* ---------- 水 ---------- */
  function drawDrops(g) {
    const cx = g.camX; c.lineCap = 'round';
    for (const d of g.drops) {
      const x = d.x - cx, y = laneY(d.z) - d.h * dsc(d.z), vx = d.vx * .03, vy = (d.vz * LY - d.vh) * .03;
      c.strokeStyle = '#7fd0ff'; c.lineWidth = 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x - vx, y - vy); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x - vx * .6, y - vy * .6); c.stroke();
    }
  }
  // 能点的地方：前方每个点着的烟头上一个小圈。点得准，正中烟头
  const cigOf = s => { const cg = s.cig || H.BODY[s.kind].cig; return { x: s.x + cg[0], h: cg[1] }; };
  function drawAim(g, mode) {
    if (mode !== 'play') return;
    const p = g.p, t = perf();
    for (const s of g.smokers) {
      if (!H.targetable(s)) continue;
      const dx = s.x - p.x; if (dx < 10 || dx > CFG.RANGE + 30) continue;
      // 有音乐时靶圈跟着拍子一起一跳（docs/22 的 D）：整条街的圈同时跳，看得出节奏，烟也在拍子上喷；没音乐时各自慢慢呼吸
      const q = cigOf(s), x = q.x - g.camX, y = laneY(s.z) - q.h * dsc(s.z), r = beatNow ? 9 + 3.2 * beatPulse() : 9 + Math.sin(t * .012 + s.x) * 1.5;
      if (x > H.VW - 6) continue;      // 人还在屏幕外：靶圈不画，右边的预警标签已经在说他要来了（原来半个圈压在标签上，2026-11-16）
      c.strokeStyle = C.ink; c.lineWidth = 4; circ(x, y, r); c.stroke();
      c.strokeStyle = g.water >= 1 ? '#fff' : '#ffe9a6'; c.lineWidth = 2; circ(x, y, r); c.stroke();
    }
    // 前面三条道全堵住（两个人加一个障碍、写字楼门口一伙人）：只有滋掉一个才过得去。
    // 量的：普通玩家一半以上死在这两种墙上，撞上去会被吐一脸烟、呛住、大烟雾扑上来。
    // 这时把该滋的那个（自己这条道的，或者最近的那条道的）靶圈闪成黄色、上面写 TAP!，只在墙前出现
    const cand = wallCand(g);
    if (cand) {
      const q = cigOf(cand), x = q.x - g.camX, y = laneY(cand.z) - q.h * dsc(cand.z), pu = .5 + .5 * Math.sin(t * .02), r = 13 + pu * 3;
      c.strokeStyle = C.ink; c.lineWidth = 6; circ(x, y, r); c.stroke();
      c.strokeStyle = C.nic; c.lineWidth = 3.4; circ(x, y, r); c.stroke();
      label(L('TAP!'), x, y - r - 11, 13, C.nic, C.ink, 900);
    }
  }
  // 前面三条道全堵住时该滋的那个（自己这条道的，或者最近的那条道的），没堵住是 null。drawAim 给他画黄色的 TAP!
  function wallCand(g) {
    const p = g.p; if (g.water < 1 || g.locked) return null;
    const look = Math.max(120, p.v * 1.4), ahead = l => H.blockers(g, l).some(b => b.x0 > p.x + 6 && b.x0 - p.x < look && H.stopsYou(g, b) && !(b.o && b.o.lit === false));
    if (!(ahead(0) && ahead(1) && ahead(2))) return null;
    return g.smokers.filter(s => H.targetable(s) && s.x - p.x > 10 && s.x - p.x < CFG.RANGE + 30).sort((a, b) => (Math.abs(a.z - p.z) - Math.abs(b.z - p.z)) || (a.x - b.x))[0] || null;
  }
  R.wallCand = wallCand;

  /* ---------- 大烟雾 ----------
   * 身体是代码画的一堵翻滚的烟墙：从屏幕左边一直堆到前沿，前沿是一串慢慢鼓动的烟团。
   * 脸（眉毛、眼睛、嘴）取自第四批美术的四种表情，叠在前沿上。
   * 试过直接用美术里那一整只云团：放大到一人多高以后像把图标贴在画面上，描边也比别的东西粗得多。
   */
  let quiet = false;      // 这一帧是不是背景演示，见 R.frame
  const SM = { light: '#8792aa', mid: '#667189', dark: '#4f5a72', deep: '#3b4457', rim: '#a9b3c8' };
  function drawSmog(g) {
    const S = g.smog; if (!S || !S.awake || g.attract) return;
    const gap = g.p.x - S.x, px = g.p.x - g.camX, t = perf() * .001, eat = g.over === 'smog';
    // 画面上的距离是压缩过的：甩得再远，它也在最左边露出一点；近到 40 以内才是真实距离，嘴到了人就到了
    // 追上以后它不再往前吞，贴在人背后停住：人坐在地上，它在后面坏笑（结算画面就看这一幕）
    const front = eat ? px - 8 : px - (gap <= 40 ? gap : 40 + (gap - 40) * .13) - 4;
    const top = laneY(-.5) - 92, bot = laneY(2.5) + 18, Hh = bot - top;
    // 前沿的烟团：中间往前鼓，各自慢慢胀缩、前后晃
    // 一直排到画面底下，烟团之间留足重叠：整堵墙没有平的底边，烟团的缝里也不会露出后面那块矩形的直边
    const pts = [], N = 8;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      pts.push([front - 64 + Math.sin(Math.min(1, u * 1.15) * Math.PI) * 18 + Math.sin(t * 1.9 + i * 1.9) * 4, top + 22 + (Hh + 6) * u, 36 + 7 * Math.sin(i * 2.3 + 1) + 3 * Math.sin(t * 1.5 + i * 1.3)]);
    }
    // 顶上往后退的烟团，连成起伏的顶
    for (let i = 0; i < 6; i++) pts.push([front - 108 - i * 44 + Math.sin(t * 1.2 + i) * 4, top + 10 + Math.sin(i * 1.7) * 12 + Math.cos(t * 1.1 + i * 2) * 3, 38 + 9 * Math.sin(i * 3.1)]);
    /* 画面底下再往下接 6 团、后面那块矩形也拉长（2026-11-21 用户：死掉的一瞬间，烟底下露出一小段，看得出是贴图）。
     * 原来烟团只排到画面底下一点，矩形比最后一团多出 10：被追上时镜头推近、往下挪，矩形的右下角和那道黑边就露出来，像一个台阶 */
    for (let i = 1; i <= 6; i++) pts.push([front - 64 + Math.sin(t * 1.9 + (N + i) * 1.9) * 4, top + 22 + (Hh + 6) * (1 + i / (N - 1)), 38 + 5 * Math.sin(i * 2.1)]);
    const body = () => { c.beginPath(); c.rect(-120, top + 8, front - 64 + 120, Hh + 420); for (const [x, y, r] of pts) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } };
    // 前面一层淡淡的烟气：贴着每个烟团的一团软烟，和街上的烟是同一种画法，没有直边
    for (let i = 0; i < N; i++) {
      const [x, y, r] = pts[i], hr = r + 26 + 5 * Math.sin(t * 1.3 + i * 2.2);
      c.globalAlpha = .34 + .08 * Math.sin(t * 1.1 + i * 1.7);
      c.drawImage(SMOKE[i % 3], x + 16 + 5 * Math.sin(t * .9 + i) - hr, y - hr, hr * 2, hr * 2);
    }
    c.globalAlpha = 1;
    // 轮廓：墨色描一圈，再填烟色
    body(); c.lineWidth = 5; c.strokeStyle = C.ink; c.lineJoin = 'round'; c.stroke(); c.fillStyle = SM.light; c.fill();
    // 明暗：越往后、越往下越暗，边界也是一团一团的
    c.save(); body(); c.clip();
    c.fillStyle = SM.mid;
    for (let i = 0; i < 6; i++) { circ(front - 126 - i * 40 + Math.sin(t * .9 + i * 2) * 5, top + Hh * (.52 + .2 * Math.sin(i * 1.9)) + Math.cos(t * .8 + i) * 4, 58 + 10 * Math.sin(i * 2.7)); c.fill(); }
    c.fillRect(-120, top + Hh * .82, front - 180 + 120, Hh + 420);
    c.fillStyle = SM.dark;
    for (let i = 0; i < 5; i++) { circ(front - 180 - i * 44 + Math.sin(t * .7 + i * 1.6) * 5, top + Hh * (.8 + .1 * Math.sin(i * 2.3)), 52 + 8 * Math.sin(i * 1.3)); c.fill(); }
    const dg = c.createLinearGradient(front - 100, 0, front - 310, 0); dg.addColorStop(0, 'rgba(59,68,87,0)'); dg.addColorStop(1, 'rgba(59,68,87,.8)');
    c.fillStyle = dg; c.fillRect(-120, top - 60, front + 120, Hh + 490);
    // 前沿每个烟团右上角一道亮边
    c.strokeStyle = SM.rim; c.lineWidth = 2.6; c.lineCap = 'round';
    for (let i = 0; i < N; i++) { const [x, y, r] = pts[i]; c.beginPath(); c.arc(x, y, r - 7, -1.25, -.25); c.stroke(); }
    c.restore();
    // 前面飘着的几小团（追上以后镜头推近，它们看着像几个散落的圆圈，不画）
    for (let i = 0; i < (eat ? 0 : 3); i++) {
      const x = front - 2 + 7 * Math.sin(t * 1.4 + i * 2.1), y = top + Hh * (.16 + .34 * i) + 9 * Math.cos(t * 1.1 + i * 1.7), r = 6 + 3 * Math.sin(t * 2 + i * 3);
      circ(x, y, r + 1.6); c.fillStyle = C.ink; c.fill(); circ(x, y, r); c.fillStyle = SM.light; c.fill();
    }
    // 脸
    // 追上的那一下张嘴扑上来，接着换成坏笑，一颠一颠地「嘿嘿嘿」；脸挪到人的左上方，凑到他头顶
    const laugh = eat && caughtT > .45;
    const name = eat ? (laugh ? 'smogface-chase' : 'smogface-lunge') : gap < 45 ? 'smogface-lunge' : blownT > 0 ? 'smogface-blown' : gap < 120 ? 'smogface-angry' : 'smogface-chase';
    const hi = eat && IMG['s:' + name + '-hi'] && IMG['s:' + name + '-hi'].width;
    const A = M.sheets[name + (hi ? '-hi' : '')], im = IMG['s:' + name + (hi ? '-hi' : '')];
    if (A && im && im.width) {
      const f = Math.floor(t * (A.fps || 4)) % A.frames, cw = A.cell[0], ch = A.cell[1], fh = eat ? 108 : 128, fw = fh * cw / ch;
      let fx = front - fw - 10 + Math.sin(t * 1.9 + 5.7) * 3, fy = top + Hh * .16 + Math.sin(t * 2.6) * 2.5;
      if (eat) {
        fx = front - fw + 22; fy = laneY(g.p.z) - 132 - (laugh ? Math.abs(Math.sin(caughtT * 12)) * 4 : 0);
        faceAt = { x: fx + fw * .5, y: fy + fh * .28 };
      }
      c.drawImage(im, f * cw, 0, cw, ch, fx, fy, fw, fh);
    }
  }
  const WL = Array.from({ length: 12 }, () => ({ x: Math.random() * W, y: Math.random() * 600, l: 14 + Math.random() * 22 }));
  function drawWindLines(g, dt) {
    c.lineCap = 'round'; c.lineWidth = 1.6;
    const vx = g.wind.x, vy = g.wind.z * LY, n = Math.hypot(vx, vy) || 1, ux = vx / n, uy = vy / n;
    // 只在人行道上飘（2026-11-16）：原来从楼顶一直到最下面那条道，白色斜线划过店面，像玻璃上的划痕
    for (let i = 0; i < 7; i++) {
      const w = WL[i];
      w.x += (vx * 2.6 - (g.p.v || 0) * .3) * dt; w.y += vy * 2.6 * dt;
      const top = GT + 8, bot = laneY(2) + 26;
      if (w.x < -30) w.x += W + 60; if (w.x > W + 30) w.x -= W + 60; if (w.y < top || w.y > bot) { const h = bot - top; w.y = top + ((w.y - top) % h + h) % h; }
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(w.x, w.y); c.lineTo(w.x - ux * w.l, w.y - uy * w.l); c.stroke();
    }
  }

  /* ---------- 特效：文字和碎片用“世界 x + 屏幕 y” ---------- */
  const texts = [], bits = [];
  // 每帧排飘字用：TXT 按先后排好的字，BOX 已经放下的字占的框（中心 x、半宽、中心 y、半高），SPB 这一帧人说的话占的框
  const TXT = [], BOX = new Float32Array(160), SPB = new Float32Array(96);
  let nsp = 0;
  // 烟民、路人说的话（Oops. Okay, okay. Sorry!）：照旧画在人头上，顺手记下占的框，飘字排的时候当成已经放下的字绕开（2026-11-16：「Okay, okay.」压着「SMOG −3 m」）
  // 烟民站在画面边上时，这句话往里挪，整句留在画面里（2026-11-16：「Fair enough.」在右边只露出半句）
  function speech(s, x, y, size) {
    s = L(s);      // 烟民、路人头上的话是 core.js、main.js 写进去的英文，画的时候再翻
    c.font = `800 ${size}px ${FONT}`; const hw = c.measureText(s).width / 2 + size * .2 + 2;
    x = clamp(x, hw + 2, Math.max(hw + 2, H.VW - hw - 2));
    label(s, x, y, size, C.ink); reserve(x, hw, y, size * .62 + 2);
  }
  // 画面上已经有字的一块（人说的话、Leo 头上的连冲数、▲ AIR ▲）：飘字排的时候绕开（2026-11-16：PERFECT!、+2 压在 ×2 和 ▲ AIR ▲ 上）
  function reserve(x, hw, y, hh) { if (nsp + 4 <= SPB.length) { SPB[nsp++] = x; SPB[nsp++] = hw; SPB[nsp++] = y; SPB[nsp++] = hh; } }
  let shake = 0;
  const PRI = { big: 4, good: 3, info: 2, pts: 1, fx: 0 };
  /* 大字一次只喊一个（2026-11-16）：捡滑板喊「SKATEBOARD!」，紧接着冲出烟喊「PERFECT! ×2」，两行大字叠在屏幕中间，正挡着前面的路。
   * 一个大字刚喊出来（不到 0.45 秒）时，后来的大字先排队，等它喊完再出，出在同一块屏幕位置（镜头走了多少就跟着挪多少）；
   * 新的大字出来时，前一个赶紧淡掉。呛到、没气、被撞、被追上这几声不等，马上出。排了 1.2 秒还没轮到的就不出了 */
  const BIG_T = .45, URGENT_EN = ['*COUGH*', 'HAAAH', 'OUCH!', 'GOTCHA!', 'SECOND WIND!', 'BACK IN THE RUN!'], bigQ = [];
  const URGENT = { has: s => URGENT_EN.some(e => L(e) === s) };      // 传进来的是翻好的字，按当前语言比
  let viewX = 0, fxT = 0;
  R.say = (s, x, y, size, col, life, kind) => {
    kind = kind || 'info';
    if (kind === 'fx' && texts.some(t => t.kind === 'fx' && t.t < .4)) return;      // 「PSSST!」「FSSH!」这种声音字同时只冒一个
    if (kind === 'pts') {
      const m = texts.find(t => t.kind === 'pts' && t.t < .3 && Math.abs(t.x - x) < 70 && Math.abs(t.y - y) < 40);
      if (m) { m.s = '+' + ((+m.s.slice(1) || 0) + (+s.slice(1) || 0)); m.t = Math.min(m.t, .1); return; }
    }
    // 同样的字还挂在附近（连着两下正中、连着两次撞）：不再叠一行一模一样的，原来那块从头再来一遍、跟到新位置（2026-11-15，屏幕上叠着两行 BULLSEYE!）
    const same = texts.find(t => t.s === s && t.out == null && t.t < t.life * .8 && Math.abs(t.x - x) < 140);
    if (same) { same.t = 0; same.x = x; same.y = Math.min(same.y, y); return; }
    if (kind === 'big') {
      const live = texts.some(t => t.kind === 'big' && t.out == null && t.t < BIG_T);
      if (live && !URGENT.has(s)) { if (bigQ.length >= 2) bigQ.shift(); bigQ.push({ a: [s, x, y, size, col, life, kind], cam: viewX, at: fxT }); return; }
      for (const t of texts) if (t.kind === 'big' && t.out == null) t.out = .16;      // 前一个大字 0.16 秒淡掉，让出位置
    }
    for (let i = 0; i < 4; i++) { if (!texts.some(t => t.out == null && Math.abs(t.x - x) < 80 && Math.abs(t.y - y) < 22)) break; y -= 22; }
    texts.push({ s, x, y, size, col: col || '#fff', t: 0, life: life || .75, rise: kind === 'big' ? 46 : 28, kind, pri: PRI[kind] || 0 });
    if (texts.length > 5) { let wi = 0; for (let i = 1; i < texts.length; i++) if (texts[i].pri < texts[wi].pri || (texts[i].pri === texts[wi].pri && texts[i].t > texts[wi].t)) wi = i; texts.splice(wi, 1); }
  };
  R.drop = str => { for (let i = texts.length - 1; i >= 0; i--) if (texts[i].s === str) texts.splice(i, 1); for (let i = bigQ.length - 1; i >= 0; i--) if (bigQ[i].a[0] === str) bigQ.splice(i, 1); };
  let coughT = 0, card = null, flashT = 0, cueT = 0, coinSeen = 0, coinPop = 0;      // coinSeen / coinPop：顶栏金币数和捡到时弹一下
  // 教 PERFECT：头刚冲出烟的那 0.3 秒，气圈外面亮一圈金色（只在头几次，main.js 管）
  R.perfectCue = () => { cueT = CFG.PERFECT_T; };
  R.cough = () => { coughT = .35; };
  let nudgeT = 0, nudgeD = 0, blockT = 0, blockZ = 0;
  R.nudge = d => { nudgeT = .2; nudgeD = d; };
  R.blocked = z => { blockT = .4; blockZ = z; };
  R.clearTexts = () => { texts.length = 0; bigQ.length = 0; };
  R.card = (title, sub) => { card = { title, sub, t: 0 }; };
  R.cardUp = () => !!card && card.t < 2.4;      // 横幅还挂着（提示先等它走）
  // a：最亮时盖多少（默认 0.85），col：什么颜色。换街区在晚上用深蓝、白天用淡一点的白（2026-11-16：夜里整屏闪成一片白，刺眼）
  let flashA = .85, flashC = '#fff';
  R.flash = (a, col) => { flashT = .5; flashA = a == null ? .85 : a; flashC = col || '#fff'; };
  R.burst = (x, y, n, spd, col) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = spd * (.35 + Math.random() * .8); bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: .3 + Math.random() * .35, r: 1.6 + Math.random() * 2.4, col: col || '#7fd0ff' }); } };
  R.confetti = (x, y, n) => {
    const cols = ['#f0433a', '#e3b505', '#1c9bf0', '#2fbf71', '#ef7aa6', '#fff'];
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.2, v = 180 + Math.random() * 260; bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 1.4 + Math.random() * .9, r: 3 + Math.random() * 3, col: cols[i % cols.length], conf: true, rot: Math.random() * 6, vr: (Math.random() - .5) * 14 }); }
  };
  R.shake = v => { shake = Math.max(shake, v); };
  R.clearFx = () => { coinSeen = 0; coinPop = 0; texts.length = 0; bigQ.length = 0; bits.length = 0; arriveT = 0; shownScore = 0; lastScore = 0; coughT = 0; card = null; flashT = 0; chainSeen = 0; chainPop = 0; reliefT = 0; blownT = 0; caughtT = -1; taunt = ''; cam = null; };
  /* 被追上以后的那一幕：镜头推近到人和大烟雾身上（人坐在地上冒星星，大烟雾贴在他背后坏笑），
   * 大烟雾说一句风凉话，说的就是这次栽在哪儿。结算画面压在下半截，上半截一直演着这一幕 */
  let caughtT = -1, taunt = '', faceAt = null, cam = null;
  R.caught = s => { caughtT = 0; taunt = s || ''; card = null; };
  // 撒在整个屏幕上的彩带（破纪录），不跟着镜头走
  R.confettiScreen = n => {
    const cols = ['#f0433a', '#e3b505', '#1c9bf0', '#2fbf71', '#ef7aa6', '#fff'];
    for (let i = 0; i < n; i++) bits.push({ x: Math.random() * W, y: -10 - Math.random() * 120, vx: (Math.random() - .5) * 120, vy: 60 + Math.random() * 160, t: 0, life: 2.2 + Math.random() * 1.2, r: 3 + Math.random() * 3, col: cols[i % cols.length], conf: true, scr: true, rot: Math.random() * 6, vr: (Math.random() - .5) * 14 });
  };
  const CAUGHT_K = 1.6;
  function caughtCam(g) {
    if (caughtT < 0 || g.over !== 'smog') return null;
    const p = g.p, u = 1 - Math.pow(1 - clamp(caughtT / .7, 0, 1), 3), k = 1 + (CAUGHT_K - 1) * u;
    // 对准人和他左上方那张脸的中间，放到屏幕上半截（下半截是结算）
    const fx = (p.x - g.camX - 20) * Z, fy = GT + (laneY(p.z) - 58 - GT) * Z;
    // 脚要落在结算那块深色底的上面（矮屏幕上往上提一点）
    const tx = Math.min(W * .56, fx * k + 40), ty = Math.min(safeTop + (VH * .5 - safeTop) * .56, VH * .46 - 58 * Z * CAUGHT_K - 8);
    return { k, u, fx, fy, tx: fx + (tx - fx) * u, ty: fy + (ty - fy) * u };
  }
  // 街道坐标（放大前）→ 屏幕坐标
  const camPt = (x, y) => ({ x: cam.tx + (x * Z - cam.fx) * cam.k, y: cam.ty + (GT + (y - GT) * Z - cam.fy) * cam.k });
  function drawCaughtFront() {
    // 四周压暗，眼睛落在人和那张脸上
    const gr = c.createRadialGradient(cam.tx, cam.ty, 80, cam.tx, cam.ty, 470);
    gr.addColorStop(0, 'rgba(18,20,32,0)'); gr.addColorStop(1, `rgba(18,20,32,${(.5 * cam.u).toFixed(3)})`);
    c.fillStyle = gr; c.fillRect(0, 0, W, VH);
    if (!taunt || !faceAt || caughtT < .8) return;
    // 风凉话的气泡：从脸的右上方冒出来，先弹大一点再落回去
    const a = clamp((caughtT - .8) / .25, 0, 1), k = a < 1 ? .55 + .45 * a + Math.sin(a * Math.PI) * .18 : 1;
    const F = camPt(faceAt.x, faceAt.y);
    c.font = `900 19px ${FONT}`;
    // 一行放得下就一行；放不下折成两行，挑两行最齐的那个断点，不要第二行只剩一个词
    let lines = [taunt];
    if (c.measureText(taunt).width > 236) {
      let bestW = 1e9;
      for (const [a, b] of splits(taunt)) { const w = Math.max(c.measureText(a).width, c.measureText(b).width); if (w < bestW) { bestW = w; lines = [a, b]; } }      // 中文没有空格，每两个字之间都能断（i18n.js 的 splits）
    }
    const bw = Math.max(...lines.map(s => c.measureText(s).width)) + 30, bh = lines.length * 24 + 20;
    const bx = clamp(F.x + 70, bw / 2 + 12, W - bw / 2 - 12), by = Math.max(safeTop + 70 + bh / 2, F.y - 64 - bh / 2);
    c.save(); c.translate(bx, by); c.scale(k, k); c.rotate(-.03);
    // 尾巴指向那张脸
    const tx = clamp(F.x - bx, -bw / 2 + 18, bw / 2 - 30), ty = F.y - by - 6;
    const tail = () => { c.beginPath(); c.moveTo(tx + 8, bh / 2 - 6); c.lineTo(tx * .85 - 8, Math.min(ty, bh / 2 + 34)); c.lineTo(tx + 30, bh / 2 - 6); c.closePath(); };
    c.fillStyle = C.ink; rr(-bw / 2, -bh / 2 + 4, bw, bh, 16); c.fill();
    tail(); c.lineWidth = 6; c.strokeStyle = C.ink; c.lineJoin = 'round'; c.stroke();
    rr(-bw / 2, -bh / 2, bw, bh, 16); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = C.ink; c.stroke();
    tail(); c.fillStyle = '#fff'; c.fill();
    c.fillStyle = C.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((s, i) => c.fillText(s, 0, (i - (lines.length - 1) / 2) * 24 + 1));
    c.restore();
  }
  function drawScreenBits() {
    for (const b of bits) {
      if (!b.scr) continue;
      c.globalAlpha = Math.min(1, (b.life - b.t) * 2); c.fillStyle = b.col;
      c.save(); c.translate(b.x, b.y); c.rotate(b.rot); c.fillRect(-b.r, -b.r * .5, b.r * 2, b.r); c.restore();
    }
    c.globalAlpha = 1;
  }
  R.stepFx = function (dt) {
    cueT = Math.max(0, cueT - dt);
    for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.t += dt; t.y -= dt * t.rise; if (t.out != null) t.out -= dt; if (t.t >= t.life || t.out <= 0) texts.splice(i, 1); }
    fxT += dt;
    while (bigQ.length && fxT - bigQ[0].at > 1.2) bigQ.shift();
    if (bigQ.length && !texts.some(t => t.kind === 'big' && t.out == null && t.t < BIG_T)) { const q = bigQ.shift(); q.a[1] += viewX - q.cam; R.say(...q.a); }
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]; b.t += dt;
      if (b.conf) { b.vy += dt * 260; b.vx *= 1 - dt * 1.2; b.vy *= 1 - dt * 1.4; b.rot += b.vr * dt; } else b.vy += dt * 340;
      b.x += b.vx * dt; b.y += b.vy * dt; if (b.t >= b.life) bits.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 26); nudgeT = Math.max(0, nudgeT - dt); blockT = Math.max(0, blockT - dt);
    coughT = Math.max(0, coughT - dt); flashT = Math.max(0, flashT - dt); reliefT = Math.max(0, reliefT - dt); blownT = Math.max(0, blownT - dt);
    if (card) { card.t += dt; if (card.t > 2.4) card = null; }
    if (caughtT >= 0) caughtT += dt;
  };
  function drawFx(g) {
    const cx = g.camX; viewX = cx;
    // 要去的道被挡住：那条道上、人前面一点亮一个红叉
    if (blockT > 0 && !g.over) {
      const bx = g.p.x - cx + 26, by = laneY(blockZ) - 22, r = 9 + (1 - blockT / .4) * 3;
      c.save(); c.globalAlpha = Math.min(1, blockT / .15); circ(bx, by, r + 3); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = C.ink; c.lineWidth = 2; c.stroke();
      c.strokeStyle = C.alarm; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx - r * .55, by - r * .55); c.lineTo(bx + r * .55, by + r * .55); c.moveTo(bx + r * .55, by - r * .55); c.lineTo(bx - r * .55, by + r * .55); c.stroke(); c.restore();
    }
    for (const b of bits) {
      if (b.scr) continue;
      c.globalAlpha = b.conf ? Math.min(1, (b.life - b.t) * 2) : 1 - b.t / b.life; c.fillStyle = b.col;
      if (b.conf) { c.save(); c.translate(b.x - cx, b.y); c.rotate(b.rot); c.fillRect(-b.r, -b.r * .5, b.r * 2, b.r); c.restore(); }
      else { circ(b.x - cx, b.y, b.r); c.fill(); }
    }
    c.globalAlpha = 1;
    /* 飘字按画面上真正占的那一块排开：先放要紧的（大字、好消息），后面的要是和已经放下的叠在一起，就往上挪到它上面，挪的时候是滑过去的。
     * 原来只在出字那一下看「横着 80、竖着 22 以内有没有别的字」，不管字有多宽、也不管贴着屏幕边被推回来的字：
     * 「PHEW! ×1」和「THICK SMOKE!」叠成了「PHEW! ×1HICK SMOKE!」（2026-11-16） */
    TXT.length = 0; for (const t of texts) TXT.push(t);
    TXT.sort((a, b) => (b.pri - a.pri) || (a.t - b.t));
    let nb = 0;
    for (let i = 0; i < nsp; i++) BOX[nb++] = SPB[i];      // 人说的话先占上
    nsp = 0;
    for (const t of TXT) {
      if (t.out != null) { t.sx = t.sx == null ? clamp(t.x - cx, 30, H.VW - 30) : t.sx; continue; }      // 正在让位的大字不占地方，原地淡掉
      c.font = `900 ${t.size}px ${FONT}`; const hw = c.measureText(t.s).width * .62 + 6, hh = t.size * .62 + 2;
      const sx = clamp(t.x - cx, hw, Math.max(hw, H.VW - hw));
      let y = t.y;
      for (let n = 0; n < 6; n++) {
        let hit = -1;
        for (let i = 0; i < nb; i += 4) if (Math.abs(sx - BOX[i]) < hw + BOX[i + 1] && Math.abs(y - BOX[i + 2]) < hh + BOX[i + 3]) { hit = i; break; }
        if (hit < 0) break;
        y = BOX[hit + 2] - BOX[hit + 3] - hh - 2;
      }
      t.oy = t.oy == null ? y - t.y : t.oy + (y - t.y - t.oy) * .35;
      t.sx = sx;
      if (nb < BOX.length) { BOX[nb++] = sx; BOX[nb++] = hw; BOX[nb++] = t.y + t.oy; BOX[nb++] = hh; }
    }
    for (const t of texts) {
      const u = t.t / t.life, k = u < .16 ? .5 + u / .16 * .72 : 1.22 - (Math.min(u, .3) - .16) * 1.5;
      c.save(); c.translate(t.sx, t.y + (t.oy || 0)); c.scale(k, k); c.globalAlpha = Math.min(u > .72 ? (1 - u) / .28 : 1, t.out != null ? Math.max(0, t.out / .16) : 1);
      c.font = `900 ${t.size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.lineWidth = t.size * .24; c.strokeStyle = C.ink; c.strokeText(t.s, 0, 0); c.fillStyle = t.col; c.fillText(t.s, 0, 0);
      c.restore();
    }
  }
  const VIG = (() => { const s = document.createElement('canvas'); s.width = 200; s.height = 320; const x = s.getContext('2d'); const gr = x.createRadialGradient(100, 160, 70, 100, 160, 210); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = gr; x.fillRect(0, 0, 200, 320); return s; })();
  let inSmoke = 0, lowAir = 0, holdV = 0;
  function drawTint(g) {
    const p = g.p;
    inSmoke += ((p.holding ? 0 : clamp(g.dens, 0, 1)) - inSmoke) * .12;
    lowAir += ((p.holding && p.breath < 1.5 ? (1.5 - p.breath) / 1.5 : 0) - lowAir) * .12;
    if (inSmoke > .02) { c.globalAlpha = inSmoke * .4; c.fillStyle = '#b58f2a'; c.fillRect(0, 0, W, VH); c.globalAlpha = 1; }
    if (lowAir > .02) { c.globalAlpha = lowAir * (.62 + .28 * Math.sin(perf() * .012)); c.drawImage(VIG, 0, 0, W, VH); c.globalAlpha = 1; }
    if (coughT > 0) { c.globalAlpha = coughT / .35 * .55; c.fillStyle = '#8a6a3a'; c.drawImage(VIG, 0, 0, W, VH); c.globalAlpha = 1; }
    holdV += ((p.holding ? .2 : 0) - holdV) * .15;
    if (holdV > .02) { c.globalAlpha = holdV; c.drawImage(VIG, 0, 0, W, VH); c.globalAlpha = 1; }
    const S = g.smog, near = S && S.awake && !quiet ? clamp(1 - S.gap / 140, 0, 1) : 0;
    if (near > .02) { const gr = c.createLinearGradient(0, 0, W * .75, 0); gr.addColorStop(0, `rgba(30,26,44,${.7 * near})`); gr.addColorStop(1, 'rgba(30,26,44,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, VH); }
  }
  let cardDy = 0;
  function drawCard() {
    if (!card) return;
    // 一条窄的横幅，放在顶栏和提示的下面、暂停键的左边：不盖气、不盖大烟雾的距离、不盖暂停
    // 打老板时顶栏下面有老板条和这一招的提示（POP THE RINGS! 这些），横幅往下让一截，不压在提示上（2026-11-16）
    const u = card.t, k = u < .25 ? u / .25 : u > 2 ? Math.max(0, (2.4 - u) / .4) : 1, y = safeTop + 10 + 150 + cardDy;
    c.save(); c.globalAlpha = k; c.translate(170 + (1 - k) * 60, y); c.rotate(-.02);
    rr(-150, -29, 300, 58, 12); inkFill(C.ink, 3); c.strokeStyle = C.nic; c.lineWidth = 2.6; rr(-144, -23, 288, 46, 9); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.nic;
    c.font = `900 21px ${FONT}`; const tw = c.measureText(card.title).width; if (tw > 270) c.font = `900 ${(21 * 270 / tw).toFixed(1)}px ${FONT}`;
    c.fillText(card.title, 0, -7);
    // 副标题太长就缩小字号，不让它伸出卡片
    c.font = `800 11px ${FONT}`; const sw = c.measureText(card.sub).width;
    if (sw > 272) c.font = `800 ${(11 * 272 / sw).toFixed(1)}px ${FONT}`;
    c.fillStyle = '#fff'; c.fillText(card.sub, 0, 13);
    c.restore();
  }

  /* ---------- HUD ---------- */
  function pill(x, y, w, h, fill) {
    c.fillStyle = C.ink; rr(x, y + 3, w, h, h / 2.6); c.fill();
    c.fillStyle = fill || '#fff'; rr(x, y, w, h, h / 2.6); c.fill();
    c.strokeStyle = C.ink; c.lineWidth = 2.6; c.stroke();
  }
  function bar(x, y, w, h, u, col) {
    c.fillStyle = '#e3e7eb'; rr(x, y, w, h, h / 2); c.fill();
    const iw = Math.max(0, w * clamp(u, 0, 1));
    if (iw > 1) { c.fillStyle = col; rr(x, y, Math.max(iw, h), h, h / 2); c.fill(); }
    c.strokeStyle = C.ink; c.lineWidth = 1.6; rr(x, y, w, h, h / 2); c.stroke();
  }
  function lungs(x, y, u) {
    const col = mix('#ff9fb0', '#4a4a4a', u);
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(x + s * 6, y + 2, 5.5, 8.5, s * .25, 0, TAU); inkFill(col, 1.8); }
    c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x, y - 2); c.stroke();
  }
  const MCOL = ['#e3e7eb', '#e3e7eb', '#a9e4ee', '#8fe0a8', '#f6c624', '#ff8a7a'];
  let shownScore = 0, scorePop = 0, lastScore = 0, goalN = 0, goalPop = 0;
  function drawHud(g, hint, dt) {
    const t = safeTop + 10, now = perf(), p = g.p, air = p.breath / g.k.breath, S = g.smog;
    chainPop = Math.max(0, chainPop - dt);
    c.textBaseline = 'middle';
    // 跑了多远
    const nb = R.best && R.best.passed && !g.attract;      // 这一局已经破了纪录：米数那一格变金色
    pill(10, t, 112, 34, nb ? '#ffd23f' : '#fff');
    c.font = `900 17px ${FONT}`; c.textAlign = 'right'; c.fillStyle = C.ink; c.fillText(Math.floor(p.x / CFG.M).toLocaleString(), 98, t + 18);
    if (nb) { c.font = `900 7px ${FONT}`; c.textAlign = 'left'; c.fillStyle = C.ink; c.fillText(L('BEST'), 18, t + 9); }
    c.font = `800 10px ${FONT}`; c.textAlign = 'left'; c.fillStyle = C.muted; c.fillText(L('m'), 102, t + 20);
    // 街区
    // 第二行原来是 8 像素的「DAY 1 · BEST BREATH ×4」，手机上不到 8 点、看不清，「BEST BREATH」也看不懂（其实是这一局最长连冲）。
    // 现在大一号，只写第几天，第 4 天起加上时辰（2026-11-16）
    pill(128, t, 150, 34, C.sky);
    c.font = `900 11px ${FONT}`; c.textAlign = 'center'; c.fillStyle = C.ink; c.fillText(L(g.stop.name).toUpperCase(), 203, t + 12.5);
    const ph = g.day >= 1 ? H.phaseOf(g.day) : '';      // 第 2 天起写时辰：每种天都有一条规则
    c.font = `800 9.5px ${FONT}`; c.fillStyle = '#3d5a66'; c.fillText(`${L('DAY {n}', { n: g.day + 1 })}${ph ? ' · ' + L(ph[0].toUpperCase() + ph.slice(1)).toUpperCase() : ''}`, 203, t + 25);
    // 水
    pill(284, t, 106, 34, '#fff');
    const n = Math.floor(g.water + .001);
    c.textAlign = 'left'; c.fillStyle = C.ink;
    if (g.k.water <= 4) {
      c.font = `900 9px ${FONT}`; c.fillText(L('WATER'), 293, t + 18);
      for (let i = 0; i < g.k.water; i++) { circ(339 + i * 13, t + 17, 4.6); inkFill(i < n ? '#7fd0ff' : '#e3e7eb', 1.6); }
    } else {
      // 带了大水箱：一行放不下，字在上、水滴在下
      c.font = `900 8px ${FONT}`; c.fillText(L('WATER'), 295, t + 10);
      const sp = Math.min(12.6, 84 / (g.k.water - 1)), rad = Math.min(4.2, sp * .36);      // 水最多能到 9 发，挤一挤
      for (let i = 0; i < g.k.water; i++) { circ(299 + i * sp, t + 22, rad); inkFill(i < n ? '#7fd0ff' : '#e3e7eb', 1.4); }
    }
    /* 第二排整条给「大烟雾离你多远」：左头是大烟雾，Leo 的头沿着线移动，离它越近越危险，逼近时两个头像都换成着急的那张（第十一批的头像）。
     * 原来左边大半条是 BREATH 气量条，和 Leo 头上的气圈是同一个数，眼睛在 Leo 身上时也看不到顶栏；去掉以后这一条够长，远近一眼看得出（2026-11-16） */
    // 这一局捡了多少金币：第二排最左边一小格，捡到时数字弹一下（同类跑酷都把金币数一直摆在顶上；原来要到结算才知道，2026-11-16）
    if (g.coinsGot !== coinSeen) { if (g.coinsGot > coinSeen) coinPop = .22; coinSeen = g.coinsGot; }
    coinPop = Math.max(0, coinPop - dt);
    pill(10, t + 42, 86, 26, '#fff');
    const ci = IMG['i:item-coin'], ck = 1 + coinPop * 1.4;
    if (ci && ci.width) c.drawImage(ci, 17, t + 46, 18, 18); else { circ(26, t + 55, 8); inkFill(C.nic, 1.6); }
    // 顶栏只写这一局捡了几枚（2026-11-21，docs/32）。原来后面挂着「×1.2」（任务等级、金币翻倍的加成），用户看不懂；加成在结算页拆开写
    const cs = g.coinsGot.toLocaleString();
    c.font = `900 13px ${FONT}`; const cw = c.measureText(cs).width;
    c.save(); c.translate(40 + cw / 2, t + 55.5); c.scale(ck, ck); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.ink; c.fillText(cs, 0, 0); c.restore();
    const reach = g.dash ? CFG.BUMP_LUNGE : g.dive ? CFG.CATCH_GAP : 110;
    const gu = clamp(S.gap / CFG.GAP_MAX, 0, 1), danger = S.awake && S.gap < reach;      // 这么近时撞上就被追上（docs/24），顶栏这一格变红
    pill(102, t + 42, 288, 26, danger ? mix('#ffffff', '#ffb3ab', .5 + .5 * Math.sin(now * .02)) : '#fff');
    const x0 = 119, x1 = 375, ym = t + 55, hud = n => { const im = IMG['i:' + n]; return im && im.width ? im : null; };
    c.strokeStyle = '#c6ccd4'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 + 8, ym); c.lineTo(x1 + 4, ym); c.stroke();
    // 烟里冲刺：线的左头一截是红的，长度就是绊一下它扑过来的距离（BUMP_LUNGE）。Leo 的头在红的里面时绊一下就被追上；只有这一条规则（2026-11-17）
    if (g.dash && S.awake && !g.attract) { const rx = x0 + 24 + (x1 - x0 - 24) * clamp(CFG.BUMP_LUNGE / CFG.GAP_MAX, 0, 1); c.strokeStyle = C.alarm; c.lineWidth = 4; c.beginPath(); c.moveTo(x0 + 8, ym); c.lineTo(rx, ym); c.stroke(); }
    const si = hud(danger ? 'hud-smog-close' : 'hud-smog'), li = hud(danger ? 'hud-leo-scared' : 'hud-leo'), lx = x0 + 24 + (x1 - x0 - 24) * gu;
    if (si) c.drawImage(si, x0 - 12, ym - 12, 24, 24);
    if (li) c.drawImage(li, lx - 10.5, ym - 10.5, 21, 21);
    // 跟着跑的人数：Leo 头像左边一个绿色小标签「+3」，跟他一起在条上走
    const pn = (g.parade || []).filter(f => !f.drop).length;
    // 大烟雾快追上时 Leo 的头挪到最左边，标签放左边会正好盖住大烟雾那个小图标（2026-11-16），那时放到右边
    if (pn && !g.attract) { c.font = `900 10px ${FONT}`; const tw = c.measureText(`+${pn}`).width + 8; let bx = lx - 14 - tw; if (bx < x0 + 15) bx = lx + 13; rr(bx, ym - 7.5, tw, 15, 7); c.fillStyle = '#2fb85a'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`+${pn}`, bx + tw / 2, ym + .5); }
    // 拿到的摊位：金币那格下面一小排（每样一个小图，拿了两次的写 ×2）
    const PK = g.perks ? Object.keys(g.perks) : [];
    if (PK.length && !g.attract) {
      let px = 14;
      for (const id of PK) {
        const used = id === 'mint' && !(g.mintLeft > 0);      // 薄荷糖用掉了就淡下去：它只挡一次呛（2026-11-16）
        if (used) c.globalAlpha = .35;
        const im = STALL_IMG[id]; rr(px, t + 74, 20, 20, 6); inkFill('#fff6cf', 1.2);
        if (im && im.complete && im.naturalWidth) c.drawImage(im, px + 2, t + 76, 16, 16); else label(id[0].toUpperCase(), px + 10, t + 84.5, 11, C.nic, C.ink, 900);
        if (g.perks[id] > 1) label('×2', px + 19, t + 93, 8, '#fff', C.ink, 900);
        c.globalAlpha = 1; px += 24;
      }
    }
    // 打老板：顶栏下面一条老板条，名字、三格血、这一招要做什么（原来写在老板头上，2026-11-16 挪上来）；这时候不出别的提示，免得叠在一起
    // 有摊位那一排时，老板条和提示往下让一排，不压在小图标上（2026-11-16）
    const hy = t + (PK.length && !g.attract ? 100 : 78);
    if (g.locked && g.boss && g.boss.s && !g.over) { bossBar(g.boss.s, hy); return; }
    if (hint && hint.t > 0) {
      const sticky = hint.until && !hint.until();
      c.save(); c.globalAlpha = sticky ? 1 : Math.min(1, hint.t * 4, (hint.life - hint.t) * 6 + .01);
      // 一行放得下就一行（字最小缩到 11.5）；放不下折成两行，框跟着变高。原来最小缩到 10 还放不下就两头截掉（滑板那句，2026-11-16）
      let fs = 14; c.font = `700 ${fs}px ${FONT}`;
      while (c.measureText(hint.s).width > 340 && fs > 11.5) { fs -= .5; c.font = `700 ${fs}px ${FONT}`; }
      let lines = [hint.s];
      if (c.measureText(hint.s).width > 340) {
        fs = 12.5; c.font = `700 ${fs}px ${FONT}`;
        let bestW = 1e9;
        for (const [a, b] of splits(hint.s)) { const w = Math.max(c.measureText(a).width, c.measureText(b).width); if (w < bestW) { bestW = w; lines = [a, b]; } }
      }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = Math.min(380, Math.max(...lines.map(s => c.measureText(s).width)) + 28), bh = lines.length > 1 ? 46 : 32;
      c.fillStyle = sticky ? '#fff6cf' : '#fff'; c.strokeStyle = sticky ? C.nic : C.ink; c.lineWidth = sticky ? 3.2 : 2.4; rr(W / 2 - w / 2, hy, w, bh, 10); c.fill(); c.stroke();
      c.fillStyle = C.ink; lines.forEach((s, i) => c.fillText(s, W / 2, hy + bh / 2 + (i - (lines.length - 1) / 2) * (fs + 3)));
      c.restore();
    }
  }
  function bossBar(s, y) {
    const d = s.day || 0, name = L(d === 0 ? 'CIGAR BOSS' : d === 1 ? 'CIGAR BOSS IN SHADES' : 'GOLDEN CIGAR BOSS'), ph = s.phase;
    const tip = L(ph === 'wave' ? 'TAP THE EMBER!' : ph === 'lighter' ? 'TAP THE FLAME!' : ph === 'ring' ? 'POP THE RINGS!' : ph === 'charge' || ph === 'blow' ? 'GET OUT OF THE RED LANES!' : ph === 'cough' ? 'NICE HIT! GET READY…' : '');      // 打中的那一下头上已经跳了 GOT HIM!，这里不再说一遍
    const w = 236, x = W / 2 - w / 2;
    c.save();
    rr(x, y, w, 30, 10); c.fillStyle = 'rgba(28,34,48,.88)'; c.fill(); c.strokeStyle = d >= 2 ? '#ffd23f' : '#fff'; c.lineWidth = 2.2; c.stroke();
    c.font = `900 11px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = d >= 2 ? '#ffd23f' : '#fff'; c.fillText(name, x + 12, y + 15.5);
    for (let i = 0; i < CFG.BOSS_HP; i++) { const bx = x + w - 66 + i * 19; rr(bx, y + 9, 15, 12, 4); c.fillStyle = i < s.hp ? C.alarm : '#5d6675'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); }
    c.restore();
    if (tip) { const pu = 1 + .05 * Math.sin(perf() * .012); c.save(); c.translate(W / 2, y + 46); c.scale(pu, pu); label(tip, 0, 0, 14, C.ink, C.nic, 900); c.restore(); }
  }
  // 没有固定的操作区了：左半屏按住憋气，右半屏滑动换道、点烟头滋水。马路上只留两个淡淡的提示
  let barS = '', barU = 0, barT = 0;
  function drawPads(g, ui) {
    const p = g.p, now = perf();
    if (!ui.touch) { label(L('Hold SPACE = hold your breath and sprint  ·  ↑ ↓ lanes  ·  click a cigarette'), W / 2, VH - 16, 10, '#fff', C.ink, 800); return; }
    // 左边一整块是「憋气」。其实左边四成屏幕按哪里都算，这块画大是为了一眼看到、知道按的是「憋住这口气」
    // 开场里 Leo 自己在冲（引子），按钮不跟着亮成 HOLDING：那不是玩家按的。写「HOLD to start」、一明一暗，告诉玩家按一下就开始（2026-11-17）
    const intro = !!g.intro, held = p.holding && !intro, gasp = p.gasp > 0, warn = g.warnAhead && !held && !intro, bx = 10, bw = 158, bh = 78, by = VH - safeBottom - bh - 8;
    // 底板：从人行道下沿一直到屏幕底，盖住马路
    const dy = by - 10;
    c.fillStyle = '#1b2030'; c.fillRect(0, dy, W, VH - dy);
    c.fillStyle = '#2c3348'; c.fillRect(0, dy, W, 3);
    rr(bx, by, bw, bh, 22);
    c.fillStyle = held ? '#22b8b7' : gasp ? '#59607a' : warn ? mix('#b3261e', '#f0433a', .5 + .5 * Math.sin(now * .02)) : intro ? mix('#394260', '#22b8b7', .3 + .3 * Math.sin(now * .008)) : '#394260'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2.8; c.stroke();
    c.save(); c.translate(bx + 34, by + bh / 2 + 2); c.scale(1.7, 1.7); lungs(0, 0, gasp ? .7 : 0); c.restore();
    label(L(gasp ? 'GASP!' : held ? 'HOLDING' : 'HOLD'), bx + 104, by + 30, held ? 18 : 22, '#fff', C.ink, 900);
    // 第二行放不下就缩小字号（2026-11-16）：模拟器（Safari）里「catching your breath」比 Chrome 宽，压出了按钮右边框
    const sub = L(gasp ? 'catching your breath' : held ? 'let go in clean air' : intro ? 'to start' : 'your breath');
    let sfs = 10.5; c.font = `800 ${sfs}px ${FONT}`;
    while (c.measureText(sub).width > 90 && sfs > 8) { sfs -= .5; c.font = `800 ${sfs}px ${FONT}`; }
    label(sub, bx + 104, by + 53, sfs, '#fff', C.ink, 800);
    /* 右边：头几局写操作（滑动换道、点烟头）；会了以后换成离做完最近的那个任务和进度，跑的时候也看得到目标（2026-11-16）。
     * 原来两行操作说明每局都在，老玩家早就会了 */
    if (ui.help || !ui.mission) {
      label(L('SWIPE  ↑ ↓  change lanes'), 286, by + 27, 11, '#fff', C.ink, 800);
      label(L('TAP  a cigarette'), 286, by + 51, 11, '#fff', C.ink, 800);
      return;
    }
    const m = ui.mission, mx = 286, mw = 196;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 9px ${FONT}`; c.fillStyle = C.nic; c.fillText(m.head || L('★ MISSION'), mx, by + 14);
    let fs = 12; c.font = `800 ${fs}px ${FONT}`; while (c.measureText(m.s).width > mw && fs > 9) { fs -= .5; c.font = `800 ${fs}px ${FONT}`; }
    c.fillStyle = '#fff'; c.fillText(m.s, mx, by + 33);
    // 进度条慢慢长过去（数是每半秒才更新一次，原来一格一格跳）；换了任务直接到位
    const u0 = clamp(m.v / m.n, 0, 1); if (m.s !== barS) { barS = m.s; barU = u0; } barU += (u0 - barU) * Math.min(1, (now - barT) * .006); barT = now;
    const u = barU >= .999 ? 1 : barU;
    rr(mx - 70, by + 50, 140, 9, 4.5); c.fillStyle = '#394260'; c.fill();
    if (u > 0) { rr(mx - 70, by + 50, Math.max(9, 140 * u), 9, 4.5); c.fillStyle = u >= 1 ? C.go : C.nic; c.fill(); }
    c.font = `900 9px ${FONT}`; c.fillStyle = m.all ? '#8fe0a8' : '#c6ccd4'; c.fillText(m.all ? L('RANK UP AT THE END OF THIS RUN') : (m.lab || '').toUpperCase() || `${Math.min(m.v, m.n).toLocaleString()} / ${m.n.toLocaleString()}`, mx, by + 69);
  }

  /* ---------- 一帧 ---------- */
  const Z = H.ZOOM;
  // 点在哪：先看是不是点中了某个烟头（准）或某个烟民（没那么准），再看是不是点在一团烟上，都不是就自动瞄
  R.pick = function (g, q) {
    const wx = g.camX + q.x / Z, wy = GT + (q.y - GT) / Z;      // 还原到放大前的坐标
    let best = null, bd = 1e9, bull = false;
    // 烟圈最容易点：范围给大一点
    for (const q of g.rings) { const d = Math.hypot(q.x - wx, laneY(q.z) - q.h * dsc(q.z) - wy); if (q.life > 0 && d < (q.boss ? 40 : 30) && d < bd) { bd = d; best = q; } }      // 老板的烟圈画得更大，点的范围也跟着大
    if (best) return { ring: best };
    for (const s of g.smokers) {
      if (s.kind !== 'boss' || !s.lit || s.state !== 'smoke' || !s.awake) continue;
      const k = dsc(s.z) * 1.2, bx = s.x, by = laneY(s.z), tp = bossPoint(s);
      if (tp) { const tx = bx + tp[0] * U * k, ty = by + tp[1] * U * k; if (Math.hypot(tx - wx, ty - wy) < 36) return { boss: s, part: s.phase === 'wave' ? 'ember' : 'flame', x: tx, h: -tp[1] * U * k }; }
      if (Math.abs(bx - wx) < 30 && wy < by + 6 && wy > by - 80 * k) return { boss: s, part: 'body', x: bx, h: 40 };
    }
    for (const s of g.smokers) {
      if (!H.targetable(s)) continue;
      const k = dsc(s.z), cg = cigOf(s), hp = H.hitPoint(s);
      const dc = Math.hypot(cg.x - wx, laneY(s.z) - cg.h * k - wy), db = Math.hypot(hp.x - wx, laneY(s.z) - hp.h * k - wy);
      const d = Math.min(dc, db * .8);
      if (d < bd && (dc < 30 || db < 34)) { bd = d; best = s; bull = dc < 15; }
    }
    if (best) return { s: best, bull };
    const z = clamp((wy + 30 - GT - LY / 2) / LY, -.3, 2.3);
    if (wy > GT - 60 && wy < laneY(2.5) + 6 && H.density(g, wx, z, H.HEAD) > .05) return { x: wx, z };
    return true;
  };
  /* 一天比一天晚（2026-11-15）：第二天是傍晚、第三天起是晚上。同样五个街区再走一遍，换个时辰就像换了个地方。
   * 只调暗背景（天、楼、店面、地面），人、烟、警示画在后面，不受影响，晚上照样看得清。
   * 换天的时候慢慢过渡（大约两秒）。主页的演示一直是白天 */
  let dusk = 0, night = 0, dawn = 0, rain = 0;
  /* 第 3 天以后接着换时辰和天气：黎明、雨天、傍晚、夜里轮着来（2026-11-16）。原来第 3 天起一直是夜里，高手 6 分钟就到，之后看到的都一样。
   * 画面换天、楼、地面的颜色，雨丝，路灯；雨天烟散得快（core.js 的 RAIN_LIFE） */
  R.phaseOf = H.phaseOf;      // 第几天是什么时辰，core.js 里定（雨天烟散得快，规则也用它）
  R.rainLevel = () => rain;      // 画面上雨有多大（0 到 1，换天时慢慢变），雨声跟着它（main.js）
  const GLOW = document.createElement('canvas'); GLOW.width = GLOW.height = 64;
  { const x = GLOW.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,120,.85)'); gr.addColorStop(.35, 'rgba(255,180,80,.35)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  // 一个颜色压上这会儿的天色：和地面压的同一层（drawDayLight 下半截），夜里重一点
  const TINTS = [['#ffcf9e', () => dusk * .3], ['#ffe0d2', () => dawn * .16], ['#bcc6d4', () => rain * .3], ['#34417f', () => night * .5]];
  function litCol(hex) {
    let r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    for (const [t, f] of TINTS) {
      const a = f(); if (a < .005) continue;
      r *= 1 - a + a * parseInt(t.slice(1, 3), 16) / 255; gg *= 1 - a + a * parseInt(t.slice(3, 5), 16) / 255; b *= 1 - a + a * parseInt(t.slice(5, 7), 16) / 255;
    }
    return '#' + [r, gg, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  let tintKey = '';
  function tintSmoke() {
    const key = [dusk, dawn, rain, night].map(v => Math.round(v * 50)).join();
    if (key === tintKey) return; tintKey = key;
    for (let i = 0; i < 2; i++) { SMOKE_LOOK.fill[i] = litCol(SMOKE_DAY[i]); VAPOR_LOOK.fill[i] = litCol(VAPOR_DAY[i]); RING[i] = litCol(RING_DAY[i]); }
  }
  function drawDayLight(g, dt) {
    const ph = g.attract ? 'day' : R.phaseOf(g.day || 0), k = Math.min(1, (dt || 0) * .7);
    dusk += ((ph === 'dusk' ? 1 : 0) - dusk) * k; night += ((ph === 'night' ? 1 : 0) - night) * k;
    dawn += ((ph === 'dawn' ? 1 : 0) - dawn) * k; rain += ((ph === 'rain' ? 1 : 0) - rain) * k;
    tintSmoke();
    if (dusk < .01 && night < .01 && dawn < .01 && rain < .01) return;
    const X0 = -60, Y0 = GT - GT / Z - 20, X1 = W / Z + 60, Y1 = GT + (VH - GT) / Z + 40, G0 = GT - 6;      // G0：人行道后沿
    c.save(); c.globalCompositeOperation = 'multiply';
    if (dusk > .01) {
      // 傍晚：天的晚霞色已经烤在天空图里（bakeSky）；楼和地面压一层暖光
      c.globalCompositeOperation = 'multiply'; c.fillStyle = '#ffcf9e';
      c.globalAlpha = dusk * .5; c.fillRect(X0, Y0, X1 - X0, G0 - Y0);
      c.globalAlpha = dusk * .3; c.fillRect(X0, G0, X1 - X0, Y1 - G0);
    }
    // 黎明：天是浅蓝到桃色（烤在天空图里），楼和地面压一层很淡的粉
    if (dawn > .01) { c.fillStyle = '#ffe0d2'; c.globalAlpha = dawn * .42; c.fillRect(X0, Y0, X1 - X0, G0 - Y0); c.globalAlpha = dawn * .16; c.fillRect(X0, G0, X1 - X0, Y1 - G0); }
    // 雨天：天是灰蓝（烤在天空图里），楼压一层冷灰，地面压一点，看着湿；雨丝在 drawRain
    if (rain > .01) { c.fillStyle = '#bcc6d4'; c.globalAlpha = rain * .55; c.fillRect(X0, Y0, X1 - X0, G0 - Y0); c.globalAlpha = rain * .26; c.fillRect(X0, G0, X1 - X0, Y1 - G0); }
    // 晚上：天和楼压暗；人行道（玩的地方）只压一点，烟在上面还要看得清
    if (night > .01) { c.fillStyle = '#34417f'; c.globalAlpha = night * .7; c.fillRect(X0, Y0, X1 - X0, G0 - Y0); c.globalAlpha = night * .36; c.fillRect(X0, G0, X1 - X0, Y1 - G0); }
    c.restore();
    const lit = Math.max(night, rain * .55);      // 雨天阴，路灯也亮着
    if (lit < .05) return;
    const t = perf() * .001;
    c.save();
    // 星星：只撒在楼顶以上那一截天上，一闪一闪
    for (let i = 0; i < 26; i++) {
      const sx = hash(i, 7) * (W / Z), sy = Y0 + 24 + hash(i, 13) * Math.max(10, (GT - 220) - (Y0 + 24)), tw = .55 + .45 * Math.sin(t * (1.5 + hash(i, 3) * 2) + i);
      if (night < .05) break;
      c.globalAlpha = night * tw * .9; c.fillStyle = '#fff6d8'; circ(sx, sy, .9 + hash(i, 9) * 1.1); c.fill();
    }
    // 路灯亮起来：灯罩一团暖光，地上一小圈
    // 光晕是一张先画好的小图，每帧只贴图，不每帧新建渐变（老手机上省一点）
    c.globalCompositeOperation = 'lighter';
    for (const [lx, ly] of LAMPS) {
      c.globalAlpha = lit; c.drawImage(GLOW, lx - 26, ly - 26, 52, 52);
      c.globalAlpha = lit * .33; c.drawImage(GLOW, lx - 46, GT + 10 - 13, 92, 26);
    }
    c.restore();
  }
  // 雨丝：屏幕上斜着往下落的细线，画在人、烟、特效前面，顶栏和按钮后面
  const RAIN = Array.from({ length: 64 }, (_, i) => ({ x: hash(i, 41) * (W + 80), y: hash(i, 43) * 1000, l: 12 + hash(i, 47) * 12, v: 760 + hash(i, 53) * 260 }));
  function drawRain(dt) {
    c.save(); c.strokeStyle = '#eef3fa'; c.lineWidth = 1.3; c.lineCap = 'round'; c.globalAlpha = rain * .42; c.beginPath();
    for (const r of RAIN) {
      r.y += r.v * (dt || 0); r.x -= r.v * .16 * (dt || 0);
      if (r.y > VH + 20) { r.y -= VH + 60; r.x = (r.x + 197) % (W + 80); }
      if (r.x < -40) r.x += W + 80;
      c.moveTo(r.x, r.y); c.lineTo(r.x + r.l * .16, r.y - r.l);
    }
    c.stroke(); c.restore();
  }
  let beatNow = null;      // 这一帧音乐的拍子（main.js 的 ui.beat）
  // 拍子一到是 1，很快落到 0（三次方）：烟头亮一下、靶圈跳一下都用它
  const beatPulse = () => { const B = beatNow; if (!B) return 0; const ph = 1 - ((B.toNext % B.period) + B.period) % B.period / B.period; return Math.pow(1 - ph, 3); };
  R.frame = function (g, dt, mode, ui) {
    quiet = !!(g.attract || g.demo);      // 主页背后的演示（main.js 的 demoGame，是一局普通的跑酷加 demo 标记）：不画连冲数、白线、边上的箭头、贴近时的红边（2026-11-16，原来只认 attract，演示里全画出来了）
    beatNow = mode === 'play' && !g.attract ? ui.beat || null : null;
    c.setTransform(S * DPR, 0, 0, S * DPR, 0, 0);
    c.lineJoin = 'round';
    c.save();
    // 被追上以后镜头推近：先铺一层底色，推近时边上不会露出上一帧
    cam = caughtCam(g);
    if (cam) { c.fillStyle = '#2b3140'; c.fillRect(0, 0, W, VH); }
    if (shake > 0 && !ui.calm) c.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    if (cam) { c.translate(cam.tx, cam.ty); c.scale(cam.k, cam.k); c.translate(-cam.fx, -cam.fy); }
    // 主页背后是一段自己在跑的实机演示：整幅画面往上抬一截，下面留给按钮
    const lift = ui.lift || 0;
    if (lift) { c.fillStyle = '#2b3140'; c.fillRect(0, VH - lift - 2, W, lift + 2); c.translate(0, -lift); }
    drawSky(g);
    // 街道和人物放大画，以人行道后沿为基准
    c.translate(0, GT); c.scale(Z, Z); c.translate(0, -GT);
    LAMPS.length = 0;
    drawFacades(g);
    drawStreet(g);
    drawDayLight(g, dt);
    drawGroundCues(g);
    drawWorld(g, dt);
    edgeHints(g);
    drawRoadCars(g, dt);
    drawWindLines(g, dt);
    drawDrops(g);
    drawAim(g, mode);
    drawSmog(g);
    if (g.over === 'smog') drawCaught(g);
    drawFx(g);
    c.restore();
    if (rain > .02 && !cam) drawRain(dt);
    if (cam) drawCaughtFront(); else drawTint(g);
    if (flashT > 0) { c.globalAlpha = flashT / .5 * flashA; c.fillStyle = flashC; c.fillRect(0, 0, W, VH); c.globalAlpha = 1; }
    cardDy = g.locked && g.boss && !g.over ? 46 : 0;
    drawCard();
    drawScreenBits();
    if (mode === 'play' || mode === 'paused' || (mode === 'ending' && !cam)) { drawHud(g, ui.hint, dt); if (mode === 'play') drawPads(g, ui); }
  };
  R.viewH = () => VH;
})();
