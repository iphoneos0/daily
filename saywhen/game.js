// Say When（No.1，2026-11-23）
// 按住倒饮料，到线就松手。每杯只能倒一次。
// 难在三处：松手时水柱还在半空（要早一点松）；杯子形状不同，水面涨的快慢不同（锥形杯越往上越慢、烧瓶越往上越快）；
// 带气的饮料泡沫先冒上来再落下（看着要溢，其实刚好）。第 13 杯起杯子会在传送带上慢慢走。
(function () {
  'use strict';
  const { rand, rr, pick, burst, pop, shake, sound, store, FONT } = Kit;
  const TAP_X = 180, TAP_Y = 224;      // 出水口
  const PIPE_Y = 190;                  // 龙头
  const BELT_Y = 606;                  // 杯底
  const GRAV = 2600, V0 = 260;         // 水柱重力、出口速度
  const N = 100;                       // 杯子容积表的格数

  const SHAPES = {
    tumbler: { h: 150, prof: [[0, 33], [1, 40]], base: 12 },
    pint: { h: 190, prof: [[0, 29], [0.82, 41], [1, 39]], base: 12 },
    highball: { h: 205, prof: [[0, 26], [1, 28]], base: 14 },
    mug: { h: 132, prof: [[0, 44], [1, 44]], base: 12, handle: true },
    goblet: { h: 108, prof: [[0, 8], [0.3, 38], [0.72, 45], [1, 40]], base: 6, stem: 64 },
    martini: { h: 96, prof: [[0, 3], [1, 64]], base: 5, stem: 84 },
    flask: { h: 182, prof: [[0, 52], [0.5, 30], [0.68, 13], [1, 13]], base: 8 },
    flute: { h: 172, prof: [[0, 5], [0.14, 18], [1, 22]], base: 6, stem: 56 },
    stein: { h: 250, prof: [[0, 66], [1, 70]], base: 16, handle: true },
  };
  const STILL = [
    { c: '#58c4f5', top: '#a9e6ff' },   // water
    { c: '#ff9f1c', top: '#ffc76e' },   // orange
    { c: '#f5d936', top: '#fff09a' },   // lemonade
    { c: '#e23d82', top: '#ff86b8' },   // berry
    { c: '#efe8dc', top: '#ffffff' },   // milk
    { c: '#86c23a', top: '#c3e683' },   // matcha
  ];
  const FIZZY = [
    { c: '#5b2c16', top: '#8e4c27', foam: '#f4e6d2' },   // cola
    { c: '#f0a312', top: '#ffd45e', foam: '#fffaf0' },   // beer
    { c: '#ff5b3d', top: '#ff9c80', foam: '#ffece4' },   // soda
  ];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeIn = k => k * k * k;

  // ---------- 杯子 ----------
  function hw(c, f) {   // 离杯底 f（0..1）处的内半宽
    const p = c.S.prof;
    if (f <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (f <= p[i][0]) { const k = (f - p[i - 1][0]) / (p[i][0] - p[i - 1][0]); return lerp(p[i - 1][1], p[i][1], k); }
    }
    return p[p.length - 1][1];
  }
  function areaAt(c, f) { const x = clamp(f, 0, 1) * N, i = Math.floor(x); return i >= N ? c.A[N] : c.A[i] + (c.A[i + 1] - c.A[i]) * (x - i); }
  function levelOf(c, V) {   // 体积 → 液面高度（0..1）
    if (V <= 0) return 0;
    if (V >= c.cap) return 1;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c.A[m] <= V) lo = m; else hi = m; }
    return (lo + (V - c.A[lo]) / (c.A[lo + 1] - c.A[lo])) / N;
  }

  function makeGlass(g) {
    const n = g.n, boss = n % 10 === 9;
    let kind;
    if (boss) kind = 'stein';
    else if (n < 3) kind = ['tumbler', 'pint', 'tumbler'][n];
    else {
      const pool = n < 10 ? ['tumbler', 'pint', 'highball', 'mug', 'goblet']
        : ['tumbler', 'pint', 'highball', 'mug', 'goblet', 'martini', 'martini', 'flask', 'flask', 'flute', 'flute'];
      kind = pick(pool);
      if (kind === g.lastKind) kind = pick(pool);
    }
    g.lastKind = kind;
    const S = SHAPES[kind];
    const foamy = boss || n === 6 || (n > 6 && rand() < 0.35);
    const c = {
      kind, S, boss, foamy, h: S.h,
      drink: boss ? FIZZY[1] : foamy ? pick(FIZZY) : pick(STILL),
      b: boss ? 0.09 : n <= 28 ? lerp(0.11, 0.045, clamp((n - 2) / 26, 0, 1)) : lerp(0.045, 0.032, clamp((n - 28) / 30, 0, 1)),
      L: 0, F: 0, wob: 0, poured: 0, spilled: false, result: null,
      phase: 'in', pt: 0, born: g.t, settle: 0, botDelay: rr(0.12, 0.4), botErr: 0,
    };
    c.innerBottom = BELT_Y - S.base - (S.stem || 0);
    c.rimY = c.innerBottom - c.h;
    c.rim = hw(c, 1);
    const A = new Float32Array(N + 1);
    for (let i = 1; i <= N; i++) A[i] = A[i - 1] + (hw(c, (i - 1) / N) + hw(c, i / N)) * (c.h / N);
    c.A = A; c.cap = A[N];
    c.t = foamy ? rr(0.5, 0.66) : rr(0.55, 0.8);
    c.t = Math.min(c.t, 0.9 - c.b);
    const fill = boss ? 2.6 : n <= 30 ? lerp(2.1, 1.05, n / 30) : lerp(1.05, 0.8, clamp((n - 30) / 30, 0, 1));
    c.Q = areaAt(c, c.t) / fill;
    c.stream = boss ? 13 : 7;
    // 第 13 杯起杯子在传送带上往左走：留给倒的时间 = 倒满要的时间 + 余量（余量越来越小）
    c.v = 0; c.restX = TAP_X;
    if (n >= 12 && !boss) {
      const slack = lerp(1.8, 0.8, clamp((n - 12) / 25, 0, 1));
      c.restX = TAP_X + c.rim * 0.55;
      c.v = (c.rim * 1.55 - 6) / (fill + slack);
    }
    c.x = 440;
    return c;
  }

  // ---------- 判定 ----------
  const RESULT = {
    perfect: { text: 'PERFECT', color: '#ffd84a' },
    good: { text: 'GOOD', color: '#7cf0a0' },
    short: { text: 'TOO LITTLE', color: '#9fb4ff' },
    much: { text: 'TOO MUCH', color: '#ff7a7a' },
    spill: { text: 'SPILL!', color: '#ff5a5a' },
  };
  function judge(g, c, kind) {
    c.result = kind; c.phase = 'judged'; c.pt = 0;
    g.results.push(kind);
    const R = RESULT[kind], y = Math.min(c.rimY - 26, 340);
    if (kind === 'perfect' || kind === 'good') {
      g.served++;
      let pts;
      if (kind === 'perfect') { g.streak++; pts = 20 + 10 * Math.min(g.streak - 1, 4); }
      else { g.streak = 0; pts = 10; }
      if (c.boss) pts += 50;
      g.score += pts;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
      pop(kind === 'perfect' && g.streak > 1 ? `${R.text} ×${g.streak}` : R.text, c.x, y, { color: R.color, size: kind === 'perfect' ? 34 : 28 });
      pop('+' + pts, c.x, y + 34, { color: '#fff', size: 18, life: 0.8 });
      if (kind === 'perfect') {
        const base = 620 * Math.pow(2, Math.min(g.streak - 1, 7) / 12 * 2);
        sound.tone(base, 0.12, { type: 'triangle', vol: 0.18 });
        sound.tone(base * 1.26, 0.12, { type: 'triangle', vol: 0.18, delay: 0.07 });
        sound.tone(base * 1.5, 0.24, { type: 'triangle', vol: 0.2, delay: 0.14 });
        burst(c.x, c.innerBottom - c.h * levelOf(c, c.L), 14, { color: '#ffe27a', speed: 160, life: 0.6, size: 2.5, gravity: 200 });
      } else {
        sound.tone(520, 0.1, { type: 'triangle', vol: 0.16 });
        sound.tone(780, 0.14, { type: 'triangle', vol: 0.16, delay: 0.06 });
      }
      if (c.boss && g.hearts < 3) { g.hearts++; pop('+♥', c.x + 58, y + 6, { color: '#ff6b8a', size: 26 }); }
    } else {
      g.streak = 0;
      g.hearts--;
      g.lastMiss = kind;
      pop(R.text, c.x, y, { color: R.color, size: 30 });
      shake(kind === 'spill' ? 10 : 6);
      if (kind === 'short') sound.tone(300, 0.28, { type: 'triangle', vol: 0.2, to: 170 });
      else { sound.noise(0.4, { freq: 900, to: 260, vol: 0.32 }); sound.tone(150, 0.3, { vol: 0.28, to: 70 }); }
      if (!g.demo && navigator.vibrate) { try { navigator.vibrate(kind === 'spill' ? 40 : 20); } catch (_) { } }
      // 前两局的第一次失手给一句提示
      if (!g.demo && !g.tipShown && g.plays <= 2) {
        g.tipShown = true;
        g.tip = kind === 'short' ? ['Hold a bit longer'] : ['Let go early —', "it's still falling!"];
        g.tipT = 3;
      }
      if (g.hearts <= 0) {
        g.overTitle = kind === 'spill' ? 'Spilled!' : kind === 'short' ? 'Too little!' : 'Too much!';
        g.overLine = `${g.served} drink${g.served === 1 ? '' : 's'} served` + (g.bestStreak > 1 ? ` · best streak ${g.bestStreak}` : '');
      }
    }
  }

  // ---------- 水滴 ----------
  function inFlight(g, c) { let v = 0; for (const d of g.drops) if (d.c === c && d.alive) v += d.vol; return v; }
  function land(c, vol) {
    if (c.foamy) { c.L += vol * 0.45; c.F += vol * 1.25; } else c.L += vol;
    c.wob = Math.min(1, c.wob + vol / 500);
  }

  let pourSnd = null;

  Kit.game({
    id: 'saywhen', no: 1, title: 'Say When', verb: 'Hold to pour. Let go at the line.', bg: '#171b36', ctaY: 292,

    reset(g) {
      g.n = 0; g.hearts = 3; g.served = 0; g.streak = 0; g.bestStreak = 0;
      g.glasses = []; g.drops = []; g.results = []; g.belt = 0; g.pressAt = -9; g.pouring = false;
      g.tip = null; g.tipT = 0; g.tipShown = false; g.lastKind = '';
      g.plays = g.demo ? 99 : store.get('saywhen.plays', 0) + 1;
      if (!g.demo) store.set('saywhen.plays', g.plays);
      g.cur = makeGlass(g); g.glasses.push(g.cur);
      g.overAt = 0;
    },

    update(g, dt, input) {
      if (input.pressed) g.pressAt = g.t;
      const c = g.cur;
      // 杯子进出
      for (let i = g.glasses.length - 1; i >= 0; i--) {
        const q = g.glasses[i];
        q.pt += dt;
        if (q.phase === 'in') {
          const k = Math.min(1, q.pt / 0.5), nx = lerp(440, q.restX, easeOut(k));
          if (q === c) g.belt += (q.x - nx);
          q.x = nx;
          if (k >= 1) {
            q.phase = 'ready'; q.pt = 0;
            sound.tone(2400, 0.07, { type: 'triangle', vol: 0.06 }); sound.tone(3500, 0.05, { vol: 0.03, delay: 0.02 });
            if (q.boss) { pop('BIG ONE!', TAP_X, 290, { color: '#ffd84a', size: 36, life: 1.1 }); sound.tone(392, 0.12, { type: 'square', vol: 0.06 }); sound.tone(523, 0.12, { type: 'square', vol: 0.06, delay: 0.1 }); sound.tone(659, 0.26, { type: 'square', vol: 0.06, delay: 0.2 }); }
          }
        } else if (q.phase === 'out') {
          const k = Math.min(1, q.pt / 0.5);
          q.x = lerp(q.outFrom, -120, easeIn(k));
          if (k >= 1) g.glasses.splice(i, 1);
        } else if (q.v) {
          q.x -= q.v * dt; g.belt += q.v * dt;
        }
      }

      // 倒
      const mouth = c.rim - 2 - c.stream / 2;
      const under = Math.abs(TAP_X - c.x) < mouth;
      if (c.phase === 'ready') {
        if (input.down && g.pressAt > c.born + 0.2 && !g.ended) { c.phase = 'pour'; c.pt = 0; }
        else if (c.v && c.x < TAP_X - mouth) { c.phase = 'wait'; c.pt = 0; }       // 走过去了还没倒
      }
      if (c.phase === 'pour') {
        if (c.v && c.x < TAP_X - c.rim - 24) { c.phase = 'wait'; c.pt = 0; }   // 杯子已经走远，按着也不算了
        else if (!input.down) {
          // 不小心点了一下（倒了不到一成）不算这一杯
          if (c.poured < areaAt(c, c.t) * 0.06) { c.phase = 'ready'; c.born = g.t - 0.2; }
          else { c.phase = 'wait'; c.pt = 0; }
        } else {
          const vol = c.Q * dt;
          c.poured += vol;
          g.drops.push({ x: TAP_X + Math.sin(g.t * 37) * 0.6, y: TAP_Y, vy: V0, vol, c, alive: true, decided: false, inside: false });
        }
      }
      g.pouring = c.phase === 'pour';

      // 水滴下落
      let landed = 0;
      for (let i = g.drops.length - 1; i >= 0; i--) {
        const d = g.drops[i], q = d.c;
        d.vy += GRAV * dt; d.y += d.vy * dt;
        if (!d.decided && d.y >= q.rimY) {
          d.decided = true;
          const dx = Math.abs(d.x - q.x);
          if (dx < q.rim - 2) d.inside = true;
          else if (dx < q.rim + 4) {   // 打在杯沿上
            d.alive = false; g.drops.splice(i, 1);
            if (rand() < 0.5) burst(d.x, q.rimY, 2, { color: q.drink.c, speed: 140, life: 0.5, size: 2.2, floor: BELT_Y });
            continue;
          }
        }
        if (d.inside) {
          const surf = q.innerBottom - q.h * levelOf(q, q.L + q.F);
          if (d.y >= surf) {
            land(q, d.vol); landed += d.vol;
            d.alive = false; g.drops.splice(i, 1);
            if (rand() < 0.18) burst(d.x, surf, 1, { color: q.drink.top, speed: 90, life: 0.35, size: 2, gravity: 900 });
          }
        } else if (d.decided && d.y >= BELT_Y - 3) {   // 洒在传送带上
          d.alive = false; g.drops.splice(i, 1);
          if (rand() < 0.4) burst(d.x, BELT_Y - 2, 2, { color: q.drink.c, speed: 110, life: 0.5, size: 2.4, floor: BELT_Y });
        }
      }

      // 泡沫慢慢落下变回饮料；溢出
      for (const q of g.glasses) {
        if (q.F > 0) { const dF = q.F * 1.7 * dt; q.F -= dF; q.L += dF * 0.44; if (q.F < 1) { q.L += q.F * 0.44; q.F = 0; } }
        q.wob *= Math.pow(0.05, dt);
        if (q.L + q.F > q.cap) {
          const over = q.L + q.F - q.cap;
          if (q.F >= over) q.F -= over; else { q.L -= over - q.F; q.F = 0; }
          if (!q.spilled) {
            q.spilled = true;
            if (q === g.cur && !q.result) judge(g, q, 'spill');
          }
          for (const s of [-1, 1]) burst(q.x + s * (q.rim + 2), q.rimY + 2, 1, { color: q.F > 0 ? q.drink.foam : q.drink.c, speed: 40, angle: s < 0 ? Math.PI : 0, spread: 0.8, gravity: 700, life: 0.9, size: 2.6, floor: BELT_Y });
        }
      }
      if (c.spilled && c.phase === 'pour') c.phase = 'judged';

      // 倒完：等水滴落完、泡沫落一会儿再判
      if (c.phase === 'wait') {
        if (inFlight(g, c) <= 0) {
          c.settle += dt;
          if (c.settle >= (c.foamy ? 0.9 : 0.22)) {
            const f = levelOf(c, c.L + c.F * 0.44), d = f - c.t;
            judge(g, c, c.poured <= 0 ? 'short' : d < -c.b ? 'short' : d > c.b ? 'much' : Math.abs(d) <= c.b * 0.3 ? 'perfect' : 'good');
          }
        }
      }
      if (c.phase === 'judged' && c.pt > 0.5 && inFlight(g, c) <= 0) {
        if (g.hearts <= 0) {
          if (!g.overAt) g.overAt = g.t;
          if (g.t - g.overAt > 0.35) g.end();
        } else {
          c.phase = 'out'; c.pt = 0; c.outFrom = c.x;
          sound.noise(0.3, { freq: 400, to: 1300, vol: 0.04 });
          g.n++;
          g.cur = makeGlass(g); g.glasses.push(g.cur);
        }
      }
      if (g.tipT > 0) g.tipT -= dt;

      // 倒水声：落进杯子时响，越满音越高
      if (!pourSnd && sound.ctx) pourSnd = sound.loop({ freq: 500, q: 3 });
      if (pourSnd) {
        const f = levelOf(c, c.L + c.F);
        pourSnd.set(landed > 0 ? (c.boss ? 0.5 : 0.32) : 0, 300 + 1500 * f);
      }
    },

    // 给自动检查用
    selfTest(g) { return { ok: g.results.length > 0, msg: '倒了一杯，判定 ' + (g.results[0] || '无') }; },
    statLine(g) { return g.served + ' 杯'; },
    thumbReady(g) { return g.n >= 6 && g.cur.phase === 'pour' && g.cur.poured > g.cur.Q * 1.25; },

    // 机器人：像真人一样，知道"现在松手最后会到哪"，但松手时机有误差（skill × 0.1 秒的标准差）
    // skill 0.25 ≈ 高手，0.5 ≈ 熟练，0.8 ≈ 普通，1.2 ≈ 新手
    bot(g, skill) {
      const c = g.cur, s = skill == null ? 0.45 : skill;
      if (c.phase === 'ready') {
        if (g.t - c.born < 0.5 + c.botDelay) return false;
        if (!c.botErr) c.botErr = (rand() + rand() + rand() + rand() - 2) * 1.73 * s * 0.1 + 1e-6;
        return true;
      }
      if (c.phase !== 'pour') return false;
      const fly = inFlight(g, c);
      const nearRim = c.L + c.F + fly * 1.3 > c.cap * 0.97;
      return c.L + c.F * 0.44 + fly + c.Q * c.botErr < areaAt(c, c.t) && !nearRim;
    },

    draw(ctx, g, view) {
      drawRoom(ctx, g, view);
      for (const q of g.glasses) drawGlass(ctx, g, q);
      drawStream(ctx, g);
      drawTap(ctx, g, view);
      drawHud(ctx, g);
    },
  });

  // ---------- 画 ----------
  function drawRoom(ctx, g, v) {
    const bg = ctx.createLinearGradient(0, v.y0, 0, BELT_Y);
    bg.addColorStop(0, '#141833'); bg.addColorStop(1, '#2b2f63');
    ctx.fillStyle = bg; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, BELT_Y - v.y0);
    // 墙砖
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 240; y < BELT_Y; y += 34) { ctx.moveTo(v.x0, y + 0.5); ctx.lineTo(v.x1, y + 0.5); }
    for (let y = 240, r = 0; y < BELT_Y; y += 34, r++) for (let x = (r % 2) * 34 - 68; x < v.x1; x += 68) { ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + 34); }
    ctx.stroke();
    // 灯
    const sp = ctx.createRadialGradient(TAP_X, 420, 10, TAP_X, 440, 270);
    sp.addColorStop(0, 'rgba(255,236,200,.13)'); sp.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = sp; ctx.fillRect(v.x0, 160, v.x1 - v.x0, BELT_Y - 160);
    // 传送带
    ctx.fillStyle = '#3a3f5c'; ctx.fillRect(v.x0, BELT_Y, v.x1 - v.x0, 22);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    const off = ((g.belt % 26) + 26) % 26;
    for (let x = v.x0 - 26 - (v.x0 % 26) - off; x < v.x1 + 26; x += 26) ctx.fillRect(x, BELT_Y + 3, 3, 16);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(v.x0, BELT_Y, v.x1 - v.x0, 2);
    ctx.fillStyle = '#1d2140'; ctx.fillRect(v.x0, BELT_Y + 22, v.x1 - v.x0, v.y1 - BELT_Y - 22);
    ctx.fillStyle = '#262b52';
    const roff = ((g.belt * 0.5) % 60 + 60) % 60;
    for (let x = Math.floor(v.x0 / 60) * 60 - 60; x < v.x1 + 60; x += 60) { ctx.beginPath(); ctx.arc(x - roff, BELT_Y + 34, 7, 0, Math.PI * 2); ctx.fill(); }
  }

  function glassPath(ctx, c, grow) {
    const steps = 40;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) { const f = i / steps; ctx.lineTo(c.x - hw(c, f) - grow, c.innerBottom - f * c.h); }
    for (let i = steps; i >= 0; i--) { const f = i / steps; ctx.lineTo(c.x + hw(c, f) + grow, c.innerBottom - f * c.h); }
    ctx.closePath();
  }

  function drawGlass(ctx, g, c) {
    const S = c.S, x = c.x, wall = 3;
    // 杯脚、杯底
    ctx.fillStyle = 'rgba(210,225,255,.22)';
    if (S.stem) {
      ctx.fillRect(x - 3, c.innerBottom, 6, S.stem);
      ctx.beginPath(); ctx.ellipse(x, BELT_Y - S.base / 2, 34, S.base / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      const bw = hw(c, 0) + wall;
      ctx.beginPath(); ctx.roundRect(x - bw, c.innerBottom, bw * 2, S.base, [0, 0, 6, 6]); ctx.fill();
    }
    if (S.handle) {
      ctx.strokeStyle = 'rgba(210,225,255,.45)'; ctx.lineWidth = S.h > 200 ? 9 : 7;
      const hx = x + c.rim + 2, hy = c.rimY + c.h * 0.48, r = c.h * 0.24;
      ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.75, r, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
    // 玻璃体
    glassPath(ctx, c, wall);
    ctx.fillStyle = 'rgba(200,220,255,.08)'; ctx.fill();

    // 液体
    const lf = levelOf(c, c.L), ff = levelOf(c, c.L + c.F);
    const ly = c.innerBottom - c.h * lf, fy = c.innerBottom - c.h * ff;
    ctx.save();
    glassPath(ctx, c, 0); ctx.clip();
    if (lf > 0) {
      const lg = ctx.createLinearGradient(x - c.rim, 0, x + c.rim, 0);
      lg.addColorStop(0, c.drink.c); lg.addColorStop(0.35, c.drink.top); lg.addColorStop(1, c.drink.c);
      ctx.fillStyle = lg;
      ctx.beginPath();
      const w = c.rim + 4, amp = 2.2 * c.wob;
      ctx.moveTo(x - w, ly);
      for (let i = 0; i <= 12; i++) { const px = x - w + (2 * w) * i / 12; ctx.lineTo(px, ly + Math.sin(px * 0.09 + g.t * 12) * amp); }
      ctx.lineTo(x + w, c.innerBottom + 2); ctx.lineTo(x - w, c.innerBottom + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x - w, ly - 1, 2 * w, 2.5);
      if (c.foamy) {   // 气泡
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        for (let i = 0; i < 7; i++) {
          const bx = x + (((i * 37.7) % 1) - 0.5) * c.rim * 1.4 + Math.sin(i * 9 + g.t * 2) * 4;
          const by = c.innerBottom - ((g.t * 40 + i * 31) % Math.max(4, c.innerBottom - ly));
          ctx.beginPath(); ctx.arc(bx, by, 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    if (ff > lf + 0.002) {   // 泡沫
      ctx.fillStyle = c.drink.foam;
      ctx.fillRect(x - c.rim - 4, fy, 2 * c.rim + 8, ly - fy + 1);
      for (let i = -6; i <= 6; i++) {
        const bx = x + i * (c.rim / 6), r = 3.5 + 1.5 * Math.sin(i * 1.7 + g.t * 3);
        ctx.beginPath(); ctx.arc(bx, fy + 1, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 判定带
    if (!c.result || c.result === 'perfect' || c.result === 'good') {
      const y1 = c.innerBottom - c.h * (c.t + c.b), y2 = c.innerBottom - c.h * (c.t - c.b);
      const inBand = lf >= c.t - c.b && lf <= c.t + c.b;
      ctx.fillStyle = inBand ? 'rgba(120,255,170,.26)' : 'rgba(120,255,170,.13)';
      ctx.fillRect(x - c.rim - 4, y1, 2 * c.rim + 8, y2 - y1);
    }
    ctx.restore();

    // 线：画到杯外两侧，倒满了也看得见
    if (!c.result || c.result === 'perfect' || c.result === 'good') {
      const ty = c.innerBottom - c.h * c.t, w = hw(c, c.t);
      const y1 = c.innerBottom - c.h * (c.t + c.b), y2 = c.innerBottom - c.h * (c.t - c.b);
      ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const s of [-1, 1]) {
        const ex = x + s * (w + 6);
        ctx.moveTo(ex, y1); ctx.lineTo(ex + s * 7, y1);
        ctx.moveTo(ex, y2); ctx.lineTo(ex + s * 7, y2);
        ctx.moveTo(ex + s * 7, y1); ctx.lineTo(ex + s * 7, y2);
      }
      ctx.stroke();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.moveTo(x - w - 13, ty); ctx.lineTo(x + w + 13, ty); ctx.stroke();
      ctx.setLineDash([]);
      if (g.plays <= 2 && g.n < 3 && c === g.cur && !c.result) {
        ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#7dffb0'; ctx.fillText('◀ LINE', x + w + 20, ty);
      }
    }

    // 玻璃边和高光
    glassPath(ctx, c, wall / 2);
    ctx.strokeStyle = 'rgba(225,235,255,.6)'; ctx.lineWidth = wall; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 4; i <= 34; i++) { const f = i / 40; ctx.lineTo(x - hw(c, f) + 7, c.innerBottom - f * c.h); }
    ctx.stroke();
  }

  function drawStream(ctx, g) {
    const ds = g.drops;
    if (!ds.length && !g.pouring) return;
    ctx.lineCap = 'round';
    // 按杯分开画（倒的那一杯一般只有一条）
    let prev = null;
    for (let i = 0; i < ds.length; i++) {
      const d = ds[i];
      if (prev && prev.c === d.c && d.y - prev.y < 30 && d.y > prev.y - 30) {
        const wTop = d.c.stream, k = clamp((d.y - TAP_Y) / 300, 0, 1);
        ctx.strokeStyle = d.c.drink.c; ctx.lineWidth = lerp(wTop, wTop * 0.7, k);
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      }
      prev = d;
    }
    // 出水口到第一滴
    const lastD = ds[ds.length - 1];
    if (g.pouring && lastD) {
      ctx.strokeStyle = g.cur.drink.c; ctx.lineWidth = g.cur.stream;
      ctx.beginPath(); ctx.moveTo(TAP_X, TAP_Y); ctx.lineTo(lastD.x, lastD.y); ctx.stroke();
    }
    // 高光
    prev = null;
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < ds.length; i++) {
      const d = ds[i];
      if (prev && prev.c === d.c && d.y - prev.y < 30 && d.y > prev.y - 30) { ctx.moveTo(prev.x - 1.5, prev.y); ctx.lineTo(d.x - 1.5, d.y); }
      prev = d;
    }
    ctx.stroke();
  }

  function drawTap(ctx, g, v) {
    const c = g.cur;
    // 管子从右边墙里出来
    const pipeY = PIPE_Y;
    const pg = ctx.createLinearGradient(0, pipeY - 9, 0, pipeY + 9);
    pg.addColorStop(0, '#e9eef8'); pg.addColorStop(0.5, '#aab3c7'); pg.addColorStop(1, '#6f7891');
    ctx.fillStyle = pg; ctx.fillRect(TAP_X, pipeY - 9, v.x1 - TAP_X, 18);
    ctx.fillStyle = '#596179'; ctx.fillRect(v.x1 - 14, pipeY - 14, 14, 28);
    // 龙头
    const bg = ctx.createLinearGradient(TAP_X - 26, 0, TAP_X + 26, 0);
    bg.addColorStop(0, '#7b849c'); bg.addColorStop(0.35, '#f2f5fb'); bg.addColorStop(1, '#78819a');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(TAP_X - 24, pipeY - 16, 48, 30, 10); ctx.fill();
    ctx.beginPath(); ctx.roundRect(TAP_X - 9, pipeY + 8, 18, TAP_Y - pipeY - 6, [0, 0, 6, 6]); ctx.fill();
    // 饮料颜色的小灯：这一杯倒什么
    ctx.fillStyle = c.drink.c; ctx.beginPath(); ctx.arc(TAP_X, pipeY - 1, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    // 把手：朝左横着，倒的时候往下扳（不往上长，免得挡住上面的标题和分数）
    const ang = g.pouring ? -0.5 : 0.45;
    ctx.save(); ctx.translate(TAP_X - 20, pipeY - 2); ctx.rotate(ang);
    ctx.fillStyle = '#e04f5f'; ctx.beginPath(); ctx.roundRect(-34, -5, 34, 10, 5); ctx.fill();
    ctx.fillStyle = '#ff7d8a'; ctx.beginPath(); ctx.arc(-34, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function heart(ctx, x, y, s, full) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.35);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
    if (full) { ctx.fillStyle = '#ff5f7e'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawHud(ctx, g) {
    if (Kit.state !== 'play') return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 40px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText(g.score, 180, 40);
    for (let i = 0; i < 3; i++) heart(ctx, 160 + i * 20, 64, 14, i < g.hearts);
    const c = g.cur;
    if (g.plays <= 2 && g.n === 0 && c.phase === 'ready' && !g.ended) {
      const a = 0.6 + 0.4 * Math.sin(g.t * 6);
      ctx.globalAlpha = a; ctx.font = `900 26px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.fillText(Kit.coarse ? 'HOLD TO POUR' : 'HOLD SPACE TO POUR', 180, 292);
      ctx.globalAlpha = 1;
    }
    if (g.tip && g.tipT > 0) {
      ctx.globalAlpha = Math.min(1, g.tipT);
      ctx.font = `800 19px ${FONT}`; ctx.fillStyle = '#fff';
      g.tip.forEach((s, i) => ctx.fillText(s, 180, 118 + i * 24));
      ctx.globalAlpha = 1;
    }
  }
})();
