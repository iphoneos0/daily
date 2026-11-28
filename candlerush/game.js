// Candle Rush（No.5，2026-11-29）
// 一句话：生日蛋糕在转，点一下往蛋糕边上插一根点着的蜡烛，碰到别的蜡烛就输；插满一个蛋糕就「Make a wish!」一口气吹灭，换下一个。
// 难在：每个蛋糕转法不一样（匀速、反转、忽快忽慢、走走停停、来回掉头），后面还有先插好挡路的蜡烛。
// 短视频看点：插满点亮蜡烛的蛋糕越转越快，最后一根插进去，一口气全吹灭（docs/games/5-candlerush.md）
(function () {
  'use strict';
  const { rand, rr, pick, burst, pop, shake, sound, FONT } = Kit;
  const TAU = Math.PI * 2;
  const CX = 180, CY = 250, R = 92;            // 蛋糕（俯视）圆心、半径
  const STICK = 46, CW = 10;                   // 蜡烛露在蛋糕外面的长度、粗细
  const LAUNCH_Y = 548, FLY = 2300;            // 待发的蜡烛底端在哪、飞多快（像素/秒）
  const HIT_Y = CY + R - 6;                    // 蜡烛插进蛋糕的那一点（正下方，插进奶油 6 像素）
  const GAP = 0.15;                            // 两根蜡烛至少隔多少弧度，不然撞上
  const BERRY = 0.2;                           // 插在草莓多近算插中
  const COLORS = ['#ff6b8b', '#ffd23f', '#5ec8ff', '#7ee08a', '#c79bff', '#ffa14a'];
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d < -Math.PI) d += TAU; if (d > Math.PI) d -= TAU; return Math.abs(d); };

  // 第 n 个蛋糕（从 1 开始）的转法：5 种一轮，之后每轮更快、挡路的蜡烛更多
  function makeCake(n) {
    const round = Math.floor((n - 1) / 5), kind = (n - 1) % 5;
    const sp = 1 + 0.13 * round;
    const need = Math.min(12, 6 + Math.floor(n / 2));
    const pre = Math.min(9, (kind === 4 ? 2 : 0) + round * 2 + (n > 5 && kind >= 2 ? 1 : 0));
    const berries = n >= 2 ? (n % 3 === 0 ? 2 : 1) : 0;
    const dir = rand() < 0.5 ? 1 : -1;
    const spin = [
      t => dir * 1.45 * sp,                                                      // 匀速
      t => -dir * 1.8 * sp,                                                      // 反过来
      t => dir * (1.8 + 1.2 * Math.sin(t * 1.5)) * sp,                           // 忽快忽慢
      t => dir * ((t % 2) < 1.2 ? 2.7 : 0.3) * sp,                               // 走走停停
      t => (Math.floor(t / 1.6) % 2 ? -1 : 1) * dir * 2.2 * sp,                  // 来回掉头
    ][kind];
    const c = { n, need, left: need, spin, t: 0, a: rand() * TAU, candles: [], berries: [], y: CY, scale: 1, sprinkles: [] };
    // 先插好挡路的蜡烛（彼此隔开）
    for (let i = 0; i < pre; i++) {
      for (let k = 0; k < 30; k++) {
        const a = rand() * TAU;
        if (c.candles.every(x => angDiff(x.a, a) > GAP * 2.2)) { c.candles.push({ a, color: pick(COLORS), lit: true, pre: true }); break; }
      }
    }
    for (let i = 0; i < berries; i++) {
      for (let k = 0; k < 30; k++) {
        const a = rand() * TAU;
        if (c.candles.every(x => angDiff(x.a, a) > 0.45) && c.berries.every(x => angDiff(x.a, a) > 0.8)) { c.berries.push({ a }); break; }
      }
    }
    for (let i = 0; i < 26; i++) {
      const rad = Math.sqrt(rand()) * (R - 26), th = rand() * TAU;
      c.sprinkles.push({ x: Math.cos(th) * rad, y: Math.sin(th) * rad, r: rand() * TAU, c: pick(COLORS) });
    }
    return c;
  }

  function newCandle() { return { y: LAUNCH_Y, flying: false, color: pick(COLORS) }; }

  // 蜡烛（从蛋糕边上往外指）。a：在屏幕上的角度；flame：火苗大小 0..1
  function drawCandle(ctx, x, y, a, color, flame, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    // 蜡烛身（带斜条纹）
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(0, -CW / 2, STICK, CW, 3); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, -CW / 2, STICK, CW, 3); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
    for (let s = -6; s < STICK + 6; s += 9) { ctx.beginPath(); ctx.moveTo(s, CW / 2); ctx.lineTo(s + 7, -CW / 2); ctx.stroke(); }
    ctx.restore();
    // 灯芯
    ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(STICK - 1, 0); ctx.lineTo(STICK + 3, 0); ctx.stroke();
    // 火苗：水滴形，圆的那头贴着灯芯，尖朝外
    if (flame > 0.02) {
      const f = flame * (0.92 + 0.08 * Math.sin(t * 23 + x)), L = 20 * f, Wd = 6.5 * f, b = STICK + 2 + Wd * 0.6;   // 火苗底压住灯芯，不留缝
      const gl = ctx.createRadialGradient(b + L * 0.3, 0, 1, b + L * 0.3, 0, 24 * f);
      gl.addColorStop(0, 'rgba(255,210,90,.5)'); gl.addColorStop(1, 'rgba(255,160,40,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(b + L * 0.3, 0, 24 * f, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffa62b';
      ctx.beginPath(); ctx.moveTo(b + L, 0);
      ctx.bezierCurveTo(b + L * 0.55, -Wd * 0.9, b - Wd * 0.2, -Wd * 1.25, b - Wd, 0);
      ctx.bezierCurveTo(b - Wd * 0.2, Wd * 1.25, b + L * 0.55, Wd * 0.9, b + L, 0); ctx.fill();
      ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.ellipse(b + Wd * 0.1, 0, Wd * 0.75, Wd * 0.55, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawCake(ctx, c, t) {
    ctx.save(); ctx.translate(CX, c.y); ctx.scale(c.scale, c.scale);
    // 盘子、蛋糕侧面、奶油
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(6, 10, R + 22, R + 22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4eef8'; ctx.beginPath(); ctx.arc(0, 0, R + 18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9cde3'; ctx.beginPath(); ctx.arc(0, 0, R + 18, 0, TAU); ctx.arc(0, 0, R + 12, 0, TAU, true); ctx.fill();
    ctx.fillStyle = '#c9845a'; ctx.beginPath(); ctx.arc(0, 0, R + 2, 0, TAU); ctx.fill();
    ctx.rotate(c.a);
    // 蜡烛插在奶油下面先画（从边上伸出去）
    for (const k of c.candles) drawCandle(ctx, Math.cos(k.a) * (R - 6), Math.sin(k.a) * (R - 6), k.a, k.color, k.lit ? (k.flame == null ? 1 : k.flame) : 0, t);
    ctx.fillStyle = '#ffb8cf'; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd3e1'; ctx.beginPath(); ctx.arc(-14, -16, R - 28, 0, TAU); ctx.fill();
    // 一圈挤花
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * TAU; ctx.fillStyle = '#fff6fa';
      ctx.beginPath(); ctx.arc(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10), 6.5, 0, TAU); ctx.fill();
    }
    for (const s of c.sprinkles) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r); ctx.fillStyle = s.c; ctx.beginPath(); ctx.roundRect(-4, -1.5, 8, 3, 1.5); ctx.fill(); ctx.restore();
    }
    // 草莓
    for (const b of c.berries) {
      const x = Math.cos(b.a) * (R - 14), y = Math.sin(b.a) * (R - 14);
      ctx.fillStyle = '#e8364f'; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7a8c'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe58a'; for (let i = 0; i < 5; i++) { const q = i * 1.3; ctx.fillRect(x + Math.cos(q) * 6 - 1, y + Math.sin(q) * 6 - 1, 2, 2); }
      ctx.fillStyle = '#3fae5a'; ctx.beginPath(); ctx.arc(x - Math.cos(b.a) * 9, y - Math.sin(b.a) * 9, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // 中间：还差几根（不跟着转）
    if (c.left > 0 && c.scale > 0.6) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(46 * c.scale)}px ${FONT}`; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = '#c2577b';
      ctx.strokeText(c.left, CX, c.y + 2); ctx.fillStyle = '#fff'; ctx.fillText(c.left, CX, c.y + 2);
      ctx.restore();
    }
  }

  function wish(g) {
    const c = g.cake;
    g.wishT = 0;
    g.score += 5 * c.n;
    Kit.mark('wish', c.candles.length / 3 + c.n * 0.2);
    pop('Make a wish!', CX, 120, { size: 34, color: '#ffe066', life: 1.3 });
    sound.tone(523, 0.12, { type: 'triangle', vol: 0.18 }); sound.tone(659, 0.12, { type: 'triangle', vol: 0.18, delay: 0.1 });
    sound.tone(784, 0.12, { type: 'triangle', vol: 0.18, delay: 0.2 }); sound.tone(1047, 0.3, { type: 'triangle', vol: 0.2, delay: 0.3 });
  }

  function blowOut(g) {
    const c = g.cake;
    sound.noise(0.6, { freq: 900, to: 300, q: 0.7, vol: 0.28 });
    for (const k of c.candles) {
      const a = k.a + c.a, x = CX + Math.cos(a) * (R - 6 + STICK + 14), y = c.y + Math.sin(a) * (R - 6 + STICK + 14);
      burst(x, y, 5, { color: 'rgba(230,220,240,.8)', speed: 70, gravity: -80, life: 1.1, size: 5, angle: -Math.PI / 2, spread: 1.2 });
    }
    pop('+' + 5 * c.n, CX, CY, { size: 30, color: '#fff' });
  }

  Kit.game({
    id: 'candlerush', no: 5, title: 'Candle Rush', verb: "Tap to stick the candle. Don't hit another.", bg: '#2a1838',
    ctaY: 470,

    reset(g) {
      g.cakeNo = 1; g.cake = makeCake(1); g.cur = newCandle(); g.wishT = -1; g.falling = null; g.endIn = -1;
      g.thrown = 0; g.stuck = 0; g.berries = 0; g.confetti = [];
      for (let i = 0; i < 40; i++) g.confetti.push({ x: rand() * 760 - 200, y: rand() * 900 - 130, s: rr(2, 4.5), c: pick(COLORS), a: rand() * TAU });
    },

    update(g, dt, input) {
      const c = g.cake;
      // 刚插上的蜡烛火苗慢慢变大
      for (const k of c.candles) if (k.flame != null && k.flame < 1) k.flame = Math.min(1, k.flame + dt * 5);
      // 蛋糕转
      if (g.wishT < 0) { c.t += dt; c.a += c.spin(c.t) * dt; }
      else c.a += c.spin(c.t) * dt * Math.max(0, 1 - g.wishT * 1.2);
      // 撞上以后掉下去的那根
      if (g.falling) {
        const f = g.falling; f.vy += 1400 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      }
      if (g.endIn >= 0) { g.endIn -= dt; if (g.endIn < 0) g.end(); return; }
      if (g.ended) return;
      // 插满以后：先停一下、吹灭、蛋糕往上飞走，新蛋糕从上面掉下来
      if (g.wishT >= 0) {
        const was = g.wishT; g.wishT += dt;
        if (was < 0.55 && g.wishT >= 0.55) { blowOut(g); for (const k of c.candles) k.lit = false; }
        if (g.wishT > 0.95) { c.y -= 900 * dt; c.scale = Math.max(0.5, c.scale - dt * 1.2); }
        if (g.wishT > 1.4) {
          g.cakeNo++; g.cake = makeCake(g.cakeNo); g.cake.y = -150; g.wishT = -1; g.cur = newCandle();
          sound.tone(330, 0.08, { type: 'square', vol: 0.08 });
        }
        return;
      }
      if (c.y < CY) { c.y = Math.min(CY, c.y + 1100 * dt); if (c.y >= CY) { shake(4); sound.noise(0.15, { freq: 300, vol: 0.2 }); } }
      // 点一下：扔出去
      const cur = g.cur;
      if (input.pressed && !cur.flying && c.y >= CY) {
        cur.flying = true; g.thrown++;
        sound.tone(620, 0.09, { to: 980, type: 'triangle', vol: 0.14 });
      }
      if (!cur.flying) return;
      cur.y -= FLY * dt;
      if (cur.y > HIT_Y) return;
      // 到了：看插在蛋糕的哪个位置（相对蛋糕的角度）
      const rel = Math.PI / 2 - c.a;
      if (c.candles.some(k => angDiff(k.a, rel) < GAP)) {
        // 撞上了：弹开、掉下去，这局结束
        g.falling = { x: CX, y: HIT_Y + 10, vx: rr(-160, 160), vy: -380, rot: Math.PI / 2, vr: rr(-14, 14), color: cur.color };
        g.cur = { y: 9999, flying: false, color: cur.color };
        shake(14); sound.tone(140, 0.35, { to: 70, type: 'sawtooth', vol: 0.2 }); sound.noise(0.25, { freq: 2200, vol: 0.25 });
        burst(CX, HIT_Y, 14, { color: '#ffe066', speed: 220, life: 0.5, size: 3 });
        g.overTitle = 'Candle clash!';
        g.overLine = `Cake ${c.n} · ${g.stuck} candles`;
        Kit.mark('clash', 1 + c.candles.length / 6);
        g.endIn = 0.9;
        return;
      }
      c.candles.push({ a: rel, color: cur.color, lit: true, flame: 0.2 });
      c.left--; g.stuck++; g.score++;
      sound.noise(0.08, { freq: 500, q: 2, vol: 0.25 }); sound.tone(880 + Math.min(10, c.need - c.left) * 40, 0.08, { type: 'sine', vol: 0.12 });
      burst(CX, HIT_Y, 6, { color: '#fff6fa', speed: 140, life: 0.35, size: 2.5, angle: Math.PI / 2, spread: 2 });
      // 插中草莓
      const bi = c.berries.findIndex(b => angDiff(b.a, rel) < BERRY);
      if (bi >= 0) {
        c.berries.splice(bi, 1); g.score += 3; g.berries++;
        pop('+3', CX + 40, HIT_Y - 20, { color: '#ff7a8c', size: 26 });
        burst(CX, HIT_Y - 6, 12, { color: '#e8364f', speed: 200, life: 0.5, size: 3 });
        sound.tone(1320, 0.1, { type: 'triangle', vol: 0.14 });
      }
      g.cur = newCandle();
      if (c.left <= 0) wish(g);
    },

    // 机器人：估一下蜡烛飞到时蛋糕转到哪，那个位置离别的蜡烛够远就点。skill 越大，估得越不准
    bot(g, skill) {
      const s = skill == null ? 0.5 : skill, c = g.cake;
      if (g.wishT >= 0 || g.endIn >= 0 || g.cur.flying || c.y < CY) { g.botNoise = null; return false; }
      if (g.botWait > 0) { g.botWait -= 1 / 60; return false; }
      if (g.botNoise == null) g.botNoise = (rand() + rand() + rand() - 1.5) * 0.11 * s;
      const T = (LAUNCH_Y - HIT_Y) / FLY + 1 / 60;
      const rel = Math.PI / 2 - (c.a + c.spin(c.t) * T) + g.botNoise;
      const clear = c.candles.every(k => angDiff(k.a, rel) > GAP + 0.04);
      if (clear) { g.botNoise = null; g.botWait = rr(0.08, 0.25) * (0.6 + s); return true; }
      return false;
    },

    draw(ctx, g, view) {
      const t = g.t;
      // 背景：派对的深紫，底下一点暖光，彩纸点点；画满可见范围（横屏、16:9 的框里两边也是）
      const bg = ctx.createLinearGradient(0, view.y0, 0, view.y1);
      bg.addColorStop(0, '#2a1838'); bg.addColorStop(1, '#4a2140');
      ctx.fillStyle = bg; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
      const glow = ctx.createRadialGradient(CX, CY, 40, CX, CY, 330);
      glow.addColorStop(0, 'rgba(255,190,120,.22)'); glow.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = glow; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
      for (const p of g.confetti) {
        ctx.save(); ctx.translate(p.x, p.y + Math.sin(t * 0.6 + p.a) * 6); ctx.rotate(p.a + t * 0.3);
        ctx.globalAlpha = 0.45; ctx.fillStyle = p.c; ctx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); ctx.restore();
      }
      ctx.globalAlpha = 1;
      // 蛋糕
      drawCake(ctx, g.cake, t);
      // 待发的蜡烛（火苗朝上）
      // 待发、飞着的蜡烛：底朝上（先插进蛋糕的那头），火苗朝下，插好以后就是往外指
      if (g.cur && g.cur.y < 2000) drawCandle(ctx, CX, g.cur.y, Math.PI / 2, g.cur.color, 1, t);
      if (g.falling) drawCandle(ctx, g.falling.x, g.falling.y, g.falling.rot, g.falling.color, 0, t);
      // 分数（正中间上方；左上角留给网站的返回按钮）
      if (Kit.state === 'play') {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `900 40px ${FONT}`; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.35)';
        ctx.strokeText(g.score, CX, 44); ctx.fillStyle = '#fff'; ctx.fillText(g.score, CX, 44);
        ctx.font = `800 15px ${FONT}`; ctx.fillStyle = '#ffd3e1'; ctx.fillText('Cake ' + g.cake.n, CX, 76);
      }
    },

    selfTest(g) { return { ok: g.thrown > 0, msg: `点了以后扔出了 ${g.thrown} 根蜡烛` }; },
    statLine(g) { return `第 ${g.cake.n} 个蛋糕，插了 ${g.stuck} 根`; },
    shareText(g) { return `Candle Rush 🎂×${g.cakeNo - 1} 🕯️×${g.stuck}\nI made it to cake ${g.cake.n}. Can you beat it?`; },
    thumbReady(g) { return g.cake.n >= 2 && g.cake.candles.length >= 5 && g.wishT < 0 && g.cake.y >= CY; },
  });
})();
