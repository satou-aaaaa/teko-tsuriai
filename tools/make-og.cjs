// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題は入れず、見本のてこ（左に20gを2目盛り・右に10gを4目盛り）だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const CX = 900, CY = 250, U = 56, x = (d) => CX + d * U;
  const ticks = [-4, -3, -2, -1, 1, 2, 3, 4].map((d) => `<text x="${x(d)}" y="${CY - 22}" fill="#b4c6bd" font-size="26" font-weight="800" text-anchor="middle">${Math.abs(d)}</text>`).join("");
  const wt = (d, w, s) => `<line x1="${x(d)}" y1="${CY + 10}" x2="${x(d)}" y2="${CY + 50}" stroke="#cfd8d3" stroke-width="4"/><rect x="${x(d) - s / 2}" y="${CY + 50}" width="${s}" height="${s}" rx="10" fill="#f2c14e" stroke="#fff3c4" stroke-width="4"/><text x="${x(d)}" y="${CY + 50 + s / 2 + 10}" fill="#2a2005" font-size="28" font-weight="900" text-anchor="middle">${w}g</text>`;
  const svg = `<svg width="1200" height="630" style="position:absolute;left:0;top:0">
    <polygon points="${CX},${CY + 6} ${CX - 50},${CY + 260} ${CX + 50},${CY + 260}" fill="#8a6a3a" stroke="#d9b77a" stroke-width="5"/>
    <rect x="${x(-4.5)}" y="${CY - 10}" width="${9 * U}" height="20" rx="10" fill="#d9a35a" stroke="#f3d9a6" stroke-width="3"/>${ticks}
    ${wt(-2, 20, 96)}${wt(4, 10, 72)}</svg>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 80px;background:#173029;color:#f1f5f0;position:relative;overflow:hidden">
    ${svg}
    <div style="position:relative;font-size:34px;color:#f2c14e;letter-spacing:.1em">だれでも同じ 1日3問・小6理科</div>
    <div style="position:relative;font-size:96px;font-weight:900;margin-top:16px;letter-spacing:.04em;text-shadow:0 0 30px #f2c14e55">てこの<br>つりあい</div>
    <div style="position:relative;font-size:38px;margin-top:18px;line-height:1.5">いちばん少ないおもりで、<br>水平にできる？</div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
