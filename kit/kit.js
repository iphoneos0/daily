// kit.js：每款小游戏共用的外壳（手机、平板、电脑同一份代码）
// - 画布铺满屏幕，游戏用竖屏 360×640 的逻辑坐标，多出来的边由游戏自己画满（view 给出可见范围）
// - 输入：按住（触屏任意处 / 鼠标 / 空格等键）、指针位置、左右方向键
// - 固定 60 帧更新；开始页（有 bot 时后台自动演示）、结束页、最高分、分享、静音、回首页
// - 合成音效、粒子、震屏、飘字
// - 网址参数：?bot 自动玩（&loop 玩完接着玩）  ?speed=8 加速  ?seed=3 固定随机  ?skill=0.5 机器人水平  ?shot 隐藏界面（截缩略图）
(function () {
  'use strict';
  const W = 360, H = 640, STEP = 1 / 60;
  const qs = new URLSearchParams(location.search);
  const OPT = {
    bot: qs.has('bot'), shot: qs.has('shot'), loop: qs.has('loop'),
    speed: Math.max(1, Math.min(50, +qs.get('speed') || 1)),
    seed: qs.has('seed') ? (+qs.get('seed') >>> 0) : null,
    skill: qs.has('skill') ? +qs.get('skill') : null,
  };
  const coarse = matchMedia('(pointer: coarse)').matches;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('daily.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem('daily.' + k, JSON.stringify(v)); } catch (_) { } },
  };

  // ---------- 随机数（可固定种子，方便复现和机器人测试） ----------
  let seedState = 1;
  function reseed(s) { seedState = (s >>> 0) || 1; }
  function rand() {
    let t = (seedState += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * rand();
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  // ---------- 声音 ----------
  const sound = {
    ctx: null, out: null, quiet: false, muted: store.get('muted', false), _noise: null,
    unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        this.ctx = new AC();
        this.out = this.ctx.createGain();
        this.out.gain.value = this.muted ? 0 : 0.7;
        this.out.connect(this.ctx.destination);
        const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource();
        s.buffer = b; s.connect(this.out); s.start(0);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    get on() { return !!this.ctx && !this.quiet && !this.muted; },
    setMuted(m) { this.muted = m; store.set('muted', m); if (this.out) this.out.gain.value = m ? 0 : 0.7; },
    noiseBuf() {
      if (!this._noise) {
        const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this._noise = b;
      }
      return this._noise;
    },
    // 一个音：频率、时长，可滑音（to）、延迟（delay）
    tone(freq, dur = 0.12, o = {}) {
      if (!this.on) return;
      const c = this.ctx, t = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const v = o.vol == null ? 0.25 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(this.out);
      osc.start(t); osc.stop(t + dur + 0.02);
    },
    // 一段噪声：溅水、撞击、风声
    noise(dur = 0.2, o = {}) {
      if (!this.on) return;
      const c = this.ctx, t = c.currentTime + (o.delay || 0);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf();
      f.type = o.filter || 'bandpass'; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.freq || 1200, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const v = o.vol == null ? 0.3 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.out);
      s.start(t, Math.random()); s.stop(t + dur + 0.02);
    },
    // 一直响的噪声（倒水声这类），返回 {set(vol, freq), stop()}
    loop(o = {}) {
      const c = this.ctx;
      if (!c) return { set() { }, stop() { } };
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf(); s.loop = true;
      f.type = o.filter || 'bandpass'; f.Q.value = o.q || 4; f.frequency.value = o.freq || 600;
      g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.out); s.start();
      const self = this;
      return {
        set(vol, freq) {
          const t = c.currentTime, v = self.on ? vol : 0;
          g.gain.setTargetAtTime(v, t, 0.03);
          if (freq) f.frequency.setTargetAtTime(freq, t, 0.04);
        },
        stop() { try { s.stop(); } catch (_) { } },
      };
    },
  };

  // ---------- 输入 ----------
  const input = { down: false, pressed: false, released: false, x: W / 2, y: H / 2, axis: 0 };
  const ptrs = new Set(), keys = new Set(), axisKeys = new Set();
  let rawDown = false, pendPress = false, pendRelease = false, block = false;
  const ACTION = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'KeyZ', 'KeyX', 'KeyJ', 'KeyK']);
  function syncDown() {
    const d = ptrs.size > 0 || keys.size > 0;
    if (d === rawDown) return;
    rawDown = d;
    if (d) pendPress = true; else pendRelease = true;
  }
  function releaseAll() { ptrs.clear(); keys.clear(); axisKeys.clear(); syncDown(); input.axis = 0; }
  function pollInput() {
    if (block) {
      if (!rawDown) { block = false; pendPress = pendRelease = false; }
      input.down = input.pressed = input.released = false;
      return;
    }
    input.pressed = pendPress; input.released = pendRelease;
    pendPress = pendRelease = false;
    input.down = rawDown;
  }

  // ---------- 粒子、飘字、震屏 ----------
  const parts = [], pops = [];
  let shakeAmt = 0;
  function burst(x, y, n, o = {}) {
    if (parts.length > 900) return;
    for (let i = 0; i < n; i++) {
      const a = (o.angle == null ? -Math.PI / 2 : o.angle) + (Math.random() - 0.5) * (o.spread == null ? Math.PI * 2 : o.spread);
      const sp = (o.speed || 120) * (0.4 + Math.random() * 0.8);
      parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.gravity == null ? 600 : o.gravity,
        life: (o.life || 0.6) * (0.6 + Math.random() * 0.6), t: 0, size: (o.size || 3) * (0.6 + Math.random() * 0.8),
        color: o.color || '#fff', floor: o.floor == null ? 1e9 : o.floor,
      });
    }
  }
  function pop(text, x, y, o = {}) {
    pops.push({ text, x, y, t: 0, life: o.life || 0.9, color: o.color || '#fff', size: o.size || 28, rise: o.rise == null ? 40 : o.rise });
  }
  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
  function stepFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.25; p.vx *= 0.6; }
      if (p.t > p.life) parts.splice(i, 1);
    }
    for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > pops[i].life) pops.splice(i, 1); }
    shakeAmt *= Math.pow(0.0005, dt);
    if (shakeAmt < 0.1) shakeAmt = 0;
  }
  function drawFx(ctx) {
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of pops) {
      const k = p.t / p.life, s = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `900 ${Math.round(p.size * s)}px ${FONT}`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineJoin = 'round';
      const y = p.y - p.rise * Math.min(1, k * 1.5);
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
  }
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

  // 旧浏览器（iOS 15 等）没有 roundRect，补一个简单的
  if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const k = Math.min(Array.isArray(r) ? r[0] || 0 : r || 0, w / 2, h / 2);
      this.moveTo(x + k, y); this.arcTo(x + w, y, x + w, y + h, k); this.arcTo(x + w, y + h, x, y + h, k);
      this.arcTo(x, y + h, x, y, k); this.arcTo(x, y, x + w, y, k); this.closePath();
    };
  }

  // ---------- 画布 ----------
  let canvas, ctx, dpr = 1, cw = 0, ch = 0, sc = 1, ox = 0, oy = 0;
  const view = { x0: 0, y0: 0, x1: W, y1: H };
  function resize() {
    cw = window.innerWidth; ch = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    sc = Math.min(cw / W, ch / H);
    ox = (cw - W * sc) / 2; oy = (ch - H * sc) / 2;
    view.x0 = -ox / sc; view.y0 = -oy / sc; view.x1 = W + ox / sc; view.y1 = H + oy / sc;
    placeCta();
  }
  function placeCta() { if (ui.ctaWrap) ui.ctaWrap.style.top = (oy + (def.ctaY || 300) * sc) + 'px'; }
  function toLogical(e) { input.x = (e.clientX - ox) / sc; input.y = (e.clientY - oy) / sc; }

  // ---------- 状态 ----------
  let def = null, g = null, state = 'title', overT = 0, demoWait = 0, botWas = false, ui = {};
  const best = () => store.get(def.id + '.best', 0);

  function newRun(demo) {
    reseed(OPT.seed != null ? OPT.seed : (Math.random() * 4294967296) >>> 0);
    parts.length = 0; pops.length = 0; shakeAmt = 0; botWas = false;
    g = { t: 0, score: 0, demo, ended: false, overTitle: '', overLine: '' };
    g.end = () => {
      if (g.ended) return;
      g.ended = true;
      if (state === 'play') {
        state = 'over'; overT = 0;
        const b = best(), isBest = g.score > b;
        if (isBest) store.set(def.id + '.best', g.score);
        ui.overTitle.textContent = g.overTitle || 'Game over';
        ui.score.textContent = g.score;
        ui.best.textContent = isBest && g.score > 0 ? 'New best!' : 'Best ' + Math.max(b, g.score);
        ui.best.classList.toggle('new', isBest && g.score > 0);
        ui.overLine.textContent = g.overLine || '';
      } else demoWait = 1.6;
    };
    sound.quiet = demo;
    def.reset(g);
  }
  function startPlay() {
    sound.unlock();
    newRun(false);
    state = 'play';
    block = rawDown;   // 开始那一下不算进游戏
    document.body.dataset.state = 'play';
    ui.over.classList.remove('show');
  }

  // 机器人：把 def.bot 给的"按着没有"转成跟真人一样的按下/松开
  function botInput() {
    const d = !!def.bot(g, OPT.skill);
    input.pressed = d && !botWas; input.released = !d && botWas; input.down = d; botWas = d;
  }

  function step() {
    const demo = state === 'title';
    if (demo || OPT.bot) { if (def.bot) botInput(); else input.down = input.pressed = input.released = false; }
    else if (state === 'play') pollInput();
    else { pollInput(); input.down = input.pressed = input.released = false; }
    g.t += STEP; def.update(g, STEP, input);   // 结束后也继续更新（让洒出、爆炸这类动画播完），游戏自己看 g.ended
    stepFx(STEP);
    if (demo && g.ended) { demoWait -= STEP; if (demoWait <= 0) newRun(true); }
    if (state === 'over') {
      overT += STEP;
      if (overT > 0.75 && !ui.over.classList.contains('show')) { ui.over.classList.add('show'); document.body.dataset.state = 'over'; }
      if (OPT.bot && OPT.loop && overT > 2.5) startPlay();
    }
  }

  let last = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : STEP;
    last = now;
    acc += dt * OPT.speed;
    let n = 0;
    while (acc >= STEP && n < 60 * OPT.speed) { step(); acc -= STEP; n++; }
    if (n >= 60 * OPT.speed) acc = 0;
    draw();
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = def.bg || '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sx = shakeAmt ? (Math.random() - 0.5) * shakeAmt : 0, sy = shakeAmt ? (Math.random() - 0.5) * shakeAmt : 0;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + sx * sc), dpr * (oy + sy * sc));
    def.draw(ctx, g, view);
    drawFx(ctx);
  }

  // ---------- 界面 ----------
  const ICON = {
    back: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    on: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    off: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function buildUI() {
    const root = el('div', 'k-ui');
    const home = el('a', 'k-btn k-home', ICON.back + '<span>More games</span>'); home.href = '../';
    const mute = el('button', 'k-btn k-mute'); mute.type = 'button'; mute.setAttribute('aria-label', 'Sound');
    const setMuteIcon = () => { mute.innerHTML = sound.muted ? ICON.off : ICON.on; };
    setMuteIcon();
    mute.addEventListener('click', () => { sound.unlock(); sound.setMuted(!sound.muted); setMuteIcon(); });

    const title = el('div', 'k-title');
    title.append(el('h1', '', def.title), el('p', 'k-verb', def.verb));
    // "点一下开始"放在游戏区里 def.ctaY 那一高度（逻辑坐标，默认 300），由游戏挑一处不挡主角的空当
    const ctaWrap = el('div', 'k-ctawrap'), cta = el('div', 'k-cta', coarse ? 'Tap to start' : 'Click or press Space');
    ctaWrap.append(cta);
    const bestLine = el('div', 'k-bestline', '');
    title.append(ctaWrap, bestLine);

    const over = el('div', 'k-over');
    const overTitle = el('div', 'k-overtitle'), score = el('div', 'k-score'), bestEl = el('div', 'k-best'), overLine = el('div', 'k-overline');
    const again = el('div', 'k-cta', coarse ? 'Tap to try again' : 'Click or Space to try again');
    const row = el('div', 'k-row');
    const share = el('button', 'k-btn k-pill', 'Share'); share.type = 'button';
    share.addEventListener('click', () => doShare(share));
    const more = el('a', 'k-btn k-pill', 'More games'); more.href = '../';
    row.append(share, more);
    over.append(overTitle, score, bestEl, overLine, again, row);

    root.append(home, mute, title, over);
    document.body.append(root);
    ui = { root, title, over, overTitle, score, best: bestEl, overLine, bestLine, ctaWrap };
    placeCta();
    const b = best(); bestLine.textContent = [def.no ? 'No.' + def.no : '', b ? 'Best ' + b : ''].filter(Boolean).join(' · ');
  }
  async function doShare(btn) {
    const url = location.origin + location.pathname;
    const text = `I scored ${g.score} in ${def.title}. Can you beat it?`;
    try {
      if (navigator.share) { await navigator.share({ title: def.title, text, url }); return; }
      await navigator.clipboard.writeText(text + ' ' + url);
      btn.textContent = 'Link copied'; setTimeout(() => { btn.textContent = 'Share'; }, 1600);
    } catch (_) { }
  }
  const isUI = t => !!(t && t.closest && t.closest('.k-btn'));
  function tapToGo() {
    if (state === 'title') startPlay();
    else if (state === 'over' && overT > 1.0) startPlay();
  }

  function listen() {
    window.addEventListener('pointerdown', e => {
      if (isUI(e.target)) return;
      e.preventDefault();
      sound.unlock();
      toLogical(e);
      ptrs.add(e.pointerId); syncDown();
      tapToGo();
    }, { passive: false });
    window.addEventListener('pointermove', e => { if (!isUI(e.target)) toLogical(e); });
    const up = e => { ptrs.delete(e.pointerId); syncDown(); sound.unlock(); };   // iOS 有时要到抬手才允许出声
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyM') { ui.root.querySelector('.k-mute').click(); return; }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault(); axisKeys.add(e.code);
        input.axis = (axisKeys.has('ArrowRight') || axisKeys.has('KeyD') ? 1 : 0) - (axisKeys.has('ArrowLeft') || axisKeys.has('KeyA') ? 1 : 0);
        return;
      }
      if (!ACTION.has(e.code)) return;
      e.preventDefault();
      if (e.repeat) return;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      sound.unlock();
      keys.add(e.code); syncDown();
      tapToGo();
    });
    window.addEventListener('keyup', e => {
      if (axisKeys.delete(e.code)) input.axis = (axisKeys.has('ArrowRight') || axisKeys.has('KeyD') ? 1 : 0) - (axisKeys.has('ArrowLeft') || axisKeys.has('KeyA') ? 1 : 0);
      if (keys.delete(e.code)) syncDown();
    });
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAll(); last = 0; } });
    // 挡住 iOS 的长按放大镜、双击缩放（按钮除外）
    window.addEventListener('touchstart', e => { if (!isUI(e.target)) e.preventDefault(); }, { passive: false });
    window.addEventListener('touchend', () => sound.unlock(), { passive: true });
    window.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
    window.addEventListener('resize', resize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  }

  window.Kit = {
    W, H, FONT, input, sound, store, rand, rr, pick, burst, pop, shake, opt: OPT, coarse,
    get state() { return state; },
    game(d) {
      def = d;
      canvas = document.createElement('canvas'); canvas.className = 'k-canvas';
      document.body.prepend(canvas);
      ctx = canvas.getContext('2d');
      document.body.dataset.state = 'title';
      if (OPT.shot) document.body.classList.add('k-shot');
      resize(); buildUI(); listen();
      newRun(true);
      if (OPT.bot) startPlay();
      requestAnimationFrame(frame);
      window.__kit = { get state() { return state; }, get g() { return g; }, start: startPlay };
    },
  };
})();
