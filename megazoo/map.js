/* 메가주 2026 시즌2 길잡이(비공식) — 도식 지도 + 동선 추천. window.MZMap
   위치는 부스 번호 규칙 · 손으로 적은 작은 상수 표 · 우리 도식 단위로 옮긴 부스 발자국 표로만 정한다.
   공식 좌표 · 도면 · 통행 격자 데이터는 싣지 않는다. 지도 단위: 부스 한 줄 깊이 = 10, 실제 거리(m)는 쓰지 않는다. */
(function (root) {
  'use strict';

  /* ── 1. 상수 표 ─────────────────────────────────────────────
     섬 순서(왼쪽부터 0~24): 21(벽) 22 … 26 | 31 … 36 | 41 … 46 | 51 … 56 57(벽)
     부스 번호: 첫 자리 홀 · 둘째 자리 홀 안의 줄 · 끝 두 자리 = 입구 쪽부터 01~57.
     같은 높이의 두 번호(1·2, 3·4 …)가 섬 하나의 한 줄 — 홀수 왼쪽 반, 짝수 오른쪽 반. 57 = 맨 안쪽 벽 부스. */
  var ROW = 10, HALF = 7.5, PITCH = 25, TOPH = 7.5, FRONT = 16, FW = 605;
  // 가로 통로 — [이 줄 바로 위, 너비]. 줄 r = 끝 두 자리 (2r-1, 2r)
  // 56|57 · 50|51 · 46|47 · 40|41 · 30|31(가장 넓다) · 22|23 · 16|17 · 10|11
  var AISLE = [[28, 10], [25, 10], [23, 10], [20, 10], [15, 18], [11, 10], [8, 10], [5, 10]];
  // 맨 아래(입구 쪽) 가로 통로 — 2·3홀은 4|5 사이, 4·5홀은 6|7 사이
  var LOW = { a: 2, b: 3 };
  // [가정] 홀과 홀 사이는 모든 가로 통로 높이에서 건널 수 있다. 막혀 있으면 건널 수 있는 통로 이름만 적는다(예: ['A1','A5','AF'])
  var HALL_CROSS = null;
  // 발자국 표에 없는 벽 줄(21 · 57) 번호: 아래 끝 = WALL_B0 - WALL_STEP × 번호
  var WALL_B0 = 407.5, WALL_STEP = 10.7, WALL_MAX = 34;
  // 경기도 공동관 G-01~26 — 4·5홀 사이 가운데 섬(46 · 51 · 52번 줄 자리, 31~40번 높이). 세 줄, 아래부터 두 번호씩(홀수 왼쪽)
  var G_Y = [168.75, 161.25, 153.75, 142.5, 135, 127.5], G_H = 7.5;
  var G_COLS = [{ i: 17, from: 1, rows: [0, 1, 2, 4, 5] }, { i: 18, from: 11, rows: [3, 4, 5] }, { i: 19, from: 17, rows: [0, 1, 2, 4, 5] }];
  // ART-01~04 — 4홀 1번 줄 왼쪽 반, 17~22번 높이의 위쪽(04가 안쪽)
  var ART_I = 12, ART_H = 5;
  // 섬 자리를 차지한 곳 — [이름, 섬 i0, i1, 줄 r0(아래), r1(위), 종류]. 'cafe' · 'meet' 는 그 사이 세로 통로까지 막는다
  var ROOMS = [
    ['카페테리아', 11, 13, 21, 23, 'cafe'],
    ['카페테리아', 18, 20, 9, 11, 'cafe'],
    ['카페테리아', 11, 13, 7, 8, 'cafe'],
    ['비즈니스\n상담회장', 11, 13, 1, 6, 'meet'],
    ['카페', 6, 6, 9, 11, 'cafe1'],
    ['멍드컵', 7, 7, 9, 11, 'cup']
  ];
  // 반려동물 화장실 — 배치도의 초록 표시. {i: 섬, r: 줄} 또는 {x, y}
  var WCS = [{ x: 24, y: 396 }, { i: 6, r: 21 }, { i: 11, r: 23 }, { i: 18, r: 21 }, { i: 18, r: 11 }, { x: 601.25, y: 292 }];
  /* 부스 발자국(우리 도식 단위) — 메가주 공식 배치도 11.17판에서 옮김(2026-11-19). 줄(번호 앞 두 자리)마다 낱말 하나가 부스 하나:
     NN[쪽][높이] — 쪽 L 왼쪽 반 · R 오른쪽 반 · B 섬 전체(없으면 홀수 L · 짝수 R), 높이 = 번호 줄부터 위로 몇 줄(없으면 1).
     NN[쪽]=y0~y1 — 세로 범위를 그대로(벽 줄 · 56번 줄 아래 끝). 57=x0~x1 — 맨 안쪽 벽 부스의 가로 범위. */
  var FOOT = {
    '21': '01=345.5~395.5 06=303~343 10=274.5~303 13=227~268.5 17=175~225 22=155~175 24=132.5~152.5 26=112.5~132.5 28=88.5~108.5 30=47.5~88.5 34=7.5~47.5',
    '22': '012 022 052 06 082 09 11 12 132 142 17 18 19 202 21 234 24 26 282 314 322 362 39 40 412 422 45 46 47 48 49 50 513 523 57=10~49',
    '23': '01B2 052 062 09 10 112 12 142 15 172 182 21 22 23 242 253 282 313 323 372 38 40 41B2 45 46 47 48 49 50 512 522 55 56',
    '24': '01B2 052 06 08 09 10 11 12 13B2 17 183 19 21 234 242 27R2 313 324 372 40 41B3 47 48 49 50 512 52 54 55 56 57=49~97.5',
    '25': '01B2 05B2 09 10 112 12 142 15 172 18 20 21 22 23B4 313 324 37 39 40 41 42 432 442 47 48 49 50 512 52 54 55 56',
    '26': '01B2 052 06 082 09 112 12 14 15 16 17B3 23 243 253 30 31B2 353 363 412 422 45 46 47 482 49 512 52 54 55 56 57=101~131',
    '31': '01B2 05 06 072 08 10 112 122 15 16 23B4 31B2 353 363 43 442 45 47 48 49 50 512 52 54 55 56 57=131~161',
    '32': '01B2 052 06 082 09 112 12 142 15 23 24 25B3 31B3 372 382 412 42 442 45 47 48 49 50 512 52 542 55 57=163.5~202.5',
    '33': '01B2 05B2 09 10 113 122 16 17 182 192 22 23 242 25 272 282 31B3 372 382 412 422 45 46 47 482 49 51 523 532',
    '34': '012 022 05 063 07 09 11B2 15 16 17 182 192 22 232 24 26 27B2 31B5 41B2 45 46 47B2 512 52 542 55 57=202.5~240.5',
    '35': '012 02 04 052 062 09 10 11B3 17 18 19 20 21 22 23 24 25B3 31B5 41B3 47 48 49 50 51 52 53 54 55 56',
    '36': '17B3 23B4 312 325 353 47B2 513 523 57=244~293.5',
    '41': '20 232 24 263 272 31B2 37 38 39 40 47 48 49 50 51 52 53B2',
    '42': '17 183 19 21 23B4 31B2 37 38 39 40 47B2 51 522 532 56 57=296~336',
    '43': '01B3 07B2 11 122 13 15 16 17 18 192 20 22 234 244 31B2 37B2 41B3 47B2 513 523 57=336~372.5',
    '44': '013 023 07 082 09 11 12 13 14 15 16 17B3 23B2 27B2 31B5 413 423 47 48 49 50 51 52 532 542',
    '45': '01B2 05 06 07 08 09 10 112 12 142 15 17 182 192 22 232 242 272 282 31B5 41 422 432 46 47 48 49 50 512 52 54 55 56 57=376~415.5',
    '46': '01B2 05 06 07 08 09 10 112 122 15 16 17B3 232 244 272 41B3 47 48 49 50 51 522 532 56 57=415.5~455',
    '51': '01B2 05 06 07 08 09 10 112 12 142 15 23B4 432 44 46 47 48 49 50 51 52 532 542',
    '52': '01B2 05 06 07 08 09 10 112 12 142 15 234 24 26 282 41 422 432 46 47 48 49 50 512 52 542 55 57=457.5~507.5',
    '53': '012 022 05 06 07 08 09 10 11B2 15 16 232 24 26 27B2 312 324 353 40 412 422 45 46 47 48 49 50 51 522 53 55 56',
    '54': '01B3 07 08 09 10 112 12 142 15 172 182 21 22 23 24 25 263 272 31B2 352 363 39 413 422 46 47 48 49 50 512 52 542 55 57=507.5~537',
    '55': '012 022 05 06 072 08 10 112 122 15 16 172 182 21 22 232 24 26 272 282 31B2 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 532 542 57=540.5~569',
    '56': '01=355.5~395.5 05=335.5~355.5 07R=328~335.5 112 123 15 17 18 192 20 22 233 24 263 29 31B2 37 38 39 40 41 422 432 46 47 48 49 50 51 522 532 56 57=569~597.5',
    '57': '08=298~328 11=268~286.5 13=237~268 16=193~233 20=163.5~193 23=130~160 26=110~130 28=86~106 30=65~86 32=42.5~62.5 34=12.5~42.5'
  };
  // 옆 통로를 가로막고 벽까지 이어진 부스 — 오른쪽 끝 x, 위 가로 통로(A8)에서 들어간다
  var TOP_ENTRY = { '5607': [597.5, 7] };
  var TURN = 2; // 꺾을 때마다 더하는 작은 값 — 길이가 같으면 덜 꺾는 길

  /* ── 2. 상수에서 나오는 값 ── */
  function ix(i) { return i === 0 ? 0 : i === 24 ? FW - HALF : 20 + (i - 1) * PITCH; }
  function iw(i) { return i === 0 || i === 24 ? HALF : 2 * HALF; }
  function hallOfI(i) { return i >= 24 ? 5 : 2 + Math.floor(i / 6); }
  function grp(h) { return h <= 3 ? 'a' : 'b'; }
  var VX = [];
  for (var k = 0; k < 24; k++) VX.push(k === 0 ? 13.75 : k === 23 ? 591.25 : 40 + (k - 1) * PITCH);
  var HALLS = [[2, 0, VX[5]], [3, VX[5], VX[11]], [4, VX[11], VX[17]], [5, VX[17], FW]];
  var BOUND = [5, 11, 17];
  var RT = { a: [], b: [] }, HL = [], BLOCKS = { a: [], b: [] }, BOT = 0;
  ['a', 'b'].forEach(function (g) {
    var y = TOPH, n = 0, top = 28;
    for (var r = 28; r >= 1; r--) {
      var w = r === LOW[g] ? ROW : 0;
      AISLE.forEach(function (a) { if (a[0] === r) w = a[1]; });
      if (w) {
        var low = r === LOW[g];
        if (!low) n++;
        if (r !== 28) { BLOCKS[g].push([r + 1, top]); top = r; }
        if (g === 'a' || low) HL.push({ id: low ? 'A9' + g : 'A' + n, y: y + w / 2, k0: low && g === 'b' ? 13 : 0, k1: low ? (g === 'a' ? 10 : 22) : 23 });
        y += w;
      }
      RT[g][r] = y;
      y += ROW;
    }
    BLOCKS[g].push([1, top]);
    BOT = y;
  });
  var AF_Y = BOT + 5.5, WALL_Y = BOT + FRONT;
  HL.push({ id: 'AF', y: AF_Y, k0: 0, k1: 22 });
  var AF_I = HL.length - 1, A1_I = 0;
  function rowTop(i, r) { return RT[grp(hallOfI(i))][r]; }
  function roomRect(m) { return [ix(m[1]), rowTop(m[1], m[4]), ix(m[2]) + iw(m[2]), rowTop(m[1], m[3]) + ROW]; }
  var WALLS = ROOMS.filter(function (m) { return m[5] === 'cafe' || m[5] === 'meet'; }).map(roomRect);
  // 입구 넷 — 모두 01 쪽(아래) 벽. 2·3홀은 3|4번 줄 사이 통로 앞, 4·5홀은 4번 줄 앞
  var ENT = [
    { id: 'E2', label: '2홀 입구', x: VX[2] },
    { id: 'E3', label: '3홀 입구', x: VX[8] },
    { id: 'E4', label: '4홀 입구', x: ix(15) + HALF },
    { id: 'E5', label: '5홀 입구', x: ix(21) + HALF }
  ];
  ENT.forEach(function (e) { e.y = WALL_Y; });
  function hallOfX(x) { for (var j = 0; j < 4; j++) if (x < HALLS[j][2]) return HALLS[j][0]; return 5; }

  /* ── 3. 부스 번호 → 발자국 ── */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function parse(id) {
    var s = String(id == null ? '' : id).trim().toUpperCase().replace(/\s+/g, ''), m;
    if ((m = /^([2-5])([1-7])(\d\d)$/.exec(s))) {
      var h = +m[1], c = +m[2], n = +m[3], i = (h - 2) * 6 + c - 1;
      if (c === 7 && h !== 5) return null;
      if (n < 1 || n > 57 || ((i === 0 || i === 24) && n > WALL_MAX)) return null;
      return { t: 'n', key: s, h: h, c: c, n: n, i: i };
    }
    if ((m = /^G-?(\d\d?)$/.exec(s)) && +m[1] >= 1 && +m[1] <= 26) return { t: 'g', key: 'G-' + pad2(+m[1]), n: +m[1] };
    if ((m = /^ART-?(\d\d?)$/.exec(s)) && +m[1] >= 1 && +m[1] <= 4) return { t: 'art', key: 'ART-' + pad2(+m[1]), n: +m[1] };
    if ((m = /^E([2-5])$/.exec(s))) return { t: 'e', key: s };
    return null;
  }
  var FP = null, ALL = null;
  function foot(key) {
    if (!FP) {
      FP = {}; ALL = [];
      Object.keys(FOOT).forEach(function (col) {
        FOOT[col].split(' ').forEach(function (t) {
          var m = /^(\d\d)([LRB]?)(\d?)(?:=([\d.]+)~([\d.]+))?$/.exec(t);
          if (!m) return;
          FP[col + m[1]] = { s: m[2], h: m[3] ? +m[3] : 1, a: m[4] != null ? +m[4] : null, b: m[5] != null ? +m[5] : null };
          ALL.push(col + m[1]);
        });
      });
      for (var j = 1; j <= 26; j++) ALL.push('G-' + pad2(j));
      for (j = 1; j <= 4; j++) ALL.push('ART-' + pad2(j));
    }
    return FP[key];
  }
  function cellOf(p) {
    if (!p) return null;
    var c, i;
    if (p.t === 'e') {
      var e = ENT.filter(function (q) { return q.id === p.key; })[0];
      return { x: e.x, y: WALL_Y, w: 0, h: 0, ent: e.id };
    }
    if (p.t === 'n') {
      var F = foot(p.key);
      i = p.i;
      if (i === 0 || i === 24) {
        var y0 = F && F.a != null ? F.a : WALL_B0 - WALL_STEP * (p.n + 1), y1 = F && F.a != null ? F.b : y0 + WALL_STEP;
        c = { x: ix(i), y: y0, w: HALF, h: y1 - y0, kind: 'wall' };
      } else if (p.n === 57) {
        var x0 = F && F.a != null ? F.a : ix(i) + HALF - 10, x1 = F && F.a != null ? F.b : x0 + 20;
        c = { x: x0, y: 0, w: x1 - x0, h: TOPH, hl: A1_I, kind: 'top' };
      } else {
        var side = F && F.s ? F.s : p.n % 2 ? 'L' : 'R', g = grp(p.h), an = Math.ceil(p.n / 2), top, bot;
        if (F && F.a != null) { top = F.a; bot = F.b; } else { top = RT[g][Math.min(28, an + (F ? F.h : 1) - 1)]; bot = RT[g][an] + ROW; }
        c = { x: ix(i) + (side === 'R' ? HALF : 0), y: top, w: side === 'B' ? 2 * HALF : HALF, h: bot - top, side: side, kind: 'isl' };
        if (TOP_ENTRY[p.key]) { c.w = TOP_ENTRY[p.key][0] - c.x; c.hl = TOP_ENTRY[p.key][1]; }
      }
      c.col = p.c;
      c.real = !!F;
    } else if (p.t === 'g') {
      var gc = G_COLS[p.n <= 10 ? 0 : p.n <= 16 ? 1 : 2], j = p.n - gc.from, sd = j & 1;
      i = gc.i;
      c = { x: ix(i) + sd * HALF, y: G_Y[gc.rows[j >> 1]], w: HALF, h: G_H, side: sd ? 'R' : 'L', kind: 'g', real: true };
    } else {
      i = ART_I;
      c = { x: ix(i), y: rowTop(i, 11) + (4 - p.n) * ART_H, w: HALF, h: ART_H, side: 'L', kind: 'art', real: true };
    }
    c.i = i;
    c.hall = p.t === 'n' ? p.h : hallOfX(c.x + c.w / 2);
    return c;
  }
  function inWall(x, y) {
    for (var j = 0; j < WALLS.length; j++) { var b = WALLS[j]; if (x > b[0] && x < b[2] && y > b[1] && y < b[3]) return true; }
    return false;
  }
  // 부스에 붙는 통로 위 점들(섬 전체 부스는 양쪽) — 막힌 쪽은 뺀다
  function attachesOf(c) {
    if (!c || c.ent) return [];
    var cy = c.y + c.h / 2, out = [];
    if (c.hl != null) return [{ x: c.x + c.w / 2, y: HL[c.hl].y, h: c.hl }];
    var ks = c.kind === 'wall' ? [c.i === 0 ? 0 : 23] : c.side === 'L' ? [c.i - 1] : c.side === 'R' ? [c.i] : [c.i - 1, c.i];
    ks.forEach(function (k) { if (!inWall(VX[k], cy)) out.push({ x: VX[k], y: cy, v: k }); });
    if (!out.length && (c.side === 'L' || c.side === 'R')) {
      var k2 = c.side === 'L' ? c.i : c.i - 1;
      if (!inWall(VX[k2], cy)) out.push({ x: VX[k2], y: cy, v: k2 });
    }
    return out;
  }
  var LC = {};
  function locOf(id) {
    var p = parse(id);
    if (!p) return null;
    if (!(p.key in LC)) LC[p.key] = cellOf(p);
    return LC[p.key];
  }
  function locate(id) {
    var c = locOf(id);
    return c ? { x: c.x, y: c.y, w: c.w, h: c.h, hall: c.ent ? +c.ent[1] : c.hall, cx: c.x + c.w / 2, cy: c.y + c.h / 2 } : null;
  }

  /* ── 4. 통로 그래프 · 최단 경로 ── */
  function segBlocked(x1, y1, x2, y2) {
    var a = Math.min(x1, x2), b = Math.max(x1, x2), c = Math.min(y1, y2), d = Math.max(y1, y2), e = 1e-6;
    for (var j = 0; j < WALLS.length; j++) {
      var w = WALLS[j];
      if (b > w[0] + e && a < w[2] - e && d > w[1] + e && c < w[3] - e) return true;
    }
    return false;
  }
  function crossBlocked(hid, x1, x2) {
    if (!HALL_CROSS || HALL_CROSS.indexOf(hid) >= 0) return false;
    var a = Math.min(x1, x2), b = Math.max(x1, x2);
    for (var j = 0; j < BOUND.length; j++) { var x = VX[BOUND[j]]; if (a < x + 1e-6 && b > x + 1e-6) return true; }
    return false;
  }
  function buildGraph(extra) {
    var X = [], Y = [], adj = [], key = {};
    function node(x, y) {
      var kk = x.toFixed(2) + ',' + y.toFixed(2);
      if (key[kk] == null) { key[kk] = X.length; X.push(x); Y.push(y); adj.push([]); }
      return key[kk];
    }
    function link(a, b, dir) {
      if (a === b) return;
      var d = Math.abs(X[a] - X[b]) + Math.abs(Y[a] - Y[b]);
      adj[a].push(b, d, dir); adj[b].push(a, d, dir);
    }
    var vl = VX.map(function () { return []; }), hl = HL.map(function () { return []; }), ent = {};
    HL.forEach(function (h, hi) { for (var k = h.k0; k <= h.k1; k++) { var n = node(VX[k], h.y); hl[hi].push(n); vl[k].push(n); } });
    ENT.forEach(function (e) { var a = node(e.x, AF_Y), b = node(e.x, WALL_Y); hl[AF_I].push(a); link(a, b, 1); ent[e.id] = b; });
    extra.forEach(function (p) { p.node = node(p.x, p.y); (p.v != null ? vl[p.v] : hl[p.h]).push(p.node); });
    function chain(list, byX, hid) {
      list = list.filter(function (v, j) { return list.indexOf(v) === j; });
      list.sort(function (a, b) { return byX ? X[a] - X[b] : Y[a] - Y[b]; });
      for (var j = 1; j < list.length; j++) {
        var a = list[j - 1], b = list[j];
        if (segBlocked(X[a], Y[a], X[b], Y[b]) || (byX && crossBlocked(hid, X[a], X[b]))) continue;
        link(a, b, byX ? 0 : 1);
      }
    }
    vl.forEach(function (l) { chain(l, false); });
    hl.forEach(function (l, hi) { chain(l, true, HL[hi].id); });
    return { X: X, Y: Y, adj: adj, ent: ent };
  }
  // 여러 출발 노드(부스의 통로 점들)에서 한 번에. 상태 = 노드 × (마지막 이동: 0 가로 · 1 세로 · 2 출발)
  function dijkstra(G, srcs) {
    var S = G.X.length * 3, dist = new Float64Array(S), prev = new Int32Array(S), hk = [], hv = [];
    dist.fill(Infinity); prev.fill(-1);
    function less(i, j) { return hk[i] < hk[j] || (hk[i] === hk[j] && hv[i] < hv[j]); }
    function swap(i, j) { var t = hk[i]; hk[i] = hk[j]; hk[j] = t; t = hv[i]; hv[i] = hv[j]; hv[j] = t; }
    function push(k, v) {
      var i = hk.length; hk.push(k); hv.push(v);
      while (i > 0) { var p = (i - 1) >> 1; if (!less(i, p)) break; swap(i, p); i = p; }
    }
    function pop() {
      var k = hk[0], v = hv[0], lk = hk.pop(), lv = hv.pop();
      if (hk.length) {
        hk[0] = lk; hv[0] = lv;
        for (var i = 0; ;) {
          var l = 2 * i + 1, r = l + 1, m = i;
          if (l < hk.length && less(l, m)) m = l;
          if (r < hk.length && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m); i = m;
        }
      }
      return [k, v];
    }
    srcs.forEach(function (s) { dist[s * 3 + 2] = 0; push(0, s * 3 + 2); });
    while (hk.length) {
      var t = pop(), d = t[0], st = t[1];
      if (d > dist[st]) continue;
      var u = (st / 3) | 0, du = st % 3, a = G.adj[u];
      for (var j = 0; j < a.length; j += 3) {
        var dir = a[j + 2], vs = a[j] * 3 + dir, nd = d + a[j + 1] + (du !== 2 && du !== dir ? TURN : 0);
        if (nd < dist[vs] - 1e-9) { dist[vs] = nd; prev[vs] = st; push(nd, vs); }
      }
    }
    return { dist: dist, prev: prev };
  }
  function bestState(R, v) {
    var b = v * 3 + 2;
    for (var d = 0; d < 2; d++) if (R.dist[v * 3 + d] < R.dist[b]) b = v * 3 + d;
    return b;
  }
  function nearest(R, nodes) {
    var bn = nodes[0], bd = Infinity;
    nodes.forEach(function (v) { var d = R.dist[bestState(R, v)]; if (d < bd - 1e-9) { bd = d; bn = v; } });
    return { v: bn, d: bd };
  }
  function pathOf(G, R, v) {
    var st = bestState(R, v), out = [];
    while (st >= 0) { var u = (st / 3) | 0; out.push([G.X[u], G.Y[u]]); st = R.prev[st]; }
    out.reverse();
    var s = [];
    for (var j = 0; j < out.length; j++) {
      var p = out[j], n = s.length;
      if (n && s[n - 1][0] === p[0] && s[n - 1][1] === p[1]) continue;
      if (n >= 2 && ((s[n - 2][0] === s[n - 1][0] && s[n - 1][0] === p[0]) || (s[n - 2][1] === s[n - 1][1] && s[n - 1][1] === p[1]))) s[n - 1] = p;
      else s.push(p);
    }
    return s;
  }
  function polyLen(pts) {
    var L = 0;
    for (var j = 1; j < pts.length; j++) L += Math.abs(pts[j][0] - pts[j - 1][0]) + Math.abs(pts[j][1] - pts[j - 1][1]);
    return Math.round(L * 10) / 10;
  }

  /* ── 5. 동선: 가까운 곳부터 고른 뒤 2-opt · 한 곳 옮기기, 여러 부스 브랜드는 줄 세운 뒤 가장 짧은 부스를 다시 고른다 ── */
  function optimize(p, M) {
    var L = p.length, guard = 0, imp = true;
    while (imp && guard++ < 60) {
      imp = false;
      for (var i = 1; i < L - 1; i++) for (var j = i + 1; j < L; j++) {
        var a = p[i - 1], b = p[i], c = p[j], e = j + 1 < L ? p[j + 1] : -1;
        if (M[a][c] - M[a][b] + (e >= 0 ? M[b][e] - M[c][e] : 0) < -1e-7) {
          for (var x = i, y = j; x < y; x++, y--) { var t = p[x]; p[x] = p[y]; p[y] = t; }
          imp = true;
        }
      }
      for (var s = 1; s < L; s++) {
        var v = p[s], pr = p[s - 1], nx = s + 1 < L ? p[s + 1] : -1;
        var gain = M[pr][v] + (nx >= 0 ? M[v][nx] - M[pr][nx] : 0), bi = -1, bc = gain - 1e-7;
        for (var q = 1; q <= L; q++) {
          if (q === s || q === s + 1) continue;
          var A = p[q - 1], B = q < L ? p[q] : -1, cost = M[A][v] + (B >= 0 ? M[v][B] - M[A][B] : 0);
          if (cost < bc) { bc = cost; bi = q; }
        }
        if (bi >= 0) { p.splice(s, 1); p.splice(bi > s ? bi - 1 : bi, 0, v); imp = true; }
      }
    }
    return p;
  }

  function plan(startId, targets) {
    var B = [], BK = {}, T = [], unknown = [];
    function boothOf(id) {
      var p = parse(id);
      if (!p || p.t === 'e') return -1;
      if (BK[p.key] != null) return BK[p.key];
      var at = attachesOf(locOf(id));
      if (!at.length) return (BK[p.key] = -1);
      B.push({ id: String(id).trim(), key: p.key, at: at });
      return (BK[p.key] = B.length - 1);
    }
    var tl = Array.isArray(targets) ? targets : [];
    tl.forEach(function (t, ti) {
      var mem = [];
      (Array.isArray(t) ? t : [t]).forEach(function (id) { var b = boothOf(id); if (b >= 0 && mem.indexOf(b) < 0) mem.push(b); });
      if (mem.length) T.push({ ti: ti, mem: mem }); else unknown.push(t);
    });
    var sp = parse(startId), starts;
    if (sp && sp.t === 'e') starts = [{ id: startId, e: sp.key }];
    else {
      var sb = boothOf(startId);
      starts = sb >= 0 ? [{ id: String(startId).trim(), b: sb }] : ENT.map(function (e) { return { id: e.id, e: e.id }; });
    }
    var extra = [];
    B.forEach(function (b) { b.at.forEach(function (a) { extra.push(a); }); });
    var G = buildGraph(extra);
    B.forEach(function (b) { b.nodes = b.at.map(function (a) { return a.node; }); });
    starts.forEach(function (s) { s.R = dijkstra(G, s.e ? [G.ent[s.e]] : B[s.b].nodes); });
    T = T.filter(function (t) {
      t.mem = t.mem.filter(function (b) { return starts.some(function (s) { return isFinite(nearest(s.R, B[b].nodes).d); }); });
      if (!t.mem.length) unknown.push(tl[t.ti]);
      return t.mem.length > 0;
    });
    var U = [];
    T.forEach(function (t) { t.mem.forEach(function (b) { if (U.indexOf(b) < 0) U.push(b); }); });
    U.forEach(function (b) { B[b].R = dijkstra(G, B[b].nodes); });
    var DB = {};
    U.forEach(function (a) { DB[a] = {}; U.forEach(function (b) { DB[a][b] = a === b ? 0 : nearest(B[a].R, B[b].nodes).d; }); });
    var n = T.length, best = null;
    starts.forEach(function (s) {
      var SD = {};
      U.forEach(function (b) { SD[b] = nearest(s.R, B[b].nodes).d; });
      function d(a, b) { return a < 0 ? SD[b] : DB[a][b]; }
      function cost(pick) { var c = 0; for (var j = 0; j < pick.length; j++) c += d(j ? pick[j - 1] : -1, pick[j]); return c; }
      // 줄 세운 순서에서 브랜드마다 가장 짧은 부스(층층 최단 경로)
      function choose(seq) {
        var dp = [], bk = [];
        seq.forEach(function (tj, j) {
          var mem = T[tj].mem;
          dp[j] = []; bk[j] = [];
          mem.forEach(function (m, x) {
            if (!j) { dp[j][x] = d(-1, m); bk[j][x] = -1; return; }
            var pm = T[seq[j - 1]].mem, bv = Infinity, bi = 0;
            pm.forEach(function (q, y) { var v = dp[j - 1][y] + d(q, m); if (v < bv - 1e-9) { bv = v; bi = y; } });
            dp[j][x] = bv; bk[j][x] = bi;
          });
        });
        var out = [], L = seq.length;
        if (!L) return out;
        var xi = 0;
        dp[L - 1].forEach(function (v, x) { if (v < dp[L - 1][xi] - 1e-9) xi = x; });
        for (var j = L - 1; j >= 0; j--) { out[j] = T[seq[j]].mem[xi]; xi = bk[j][xi]; }
        return out;
      }
      var seq = [], pick = [], used = [], cur = -1;
      for (var step = 0; step < n; step++) {
        var bt = -1, bm = -1, bd = Infinity;
        for (var j = 0; j < n; j++) {
          if (used[j]) continue;
          T[j].mem.forEach(function (m) { var dd = d(cur, m); if (dd < bd - 1e-9) { bd = dd; bt = j; bm = m; } });
        }
        used[bt] = true; seq.push(bt); pick.push(bm); cur = bm;
      }
      var c0 = cost(pick);
      for (var round = 0; round < 8 && n > 1; round++) {
        var M = [];
        for (var a = 0; a <= n; a++) {
          M[a] = [];
          for (var b = 0; b <= n; b++) M[a][b] = a === b ? 0 : a === n ? d(-1, pick[b]) : b === n ? d(-1, pick[a]) : d(pick[a], pick[b]);
        }
        var p = [n];
        for (var q = 0; q < n; q++) p.push(q);
        optimize(p, M);
        var ns = p.slice(1).map(function (q) { return seq[q]; }), np = choose(ns), c1 = cost(np);
        if (c1 < c0 - 1e-7) { seq = ns; pick = np; c0 = c1; } else break;
      }
      if (!best || c0 < best.c - 1e-9) best = { s: s, seq: seq, pick: pick, c: c0 };
    });
    var order = [], stops = [], legs = [], prevR = best.s.R, prevId = best.s.id, lastKey = best.s.b != null ? B[best.s.b].key : null;
    best.seq.forEach(function (tj, j) {
      var b = B[best.pick[j]];
      if (order.length && b.key === lastKey) { stops.push({ id: b.id, target: T[tj].ti, n: order.length }); return; }
      var pts = pathOf(G, prevR, nearest(prevR, b.nodes).v);
      legs.push({ from: prevId, to: b.id, points: pts, len: polyLen(pts) });
      order.push(b.id);
      stops.push({ id: b.id, target: T[tj].ti, n: order.length });
      prevR = b.R; prevId = b.id; lastKey = b.key;
    });
    var total = 0;
    legs.forEach(function (l) { total += l.len; });
    return { start: best.s.id, order: order, stops: stops, legs: legs, total: Math.round(total * 10) / 10, unknown: unknown };
  }

  /* ── 6. 한 줄 길잡이 ── */
  function aisleName(c, last) {
    if (!c) return '그 통로';
    if (c.kind === 'top') return '맨 안쪽 벽 앞 통로';
    if (c.hl != null) return '위 가로 통로';
    if (c.kind === 'wall') return c.hall + '홀 ' + c.col + '번 줄(벽) 앞 통로';
    if (c.kind === 'art') return '4홀 ART 앞 통로';
    var side = last && last[0] === VX[c.i - 1] ? '왼쪽' : '오른쪽';
    if (c.kind === 'g') return '경기도 공동관 ' + side + ' 통로';
    return c.hall + '홀 ' + c.col + '번 줄 ' + side + ' 통로';
  }
  function describeLeg(leg) {
    if (!leg || !leg.points || leg.points.length < 2 || leg.len < 3) return '바로 여기예요';
    var segs = [], P = leg.points;
    for (var j = 1; j < P.length; j++) {
      var dx = P[j][0] - P[j - 1][0], dy = P[j][1] - P[j - 1][1];
      var d = dx > 0 ? 'r' : dx < 0 ? 'l' : dy > 0 ? 'd' : 'u', len = Math.abs(dx) + Math.abs(dy);
      if (segs.length && segs[segs.length - 1].d === d) segs[segs.length - 1].len += len;
      else segs.push({ d: d, len: len });
    }
    var fp = parse(leg.from);
    if (fp && fp.t === 'e' && segs.length > 1 && segs[0].d === 'u' && segs[0].len <= FRONT) segs.shift();
    var keep = segs.filter(function (s) { return s.len >= 4; });
    if (keep.length) segs = keep;
    function amount(s) { return s.d === 'l' || s.d === 'r' ? Math.max(1, Math.round(s.len / PITCH)) + '줄' : Math.max(1, Math.round(s.len / ROW)) + '칸'; }
    function dirWord(s) { return { u: '안쪽으로', d: '입구 쪽으로', l: '왼쪽으로', r: '오른쪽으로' }[s.d]; }
    var c = locOf(leg.to), last = segs[segs.length - 1], vert = last.d === 'u' || last.d === 'd';
    var parts = segs.slice(0, -1).map(function (s) { return dirWord(s) + ' ' + amount(s); });
    var where = aisleName(c, P[P.length - 1]);
    parts.push(vert || (c && (c.kind === 'top' || c.hl != null)) ? where + (vert ? '로 · ' : '에서 · ') + dirWord(last) + ' ' + amount(last) : dirWord(last) + ' ' + amount(last) + ' · ' + where);
    return parts.join(' → ');
  }

  /* ── 7. 그리기 ── */
  var CSS = [
    '.mzm{position:relative;width:100%;height:100%;min-height:240px;overflow:hidden;background:var(--bg,#F3F5F8);touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:contain;font-family:var(--font-body,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif)}',
    '.mzm>svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}',
    '.mzm text{text-anchor:middle;pointer-events:none;font-family:inherit}',
    '.mz-fl{fill:var(--surface,#fff)}',
    '.mz-ht{fill:var(--ink,#18212E);fill-opacity:.035}',
    '.mz-hb{stroke:var(--ink,#18212E);stroke-width:.7;stroke-dasharray:4 3;opacity:.35}',
    '.mz-wl{fill:none;stroke:var(--ink,#18212E);stroke-width:1.6;stroke-linecap:round;opacity:.75}',
    '.mz-is{fill:var(--ink,#18212E);fill-opacity:.06}',
    '.mz-b rect{fill:var(--ink,#18212E);fill-opacity:.07;stroke:var(--ink,#18212E);stroke-opacity:.3;stroke-width:.35}',
    '.mz-b.k rect{fill:var(--accent-soft,#E6ECFD);fill-opacity:1;stroke:var(--accent,#2457E6);stroke-opacity:.5}',
    '.mz-b.fav rect{fill:var(--star,#E8A400);stroke:var(--star,#E8A400);stroke-opacity:1}',
    '.mz-b.later rect{fill:var(--accent,#2457E6);fill-opacity:.38;stroke:var(--accent,#2457E6);stroke-opacity:1;stroke-width:.6}',
    '.mz-b.bought rect{fill:var(--done,#1F8A5B);fill-opacity:.3}',
    '.mz-b.done rect{fill:var(--muted,#5D6878);fill-opacity:.3}',
    '.mz-b.bought,.mz-b.done{opacity:.5}',
    '.mz-b.fl rect{animation:mzf .6s 3}',
    '@keyframes mzf{50%{fill:var(--accent,#2457E6);fill-opacity:.75}}',
    '.mz-n{font-family:var(--font-mono,ui-monospace,Menlo,monospace);font-weight:600;fill:var(--ink,#18212E);opacity:.72;display:none}',
    '.mz-l{fill:var(--ink,#18212E);display:none}',
    '.mzm.z1 .mz-n,.mzm.z1 .mz-l.big,.mzm.z2 .mz-l{display:inline}',
    '.mz-b.fav text{fill:#2B2100;opacity:1}',
    '.mz-hl{font-family:var(--font-display,inherit);font-size:16px;font-weight:700;fill:var(--ink,#18212E);opacity:.55}',
    '.mz-rm{fill:#A8743A;fill-opacity:.28}.mz-rm.meet{fill:var(--ink,#18212E);fill-opacity:.18}.mz-rm.cup{fill:#F06A1D;fill-opacity:.35}',
    '.mz-fx{font-weight:600;fill:var(--ink,#18212E);opacity:.8}',
    '.mz-gz{fill:#2F6FD6;fill-opacity:.06;stroke:#2F6FD6;stroke-opacity:.55;stroke-width:.45;stroke-dasharray:1.5 1}',
    '.mz-gt{font-size:4px;font-weight:700;fill:#2F6FD6}',
    '.mz-wc rect{fill:#2E8B57}.mz-wc circle,.mz-wc ellipse{fill:#fff}',
    '.mz-wt{font-size:2.3px;font-weight:700;fill:#2E8B57;display:none}.mzm.z1 .mz-wt{display:inline}',
    '.mz-en{fill:var(--accent,#2457E6)}.mz-dr{stroke:var(--accent,#2457E6);stroke-width:2.4;stroke-linecap:round}',
    '.mz-et{font-size:6px;font-weight:700;fill:var(--ink,#18212E)}',
    '.mz-lb{font-size:4.2px;fill:var(--muted,#5D6878)}',
    '.mz-rt{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}',
    '.mz-rt.u{stroke:var(--surface,#fff);stroke-width:9px}.mz-rt.m{stroke:var(--accent,#2457E6);stroke-width:4.5px}',
    '.mz-ar path{fill:none;stroke:var(--surface,#fff);stroke-width:.9;stroke-linecap:round;stroke-linejoin:round}',
    '.mz-st circle{fill:var(--accent,#2457E6);stroke:var(--surface,#fff);stroke-width:.7}',
    '.mz-st.x circle{fill:var(--muted,#5D6878)}.mz-st.x{opacity:.75}',
    '.mz-st text{font-family:var(--font-mono,ui-monospace,monospace);font-size:3.5px;font-weight:700;fill:var(--surface,#fff)}',
    '.mz-hr .halo{fill:var(--ink,#18212E);fill-opacity:.18;transform-box:fill-box;transform-origin:center;animation:mzp 2s ease-out infinite}',
    '.mz-hr .dot{fill:var(--ink,#18212E);stroke:var(--surface,#fff);stroke-width:1.1}',
    '.mz-pill rect{fill:var(--ink,#18212E)}.mz-pill text{font-size:3.2px;font-weight:700;fill:var(--surface,#fff)}',
    '@keyframes mzp{0%{transform:scale(.7);opacity:1}100%{transform:scale(1.7);opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.mz-hr .halo{animation:none}.mz-b.fl rect{animation:none}}',
    '.mz-ctl{position:absolute;right:12px;bottom:12px;display:flex;flex-direction:column;gap:8px;z-index:2}',
    '.mz-ctl button{width:44px;height:44px;padding:0;border-radius:12px;border:1px solid var(--line,#DDE2EA);background:var(--surface,#fff);color:var(--ink,#18212E);font:600 22px/1 var(--font-body,system-ui,sans-serif);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.14);cursor:pointer;touch-action:manipulation}',
    '.mz-ctl button:active{transform:scale(.95)}.mz-ctl svg{width:20px;height:20px}'
  ].join('\n');
  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('mzmap-css')) return;
    var s = document.createElement('style');
    s.id = 'mzmap-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f(n) { return Math.round(n * 100) / 100; }
  function rect(cls, x, y, w, h, rx) { return '<rect' + (cls ? ' class="' + cls + '"' : '') + ' x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (rx ? ' rx="' + rx + '"' : '') + '/>'; }
  function text(cls, x, y, s, extra) { return '<text' + (cls ? ' class="' + cls + '"' : '') + ' x="' + f(x) + '" y="' + f(y) + '"' + (extra || '') + '>' + esc(s) + '</text>'; }
  function textW(s, fs) { var w = 0; for (var j = 0; j < s.length; j++) w += s.charCodeAt(j) > 0x2e80 ? fs : fs * 0.6; return w; }
  function fit(s, fs, w) {
    s = String(s || '');
    if (textW(s, fs) <= w) return s;
    while (s.length > 1 && textW(s + '…', fs) > w) s = s.slice(0, -1);
    return s + '…';
  }

  var STATIC = null;
  function staticSvg() {
    if (STATIC) return STATIC;
    var s = [], g, r, i;
    s.push(rect('mz-fl', 0, 0, FW, WALL_Y, 2));
    HALLS.forEach(function (h, j) { if (j % 2) s.push(rect('mz-ht', h[1], 0, h[2] - h[1], WALL_Y)); });
    function covered(i, r) {
      for (var j = 0; j < ROOMS.length; j++) { var m = ROOMS[j]; if (i >= m[1] && i <= m[2] && r >= m[3] && r <= m[4]) return true; }
      return i >= 17 && i <= 19 && r >= 16 && r <= 20;
    }
    for (i = 1; i <= 23; i++) {
      g = grp(hallOfI(i));
      BLOCKS[g].forEach(function (b) {
        var run = null;
        for (r = b[1]; r >= b[0] - 1; r--) {
          var free = r >= b[0] && !covered(i, r);
          if (free && run === null) run = r;
          if (!free && run !== null) { s.push(rect('mz-is', ix(i), RT[g][run], 2 * HALF, RT[g][r + 1] + ROW - RT[g][run], 1)); run = null; }
        }
      });
    }
    s.push(rect('mz-is', HALF, 0, FW - 2 * HALF, TOPH));
    s.push(rect('mz-is', 0, TOPH, HALF, 388));
    s.push(rect('mz-is', FW - HALF, 12.5, HALF, 315.5));
    BOUND.forEach(function (k) { s.push('<line class="mz-hb" x1="' + VX[k] + '" y1="' + TOPH + '" x2="' + VX[k] + '" y2="' + WALL_Y + '"/>'); });
    ROOMS.forEach(function (m) {
      var b = roomRect(m), cls = 'mz-rm' + (m[5] === 'meet' ? ' meet' : m[5] === 'cup' ? ' cup' : '');
      s.push(rect(cls, b[0], b[1], b[2] - b[0], b[3] - b[1], 1.5));
      var lines = m[0].split('\n'), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, wide = b[2] - b[0] > 20;
      var fs = wide ? (b[3] - b[1] > 25 ? 5 : 4) : 2.6;
      lines.forEach(function (ln, j) { s.push(text('mz-fx', cx, cy + (j - (lines.length - 1) / 2) * fs * 1.25 + fs * 0.35, ln, ' style="font-size:' + fs + 'px"')); });
    });
    s.push(rect('mz-gz', ix(17) - 2, G_Y[5] - 2, ix(19) + 2 * HALF - ix(17) + 4, G_Y[0] + G_H - G_Y[5] + 4, 1.5));
    s.push(text('mz-fx', ix(18) + HALF, G_Y[1] + 4.6, '라운지', ' style="font-size:2.6px"'));
    s.push(text('mz-gt', (ix(17) + ix(19) + 2 * HALF) / 2, HL[3].y + 1.4, '경기도 공동관'));
    WCS.forEach(function (w) {
      var x = w.x != null ? w.x : ix(w.i) + HALF, y = w.y != null ? w.y : rowTop(w.i, w.r) + ROW / 2;
      s.push('<g class="mz-wc" transform="translate(' + f(x) + ' ' + f(y) + ')"><rect x="-3.6" y="-3.6" width="7.2" height="7.2" rx="1.5"/>' +
        '<ellipse cx="0" cy="1" rx="1.6" ry="1.25"/><circle cx="-1.8" cy="-1" r=".65"/><circle cx="-.6" cy="-2" r=".65"/><circle cx=".6" cy="-2" r=".65"/><circle cx="1.8" cy="-1" r=".65"/></g>');
      s.push(text('mz-wt', x, y + 6, '화장실'));
    });
    var gap = 7, d = 'M' + (ENT[0].x - gap) + ' ' + WALL_Y + 'H0V0H' + FW + 'V' + WALL_Y + 'H' + (ENT[3].x + gap);
    for (var j = 1; j < 4; j++) d += 'M' + (ENT[j - 1].x + gap) + ' ' + WALL_Y + 'H' + (ENT[j].x - gap);
    s.push('<path class="mz-wl" d="' + d + '"/>');
    ENT.forEach(function (e) {
      s.push('<line class="mz-dr" x1="' + (e.x - gap + 1.5) + '" y1="' + WALL_Y + '" x2="' + (e.x + gap - 1.5) + '" y2="' + WALL_Y + '"/>');
      s.push('<path class="mz-en" d="M' + e.x + ' ' + (WALL_Y - 5.5) + 'l4 5.5h-8z"/>');
      s.push(text('mz-et', e.x, WALL_Y + 8, e.label));
    });
    s.push(text('mz-lb', FW / 2, WALL_Y + 16.5, '입구 밖 = 1전시장 로비(택배 서비스)'));
    HALLS.forEach(function (h) { s.push(text('mz-hl', (h[1] + h[2]) / 2, HL[4].y + 5.5, h[0] + '홀')); });
    STATIC = s.join('');
    return STATIC;
  }

  var BOOTHS = [], INST = [];
  function setBooths(list) {
    var seen = {};
    BOOTHS = [];
    (Array.isArray(list) ? list : []).forEach(function (b) {
      if (!b) return;
      var p = parse(b.id), c = p && p.t !== 'e' && locOf(b.id);
      if (!c || seen[p.key]) return;
      seen[p.key] = 1;
      BOOTHS.push({ id: String(b.id).trim(), key: p.key, label: b.label == null ? '' : String(b.label) });
    });
    INST.forEach(function (x) { x.redraw(); });
  }
  // 그릴 부스: 배치도의 모든 부스 + 페이지가 넘긴 부스(배치도에 없으면 번호 규칙 자리)
  function drawList() {
    foot('');
    var by = {}, out = [];
    BOOTHS.forEach(function (b) { by[b.key] = b; });
    ALL.forEach(function (k) { var b = by[k]; out.push({ key: k, id: b ? b.id : k, label: b ? b.label : '', known: !!b, c: locOf(k) }); delete by[k]; });
    Object.keys(by).forEach(function (k) { var b = by[k]; out.push({ key: k, id: b.id, label: b.label, known: true, c: locOf(k) }); });
    return out;
  }

  var WORLD = [-8, -6, FW + 8, WALL_Y + 21];
  var Z1 = 3.1, Z2 = 6, SMAX = 14;

  function render(el, opts) {
    injectCss();
    var st = { marks: {}, here: null, route: null, onTap: null, controls: true };
    var view = { cx: FW / 2, cy: WALL_Y / 2, s: 1 }, W = 0, H = 0, placed = false, moved = false, anim = 0, dead = false, refit = null;
    var box = document.createElement('div');
    box.className = 'mzm';
    box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="메가주 전시장 도식 지도"><g></g><g></g><g></g><g></g></svg>';
    var svg = box.firstChild, gSt = svg.childNodes[0], gBs = svg.childNodes[1], gRo = svg.childNodes[2], gMk = svg.childNodes[3];
    gSt.innerHTML = staticSvg();
    var ctl = document.createElement('div');
    ctl.className = 'mz-ctl';
    ctl.innerHTML = '<button type="button" aria-label="확대">+</button><button type="button" aria-label="축소">−</button>' +
      '<button type="button" aria-label="화면 맞춤"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5"/></svg></button>';
    box.appendChild(ctl);
    el.appendChild(box);
    var BL = [], bEls = [], marks = [], lastK = 0, stations = [];

    function boothsDraw() {
      BL = drawList();
      var s = [];
      BL.forEach(function (b, j) {
        var c = b.c, cx = c.x + c.w / 2, cy = c.y + c.h / 2, big = c.w * c.h >= 200;
        var fs = Math.max(1.6, Math.min(3.2, c.w * 0.32, c.h * 0.34)), lf = big ? Math.max(1.6, Math.min(2.6, c.w / 6, c.h / 4.5)) : 1.45;
        var lab = b.label && c.h >= 7 ? fit(b.label, lf, c.w - 0.8) : '';
        s.push('<g class="mz-b' + (b.known ? ' k' : '') + '">' + rect('', c.x, c.y, c.w, c.h, 0.6) +
          text('mz-n', cx, lab ? cy - 0.15 * fs : cy + fs * 0.35, b.key, ' style="font-size:' + f(fs) + 'px"') +
          (lab ? text('mz-l' + (big ? ' big' : ''), cx, cy + lf * 1.3, lab, ' style="font-size:' + f(lf) + 'px"') : '') + '</g>');
      });
      gBs.innerHTML = s.join('');
      bEls = Array.prototype.slice.call(gBs.childNodes);
    }
    function keyMarks() {
      var km = {}, m = st.marks || {};
      for (var k in m) { var q = parse(k); if (q) km[q.key] = m[k]; }
      return km;
    }
    function hereId() { return st.here || (st.route && st.route.start) || null; }
    function dyn() {
      var km = keyMarks();
      BL.forEach(function (b, j) {
        var m = km[b.key], cls = 'mz-b' + (b.known ? ' k' : '') + (m === 'fav' || m === 'later' || m === 'bought' || m === 'done' ? ' ' + m : '');
        if (bEls[j] && bEls[j].getAttribute('class') !== cls) bEls[j].setAttribute('class', cls);
      });
      var s = [], d = '', r = st.route, arrows = [];
      if (r && Array.isArray(r.legs)) {
        r.legs.forEach(function (l) {
          var P = l.points || [];
          if (P.length < 2) return;
          d += 'M' + P.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L');
          var bi = 1, bl = 0;
          for (var j = 1; j < P.length; j++) { var L = Math.abs(P[j][0] - P[j - 1][0]) + Math.abs(P[j][1] - P[j - 1][1]); if (L > bl) { bl = L; bi = j; } }
          if (bl >= 14) arrows.push([(P[bi][0] + P[bi - 1][0]) / 2, (P[bi][1] + P[bi - 1][1]) / 2, Math.atan2(P[bi][1] - P[bi - 1][1], P[bi][0] - P[bi - 1][0]) * 180 / Math.PI]);
        });
      }
      if (d) s.push('<path class="mz-rt u" vector-effect="non-scaling-stroke" d="' + d + '"/><path class="mz-rt m" vector-effect="non-scaling-stroke" d="' + d + '"/>');
      gRo.innerHTML = s.join('');
      s = [];
      arrows.forEach(function (a) { s.push('<g class="mz-ar mz-k" data-x="' + f(a[0]) + '" data-y="' + f(a[1]) + '" data-r="' + f(a[2]) + '"><path d="M-1.2 -1.9L1 0L-1.2 1.9"/></g>'); });
      stations = [];
      if (r && Array.isArray(r.order)) {
        r.order.forEach(function (id, j) {
          var c = locOf(id), q = parse(id), lg = r.legs && r.legs[j], P = lg && lg.points;
          if (!c || c.ent) return;
          var m = km[q.key], pt = P && P.length > 1 ? P[P.length - 1] : [c.x + c.w / 2, c.y + c.h / 2];
          stations.push([pt[0], pt[1], id]);
          s.push('<g class="mz-st mz-k' + (m === 'done' || m === 'bought' ? ' x' : '') + '" data-x="' + f(pt[0]) + '" data-y="' + f(pt[1]) + '"><circle r="3.5"/>' + text('', 0, 0, j + 1, ' dy=".36em"') + '</g>');
        });
      }
      var hid = hereId(), hc = hid && locOf(hid);
      if (hc) {
        var hx = hc.x + hc.w / 2, hy = hc.ent ? WALL_Y - 3 : hc.y + hc.h / 2;
        s.push('<g class="mz-hr mz-k" data-x="' + f(hx) + '" data-y="' + f(hy) + '"><circle class="halo" r="6.5"/><circle class="dot" r="2.9"/>' +
          '<g class="mz-pill" transform="translate(0 ' + (hc.ent ? -9.5 : 9.5) + ')"><rect x="-8.6" y="-2.9" width="17.2" height="5.4" rx="2.7"/>' + text('', 0, 0, '지금 여기', ' dy=".34em"') + '</g></g>');
      }
      gMk.innerHTML = s.join('');
      marks = Array.prototype.slice.call(gMk.querySelectorAll('.mz-k'));
      lastK = 0;
      scaleMarks();
    }
    function scaleMarks() {
      var k = Math.max(1, Math.min(2.6, 8.5 / (3.5 * view.s)));
      if (Math.abs(k - lastK) < 0.02) return;
      lastK = k;
      marks.forEach(function (d) {
        var rr = d.getAttribute('data-r');
        d.setAttribute('transform', 'translate(' + d.getAttribute('data-x') + ' ' + d.getAttribute('data-y') + ')' + (rr ? ' rotate(' + rr + ')' : '') + ' scale(' + f(k) + ')');
      });
    }

    function sMin() { return Math.min(W / (WORLD[2] - WORLD[0]), H / (WORLD[3] - WORLD[1])) * 0.85; }
    function apply() {
      if (!W || !H) return;
      view.s = Math.max(sMin(), Math.min(SMAX, view.s));
      // 보이는 곳이 전시장 밖으로 나가지 않게
      var w = W / view.s, h = H / view.s;
      view.cx = w >= WORLD[2] - WORLD[0] ? (WORLD[0] + WORLD[2]) / 2 : Math.max(WORLD[0] + w / 2, Math.min(WORLD[2] - w / 2, view.cx));
      view.cy = h >= WORLD[3] - WORLD[1] ? (WORLD[1] + WORLD[3]) / 2 : Math.max(WORLD[1] + h / 2, Math.min(WORLD[3] - h / 2, view.cy));
      svg.setAttribute('viewBox', f(view.cx - w / 2) + ' ' + f(view.cy - h / 2) + ' ' + f(w) + ' ' + f(h));
      var z = view.s >= Z2 ? 'mzm z1 z2' : view.s >= Z1 ? 'mzm z1' : 'mzm';
      if (box.className !== z) box.className = z;
      scaleMarks();
    }
    function fitBox(b, minW, minH) {
      var bw = Math.max(b[2] - b[0], minW || 0), bh = Math.max(b[3] - b[1], minH || 0);
      return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, s: Math.min(W / bw, H / bh) };
    }
    function ptOf(id) { var c = locOf(id); return c ? [c.x + c.w / 2, c.ent ? WALL_Y : c.y + c.h / 2] : null; }
    function bbox(pts, pad) {
      var b = [Infinity, Infinity, -Infinity, -Infinity];
      pts.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
      return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
    }
    function worldView() { return fitBox(WORLD); }
    function routeView() {
      var pts = [], r = st.route, p;
      (r.legs || []).forEach(function (l) { (l.points || []).forEach(function (q) { pts.push(q); }); });
      (r.order || []).forEach(function (id) { if ((p = ptOf(id))) pts.push(p); });
      if (hereId() && (p = ptOf(hereId()))) pts.push(p);
      if (!pts.length) return worldView();
      var v = fitBox(bbox(pts, 14), 110, 110), fill = H / (WORLD[3] - WORLD[1] - 4);
      // 세로 화면: 바닥이 화면 높이를 채우는 것보다 작게 줄이지 않는다 — 넓은 경로는 좌우가 조금 잘리고, 지금 여기는 화면 안에 둔다
      if (H > W && v.s < fill) {
        v.s = fill;
        var w = W / fill, hp = hereId() && ptOf(hereId());
        if (hp) v.cx = Math.max(hp[0] - w / 2 + 18, Math.min(hp[0] + w / 2 - 18, v.cx));
      }
      return v;
    }
    // 처음 보이는 곳: 동선 전체 → 지금 여기가 있는 홀 → 전시장 전체
    function smartView() {
      if (st.route && ((st.route.legs || []).length || (st.route.order || []).length)) return routeView();
      var p = st.here && ptOf(st.here);
      if (p) { var h = HALLS[hallOfX(p[0]) - 2]; return fitBox([h[1] - 4, -4, h[2] + 4, WORLD[3]]); }
      return worldView();
    }
    function setView(v) { view.cx = v.cx; view.cy = v.cy; view.s = v.s; apply(); }
    function animateTo(v, ms) {
      cancelAnimationFrame(anim);
      var a = { cx: view.cx, cy: view.cy, s: view.s }, t0 = 0;
      v.s = Math.max(sMin(), Math.min(SMAX, v.s));
      ms = ms || 260;
      function step(t) {
        if (dead) return;
        if (!t0) t0 = t;
        var u = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - u, 3);
        view.cx = a.cx + (v.cx - a.cx) * e; view.cy = a.cy + (v.cy - a.cy) * e; view.s = a.s * Math.pow(v.s / a.s, e);
        apply();
        if (u < 1) anim = requestAnimationFrame(step);
      }
      anim = requestAnimationFrame(step);
    }
    function toMap(p) { return { x: view.cx + (p.x - W / 2) / view.s, y: view.cy + (p.y - H / 2) / view.s }; }
    function zoomAt(p, k, animate) {
      var m = toMap(p), s = Math.max(sMin(), Math.min(SMAX, view.s * k));
      var v = { cx: m.x - (p.x - W / 2) / s, cy: m.y - (p.y - H / 2) / s, s: s };
      if (animate) animateTo(v); else setView(v);
    }
    function place() {
      if (!W || !H) return;
      if (!placed || !moved) { setView(smartView()); placed = true; } else apply();
    }

    // 누르기 · 끌기 · 두 손가락 · 두 번 누르기(두 번째에 누른 채 위아래로 끌면 확대 · 축소)
    var ptrs = {}, np = 0, gs = null, lastTap = null, tapTimer = 0;
    function pos(e) { var r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function two() { var a = []; for (var k in ptrs) a.push(ptrs[k]); return a; }
    function hit(p) {
      var m = toMap(p), tol = Math.max(1.5, 12 / view.s), best = null, bd = Infinity;
      ENT.forEach(function (e) { var d = Math.hypot(m.x - e.x, m.y - (WALL_Y + 3)); if (d < 9 + tol && d < bd) { bd = d; best = e.id; } });
      if (best) return best;
      stations.forEach(function (q) {
        var d = Math.hypot(m.x - q[0], m.y - q[1]);
        if (d < 3.5 * Math.max(1, lastK) + 1 && d < bd) { bd = d; best = q[2]; }
      });
      if (best) return best;
      BL.forEach(function (b) {
        var c = b.c, dx = Math.max(c.x - m.x, 0, m.x - c.x - c.w), dy = Math.max(c.y - m.y, 0, m.y - c.y - c.h), d = Math.hypot(dx, dy);
        if (d > tol) return;
        var dc = d + Math.hypot(m.x - c.x - c.w / 2, m.y - c.y - c.h / 2) / 100;
        if (dc < bd) { bd = dc; best = b.id; }
      });
      return best;
    }
    function onDown(e) {
      if (e.button > 0) return;
      cancelAnimationFrame(anim);
      try { svg.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ }
      var p = pos(e), now = Date.now();
      ptrs[e.pointerId] = p; np++;
      if (np === 1) {
        if (lastTap && now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 36) {
          clearTimeout(tapTimer); lastTap = null;
          gs = { m: 'dz', p0: p, s0: view.s, a: toMap(p), moved: false };
        } else gs = { m: 'pan', p0: p, c0: { x: view.cx, y: view.cy }, t0: now, moved: false };
      } else if (np === 2) {
        var a = two();
        clearTimeout(tapTimer); lastTap = null;
        gs = { m: 'pinch', d0: Math.max(1, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), s0: view.s, a: toMap({ x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }), moved: true };
      }
    }
    function onMove(e) {
      if (!(e.pointerId in ptrs) || !gs) return;
      var p = pos(e);
      ptrs[e.pointerId] = p;
      if (gs.m === 'pan') {
        var dx = p.x - gs.p0.x, dy = p.y - gs.p0.y;
        if (!gs.moved && Math.hypot(dx, dy) < 8) return;
        gs.moved = moved = true; refit = null;
        view.cx = gs.c0.x - dx / view.s; view.cy = gs.c0.y - dy / view.s;
        apply();
      } else if (gs.m === 'pinch' && np >= 2) {
        var a = two(), mid = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
        moved = true; refit = null;
        view.s = Math.max(sMin(), Math.min(SMAX, gs.s0 * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / gs.d0));
        view.cx = gs.a.x - (mid.x - W / 2) / view.s; view.cy = gs.a.y - (mid.y - H / 2) / view.s;
        apply();
      } else if (gs.m === 'dz') {
        var d = p.y - gs.p0.y;
        if (!gs.moved && Math.abs(d) < 8) return;
        gs.moved = moved = true; refit = null;
        view.s = Math.max(sMin(), Math.min(SMAX, gs.s0 * Math.exp(d / 140)));
        view.cx = gs.a.x - (gs.p0.x - W / 2) / view.s; view.cy = gs.a.y - (gs.p0.y - H / 2) / view.s;
        apply();
      }
    }
    function onUp(e) {
      if (!(e.pointerId in ptrs)) return;
      var p = pos(e);
      delete ptrs[e.pointerId]; np--;
      if (!gs) return;
      if (gs.m === 'pinch') {
        if (np === 1) { var q = two()[0]; gs = { m: 'pan', p0: q, c0: { x: view.cx, y: view.cy }, t0: 0, moved: true }; } else if (np <= 0) gs = null;
        return;
      }
      if (e.type === 'pointerup' && gs.m === 'pan' && !gs.moved && Date.now() - gs.t0 < 600) {
        lastTap = { t: Date.now(), x: p.x, y: p.y };
        tapTimer = setTimeout(function () {
          lastTap = null;
          var id = hit(p);
          if (id && typeof st.onTap === 'function') st.onTap(id);
        }, 300);
      } else if (e.type === 'pointerup' && gs.m === 'dz' && !gs.moved) { moved = true; refit = null; zoomAt(p, 2, true); }
      if (np <= 0) { np = 0; ptrs = {}; gs = null; }
    }
    function onWheel(e) {
      e.preventDefault();
      cancelAnimationFrame(anim);
      moved = true; refit = null;
      zoomAt(pos(e), Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0018)));
    }
    function stop(e) { e.preventDefault(); }
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('touchmove', stop, { passive: false });
    svg.addEventListener('dblclick', stop);
    box.addEventListener('gesturestart', stop);
    box.addEventListener('gesturechange', stop);
    var btn = ctl.querySelectorAll('button');
    btn[0].addEventListener('click', function () { moved = true; refit = null; zoomAt({ x: W / 2, y: H / 2 }, 1.7, true); });
    btn[1].addEventListener('click', function () { moved = true; refit = null; zoomAt({ x: W / 2, y: H / 2 }, 1 / 1.7, true); });
    btn[2].addEventListener('click', function () { api.fit(); });

    function measure() {
      var r = box.getBoundingClientRect();
      if (Math.round(r.width) === W && Math.round(r.height) === H) return;
      W = Math.round(r.width); H = Math.round(r.height);
      if (placed && refit && W && H) { cancelAnimationFrame(anim); setView(refit()); } else place();
    }
    var ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(box); else window.addEventListener('resize', measure);

    function setOpts(o) {
      if (!o) return;
      ['marks', 'here', 'route', 'onTap', 'controls'].forEach(function (k) { if (k in o) st[k] = o[k]; });
      ctl.style.display = st.controls === false ? 'none' : '';
    }
    var api = {
      update: function (o) { if (dead) return; setOpts(o); dyn(); if (placed && !moved) setView(smartView()); },
      showRoute: function (r) {
        if (dead) return;
        st.route = r || null;
        dyn();
        if (W && H) { moved = true; refit = smartView; animateTo(smartView(), 320); }
      },
      clearRoute: function () { if (dead) return; st.route = null; dyn(); },
      focus: function (id) {
        var c = locOf(id);
        if (!c || !W) return false;
        moved = true; refit = null;
        animateTo({ cx: c.x + c.w / 2, cy: c.ent ? WALL_Y - 20 : c.y + c.h / 2, s: Math.max(view.s, 5.5) }, 320);
        var p = parse(id);
        BL.forEach(function (b, j) {
          if (b.key !== p.key || !bEls[j]) return;
          var el2 = bEls[j];
          el2.classList.remove('fl'); void el2.getBoundingClientRect(); el2.classList.add('fl');
          setTimeout(function () { el2.classList.remove('fl'); }, 2000);
        });
        return true;
      },
      fit: function () { if (!W) return; moved = true; refit = worldView; animateTo(worldView(), 280); },
      destroy: function () {
        dead = true;
        cancelAnimationFrame(anim); clearTimeout(tapTimer);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', measure);
        if (box.parentNode) box.parentNode.removeChild(box);
        INST = INST.filter(function (x) { return x !== inst; });
      }
    };
    var inst = { redraw: function () { boothsDraw(); dyn(); } };
    INST.push(inst);
    setOpts(opts);
    boothsDraw();
    dyn();
    measure();
    return api;
  }

  var API = {
    version: '2026-11-19b',
    setBooths: setBooths,
    locate: locate,
    entrances: ENT.map(function (e) { return { id: e.id, label: e.label, x: e.x, y: e.y }; }),
    plan: plan,
    describeLeg: describeLeg,
    render: render
  };
  root.MZMap = API;
  if (typeof module === 'object' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
