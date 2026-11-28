// 环球躲烟（Hold Your Breath: Smoke Dash）放在每日一游里的网页适配。
// 只在 iphoneos0.com/daily/hyb/ 这一份里加载（tools/sync-hyb.sh 往 index.html 里加），App 里没有这个文件，不受影响。
// 游戏代码一行没改：它本来就先看 window.hybAds / hybStore / hybTrack 在不在，在就用（环球躲烟 game/js/main.js 的「广告和内购」一节）。
// 网页版给它一套：
//   广告：走每日一游的网页广告层（../ads.js，谷歌 AdSense 的 H5 游戏广告；批下来以前是测试模式的假广告）。
//         激励视频（复活、金币翻倍、换装备、领金币…）是玩家自己点的，看完给奖励；这会儿没广告可放也照给。
//         两局之间的插屏用游戏自己的规则（第 5 局起每 3 局、离上一条至少 2 分钟），ads.js 再管一道间隔。
//         没有 ads.js 时（本地、?noads）：奖励直接给，插屏不放。不给这套的话，游戏会弹一张给测试用的「占位广告」卡。
//   内购：网页里买不了。价格按钮写「Get app」，点了打开 App Store 上的环球躲烟（不给这套的话，测试版的设定是点了直接白给）。
//   统计：开跑、一局结束转成网站统计（../a.js 的 window.track）的 game_start / game_over，game 参数是 'hyb'。
(function () {
  var APP = 'https://apps.apple.com/app/id6835118803';
  var send = function (name, p) { try { if (window.track) window.track(name, Object.assign({ game: 'hyb' }, p || {})); } catch (e) { /* 统计出错不影响玩 */ } };

  window.hybAds = {
    prepare: function () { return Promise.resolve(); },
    show: function (kind) {
      var A = window.webAds;
      if (kind === 'inter') return A ? A.inter('between_runs').then(function (st) { return { ok: st === 'viewed', noAd: st !== 'viewed' }; }) : Promise.resolve({ ok: false, noAd: true });
      return A ? A.reward(kind).then(function (ok) { return { ok: ok }; }) : Promise.resolve({ ok: true });
    },
    privacyRequired: function () { return Promise.resolve(false); },
    privacyForm: function () { return Promise.resolve(); }
  };

  window.hybStore = {
    price: function () { return 'Get app'; },
    buy: function (id) { send('get_app', { from: 'store', item: id }); window.open(APP, '_blank'); return Promise.resolve(false); },
    restore: function () { return Promise.resolve([]); },
    owned: function () { return Promise.resolve([]); }
  };

  window.hybTrack = function (name, p) {
    p = p || {};
    if (name === 'run_start') send('game_start', { again: p.run > 1 ? 1 : 0 });
    else if (name === 'run_end') send('game_over', { score: p.meters || 0, secs: p.secs || 0 });
  };

  // 装在网站游戏页里时（frame.js 给 <html> 加了 class="embed"，2026-11-29）：
  //   - 手机全屏时左上角浮着网站的「‹ 标志」返回按钮（学 Poki），主页左上角的设置、礼物两个按钮往右让开
  //   - 电脑上游戏框是 16:9，游戏只占中间一竖条，两边原来是深灰底，换成模糊的纽约街景
  (function () {
    var css = 'html.embed #title .topbar .lefts{margin-left:62px}' +
      'html.embed body{background:transparent}' +   // body 的底色会盖住下面那张模糊图，得透明

      'html.embed body::before{content:"";position:fixed;inset:-40px;z-index:-1;background:url(assets/img/city-newyork.png) center/cover;filter:blur(14px) brightness(.75)}';
    var st = document.createElement('style'); st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  })();
  // 2026-11-29：原来主页顶栏中间有个「More games」小胶囊回每日一游首页。现在回首页交给网站的游戏页（/play/hyb/）顶栏，这里不再加
})();
