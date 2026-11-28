// Meowntain（No.2，2026-11-24）
// 天上掉猫。左右拖纸箱接住，猫一只只叠成塔。
// 接偏了塔会歪（重心出了下面那只猫的边，晃半秒多就从那里断开）；箱子动得急塔会晃，塔越高晃得越慢、幅度越大。
// 第 10 只起也掉狗：狗落到塔上会把顶上 3 只猫吓跑，要躲开。漏接一只猫、塔塌一次，各扣一颗心；每叠满 10 只回一颗（只算第一次到）。
// 分数 = 这一局塔最高叠到几只猫。短视频看点：几十只猫的塔慢慢摇，然后 TIMBER! 全塌。
(function () {
  'use strict';
  const { rand, rr, pick, burst, pop, shake, sound, store, FONT } = Kit;
  const FLOOR = 600, CAM_B = 640;                 // 地面；镜头以画面底边为锚点缩放
  const BOX_W = 86, BOX_H = 34, BOX_MIN = 48, BOX_MAX = 312;
  const KINDS = {
    kitten: { w: 38, h: 24, m: 0.6, pitch: 1.35 },
    cat: { w: 52, h: 30, m: 1.0, pitch: 1.0 },
    chonk: { w: 68, h: 37, m: 1.7, pitch: 0.72 },
  };
  const COATS = [
    { base: '#f2a053', dark: '#c46a22', pat: 'tabby' },
    { base: '#34343f', dark: '#1d1d25', pat: 'tux' },
    { base: '#f6f1e8', dark: '#d9cfc1', pat: 'none' },
    { base: '#a3abb8', dark: '#6c7584', pat: 'tabby' },
    { base: '#f6f1e8', dark: '#34343f', pat: 'calico' },
    { base: '#f2d6a6', dark: '#c99f5f', pat: 'none' },
  ];
  // 塔的晃动：整座塔当成一个会摆的东西（倾角 th），箱子加速时塔往反方向甩
  const SWAY_W0 = 5.2, SWAY_H0 = 260, SWAY_ZETA = 0.11, GRIP = 0.3;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- 塔 ----------
  const boxTop = () => FLOOR - BOX_H;
  function towerH(g) { let h = 0; for (const c of g.stack) h += c.h; return h; }
  // 每只猫的位置：x = 箱子 + 静态偏移累加 + 晃动；y = 中心
  function layout(g) {
    const H = Math.max(1, g.H);
    let S = 0, y = boxTop();
    for (const c of g.stack) {
      S += c.s;
      y -= c.h;
      c.yc = y + c.h / 2;
      const up = boxTop() - c.yc;                   // 离箱子顶多高
      c.e = g.th * up * (0.65 + 0.35 * up / H);
      c.X = g.bx + S + c.e;
      c.S = S;
    }
  }
  function topSupport(g) {
    const n = g.stack.length;
    if (!n) return { x: g.bx, y: boxTop(), w: BOX_W - 10 };
    const c = g.stack[n - 1];
    return { x: c.X, y: c.yc - c.h / 2, w: c.w };
  }
  function makeCat(kind, coat) { const K = KINDS[kind]; return { kind, coat, w: K.w, h: K.h, m: K.m, pitch: K.pitch, s: 0, X: 0, yc: 0, e: 0, squash: 0, face: 'calm', faceT: 0 }; }

  // 世界坐标 → 画面坐标（粒子、飘字用）
  const sx = (g, x) => 180 + (x - 180) * g.z;
  const sy = (g, y) => CAM_B + (y - CAM_B) * g.z;

  // ---------- 声音 ----------
  function meow(p = 1, delay = 0, vol = 0.14) {
    sound.tone(520 * p, 0.09, { type: 'triangle', vol, to: 820 * p, delay });
    sound.tone(820 * p, 0.2, { type: 'triangle', vol, to: 420 * p, delay: delay + 0.08 });
  }
  function woof(delay = 0) {
    sound.tone(190, 0.11, { type: 'square', vol: 0.07, to: 120, delay });
    sound.noise(0.09, { freq: 700, vol: 0.12, delay });
  }
  function thud() { sound.tone(95, 0.16, { vol: 0.25, to: 50 }); sound.noise(0.12, { freq: 300, vol: 0.14 }); }

  // ---------- 生成 ----------
  function spawn(g) {
    const n = g.spawned++;
    const fallT = lerp(2.8, 1.55, clamp(n / 50, 0, 1));
    g.spawnT = lerp(1.75, 0.8, clamp(n / 50, 0, 1)) * rr(0.85, 1.15);
    const isDog = n >= 9 && rand() < lerp(0.14, 0.26, clamp((n - 9) / 40, 0, 1)) && !g.falling.some(f => f.dog);
    const top = topSupport(g);
    const visTop = CAM_B - 640 / g.z;
    let it;
    if (isDog) {
      it = { dog: true, w: 56, h: 34, x: clamp(top.x + rr(-28, 28), 40, 320) };   // 狗专挑塔砸，但总能往一边躲开
      if (!g.dogSeen && !g.demo && g.plays <= 3) { g.dogSeen = true; pop('DODGE THE DOG!', 180, 150, { color: '#ff7a1a', size: 26, life: 1.6 }); }
      woof(); woof(0.18);
    } else {
      const r = rand(), kind = n < 4 ? 'cat' : r < 0.22 ? 'kitten' : r < 0.4 ? 'chonk' : 'cat';
      const c = makeCat(kind, pick(COATS));
      const reach = lerp(60, 150, clamp(n / 30, 0, 1));
      // 塔歪着的时候，箱子推到边上塔顶也只能到这么远：只在够得着的范围里掉
      const rel = top.x - g.bx, lo = BOX_MIN + 12 + rel, hi = BOX_MAX - 12 + rel;
      c.x = n === 0 ? top.x : clamp(top.x + rr(-reach, reach), Math.max(40, lo), Math.min(320, hi));
      c.face = 'fall';
      it = c;
    }
    it.y = visTop - it.h;
    it.vy = Math.max(60, (top.y - it.y) / fallT);
    it.rot = 0; it.wob = rand() * 6;
    g.falling.push(it);
  }

  // ---------- 落地、塌、吓跑 ----------
  function land(g, c) {
    const top = topSupport(g);
    const off = c.x - top.x;
    g.stack.push(c);
    g.H = towerH(g);
    // 让它正好落在接住的位置：静态偏移 = 落点 − 下面那只的位置 − 新的晃动量
    const prev = g.stack.length > 1 ? g.stack[g.stack.length - 2] : null;
    const Sprev = prev ? prev.S : 0;
    c.s = 0; layout(g);
    c.s = c.x - (g.bx + Sprev + c.e);
    layout(g);
    c.squash = 1; c.face = 'happy'; c.faceT = 0.6;
    g.th += off * c.m * 0.00025 / (1 + g.H / 300);
    const n = g.stack.length;
    g.score = Math.max(g.score, n);
    const perfect = Math.abs(off) < 4 && n > 1;
    meow(c.pitch * (perfect ? 1.15 : 1));
    if (perfect) pop('PURRFECT!', sx(g, c.x), sy(g, c.yc) - 30, { color: '#ffd84a', size: 22, life: 0.8 });
    if (n % 10 === 0 && n > (g.milestone || 0)) {
      g.milestone = n;
      Kit.mark('milestone', n / 10);
      pop(`${n} CATS!`, 180, 250, { color: '#fff', size: 38, life: 1.3 });
      if (g.hearts < 3) { g.hearts++; pop('+♥', 236, 64, { color: '#ff5f7e', size: 24, life: 1 }); }
      burst(180, 260, 40, { color: '#ffd84a', speed: 260, life: 1, size: 3, gravity: 300 });
      [0, 0.1, 0.2, 0.32].forEach((d, i) => sound.tone([523, 659, 784, 1047][i], 0.18, { type: 'triangle', vol: 0.12, delay: d }));
    }
  }
  function fly(g, c, vx, vy, vr) {
    g.flyers.push({ c, x: c.X, y: c.yc, vx, vy, rot: g.th, vr, run: 0 });
  }
  function topple(g, j, dir) {
    // j = 断开处下面那只的序号（-1 是箱子），它上面的全掉
    const gone = g.stack.splice(j + 1);
    Kit.mark('timber', gone.length + g.H / 300);
    gone.forEach((c, i) => { c.face = 'scared'; fly(g, c, dir * rr(40, 150) + g.thv * (c.yc - boxTop()) * -0.3, rr(-180, 20), dir * rr(2, 6)); });
    g.H = towerH(g); g.th *= 0.3; g.thv *= 0.3; g.teeter = [];
    layout(g);
    pop('TIMBER!', 180, 200, { color: '#ff6b6b', size: 40, life: 1.2 });
    shake(14); thud();
    gone.slice(0, 6).forEach((c, i) => meow(c.pitch * (1.1 - i * 0.06), 0.05 + i * 0.09, 0.1));
    hurt(g, 'topple');
  }
  function scare(g, dog) {
    const k = Math.min(3, g.stack.length);
    if (k) {
      const gone = g.stack.splice(g.stack.length - k);
      Kit.mark('hiss', k * 0.8);
      gone.forEach(c => { c.face = 'scared'; fly(g, c, rr(-1, 1) < 0 ? rr(-220, -90) : rr(90, 220), rr(-420, -260), rr(-8, 8)); });
      g.H = towerH(g); layout(g);
      pop('HISS!', sx(g, dog.x), sy(g, dog.y) - 30, { color: '#ff9f43', size: 30 });
      sound.noise(0.35, { freq: 3800, filter: 'highpass', vol: 0.12 });
      shake(8);
    }
    woof();
    g.flyers.push({ dog: true, c: dog, x: dog.x, y: dog.y, vx: (dog.x > 180 ? 1 : -1) * 140, vy: -260, rot: 0, vr: 5, run: 0 });
  }
  function hurt(g, why) {
    g.why = g.why || {}; g.why[why] = (g.why[why] || 0) + 1;
    if (g.ended || g.hearts <= 0) return;
    g.hearts--;
    g.lastHurt = why;
    if (!g.demo && navigator.vibrate) { try { navigator.vibrate(30); } catch (_) { } }
    if (g.hearts <= 0) {
      g.overTitle = why === 'topple' ? 'Cat-astrophe!' : 'Missed one!';
      g.overLine = `Tallest meowntain: ${g.score} cat${g.score === 1 ? '' : 's'}`;
      g.overAt = g.t;
    }
  }

  Kit.game({
    id: 'meowntain', no: 2, title: 'Meowntain', verb: 'Catch the cats. Stack them high.', bg: '#8fd0f2', ctaY: 300, light: true,

    reset(g) {
      g.bx = 180; g.bv = 0; g.tx = 180; g.ba = 0; g.th = 0; g.thv = 0;
      g.stack = []; g.falling = []; g.flyers = []; g.teeter = []; g.H = 0;
      g.z = 1; g.spawnT = 0.9; g.spawned = 0; g.hearts = 3; g.score = 0;
      g.lastX = null; g.moved = 0; g.dogSeen = false; g.overAt = 0; g.creakT = 0; g.maxTeeter = 0; g.tj = -2;
      g.plays = g.demo ? 99 : store.get('meowntain.plays', 0) + 1;
      if (!g.demo) store.set('meowntain.plays', g.plays);
    },

    update(g, dt, input) {
      // 镜头：塔越高拉得越远
      const topY = boxTop() - g.H;
      const need = CAM_B - (topY - 240);
      const zt = clamp(600 / need, 0.2, 1);
      g.z += (zt - g.z) * (1 - Math.exp(-2.5 * dt));

      // 手指/鼠标 → 箱子目标；键盘左右也行
      if (!g.ended) {
        const wx = 180 + (input.x - 180) / g.z;
        const mouseMoved = !Kit.coarse && g.lastX != null && Math.abs(input.x - g.lastX) > 0.01;
        if (input.down || mouseMoved) g.tx = wx;
        if (input.axis) g.tx += input.axis * 420 * dt;
        g.lastX = input.x;
        g.tx = clamp(g.tx, BOX_MIN, BOX_MAX);
      }
      // 箱子跟过去（有加速度上限，塔才会被甩）
      const a = clamp(120 * (g.tx - g.bx) - 22 * g.bv, -6500, 6500);
      g.bv = clamp(g.bv + a * dt, -1100, 1100);
      const ox = g.bx;
      g.bx += g.bv * dt;
      if (g.bx < BOX_MIN || g.bx > BOX_MAX) { g.bx = clamp(g.bx, BOX_MIN, BOX_MAX); g.bv = 0; }
      g.moved += Math.abs(g.bx - ox);
      const acc = (g.bx - ox) / dt - (g.prevBv || 0);
      g.prevBv = (g.bx - ox) / dt;

      // 晃
      const w = SWAY_W0 / Math.sqrt(1 + g.H / SWAY_H0);
      if (g.stack.length) {
        g.thv += (-w * w * g.th - 2 * SWAY_ZETA * w * g.thv) * dt - GRIP * acc / (180 + g.H);   // acc = 这一帧箱子速度变了多少（冲量）
        g.th += g.thv * dt;
        g.th = clamp(g.th, -0.6, 0.6);
      } else { g.th = 0; g.thv = 0; }
      layout(g);

      // 重心检查：从顶往下，每一层上面的猫的重心有没有出这一层的边
      let mass = 0, mx = 0, worst = 0, worstJ = -2, worstDir = 0;
      for (let j = g.stack.length - 1; j >= -1; j--) {
        if (mass > 0) {
          const X = j >= 0 ? g.stack[j].X : g.bx, half = j >= 0 ? g.stack[j].w / 2 : BOX_W / 2;
          const com = mx / mass, m = Math.abs(com - X) / half;
          let T = g.teeter[j + 1] || 0;
          T = m > 1 ? T + dt * (1.5 + (m - 1) * 10) : Math.max(0, T - dt * 2);
          g.teeter[j + 1] = T;
          if (T > worst) { worst = T; worstJ = j; worstDir = Math.sign(com - X) || 1; }
          if (T >= 1) {
            // 记一下：不晃的话这一层会不会也出界（区分"接偏了"和"晃塌了"）
            let ms = 0, mmx = 0; for (let k = j + 1; k < g.stack.length; k++) { ms += g.stack[k].m; mmx += g.stack[k].m * (g.bx + g.stack[k].S); }
            const Xs = j >= 0 ? g.bx + g.stack[j].S : g.bx;
            g.toppleLog = g.toppleLog || [];
            g.toppleLog.push({ n: g.stack.length, j, static: +(Math.abs(mmx / ms - Xs) / half).toFixed(2), th: +g.th.toFixed(3) });
            topple(g, j, Math.sign(com - X) || 1); break;
          }
        }
        if (j >= 0) { mass += g.stack[j].m; mx += g.stack[j].m * g.stack[j].X; }
      }
      g.maxTeeter = worst; g.tj = worstJ; g.tdir = worstDir;
      if (worst > 0.05 && !g.ended) {
        g.creakT -= dt;
        if (g.creakT <= 0) { g.creakT = 0.16; sound.tone(120 + worst * 90, 0.12, { type: 'sawtooth', vol: 0.035, to: 90 + worst * 60 }); }
        for (let k = worstJ + 1; k < g.stack.length; k++) { g.stack[k].face = 'scared'; g.stack[k].faceT = 0.3; }
      }

      // 生成
      if (!g.ended && g.hearts > 0) { g.spawnT -= dt; if (g.spawnT <= 0) spawn(g); }

      // 下落
      for (let i = g.falling.length - 1; i >= 0; i--) {
        const it = g.falling[i];
        it.y += it.vy * dt; it.wob += dt * 5; it.rot = Math.sin(it.wob) * 0.18;
        const b = it.y + it.h / 2, top = topSupport(g);
        // 底边碰到塔顶、但还没整个穿过去（塔顶刚长高一截时也接得住）
        if (b >= top.y && it.y - it.h / 2 <= top.y) {
          const overlap = (it.w + top.w) / 2 - Math.abs(it.x - top.x);
          if (overlap >= 8) {
            g.falling.splice(i, 1);
            if (it.dog) { if (g.stack.length) scare(g, it); else { woof(); g.flyers.push({ dog: true, c: it, x: it.x, y: it.y, vx: (it.x > 180 ? 1 : -1) * 120, vy: -200, rot: 0, vr: 4, run: 0 }); } }
            else land(g, it);
            continue;
          }
        }
        if (b >= FLOOR) {
          g.falling.splice(i, 1);
          it.y = FLOOR - it.h / 2;
          if (it.dog) { woof(); g.flyers.push({ dog: true, c: it, x: it.x, y: it.y, vx: 0, vy: 0, rot: 0, vr: 0, run: 1, dir: it.x > g.bx ? 1 : -1 }); }
          else {
            it.face = 'sad';
            g.flyers.push({ c: it, x: it.x, y: it.y, vx: 0, vy: 0, rot: 0, vr: 0, run: 1, dir: it.x > g.bx ? 1 : -1 });
            pop('MISS', sx(g, it.x), sy(g, FLOOR) - 40, { color: '#9fb4ff', size: 26 });
            sound.tone(700 * it.pitch, 0.35, { type: 'triangle', vol: 0.14, to: 380 * it.pitch });
            shake(5);
            hurt(g, 'miss');
          }
        }
      }

      // 飞出去的猫狗：落地后跑出画面
      for (let i = g.flyers.length - 1; i >= 0; i--) {
        const f = g.flyers[i];
        if (!f.run) {
          f.vy += 1300 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
          if (f.y >= FLOOR - f.c.h / 2) { f.y = FLOOR - f.c.h / 2; f.run = 1; f.rot = 0; f.dir = f.vx >= 0 ? 1 : -1; if (!f.dog) burst(sx(g, f.x), sy(g, FLOOR), 4, { color: '#ffffff', speed: 60, life: 0.4, size: 2, gravity: 200 }); }
        } else {
          f.run += dt; f.x += f.dir * (f.dog ? 260 : 330) * dt; f.y = FLOOR - f.c.h / 2 - Math.abs(Math.sin(f.run * 18)) * 4;
          if (f.x < -400 || f.x > 760) g.flyers.splice(i, 1);
        }
      }
      for (const c of g.stack) { c.squash *= Math.pow(0.002, dt); if (c.faceT > 0) { c.faceT -= dt; if (c.faceT <= 0) c.face = 'calm'; } }

      if (g.hearts <= 0 && g.overAt && g.t - g.overAt > 1.3) g.end();
    },

    // 机器人：看最先落下来的那个；是猫就让塔顶接在它正下方（再往反方向偏一点纠正塔的歪），是狗就躲开
    bot(g, skill) {
      const s = skill == null ? 0.45 : skill;
      const top = topSupport(g);
      let next = null, tl = 1e9;
      for (const it of g.falling) {
        const t = (top.y - (it.y + it.h / 2)) / it.vy;
        if (t >= -0.05 && t < tl) { tl = t; next = it; }
      }
      const rel = top.x - g.bx;
      let want = g.bx;
      if (next && !next.dog) {
        // 塔顶偏离箱子中心多少，就让新猫往回落一点，把塔扶正（不超过下面那只猫的三成宽）
        const fix = clamp(-rel * 0.5, -0.3 * Math.min(top.w, next.w), 0.3 * Math.min(top.w, next.w));
        if (next.botErr == null) next.botErr = (rand() + rand() + rand() + rand() - 2) * 1.73 * s * 14;
        want = next.x - fix - rel + next.botErr;
      } else if (next && next.dog) {
        const sep = (next.w + top.w) / 2 + 14;
        if (Math.abs(next.x - top.x) < sep) {
          want = g.bx + (next.x < top.x ? next.x + sep - top.x : next.x - sep - top.x);
          if (want < BOX_MIN + 10 || want > BOX_MAX - 10) want = g.bx + (next.x < top.x ? next.x - sep - top.x : next.x + sep - top.x);
        }
      }
      // 手指不瞬移：塔越高挪得越慢（像小心的真人）
      const v = lerp(900, 260, clamp(g.H / 700, 0, 1)) / (0.6 + s);
      if (g.botTx == null) g.botTx = g.bx;
      g.botTx += clamp(clamp(want, BOX_MIN, BOX_MAX) - g.botTx, -v / 60, v / 60);
      return { down: true, x: 180 + (g.botTx - 180) * g.z };
    },

    selfTest(g) { return { ok: g.moved > 40, msg: `拖动后纸箱移动了 ${Math.round(g.moved)}` }; },
    statLine(g) { return `最高 ${g.score} 只`; },
    shareText(g) { return `Meowntain 🐱×${g.score} 📦\nI stacked ${g.score} cat${g.score === 1 ? '' : 's'} before TIMBER! Can you beat it?`; },
    ogReady(g) { return g.stack.length >= 22 && g.maxTeeter < 0.05; },
    thumbReady(g) { return g.stack.length >= 9 && g.falling.some(f => !f.dog && f.y > boxTop() - g.H - 200 && f.y < boxTop() - g.H - 60); },

    draw(ctx, g, view) {
      drawSky(ctx, g, view);
      ctx.save();
      ctx.translate(180, CAM_B); ctx.scale(g.z, g.z); ctx.translate(-180, -CAM_B);
      drawGround(ctx, g, view);
      drawBox(ctx, g);
      drawStack(ctx, g);
      for (const it of g.falling) it.dog ? drawDog(ctx, it.x, it.y, it.rot, true) : drawCat(ctx, it, it.x, it.y, it.rot, 'fall', 0);
      for (const f of g.flyers) {
        const legs = f.run ? Math.sin(f.run * 18) : 0;
        f.dog ? drawDog(ctx, f.x, f.y, f.rot, !f.run, f.dir, legs) : drawCat(ctx, f.c, f.x, f.y, f.rot, f.run ? 'run' : 'scared', 0, f.dir, legs);
      }
      ctx.restore();
      drawHud(ctx, g);
    },
  });

  // ---------- 画 ----------
  function drawSky(ctx, g, v) {
    const sk = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    sk.addColorStop(0, '#6fbdea'); sk.addColorStop(0.7, '#bfe6fb'); sk.addColorStop(1, '#e3f5ff');
    ctx.fillStyle = sk; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    // 云（猫从云里掉下来）
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const W = v.x1 - v.x0 + 200;
    for (let i = 0; i < 5; i++) {
      const x = v.x0 - 100 + ((i * 97 + g.t * (6 + i * 2)) % W), y = v.y0 + 40 + (i % 3) * 26;
      for (const [dx, dy, r] of [[0, 0, 22], [22, -8, 26], [46, 0, 20], [24, 8, 22]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function drawGround(ctx, g, v) {
    const L = -2000, R = 2400;
    ctx.fillStyle = '#7cc46a'; ctx.fillRect(L, FLOOR, R - L, 3000);
    ctx.fillStyle = '#5fae52'; ctx.fillRect(L, FLOOR, R - L, 6);
    ctx.fillStyle = '#6ab95b';
    for (let x = -600; x < 960; x += 46) { ctx.beginPath(); ctx.ellipse(x + (x * 7 % 19), FLOOR + 24 + (x * 13 % 17), 10, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    // 小花
    for (let x = -580; x < 960; x += 113) {
      const fx = x + (x * 31 % 40), fy = FLOOR + 14 + (x * 7 % 12);
      ctx.fillStyle = ['#fff', '#ffd84a', '#ff9fc2'][Math.abs(x) % 3];
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(fx + Math.cos(k * 1.26) * 3, fy + Math.sin(k * 1.26) * 3, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#f39c3d'; ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawBox(ctx, g) {
    const x = g.bx, y = boxTop();
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(x, FLOOR + 2, BOX_W * 0.55, 5, 0, 0, Math.PI * 2); ctx.fill();
    // 翻开的盖子
    ctx.fillStyle = '#b37c45';
    ctx.beginPath(); ctx.moveTo(x - BOX_W / 2, y + 2); ctx.lineTo(x - BOX_W / 2 - 16, y - 10); ctx.lineTo(x - BOX_W / 2 + 10, y - 8); ctx.lineTo(x - BOX_W / 2 + 14, y + 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + BOX_W / 2, y + 2); ctx.lineTo(x + BOX_W / 2 + 16, y - 10); ctx.lineTo(x + BOX_W / 2 - 10, y - 8); ctx.lineTo(x + BOX_W / 2 - 14, y + 2); ctx.fill();
    ctx.fillStyle = '#cf9a5f'; ctx.beginPath(); ctx.roundRect(x - BOX_W / 2, y, BOX_W, BOX_H, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x - BOX_W / 2, y + BOX_H - 8, BOX_W, 8);
    ctx.fillStyle = '#e8c48f'; ctx.fillRect(x - 7, y, 14, BOX_H);
    ctx.strokeStyle = 'rgba(80,50,20,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 18, y + 12); ctx.lineTo(x + 32, y + 12); ctx.moveTo(x + 20, y + 18); ctx.lineTo(x + 30, y + 18); ctx.stroke();
  }
  function drawStack(ctx, g) {
    const st = g.stack, j = g.tj, T = g.maxTeeter;
    const split = T > 0.02 && j >= -1 ? j : null;   // 从哪一层往上歪（-1 = 从箱子上歪）
    for (let k = 0; k < st.length; k++) {
      if (split !== null && k === split + 1) {
        // 从断开处往上整体歪过去（摇摇欲坠）
        const sup = split >= 0 ? st[split] : null;
        const px = (sup ? sup.X : g.bx) + g.tdir * (sup ? sup.w / 2 : BOX_W / 2);
        const py = sup ? sup.yc - sup.h / 2 : boxTop();
        ctx.save(); ctx.translate(px, py); ctx.rotate(g.tdir * T * 0.32 + Math.sin(g.t * 40) * 0.01 * T); ctx.translate(-px, -py);
      }
      const c = st[k];
      drawCat(ctx, c, c.X, c.yc, g.th * 0.7, c.face, c.squash);
    }
    if (split !== null && st.length > split + 1) ctx.restore();
  }

  function drawCat(ctx, c, x, y, rot, face, squash, dir, legs) {
    const w = c.w, h = c.h, co = c.coat;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    if (dir) ctx.scale(dir, 1);
    if (squash) ctx.scale(1 + squash * 0.14, 1 - squash * 0.16);
    const ink = 'rgba(40,28,24,.85)';
    // 尾巴
    ctx.strokeStyle = co.pat === 'calico' ? '#f2a053' : co.pat === 'tux' ? co.base : co.dark;
    ctx.lineWidth = h * 0.2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (face === 'fall' || face === 'scared') { ctx.moveTo(w * 0.42, h * 0.1); ctx.quadraticCurveTo(w * 0.7, -h * 0.2, w * 0.6, -h * 0.7); }
    else { ctx.moveTo(w * 0.4, h * 0.3); ctx.quadraticCurveTo(w * 0.62, h * 0.1, w * 0.5, -h * 0.2); }
    ctx.stroke();
    // 身子（面包形）
    ctx.fillStyle = co.base;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.46); ctx.fill();
    // 花纹
    if (co.pat === 'tabby') {
      ctx.strokeStyle = co.dark; ctx.lineWidth = Math.max(1.5, h * 0.08);
      for (const sx of [-0.36, 0.3, 0.38]) { ctx.beginPath(); ctx.moveTo(w * sx, -h * 0.42); ctx.lineTo(w * sx + w * 0.02, -h * 0.18); ctx.stroke(); }
    } else if (co.pat === 'calico') {
      ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.46); ctx.clip();
      ctx.fillStyle = '#f2a053'; ctx.beginPath(); ctx.ellipse(-w * 0.38, -h * 0.2, w * 0.2, h * 0.32, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#34343f'; ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.05, w * 0.17, h * 0.3, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 头
    const hr = h * 0.5, hx = 0, hy = -h * 0.12;
    ctx.fillStyle = co.base;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(hx + s * hr * 0.95, hy - hr * 0.2); ctx.lineTo(hx + s * hr * 0.78, hy - hr * 1.25); ctx.lineTo(hx + s * hr * 0.22, hy - hr * 0.78); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(hx, hy, hr * 1.12, hr * 0.92, 0, 0, Math.PI * 2); ctx.fill();
    if (co.pat === 'calico') { ctx.fillStyle = '#f2a053'; ctx.beginPath(); ctx.ellipse(hx - hr * 0.55, hy - hr * 0.35, hr * 0.42, hr * 0.38, 0, 0, Math.PI * 2); ctx.fill(); }
    if (co.pat === 'tabby') { ctx.strokeStyle = co.dark; ctx.lineWidth = Math.max(1.2, h * 0.06); ctx.beginPath(); for (const s of [-0.25, 0, 0.25]) { ctx.moveTo(hx + s * hr, hy - hr * 0.88); ctx.lineTo(hx + s * hr, hy - hr * 0.55); } ctx.stroke(); }
    if (co.pat === 'tux') { ctx.fillStyle = '#f6f1e8'; ctx.beginPath(); ctx.ellipse(hx, hy + hr * 0.5, hr * 0.55, hr * 0.42, 0, 0, Math.PI * 2); ctx.fill(); }
    // 耳朵里
    ctx.fillStyle = 'rgba(255,150,170,.6)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * hr * 0.8, hy - hr * 0.42); ctx.lineTo(hx + s * hr * 0.74, hy - hr * 1.0); ctx.lineTo(hx + s * hr * 0.42, hy - hr * 0.7); ctx.fill(); }
    // 脸
    const eyeC = co.base === '#34343f' ? '#f6f1e8' : ink;
    const ex = hr * 0.42, ey = hy - hr * 0.08;
    ctx.strokeStyle = eyeC; ctx.fillStyle = eyeC; ctx.lineWidth = Math.max(1.4, h * 0.065); ctx.lineCap = 'round';
    if (face === 'happy' || face === 'calm') {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * ex, ey + hr * 0.08, hr * 0.17, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    } else if (face === 'scared' || face === 'fall') {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + s * ex, ey, hr * 0.24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(hx + s * ex, ey + hr * 0.03, hr * 0.12, 0, Math.PI * 2); ctx.fill();
      }
    } else if (face === 'sad') {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * ex - hr * 0.16, ey - s * hr * 0.06); ctx.lineTo(hx + s * ex + hr * 0.16, ey + s * hr * 0.06); ctx.stroke(); }
    } else {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * ex, ey, hr * 0.11, 0, Math.PI * 2); ctx.fill(); }
    }
    // 鼻子、嘴
    ctx.fillStyle = '#f08aa0';
    ctx.beginPath(); ctx.moveTo(hx - hr * 0.1, hy + hr * 0.14); ctx.lineTo(hx + hr * 0.1, hy + hr * 0.14); ctx.lineTo(hx, hy + hr * 0.26); ctx.fill();
    ctx.strokeStyle = eyeC; ctx.lineWidth = Math.max(1, h * 0.045);
    if (face === 'fall' || face === 'scared') { ctx.beginPath(); ctx.ellipse(hx, hy + hr * 0.45, hr * 0.12, hr * 0.15, 0, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(hx - hr * 0.1, hy + hr * 0.28, hr * 0.1, 0.1, Math.PI - 0.1); ctx.arc(hx + hr * 0.1, hy + hr * 0.28, hr * 0.1, 0.1, Math.PI - 0.1); ctx.stroke(); }
    // 胡子
    ctx.strokeStyle = 'rgba(40,28,24,.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const s of [-1, 1]) for (const k of [-0.08, 0.08]) { ctx.moveTo(hx + s * hr * 0.45, hy + hr * 0.25); ctx.lineTo(hx + s * hr * 1.25, hy + hr * (0.18 + k * 2)); }
    ctx.stroke();
    // 爪子：掉下来时张开，跑的时候倒腾
    ctx.fillStyle = co.pat === 'tux' ? '#f6f1e8' : co.base;
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    if (face === 'fall' || face === 'scared') {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * w * 0.52, h * 0.05, h * 0.16, h * 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    } else {
      const lg = legs || 0;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * h * 0.32 + lg * s * 2, h * 0.44, h * 0.16, h * 0.11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawDog(ctx, x, y, rot, falling, dir, legs) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); if (dir) ctx.scale(dir, 1);
    const w = 56, h = 34;
    ctx.fillStyle = '#b5783f';
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + 4, w, h - 6, 12); ctx.fill();
    // 腿
    ctx.fillStyle = '#9a6331';
    const lg = legs || 0;
    for (const s of [-1, 1]) {
      if (falling) { ctx.beginPath(); ctx.ellipse(s * w * 0.48, 0, 7, 5, s * 0.5, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.roundRect(s * w * 0.3 - 4 + lg * 3 * s, h * 0.3, 8, 8, 3); ctx.fill(); }
    }
    // 尾巴
    ctx.strokeStyle = '#9a6331'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w * 0.46, -2); ctx.lineTo(-w * 0.62, -12 + Math.sin(Date.now() / 60) * 3); ctx.stroke();
    // 头
    ctx.fillStyle = '#c88a4e'; ctx.beginPath(); ctx.ellipse(w * 0.34, -h * 0.3, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a4a22';
    ctx.beginPath(); ctx.ellipse(w * 0.2, -h * 0.25, 5, 10, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.5, -h * 0.25, 5, 10, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1d14';
    ctx.beginPath(); ctx.arc(w * 0.28, -h * 0.36, 2.2, 0, Math.PI * 2); ctx.arc(w * 0.42, -h * 0.36, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.35, -h * 0.22, 3.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff7d96'; ctx.beginPath(); ctx.ellipse(w * 0.38, -h * 0.08, 3, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function heart(ctx, x, y, s, full) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.35);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
    if (full) { ctx.fillStyle = '#ff5f7e'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(30,40,70,.35)'; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawHud(ctx, g) {
    if (Kit.state !== 'play') return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,60,100,.35)';
    ctx.font = `900 40px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.strokeText(g.stack.length, 180, 40); ctx.fillText(g.stack.length, 180, 40);
    for (let i = 0; i < 3; i++) heart(ctx, 160 + i * 20, 64, 14, i < g.hearts);
    if (g.score > g.stack.length) {
      ctx.font = `800 13px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillText('TOP ' + g.score, 180, 92);
    }
    if (g.plays <= 2 && g.moved < 40 && g.spawned >= 2 && !g.ended) {
      const a = 0.6 + 0.4 * Math.sin(g.t * 6);
      ctx.globalAlpha = a; ctx.font = `900 24px ${FONT}`; ctx.fillStyle = '#fff';
      ctx.strokeText(Kit.coarse ? '◀  DRAG  ▶' : '◀  MOVE MOUSE  ▶', 180, 470); ctx.fillText(Kit.coarse ? '◀  DRAG  ▶' : '◀  MOVE MOUSE  ▶', 180, 470);
      ctx.globalAlpha = 1;
    }
  }
})();
