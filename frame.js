// 游戏页的外框（2026-11-29，学 Poki、CrazyGames：网站的栏在游戏外面，游戏里不放回主页按钮）。
// 每款游戏真正的页面还在 /daily/<slug>/，网站上的游戏页是 /play/<slug>/（环球躲烟仓库 site/play/），用 iframe 把它装进去。
// 这个文件放在每款游戏 <head> 的最前面：
//   - 在 iframe 里：给 <html> 加 class="embed"，游戏可以据此调整
//   - 有人直接打开 /daily/<slug>/（旧链接、以前分享出去的）：换到 /play/<slug>/，这样顶部有网站的栏，能回首页
// 本机调试（不是正式网址）、工具模式（?bot ?rec ?shot ?raw ?adtest）不换，检查和录视频照常。
(function () {
  if (window.top !== window) { document.documentElement.classList.add('embed'); return; }
  if (!/(^|\.)iphoneos0\.(com|github\.io)$/.test(location.hostname)) return;
  if (/[?&](bot|rec|shot|raw|adtest)(=|&|$)/.test(location.search)) return;
  var m = location.pathname.match(/^\/daily\/([^\/]+)\/?/);
  if (m) location.replace('/play/' + m[1] + '/' + location.search + location.hash);
})();
