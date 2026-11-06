// アプリのアイコン（icon-192.png・icon-512.png・icon-512-maskable.png）を作る。maskable は絵を中心から0.75倍にして、丸く切られても欠けないようにする（安全な範囲は中心の直径80%）。黒板の緑の地に、支点の三角と、左右におもりをつるした水平なてこ。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const [s, name, k] of [[192, "icon-192.png", 1], [512, "icon-512.png", 1], [512, "icon-512-maskable.png", 0.75]]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#173029"/><g transform="translate(50 50) scale(${k}) translate(-50 -50)">
      <polygon points="50,40 38,80 62,80" fill="#8a6a3a" stroke="#d9b77a" stroke-width="2.5"/>
      <rect x="10" y="33" width="80" height="8" rx="4" fill="#d9a35a" stroke="#f3d9a6" stroke-width="1.5"/>
      <g stroke="#cfd8d3" stroke-width="2"><line x1="30" y1="41" x2="30" y2="52"/><line x1="86" y1="41" x2="86" y2="52"/></g>
      <rect x="20" y="52" width="20" height="20" rx="3" fill="#f2c14e" stroke="#fff3c4" stroke-width="2"/>
      <rect x="79" y="52" width="14" height="14" rx="3" fill="#f2c14e" stroke="#fff3c4" stroke-width="2"/></g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", name), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
