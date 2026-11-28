/* 环球躲烟 · 自动驾驶
 * 四种水平：0 高手（看得远、换道果断、点得准），1 普通玩家（反应慢、憋气晚、很少滋），2 只会憋气的新手（不换道、不滋水），
 * 3 像真人（2026-11-16）：看到烟晚 0.27 秒才反应，被追时爱冲刺，松手的时机每口气都不一样，有时憋到见底；换道时偶尔走神。
 *   前三种都读得到烟的精确浓度、从不把气用光，量不出「憋气」本身有多危险。这一种用来估计真人大概死在哪，数值只是猜的。
 * 两个地方用：主页背后那段自己在跑的实机演示（高手），和 tools/bot.js 的自动试玩统计。只用 HYB 上公开的函数。
 * 它能读到烟的精确浓度，比真人强。
 */
(function (root) {
  function laneCost(H, g, lane, look, seekSmoke) {
    const p = g.p; let cost = 0;
    for (const b of H.blockers(g, lane)) {
      if (b.x1 < p.x - 4 || b.x0 > p.x + look) continue;
      const d = Math.max(0, b.x0 - p.x);
      cost += b.t === 'prop' ? 900 - d * 2 : (b.o.lit === false ? 0 : 500 - d * 1.5);
    }
    // 憋气版：气满（七成以上）时往烟里钻（烟越浓越想去，憋着能把大烟雾吹回去）；气不够才躲
    // 烟里冲刺（dash）：烟就是加速，会玩的人（高手、像真人）气够时也往烟里钻；普通玩家还是躲烟
    const seek = (g.breathy || (g.dash && seekSmoke)) && p.gasp <= 0 && p.breath > g.k.breath * .7 ? -.9 : 1.4;
    for (let dx = 20; dx <= look; dx += 30) { const d = H.density(g, p.x + dx, lane, H.HEAD); cost += (g.breathy ? Math.min(1.2, d) : d) * (look - dx + 40) * seek; }
    for (const w of g.warns) if (w.lane === lane) cost += 1500;
    // 连冲只算贴身冲过去的（docs/24）：气够的时候，靠到烟民旁边那条道去
    if (g.dive && p.breath > 2) for (const s of g.smokers) if (s.lit && s.awake && s.state === 'smoke' && s.kind !== 'boss' && s.x > p.x + 30 && s.x < p.x + look && Math.abs(Math.abs(s.z - lane) - 1) < .4) cost -= 160;
    for (const q of g.rings) if (Math.abs(q.z - lane) < .5 && q.x > p.x - 10 && q.x < p.x + look) cost += 500;
    for (const s of g.smokers) if (s.kind === 'boss' && (s.phase === 'charge' || s.phase === 'blow') && s.lanes && s.lanes.includes(lane)) cost += 2500;
    for (const s of g.smokers) if (s.kind === 'scooter' && s.lit && Math.abs(s.z - lane) < .5 && s.x > p.x - 10) cost += 1500;
    for (const k of g.coins) if (!k.got && k.z === lane && k.x > p.x && k.x < p.x + look) cost -= k.kind === 'coin' ? 6 : 40;
    for (const b of g.bubbles) if (!b.got && Math.abs(b.z - lane) < .5 && b.x > p.x && b.x < p.x + look) cost -= 30;
    if (lane === 0) for (const f of g.refills) if (g.water < 3 && f.x > p.x && f.x - p.x < 260) cost -= 200;
    return cost + Math.abs(lane - p.lane) * 8;
  }
  // 前面（从 x0 起 200 以内）下一段连着的烟有多长：沿这条道每 15 量一次，连着 45 没烟才算出来了。浓烟段才用得上
  function stretch(H, g, lane, x0) {
    let start = null, clean = 0;
    for (let x = x0; x < x0 + 1100; x += 15) {
      const d = H.density(g, x, lane, H.HEAD);
      if (d >= .07) { if (start == null) start = x; clean = 0; }
      else if (start == null) { if (x - x0 > 200) return { at: Infinity, len: 0 }; }
      else if ((clean += 15) >= 45) return { at: start - g.p.x, len: x - 45 - start };
    }
    return start == null ? { at: Infinity, len: 0 } : { at: start - g.p.x, len: x0 + 1100 - start };
  }
  // 像真人那个机器人自己的随机数（不动游戏的 g.rng，免得同一个种子生成的街不一样）
  // 每局从这一局的种子起步（2026-11-16：原来每局都从 12345 起，第一口气每局都「忘了松手」、第 10 秒气用光，四十局一个样）
  const brand = g => { g._bs = ((g._bs || (((g.seed || 1) * 7919 + 12345) % 2147483647) || 1) * 1103515245 + 12345) % 2147483648; return g._bs / 2147483648; };
  function human(H, g) {
    const p = g.p, inp = { lane: 0, hold: false, shot: null }, D = H.density;
    g._bt = (g._bt || 0) + 1;
    // 看到的是 8 帧（0.27 秒）以前的烟
    const hist = g._hh || (g._hh = []);
    hist.push([D(g, p.x, p.z, H.HEAD), D(g, p.x + 60, p.z, H.HEAD)]); if (hist.length > 9) hist.shift();
    const [here, ahead] = hist[0], gap = g.smog.gap;
    if (g._bt % 9 === 0 && Math.abs(p.z - p.lane) < .05 && brand(g) > .2) {
      const c = [0, 1, 2].map(l => laneCost(H, g, l, 130, true));
      let best = p.lane;
      for (const l of [0, 1, 2]) if (c[l] < c[best] - 30) best = l;
      if (best !== p.lane) { const step = Math.sign(best - p.lane); if (H.laneFree(g, p.lane + step, p.x - 14, p.x + 16)) inp.lane = step; }
    }
    if (!p.holding) g._rel = null;
    const smoky = here > .08 || ahead > .12;
    if (p.gasp > 0 || p.stun > 0) inp.hold = false;
    // 真人把「按住就跑得快」当主要操作：气回满了就再按住冲一段（smog 醒着的时候）
    else if (!p.holding) inp.hold = (smoky && p.breath > .6) || (!g.breathy && g.smog.awake && p.breath > g.k.breath - (gap < 150 ? 2 : .3));      // 憋气版憋着不加速，没烟不憋
    else {
      // 这一口打算憋到气剩多少再松：每口气不一样，一成半的时候忘了看，憋到见底
      if (g._rel == null) g._rel = brand(g) < .15 ? -1 : .2 + brand(g) * 1;
      inp.hold = smoky ? p.breath > g._rel : !g.breathy && p.breath > g._rel && g.smog.awake;
    }
    if (g.target && g._bt % 6 === 0) { const t = g.target, dx = t.x - p.x; if (Math.abs(t.z - p.lane) < .5 && dx < 160 && dx > 30 && g.water >= 1 && brand(g) < .25) inp.shot = { s: t, bull: brand(g) < .3 }; }
    if (g.locked && g.boss) {
      const s = g.boss.s;
      if ((s.phase === 'wave' || s.phase === 'lighter') && s.pt < s.pt0 - .8 && g._bt % 6 === 0) inp.shot = brand(g) < .4 ? { boss: s, part: 'body', x: s.x, h: 40 } : { boss: s, part: s.phase === 'wave' ? 'ember' : 'flame', x: s.x - 20, h: 60 };
      else { const q = g.rings.find(r => r.life > 0 && r.age > .7); if (q && g._bt % 6 === 0 && brand(g) > .4) inp.shot = { ring: q }; }
    }
    return inp;
  }
  // kind：0 高手，1 普通玩家，2 只会憋气的新手，3 像真人
  function bot(H, g, kind) {
    kind = +kind || 0;
    if (kind === 3) return human(H, g);
    const p = g.p, inp = { lane: 0, hold: false, shot: null };
    g._bt = (g._bt || 0) + 1;
    const think = kind ? g._bt % 9 === 0 : g._bt % 3 === 0;
    if (kind < 2 && think && Math.abs(p.z - p.lane) < .05) {
      const look = kind ? 130 : 190;
      const c = [0, 1, 2].map(l => laneCost(H, g, l, look, kind === 0));
      let best = p.lane;
      for (const l of [0, 1, 2]) if (c[l] < c[best] - 30) best = l;
      if (best !== p.lane) {
        const step = Math.sign(best - p.lane), mid = p.lane + step;
        if (H.laneFree(g, mid, p.x - 14, p.x + 16)) inp.lane = step;
      }
    }
    const here = H.density(g, p.x, p.z, H.HEAD), ahead = H.density(g, p.x + 34, p.z, H.HEAD), gap = g.smog.gap;
    // 戴着口罩：薄烟伤不到人，知道这件装备的玩家在薄烟里就不憋了
    const thin = g.k.dmin > H.CFG.DMIN ? g.k.dmin : 0;
    // 浓烟段（潜水规则）：每隔几帧量一下前面那段烟有多长、要憋几秒（按冲刺的速度算，多留 0.4 秒）
    if (g.hazes && g.hazes.length && g._bt % 4 === 0) {
      const S = stretch(H, g, p.lane, p.x + 10);
      g._need = S.len > 160 ? { at: S.at, t: S.len / (g.speed * (g.breathy ? 1 : 1.45)) + .4 } : null;
    }
    const need = g._need;
    if (kind === 0) {
      // 高手：进烟前一步憋住；大烟雾逼近时在干净地方也冲一段，但留一半气
      inp.hold = p.gasp <= 0 && ((here > Math.max(.06, thin) || ahead > Math.max(.12, thin + .05)) && p.breath > .3 || !g.breathy && (p.holding ? p.breath > 1.6 : p.breath > 3.6) && gap < 200 && g.smog.awake);
      // 前面是一长段浓烟：没进去之前不为了大烟雾空冲，留着气；在 AIR 格栅上气不够过下一段就松手换气
      if (need && here < .05) {
        if (need.at > 40 && need.at < 420 && !(ahead > .12)) inp.hold = !g.breathy && p.holding && p.breath > need.t + .3 && gap < 120;
        if (p.holding && need.at < 60 && p.breath < need.t) inp.hold = false;
      }
    } else {
      // 普通玩家和新手：闻到了才憋，气快没了才松
      inp.hold = p.gasp <= 0 && (p.holding ? (here > Math.max(.05, thin) || ahead > Math.max(.1, thin)) && p.breath > .2 : here > Math.max(.16, thin) && p.breath > 1);
      // 普通玩家看到大烟雾进了画面才想起来冲一段
      // 潜水规则下大烟雾进了画面再撞就被追上（docs/24），普通玩家看着顶栏，它靠近（170 以内）就冲一段，不等它贴到身后
      if (kind === 1 && !g.breathy && p.gasp <= 0 && g.smog.awake && gap < (g.dive ? 170 : 120) && (p.holding ? p.breath > .8 : p.breath > 4)) inp.hold = true;
      // 普通玩家走到 AIR 格栅上、气剩不到一半，会松手喘一口（不会算下一段要多少）
      if (kind === 1 && need && here < .05 && p.breath < 2.4 && g.vents.some(v => v.air && Math.abs(v.x - p.x) < 50 && Math.abs(v.z - p.z) < .5)) inp.hold = false;
    }
    if (kind < 2 && g.target) {
      const t = g.target, dx = t.x - p.x, inLane = Math.abs(t.z - p.lane) < .5;
      if (kind === 0) { if (inLane && dx < 250 && dx > 50 && (g.water >= 1 || g.rng() < .5)) inp.shot = { s: t, bull: g.rng() < .55 }; }
      else if (inLane && dx < 140 && dx > 20 && g.water >= 1 && g.rng() < .05) inp.shot = true;
    }
    // 雪茄老板：高手看到亮点很快就点，普通玩家慢半拍、还会点歪；新手不会点
    if (g.locked && g.boss && kind < 2) {
      const s = g.boss.s, slow = kind ? .9 : .45, miss = kind ? .5 : .1;
      if ((s.phase === 'wave' || s.phase === 'lighter') && s.pt < s.pt0 - slow && g._bt % 6 === 0) inp.shot = g.rng() < miss ? { boss: s, part: 'body', x: s.x, h: 40 } : { boss: s, part: s.phase === 'wave' ? 'ember' : 'flame', x: s.x - 20, h: 60 };
      else { const q = g.rings.find(r => r.life > 0 && r.age > slow * .8); if (q && g._bt % 6 === 0 && g.rng() > miss) inp.shot = { ring: q }; }
    }
    return inp;
  }
  root.HYB_BOT = bot;
  if (typeof module !== 'undefined') module.exports = bot;
})(typeof window !== 'undefined' ? window : globalThis);
