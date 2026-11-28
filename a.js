// 访问统计：Google Analytics 4，媒体资源 "iphoneos0.com website"（macos0@icloud.com 的账号），衡量 ID G-K834614QE6。
// - 只在正式网址（iphoneos0.com）上发；本地检查、录视频（?bot ?rec ?shot）一律不发
// - 欧洲经济区、英国、瑞士默认不存 cookie（Google 用无 cookie 的方式估算），其他地区存统计 cookie；广告相关全部不开
// - 游戏里用 window.track(事件名, 参数) 记几件事：开始玩、一局结束、分享、去看别的游戏
(function () {
  var ID = 'G-K834614QE6';
  var live = /(^|\.)iphoneos0\.com$/.test(location.hostname) && !/[?&](bot|rec|shot)(=|&|$)/.test(location.search);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.track = function (name, params) { if (live) window.gtag('event', name, params || {}); };
  if (!live) return;
  var deny = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  var EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU',
    'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH'];
  window.gtag('consent', 'default', Object.assign({ analytics_storage: 'denied', region: EU }, deny));
  window.gtag('consent', 'default', Object.assign({ analytics_storage: 'granted' }, deny));
  window.gtag('js', new Date());
  window.gtag('config', ID, { allow_google_signals: false });
  var s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
})();
