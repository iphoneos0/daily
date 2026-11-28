// 所有游戏。每天在最前面加一条；date 晚于今天（东八区）的不在首页显示，可以提前做好排队。
// focus：缩略图在卡片里露出哪一块（CSS object-position）
// controls / fun / hook 给以后选题用：避免连着几天同一种操作、同一种乐趣、同一种短视频看点
window.GAMES = [
  {
    // 也不是 kit 做的小游戏：环球躲烟（~/Desktop/环球躲烟），App Store 上的 Hold Your Breath: Smoke Dash 的网页版。
    // site/hyb/ 由 tools/sync-hyb.sh 从环球躲烟的 main 导出，别在这里改；网页适配在 tools/hyb/web.js（不放广告、内购改成去 App Store）
    no: 4, slug: 'hyb', date: '2026-11-27', title: 'Hold Your Breath',
    about: 'Hold your breath and dash through the smog of a cartoon New York. Slip past smokers on a single breath, grab coins and gear, and outrun the Big Smog.',   // 游戏页下面的介绍（网站 /play/<slug>/）
    verb: 'Hold your breath. Outrun the smog.', focus: '50% 40%',
    controls: 'hold', fun: ['timing', 'run'],
    hook: 'a wall of smog swallows the street, the kid holds his breath and dashes through',
    app: { ios: 'https://apps.apple.com/app/id6835118803' },   // 游戏页下面放「App Store 下载」、首页格子上标 iPhone
  },
  {
    // 不是用 kit 做的每日小游戏，是按调研打法做的那款大的（~/Desktop/沙子方块），有美术，网页、iPhone、安卓同一份代码。
    // 这里的文件由那边的 tools/publish-daily.sh 同步过来，别在这里改 site/sandjar/。名字是工作名，上架前要换（App Store 已有 Sandjar）
    no: 3, slug: 'sandjar', date: '2026-11-26', title: 'Sand Jar',
    about: 'Drop colored blocks into a glass jar and watch them pour into sand. Join one color from wall to wall to clear a layer, chain clears for big combos, and leave a sunset sand picture behind.',   // 游戏页下面的介绍（网站 /play/<slug>/）
    verb: 'Drop the blocks. Join colors wall to wall.', focus: '50% 55%',
    controls: 'drag', fun: ['planning', 'satisfying'],
    hook: 'a 5-combo melts the jar layer by layer, a sunset sand-art jar left behind',
  },
  {
    no: 2, slug: 'meowntain', date: '2026-11-24', title: 'Meowntain',
    about: 'Cats are falling from the sky. Slide the box to catch them and stack the tallest cat tower you can. Keep it balanced, and watch out for dogs.',   // 游戏页下面的介绍（网站 /play/<slug>/）
    verb: 'Catch the cats. Stack them high.', focus: '50% 85%',
    controls: 'drag', fun: ['balance', 'growth'],
    hook: 'a wobbling tower of 30 cats sways, then TIMBER!',
  },
  {
    no: 1, slug: 'saywhen', date: '2026-11-23', title: 'Say When',
    about: 'Hold to pour, and let go right at the line. Mind the foam, the different glass shapes and the moving belt. How many glasses can you fill?',   // 游戏页下面的介绍（网站 /play/<slug>/）
    verb: 'Hold to pour. Let go at the line.', focus: '50% 80%',
    controls: 'hold', fun: ['timing', 'judgement'],
    hook: 'foam climbs over the line, then settles right on it',
  },
];
