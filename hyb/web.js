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
//   主页顶栏中间加一个「More games」回每日一游首页。
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

  function addMore() {
    var title = document.getElementById('title');
    if (!title || document.getElementById('dailyMore')) return;
    var a = document.createElement('a');
    a.id = 'dailyMore'; a.href = '../'; a.textContent = 'More games';
    a.style.cssText = 'position:absolute;z-index:5;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 18px);' +
      'background:#fff;color:#1c2230;border:2.5px solid #1c2230;border-radius:999px;padding:7px 14px;' +
      'font-weight:800;font-size:14px;line-height:1;text-decoration:none;box-shadow:0 3px 0 #1c2230;white-space:nowrap';
    a.addEventListener('click', function () { send('more_games', { from: 'title' }); });
    title.appendChild(a);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addMore); else addMore();
})();
