// 网页广告（docs/03-网页广告.md）：谷歌 AdSense 的 H5 游戏广告，接口是 adBreak()（Ad Placement API）。
// 三档（MODE）：
//   'off'  ：线上现在这一档。AdSense 网站审核和 H5 游戏广告申请批下来以前，不放任何广告（不加载谷歌的脚本）；
//            激励视频的奖励直接给，插屏跳过。网址加 ?adtest 时临时变成 'test'，给我们自己验收用
//   'test' ：谷歌的测试模式（data-adbreak-test="on"），放写着 Interstitial / Rewarded ad example 的假广告，不算钱
//   'live' ：真广告。两样都批下来、AdSense 里的欧盟同意消息也做好以后，把 MODE 改成 'live' 重新发布
//
// 游戏里这样用（没有 window.webAds 时游戏照常玩，什么都不放）：
//   webAds.inter(name, { gap }) → Promise<状态>：两局之间的插屏。只在转场时叫（点「再来一局」以后、开下一局以前）
//   webAds.reward(name) → Promise<boolean>：玩家自己点的激励视频（复活、金币翻倍…）。看完是 true；
//     这会儿没有广告可放时也给 true，不让玩家白点
// 规矩（谷歌的政策 + 我们自己的）：玩的时候不放；刚打开网页不放；插屏之间至少 gap 秒（默认 120），谷歌自己也会控频率。
// 检查、录视频（?bot ?rec ?shot）和 ?noads 时一律不放。
(function () {
  var CLIENT = 'ca-pub-8296923156982965';   // 跟 AdMob 同一个发布商编号（macos0@icloud.com）
  var MODE = 'off';
  if (/[?&]adtest(=|&|$)/.test(location.search)) MODE = 'test';
  var TEST = MODE === 'test';
  var GAP = /[?&]adnow(=|&|$)/.test(location.search) ? 0 : 120;   // ?adnow：自己测试时不等间隔
  var off = MODE === 'off' || /[?&](bot|rec|shot|noads)(=|&|$)/.test(location.search);
  var lastInter = Date.now(), showing = false;   // 从打开网页算起，GAP 秒以内不放插屏
  window.adsbygoogle = window.adsbygoogle || [];
  if (!off) {
    var s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
    if (TEST) s.setAttribute('data-adbreak-test', 'on');
    s.setAttribute('data-ad-frequency-hint', GAP + 's');
    document.head.appendChild(s);
    window.adsbygoogle.push({ preloadAdBreaks: 'on', sound: 'on' });   // 即 adConfig()
  }
  var brk = function (o) { try { window.adsbygoogle.push(o); } catch (e) { if (o.adBreakDone) o.adBreakDone({ breakStatus: 'error' }); } };
  var quiet = function (on) { try { window.dispatchEvent(new Event(on ? 'webads-start' : 'webads-end')); } catch (e) { /* 老浏览器 */ } };
  var log = function (name, p) { try { if (window.track) window.track(name, p); } catch (e) { /* 统计出错不影响玩 */ } };

  window.webAds = {
    mode: MODE,
    inter: function (name, opt) {
      var gap = (opt && opt.gap) || GAP;
      return new Promise(function (done) {
        if (off || showing || Date.now() - lastInter < gap * 1000) return done('skip');
        showing = true;
        // 谷歌 8 秒还没开始放就算了，别把游戏卡住；开始放了就等它放完
        var t = setTimeout(function () { fin('timeout'); }, 8000);
        function fin(st) { if (!showing) return; showing = false; clearTimeout(t); log('ad', { kind: 'inter', name: name, status: st }); done(st); }
        brk({
          type: 'next', name: name || 'next',
          beforeAd: function () { clearTimeout(t); quiet(true); },
          afterAd: function () { quiet(false); lastInter = Date.now(); },
          adBreakDone: function (info) { fin((info && info.breakStatus) || 'done'); }
        });
      });
    },
    reward: function (name) {
      return new Promise(function (done) {
        if (off) return done(true);
        if (showing) return done(false);
        showing = true;
        var got = false, shown = false;
        var t = setTimeout(function () { fin('timeout'); }, 8000);
        function fin(st) {
          if (!showing) return; showing = false; clearTimeout(t);
          log('ad', { kind: 'reward', name: name, status: st, shown: shown ? 1 : 0, ok: got ? 1 : 0 });
          done(shown ? got : true);   // 没放出来（没广告、网络慢）就照给
        }
        brk({
          type: 'reward', name: name || 'reward',
          beforeReward: function (showAd) { clearTimeout(t); shown = true; showAd(); },
          beforeAd: function () { clearTimeout(t); shown = true; quiet(true); },
          afterAd: function () { quiet(false); lastInter = Date.now(); },
          adViewed: function () { got = true; },
          adDismissed: function () { got = false; },
          adBreakDone: function (info) { fin((info && info.breakStatus) || 'done'); }
        });
      });
    }
  };
})();
