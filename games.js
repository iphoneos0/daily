// 所有游戏。每天在最前面加一条；date 晚于今天（东八区）的不在首页显示，可以提前做好排队。
// focus：缩略图在卡片里露出哪一块（CSS object-position）
// controls / fun / hook 给以后选题用：避免连着几天同一种操作、同一种乐趣、同一种短视频看点
window.GAMES = [
  {
    no: 1, slug: 'saywhen', date: '2026-11-23', title: 'Say When',
    verb: 'Hold to pour. Let go at the line.', focus: '50% 80%',
    controls: 'hold', fun: ['timing', 'judgement'],
    hook: 'foam climbs over the line, then settles right on it',
  },
];
