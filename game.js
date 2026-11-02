'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const dark = document.createElement('canvas');
  const dctx = dark.getContext('2d');

  // ---------- 상수 ----------
  const TS = 32;                       // 타일 한 칸 (월드 px)
  const GW = 4, GH = 4, CW = 21, CH = 17;  // 방 격자 4×4, 칸마다 21×17 타일
  const MW = GW * CW, MH = GH * CH;
  const MAX_DEPTH = 5;
  const WALL = 0, FLOOR = 1;
  const SAVE_KEY = 'lantern2:save';
  const BEST_KEY = 'lantern:best';

  const WEAPONS = {
    pistol:   { name: '불씨 권총',     cost: 0, rate: 0.26, dmg: 3, speed: 440, spread: 0.06, count: 1, r: 4,   color: '#ffcf6e' },
    repeater: { name: '연발 부싯돌',   cost: 1, rate: 0.09, dmg: 2, speed: 540, spread: 0.16, count: 1, r: 3,   color: '#ffe9a8' },
    scatter:  { name: '산탄 등불',     cost: 3, rate: 0.55, dmg: 2, speed: 400, spread: 0.55, count: 6, r: 3.5, color: '#ffa94d', life: 0.42 },
    lance:    { name: '빛창',          cost: 4, rate: 0.5,  dmg: 8, speed: 820, spread: 0,    count: 1, r: 3,   color: '#bfe9ff', pierce: true },
    lobber:   { name: '기름 투척기',   cost: 6, rate: 0.85, dmg: 9, speed: 320, spread: 0.04, count: 1, r: 6,   color: '#ff7b39', explode: 64 },
    firefly:  { name: '반딧불 주머니', cost: 2, rate: 0.36, dmg: 2, speed: 260, spread: 0.9,  count: 3, r: 3,   color: '#c8ff7a', homing: 6, life: 1.6 },
    pick:     { name: '광부 곡괭이',   cost: 0, rate: 0.4,  dmg: 6, melee: true, reach: 50, arc: 1.9, color: '#e0d2b0' },
  };
  const BASH = { name: '등불 후려치기', cost: 0, rate: 0.45, dmg: 3, melee: true, reach: 44, arc: 1.7, color: '#ffb347' };
  const CHEST_POOL = [null,
    ['repeater', 'scatter', 'pick', 'firefly'],
    ['repeater', 'scatter', 'pick', 'firefly', 'lance'],
    ['scatter', 'firefly', 'lance', 'lobber', 'pick', 'repeater'],
    ['lance', 'lobber', 'scatter', 'firefly', 'repeater'],
    ['lance', 'lobber', 'scatter', 'firefly']];

  const ENEMIES = {
    rat:    { name: '그림자쥐',   hp: 6,   r: 9,  speed: 115, color: '#c9b089', ai: 'chase' },
    bat:    { name: '동굴박쥐',   hp: 5,   r: 8,  speed: 90,  color: '#c99be0', ai: 'dash' },
    miner:  { name: '해골 광부',  hp: 11,  r: 11, speed: 60,  color: '#e9e2cf', ai: 'shooter', rate: 1.7, bs: 180 },
    slime:  { name: '이끼 덩어리', hp: 20, r: 14, speed: 32,  color: '#86d46f', ai: 'ring',    rate: 2.6, bs: 120 },
    thief:  { name: '기름 도둑',  hp: 9,   r: 10, speed: 135, color: '#f0b85a', ai: 'thief', steal: 18 },
    golem:  { name: '돌 파수꾼',  hp: 38,  r: 16, speed: 40,  color: '#b4b4b4', ai: 'burst',   rate: 2.2, bs: 210 },
    wraith: { name: '등불 망령',  hp: 22,  r: 12, speed: 75,  color: '#a6f2ff', ai: 'orbit',   rate: 1.3, bs: 230, drain: 10 },
    keeper: { name: '심연지기',   hp: 420, r: 28, speed: 45,  color: '#ff6b6b', ai: 'boss',    bs: 170, boss: true },
  };
  const POOLS = [null,
    ['rat', 'bat', 'miner', 'rat'],
    ['rat', 'bat', 'miner', 'slime', 'thief'],
    ['miner', 'slime', 'thief', 'golem', 'bat'],
    ['slime', 'thief', 'golem', 'wraith', 'miner'],
    ['golem', 'wraith', 'thief', 'slime', 'miner']];

  const PERKS = [
    { id: 'tough',  name: '튼튼한 몸',  desc: '최대 HP +2, 바로 2 회복',             max: 4, apply: (p) => { p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2); } },
    { id: 'sharp',  name: '뜨거운 불꽃', desc: '주는 피해 +20%',                     max: 4, apply: (p) => { p.dmgMul += 0.2; } },
    { id: 'quick',  name: '빠른 손',    desc: '공격 속도 +15%',                      max: 3, apply: (p) => { p.rateMul += 0.15; } },
    { id: 'lamp',   name: '넓은 등불',  desc: '불빛 반경 +40',                       max: 3, apply: (p) => { p.lightBonus += 40; } },
    { id: 'thrift', name: '기름 절약',  desc: '무기 기름 소모 -25%',                 max: 2, apply: (p) => { p.oilMul *= 0.75; } },
    { id: 'tank',   name: '큰 기름통',  desc: '기름 최대 +30, 가득 채움',            max: 2, apply: (p) => { p.maxOil += 30; p.oil = p.maxOil; } },
    { id: 'leech',  name: '흡혈',       desc: '적을 쓰러뜨리면 8% 확률로 HP 1 회복', max: 3, apply: (p) => { p.leech += 0.08; } },
    { id: 'twin',   name: '겹불',       desc: '25% 확률로 탄 하나 더',               max: 2, apply: (p) => { p.twin += 0.25; } },
    { id: 'feet',   name: '재빠른 발',  desc: '이동 속도 +10%, 구르기 대기 -20%',    max: 2, apply: (p) => { p.speedMul += 0.1; p.dashMul *= 0.8; } },
  ];

  // ---------- 도구 ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 무시 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const idx = (x, y) => y * MW + x;
  function josa(word, pair) {
    const c = word.charCodeAt(word.length - 1);
    const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
    const [a, b] = pair.split('/');
    return word + (has ? a : b);
  }

  // ---------- 상태 ----------
  let S = null;          // 한 판
  let mode = 'title';    // title | play | perk | pause | help | end
  let helpBack = 'title';
  const cam = { x: 0, y: 0 };
  let shake = 0;

  function newPlayer() {
    return {
      x: 0, y: 0, r: 10, hp: 6, maxHp: 6, oil: 100, maxOil: 100,
      weapons: ['pistol', null], cur: 0, cd: 0, inv: 0,
      fx: 1, fy: 0, ax: 1, ay: 0, dash: 0, dashCd: 0, dx: 0, dy: 0,
      dmgMul: 1, rateMul: 1, speedMul: 1, oilMul: 1, lightBonus: 0, leech: 0, twin: 0, dashMul: 1, perks: {},
    };
  }

  // ---------- 지도 ----------
  function solidAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    const k = idx(tx, ty);
    return S.map[k] === WALL || S.lock[k] === 1;
  }
  function hitsWall(x, y, r) {
    const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS);
    const y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!solidAt(tx, ty)) continue;
        const nx = clamp(x, tx * TS, tx * TS + TS), ny = clamp(y, ty * TS, ty * TS + TS);
        if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
      }
    }
    return false;
  }
  // 축마다 따로 움직여서 벽을 타고 미끄러짐. 막혔으면 true
  function moveBody(b, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (b.r * 0.7)));
    let blocked = false;
    for (let i = 0; i < steps; i++) {
      const sx = dx / steps, sy = dy / steps;
      if (sx && !hitsWall(b.x + sx, b.y, b.r)) b.x += sx; else if (sx) blocked = true;
      if (sy && !hitsWall(b.x, b.y + sy, b.r)) b.y += sy; else if (sy) blocked = true;
    }
    return blocked;
  }
  function lineOfSight(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 10);
    for (let i = 1; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
      if (solidAt(Math.floor(x / TS), Math.floor(y / TS))) return false;
    }
    return true;
  }

  function genFloor() {
    const d = S.depth;
    const map = new Uint8Array(MW * MH);
    const key = (x, y) => x + ',' + y;
    const cells = new Map();
    const target = Math.min(GW * GH, 6 + Math.floor(d / 2));
    const first = { gx: rnd(0, GW - 1), gy: rnd(0, GH - 1), depth: 0, kids: 0 };
    const rooms = [first];
    cells.set(key(first.gx, first.gy), first);
    const links = [];
    for (let guard = 0; rooms.length < target && guard < 500; guard++) {
      const from = pick(rooms);
      const [dx, dy] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nx = from.gx + dx, ny = from.gy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || cells.has(key(nx, ny))) continue;
      const c = { gx: nx, gy: ny, depth: from.depth + 1, kids: 0 };
      from.kids++;
      cells.set(key(nx, ny), c);
      rooms.push(c);
      links.push([from, c]);
    }
    for (const r of rooms) {
      r.w = rnd(11, 15); r.h = rnd(9, 12);
      r.x = r.gx * CW + Math.floor((CW - r.w) / 2);
      r.y = r.gy * CH + Math.floor((CH - r.h) / 2);
      r.doors = []; r.type = 'fight'; r.cleared = false; r.seen = false; r.active = false; r.wave = 0; r.waves = 0; r.links = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map[idx(x, y)] = FLOOR;
    }
    for (const [a, b] of links) {
      a.links.push(b); b.links.push(a);
      if (a.gy === b.gy) {
        const [l, r] = a.gx < b.gx ? [a, b] : [b, a];
        const yc = l.gy * CH + (CH >> 1);
        for (let x = l.x + l.w; x < r.x; x++) for (let y = yc - 1; y <= yc + 1; y++) map[idx(x, y)] = FLOOR;
        for (let y = yc - 1; y <= yc + 1; y++) { l.doors.push(idx(l.x + l.w, y)); r.doors.push(idx(r.x - 1, y)); }
      } else {
        const [t, bo] = a.gy < b.gy ? [a, b] : [b, a];
        const xc = t.gx * CW + (CW >> 1);
        for (let y = t.y + t.h; y < bo.y; y++) for (let x = xc - 1; x <= xc + 1; x++) map[idx(x, y)] = FLOOR;
        for (let x = xc - 1; x <= xc + 1; x++) { t.doors.push(idx(x, t.y + t.h)); bo.doors.push(idx(x, bo.y - 1)); }
      }
    }

    // 방 역할: 시작 · 출구(가장 먼 방) · 보물(막다른 방) · 나머지 전투
    const start = rooms[0];
    start.type = 'start'; start.cleared = true;
    const exit = rooms.slice(1).sort((a, b) => b.depth - a.depth)[0];
    exit.type = d === MAX_DEPTH ? 'boss' : 'exit';
    if (exit.type === 'exit') exit.cleared = true;
    const leaves = rooms.filter((r) => r.type === 'fight' && r.kids === 0);
    const treasure = leaves.length ? pick(leaves) : rooms.find((r) => r.type === 'fight');
    if (treasure) { treasure.type = 'treasure'; treasure.cleared = true; }

    S.map = map;
    S.lock = new Uint8Array(MW * MH);
    S.rooms = rooms;
    S.enemies = []; S.bullets = []; S.ebullets = []; S.items = []; S.fx = []; S.texts = []; S.spawns = [];

    // 전투방에 기둥(엄폐물). 복도가 들어오는 가운데 줄은 비움
    for (const r of rooms) {
      if (r.type !== 'fight' || r.w < 13 || r.h < 10) continue;
      for (const [px, py] of [[r.x + 2, r.y + 2], [r.x + r.w - 4, r.y + r.h - 4]]) {
        for (let y = py; y < py + 2; y++) for (let x = px; x < px + 2; x++) map[idx(x, y)] = WALL;
      }
    }
    for (const r of rooms) {
      if (r.type === 'fight') r.waves = 2 + (d >= 4 ? 1 : 0);
      if (r.type === 'treasure') S.items.push({ kind: 'chest', x: (r.x + r.w / 2) * TS, y: (r.y + r.h / 2) * TS, r: 14 });
      if (r.type === 'exit') S.items.push({ kind: 'stairs', x: (r.x + r.w / 2) * TS, y: (r.y + r.h / 2) * TS, r: 16 });
    }
    const p = S.p;
    p.x = (start.x + start.w / 2) * TS; p.y = (start.y + start.h / 2) * TS;
    p.inv = 0; p.dash = 0; p.cd = 0;
    cam.x = p.x; cam.y = p.y;
  }

  function roomAt(x, y, margin = 0) {
    for (const r of S.rooms) {
      if (x > r.x * TS + margin && x < (r.x + r.w) * TS - margin && y > r.y * TS + margin && y < (r.y + r.h) * TS - margin) return r;
    }
    return null;
  }

  // ---------- 방 전투 ----------
  function startRoom(r) {
    r.active = true;
    for (const k of r.doors) S.lock[k] = 1;
    S.room = r;
    if (r.type === 'boss') {
      toast('심연지기가 깨어났다!');
      queueSpawn(r, 'keeper', (r.x + r.w / 2) * TS, (r.y + r.h / 2) * TS, 1.2);
      r.waves = 1;
    } else {
      toast('문이 잠겼다!');
      spawnWave(r);
    }
    sfx('lock');
  }
  function spawnWave(r) {
    const d = S.depth, p = S.p;
    const n = 2 + d + rnd(0, 2);
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0;
      for (let t = 0; t < 30; t++) {
        x = (r.x + 1 + Math.random() * (r.w - 2)) * TS;
        y = (r.y + 1 + Math.random() * (r.h - 2)) * TS;
        if (Math.hypot(x - p.x, y - p.y) > 130 && !hitsWall(x, y, 18)) break;
      }
      queueSpawn(r, pick(POOLS[d]), x, y, 0.7 + Math.random() * 0.3);
    }
  }
  function queueSpawn(r, type, x, y, t) { S.spawns.push({ room: r, type, x, y, t, max: t }); }
  function spawnEnemy(s) {
    const E = ENEMIES[s.type], d = S.depth;
    const scale = E.boss ? 1 : 1 + 0.18 * (d - 1);
    const hp = Math.round(E.hp * scale);
    S.enemies.push({
      type: s.type, x: s.x, y: s.y, r: E.r, hp, maxHp: hp, room: s.room,
      t: 0, cd: rand(0.6, 1.4), flash: 0, kx: 0, ky: 0, state: 'idle', wait: rand(0.8, 1.6),
      side: Math.random() < 0.5 ? -1 : 1, ang: Math.random() * 6.283, flee: 0, pat: 0, patT: 0, spin: 0,
    });
  }
  function checkRoom() {
    const r = S.room;
    if (!r || !r.active) return;
    if (S.enemies.some((e) => e.room === r) || S.spawns.some((s) => s.room === r)) return;
    r.wave++;
    if (r.wave < r.waves) { spawnWave(r); return; }
    r.active = false; r.cleared = true; S.room = null;
    for (const k of r.doors) S.lock[k] = 0;
    const cx = (r.x + r.w / 2) * TS, cy = (r.y + r.h / 2) * TS;
    if (r.type === 'boss') {
      S.items.push({ kind: 'ember', x: cx, y: cy, r: 14 });
      toast('심연지기가 무너졌다. 불씨를 들어라!');
      sfx('clear');
      return;
    }
    toast('방을 정리했다');
    sfx('clear');
    for (let i = 0; i < 3; i++) dropOil(cx + rand(-20, 20), cy + rand(-20, 20), 5);
    if (Math.random() < 0.3) S.items.push({ kind: 'heart', x: cx, y: cy + 24, r: 9 });
  }

  // ---------- 전투 ----------
  function weapon() { return WEAPONS[S.p.weapons[S.p.cur]]; }
  function lightRadius() {
    const p = S.p;
    return 110 + (p.oil / p.maxOil) * 170 + p.lightBonus;
  }
  function findTarget() {
    const p = S.p, range = lightRadius() + 90;   // 기름이 바닥나도 200px까지는 겨냥
    let best = null, bd = range;
    for (const e of S.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
      if (d < bd && lineOfSight(p.x, p.y, e.x, e.y)) { bd = d; best = e; }
    }
    return best;
  }

  function shoot() {
    const p = S.p, W = weapon();
    const cost = W.cost * p.oilMul;
    if (p.oil < cost) {
      // 기름이 모자라면 등불로 후려친다 (무료 근접) — 잠긴 방에서 갇히지 않게
      if (!S.noOilT) { toast('기름이 없다 — 등불로 후려친다'); S.noOilT = 2.5; }
      p.cd = BASH.rate / p.rateMul;
      swing(BASH, Math.atan2(p.ay, p.ax));
      return;
    }
    p.oil = Math.max(0, p.oil - cost);
    p.cd = W.rate / p.rateMul;
    const base = Math.atan2(p.ay, p.ax);
    if (W.melee) { swing(W, base); return; }
    const n = W.count + (p.twin && Math.random() < p.twin ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = base + (W.count > 1 ? (i / (n - 1 || 1) - 0.5) * W.spread : rand(-0.5, 0.5) * W.spread) + (i >= W.count ? 0.12 : 0);
      const sp = W.speed * rand(0.92, 1.05);
      S.bullets.push({
        x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: W.r, dmg: W.dmg * p.dmgMul, life: W.life || 1.3, pierce: !!W.pierce, explode: W.explode || 0,
        homing: W.homing || 0, color: W.color, hit: W.pierce ? new Set() : null,
      });
    }
    burst(p.x + p.ax * 14, p.y + p.ay * 14, W.color, 3, 60);
    sfx('shot');
  }
  function swing(W, base) {
    const p = S.p;
    S.fx.push({ kind: 'arc', x: p.x, y: p.y, a: base, arc: W.arc, reach: W.reach, t: 0, max: 0.16 });
    for (const e of S.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > W.reach + e.r) continue;
      let da = Math.atan2(e.y - p.y, e.x - p.x) - base;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= W.arc / 2 || d < e.r + p.r + 4) damage(e, W.dmg * p.dmgMul, (e.x - p.x) / d, (e.y - p.y) / d, 240);
    }
    // 휘두르면 적 탄도 쳐낸다
    S.ebullets = S.ebullets.filter((b) => {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d > W.reach + 6) return true;
      let da = Math.atan2(b.y - p.y, b.x - p.x) - base;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > W.arc / 2) return true;
      burst(b.x, b.y, '#ffffff', 3, 80);
      return false;
    });
    sfx('swing');
  }

  function damage(e, dmg, nx, ny, kb = 90) {
    e.hp -= dmg;
    e.flash = 0.09;
    if (!ENEMIES[e.type].boss) { e.kx += nx * kb; e.ky += ny * kb; }
    S.texts.push({ x: e.x + rand(-6, 6), y: e.y - e.r - 4, text: String(Math.round(dmg)), color: '#fff3d6', t: 0 });
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {
    const E = ENEMIES[e.type], p = S.p;
    S.enemies.splice(S.enemies.indexOf(e), 1);
    S.kills++;
    burst(e.x, e.y, E.color, E.boss ? 60 : 14, E.boss ? 260 : 150);
    if (!E.boss) {
      if (Math.random() < 0.5) dropOil(e.x, e.y, rnd(3, 6));
      if (Math.random() < 0.035) S.items.push({ kind: 'heart', x: e.x, y: e.y, r: 9 });
    }
    if (p.leech && Math.random() < p.leech && p.hp < p.maxHp) { p.hp++; S.texts.push({ x: p.x, y: p.y - 20, text: '+1', color: '#ff8a8a', t: 0 }); }
    shake = Math.max(shake, E.boss ? 16 : 3);
    sfx(E.boss ? 'boom' : 'kill');
    checkRoom();
  }
  function explode(x, y, R, dmg) {
    S.fx.push({ kind: 'boom', x, y, R, t: 0, max: 0.3 });
    burst(x, y, '#ff9a4a', 22, 220);
    for (const e of S.enemies.slice()) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < R + e.r) damage(e, dmg * (d < R * 0.5 ? 1 : 0.6), (e.x - x) / (d || 1), (e.y - y) / (d || 1), 160);
    }
    shake = Math.max(shake, 6);
    sfx('boom');
  }
  function dropOil(x, y, amount) { S.items.push({ kind: 'oil', x, y, r: 6, amount, vx: rand(-60, 60), vy: rand(-60, 60) }); }

  function hurtPlayer(n, cause) {
    const p = S.p;
    if (p.inv > 0 || mode !== 'play') return;
    p.hp -= n;
    p.inv = 0.9;
    shake = Math.max(shake, 7);
    document.body.classList.remove('hurt');
    void document.body.offsetWidth;
    document.body.classList.add('hurt');
    sfx('hurt');
    if (p.hp <= 0) finish(false, `지하 ${S.depth}층에서 ${cause}에게 쓰러졌다.`);
  }

  function eShot(x, y, a, speed, r = 5) {
    const sp = speed * (1 + 0.05 * (S.depth - 1));
    S.ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, life: 4 });
  }

  function updEnemy(e, dt) {
    const E = ENEMIES[e.type], p = S.p;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const aim = Math.atan2(dy, dx);
    e.t += dt; e.cd -= dt; e.flash = Math.max(0, e.flash - dt);
    let mx = 0, my = 0, sp = E.speed * (1 + 0.04 * (S.depth - 1));
    const canSee = () => lineOfSight(e.x, e.y, p.x, p.y);
    switch (E.ai) {
      case 'chase': mx = ux; my = uy; break;
      case 'dash':
        if (e.state === 'dash') {
          mx = e.dx; my = e.dy; sp *= 3.4;
          if (e.t > 0.32) { e.state = 'idle'; e.t = 0; e.wait = rand(0.9, 1.8); }
        } else {
          e.ang += rand(-3, 3) * dt;
          mx = Math.cos(e.ang); my = Math.sin(e.ang);
          if (e.t > e.wait) { e.state = 'dash'; e.t = 0; e.dx = ux; e.dy = uy; }
        }
        break;
      case 'shooter':
        if (d < 140) { mx = -ux; my = -uy; } else if (d > 240) { mx = ux; my = uy; } else { mx = -uy * e.side * 0.7; my = ux * e.side * 0.7; }
        if (e.cd <= 0 && d < 520 && canSee()) { eShot(e.x, e.y, aim + rand(-0.08, 0.08), E.bs); e.cd = E.rate * rand(0.8, 1.2); }
        break;
      case 'ring':
        mx = ux * 0.6; my = uy * 0.6;
        if (e.cd <= 0) { const o = Math.random() * 6.283; for (let i = 0; i < 8; i++) eShot(e.x, e.y, o + (i / 8) * 6.283, E.bs); e.cd = E.rate * rand(0.85, 1.15); }
        break;
      case 'burst':
        if (d > 190) { mx = ux; my = uy; }
        if (e.cd <= 0 && d < 560 && canSee()) { for (let i = -1; i <= 1; i++) eShot(e.x, e.y, aim + i * 0.22, E.bs, 6); e.cd = E.rate * rand(0.85, 1.15); }
        break;
      case 'thief':
        if (e.flee > 0) { e.flee -= dt; mx = -ux; my = -uy; sp *= 1.3; } else { mx = ux; my = uy; }
        break;
      case 'orbit': {
        const want = 165;
        const radial = (d - want) / want;
        mx = ux * radial - uy * e.side; my = uy * radial + ux * e.side;
        const m = Math.hypot(mx, my) || 1; mx /= m; my /= m;
        if (e.cd <= 0 && canSee()) { eShot(e.x, e.y, aim, E.bs); e.cd = E.rate * rand(0.8, 1.2); e.hold = 0.35; }
        break;
      }
      case 'boss': bossAI(e, E, dt, aim, d); mx = d > 200 ? ux * 0.7 : -ux * 0.3; my = d > 200 ? uy * 0.7 : -uy * 0.3; break;
    }
    if (e.hold > 0) { e.hold -= dt; mx = my = 0; }   // 쏜 직후 잠깐 멈춤
    const ox = e.x, oy = e.y;
    const blocked = moveBody(e, (mx * sp + e.kx) * dt, (my * sp + e.ky) * dt);
    e.vx = (e.x - ox) / dt; e.vy = (e.y - oy) / dt;  // 앞질러 겨냥할 때 씀
    e.kx *= 0.82; e.ky *= 0.82;
    if (blocked) { e.side = -e.side; e.ang += Math.PI * 0.7; if (e.state === 'dash') { e.state = 'idle'; e.t = 0; } }

    // 몸으로 부딪힘
    if (d < e.r + p.r) {
      if (E.ai === 'thief' && e.flee <= 0) {
        if (p.inv <= 0 && p.dash <= 0) {
          const s = Math.min(p.oil, E.steal);
          p.oil -= s;
          e.flee = 2.2;
          p.inv = 0.5;
          S.texts.push({ x: p.x, y: p.y - 22, text: `기름 -${Math.round(s)}`, color: '#ffb347', t: 0 });
          toast('기름 도둑이 기름을 훔쳤다!');
          sfx('hurt');
        }
      } else if (p.dash <= 0) {
        if (E.drain && p.inv <= 0) p.oil = Math.max(0, p.oil - E.drain);
        hurtPlayer(1, E.name);
      }
    }
  }

  function bossAI(e, E, dt, aim, d) {
    e.patT += dt;
    const half = e.hp < e.maxHp * 0.5;
    if (e.patT > 4.2) { e.patT = 0; e.pat = (e.pat + 1) % 4; e.cd = 0.4; }
    if (e.cd > 0) return;
    switch (e.pat) {
      case 0: { const n = half ? 22 : 16, o = Math.random() * 6.283; for (let i = 0; i < n; i++) eShot(e.x, e.y, o + (i / n) * 6.283, E.bs); e.cd = half ? 0.9 : 1.2; break; }
      case 1: { e.spin += 0.32; for (let k = 0; k < 3; k++) eShot(e.x, e.y, e.spin + (k * 6.283) / 3, E.bs * 1.1, 5); e.cd = half ? 0.07 : 0.1; break; }
      case 2: { const n = half ? 9 : 7; for (let i = 0; i < n; i++) eShot(e.x, e.y, aim + (i / (n - 1) - 0.5) * 1.0, E.bs * 1.35, 6); e.cd = 0.85; break; }
      case 3: {
        if (half && S.enemies.length < 6) {
          for (let i = 0; i < 3; i++) queueSpawn(e.room, pick(['rat', 'bat', 'thief']), e.x + rand(-90, 90), e.y + rand(-90, 90), 0.8);
          e.cd = 3;
        } else { const n = 12, o = e.spin; for (let i = 0; i < n; i++) eShot(e.x, e.y, o + (i / n) * 6.283, E.bs * 0.8, 7); e.spin += 0.26; e.cd = 0.6; }
        break;
      }
    }
  }

  // ---------- 갱신 ----------
  function update(dt) {
    const p = S.p;
    S.time += dt;
    if (S.noOilT) S.noOilT = Math.max(0, S.noOilT - dt);

    // 이동 · 구르기
    let mx = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0) + touch.x;
    let my = (held('ArrowDown', 'KeyS') ? 1 : 0) - (held('ArrowUp', 'KeyW') ? 1 : 0) + touch.y;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    if (m > 0.15) { const fm = Math.hypot(mx, my); p.fx = mx / fm; p.fy = my / fm; }
    p.dashCd = Math.max(0, p.dashCd - dt);
    if (pressed('KeyK', 'ShiftLeft', 'ShiftRight') || touch.dash) {
      touch.dash = false;
      if (p.dashCd <= 0) {
        p.dash = 0.2; p.dashCd = 0.85 * p.dashMul;
        p.dx = p.fx; p.dy = p.fy;
        p.inv = Math.max(p.inv, 0.26);
        sfx('dash');
      }
    }
    const speed = 155 * p.speedMul;
    if (p.dash > 0) {
      p.dash -= dt;
      moveBody(p, p.dx * speed * 3.3 * dt, p.dy * speed * 3.3 * dt);
      if (Math.random() < 0.6) S.fx.push({ kind: 'dot', x: p.x, y: p.y, t: 0, max: 0.25, color: '#ffd9a0', size: 4 });
    } else {
      moveBody(p, mx * speed * dt, my * speed * dt);
    }
    p.inv = Math.max(0, p.inv - dt);

    // 방 들어가기
    const here = roomAt(p.x, p.y, -TS * 2);
    if (here) here.seen = true;
    const inside = roomAt(p.x, p.y, TS * 0.65);
    if (inside && !inside.cleared && !inside.active && (inside.type === 'fight' || inside.type === 'boss')) startRoom(inside);

    // 조준 · 사격
    const target = findTarget();
    if (target) {
      // 탄이 닿을 때쯤 있을 자리를 80%만큼 앞질러 겨냥 (근접 무기는 지금 자리)
      const W0 = weapon();
      let tx = target.x, ty = target.y;
      if (!W0.melee && target.vx !== undefined) {
        for (let i = 0; i < 2; i++) {
          const tt = Math.hypot(tx - p.x, ty - p.y) / W0.speed;
          tx = target.x + target.vx * tt * 0.8; ty = target.y + target.vy * tt * 0.8;
        }
      }
      const d = Math.hypot(tx - p.x, ty - p.y) || 1;
      p.ax = (tx - p.x) / d; p.ay = (ty - p.y) / d;
    } else { p.ax = p.fx; p.ay = p.fy; }
    S.target = target;
    p.cd -= dt;
    if ((held('KeyJ', 'Space') || touch.fire) && p.cd <= 0) shoot();

    // 무기 교체
    if (pressed('KeyQ', 'Tab')) swapWeapon(1 - p.cur);
    if (pressed('Digit1')) swapWeapon(0);
    if (pressed('Digit2')) swapWeapon(1);
    if (touch.swap) { touch.swap = false; swapWeapon(1 - p.cur); }

    // 상호작용
    const near = nearestItem();
    S.near = near;
    if ((pressed('KeyE', 'Enter', 'NumpadEnter') || touch.interact) && near) interact(near);
    touch.interact = false;

    // 등장 예고 → 적
    for (const s of S.spawns) s.t -= dt;
    for (const s of S.spawns.filter((q) => q.t <= 0)) spawnEnemy(s);
    S.spawns = S.spawns.filter((q) => q.t > 0);

    for (const e of S.enemies.slice()) { updEnemy(e, dt); if (mode !== 'play') return; }
    // 적끼리 겹치지 않게
    for (let i = 0; i < S.enemies.length; i++) {
      for (let j = i + 1; j < S.enemies.length; j++) {
        const a = S.enemies[i], b = S.enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d > 0 && d < min) {
          const push = (min - d) / 2, nx = dx / d, ny = dy / d;
          moveBody(a, -nx * push, -ny * push); moveBody(b, nx * push, ny * push);
        }
      }
    }

    // 내 탄
    for (const b of S.bullets) {
      b.life -= dt;
      if (b.life <= 0) { if (b.explode) explode(b.x, b.y, b.explode, b.dmg); continue; }   // 사거리 끝
      if (b.homing) {
        let best = null, bd = 260;
        for (const e of S.enemies) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; best = e; } }
        if (best) {
          const want = Math.atan2(best.y - b.y, best.x - b.x), cur = Math.atan2(b.vy, b.vx);
          let da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
          const na = cur + clamp(da, -b.homing * dt, b.homing * dt), sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (solidAt(Math.floor(b.x / TS), Math.floor(b.y / TS))) {
        b.life = 0;
        if (b.explode) explode(b.x - b.vx * dt, b.y - b.vy * dt, b.explode, b.dmg);
        else burst(b.x, b.y, b.color, 3, 50);
        continue;
      }
      for (const e of S.enemies.slice()) {
        if (b.life <= 0) break;
        if (b.hit && b.hit.has(e)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          if (b.explode) { b.life = 0; explode(b.x, b.y, b.explode, b.dmg); break; }
          damage(e, b.dmg, b.vx / sp, b.vy / sp);
          if (b.pierce) b.hit.add(e); else b.life = 0;
        }
      }
    }
    S.bullets = S.bullets.filter((b) => b.life > 0);
    if (mode !== 'play') return;

    // 적 탄
    for (const b of S.ebullets) {
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (solidAt(Math.floor(b.x / TS), Math.floor(b.y / TS))) { b.life = 0; continue; }
      if (p.dash <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r - 3) {
        b.life = 0;
        hurtPlayer(1, S.room && S.room.type === 'boss' ? '심연지기의 탄' : '날아온 탄');
        if (mode !== 'play') return;
      }
    }
    S.ebullets = S.ebullets.filter((b) => b.life > 0);

    // 물건
    for (const it of S.items) {
      if (it.kind === 'oil' || it.kind === 'heart') {
        if (it.vx) { it.x += it.vx * dt; it.y += it.vy * dt; it.vx *= 0.9; it.vy *= 0.9; if (Math.abs(it.vx) < 2) it.vx = it.vy = 0; }
        const d = Math.hypot(p.x - it.x, p.y - it.y);
        const wants = it.kind === 'oil' ? p.oil < p.maxOil : p.hp < p.maxHp;
        if (wants && d < 90) { const k = Math.min(1, dt * 7); it.x += (p.x - it.x) * k; it.y += (p.y - it.y) * k; }
        if (wants && d < p.r + it.r + 2) {
          it.gone = true;
          if (it.kind === 'oil') { p.oil = Math.min(p.maxOil, p.oil + it.amount); sfx('oil'); }
          else { p.hp = Math.min(p.maxHp, p.hp + 1); S.texts.push({ x: p.x, y: p.y - 20, text: '+1', color: '#ff8a8a', t: 0 }); sfx('heal'); }
        }
      } else if (it.kind === 'ember' && Math.hypot(p.x - it.x, p.y - it.y) < p.r + it.r) {
        return finish(true, `${fmtTime(S.time)} 만에 심연의 불씨를 되찾았다.`);
      }
    }
    S.items = S.items.filter((it) => !it.gone);

    // 효과
    for (const f of S.fx) { f.t += dt; if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; } }
    S.fx = S.fx.filter((f) => f.t < f.max);
    if (S.fx.length > 600) S.fx.splice(0, S.fx.length - 600);
    for (const t of S.texts) t.t += dt;
    S.texts = S.texts.filter((t) => t.t < 0.7);
    shake = Math.max(0, shake - dt * 40);
  }

  function swapWeapon(i) {
    const p = S.p;
    if (i === p.cur || !p.weapons[i]) return;
    p.cur = i;
    p.cd = Math.max(p.cd, 0.12);
    toast(WEAPONS[p.weapons[i]].name);
    sfx('swap');
  }

  function nearestItem() {
    const p = S.p;
    let best = null, bd = 44;
    for (const it of S.items) {
      if (it.kind !== 'chest' && it.kind !== 'weapon' && it.kind !== 'stairs') continue;
      if (it.kind === 'chest' && it.opened) continue;
      const d = Math.hypot(p.x - it.x, p.y - it.y) - it.r;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  function interact(it) {
    const p = S.p;
    if (it.kind === 'chest') {
      it.opened = true;
      const owned = new Set(p.weapons);
      const pool = CHEST_POOL[S.depth].filter((w) => !owned.has(w));
      const w = pick(pool.length ? pool : CHEST_POOL[S.depth]);
      S.items.push({ kind: 'weapon', w, x: it.x, y: it.y + 34, r: 12 });
      for (let i = 0; i < 2; i++) dropOil(it.x + rand(-16, 16), it.y + 20, 6);
      if (Math.random() < 0.4) S.items.push({ kind: 'heart', x: it.x + 26, y: it.y + 20, r: 9 });
      burst(it.x, it.y, '#ffd36e', 18, 140);
      sfx('chest');
    } else if (it.kind === 'weapon') {
      const empty = p.weapons.indexOf(null);
      if (empty >= 0) { p.weapons[empty] = it.w; p.cur = empty; it.gone = true; }
      else { const old = p.weapons[p.cur]; p.weapons[p.cur] = it.w; it.w = old; }
      S.items = S.items.filter((q) => !q.gone);
      toast(`${josa(WEAPONS[p.weapons[p.cur]].name, '을/를')} 들었다`);
      sfx('swap');
    } else if (it.kind === 'stairs') {
      openPerks();
    }
  }

  // ---------- 특성 · 층 ----------
  let perkChoices = [];
  function openPerks() {
    const p = S.p;
    perkChoices = PERKS.filter((k) => (p.perks[k.id] || 0) < k.max).sort(() => Math.random() - 0.5).slice(0, 3);
    if (!perkChoices.length) { nextFloor(); return; }
    $('perkList').innerHTML = perkChoices.map((k, i) => {
      const n = p.perks[k.id] || 0;
      return `<button type="button" data-perk="${i}"><kbd>${i + 1}</kbd><span><span class="pn">${k.name}${n ? ` ${n + 1}단계` : ''}</span><span class="pd">${k.desc}</span></span></button>`;
    }).join('');
    show('perk');
  }
  function choosePerk(i) {
    const k = perkChoices[i];
    if (!k || mode !== 'perk') return;
    const p = S.p;
    k.apply(p);
    p.perks[k.id] = (p.perks[k.id] || 0) + 1;
    nextFloor();
    show('play');
  }
  function nextFloor() {
    S.depth++;
    genFloor();
    save();
    toast(S.depth === MAX_DEPTH ? `지하 ${S.depth}층 — 불씨가 가까이 있다` : `지하 ${S.depth}층`);
  }

  function newRun() {
    S = { depth: 0, kills: 0, time: 0, p: newPlayer() };
    nextFloor();
  }

  // ---------- 저장 (층 시작 시점) ----------
  function save() {
    if (!S || mode === 'end') return;
    const p = Object.assign({}, S.p);
    store.set(SAVE_KEY, JSON.stringify({ v: 2, depth: S.depth, kills: S.kills, time: S.time, p }));
  }
  function loadSave() {
    try {
      const d = JSON.parse(store.get(SAVE_KEY));
      return d && d.v === 2 ? d : null;
    } catch (e) { return null; }
  }
  function continueRun() {
    const d = loadSave();
    if (!d) return startNew();
    S = { depth: d.depth - 1, kills: d.kills, time: d.time, p: Object.assign(newPlayer(), d.p) };
    nextFloor();
    show('play');
  }

  // ---------- 끝 ----------
  const fmtTime = (s) => `${Math.floor(s / 60)}분 ${String(Math.floor(s % 60)).padStart(2, '0')}초`;
  function readBest() {
    try { return JSON.parse(store.get(BEST_KEY)) || { depth: 0, wins: 0, runs: 0 }; } catch (e) { return { depth: 0, wins: 0, runs: 0 }; }
  }
  function finish(won, cause) {
    mode = 'end';
    store.del(SAVE_KEY);
    const best = readBest();
    best.runs = (best.runs || 0) + 1;
    best.depth = Math.max(best.depth || 0, S.depth);
    if (won) best.wins = (best.wins || 0) + 1;
    store.set(BEST_KEY, JSON.stringify(best));
    $('eTitle').textContent = won ? '불씨를 되찾았다!' : '등불이 꺼졌다';
    $('eCause').textContent = cause;
    const rows = [['도달한 층', `B${S.depth}`], ['쓰러뜨린 적', S.kills], ['시간', fmtTime(S.time)], ['무기', S.p.weapons.filter(Boolean).map((w) => WEAPONS[w].name).join(', ')]];
    $('eStats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd style="${String(v).length > 8 ? 'font-size:14px' : ''}">${v}</dd></div>`).join('');
    burst(S.p.x, S.p.y, won ? '#ffd36e' : '#ef6b6b', 40, 200);
    sfx(won ? 'clear' : 'die');
    setTimeout(() => show('end'), 700);
  }

  // ---------- 효과음 ----------
  let ac = null;
  function unlockAudio() {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
  }
  function tone(f0, f1, dur, type, vol, delay = 0) {
    const now = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(ac.destination);
    o.start(now); o.stop(now + dur + 0.02);
  }
  let lastShot = 0;
  function sfx(k) {
    if (!ac) return;
    const t = ac.currentTime;
    if (k === 'shot') { if (t - lastShot < 0.05) return; lastShot = t; tone(520, 260, 0.05, 'square', 0.025); }
    else if (k === 'swing') tone(240, 120, 0.08, 'triangle', 0.06);
    else if (k === 'kill') tone(300, 90, 0.12, 'sawtooth', 0.04);
    else if (k === 'hurt') tone(180, 60, 0.2, 'sawtooth', 0.08);
    else if (k === 'boom') tone(120, 30, 0.35, 'sawtooth', 0.09);
    else if (k === 'oil') tone(700, 900, 0.05, 'sine', 0.03);
    else if (k === 'heal') { tone(520, 520, 0.08, 'sine', 0.06); tone(780, 780, 0.1, 'sine', 0.05, 0.06); }
    else if (k === 'lock') tone(160, 140, 0.25, 'square', 0.05);
    else if (k === 'clear') { tone(523, 523, 0.1, 'triangle', 0.06); tone(659, 659, 0.1, 'triangle', 0.06, 0.09); tone(784, 784, 0.18, 'triangle', 0.06, 0.18); }
    else if (k === 'chest') { tone(392, 784, 0.25, 'triangle', 0.06); }
    else if (k === 'swap') tone(440, 660, 0.06, 'triangle', 0.04);
    else if (k === 'dash') tone(300, 500, 0.08, 'sine', 0.04);
    else if (k === 'click') tone(900, 800, 0.03, 'square', 0.02);
    else if (k === 'die') tone(260, 40, 0.7, 'sawtooth', 0.08);
  }

  // ---------- 그리기 ----------
  let W = 0, H = 0, DPR = 1, Z = 1;
  function resize() {
    const r = $('stage').getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = dark.width = Math.round(W * DPR);
    cv.height = dark.height = Math.round(H * DPR);
    Z = clamp(Math.min(W / (17 * TS), H / (11 * TS)), 0.55, 1.7);
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = speed * rand(0.3, 1);
      S.fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rand(0.25, 0.6), color, size: rand(1.5, 3.5) });
    }
  }
  let toastT = 0;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 1600);
  }

  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (!S || !S.map) return;
    const p = S.p;
    const t = now / 1000;
    const sx0 = shake ? rand(-shake, shake) * 0.5 : 0, sy0 = shake ? rand(-shake, shake) * 0.5 : 0;
    const ox = W / 2 - cam.x * Z + sx0, oy = H / 2 - cam.y * Z + sy0;
    const toS = (x, y) => [(x * Z + ox) * DPR, (y * Z + oy) * DPR];
    ctx.setTransform(DPR * Z, 0, 0, DPR * Z, DPR * ox, DPR * oy);

    // 타일
    const tx0 = Math.max(0, Math.floor((cam.x - W / 2 / Z) / TS) - 1), tx1 = Math.min(MW - 1, Math.ceil((cam.x + W / 2 / Z) / TS) + 1);
    const ty0 = Math.max(0, Math.floor((cam.y - H / 2 / Z) / TS) - 1), ty1 = Math.min(MH - 1, Math.ceil((cam.y + H / 2 / Z) / TS) + 1);
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const k = idx(x, y);
        const X = x * TS, Y = y * TS;
        if (S.map[k] === WALL) {
          const below = y + 1 < MH && S.map[idx(x, y + 1)] !== WALL;
          const near = below || (y > 0 && S.map[idx(x, y - 1)] !== WALL) || (x > 0 && S.map[idx(x - 1, y)] !== WALL) || (x + 1 < MW && S.map[idx(x + 1, y)] !== WALL);
          if (!near) continue;
          ctx.fillStyle = '#4a3c2c';
          ctx.fillRect(X, Y, TS + 0.5, TS + 0.5);
          if (below) { ctx.fillStyle = '#2c2319'; ctx.fillRect(X, Y + TS * 0.62, TS + 0.5, TS * 0.38 + 0.5); }
          ctx.fillStyle = '#5d4b36';
          ctx.fillRect(X, Y, TS + 0.5, 3);
        } else {
          ctx.fillStyle = (x + y) & 1 ? '#1f1a14' : '#221c16';
          ctx.fillRect(X, Y, TS + 0.5, TS + 0.5);
          if (S.lock[k]) {
            ctx.fillStyle = '#3a1414';
            ctx.fillRect(X, Y, TS + 0.5, TS + 0.5);
            ctx.fillStyle = `rgba(255,${90 + Math.sin(t * 6) * 30},60,.9)`;
            for (let i = 0; i < 3; i++) ctx.fillRect(X + 5 + i * 10, Y + 3, 3, TS - 6);
          }
        }
      }
    }

    // 등장 예고
    for (const s of S.spawns) {
      const k = 1 - s.t / s.max;
      ctx.strokeStyle = `rgba(255,90,90,${0.3 + k * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 6 + k * 14, 0, 6.283); ctx.stroke();
    }

    // 물건
    for (const it of S.items) drawItem(it, t);

    // 적
    for (const e of S.enemies) drawEnemy(e, t);

    // 나
    const blink = p.inv > 0 && p.dash <= 0 && Math.floor(t * 20) % 2 === 0;
    if (!blink && mode !== 'end') {
      const W0 = weapon();
      ctx.strokeStyle = W0.color;
      ctx.lineWidth = W0.melee ? 5 : 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x + p.ax * 6, p.y + p.ay * 6); ctx.lineTo(p.x + p.ax * (W0.melee ? 22 : 18), p.y + p.ay * (W0.melee ? 22 : 18)); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#e8d9b5';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#3a2f24';
      ctx.beginPath(); ctx.arc(p.x + p.fx * 4 - p.fy * 3, p.y + p.fy * 4 + p.fx * 3, 1.8, 0, 6.283); ctx.arc(p.x + p.fx * 4 + p.fy * 3, p.y + p.fy * 4 - p.fx * 3, 1.8, 0, 6.283); ctx.fill();
      const lx = p.x - p.ay * 11, ly = p.y + p.ax * 11;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 6.283); ctx.fill();
    }

    // 탄 · 효과
    ctx.globalCompositeOperation = 'lighter';
    for (const b of S.bullets) {
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.2, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const b of S.ebullets) {
      ctx.fillStyle = '#ff4f6d';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#ffe3e8';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, 6.283); ctx.fill();
    }
    for (const f of S.fx) {
      const k = f.t / f.max;
      if (f.kind === 'dot') {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, 6.283); ctx.fill();
      } else if (f.kind === 'arc') {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff1cf'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.reach * (0.7 + k * 0.3), f.a - f.arc / 2, f.a + f.arc / 2); ctx.stroke();
      } else if (f.kind === 'boom') {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ff8a3d';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.R * (0.4 + k * 0.6), 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 어둠: 기름이 곧 불빛
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.fillStyle = 'rgba(3,3,7,0.975)';
    dctx.fillRect(0, 0, dark.width, dark.height);
    dctx.globalCompositeOperation = 'destination-out';
    for (const r of S.rooms) {
      if (!r.cleared || !r.seen) continue;   // 정리한 방은 희미하게 밝음
      const [a, b] = toS(r.x * TS, r.y * TS);
      dctx.fillStyle = 'rgba(0,0,0,0.32)';
      dctx.fillRect(a, b, r.w * TS * Z * DPR, r.h * TS * Z * DPR);
    }
    const flick = 1 + Math.sin(t * 13) * 0.02 + Math.sin(t * 7.3) * 0.015;
    const hole = (x, y, R, a = 1) => {
      const [hx, hy] = toS(x, y), RR = R * Z * DPR;
      const g = dctx.createRadialGradient(hx, hy, 0, hx, hy, RR);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.85})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath(); dctx.arc(hx, hy, RR, 0, 6.283); dctx.fill();
    };
    hole(p.x, p.y, lightRadius() * flick);
    for (const b of S.bullets) hole(b.x, b.y, 34, 0.7);
    for (const b of S.ebullets) hole(b.x, b.y, 20, 0.8);
    for (const it of S.items) hole(it.x, it.y, it.kind === 'oil' ? 22 : it.kind === 'heart' ? 18 : 46, 0.75);
    for (const s of S.spawns) hole(s.x, s.y, 34, 0.6);
    for (const f of S.fx) if (f.kind === 'boom') hole(f.x, f.y, f.R * 1.6, 0.9);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dark, 0, 0);

    // 어둠 속 눈빛
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const L = lightRadius();
    for (const e of S.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < L * 0.8 || d > 700) continue;
      const ex = e.x * Z + ox, ey = e.y * Z + oy;
      const s = Math.max(1.5, e.r * Z * 0.22);
      ctx.fillStyle = ENEMIES[e.type].boss ? '#ff3b3b' : '#ff6b6b';
      ctx.beginPath(); ctx.arc(ex - s * 1.6, ey - s, s, 0, 6.283); ctx.arc(ex + s * 1.6, ey - s, s, 0, 6.283); ctx.fill();
    }

    // 글자: 피해량 · 상호작용 안내
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px ' + getComputedStyle(document.body).fontFamily;
    for (const tx of S.texts) {
      ctx.globalAlpha = 1 - tx.t / 0.7;
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x * Z + ox, (tx.y - tx.t * 30) * Z + oy);
    }
    ctx.globalAlpha = 1;
    if (S.near && mode === 'play') {
      const it = S.near;
      const label = it.kind === 'chest' ? 'E  상자 열기' : it.kind === 'stairs' ? 'E  내려가기' : `E  ${WEAPONS[it.w].name} 들기 · 기름 ${WEAPONS[it.w].cost}`;
      const x = it.x * Z + ox, y = (it.y - it.r) * Z + oy - 18;
      const w = ctx.measureText(label).width + 18;
      ctx.fillStyle = 'rgba(10,10,14,.85)';
      ctx.fillRect(x - w / 2, y - 12, w, 24);
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2 + 0.5, y - 11.5, w - 1, 23);
      ctx.fillStyle = '#ffe2b0';
      ctx.fillText(label, x, y + 1);
    }
    drawMinimap();
  }

  function drawItem(it, t) {
    const bob = Math.sin(t * 4 + it.x) * 2;
    if (it.kind === 'oil') {
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(it.x, it.y + bob, it.r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff2cf';
      ctx.beginPath(); ctx.arc(it.x - 2, it.y + bob - 2, 2, 0, 6.283); ctx.fill();
    } else if (it.kind === 'heart') {
      const x = it.x, y = it.y + bob;
      ctx.fillStyle = '#ff6b7a';
      ctx.beginPath();
      ctx.moveTo(x, y + 7);
      ctx.bezierCurveTo(x - 12, y - 1, x - 6, y - 10, x, y - 4);
      ctx.bezierCurveTo(x + 6, y - 10, x + 12, y - 1, x, y + 7);
      ctx.fill();
    } else if (it.kind === 'chest') {
      ctx.fillStyle = it.opened ? '#4a3a26' : '#7a5530';
      ctx.fillRect(it.x - 16, it.y - 11, 32, 22);
      ctx.fillStyle = it.opened ? '#5d4b36' : '#ffd36e';
      ctx.fillRect(it.x - 16, it.y - 3, 32, 4);
      ctx.fillRect(it.x - 3, it.y - 6, 6, 9);
    } else if (it.kind === 'stairs') {
      ctx.fillStyle = '#0a0806';
      ctx.fillRect(it.x - 18, it.y - 18, 36, 36);
      ctx.fillStyle = '#5d4b36';
      for (let i = 0; i < 4; i++) ctx.fillRect(it.x - 16 + i * 2, it.y - 14 + i * 8, 32 - i * 4, 3);
      ctx.strokeStyle = `rgba(255,211,110,${0.5 + Math.sin(t * 3) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(it.x - 18, it.y - 18, 36, 36);
    } else if (it.kind === 'weapon') {
      const W0 = WEAPONS[it.w];
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath(); ctx.ellipse(it.x, it.y + 10, 14, 4, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = W0.color; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(it.x - 11, it.y + bob + 4); ctx.lineTo(it.x + 11, it.y + bob - 4); ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (it.kind === 'ember') {
      const r = it.r + Math.sin(t * 5) * 2;
      ctx.fillStyle = '#ff9d3d';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(it.x + Math.cos(a) * rr, it.y + Math.sin(a) * rr); }
      ctx.fill();
      ctx.fillStyle = '#fff2cf';
      ctx.beginPath(); ctx.arc(it.x, it.y, 4, 0, 6.283); ctx.fill();
    }
  }

  function drawEnemy(e, t) {
    const E = ENEMIES[e.type], p = S.p;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.8, e.r, e.r * 0.35, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : E.color;
    if (E.ai === 'dash') {
      const f = Math.sin(t * 22) * 4;
      ctx.beginPath(); ctx.moveTo(e.x - e.r - 6, e.y - 2 + f); ctx.lineTo(e.x, e.y + 2); ctx.lineTo(e.x + e.r + 6, e.y - 2 + f); ctx.lineTo(e.x, e.y - 4); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill();
    if (E.boss) {
      ctx.strokeStyle = '#2a0b0b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r - 6, 0, 6.283); ctx.stroke();
    }
    const ex = Math.cos(a) * e.r * 0.35, ey = Math.sin(a) * e.r * 0.35, s = Math.max(1.6, e.r * 0.16);
    ctx.fillStyle = '#1a1410';
    ctx.beginPath();
    ctx.arc(e.x + ex - ey * 0.6, e.y + ey + ex * 0.6, s, 0, 6.283);
    ctx.arc(e.x + ex + ey * 0.6, e.y + ey - ex * 0.6, s, 0, 6.283);
    ctx.fill();
    if (!E.boss && e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 3);
      ctx.fillStyle = '#ef6b6b';
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * (e.hp / e.maxHp), 3);
    }
  }

  function drawMinimap() {
    const s = W < 520 ? 1.1 : 1.6;
    const mw = MW * s, mh = MH * s;
    const x0 = W - mw - 10, y0 = 10;
    ctx.fillStyle = 'rgba(8,8,12,.6)';
    ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    const p = S.p;
    for (const r of S.rooms) {
      if (!r.seen) continue;
      for (const o of r.links) {
        if (!o.seen) continue;
        ctx.strokeStyle = '#4a4234'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0 + (r.x + r.w / 2) * s, y0 + (r.y + r.h / 2) * s); ctx.lineTo(x0 + (o.x + o.w / 2) * s, y0 + (o.y + o.h / 2) * s); ctx.stroke();
      }
    }
    for (const r of S.rooms) {
      if (!r.seen) continue;
      ctx.fillStyle = r.active ? '#7a2a2a' : r.cleared ? '#3e372b' : '#2a2620';
      ctx.fillRect(x0 + r.x * s, y0 + r.y * s, r.w * s, r.h * s);
      const cx = x0 + (r.x + r.w / 2) * s, cy = y0 + (r.y + r.h / 2) * s;
      if (r.type === 'exit') { ctx.fillStyle = '#ffd36e'; ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5); }
      if (r.type === 'treasure' && S.items.some((it) => it.kind === 'chest' && !it.opened)) { ctx.fillStyle = '#c8873a'; ctx.fillRect(cx - 2, cy - 2, 4, 4); }
      if (r.type === 'boss') { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 6.283); ctx.fill(); }
    }
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(x0 + (p.x / TS) * s, y0 + (p.y / TS) * s, 2.5, 0, 6.283); ctx.fill();
  }

  function renderHud() {
    if (!S) return;
    const p = S.p;
    $('hDepth').textContent = `B${S.depth}`;
    $('hpFill').style.width = `${clamp(p.hp / p.maxHp, 0, 1) * 100}%`;
    $('hpTxt').textContent = `HP ${Math.max(0, p.hp)}/${p.maxHp}`;
    $('oilFill').style.width = `${clamp(p.oil / p.maxOil, 0, 1) * 100}%`;
    $('oilTxt').textContent = `기름 ${Math.floor(p.oil)}/${p.maxOil}`;
    $('oilFill').parentElement.classList.toggle('low', p.oil < p.maxOil * 0.2);
    for (let i = 0; i < 2; i++) {
      const el = $('wep' + i), w = p.weapons[i];
      el.classList.toggle('on', i === p.cur && !!w);
      el.classList.toggle('empty', !w);
      el.querySelector('.wn').textContent = w ? WEAPONS[w].name : '빈 손';
      el.querySelector('.wc').textContent = w ? (WEAPONS[w].cost ? `기름 ${+(WEAPONS[w].cost * p.oilMul).toFixed(1)}` : '무료') : '';
    }
    const boss = S.enemies.find((e) => ENEMIES[e.type].boss);
    $('bossBar').hidden = !boss;
    if (boss) $('bossFill').style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
  }

  // ---------- 루프 ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (mode === 'play' && S) {
      update(dt);
      const k = Math.min(1, dt * 8);
      cam.x += (S.p.x - cam.x) * k; cam.y += (S.p.y - cam.y) * k;
    } else if (S && S.fx) {
      for (const f of S.fx) f.t += dt;
      S.fx = S.fx.filter((f) => f.t < f.max);
    }
    pressedSet.clear();
    draw(now);
    renderHud();
    requestAnimationFrame(frame);
  }

  // ---------- 화면 전환 ----------
  function show(m) {
    mode = m;
    for (const [id, name] of [['mTitle', 'title'], ['mPerk', 'perk'], ['mPause', 'pause'], ['mHelp', 'help'], ['mEnd', 'end']]) $(id).hidden = m !== name;
    heldSet.clear();
    const first = document.querySelector('.modal:not([hidden]) button:not([hidden])');
    if (first) first.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function showTitle() {
    const s = loadSave();
    $('btnContinue').hidden = !s;
    if (s) $('contInfo').textContent = `B${s.depth} 시작부터`;
    const b = readBest();
    $('rec').textContent = b.runs ? `탐험 ${b.runs}회 · 최고 B${b.depth}${b.wins ? ` · 불씨 ${b.wins}개` : ''}` : '';
    show('title');
  }
  function startNew() { unlockAudio(); newRun(); show('play'); }
  function pause() {
    if (mode !== 'play') return;
    $('psInfo').textContent = `지하 ${S.depth}층 · ${fmtTime(S.time)}`;
    show('pause');
  }
  function openHelp() { helpBack = mode; show('help'); }
  function closeHelp() { show(helpBack); }

  // ---------- 입력 ----------
  const heldSet = new Set(), pressedSet = new Set();
  const held = (...c) => c.some((k) => heldSet.has(k));
  const pressed = (...c) => c.some((k) => pressedSet.has(k));
  const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyQ', 'KeyE']);

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    const isHelp = code === 'Slash' && e.shiftKey;
    const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if (mode === 'play') {
      if (GAME_KEYS.has(code) || code === 'Enter') e.preventDefault();
      if (code === 'Escape' || code === 'KeyP') { pause(); return; }
      if (isHelp) { pause(); openHelp(); return; }
      heldSet.add(code);
      if (!e.repeat) pressedSet.add(code);
      return;
    }
    if (mode === 'title') {
      if ((code === 'Enter' || code === 'NumpadEnter') && !onButton) { e.preventDefault(); startNew(); }
      else if (code === 'KeyC' && !$('btnContinue').hidden) { e.preventDefault(); unlockAudio(); continueRun(); }
      else if (code === 'KeyN') { e.preventDefault(); startNew(); }
      else if (isHelp) { e.preventDefault(); openHelp(); }
    } else if (mode === 'perk') {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[code];
      if (n !== undefined) { e.preventDefault(); choosePerk(n); }
    } else if (mode === 'pause') {
      if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); show('play'); }
      else if (isHelp) { e.preventDefault(); openHelp(); }
      else if (code === 'KeyX') { e.preventDefault(); showTitle(); }
    } else if (mode === 'help') {
      if (code === 'Escape' || isHelp) { e.preventDefault(); closeHelp(); }
    } else if (mode === 'end') {
      if ((code === 'Enter' || code === 'NumpadEnter' || code === 'Space') && !onButton) { e.preventDefault(); startNew(); }
    }
  });
  addEventListener('keyup', (e) => heldSet.delete(e.code));
  addEventListener('blur', () => { heldSet.clear(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.perk) choosePerk(Number(b.dataset.perk));
  });
  $('btnNew').addEventListener('click', startNew);
  $('btnContinue').addEventListener('click', () => { unlockAudio(); continueRun(); });
  $('btnHelp2').addEventListener('click', openHelp);
  $('btnHelp3').addEventListener('click', openHelp);
  $('btnHelpClose').addEventListener('click', closeHelp);
  $('btnResume').addEventListener('click', () => show('play'));
  $('btnQuit').addEventListener('click', showTitle);
  $('btnAgain').addEventListener('click', startNew);
  $('pauseBtn').addEventListener('click', (e) => { e.currentTarget.blur(); pause(); });

  // 터치: 왼쪽 스틱 + 버튼
  const touch = { x: 0, y: 0, fire: false, dash: false, swap: false, interact: false };
  const stick = $('stick'), knob = $('knob');
  let stickId = null;
  const stickMove = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 10, d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    touch.x = dx / max; touch.y = dy / max;
  };
  stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); unlockAudio(); stickMove(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
  const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', stickEnd);
  stick.addEventListener('pointercancel', stickEnd);
  for (const b of document.querySelectorAll('[data-t]')) {
    const k = b.dataset.t;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); unlockAudio(); b.classList.add('on');
      if (k === 'fire') touch.fire = true; else touch[k] = true;
    });
    const up = () => { b.classList.remove('on'); if (k === 'fire') touch.fire = false; };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }
  addEventListener('contextmenu', (e) => { if (e.target.closest('.stage, .touch')) e.preventDefault(); });

  addEventListener('resize', resize);
  resize();
  showTitle();
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 디버그 · 자동 테스트용
  window.__lantern = {
    get S() { return S; }, get mode() { return mode; }, startNew, choosePerk, step: update, heldSet, pressedSet, touch,
    lightRadius, interact, nearestItem, WEAPONS, ENEMIES, TS, MW, MH,
  };
})();
