// てこのつりあいの検査。てこのきまり（重さ×きょりの見本と、別に書いた数え方）・いちばん少ないおもりの数（全部のつるし方で数え直す）・3問の組み方（1年分）・つるす/取りかえる/はずす/戻す/ヒント・続きから・上級・てこ帳・実績・記録・スマホ幅・PWA。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const T = createRequire(import.meta.url)(path.join(root, "gen.js"));
const LVS = [...T.SIZES, T.HARD];

// 別に書いたてこの数え方（gen.js の moments を使わない）：フックの番号から目盛りを出し直し、左右の「重さ×きょり」をたす
const pos2 = (A, j) => (j < A ? -(A - j) : j - A + 1);
function torque(p, put) {
  let l = 0, r = 0;
  const add = (w, x) => { if (x < 0) l += w * -x; else r += w * x; };
  p.fixed.forEach((f) => add(f.w, f.pos));
  put.forEach((v, j) => { if (v) add(p.inv[v - 1].w, pos2(p.A, j)); });
  return { l, r };
}
// 置けるフックに、手もちの数の中で全部のつるし方を試して、つりあう中でいちばん少ないおもりの数
function bruteMin(p) {
  const free = [];
  for (let j = 0; j < 2 * p.A; j++) { const x = pos2(p.A, j); if (!p.fixed.some((f) => f.pos === x) && !p.block.includes(x)) free.push(j); }
  const put = Array(2 * p.A).fill(0), left = p.inv.map((x) => x.n);
  let best = Infinity;
  (function go(i, n) {
    if (n >= best) return;
    if (i === free.length) { const t = torque(p, put); if (t.l === t.r) best = n; return; }
    go(i + 1, n);
    for (let t = 0; t < p.inv.length; t++) if (left[t]) { left[t]--; put[free[i]] = t + 1; go(i + 1, n + 1); put[free[i]] = 0; left[t]++; }
  })(0, 0);
  return best;
}

// 1. てこのきまりと問題の作り方（ブラウザを使わない）
{
  const mk = (A, fixed, inv, block = []) => ({ A, fixed, block, inv: inv.map(([w, n]) => ({ w, n })) });
  const p1 = mk(4, [{ pos: -2, w: 20 }], [[10, 3]]), at = (p, pairs) => { const a = Array(2 * p.A).fill(0); pairs.forEach(([x, v]) => { a[T.hookOf(p.A, x)] = v; }); return a; };
  check("てこの見本：左に20gを2目盛り・右に10gを4目盛りでつりあう（20×2＝10×4）", T.balanced(p1, at(p1, [[4, 1]])) && !T.balanced(p1, at(p1, [[3, 1]])));
  check("てこの見本：右に10gを1目盛りと3目盛り（10×1＋10×3＝40）でもつりあう（たし算のきまり）", T.balanced(p1, at(p1, [[1, 1], [3, 1]])));
  check("てこの見本：同じ重さを同じきょりの左右につるすと、つりあいは変わらない", (() => { const p = mk(4, [{ pos: -1, w: 30 }], [[10, 3]]), a = at(p, [[3, 1]]), b = at(p, [[3, 1], [-2, 1], [2, 1]]); return T.balanced(p, a) && T.balanced(p, b); })());
  check("フックの番号と目盛り：左うでは -A〜-1、右うでは 1〜A（posOf と hookOf が逆の関係）", LVS.every((L) => [...Array(2 * L.A)].every((_, j) => T.posOf(L.A, j) === pos2(L.A, j) && T.hookOf(L.A, T.posOf(L.A, j)) === j)));
  const bad = [], solBad = [], brute = [], hintBad = [], same = [], dist = {};
  LVS.forEach((L, lv) => {
    const N = lv === 3 ? 200 : 400;
    for (let s = 0; s < N; s++) {
      const seed = T.seedOf(`qa:${lv}:${s}`), p = T.make(seed, L);
      if (!p) { bad.push(`${L.name}:${s}:作れない`); continue; }
      const used = [...p.fixed.map((f) => f.pos), ...p.block];
      const shapeOk = p.A === L.A && p.fixed.length >= L.fixed[0] && p.fixed.length <= L.fixed[1] && p.block.length === L.block && new Set(used).size === used.length && used.every((x) => Number.isInteger(x) && x !== 0 && Math.abs(x) <= L.A) && p.fixed.every((f) => [10, 20, 30].includes(f.w));
      const t0 = torque(p, Array(2 * p.A).fill(0));
      if (!shapeOk || t0.l === t0.r || p.d < L.min[0] || p.d > L.min[1]) bad.push(`${L.name}:${s}`);
      const sol = p.sol, solOk = Array.isArray(sol) && sol.length === 2 * p.A && sol.every((v, j) => v === 0 || (!used.includes(pos2(p.A, j)) && v <= p.inv.length)) && p.inv.every((x, t) => sol.filter((v) => v === t + 1).length <= x.n) && (() => { const t = torque(p, sol); return t.l === t.r; })() && sol.filter(Boolean).length === p.d;
      if (!solOk) solBad.push(`${L.name}:${s}`);
      if (s < (lv === 3 ? 120 : 150)) { const b = bruteMin(p); if (b !== p.d) brute.push(`${L.name}:${s}:${p.d}≠${b}`); }
      // ヒント：答えのおもりを1こ動かせなくすると、残りはちょうど1こ少ない
      const j = sol.findIndex(Boolean), fx = Array(2 * p.A).fill(0); fx[j] = sol[j];
      const h = T.solve(p, fx, 10); if (!h || h.d !== p.d - 1) hintBad.push(`${L.name}:${s}`);
      if (JSON.stringify(T.make(seed, L)) !== JSON.stringify(p)) same.push(`${L.name}:${s}`);
      dist[L.name] = dist[L.name] || {}; dist[L.name][p.d] = (dist[L.name][p.d] || 0) + 1;
    }
  });
  check("問題の作り方：どの種類も作れて、はじめはかたむいている・はじめのおもりと×のフックは重ならない・いちばん少ない数が決めた幅（4種類×何百問）", bad.length === 0, bad.slice(0, 5).join(","));
  check("問題の作り方：答えのつるし方は、置けるフックだけ・手もちの数の中で・つりあい・数がいちばん少ない数と同じ", solBad.length === 0, solBad.slice(0, 5).join(","));
  check("いちばん少ないおもりの数を、全部のつるし方を試す別の数え方で数え直して同じ", brute.length === 0, brute.slice(0, 5).join(","));
  check("ヒントで答えのおもりを1こ動かせなくすると、残りはちょうど1こ少ない", hintBad.length === 0, hintBad.slice(0, 5).join(","));
  check("同じ種からは、いつも同じ問題ができる", same.length === 0, same.slice(0, 3).join(","));
  check("いちばん少ない数がかたよらない（どの種類も2通り以上）", Object.values(dist).every((d) => Object.keys(d).length >= 2), JSON.stringify(dist));
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
const htmlOwn = html.replace(/<!-- a11y:begin[\s\S]*?<!-- a11y:end -->/, ""); // 共通部品（見やすさの設定）を除いたゲームの中身
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
check("別のタブで先に進んだ（同じ回数の）つるし方を、古いタブのつるし方で上書きしない（2026-11-04・11-05 CodeRabbit）", /!\(old && old\.moves >= cur\.moves\)\)/.test(html));
{ // ひな形を写したリポジトリで、README・AGENTS.md に前のゲームの名前や URL が残らない（2026-11-05 CodeRabbit）
  const docs = ["README.md", "AGENTS.md", "manifest.webmanifest", "sw.js", "index.html"].map((f) => [f, readFileSync(path.join(root, f), "utf8")]);
  const left = docs.filter(([, t]) => /でんき回路|denki|導線|豆電球|回路帳|あみだ|amida|配達|しりとり|shiritori|ことばならべ|kotoba|words\.js|言葉帳|github\.io\/(?!teko-tsuriai\/)[a-z0-9-]+\//.test(t)).map(([f]) => f);
  check("README・AGENTS.md・manifest・sw.js・画面はこのゲームの名前と URL だけ（写し元のゲームが残らない）", left.length === 0 && /^# てこのつりあい/.test(docs[0][1]) && /satou-aaaaa\.github\.io\/teko-tsuriai\//.test(docs[0][1]), left.join(",")); }
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習の問題の種だけ（今日の3問・上級は日付の種）", (htmlOwn.match(/Math\.random/g) || []).length === 1 && /mode === "h" \? hardList\(k\) : \[\{ lv: opt, seed: Math\.floor\(Math\.random\(\)/.test(htmlOwn) && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/teko-tsuriai/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）・フォーム名は4字以上（3字以下だと GitHub がフォームを出さない。2026-11-05 CodeRabbit）", [...((fy.match(/^name: (.+)$/m) || [])[1] || "")].length > 3 && /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./gen.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png"];
  const local = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => "./" + m[1]);
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(Promise\.race\(\[net\.then[^\n]*wait\(15000\)[^\n]*wait\(60000\)\]\)\)/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し（画面が読むスクリプトも全部）、外へ何も送らない", need.concat(local).every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：保存が無く通信も返らなくても、60秒で必ず返事をする", /setTimeout\(\(\) => fromCache\(\)\.then\(\(hit\) => send\(hit \|\| Response\.error\(\)\)\), 60000\)/.test(sw));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "てこのつりあい" && mf.icons.length >= 2 && mf.start_url === "./");
  check("PWA：maskable のアイコンは絵を縮めた別の画像（丸く切られても欠けない。2026-11-05 CodeRabbit）", mf.icons.some((i) => i.purpose === "maskable" && i.src === "icon-512-maskable.png") && !mf.icons.some((i) => i.purpose === "maskable" && i.src === "icon-512.png")); }
{ const src = html + readFileSync(path.join(root, "gen.js"), "utf8");
  const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
  check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }


let browser = null; // 起動に失敗しても report.md を書けるように、起動は下の try の中で
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
const FIXED = new Date(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) + "T03:00:00Z");
async function newPage(w = 390, h = 844) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.stack));
  page.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
  await page.clock.setFixedTime(FIXED); // 時計を今日の昼（日本時間）に止める。QA の途中で0時をまたいでも「今日」が変わらない
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  return page;
}
const curT = (page) => page.evaluate(() => { const c = window.__tk.cur(); return { p: c.p, put: c.put.slice(), hint: c.hint.map((x) => x.slice()), hints: c.hints, moves: c.moves, done: c.done, hard: c.hard, sel: c.sel }; });
const nPut = (put) => put.filter(Boolean).length;
// おもりの種類を選んで、フックのボタンを押す（画面のボタンで遊ぶ）
async function tapHook(page, j, t) {
  if (t && (await curT(page)).sel !== t) await page.click(`#kinds button[data-t="${t}"]`);
  await page.click(`#hooks button[data-j="${j}"]`);
}
async function freeHook(page) { const c = await curT(page); return T.freeHooks(c.p).find((j) => !c.put[j]); }
// ヒントのおもりを残して、いちばん少ないつるし方につるし直し、手をはなす
async function solveNow(page) {
  if (await page.locator("#clear:not([disabled])").count()) await page.click("#clear");
  const c = await curT(page), p = c.p, fixed = Array(2 * p.A).fill(0);
  c.hint.forEach(([j, v]) => { fixed[j] = v; });
  const s = T.solve(p, fixed, 10);
  for (let j = 0; j < 2 * p.A; j++) if (s.put[j] && !fixed[j]) await tapHook(page, j, s.put[j]);
  await page.click("#answer");
}
const KEY = "teko-tsuriai-v1";
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await newPage();
  // 2. 3問の組み方（日付の種）
  const sel = await page.evaluate(() => {
    const g = window.__tk, out = { bad: [], same: 0, hsame: 0 };
    let prev = null;
    const sig = (p) => JSON.stringify([p.A, p.fixed, p.block, p.inv]);
    for (let n = 0; n < 365; n++) {
      const k = new Date(Date.parse("2026-11-06") + n * 864e5).toISOString().slice(0, 10);
      const d = g.dailyList(k).map(g.probOf), h = g.hardList(k).map(g.probOf);
      if (d.some((p) => !p) || h.some((p) => !p) || d.map((p) => p.A).join() !== "4,5,6" || h.map((p) => p.A + ":" + p.inv.length).join() !== "6:4,6:4") { out.bad.push(k); continue; }
      const sg = d.map(sig);
      if (prev && sg.some((x) => prev.includes(x))) out.same++; prev = sg;
      if (sig(h[0]) === sig(h[1])) out.hsame++;
    }
    out.d1201 = JSON.stringify(g.dailyList("2026-12-01").map(g.probOf));
    try { const t0 = performance.now(); out.far = g.dailyList("2036-11-06").every((it) => !!g.probOf(it)); out.farMs = performance.now() - t0; } catch (e) { out.far = false; out.farErr = String(e); }
    return out;
  });
  check("今日の3問は毎日うで4・5・6目盛り、上級はうで6目盛り（おもり4種類）を2つ（1年分）", sel.bad.length === 0, sel.bad.slice(0, 3).join(","));
  check("10年先の日も、前の日と同じてこを避けながらすぐに決まる（呼び出しを深く重ねない）", sel.far && sel.farMs < 3000, `${Math.round(sel.farMs)}ms ${sel.farErr || ""}`);
  check("前の日と同じてこが出ない・上級の2つは別のてこ（1年分）", sel.same === 0 && sel.hsame === 0, JSON.stringify([sel.same, sel.hsame]));
  { const ctx = await browser.newContext(); const p2 = await ctx.newPage(); await p2.goto(url);
    const d2 = await p2.evaluate(() => { const g = window.__tk; return JSON.stringify(g.dailyList("2026-12-01").map(g.probOf)); });
    await ctx.close();
    check("同じ日は別のブラウザで開いても同じ3問", sel.d1201 === d2); }
  check("てこのきまり：軽いおもりで重いおもりとつりあえば「軽くても遠くへ」、片方に2こ以上なら「たし算」と数える", await page.evaluate(() => { const g = window.__tk, p = { A: 4, fixed: [{ pos: -2, w: 20 }], block: [], inv: [{ w: 10, n: 3 }] }; const a = g.learnOf(p, [0, 0, 0, 0, 0, 0, 0, 1]), b = g.learnOf(p, [0, 0, 0, 0, 1, 0, 1, 0]), c = g.learnOf({ A: 4, fixed: [{ pos: -2, w: 10 }], block: [], inv: [{ w: 10, n: 3 }] }, [0, 0, 0, 0, 0, 1, 0, 0]); return a.lever && !a.sum && b.sum && b.lever && !c.lever && !c.sum; }));

  // 3. 通しで遊ぶ
  check("初めて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  await page.click("#howto-ok");
  await page.click("#go-d");
  let c = await curT(page);
  const tilt = () => page.getAttribute("#board svg", "aria-label");
  check("1問目はうで4目盛り：フックのボタン8つ・はじめのおもりと×のフックは押せない・手をはなすは押せない・いちばん少ない数が出る・てこはかたむいている", (await page.locator("#hooks button").count()) === 8 && (await page.locator("#hooks button.fix[disabled]").count()) === c.p.fixed.length && (await page.locator("#hooks button.blk[disabled]").count()) === c.p.block.length && (await page.locator("#answer[disabled]").count()) === 1 && (await page.textContent("#ask")).includes(`${c.p.d}こ`) && /下がっている/.test(await tilt()));
  { const m = T.moments(c.p, c.put); check("重いほうのうでが下がる（画面の読み上げとメーター）", (await tilt()).includes(m.L > m.R ? "左が下がっている" : "右が下がっている") && (await page.textContent("#meter")).includes(`${m.L} ${m.L > m.R ? "＞" : "＜"} ${m.R}`)); }
  const f1 = await freeHook(page);
  await tapHook(page, f1, 1);
  let n1 = await curT(page);
  check("空いたフックを押すと、選んだおもりをつるせる・のこりの数が減る", n1.put[f1] === 1 && (await page.textContent("#left")).includes("おもり 1こ") && (await page.textContent(`#kinds button[data-t="1"]`)).includes(`のこり ${c.p.inv[0].n - 1}`));
  await tapHook(page, f1, 1);
  check("同じおもりのフックをもう一度押すと、はずれる", nPut((await curT(page)).put) === 0);
  await tapHook(page, f1, 1);
  await page.click("#undo");
  check("戻すと、つるしたおもりがもとに戻る", nPut((await curT(page)).put) === 0);
  { // 手もちを全部つるしたら、もうつるせない
    const fr = T.freeHooks(c.p), n = c.p.inv[0].n;
    for (const j of fr.slice(0, n)) await tapHook(page, j, 1);
    const extra = fr[n];
    if (extra !== undefined) await tapHook(page, extra, 1);
    check("手もちのおもりを全部つるしたら、それより多くはつるせない（のこり 0）", nPut((await curT(page)).put) === Math.min(n, fr.length) && (await page.textContent(`#kinds button[data-t="1"]`)).includes("のこり 0"));
    await page.click("#clear"); }
  await page.click("#hint");
  n1 = await curT(page);
  { const fx = Array(2 * c.p.A).fill(0); if (n1.hint[0]) fx[n1.hint[0][0]] = n1.hint[0][1];
    const h = T.solve(c.p, fx, 10);
    check("ヒント1回目で、いちばん少ないつるし方のおもりが1こつるされ、残りは1こ少なくなる", n1.hints === 1 && n1.hint.length === 1 && nPut(n1.put) === 1 && h && h.d === c.p.d - 1); }
  await tapHook(page, n1.hint[0][0], n1.hint[0][1]);
  check("ヒントのおもりは押しても動かない", JSON.stringify((await curT(page)).put) === JSON.stringify(n1.put));
  if (c.p.d >= 2) { await page.click("#hint"); n1 = await curT(page); }
  check("ヒント2回目でもう1こ（いちばん少ない数が1なら1回で足りる）、ヒントのおもりは点線の枠で分かる（色だけで分けない）", n1.hint.length === Math.min(2, c.p.d) && (await page.locator("#hooks button.hint").count()) === n1.hint.length);
  await page.reload(); await page.click("#go-d");
  const hn = n1.hints;
  n1 = await curT(page);
  check("途中で閉じても、つるしたおもり・ヒントはそのまま（続きから）", n1.hints === hn && n1.hint.length === hn && nPut(n1.put) === hn && (await page.textContent("#left")).includes(`ヒント ${hn}`));
  await page.click("#back"); await page.click("#go-p"); await page.locator(".lv button").first().click(); await page.click("#back"); await page.click("#go-d");
  check("練習を始めても、今日の途中経過は消えない", (await curT(page)).hints === hn && (await page.evaluate(() => window.__tk.mode())) === "d");
  await solveNow(page);
  n1 = await curT(page);
  { const off = 3 - Math.max(1, 3 - hn);
    check("つりあうと手をはなせ、ヒントを使った数だけ★が減る・棒は水平・式（重さ×きょり）が出る", n1.done && (await page.locator(".verdict .stars .off").textContent()).length === off && (await tilt()).includes("つりあっている") && /左：.*×.*＝/.test(await page.textContent(".verdict .calc")) && (await page.locator(".verdict .tip").count()) === 1); }
  await page.click("#next");
  // 別のタブで先に進んでいたら、古い画面の答えは足さない
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.push({ m: 0, h: 0 }); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await solveNow(page);
  check("別のタブで先に進んでいたら、古い画面の答えは足さず今の問題を出し直す", (await page.evaluate(() => window.__tk.load().runs.d.res.length)) === 2 && (await page.textContent("header")).includes("3/3"));
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.pop(); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload(); await page.click("#go-d");
  { const c2 = await curT(page);
    check("2問目はうで5目盛りで、おもりは10gと20g", c2.p.A === 5 && c2.p.inv.map((x) => x.w).join() === "10,20" && (await page.locator("#kinds button").count()) === 2);
    // 種類のちがうおもりのフックを押すと取りかえる
    const fj = await freeHook(page); await tapHook(page, fj, 1); await tapHook(page, fj, 2);
    check("別の種類を選んでおもりのあるフックを押すと、取りかえる", (await curT(page)).put[fj] === 2 && nPut((await curT(page)).put) === 1);
    await solveNow(page); await page.click("#next");
    const c3 = await curT(page);
    check("3問目はうで6目盛りで、おもりは3種類・×のフックが2つ", c3.p.A === 6 && c3.p.inv.length === 3 && (await page.locator("#hooks button.blk").count()) === 2);
    await solveNow(page); await page.click("#next"); }
  const share = await page.textContent(".share");
  const r3 = await page.evaluate(() => { const g = window.__tk; return g.load().days[g.todayKey()].r; });
  check("3問で結果・シェアの文は番号と色だけ", /てこのつりあい #\d+/.test(share) && /^💡🟩🟩/.test(share.split("\n")[1] || "") && r3.length === 3 && r3[0].m === 0 && r3[0].h === hn);
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("結果に3つのてことおもりの数が出る", (await page.locator(".res div").count()) === 3 && (await page.textContent(".res")).includes(`いちばん少ないと${c.p.d}こ`));
  check("ヒントを使った日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  check("今日の3問を終えると、取れた実績が結果に出る", (await page.textContent(".newach")).includes("はじめてのつりあい"));
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる・つりあわせた数3", (await page.textContent(".stats")).includes("1連続の日") && (await page.textContent(".stats")).includes("3つりあわせた数") && (await page.textContent("#go-d")).includes("結果"));
  // 上級
  await page.click("#go-h");
  check("上級はうで6目盛り・おもり4種類・ヒントのボタンとメーターが無い（数を出さない）", (await page.locator("#hooks button").count()) === 12 && (await page.locator("#kinds button").count()) === 4 && (await page.locator("#hint").count()) === 0 && (await page.locator("#meter").count()) === 0 && !/左 \d/.test(await page.textContent("#left")));
  await solveNow(page); await page.click("#next");
  check("上級の2つ目もうで6目盛り", (await page.locator("#hooks button").count()) === 12);
  await solveNow(page); await page.click("#next");
  check("上級を全部いちばん少ないおもりで初めて終えると、結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1 && (await page.textContent(".big")).includes("いちばん少ない"));
  check("上級を2つともぴったりで終えると、実績「上級に挑む」「上級の科学者」が出る", /上級に挑む/.test(await page.textContent(".newach")) && /上級の科学者/.test(await page.textContent(".newach")));
  await page.click("#back"); await page.click("#go-h");
  check("2回目に結果を開いても Ko-fi のひとことは出ない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  // 練習：答えに、同じ重さのおもりを左右の同じ目盛りに1こずつ足して（つりあいは変わらない）★2
  // 練習の問題は乱数なので、検査では足せる場所がある種を先に選んで練習の回に入れる（検査の期待値を乱数に頼らない）
  const pairOf = (p) => { for (let t = 1; t <= p.inv.length; t++) { if (p.inv[t - 1].n - p.sol.filter((v) => v === t).length < 2) continue; for (let x = 1; x <= p.A; x++) { const a = T.hookOf(p.A, -x), b = T.hookOf(p.A, x), fr = T.freeHooks(p); if (fr.includes(a) && fr.includes(b) && !p.sol[a] && !p.sol[b]) return [[a, t], [b, t]]; } } return null; };
  let pseed = 1; while (!pairOf(T.make(pseed, T.SIZES[0]))) pseed++;
  await page.evaluate(([k, seed]) => { const s = JSON.parse(localStorage.getItem(k)), d = window.__tk.todayKey(); s.runs.p = { mode: "p", date: d, list: [{ lv: 0, seed }], res: [], cur: null, id: "qa" }; localStorage.setItem(k, JSON.stringify(s)); window.__tk.play("p"); }, [KEY, pseed]);
  { const p = (await curT(page)).p, pr = pairOf(p);
    for (const [j, t] of pr) await tapHook(page, j, t);
    for (let j = 0; j < 2 * p.A; j++) if (p.sol[j]) await tapHook(page, j, p.sol[j]);
    await page.click("#answer");
    check("いちばん少ない数より2こ多くつるしてつりあわせると★2（練習）", (await curT(page)).done && (await page.locator(".verdict .stars .off").textContent()).length === 1 && (await page.textContent(".verdict")).includes(`いちばん少ないと${p.d}こ`), JSON.stringify(pr));
    await page.click("#next"); }
  const after = await page.evaluate(() => { const s = window.__tk.load(); return { days: Object.keys(s.days).length, total: s.total, cnt0: s.cnt[0], perf0: s.perf[0] || 0 }; });
  check("練習は今日の記録を増やさず、つりあわせた数とてこ帳には入る（ぴったりでないものは、ぴったりの数に入れない）", after.days === 1 && after.total === 6 && after.cnt0 === 2 && after.perf0 === 0 && (await page.locator(".share").count()) === 0, JSON.stringify(after));
  check("練習の結果から「もう1問」で同じ種類の新しいてこがすぐ始まる（何度でも遊べる）", await (async () => { await page.click("#go-p"); const c = await curT(page); return c && !c.done && (await page.evaluate(() => window.__tk.mode())) === "p" && c.p.A === T.SIZES[0].A; })());
  await page.click("#back"); await page.click("#go-ach");
  { const got = await page.locator(".achs div.got").count(), txt = await page.textContent(".achs");
    check("実績の画面：取れたものは★、まだのものは進み具合（ぴったりの数は今日・上級だけで練習を数えない）", got >= 3 && txt.includes("4/10") && txt.includes("6/100"), `${got} ${txt.slice(0, 80)}`); }
  check("続けて遊んだ日の最長は、日付が1日ずつ続くところだけ数える", await page.evaluate(() => window.__tk.maxStreak({ "2026-01-01": 1, "2026-01-02": 1, "2026-01-04": 1, "2026-01-05": 1, "2026-01-06": 1 }) === 3 && window.__tk.maxStreak({}) === 0));
  await page.click("#back"); await page.click("#go-dex");
  check("てこ帳に種類ごとのつりあわせた数が出る", (await page.locator(".res div").count()) === 4 && (await page.textContent(".res")).includes("2こ") && (await page.textContent("h1")).includes("6こ"));
  await page.close();

  // 4. スマホ幅：はみ出さない・押せる所は44px以上・うで6目盛りでもフックのボタンは幅40px以上
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); const fb2 = await p3.evaluate(() => { const a = document.querySelector("#howto #fb2"); return a ? a.getBoundingClientRect().height : 0; }); check(`幅${w}px：遊び方の「感想を送る」も高さ44px以上`, fb2 >= 44, `${fb2}px`); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id || e.textContent.trim().slice(0, 6)) }));
    check(`幅${w}px：横にはみ出さず、押せる所は高さ44px以上`, homeOk && !r.over && r.small.length === 0, r.small.join(","));
    await p3.click("#back"); await p3.click("#go-p"); await p3.click('.lv button[data-lv="3"]');
    const r7 = await p3.evaluate(() => { const h = [...document.querySelectorAll("#hooks button")].map((e) => e.getBoundingClientRect()); const t = [...document.querySelectorAll("#board svg text")].map((e) => parseFloat(getComputedStyle(e).fontSize) * e.getScreenCTM().a); return { minW: Math.min(...h.map((b) => b.width)), minH: Math.min(...h.map((b) => b.height)), font: Math.min(...t), over: document.documentElement.scrollWidth > innerWidth }; });
    check(`幅${w}px：上級（うで6目盛り）でもフックのボタンは40×44px以上・てこの字は9px以上・はみ出さない`, r7.minW >= 40 && r7.minH >= 44 && r7.font >= 9 && !r7.over, JSON.stringify(r7));
    await p3.close();
  }
  { // 保存してあったつるし方が壊れていたら使わない
    const pv = await newPage(); await pv.click("#howto-ok");
    const broken = await pv.evaluate((k) => {
      const g = window.__tk, d = g.todayKey(), list = g.dailyList(d), p = g.probOf(list[0]), T = g.T;
      const free = T.freeHooks(p), fixJ = T.hookOf(p.A, p.fixed[0].pos), n = 2 * p.A;
      const arr = (pairs) => { const a = Array(n).fill(0); pairs.forEach(([j, v]) => { a[j] = v; }); return a; };
      const over = arr(free.slice(0, p.inv[0].n + 1).map((j) => [j, 1])); // 手もちより多い
      const blk = p.block.length ? arr([[T.hookOf(p.A, p.block[0]), 1]]) : arr([[fixJ, 1]]);
      const cases = [{ put: arr([[fixJ, 1]]), hint: [] }, { put: blk, hint: [] }, { put: arr([[free[0], 9]]), hint: [] }, { put: arr([]).slice(1), hint: [] }, { put: over, hint: [] }, { put: arr([]), hint: [[free[0], 1]], hints: 1 }, { put: arr([[free[0], 1]]), hint: [[free[0], 1], [free[0], 1]], hints: 2 }, { put: arr([[free[0], 1]]), hint: [[99, 1]], hints: 1 }, { put: "x", hint: [] }];
      const out = cases.map((cc) => g.valid(p, Object.assign({ hints: 0, moves: 1 }, cc)));
      out.push(!g.valid(p, { put: arr([[free[0], 1]]), hint: [[free[0], 1]], hints: 1, moves: 2 })); // 正しいものは使う（反対にして並べる）
      localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list, res: [], cur: { i: 0, put: arr([[fixJ, 1]]), hint: [], hints: 1, moves: 3 }, id: "a" } } }));
      return out; }, KEY);
    await pv.reload(); await pv.click("#go-d");
    check("壊れた途中経過（はじめからのおもり・×のフックにつるす・種類の番号がちがう・形がちがう・手もちより多い・ヒントのフックにおもりが無い・同じヒント2回・外のフック・型がちがう）は使わず、はじめから", broken.every((x) => x === false) && nPut((await curT(pv)).put) === 0 && (await curT(pv)).hints === 0, JSON.stringify(broken));
    await pv.close(); }
  { // 別のタブで同じ問題のヒントが多く保存されていたら、古いタブで届けても多いほうを記録する
    const pz = await newPage(); await pz.click("#howto-ok"); await pz.click("#go-d");
    await pz.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)), p = window.__tk.cur().p; s.runs.d.cur = { i: 0, put: Array(2 * p.A).fill(0), hint: [], hints: 2, moves: 999 }; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    await solveNow(pz);
    const rz = await pz.evaluate(() => window.__tk.load().runs.d.res[0]);
    check("別のタブで保存したヒントの数を、古いタブで届けても消さない（★を増やさない）", rz && rz.m === 0 && rz.h === 2 && (await pz.locator(".verdict .stars .off").textContent()).length === 2, JSON.stringify(rz));
    await pz.close(); }
  { // 同じ回数で古いタブが保存しても、保存済みのヒントのおもりと数を消さない（2026-11-05 CodeRabbit）
    const py = await newPage(); await py.click("#howto-ok"); await py.click("#go-d");
    const fc = await freeHook(py);
    const hj = await py.evaluate(([k, fj]) => { const s = JSON.parse(localStorage.getItem(k)), p = window.__tk.cur().p, hj = window.__tk.T.freeHooks(p).find((j) => j !== fj); const put = Array(2 * p.A).fill(0); put[hj] = 1; s.runs.d.cur = { i: 0, put, hint: [[hj, 1]], hints: 1, moves: 1 }; localStorage.setItem(k, JSON.stringify(s)); return hj; }, [KEY, fc]);
    await tapHook(py, fc, 1);
    const ry = await py.evaluate(() => window.__tk.load().runs.d.cur);
    check("同じ回数で古いタブが保存しても、保存済みのヒントのおもりと数を残す（上書きしない）", ry && ry.hints === 1 && ry.moves === 1 && ry.hint.length === 1 && nPut(ry.put) === 1 && ry.put[hj] === 1, JSON.stringify(ry));
    { // 古いタブで手数が保存済みを超えても、保存済みのヒントのおもりは消さない（2026-11-05 CodeRabbit）
      const fc2 = await freeHook(py); await tapHook(py, fc2, 1); await tapHook(py, fc2, 1);
      const rw = await py.evaluate(() => ({ s: window.__tk.load().runs.d.cur, c: window.__tk.cur() }));
      check("古いタブで手数が保存済みを超えても、保存済みのヒントのおもりと数を消さない（画面にも写す）", rw.s.moves >= 2 && rw.s.hints === 1 && rw.s.hint.length === 1 && rw.s.put[rw.s.hint[0][0]] === rw.s.hint[0][1] && rw.c.hint.length === 1, JSON.stringify(rw.s)); }
    await py.close(); }
  { // 保存できないブラウザでも遊べる
    const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pb.on("pageerror", (e) => errors.push(e.message));
    await pb.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
    await pb.goto(url); await pb.click("#howto-ok"); await pb.click("#go-d");
    await tapHook(pb, await freeHook(pb), 1);
    check("保存できないブラウザでも、今日の1問目でおもりをつるせる", (await pb.textContent("header")).includes("1/3") && nPut((await curT(pb)).put) === 1);
    await solveNow(pb);
    check("保存できないブラウザでも、1問目を届けられる", (await curT(pb)).done);
    await pb.click("#back");
    check("保存できないブラウザでも、遊び方が何度も開かない", !(await pb.locator("#howto[open]").count()));
    await pb.close(); }
  { // 前の記録が残っていて、書き込みだけ失敗するとき
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pq.on("pageerror", (e) => errors.push(e.message));
    await pq.addInitScript(() => { const orig = Storage.prototype.setItem; orig.call(localStorage, "teko-tsuriai-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: {} })); Storage.prototype.setItem = () => { throw new Error("full"); }; });
    await pq.goto(url); await pq.click("#go-d");
    check("前の記録があり書き込みだけ失敗しても、今日の1問目が始まる", (await pq.textContent("header")).includes("1/3"));
    await pq.close(); }
  { const pc = await newPage();
    await pc.evaluate((k) => { const g = window.__tk, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pc.reload();
    check("最後の1問のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__tk; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  { const pm = await newPage();
    await pm.evaluate((k) => { const g = window.__tk, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pm.reload();
    const had = await pm.locator("#go-h").count();
    await pm.evaluate(() => { const RD = Date, off = 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; });
    if (had) await pm.click("#go-h");
    check("結果を開いたまま日付が変わったら、上級のボタンを押しても翌日の上級は始まらない", had > 0 && (await pm.evaluate(() => window.__tk.mode())) !== "h");
    await pm.close(); }
  { const pn = await newPage();
    await pn.evaluate((k) => { const g = window.__tk, d = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: {}, perf: {}, total: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, h: 0 })), id: "a" } } })); }, KEY);
    await pn.reload();
    check("前の日に終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__tk; return !!g.load().days[new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10)] && !g.load().runs.d; }));
    check("前の日の結果の画面からは、今日の上級を始められない（今日の分を先に）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, KEY));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残し、てこ帳の数は多いほう", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": 1 }, cnt: { 0: 9 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 }, cnt: { 0: 2 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"] && r.cnt["0"] === 9; }, KEY));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, lv: 0, idx: 0 }], id: "x", res: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: { d: Object.assign({}, base) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: { d: Object.assign({}, base, { res: [{ m: 0, h: 0 }] }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（その日を終えた記録があれば null を使う・終えた回は日ごとの結果に残す）", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b, dd) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }, dd ? { days: Object.assign({}, s0.days, dd) } : {}))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }, { "2000-01-01": 1 }), r3 = put({ d: base }, { d: null }), r4 = put({ d: done }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null && !!r3.runs.d && r3.runs.d.date === "2000-01-01" && r4.runs.d === null && !!r4.days["2000-01-01"]; }, KEY));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, KEY));
    check("同じ問題の途中経過を読み合わせるとき、ヒントの数だけでなくヒントのおもりも残す（2026-11-05 CodeRabbit）", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], id: "x", res: [] }, cu = (h, mv) => { const put = [0, 0, 0, 0, 0, 0]; const hint = []; if (h) { put[4] = 2; hint.push([4, 2]); } return { i: 0, put, hint, hints: h, moves: mv }; }; const run = (ma, mb) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: Object.assign({}, base, { cur: cu(1, ma) }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { cur: cu(0, mb) }) } }))); const r = g.load(); mem = null; return r.runs.d.cur; }; return [run(4, 4), run(4, 6)].every((c) => c.hints === 1 && c.hint.length === 1 && c.put[4] === 2); }, KEY));
    check("別のフックでヒントを使った2つのタブを読み合わせても、数とフックがそろい、2つまでに収まる（2026-11-05 CodeRabbit）", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], id: "x", res: [] }, cu = (hs, mv) => { const put = [0, 0, 0, 0, 0, 0]; for (const [j, v] of hs) put[j] = v; return { i: 0, put, hint: hs.map((x) => x.slice()), hints: hs.length, moves: mv }; }; const run = (ca, cb) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: Object.assign({}, base, { cur: cu(ca, 4) }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { cur: cu(cb, 4) }) } }))); const r = g.load(); mem = null; return r.runs.d.cur; }; const two = run([[4, 1]], [[1, 2]]), three = run([[4, 1], [0, 1]], [[1, 2]]); const ok = (c) => c.hints === c.hint.length && c.hint.length <= 2 && c.hint.every(([j, v]) => c.put[j] === v); return ok(two) && two.hints === 2 && ok(three) && three.hints === 2; }, KEY));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, KEY));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, KEY));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, KEY));
    check("進み具合は終えた問題の数を先に比べる（おもりを動かした回数が多くても、終えた問題のある記録を消さない）", await pn.evaluate((K) => { const g = window.__tk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, lv: 0, idx: 0 }, { seed: 2, lv: 0, idx: 1 }], id: "x" }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { res: [], cur: { i: 0, put: [], hint: [], hints: 0, moves: 1500 } }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: Object.assign({}, base, { res: [{ m: 0, h: 0 }], cur: null }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    { // できたときの確かめ（1回目の読み）と保存の読み直し（2回目）のあいだに別のタブが新しい回を保存した状態を作り、できた画面が出ないことを動きで見る（2026-11-05 CodeRabbit）
      await pn.evaluate(() => { location.hash = ""; }); await pn.reload(); await pn.click("#go-p"); await pn.click('.lv button[data-lv="0"]');
      const r = await pn.evaluate((K) => { const g = window.__tk, c = g.cur(); const sol = g.T.solve(c.p, null, 10).put; c.put = sol.slice(); const orig = Storage.prototype.getItem; let n = 0; Storage.prototype.getItem = function (k) { const v = orig.call(this, k); if (k !== K || ++n < 2) return v; const s = JSON.parse(v); s.runs.p = Object.assign({}, s.runs.p, { id: "other-tab" }); return JSON.stringify(s); }; try { g.deliver(); } finally { Storage.prototype.getItem = orig; } return { n, verdict: !!document.querySelector(".verdict"), done: g.cur().done }; }, KEY);
      check("できたときに別のタブで回が変わって保存できなかったら、できた画面を出さない", r.n >= 2 && !r.verdict && !r.done, JSON.stringify(r)); }
    await pn.evaluate(() => { location.hash = ""; }); await pn.reload(); await pn.click("#go-p"); await pn.click('.lv button[data-lv="3"]');
    check("練習の上級も、ヒントのボタンとメーターが無い", (await pn.locator("#hint").count()) === 0 && (await pn.locator("#meter").count()) === 0 && (await pn.evaluate(() => window.__tk.cur().hard)) === true);
    await pn.close(); }
  { // 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
    const sample = { "teko-tsuriai-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-04": { m: [0, 1, 0] } }, hdays: {}, cnt: { 0: 3, 1: 2 }, perf: {}, total: 5, runs: {}, kofi: {}, ach: {}, t: 1 }) };
    await checkTransfer({ browser, url, game: "teko-tsuriai", sample, check, open: async (page) => { await page.evaluate(() => { const d = document.getElementById("howto"); if (d.open) d.close(); }); } });
  }
} catch (e) {
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  if (browser) await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));
{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し。routines/game-dev.md「だれでも遊べるように」）
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}


const ng = results.filter((r) => !r.ok);
const md = `# てこのつりあい QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
