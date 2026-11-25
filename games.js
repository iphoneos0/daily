// 所有游戏。每天在最前面加一条；date 晚于今天（东八区）的不在首页显示，可以提前做好排队。
// focus：缩略图在卡片里露出哪一块（CSS object-position）
// controls / fun / hook 给以后选题用：避免连着几天同一种操作、同一种乐趣、同一种短视频看点
window.GAMES = [
  {
    // 不是用 kit 做的每日小游戏，是按调研打法做的那款大的（~/Desktop/沙子方块），有美术，网页、iPhone、安卓同一份代码。
    // 这里的文件由那边的 tools/publish-daily.sh 同步过来，别在这里改 site/sandjar/。名字是工作名，上架前要换（App Store 已有 Sandjar）
    no: 3, slug: 'sandjar', date: '2026-11-26', title: 'Sand Jar',
    verb: 'Drop the blocks. Join colors wall to wall.', focus: '50% 55%',
    controls: 'drag', fun: ['planning', 'satisfying'],
    hook: 'a 5-combo melts the jar layer by layer, a sunset sand-art jar left behind',
  },
  {
    no: 2, slug: 'meowntain', date: '2026-11-24', title: 'Meowntain',
    verb: 'Catch the cats. Stack them high.', focus: '50% 85%',
    controls: 'drag', fun: ['balance', 'growth'],
    hook: 'a wobbling tower of 30 cats sways, then TIMBER!',
  },
  {
    no: 1, slug: 'saywhen', date: '2026-11-23', title: 'Say When',
    verb: 'Hold to pour. Let go at the line.', focus: '50% 80%',
    controls: 'hold', fun: ['timing', 'judgement'],
    hook: 'foam climbs over the line, then settles right on it',
  },
];
