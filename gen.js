// てこのつりあい：棒の目盛り（フック）におもりをつるして、棒を水平につりあわせる。make(seed, L) が種から問題を作り、solve がいちばん少ないおもりの数を数える。
(function (root) {
  "use strict";
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 種類：うでの長さ A（支点から1〜A の目盛り）・はじめからのおもりの数 fixed・手もちのおもり inv（重さ g と数）・使えないフック block・いちばん少ないおもりの数 min
  const SIZES = [
    { name: "はじめのてこ", A: 4, fixed: [1, 1], inv: [[10, 3]], block: 0, min: [1, 2] },
    { name: "重さちがい", A: 5, fixed: [2, 2], inv: [[10, 2], [20, 2]], block: 1, min: [2, 3] },
    { name: "両うで", A: 6, fixed: [2, 3], inv: [[10, 2], [20, 2], [30, 2]], block: 2, min: [2, 4] },
  ];
  const HARD = { name: "上級", A: 6, fixed: [3, 4], inv: [[10, 2], [20, 2], [30, 1], [50, 1]], block: 3, min: [3, 5] };
  // フックの番号 j（0〜2A-1）と目盛り：左うでは -A〜-1、右うでは 1〜A（左が負）
  const posOf = (A, j) => (j < A ? j - A : j - A + 1);
  const hookOf = (A, pos) => (pos < 0 ? pos + A : pos + A - 1);
  // put[j]：0 はなし、k+1 は inv[k] のおもり。てこを傾けるはたらき（重さ×きょり）を左右で数える
  function moments(p, put) {
    let L = 0, R = 0;
    const add = (w, pos) => { if (pos < 0) L += w * -pos; else R += w * pos; };
    for (const f of p.fixed) add(f.w, f.pos);
    if (put) put.forEach((v, j) => { if (v) add(p.inv[v - 1].w, posOf(p.A, j)); });
    return { L, R };
  }
  const balanced = (p, put) => { const m = moments(p, put); return m.L === m.R; };
  const count = (put) => put.filter(Boolean).length;
  // 置けるフック：はじめからのおもりも、使えない印も無いところ
  const freeHooks = (p) => { const out = []; for (let j = 0; j < 2 * p.A; j++) { const pos = posOf(p.A, j); if (!p.fixed.some((f) => f.pos === pos) && !p.block.includes(pos)) out.push(j); } return out; };
  // いちばん少ないおもりの数と置き方の1つ。fixed は動かせないおもり（ヒントで置いたもの、数に入れない）。max を超えたら null
  function solve(p, fixed, max = 8) {
    const n = 2 * p.A, put = new Array(n).fill(0), left = p.inv.map((x) => x.n);
    if (fixed) fixed.forEach((v, j) => { if (v) { put[j] = v; left[v - 1]--; } });
    if (left.some((x) => x < 0)) return null;
    const hooks = freeHooks(p).filter((j) => !put[j]);
    const m0 = moments(p, put), need0 = m0.R - m0.L; // 左うで（負）に置くと need が減る向きで数える：右 − 左 を 0 にする
    const wmax = Math.max(...p.inv.map((x) => x.w));
    let found = null;
    function rec(start, k, diff) {
      if (k === 0) { if (diff === 0) { found = put.slice(); return true; } return false; }
      if (Math.abs(diff) > k * wmax * p.A) return false;
      for (let i = start; i < hooks.length; i++) {
        const j = hooks[i], pos = posOf(p.A, j);
        for (let t = 0; t < p.inv.length; t++) {
          if (!left[t]) continue;
          left[t]--; put[j] = t + 1;
          if (rec(i + 1, k - 1, diff + p.inv[t].w * pos)) return true;
          put[j] = 0; left[t]++;
        }
      }
      return false;
    }
    for (let k = 0; k <= max; k++) if (rec(0, k, need0)) return { d: k, put: found };
    return null;
  }
  // 問題を作る：はじめからのおもり・使えないフック・手もちを決め、いちばん少ない数が min の幅に入る候補を4つまで集め、いちばん多く要るものを選ぶ（同じなら先のもの）
  function make(seed, L) {
    const R = rng(seed), W = [10, 20, 30];
    let best = null, got = 0;
    for (let t = 0; t < 800 && got < 4; t++) {
      const A = L.A, used = new Set(), fixed = [];
      const nf = L.fixed[0] + Math.floor(R() * (L.fixed[1] - L.fixed[0] + 1));
      for (let k = 0; k < nf; k++) {
        let pos; do { pos = (1 + Math.floor(R() * A)) * (R() < 0.5 ? -1 : 1); } while (used.has(pos));
        used.add(pos); fixed.push({ pos, w: W[Math.floor(R() * W.length)] });
      }
      const block = [];
      for (let k = 0; k < L.block; k++) {
        let pos, g = 0; do { pos = (1 + Math.floor(R() * A)) * (R() < 0.5 ? -1 : 1); g++; } while (used.has(pos) && g < 50);
        if (used.has(pos)) break; used.add(pos); block.push(pos);
      }
      fixed.sort((a, b) => a.pos - b.pos); block.sort((a, b) => a - b);
      const p = { A, fixed, block, inv: L.inv.map(([w, n]) => ({ w, n })), name: L.name };
      if (balanced(p, null)) continue;
      const s = solve(p, null, L.min[1]);
      if (!s || s.d < L.min[0]) continue;
      p.d = s.d; p.sol = s.put; got++;
      if (!best || p.d > best.d) best = p;
    }
    return best;
  }
  const B = { rng, seedOf, SIZES, HARD, posOf, hookOf, moments, balanced, count, freeHooks, solve, make };
  if (typeof module !== "undefined") module.exports = B; else root.TKO = B;
})(this);
