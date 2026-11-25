/* 环球躲烟 · 声音：全部现场合成，没有音频文件。
 * 配乐：芯片音乐，曲子的数据和合成都在这个文件里（见下面 SONG）。
 *       也留着放音频文件的通道：把 music-title、music-run、music-boss、sting-caught、sting-cleared 放进 output/声音/，
 *       tools/build_assets.py 会转好放进 assets/audio/，有文件的那一首就改放文件。现在一个文件都没有。
 * 音效：全部现场合成。带音高的音效都在 C 大调五声音阶上，和配乐同调。
 * 三条通道：
 *   world 街上的声音，憋气时会被捂住；
 *   self  主角自己的声音和界面音，憋气时不变；
 *   mus   配乐，憋气时也会被捂住，暂停时整条静音。
 * 设计思路见 docs/08-声音设计.md。
 */
(function () {
  'use strict';
  const store = HYB.store;
  let ax = null, lp = null, world = null, self = null, mus = null, duck = null, synth = null, nb = null;
  let timer = null, step = 0, next = 0, fast = false;
  let sfxOn = store.get('hyb-mute') !== '1', musicOn = store.get('hyb-music') !== '0';
  const buf = {}, tried = {};      // 解码好的音频文件；哪些已经试着加载过
  let want = null, cur = null, ducked = true;      // 应该放哪首；正在放的 { name, src, gain }；配乐是不是被暂停着
  let growlG = null, coinAt = -9, coinStep = 0;
  const lastAt = {};

  /* 配乐：现场合成的芯片音乐（方波旋律、三角波低音、噪声做的鼓），没有音频文件。
   * 时间按十六分音符一格走，32 格是一「段」（两小节，四个和弦各占 8 格）。
   *
   * 跑的那一首：开头两段就是最早那个只有两小节的循环，旋律和低音一个音没改。后面在它上面接了变奏、
   * 一段换了和弦的对比段、一段只剩低音和分解和弦的歇口气的段落，然后带着和声回来，一共 16 段，一分钟出头才重复一次。
   * 主页那一首是同一个旋律高三度、用正弦波吹的版本，加长到 8 段；老板战是 D 小调的那两小节加长到 8 段。
   *
   * 旋律的写法：一段 16 格，一格是一个八分音符。数字是 MIDI 音高，0 是休止，'-' 是把前一个音拖过来，
   * [a, b] 是这一格里连着两个十六分音符。改旋律以后跑一下 node game/tools/check_music.js，它会核对每个音在不在和弦里。
   */
  // 和弦：b 是低音在这个和弦里弹的四个音（第 0、2、4、6 格），a 是分解和弦用的三个音。带 > 的是最后一个音往下一个和弦靠过去的版本
  const CHORD = {
    C: { b: [48, 48, 55, 48], a: [67, 72, 76] }, Am: { b: [45, 45, 52, 45], a: [69, 72, 76] }, F: { b: [41, 41, 48, 41], a: [69, 72, 77] },
    G: { b: [43, 43, 50, 43], a: [67, 71, 74] }, 'G>': { b: [43, 43, 50, 47], a: [67, 71, 74] }, Em: { b: [40, 40, 47, 40], a: [67, 71, 76] },
    Dm: { b: [50, 50, 57, 50], a: [65, 69, 74] }, Bb: { b: [46, 46, 53, 46], a: [65, 70, 74] }, Gm: { b: [43, 43, 50, 43], a: [67, 70, 74] },
    A: { b: [45, 45, 52, 45], a: [64, 69, 73] }, 'A>': { b: [45, 45, 52, 49], a: [64, 69, 73] }
  };
  const _ = '-', P1 = ['C', 'Am', 'F', 'G>'], P2 = ['F', 'G', 'Em', 'Am'], P3 = ['F', 'G', 'C', 'G>'], P4 = ['Am', 'F', 'C', 'G>'];
  const H = [72, 76, 79, 76, 72, 76, 81, 79, 69, 72, 77, 72, 71, 74, 79, 0];             // 原来的旋律
  const H2 = [72, 76, 79, 76, 72, 76, 81, 79, 69, 72, 77, 72, 71, 74, 79, 83];           // 同上，结尾多一个音往上带
  const V1 = [72, 76, 79, 84, 81, 76, 72, 76, 77, 81, 84, 81, 79, 83, 86, [83, 79]];     // 变奏：同样的和弦，分解和弦爬得更高
  const V2 = [76, 79, 84, 79, 76, 81, 84, 81, 81, 84, 81, 77, 79, 74, 71, 74];
  const B1 = [81, _, _, 84, 83, _, _, 86, 79, _, 76, 79, 81, _, 84, 81];                 // 对比段（F G Em Am）：音拉长，和前面一格一个音的跳法不一样
  const B2 = [81, _, _, 84, 86, _, 83, 79, 84, _, _, 79, 83, 79, 74, 71];                // 对比段后半（F G C G）：最后一串往下走，把原来的旋律接回来
  const K = [76, _, 72, _, 77, _, 72, _, 79, _, 76, _, 74, _, 79, 83];                   // 歇口气的那一段（Am F C G）上面很疏的几个音
  const T = [76, 79, 84, 79, 76, 81, 0, 79, 77, 81, 84, 81, 79, 83, 86, 0];              // 主页的旋律：原来的旋律高三度。两条叠在一起就是和声
  const T2 = [76, 79, 84, 79, 76, 81, 0, 79, 77, 81, 84, 81, 79, 83, 86, 83];
  const HB1 = [77, _, _, 81, 79, _, _, 83, 76, _, 71, 76, 76, _, 81, 76], HB2 = [77, _, _, 81, 83, _, 79, 74, 79, _, _, 76, 79, 74, 71, 67];      // 对比段的和声，在旋律下面三度、六度
  // 老板战：D 小调
  const Q1 = ['Dm', 'Bb', 'Gm', 'A>'], Q2 = ['Gm', 'Dm', 'Bb', 'A>'], Q3 = ['Gm', 'Dm', 'A', 'A>'];
  const X = [65, 69, 74, 0, 65, 70, 74, 0, 62, 67, 70, 0, 61, 64, 69, 73];               // 原来的旋律
  const X2 = [65, 69, 74, 77, 65, 70, 74, 77, 67, 70, 74, 79, 76, 73, 69, 64];
  const Y1 = [74, _, 70, 67, 69, _, 65, 62, 70, _, 74, 77, 76, _, 73, 69], Y2 = [79, _, 74, 70, 77, _, 74, 69, 73, 76, 79, 76, 73, 69, 64, 61];
  const up = line => line.map(e => typeof e === 'number' && e ? e + 12 : e);
  // 鼓：一段 32 格里哪几格敲。hat 是每隔几格一下踩镲
  const DRUMS = {
    full: { kick: [0, 8, 14, 16, 24, 30], snare: [4, 12, 20, 28], hat: 2 }, half: { kick: [0, 8, 16, 24], snare: [12, 28], hat: 2 },
    light: { kick: [0, 16], snare: [], hat: 2 }, soft: { kick: [], snare: [], hat: 4 }, march: { kick: [0, 6, 8, 16, 22, 24], snare: [4, 12, 20, 28], hat: 2 },
    drive: { kick: [0, 4, 8, 12, 16, 20, 24, 28], snare: [4, 12, 20, 28], hat: 2 }      // 主页副歌：底鼓每拍一下，最带劲
  };
  /* 每一段：ch 四个和弦，lead 旋律，harm 和声（小声），arp 十六分音符的分解和弦（很小声），echo 旋律后面跟一下回声，
   * drums 这一段换一套鼓，fill 最后半小节军鼓滚奏，crash 开头一下镲。 */
  const SONG = {
    run: { stepT: .119, type: 'square', dur: .12, lpf: 0, drums: 'full', loops: [
      { ch: P1, lead: H }, { ch: P1, lead: H2, fill: 1 },
      { ch: P1, lead: V1, crash: 1 }, { ch: P1, lead: V2, fill: 1 },
      { ch: P2, lead: B1, echo: 1, crash: 1 }, { ch: P3, lead: B2, echo: 1, fill: 1 },
      { ch: P1, lead: H, arp: 1, crash: 1 }, { ch: P1, lead: H2, arp: 1, fill: 1 },
      { ch: P4, arp: 1, drums: 'light', crash: 1 }, { ch: P4, lead: K, arp: 1, echo: 1, drums: 'half', fill: 1 },
      { ch: P2, lead: B1, harm: HB1, echo: 1, crash: 1 }, { ch: P3, lead: B2, harm: HB2, echo: 1, fill: 1 },
      { ch: P1, lead: H, harm: T, arp: 1, crash: 1 }, { ch: P1, lead: H2, harm: T2, arp: 1, fill: 1 },
      { ch: P1, lead: V1, crash: 1 }, { ch: P1, lead: V2, fill: 1 }
    ] },
    /* 主页（2026-11-21 重新编，docs/33）：用户说不够动感、单调。旋律一个音没改（T、T2、H 还是原来那几条），换的是编曲：
     *   原来 120 拍、正弦波吹旋律、只有很轻的踩镲、低音一个和弦弹两下，整首从头到尾一个样子。
     *   现在 134 拍；开头两段照旧轻（正弦波、底鼓两下），像引子；第三段「落下来」：脉冲波旋律加三度和声、底鼓每拍一下、
     *   低音一低一高跑八度、开头一下镲；然后变奏、对比段（低音换成嘭嚓）、歇口气的一段再起来，一共 12 段，四十多秒一轮。
     * 每一段可以单独换：bass 低音弹法、lt 旋律音色 */
    title: { stepT: .112, type: 'pulse', dur: .2, lpf: 0, drums: 'soft', sparse: true, loops: [
      { ch: P1, lead: T, lt: 'sine', drums: 'light', arp: 1 }, { ch: P1, lead: T2, lt: 'sine', drums: 'half', arp: 1, fill: 1 },
      { ch: P1, lead: T, harm: H, bass: 'octaves', drums: 'drive', crash: 1 }, { ch: P1, lead: T2, harm: H2, bass: 'octaves', drums: 'drive', fill: 1 },
      { ch: P1, lead: V1, bass: 'octaves', drums: 'full', arp: 1, crash: 1 }, { ch: P1, lead: V2, bass: 'octaves', drums: 'full', arp: 1, fill: 1 },
      { ch: P2, lead: B1, harm: HB1, echo: 1, bass: 'oompah', drums: 'half', crash: 1 }, { ch: P3, lead: B2, harm: HB2, echo: 1, bass: 'oompah', drums: 'half', fill: 1 },
      { ch: P4, arp: 1, drums: 'light' }, { ch: P4, lead: K, arp: 1, drums: 'half', fill: 1 },
      { ch: P1, lead: T, harm: H, arp: 1, bass: 'octaves', drums: 'drive', crash: 1 }, { ch: P1, lead: T2, harm: H2, arp: 1, bass: 'octaves', drums: 'drive', fill: 1 }
    ] },
    boss: { stepT: .127, type: 'sawtooth', dur: .12, lpf: 1300, drums: 'march', loops: [
      { ch: Q1, lead: X }, { ch: Q1, lead: X2, fill: 1 }, { ch: Q2, lead: Y1, crash: 1 }, { ch: Q3, lead: Y2, fill: 1 },
      { ch: Q1, lead: X, harm: up(X), crash: 1 }, { ch: Q1, lead: X2, arp: 1, fill: 1 }, { ch: Q2, lead: Y1, arp: 1, crash: 1 }, { ch: Q3, lead: Y2, harm: up(Y2), fill: 1 }
    ] }
  };
  /* 试听用的几种编曲风格。谱子（旋律、和弦、段落）是同一份，换的是：谁来吹旋律、低音怎么弹、鼓怎么打、摇不摇摆、多快。
   *   a 原版    方波旋律，低音每拍两下，摇滚鼓点。就是现在的版本
   *   b 弹跳    八分音符摇摆起来（长短长短）；低音「嘭—嚓—嘭—嚓」：正拍弹根音，反拍一下很短的和弦；旋律换成更薄更亮的脉冲波；
   *             军鼓换成敲鼓边。速度不变。像卡通片里蹦蹦跳跳地跑
   *   c 口哨    旋律换成口哨（正弦波，高八度，带一点滑音和颤音，音是吹出来的不是点出来的）；低音每拍只弹一下；
   *             鼓换成沙沙的鼓刷和沙锤；轻轻摇摆。速度不变。和「憋气、呼气」沾边。老板战那首不换，和原版一样
   *   d 冲刺    快 12%；底鼓每拍一下，反拍开镲；低音一低一高跑八度；旋律上面再很轻地叠一层高八度。像被追着跑
   * lead 是「哪一首换成什么音色、移高几个半音、音量（不写就用下面 LG 里的）」，skip 是哪一首不换。选定以后把那一种写死，其余的和切换的按钮一起删掉。 */
  const STYLE = {
    a: { name: 'Original' },
    b: { name: 'Bouncy', swing: .64, bass: 'oompah', kit: 'bounce', lead: { run: ['pulse', 0] } },
    c: { name: 'Whistle', swing: .57, bass: 'two', kit: 'brush', lead: { run: ['whistle', 12, .085], title: ['whistle', 0, .13] }, skip: { boss: 1 } },
    d: { name: 'Sprint', tempo: .88, bass: 'octaves', kit: 'four', oct: true }
  };
  let style = 'a';
  const styleFor = (S, k) => { const st = STYLE[k || style]; return st.skip && st.skip[S.name] ? STYLE.a : st; };
  // 各种旋律音色该给多大音量，听起来才差不多响。正弦波泛音少，要给得多；口哨是一直吹着的（别的音色点一下 0.02 秒就衰减掉了），
  // 同样的数字会响出十几分贝，要给得少得多。几种风格的响度在浏览器里量过（输出接一个分析器，按人耳敏感的频段加权），
  // 调到互相差不了几分贝，免得试听时哪个响就觉得哪个好
  const LG = { square: .16, pulse: .25, sine: .55, whistle: .1, sawtooth: .3 };
  // 换风格时，把整套的鼓（full、march）换成这几套；本来就很轻的段落和主页不换
  const KIT = {
    bounce: { kick: [0, 8, 16, 24], snare: [4, 12, 20, 28], sn: 'rim', hat: [2, 6, 10, 14, 18, 22, 26, 30], ht: 'hat' },
    brush: { kick: [0, 16], kg: .55, snare: [4, 12, 20, 28], sn: 'brush', hat: 'shake' },
    four: { kick: [0, 4, 8, 12, 16, 20, 24, 28], snare: [4, 12, 20, 28], sn: 'snare', hat: [2, 6, 10, 14, 18, 22, 26, 30], ht: 'ohat' }
  };
  for (const k in SONG) SONG[k].name = k;
  /* 第 step 格该响哪些音。只算不出声，配乐的播放和 tools/check_music.js 的核对用的是同一份。
   * 返回的每一项：v 是音色或者鼓的名字，m 音高，dur 多长，g 多响，late 晚几秒（回声），old 标出最早那个版本里就有的声部。 */
  function plan(S, step, st) {
    st = st || styleFor(S);
    const L = S.loops, P = L[Math.floor(step / 32) % L.length], i = step % 32, k = i & 7, c = CHORD[P.ch[i >> 3]], ev = [];
    // 低音。一个和弦占两拍。orig：每拍两下；two：每拍一下（主页那首本来就是这样）；oompah：同 two，每拍的后半拍加一下很短的和弦；
    // octaves：每拍两下，根音一低一高跑八度。最后一下如果是往下一个和弦靠过去的音，哪种弹法都保留。再高八度很轻地叠一层，小喇叭上才听得见
    const mode = P.bass || (S.sparse && (!st.bass || st.bass === 'octaves') ? 'two' : st.bass || 'orig');      // P.bass：这一段自己定低音弹法（主页的副歌）
    if (!(i & 1)) {
      const b = c.b[k >> 1], into = k === 6 && b !== c.b[0];
      const m = mode === 'orig' ? b : mode === 'octaves' ? (into ? b : c.b[0] + (k & 2 ? 12 : 0)) : k === 0 || k === 4 || into ? b : 0;
      if (m) { ev.push({ v: 'triangle', m: m - 12, dur: .2, g: .9, old: 'bass' }); ev.push({ v: 'triangle', m, dur: .2, g: .3 }); }
      if (mode === 'oompah' && (k === 2 || k === 6)) for (const n of c.a) ev.push({ v: 'square', m: n, dur: .05, g: S.sparse ? .03 : .05, lpf: 3200 });
    }
    // 旋律和和声
    const [type, shift, lg] = (st.lead && st.lead[S.name]) || [P.lt || S.type, 0], G = lg || LG[type];      // P.lt：这一段换旋律音色（主页引子用正弦波）
    for (const [line, g, old] of [[P.lead, G, 'lead'], [P.harm, G * .38, null]]) {
      if (!line) continue;
      const e = line[i >> 1], pair = Array.isArray(e), m0 = pair ? e[i & 1] : !(i & 1) && typeof e === 'number' ? e : 0;
      if (!m0) continue;
      const m = m0 + shift;
      let hold = 0; if (!pair) for (let j = (i >> 1) + 1; j < 16 && line[j] === '-'; j++) hold++;
      // 口哨把音连起来吹，别的音色是一下一下点出来的
      const dur = hold ? (1 + hold) * 2 * S.stepT * .92 : type === 'whistle' ? (pair ? 1 : 2) * S.stepT * .86 : S.dur;
      ev.push({ v: type, m, dur, g, lpf: S.lpf, old });
      if (st.oct && old) ev.push({ v: type, m: m + 12, dur, g: g * .28, lpf: S.lpf });
      if (P.echo && old) ev.push({ v: type, m, dur: S.dur, g: g * .24, lpf: S.lpf, late: 3 * S.stepT });
    }
    if (P.arp) ev.push({ v: 'square', m: c.a[[0, 1, 2, 1][i & 3]], dur: .07, g: .05, lpf: 2600 });
    // 鼓
    const base = P.drums || S.drums, K = st.kit && (base === 'full' || base === 'march') ? KIT[st.kit] : null, D = K || DRUMS[base], fill = P.fill && i > 24;
    if (D.kick.includes(i) && !fill) ev.push({ v: 'kick', g: D.kg || 1 });
    if (fill ? [26, 28, 29, 30, 31].includes(i) : D.snare.includes(i)) ev.push({ v: fill ? (K && K.sn === 'brush' ? 'brush' : 'snare') : (K ? K.sn : 'snare'), g: fill ? .55 + (i - 26) * .09 : 1 });
    if (K) { if (K.hat === 'shake') ev.push({ v: 'shake', g: i & 1 ? .05 : i % 4 === 2 ? .12 : .08 }); else if (K.hat.includes(i)) ev.push({ v: K.ht }); }
    else if (i % D.hat === D.hat / 2) ev.push({ v: 'hat' });
    if (P.crash && i === 0) ev.push({ v: 'crash' });
    return ev;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12), semi = n => Math.pow(2, n / 12);
  let ambG = null, ambF = null, ambKind = null, ambT = null, rainG = null, rainV = 0;
  // 带音高的音效都落在 C 大调五声音阶上（C D E G A）：配乐是 C 大调，老板战是 D 小调，这五个音在两个调里都不出格
  const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

  /* 叫醒声音引擎：每次触摸、每次回到前台都会调。
   * 切到后台、来电话之后，iPhone 上的状态是 interrupted 而不是 suspended：只要不是 running 就 resume。
   * 还有一种情况：状态写着 running，但引擎其实已经被系统停了，时钟不走、也不出声，resume 对它没用。
   * 所以叫醒以后过一小会儿看一眼时钟：没走，就把整个引擎扔掉重建一个。
   * check 为 false 时只叫醒、不检查（引擎刚建好时用，免得还没等到第一次触摸就反复重建）。
   * 这个「过一会儿看一眼」的定时器不能在手指按下的那一刻装：iPhone 看到按下时装了 400 毫秒以内的定时器，
   * 会把这次点击扣住、等定时器跑完才发出去。结果是每个按钮、每句对话都慢 0.4 秒，点快了还会被吞掉。
   * 所以等到下一帧再装，就不算在这次触摸里了。 */
  let watch = null, watchF = 0, rebuilt = 0, rebuiltAt = -1e9;
  function wake(check) {
    if (!ax) return;
    if (ax.state !== 'running') { try { const r = ax.resume(); if (r && r.catch) r.catch(() => { }); } catch (_) { } }
    if (check === false) return;
    const a = ax, t0 = ax.currentTime;
    clearTimeout(watch); cancelAnimationFrame(watchF);
    watchF = requestAnimationFrame(() => {
      watch = setTimeout(() => {
        if (ax !== a || document.hidden) return;
        const dead = a.state !== 'running' || a.currentTime === t0;
        if (dead && performance.now() - rebuiltAt > 2500) rebuild();      // 最多两秒半重建一次
      }, 400);
    });
  }
  // 引擎死了：关掉旧的，所有节点作废，重新建一套，把该放的曲子和环境声接回去。解码好的配乐文件可以接着用
  function rebuild() {
    const old = ax, kind = ambKind;
    clearInterval(timer); timer = null; clearInterval(ambT); ambT = null;
    ax = lp = world = self = mus = duck = synth = nb = growlG = ambG = ambF = rainG = null; ambKind = null; rainV = 0; cur = null;
    try { old.close(); } catch (_) { }
    rebuilt++; rebuiltAt = performance.now();
    init(); if (!ax) return;
    duck.gain.value = ducked ? 0 : 1;
    apply(true);
    if (kind) HYB.Snd.amb(kind);
  }
  // 离开游戏（回桌面、切到别的 App）：把引擎停住。回来时由 wake 叫醒
  function sleep() { clearTimeout(watch); cancelAnimationFrame(watchF); if (ax && ax.state === 'running') { try { const r = ax.suspend(); if (r && r.catch) r.catch(() => { }); } catch (_) { } } }
  function init() {
    if (ax) { wake(false); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      /* 声明成「环境音」，和一般的游戏一样：
       *   不会被系统当成正在播放的音乐，灵动岛、锁屏、控制中心里不出现播放条；
       *   不打断用户正在听的歌；
       *   跟着手机的静音开关走，手机静音时游戏不出声。
       * 之前用过「播放」类（和音乐 App 同一类），好处是静音模式下也出声，代价就是上面这三条全反过来。 */
      if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    } catch (_) { }
    try {
      ax = new AC();
      lp = ax.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = .7; lp.connect(ax.destination);
      world = ax.createGain(); world.gain.value = sfxOn ? .9 : 0; world.connect(lp);
      self = ax.createGain(); self.gain.value = sfxOn ? .9 : 0; self.connect(ax.destination);
      mus = ax.createGain(); mus.gain.value = musicOn ? 1 : 0; mus.connect(lp);
      duck = ax.createGain(); duck.gain.value = 0; duck.connect(mus);
      synth = ax.createGain(); synth.gain.value = .12; synth.connect(duck);
      nb = ax.createBuffer(1, ax.sampleRate, ax.sampleRate);
      const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      wake(false);
    } catch (e) { ax = null; }
  }

  /* ---------- 合成用的两块积木：一段噪声、一个音 ---------- */
  function noise({ t = 0, dur = .2, type = 'bandpass', f = 1000, f2 = null, q = 1, g = .3, out = null }) {
    if (!ax) return; const s = ax.createBufferSource(), fl = ax.createBiquadFilter(), a = ax.createGain(), t0 = ax.currentTime + t;
    s.buffer = nb; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur); fl.Q.value = q;
    a.gain.setValueAtTime(.0001, t0); a.gain.exponentialRampToValueAtTime(g, t0 + Math.min(.02, dur * .3)); a.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(fl); fl.connect(a); a.connect(out || world); s.start(t0, Math.random() * .5); s.stop(t0 + dur + .02);
  }
  // lpf：过一道低通，把锯齿波、方波磨圆，像铜管
  function tone({ t = 0, at = null, dur = .15, f = 440, f2 = null, type = 'sine', g = .2, out = null, lpf = 0 }) {
    if (!ax) return; const o = ax.createOscillator(), a = ax.createGain(), t0 = at != null ? at : ax.currentTime + t;
    if (type === 'pulse') o.setPeriodicWave(pulse()); else o.type = type;
    o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    a.gain.setValueAtTime(.0001, t0); a.gain.exponentialRampToValueAtTime(g, t0 + .01); a.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    if (lpf) { const fl = ax.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lpf; o.connect(fl); fl.connect(a); } else o.connect(a);
    a.connect(out || world); o.start(t0); o.stop(t0 + dur + .02);
  }
  // 四分之一占空比的脉冲波：比方波薄、亮，老游戏机上吹旋律常用。每个声音引擎建一次
  function pulse() {
    if (!ax._pulse) { const N = 24, re = new Float32Array(N), im = new Float32Array(N); for (let n = 1; n < N; n++) re[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * .25); ax._pulse = ax.createPeriodicWave(re, im); }
    return ax._pulse;
  }
  // 口哨：正弦波。起音从略低的地方滑上来，音量是慢慢起、吹满、收掉（不是点一下就没了），长一点的音后半段带颤音，再垫一丝气声
  function whistle(at, m, dur, g) {
    const f = hz(m), o = ax.createOscillator(), a = ax.createGain(), end = at + Math.max(.09, dur);
    g *= Math.max(.6, 1 - Math.max(0, m - 84) * .02);      // 越高的音耳朵越敏感，给得轻一点，免得刺耳
    o.frequency.setValueAtTime(f * .962, at); o.frequency.exponentialRampToValueAtTime(f, at + .03);
    a.gain.setValueAtTime(.0001, at); a.gain.linearRampToValueAtTime(g, at + .025); a.gain.setValueAtTime(g, Math.max(at + .03, end - .05)); a.gain.linearRampToValueAtTime(.0001, end);
    if (dur > .28) { const l = ax.createOscillator(), lg = ax.createGain(); l.frequency.value = 5.6; lg.gain.setValueAtTime(0, at + .1); lg.gain.linearRampToValueAtTime(f * .007, at + .26); l.connect(lg); lg.connect(o.frequency); l.start(at); l.stop(end + .02); }
    o.connect(a); a.connect(synth); o.start(at); o.stop(end + .02);
    noise({ t: at - ax.currentTime, dur: .1, type: 'bandpass', f: f * 1.5, q: 6, g: g * .1, out: synth });
  }
  // 一声铃：基音加两个泛音，敲一下就衰减
  function bell(f, g, dur, t, out) {
    tone({ t, dur, f, g, out }); tone({ t, dur: dur * .6, f: f * 2.01, g: g * .35, out }); tone({ t, dur: dur * .35, f: f * 3.02, g: g * .18, out });
  }
  // 同一个音效短时间内连着响：太近的直接不响，免得叠成一片
  function rep(name, gap) { if (!ax) return false; const t = ax.currentTime; if (lastAt[name] != null && t - lastAt[name] < gap) return false; lastAt[name] = t; return true; }

  /* ---------- 配乐 ---------- */
  function play(e, at) {
    const t = at - ax.currentTime, g = e.g == null ? 1 : e.g;
    if (e.v === 'kick') tone({ at, dur: .12, f: 120, f2: 45, g: 1.1 * g, out: synth });
    else if (e.v === 'snare') { noise({ t, dur: .1, type: 'bandpass', f: 1800, q: .8, g: .45 * g, out: synth }); tone({ at, dur: .05, f: 190, g: .3 * g, out: synth }); }
    else if (e.v === 'rim') { noise({ t, dur: .04, type: 'bandpass', f: 2600, q: 2.5, g: .34, out: synth }); tone({ at, dur: .03, f: 420, g: .2, out: synth }); }      // 敲鼓边：短、脆
    else if (e.v === 'brush') noise({ t, dur: .14, type: 'bandpass', f: 3200, q: .6, g: .2 * g, out: synth });      // 鼓刷：沙的一下
    else if (e.v === 'hat') noise({ t, dur: .03, type: 'highpass', f: 7000, g: .16, out: synth });
    else if (e.v === 'ohat') noise({ t, dur: .07, type: 'highpass', f: 6500, g: .17, out: synth });      // 开镲：比踩镲长一点
    else if (e.v === 'shake') noise({ t, dur: .025, type: 'highpass', f: 8000, g, out: synth });      // 沙锤
    else if (e.v === 'crash') noise({ t, dur: .5, type: 'highpass', f: 6000, g: .2, out: synth });
    else if (e.v === 'whistle') whistle(at, e.m, e.dur, e.g);
    else tone({ at, dur: e.dur, f: hz(e.m), type: e.v, g: e.g, out: synth, lpf: e.lpf });
  }
  function sched() {
    if (!ax || !cur) return;
    // 速度：风格可以整体快一点或慢一点（主页那首不跟着变）；大烟雾贴近时，跑的那一首再放快一些（只变快，不变调）
    const S = SONG[cur.name] || SONG.run, st = styleFor(S), stepT = S.stepT * (S.sparse ? 1 : st.tempo || 1) * (fast && cur.name === 'run' ? .83 : 1), sw = st.swing;
    if (next < ax.currentTime) next = ax.currentTime + .05;
    while (next < ax.currentTime + .25) {
      // 摇摆：一拍四格，把后半拍往后拖。sw 是后半拍落在这一拍的百分之几（不摇摆是 50）
      const q = step & 3, off = sw ? ([0, sw / 2, sw, (1 + sw) / 2][q] - q / 4) * 4 * stepT : 0;
      for (const e of plan(S, step, st)) play(e, next + off + (e.late || 0));
      next += stepT; step++;
    }
  }
  const synthRun = v => { if (v && !timer && ax) { next = 0; timer = setInterval(sched, 80); } if (!v && timer) { clearInterval(timer); timer = null; } };
  // 换到 want 指的那首。有文件就循环放文件；没有文件时用上面合成的那一首
  function apply(force) {
    if (!ax) return;
    if (cur && cur.name === want && !force) return;
    if (cur && cur.src) { const o = cur; o.gain.gain.setTargetAtTime(0, ax.currentTime, .1); setTimeout(() => { try { o.src.stop(); } catch (_) { } }, 500); }
    cur = null; synthRun(false);
    if (!want) return;
    const key = 'music-' + want, b = buf[key], MF = HYB.MANIFEST || {}, lp = (MF.audioLoop || {})[key];
    if (b) {
      const src = ax.createBufferSource(), g = ax.createGain();
      src.buffer = b; src.loop = true;
      // 文件前后各多留了半秒，只在中间那一段里循环：接缝两边是同一段波形，不受编码在文件头尾加的空白影响
      if (lp) { src.loopStart = lp[0]; src.loopEnd = lp[1]; }
      g.gain.value = 0; g.gain.setTargetAtTime(.5, ax.currentTime, .12); src.connect(g); g.connect(duck); src.start(0, lp ? lp[0] : 0);
      cur = { name: want, src, gain: g };
    }
    // 这首有文件、只是还没解码完：先不出声等它，免得合成的曲子响两秒又换成文件，听着像放错了
    else if ((MF.audio || {})[key] && tried[key] !== 'failed') cur = { name: want, src: null, waiting: true };
    else { cur = { name: want, src: null }; step = 0; synthRun(!ducked); }
  }
  // 把清单里的音频文件取回来解码。解码完正好是该放的那首，就接着换过去
  function load() {
    init(); if (!ax) return;
    const A = (HYB.MANIFEST && HYB.MANIFEST.audio) || {};
    for (const [name, url] of Object.entries(A)) {
      if (tried[name]) continue; tried[name] = 'loading';
      fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(d => new Promise((ok, no) => ax.decodeAudioData(d, ok, no)))
        .then(b => { buf[name] = b; tried[name] = 'ok'; if (want && name === 'music-' + want) apply(true); })
        .catch(() => { tried[name] = 'failed'; if (want && name === 'music-' + want) apply(true); });      // 文件坏了：退回合成的那一首
    }
  }

  HYB.Snd = {
    init, wake: () => wake(), sleep, load, rebuild,      // rebuild 平时由 wake 自己决定要不要调，放出来是为了测试
    // 现在这首的拍子（docs/22 的 D）：每拍几秒、离下一拍还有几秒。曲子是 sched 现合成的，拍子就是它排音符用的那个钟（一拍四格）。
    // 没在放（暂停、主页之外没开始、在等文件）→ null。（beat 已经是憋气时的心跳声，这个叫 beatClock）
    beatClock() {
      if (!ax || !cur || cur.src || cur.waiting || !timer) return null;
      const S = SONG[cur.name] || SONG.run, st = styleFor(S), stepT = S.stepT * (S.sparse ? 1 : st.tempo || 1) * (fast && cur.name === 'run' ? .83 : 1), k = (4 - (step & 3)) & 3;
      return { period: stepT * 4, toNext: next + k * stepT - ax.currentTime };
    },
    get on() { return sfxOn || musicOn; },
    get musicOn() { return musicOn; }, get sfxOn() { return sfxOn; },
    // 排查用：声音引擎的状态、系统音频类别、每个音频文件加载得怎么样、现在放的是哪首
    get state() {
      const A = (HYB.MANIFEST && HYB.MANIFEST.audio) || {}, files = Object.keys(A).map(n => `${n.replace('music-', '').replace('sting-', '')}:${tried[n] || 'no'}`).join(' ') || 'no music files';
      return `${ax ? ax.state : 'not started'} t=${ax ? ax.currentTime.toFixed(1) : 0}${rebuilt ? ' rebuilt×' + rebuilt : ''} / ${navigator.audioSession ? navigator.audioSession.type : 'default'} / ${files} / now ${cur ? cur.name + (cur.src ? ' (file)' : cur.waiting ? ' (loading)' : ' (synth)') : 'none'}${sfxOn ? '' : ' / effects off'}${musicOn ? '' : ' / music off'}`;
    },
    setMusic(v) { musicOn = v; store.set('hyb-music', v ? '1' : '0'); if (mus) mus.gain.setTargetAtTime(v ? 1 : 0, ax.currentTime, .05); },
    setSfx(v) { sfxOn = v; store.set('hyb-mute', v ? '0' : '1'); if (world) { world.gain.value = v ? .9 : 0; self.gain.value = v ? .9 : 0; } },
    // 画面右上角的喇叭：有任何一样开着就全关，否则全开
    toggle() { const v = !(sfxOn || musicOn); this.setMusic(v); this.setSfx(v); return v; },
    // 放哪首：'title' 主页、'run' 跑、'boss' 老板战、null 不放
    track(name) { want = name; apply(false); },
    // 暂停、结算、看广告时配乐整条静音；回来接着原来的位置放
    music(v) { ducked = !v; if (!ax) return; duck.gain.setTargetAtTime(v ? 1 : 0, ax.currentTime, .06); if (cur && !cur.src && !cur.waiting) synthRun(v); },
    // 大烟雾贴近时把曲子放快一点
    // 大烟雾贴近时把跑的那一首放快（见 sched）。如果以后换成音频文件，文件不变速：一变速音高也跟着升
    fast(v) { fast = v; },
    // 试听：现在是哪种编曲风格、一共有哪几种、换一种（从头放）
    get style() { return style; }, styles: () => Object.keys(STYLE).map(k => [k, STYLE[k].name]),
    setStyle(k) { if (!STYLE[k] || k === style) return; style = k; step = 0; next = 0; },
    // 给 tools/check_music.js 用：某一首的第几格该响哪些音、一共多少格、一格多少秒
    plan: (name, step, k) => plan(SONG[name], step, styleFor(SONG[name], k)), songSteps: name => SONG[name].loops.length * 32, songStepT: name => SONG[name].stepT, chord: (name, step) => { const S = SONG[name], P = S.loops[Math.floor(step / 32) % S.loops.length]; return P.ch[(step % 32) >> 3]; }, chordTones: n => CHORD[n],
    // 一段短的：'caught' 被追上、'cleared' 打败老板。有文件才放，返回放了没有；没放的话调用的人自己用合成的顶
    sting(name) {
      const b = buf['sting-' + name]; if (!ax || !b || !musicOn) return false;
      const src = ax.createBufferSource(), g = ax.createGain(); src.buffer = b; g.gain.value = .7; src.connect(g); g.connect(ax.destination); src.start();
      return true;
    },
    // 憋气：街上的声音和配乐被捂住
    muffle(v) { if (lp) lp.frequency.setTargetAtTime(v ? 480 : 20000, ax.currentTime, v ? .09 : .03); },
    // 大烟雾的咕噜声：v 是 0 到 1，越近越响。一直开着一路低沉的噪声加一个低音，只调音量
    growl(v) {
      if (!ax) return;
      if (!growlG) {
        if (v <= 0) return;
        growlG = ax.createGain(); growlG.gain.value = 0; growlG.connect(self);
        const s = ax.createBufferSource(), fl = ax.createBiquadFilter(); s.buffer = nb; s.loop = true; fl.type = 'lowpass'; fl.frequency.value = 150; fl.Q.value = 4; s.connect(fl); fl.connect(growlG); s.start();
        const o = ax.createOscillator(), og = ax.createGain(), ofl = ax.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 52; ofl.type = 'lowpass'; ofl.frequency.value = 180; og.gain.value = .5; o.connect(ofl); ofl.connect(og); og.connect(growlG); o.start();
        const l = ax.createOscillator(), lg = ax.createGain(); l.frequency.value = 6.5; lg.gain.value = 9; l.connect(lg); lg.connect(o.frequency); l.start();      // 一点颤动，听着像喉咙里的声音
      }
      growlG.gain.setTargetAtTime(v * v * .5, ax.currentTime, .12);
    },

    /* ---------- 憋气这一下 ---------- */
    // 按下：吸一口气，闭嘴
    hold() { noise({ dur: .2, type: 'bandpass', f: 500, f2: 2600, q: 1.4, g: .16, out: self }); tone({ t: .19, dur: .07, f: 210, f2: 150, g: .12, out: self }); },
    // 松手，没有连冲可入账：轻轻呼一口
    exhale() { noise({ dur: .3, type: 'bandpass', f: 1700, f2: 500, q: .8, g: .12, out: self }); },
    // 松手入账：一大口呼气加一串上行的铃音，连冲越多这一串越长；三个以上再垫一个和弦
    bank(n) {
      const k = Math.min(6, 1 + (n || 1)), S = [0, 4, 7, 12, 16, 19];
      noise({ dur: .3 + .05 * k, type: 'bandpass', f: 2200, f2: 500, q: .7, g: .16, out: self });
      for (let i = 0; i < k; i++) bell(523.25 * semi(S[i]), .11, i === k - 1 ? .5 : .2, i * .055, self);
      if (n >= 3) [261.63, 329.63, 392].forEach(f => tone({ t: k * .055, dur: .55, f, type: 'triangle', g: .06, out: self }));
    },
    // 憋过头：三下急喘，进、出、进
    gasp() { [0, .24, .48].forEach((t, i) => noise({ t, dur: .2, type: 'bandpass', f: i % 2 ? 1900 : 700, f2: i % 2 ? 700 : 2100, q: 1.3, g: .26, out: self })); },
    // 心跳：咚、咚。u 越大（气越少）越重
    beat(u) {
      const g = .3 + .3 * (u || 0);
      tone({ dur: .11, f: 78, f2: 46, g, out: self }); noise({ dur: .04, type: 'lowpass', f: 140, g: g * .5, out: self });
      tone({ t: .14, dur: .1, f: 64, f2: 40, g: g * .7, out: self });
    },
    // 憋着气冲过一个烟民：一声越来越高的木琴
    chain(n) { const f = 523.25 * semi(PENT[Math.min(10, Math.max(0, (n || 1) - 1))]); tone({ dur: .14, f, g: .17, out: self }); tone({ dur: .03, f: f * 4, g: .05, out: self }); },
    cough() { if (!rep('cough', .2)) return; [0, .15].forEach((t, i) => { noise({ t, dur: .09, type: 'bandpass', f: i ? 480 : 620, q: 3, g: .3, out: self }); tone({ t, dur: .05, f: i ? 150 : 185, f2: 110, type: 'square', g: .05, out: self }); }); },
    lost() { tone({ dur: .24, f: 330, f2: 190, type: 'triangle', g: .1, out: self }); },

    /* ---------- 水 ---------- */
    shoot() { noise({ dur: .1, type: 'highpass', f: 2400, g: .12 }); tone({ dur: .08, f: 500, f2: 1300, g: .08 }); },
    // 浇灭：呲——
    hit() { if (!rep('hit', .06)) return; noise({ dur: .42, type: 'highpass', f: 6500, f2: 2400, g: .26 }); noise({ t: .01, dur: .08, type: 'bandpass', f: 900, q: 2, g: .2 }); tone({ dur: .07, f: 200, f2: 80, g: .25 }); },
    bull() { bell(1568, .13, .3, 0, self); bell(2093, .12, .45, .07, self); },
    steam() { noise({ dur: .5, type: 'highpass', f: 3200, f2: 7500, g: .15 }); },
    dry() { [0, .07].forEach(t => tone({ t, dur: .04, f: 170, type: 'square', g: .05, out: self })); },
    refill() { tone({ dur: .08, f: 300 + Math.random() * 240, f2: 640, g: .09 }); },

    /* ---------- 捡东西 ---------- */
    // 金币：两个音。连着捡，一个比一个高，捡一排就是一串上行的音阶
    coin() {
      if (!ax) return;
      const t = ax.currentTime; coinStep = t - coinAt < .45 ? Math.min(coinStep + 1, 7) : 0; coinAt = t;
      const f = 1046.5 * semi(PENT[coinStep]);
      tone({ dur: .07, f, type: 'triangle', g: .09, out: self }); tone({ t: .06, dur: .2, f: f * 1.335, type: 'triangle', g: .08, out: self }); tone({ t: .06, dur: .1, f: f * 2.67, g: .03, out: self });
    },
    // 捡到道具：一声往上扫的风，接四个上行的音
    mult(m) { noise({ dur: .25, type: 'bandpass', f: 600, f2: 3600, q: 1, g: .08, out: self }); [0, 4, 7, 12].forEach((s2, i) => tone({ t: .08 + i * .05, dur: .16, f: 783.99 * semi(s2), type: 'triangle', g: .1, out: self })); },
    mint() { [1318, 1760, 2093].forEach((f, i) => bell(f, .07, .2, i * .05, self)); },
    // 卡着拍子冲过去（ON BEAT）：一声清脆的拍手加两个高音，和捡金币的叮不一样（2026-11-16，原来没声音，跟着节拍的玩法却听不出对没对上）
    onbeat() { if (!rep('onbeat', .2)) return; noise({ dur: .05, type: 'highpass', f: 2600, g: .08, out: self }); bell(1567.98, .07, .14, 0, self); bell(2093, .06, .16, .045, self); },
    pop(n) { if (!rep('pop', .04)) return; tone({ dur: .07, f: 1200 + (n || 0) % 6 * 120, f2: 2400, g: .1 }); noise({ dur: .05, type: 'highpass', f: 5000, g: .06 }); },

    /* ---------- 路上 ---------- */
    // 烟里冲刺（2026-11-17）：一冲进烟里加速是一声往上扬的风；从人旁边擦过去是短短一下；健康跑哨子是两声「哔——哔」
    turbo() { if (!rep('turbo', .6)) return; noise({ dur: .4, type: 'bandpass', f: 500, f2: 2400, q: 1.1, g: .08, out: self }); },
    brush() { if (!rep('brush', .15)) return; noise({ dur: .11, type: 'bandpass', f: 1300, f2: 650, q: .9, g: .05, out: self }); },
    whistle() { tone({ dur: .11, f: 2650, f2: 2900, type: 'sine', g: .09, out: self }); tone({ t: .15, dur: .26, f: 2750, f2: 3150, type: 'sine', g: .09, out: self }); },
    lane() { noise({ dur: .09, type: 'bandpass', f: 900, f2: 1800, q: .8, g: .05, out: self }); },
    bump() { if (!rep('bump', .12)) return; tone({ dur: .12, f: 150, f2: 70, g: .3, out: self }); noise({ dur: .07, type: 'lowpass', f: 500, g: .16, out: self }); },
    // 滑板：起跳是板尾磕地的「啪」，落地是四个轮子着地的一声闷响
    ollie() { tone({ dur: .045, f: 1100, f2: 420, type: 'triangle', g: .12, out: self }); noise({ dur: .04, type: 'highpass', f: 2600, g: .07, out: self }); },
    land() { noise({ dur: .1, type: 'lowpass', f: 380, g: .16, out: self }); tone({ dur: .06, f: 210, f2: 120, g: .1, out: self }); },
    horn() { tone({ dur: .12, f: 640, type: 'square', g: .06, lpf: 2200 }); tone({ t: .17, dur: .16, f: 640, type: 'square', g: .06, lpf: 2200 }); },
    scooter() { noise({ dur: .9, type: 'bandpass', f: 240, f2: 620, q: 3, g: .16 }); },
    vent() { noise({ dur: .6, type: 'lowpass', f: 300, f2: 1400, g: .12 }); },
    tick() { tone({ dur: .04, f: 1500, type: 'square', g: .04 }); },
    // 鸽子被惊飞：扑棱扑棱三下
    flap() { if (!rep('flap', .3)) return; [0, .07, .14].forEach(t => noise({ t, dur: .06, type: 'bandpass', f: 1400, q: 3, g: .07 })); },

    /* ---------- 大烟雾和老板 ---------- */
    // 低吼：开头扑上来、正式出场
    smog() { tone({ dur: .8, f: 82, f2: 50, type: 'sawtooth', g: .2, out: self, lpf: 400 }); noise({ dur: .8, type: 'lowpass', f: 300, g: .22, out: self }); },
    // 被追上：泄气的长号，三个音往下掉，最后一个拖长
    caught() {
      noise({ dur: .9, type: 'lowpass', f: 700, f2: 120, g: .26, out: self });
      [[233, 0, .26], [208, .28, .26], [175, .56, .7]].forEach(([f, t, dur]) => tone({ t, dur, f, f2: f * .9, type: 'sawtooth', g: .15, out: self, lpf: 900 }));
    },
    boss() { tone({ dur: .2, f: 120, f2: 70, type: 'sawtooth', g: .14, lpf: 700 }); },
    charge() { tone({ dur: 1, f: 90, f2: 240, type: 'sawtooth', g: .08, lpf: 1200 }); },
    blow() { noise({ dur: 1.1, type: 'lowpass', f: 900, f2: 300, g: .26 }); },

    /* ---------- 环境和脚步 ---------- */
    // 环境声：一路很轻的底噪，按街区换味道；隔一会儿远处一声喇叭，公园里是鸟叫。走 world 通道，所以一憋气它也跟着没了
    amb(kind) {
      if (!ax || kind === ambKind) return; ambKind = kind;
      if (!ambG) {
        if (!kind) return;
        ambG = ax.createGain(); ambG.gain.value = 0; ambF = ax.createBiquadFilter(); ambF.type = 'lowpass';
        const s = ax.createBufferSource(); s.buffer = nb; s.loop = true; s.connect(ambF); ambF.connect(ambG); ambG.connect(world); s.start();
      }
      const P = { city: [420, .05], park: [900, .028], roof: [650, .045], subway: [190, .09] }[kind];
      ambG.gain.setTargetAtTime(P ? P[1] : 0, ax.currentTime, .4); if (P) ambF.frequency.setTargetAtTime(P[0], ax.currentTime, .4);
      clearInterval(ambT); ambT = null;
      if (kind) ambT = setInterval(() => {
        if (!ax || ax.state !== 'running') return;
        if (ambKind === 'park' && Math.random() < .45) { const f = 2600 + Math.random() * 900; tone({ dur: .07, f, f2: f * 1.25, g: .03 }); tone({ t: .1, dur: .06, f: f * 1.1, f2: f * 1.3, g: .025 }); }
        else if (ambKind === 'city' && Math.random() < .1) tone({ dur: .35, f: Math.random() < .5 ? 392 : 466, type: 'square', g: .012, lpf: 700 });
        else if (ambKind === 'subway' && Math.random() < .12) noise({ dur: 1.4, type: 'lowpass', f: 120, f2: 320, g: .08 });
      }, 1100);
    },
    // 雨声（第 4 天起的雨天，2026-11-16）：一路沙沙的高频底噪，跟着画面上雨的多少慢慢起落；走 world 通道，憋气时也跟着闷下去。原来下雨没有声音
    rain(v) {
      if (!ax) return;
      v = Math.max(0, Math.min(1, v || 0));
      if (!rainG) {
        if (v < .02) return;
        rainG = ax.createGain(); rainG.gain.value = 0;
        const hp = ax.createBiquadFilter(), lo = ax.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600; lo.type = 'lowpass'; lo.frequency.value = 6500;
        const s = ax.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = .93; s.connect(hp); hp.connect(lo); lo.connect(rainG); rainG.connect(world); s.start();
      }
      if (Math.abs(v - rainV) > .02) { rainV = v; rainG.gain.setTargetAtTime(v * .075, ax.currentTime, .6); }
    },
    // 脚步：很轻的一下。i 左右脚轮换，音色差一点
    step(i) { noise({ dur: .035, type: 'lowpass', f: i ? 420 : 340, g: .07 }); },
    // 烟民被浇了以后「哎」的一声
    oops() { tone({ t: .1, dur: .13, f: 620, f2: 300, type: 'triangle', g: .06 }); },

    /* ---------- 界面 ---------- */
    // 点 PLAY：一声往上扫的风，接两个上行的音
    go() { noise({ dur: .22, type: 'bandpass', f: 500, f2: 3200, q: 1, g: .09, out: self }); bell(659, .12, .16, .05, self); bell(988, .13, .35, .14, self); },
    // 打开一个面板：轻轻一声「唰」
    open() { noise({ dur: .12, type: 'bandpass', f: 700, f2: 2200, q: .9, g: .06, out: self }); tone({ t: .06, dur: .05, f: 760, g: .05, out: self }); },
    // 花金币、买东西：收银机「叮铃」
    // 开奖（docs/33）：一串往上冲的分解和弦，最后一个音拖长，接两声高铃和一阵闪光的沙沙声。买到东西、看广告领到东西时响
    fanfare() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { const last = i === 4; tone({ t: i * .075, dur: last ? .75 : .16, f, type: 'square', g: .055, out: self, lpf: 3400 }); tone({ t: i * .075, dur: last ? .75 : .16, f: f / 2, type: 'triangle', g: .12, out: self }); });
      bell(2093, .07, .8, .4, self); bell(2637, .06, .7, .5, self); bell(3136, .05, .6, .6, self);
      noise({ t: .36, dur: .6, type: 'highpass', f: 7000, g: .045, out: self });
    },
    buy() { bell(1319, .1, .12, 0, self); bell(1760, .11, .14, .07, self); bell(2637, .1, .4, .14, self); noise({ dur: .05, type: 'highpass', f: 6000, g: .05, out: self }); },
    // 结算卡滑上来：一声闷响
    card() { tone({ dur: .14, f: 170, f2: 90, g: .2, out: self }); noise({ dur: .16, type: 'bandpass', f: 500, f2: 1400, q: .8, g: .05, out: self }); },
    // 轮到你了：两个上行的音
    ready() { bell(784, .11, .14, 0, self); bell(1175, .12, .35, .11, self); },
    click() { tone({ dur: .035, f: 900, f2: 500, g: .1, out: self }); noise({ dur: .015, type: 'highpass', f: 3000, g: .04, out: self }); },
    star(i) { bell(783.99 * [1, 4 / 3, 5 / 3, 2, 8 / 3][Math.min(4, i || 0)], .12, .3, 0, self); },
    // 号角：四个上行的音，每个垫一个五度，最后一个拖长
    win() { [523, 659, 784, 1047].forEach((f, i) => { tone({ t: i * .1, dur: i === 3 ? .5 : .2, f, type: 'triangle', g: .18, out: self }); tone({ t: i * .1, dur: i === 3 ? .5 : .2, f: f * 1.5, type: 'triangle', g: .07, out: self }); }); },
    // 对话打字的滴滴声：v 越大声音越尖（0 大烟雾，1 路人，2 主角）
    blip(v) { tone({ dur: .035, f: [140, 300, 520][v || 0] * (1 + Math.random() * .08), type: 'square', g: .03, out: self }); }
  };
})();
