'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');

  // ---------- 상수 ----------
  const MW = 48, MH = 32, MAX_DEPTH = 8;
  const WALL = 0, FLOOR = 1, STAIRS = 2;
  const SAVE_KEY = 'lantern:save';
  const BEST_KEY = 'lantern:best';
  const INV_MAX = 5;
  const SIGHT = 9;          // 적이 내 불빛을 알아채는 거리

  const MONS = {
    rat:     { name: '그림자쥐',   ch: 'r', color: '#c9b089', hp: 4,  atk: 2,  def: 0, xp: 2,  speed: 15, minD: 1 },
    bat:     { name: '동굴박쥐',   ch: 'b', color: '#c99be0', hp: 5,  atk: 1,  def: 0, xp: 3,  speed: 20, minD: 1, erratic: 0.4 },
    miner:   { name: '해골 광부',  ch: 's', color: '#e9e2cf', hp: 10, atk: 4,  def: 1, xp: 5,  speed: 10, minD: 2 },
    slime:   { name: '이끼 덩어리', ch: 'j', color: '#86d46f', hp: 18, atk: 3,  def: 0, xp: 6,  speed: 5,  minD: 3 },
    thief:   { name: '기름 도둑',  ch: 't', color: '#f0b85a', hp: 8,  atk: 2,  def: 1, xp: 7,  speed: 12, minD: 3, stealOil: 15 },
    stalker: { name: '어둠 추적자', ch: 'S', color: '#95a2ff', hp: 18, atk: 6,  def: 2, xp: 12, speed: 10, minD: 5 },
    golem:   { name: '돌 파수꾼',  ch: 'G', color: '#b4b4b4', hp: 32, atk: 7,  def: 4, xp: 18, speed: 5,  minD: 6 },
    wraith:  { name: '등불 망령',  ch: 'W', color: '#a6f2ff', hp: 22, atk: 7,  def: 2, xp: 20, speed: 15, minD: 7, drainOil: 6 },
    keeper:  { name: '심연지기',   ch: 'Ω', color: '#ff6b6b', hp: 70, atk: 10, def: 4, xp: 0,  speed: 10, minD: 99, boss: true },
  };
  const ITEMS = {
    oil:     { name: '기름병',     ch: '!', color: '#ffb347' },
    bandage: { name: '붕대',       ch: '+', color: '#ff8a8a' },
    flash:   { name: '섬광탄',     ch: '*', color: '#fff59e' },
    map:     { name: '낡은 지도',  ch: '?', color: '#c9b38a' },
    weapon:  { name: '무기',       ch: ')', color: '#9fd3ff' },
    armor:   { name: '갑옷',       ch: '[', color: '#b0e0a8' },
    ember:   { name: '심연의 불씨', ch: '✦', color: '#ff9d3d' },
  };
  const WEAPONS = ['녹슨 곡괭이', '광부의 단검', '강철 손도끼', '흑요석 검', '별빛 창'];
  const ARMORS = ['누더기', '가죽 조끼', '사슬 셔츠', '강철 흉갑', '유령 망토'];
  const PERKS = [
    { id: 'tough',  name: '튼튼한 몸',   desc: '최대 HP +6, 바로 6 회복',  max: 5, apply: (p) => { p.maxHp += 6; p.hp = Math.min(p.maxHp, p.hp + 6); } },
    { id: 'sharp',  name: '예리한 칼날', desc: '공격 +1',                  max: 5, apply: (p) => { p.atk += 1; } },
    { id: 'hide',   name: '두꺼운 가죽', desc: '방어 +1',                  max: 4, apply: (p) => { p.def += 1; } },
    { id: 'lamp',   name: '넓은 등불',   desc: '시야 +1',                  max: 2, apply: (p) => { p.lightBonus += 1; } },
    { id: 'thrift', name: '기름 절약',   desc: '기름이 더 천천히 닳음',     max: 2, apply: (p) => { p.thrift += 1; } },
    { id: 'leech',  name: '흡혈',        desc: '적을 쓰러뜨릴 때 HP 2 회복', max: 3, apply: (p) => { p.leech += 2; } },
    { id: 'crit',   name: '급소 찌르기', desc: '치명타 확률 +15%',          max: 3, apply: (p) => { p.crit += 0.15; } },
    { id: 'dodge',  name: '재빠른 발',   desc: '회피 확률 +10%',            max: 3, apply: (p) => { p.dodge += 0.1; } },
  ];
  const DIRS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
    KeyQ: [-1, -1], KeyE: [1, -1], KeyZ: [-1, 1], KeyC: [1, 1],
    KeyK: [0, -1], KeyJ: [0, 1], KeyH: [-1, 0], KeyL: [1, 0],
    KeyY: [-1, -1], KeyU: [1, -1], KeyB: [-1, 1], KeyN: [1, 1],
    Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0],
    Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
  };
  const N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

  // ---------- 도구 ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 무시 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const idx = (x, y) => y * MW + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  // 받침 있으면 앞, 없으면 뒤: josa('쥐', '을/를') → '쥐를'
  function josa(word, pair) {
    const c = word.charCodeAt(word.length - 1);
    const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
    const [a, b] = pair.split('/');
    return word + (has ? a : b);
  }

  // ---------- 상태 ----------
  let G = null;              // 한 판의 전부 (저장 대상)
  let mode = 'title';        // title | play | level | help | end
  let helpBack = 'title';
  const vis = new Uint8Array(MW * MH);   // 지금 불빛이 닿는 칸
  const los = new Uint8Array(MW * MH);   // 내 불빛이 보이는 칸 (적이 알아챔)

  function newPlayer() {
    return {
      x: 0, y: 0, hp: 20, maxHp: 20, atk: 3, def: 0, oil: 100, lv: 1, xp: 0,
      inv: { bandage: 1, oil: 1, flash: 0 }, lightBonus: 0, thrift: 0, leech: 0, crit: 0.05, dodge: 0.05,
      perks: {}, weapon: 0, armor: 0, darkT: 0, pendingLv: 0,
    };
  }

  function newRun() {
    G = { depth: 0, turns: 0, kills: 0, log: [], p: newPlayer(), map: null, seen: null, mons: [], items: [] };
    nextFloor();
    msg('등불을 들고 동굴로 내려왔다. 심연 8층의 불씨를 찾아라.', 'gold');
  }

  // ---------- 던전 만들기 ----------
  function passable(map, x, y) { return inb(x, y) && map[idx(x, y)] !== WALL; }
  // 대각선은 양옆 둘 다 막히지 않아야 지나감 (벽 모서리 뚫기 금지)
  function canStep(map, x, y, dx, dy) {
    if (!passable(map, x + dx, y + dy)) return false;
    if (dx && dy && (!passable(map, x + dx, y) || !passable(map, x, y + dy))) return false;
    return true;
  }
  function distMap(map, sx, sy) {
    const d = new Int16Array(MW * MH).fill(-1);
    const q = [sx, sy];
    d[idx(sx, sy)] = 0;
    for (let h = 0; h < q.length; h += 2) {
      const x = q[h], y = q[h + 1], cd = d[idx(x, y)];
      for (const [dx, dy] of N8) {
        if (!canStep(map, x, y, dx, dy)) continue;
        const k = idx(x + dx, y + dy);
        if (d[k] < 0) { d[k] = cd + 1; q.push(x + dx, y + dy); }
      }
    }
    return d;
  }

  function genFloor() {
    const d = G.depth;
    const map = new Uint8Array(MW * MH);
    const rooms = [];
    for (let t = 0; t < 400 && rooms.length < 10; t++) {
      const w = rnd(4, 9), h = rnd(3, 6), x = rnd(1, MW - w - 2), y = rnd(1, MH - h - 2);
      if (rooms.some((r) => x <= r.x + r.w + 1 && x + w + 1 >= r.x && y <= r.y + r.h + 1 && y + h + 1 >= r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map[idx(x, y)] = FLOOR;
    const corridor = (a, b) => {
      let x = a.cx, y = a.cy;
      const goX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); map[idx(x, y)] = FLOOR; } };
      const goY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); map[idx(x, y)] = FLOOR; } };
      if (Math.random() < 0.5) { goX(); goY(); } else { goY(); goX(); }
    };
    rooms.sort((a, b) => a.cx - b.cx);
    for (let i = 1; i < rooms.length; i++) corridor(rooms[i - 1], rooms[i]);
    for (let k = 0; k < 2; k++) corridor(pick(rooms), pick(rooms));

    const start = pick(rooms);
    const p = G.p;
    p.x = start.cx; p.y = start.cy;
    const dist = distMap(map, p.x, p.y);
    const far = rooms.slice().sort((a, b) => dist[idx(b.cx, b.cy)] - dist[idx(a.cx, a.cy)])[0];

    G.map = map;
    G.seen = new Uint8Array(MW * MH);
    G.mons = [];
    G.items = [];

    const taken = new Set([idx(p.x, p.y)]);
    const freeIn = (room, minDist = 0) => {
      for (let t = 0; t < 60; t++) {
        const r = room || pick(rooms);
        const x = rnd(r.x, r.x + r.w - 1), y = rnd(r.y, r.y + r.h - 1), k = idx(x, y);
        if (map[k] !== FLOOR || taken.has(k)) continue;
        if (minDist && cheb(x, y, p.x, p.y) < minDist) continue;
        taken.add(k);
        return { x, y };
      }
      return null;
    };

    if (d < MAX_DEPTH) {
      map[idx(far.cx, far.cy)] = STAIRS;
      taken.add(idx(far.cx, far.cy));
    } else {
      G.items.push({ t: 'ember', x: far.cx, y: far.cy });
      taken.add(idx(far.cx, far.cy));
      const b = freeIn(far) || { x: far.cx + 1, y: far.cy };
      spawn('keeper', b.x, b.y);
    }

    const nMons = 3 + Math.floor(d * 1.4);
    for (let i = 0; i < nMons; i++) {
      const at = freeIn(null, 7);
      if (at) spawn(spawnType(d), at.x, at.y);
    }

    const loot = ['oil', 'oil', 'bandage'];
    for (let i = 0; i < 2; i++) loot.push(pick(['oil', 'bandage', 'flash', 'oil', 'map']));
    if (Math.random() < 0.55 && p.weapon + countItem('weapon') < WEAPONS.length - 1) loot.push('weapon');
    if (Math.random() < 0.45 && p.armor + countItem('armor') < ARMORS.length - 1) loot.push('armor');
    for (const t of loot) {
      const at = freeIn(null, 2);
      if (at) G.items.push({ t, x: at.x, y: at.y });
    }
  }
  function countItem(t) { return G.items.filter((it) => it.t === t).length; }

  function spawnType(d) {
    const pool = [];
    for (const [k, m] of Object.entries(MONS)) {
      if (m.boss || m.minD > d) continue;
      const w = m.minD >= d - 2 ? 3 : 1;   // 새로 나오는 종류일수록 자주
      for (let i = 0; i < w; i++) pool.push(k);
    }
    return pick(pool);
  }

  function spawn(t, x, y) {
    const M = MONS[t];
    const scale = M.boss ? 1 : 1 + 0.08 * Math.max(0, G.depth - M.minD);
    const hp = Math.round(M.hp * scale);
    G.mons.push({ t, x, y, hp, maxHp: hp, atk: Math.round(M.atk * scale), energy: 0, aware: 0, stun: 0, flee: 0 });
  }

  function nextFloor() {
    G.depth++;
    genFloor();
    updateFov();
    if (G.depth === MAX_DEPTH) msg(`지하 ${G.depth}층. 공기가 뜨겁다… 불씨가 가까이 있다.`, 'gold');
    else if (G.depth > 1) msg(`지하 ${G.depth}층으로 내려왔다.`);
  }

  // ---------- 시야 (재귀 그림자 투사) ----------
  const OCT = [[1, 0, 0, -1, -1, 0, 0, 1], [0, 1, -1, 0, 0, -1, 1, 0], [0, 1, 1, 0, 0, -1, -1, 0], [1, 0, 0, 1, -1, 0, 0, -1]];
  function opaque(x, y) { return !inb(x, y) || G.map[idx(x, y)] === WALL; }
  function fov(out, px, py, radius, markSeen) {
    out.fill(0);
    out[idx(px, py)] = 1;
    if (markSeen) G.seen[idx(px, py)] = 1;
    for (let o = 0; o < 8; o++) cast(out, markSeen, px, py, 1, 1, 0, radius, OCT[0][o], OCT[1][o], OCT[2][o], OCT[3][o]);
  }
  function cast(out, markSeen, cx, cy, row, start, end, radius, xx, xy, yx, yy) {
    if (start < end) return;
    const r2 = radius * radius + radius;
    let newStart = 0;
    for (let j = row; j <= radius; j++) {
      let dx = -j - 1;
      const dy = -j;
      let blocked = false;
      while (dx <= 0) {
        dx++;
        const X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy;
        const lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
        if (start < rSlope) continue;
        if (end > lSlope) break;
        if (dx * dx + dy * dy <= r2 && inb(X, Y)) {
          out[idx(X, Y)] = 1;
          if (markSeen) G.seen[idx(X, Y)] = 1;
        }
        if (blocked) {
          if (opaque(X, Y)) { newStart = rSlope; continue; }
          blocked = false; start = newStart;
        } else if (opaque(X, Y) && j < radius) {
          blocked = true;
          cast(out, markSeen, cx, cy, j + 1, start, lSlope, radius, xx, xy, yx, yy);
          newStart = rSlope;
        }
      }
      if (blocked) break;
    }
  }
  function lightRadius() {
    const p = G.p;
    return (p.oil > 0 ? 2 + Math.ceil(p.oil / 25) : 1) + p.lightBonus;
  }
  function updateFov() {
    fov(vis, G.p.x, G.p.y, lightRadius(), true);
    fov(los, G.p.x, G.p.y, SIGHT, false);
  }

  // ---------- 기록 ----------
  function msg(text, cls = '') {
    G.log.push({ text, cls });
    if (G.log.length > 40) G.log.splice(0, G.log.length - 40);
  }

  // ---------- 한 턴 ----------
  const monAt = (x, y) => G.mons.find((m) => m.hp > 0 && m.x === x && m.y === y);
  const itemsAt = (x, y) => G.items.filter((it) => it.x === x && it.y === y);

  function act(kind, a, b) {
    if (mode !== 'play') return;
    const p = G.p;
    let took = false;
    if (kind === 'move') {
      if (!canStep(G.map, p.x, p.y, a, b)) return;
      const m = monAt(p.x + a, p.y + b);
      if (m) attack(m);
      else {
        p.x += a; p.y += b;
        pickup();
        if (G.map[idx(p.x, p.y)] === STAIRS) msg('내려가는 계단이다. > 또는 Enter', 'gold');
      }
      took = true;
    } else if (kind === 'wait') {
      took = true;
    } else if (kind === 'descend') {
      if (G.map[idx(p.x, p.y)] !== STAIRS) { msg('여기엔 계단이 없다.'); render(); return; }
      nextFloor();
      save();
      render();
      return;
    } else if (kind === 'use') {
      took = useItem(a);
    } else if (kind === 'rest') {
      rest();
      return;
    }
    if (took) endTurn();
    render();
  }

  function endTurn() {
    if (mode !== 'play') return;   // 불씨를 주워 끝났으면 적 차례 없음
    const p = G.p;
    G.turns++;
    const every = 2 + p.thrift;
    if (G.turns % every === 0 && p.oil > 0) {
      p.oil--;
      if (p.oil === 20) msg('등불이 흐려진다… 기름이 얼마 없다.', 'bad');
      if (p.oil === 0) msg('등불이 꺼졌다! 어둠이 몸을 갉아먹는다.', 'bad');
    }
    if (p.oil === 0) {
      p.darkT++;
      if (p.darkT % 6 === 0) {
        hurt(1);
        msg('어둠이 스민다. (HP -1)', 'bad');
        if (p.hp <= 0) return die(`지하 ${G.depth}층의 어둠 속에서 쓰러졌다.`);
      }
    }
    if (G.turns % 10 === 0 && p.hp < p.maxHp) p.hp++;
    updateFov();
    monstersAct();
    if (mode === 'end') return;
    G.mons = G.mons.filter((m) => m.hp > 0);
    updateFov();
    if (p.pendingLv > 0) openLevel();
    save();
  }

  function rest() {
    const p = G.p;
    if (p.hp >= p.maxHp) { msg('이미 다 나았다.'); render(); return; }
    if (visibleMons().length) { msg('적이 보여서 쉴 수 없다.', 'bad'); render(); return; }
    msg('잠시 쉰다… (기름은 계속 닳는다)');
    for (let i = 0; i < 200 && mode === 'play'; i++) {
      const before = p.hp;
      endTurn();
      if (mode !== 'play' || p.hp >= p.maxHp || p.hp < before || visibleMons().length) break;
    }
    if (mode === 'play' && visibleMons().length) msg('무언가 다가온다!', 'bad');
    render();
  }

  function visibleMons() { return G.mons.filter((m) => m.hp > 0 && vis[idx(m.x, m.y)]); }

  function attack(m) {
    const p = G.p, M = MONS[m.t];
    const crit = Math.random() < p.crit;
    let dmg = Math.max(1, p.atk + rnd(-1, 1) - M.def);
    if (crit) dmg *= 2;
    m.hp -= dmg;
    m.aware = 10;
    if (m.hp <= 0) {
      G.kills++;
      msg(`${josa(M.name, '을/를')} 쓰러뜨렸다.${crit ? ' (치명타!)' : ''}`, 'good');
      if (p.leech) p.hp = Math.min(p.maxHp, p.hp + p.leech);
      if (M.boss) msg('심연지기가 무너졌다. 불씨를 지키는 것은 이제 없다.', 'gold');
      gainXp(M.xp + Math.floor(G.depth / 2));
    } else {
      msg(`${josa(M.name, '을/를')} 쳤다: ${dmg}${crit ? ' (치명타!)' : ''} · 남은 HP ${m.hp}`);
    }
  }

  function gainXp(n) {
    const p = G.p;
    p.xp += n;
    while (p.xp >= xpNeed(p.lv)) {
      p.xp -= xpNeed(p.lv);
      p.lv++;
      p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2);
      p.pendingLv++;
      msg(`레벨 ${p.lv}!`, 'gold');
    }
  }
  const xpNeed = (lv) => 8 + lv * 6;

  function hurt(n) {
    G.p.hp -= n;
    document.body.classList.remove('hurt');
    void document.body.offsetWidth;
    document.body.classList.add('hurt');
  }

  // ---------- 적 ----------
  function monstersAct() {
    const p = G.p;
    const dm = distMap(G.map, p.x, p.y);
    for (const m of G.mons) {
      if (m.hp <= 0) continue;
      const M = MONS[m.t];
      m.energy += M.speed;
      while (m.energy >= 10) {
        m.energy -= 10;
        monsterStep(m, M, dm);
        if (mode === 'end') return;
      }
    }
  }

  function moveMon(m, dx, dy) {
    if (!canStep(G.map, m.x, m.y, dx, dy)) return false;
    const nx = m.x + dx, ny = m.y + dy;
    if ((nx === G.p.x && ny === G.p.y) || monAt(nx, ny)) return false;
    m.x = nx; m.y = ny;
    return true;
  }
  function randomStep(m) {
    const dirs = N8.slice().sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) if (moveMon(m, dx, dy)) return;
  }

  function monsterStep(m, M, dm) {
    const p = G.p;
    if (m.stun > 0) { m.stun--; return; }
    if (los[idx(m.x, m.y)]) m.aware = 10;
    else if (m.aware > 0) m.aware--;
    const here = dm[idx(m.x, m.y)];
    if (m.flee > 0) {
      m.flee--;
      let best = null, bd = here;
      for (const [dx, dy] of N8) {
        const k = idx(m.x + dx, m.y + dy);
        if (inb(m.x + dx, m.y + dy) && dm[k] > bd && canStep(G.map, m.x, m.y, dx, dy) && !monAt(m.x + dx, m.y + dy)) { bd = dm[k]; best = [dx, dy]; }
      }
      if (best) moveMon(m, best[0], best[1]);
      return;
    }
    if (M.erratic && Math.random() < M.erratic) { randomStep(m); return; }
    if (m.aware <= 0) { if (Math.random() < 0.5) randomStep(m); return; }
    const dx0 = p.x - m.x, dy0 = p.y - m.y;
    if (cheb(m.x, m.y, p.x, p.y) === 1 && canStep(G.map, m.x, m.y, dx0, dy0)) { monsterAttack(m, M); return; }
    let best = null, bd = here < 0 ? 9999 : here;
    for (const [dx, dy] of N8) {
      const nx = m.x + dx, ny = m.y + dy;
      if (!inb(nx, ny)) continue;
      const v = dm[idx(nx, ny)];
      if (v >= 0 && v < bd && canStep(G.map, m.x, m.y, dx, dy) && !monAt(nx, ny)) { bd = v; best = [dx, dy]; }
    }
    if (best) moveMon(m, best[0], best[1]);
  }

  function monsterAttack(m, M) {
    const p = G.p;
    const name = vis[idx(m.x, m.y)] ? M.name : '무언가';
    if (Math.random() < p.dodge) { msg(`${name}의 공격을 피했다.`); return; }
    const dmg = Math.max(1, m.atk + rnd(-1, 1) - p.def);
    hurt(dmg);
    msg(`${josa(name, '이/가')} 공격했다: ${dmg}`, 'bad');
    if (M.stealOil && p.oil > 0) {
      const s = Math.min(p.oil, M.stealOil);
      p.oil -= s;
      m.flee = 8;
      msg(`${josa(name, '이/가')} 기름을 ${s} 훔쳐 달아난다!`, 'bad');
    }
    if (M.drainOil && p.oil > 0) {
      p.oil = Math.max(0, p.oil - M.drainOil);
      msg('차가운 손길에 등불이 흔들린다. (기름 -' + M.drainOil + ')', 'bad');
    }
    if (p.hp <= 0) die(`지하 ${G.depth}층에서 ${M.name}에게 쓰러졌다.`);
  }

  // ---------- 물건 ----------
  function pickup() {
    const p = G.p;
    for (const it of itemsAt(p.x, p.y)) {
      const I = ITEMS[it.t];
      if (it.t === 'ember') return win();
      if (it.t === 'map') {
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
          if (G.map[idx(x, y)] !== WALL) {
            G.seen[idx(x, y)] = 1;
            for (const [dx, dy] of N8) if (inb(x + dx, y + dy)) G.seen[idx(x + dx, y + dy)] = 1;
          }
        }
        msg('낡은 지도를 펼쳤다. 이 층의 생김새가 보인다.', 'good');
      } else if (it.t === 'weapon') {
        p.weapon = Math.min(WEAPONS.length - 1, p.weapon + 1);
        p.atk += 1;
        msg(`${josa(WEAPONS[p.weapon], '을/를')} 손에 쥐었다. (공격 +1)`, 'good');
      } else if (it.t === 'armor') {
        p.armor = Math.min(ARMORS.length - 1, p.armor + 1);
        p.def += 1;
        msg(`${josa(ARMORS[p.armor], '을/를')} 걸쳤다. (방어 +1)`, 'good');
      } else {
        if (p.inv[it.t] >= INV_MAX) { msg(`${josa(I.name, '은/는')} 더 들 수 없다.`); continue; }
        p.inv[it.t]++;
        msg(`${josa(I.name, '을/를')} 주웠다.`, 'good');
      }
      G.items.splice(G.items.indexOf(it), 1);
    }
  }

  function useItem(t) {
    const p = G.p;
    if (!p.inv[t]) { msg(`${josa(ITEMS[t].name, '이/가')} 없다.`); return false; }
    if (t === 'bandage') {
      if (p.hp >= p.maxHp) { msg('다친 곳이 없다.'); return false; }
      const h = Math.ceil(p.maxHp * 0.4);
      p.hp = Math.min(p.maxHp, p.hp + h);
      msg(`붕대를 감았다. (HP +${h})`, 'good');
    } else if (t === 'oil') {
      if (p.oil >= 100) { msg('등불이 이미 가득 찼다.'); return false; }
      p.oil = Math.min(100, p.oil + 40);
      p.darkT = 0;
      msg('등불에 기름을 부었다. 불빛이 커진다.', 'good');
    } else if (t === 'flash') {
      const seen = visibleMons();
      if (!seen.length) { msg('보이는 적이 없다.'); return false; }
      for (const m of seen) m.stun = 4;
      msg(`섬광탄이 터졌다! 적 ${seen.length}마리가 눈이 멀었다.`, 'good');
    }
    p.inv[t]--;
    return true;
  }

  // ---------- 레벨 업 ----------
  let perkChoices = [];
  function openLevel() {
    const p = G.p;
    const pool = PERKS.filter((k) => (p.perks[k.id] || 0) < k.max).sort(() => Math.random() - 0.5);
    perkChoices = pool.slice(0, 3);
    if (!perkChoices.length) { p.pendingLv = 0; return; }
    $('lvTitle').textContent = `레벨 ${p.lv - p.pendingLv + 1}!`;
    $('perkList').innerHTML = perkChoices.map((k, i) => {
      const n = p.perks[k.id] || 0;
      return `<button type="button" data-perk="${i}"><kbd>${i + 1}</kbd><span><span class="pn">${k.name}${n ? ` ${n + 1}단계` : ''}</span><span class="pd">${k.desc}</span></span></button>`;
    }).join('');
    show('level');
  }
  function choosePerk(i) {
    const k = perkChoices[i];
    if (!k) return;
    const p = G.p;
    k.apply(p);
    p.perks[k.id] = (p.perks[k.id] || 0) + 1;
    p.pendingLv--;
    msg(`${josa(k.name, '을/를')} 익혔다. ${k.desc}`, 'gold');
    updateFov();
    save();
    if (p.pendingLv > 0) openLevel();
    else { show('play'); render(); }
  }

  // ---------- 끝 ----------
  function readBest() {
    try { return JSON.parse(store.get(BEST_KEY)) || { depth: 0, wins: 0, runs: 0 }; } catch (e) { return { depth: 0, wins: 0, runs: 0 }; }
  }
  function finish(won, cause) {
    mode = 'end';
    store.del(SAVE_KEY);
    const best = readBest();
    best.runs++;
    best.depth = Math.max(best.depth, G.depth);
    if (won) best.wins++;
    store.set(BEST_KEY, JSON.stringify(best));
    const p = G.p;
    $('eTitle').textContent = won ? '불씨를 되찾았다!' : '등불이 꺼졌다';
    $('eCause').textContent = cause;
    const rows = [['도달한 층', `B${G.depth}`], ['레벨', p.lv], ['쓰러뜨린 적', G.kills], ['걸음', G.turns]];
    $('eStats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    render();
    setTimeout(() => show('end'), won ? 300 : 500);
  }
  function die(cause) { finish(false, cause); }
  function win() {
    msg('심연의 불씨를 손에 넣었다!', 'gold');
    finish(true, `${G.turns}걸음 만에 지하 ${G.depth}층의 불씨를 들고 돌아왔다.`);
  }

  // ---------- 저장 ----------
  function save() {
    if (!G || mode === 'end') return;
    const data = Object.assign({}, G, { v: 1, map: Array.from(G.map).join(''), seen: Array.from(G.seen).join('') });
    store.set(SAVE_KEY, JSON.stringify(data));
  }
  function loadSave() {
    try {
      const d = JSON.parse(store.get(SAVE_KEY));
      if (!d || d.v !== 1 || d.map.length !== MW * MH) return null;
      d.map = Uint8Array.from(d.map, Number);
      d.seen = Uint8Array.from(d.seen, Number);
      return d;
    } catch (e) { return null; }
  }

  // ---------- 그리기 ----------
  let T = 24, cols = 0, rows = 0;
  function resize() {
    const r = $('stage').getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    T = Math.max(18, Math.min(32, Math.floor(Math.min(r.width / 21, r.height / 13))));
    cols = r.width / T; rows = r.height / T;
    render();
  }

  function render() {
    renderHud();
    if (!G) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
    const p = G.p;
    const w = cols * T, h = rows * T;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    // 카메라: 나를 가운데, 지도가 화면보다 작으면 지도를 가운데
    const camX = MW <= cols ? (MW - cols) / 2 : Math.max(0, Math.min(MW - cols, p.x + 0.5 - cols / 2));
    const camY = MH <= rows ? (MH - rows) / 2 : Math.max(0, Math.min(MH - rows, p.y + 0.5 - rows / 2));
    const x0 = Math.max(0, Math.floor(camX)), y0 = Math.max(0, Math.floor(camY));
    const x1 = Math.min(MW - 1, Math.ceil(camX + cols)), y1 = Math.min(MH - 1, Math.ceil(camY + rows));
    const R = lightRadius() + 0.5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyphFont = `700 ${Math.round(T * 0.78)}px ${getComputedStyle(document.body).getPropertyValue('--mono')}`;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = idx(x, y);
        if (!G.seen[k]) continue;
        const sx = (x - camX) * T, sy = (y - camY) * T;
        const lit = vis[k];
        const tile = G.map[k];
        if (tile === WALL) {
          ctx.fillStyle = lit ? '#5d4b36' : '#1a1d27';
          ctx.fillRect(sx, sy, T + 0.5, T + 0.5);
          if (y + 1 < MH && G.map[idx(x, y + 1)] !== WALL) {
            ctx.fillStyle = lit ? '#3d3023' : '#12141b';
            ctx.fillRect(sx, sy + T * 0.72, T + 0.5, T * 0.28 + 0.5);
          }
        } else {
          ctx.fillStyle = lit ? '#2a2119' : '#0d0f15';
          ctx.fillRect(sx, sy, T + 0.5, T + 0.5);
          if (tile === STAIRS) {
            ctx.font = glyphFont;
            ctx.fillStyle = lit ? '#ffd36e' : '#6b6040';
            ctx.fillText('>', sx + T / 2, sy + T / 2 + 1);
          } else {
            ctx.fillStyle = lit ? '#6e5b43' : '#1f232e';
            ctx.fillRect(sx + T / 2 - 1, sy + T / 2 - 1, 2, 2);
          }
        }
        if (lit) {
          const dd = Math.hypot(x - p.x, y - p.y) / R;
          const a = Math.min(0.85, dd * dd * 0.8);
          if (a > 0.02) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(sx, sy, T + 0.5, T + 0.5); }
        }
      }
    }

    ctx.font = glyphFont;
    for (const it of G.items) {
      const k = idx(it.x, it.y);
      if (!G.seen[k]) continue;
      const I = ITEMS[it.t];
      ctx.globalAlpha = vis[k] ? 1 : 0.35;
      ctx.fillStyle = I.color;
      ctx.fillText(I.ch, (it.x - camX + 0.5) * T, (it.y - camY + 0.5) * T + 1);
    }
    ctx.globalAlpha = 1;
    for (const m of G.mons) {
      if (m.hp <= 0 || !vis[idx(m.x, m.y)]) continue;
      const M = MONS[m.t];
      const cx = (m.x - camX + 0.5) * T, cy = (m.y - camY + 0.5) * T;
      ctx.fillStyle = m.stun > 0 ? '#8a8a8a' : M.color;
      ctx.fillText(M.ch, cx, cy + 1);
      if (m.hp < m.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(cx - T * 0.4, cy + T * 0.38, T * 0.8, 3);
        ctx.fillStyle = '#ef6b6b';
        ctx.fillRect(cx - T * 0.4, cy + T * 0.38, T * 0.8 * (m.hp / m.maxHp), 3);
      }
    }
    const px = (p.x - camX + 0.5) * T, py = (p.y - camY + 0.5) * T;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, T * 1.2);
    glow.addColorStop(0, 'rgba(255,190,90,.35)');
    glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - T * 1.2, py - T * 1.2, T * 2.4, T * 2.4);
    ctx.fillStyle = '#ffe08a';
    ctx.fillText('@', px, py + 1);
  }

  function renderHud() {
    if (!G) return;
    const p = G.p;
    $('hDepth').textContent = `B${G.depth}`;
    $('hpFill').style.width = `${Math.max(0, p.hp / p.maxHp) * 100}%`;
    $('hpTxt').textContent = `HP ${Math.max(0, p.hp)}/${p.maxHp}`;
    $('oilFill').style.width = `${p.oil}%`;
    $('oilTxt').textContent = p.oil > 0 ? `기름 ${p.oil}` : '등불 꺼짐';
    $('oilFill').parentElement.classList.toggle('low', p.oil <= 20);
    $('hLv').textContent = p.lv;
    $('hXp').textContent = `${p.xp}/${xpNeed(p.lv)}`;
    $('hAtk').textContent = p.atk;
    $('hDef').textContent = p.def;
    $('nBandage').textContent = p.inv.bandage;
    $('nOil').textContent = p.inv.oil;
    $('nFlash').textContent = p.inv.flash;
    for (const b of document.querySelectorAll('[data-use]')) b.classList.toggle('empty', !p.inv[b.dataset.use]);
    document.querySelector('[data-act="descend"]').classList.toggle('ready', G.map[idx(p.x, p.y)] === STAIRS);
    $('log').innerHTML = G.log.slice(-5).map((l) => `<li class="${l.cls}">${l.text}</li>`).join('');
  }

  // ---------- 화면 전환 ----------
  function show(m) {
    mode = m;
    $('mTitle').hidden = m !== 'title';
    $('mLevel').hidden = m !== 'level';
    $('mHelp').hidden = m !== 'help';
    $('mEnd').hidden = m !== 'end';
    const first = document.querySelector('.modal:not([hidden]) button:not([hidden])');
    if (first) first.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function openHelp() { helpBack = mode; show('help'); }
  function closeHelp() { show(helpBack); render(); }

  function showTitle() {
    const s = loadSave();
    $('btnContinue').hidden = !s;
    if (s) $('contInfo').textContent = `B${s.depth} · Lv ${s.p.lv}`;
    const b = readBest();
    $('rec').textContent = b.runs ? `탐험 ${b.runs}회 · 최고 B${b.depth}${b.wins ? ` · 불씨 ${b.wins}개` : ''}` : '';
    show('title');
  }
  function startNew() { newRun(); show('play'); updateFov(); render(); save(); }
  function continueRun() {
    const s = loadSave();
    if (!s) return startNew();
    G = s;
    msg('다시 등불을 들었다.');
    show('play');
    updateFov();
    render();
  }

  // ---------- 입력 ----------
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    const isHelp = code === 'Slash' && e.shiftKey;
    if (mode === 'title') {
      if (code === 'Enter' || code === 'NumpadEnter') {
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; // 포커스된 버튼이 처리
        e.preventDefault(); startNew();
      } else if (code === 'KeyC' && !$('btnContinue').hidden) { e.preventDefault(); continueRun(); }
      else if (code === 'KeyN') { e.preventDefault(); startNew(); }
      else if (isHelp) { e.preventDefault(); openHelp(); }
      return;
    }
    if (mode === 'help') {
      if (code === 'Escape' || isHelp) { e.preventDefault(); closeHelp(); }
      return;
    }
    if (mode === 'level') {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[code];
      if (n !== undefined) { e.preventDefault(); choosePerk(n); }
      return;
    }
    if (mode === 'end') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; // 포커스된 버튼이 처리
      if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { e.preventDefault(); startNew(); }
      return;
    }
    // play
    if (isHelp) { e.preventDefault(); openHelp(); return; }
    if (DIRS[code]) { e.preventDefault(); act('move', DIRS[code][0], DIRS[code][1]); return; }
    if (code === 'Space' || code === 'Numpad5' || (code === 'Period' && !e.shiftKey)) { e.preventDefault(); act('wait'); return; }
    if ((code === 'Period' && e.shiftKey) || code === 'Enter' || code === 'NumpadEnter') { e.preventDefault(); act('descend'); return; }
    if (code === 'KeyR') { e.preventDefault(); act('rest'); return; }
    const use = { Digit1: 'bandage', Digit2: 'oil', Digit3: 'flash' }[code];
    if (use) { e.preventDefault(); act('use', use); }
  });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dir) { const [dx, dy] = b.dataset.dir.split(',').map(Number); act('move', dx, dy); }
    else if (b.dataset.act) act(b.dataset.act);
    else if (b.dataset.use) act('use', b.dataset.use);
    else if (b.dataset.perk) choosePerk(Number(b.dataset.perk));
    b.blur();
  });
  $('btnNew').addEventListener('click', startNew);
  $('btnContinue').addEventListener('click', continueRun);
  $('btnHelp2').addEventListener('click', openHelp);
  $('helpBtn').addEventListener('click', () => { if (mode === 'play' || mode === 'title') openHelp(); });
  $('btnHelpClose').addEventListener('click', closeHelp);
  $('btnAgain').addEventListener('click', startNew);

  // 지도를 탭하면 그쪽으로 한 칸
  cv.addEventListener('click', (e) => {
    if (mode !== 'play') return;
    const r = cv.getBoundingClientRect();
    const p = G.p;
    const camX = MW <= cols ? (MW - cols) / 2 : Math.max(0, Math.min(MW - cols, p.x + 0.5 - cols / 2));
    const camY = MH <= rows ? (MH - rows) / 2 : Math.max(0, Math.min(MH - rows, p.y + 0.5 - rows / 2));
    const tx = Math.floor((e.clientX - r.left) / T + camX), ty = Math.floor((e.clientY - r.top) / T + camY);
    const dx = Math.sign(tx - p.x), dy = Math.sign(ty - p.y);
    if (!dx && !dy) act(G.map[idx(p.x, p.y)] === STAIRS ? 'descend' : 'wait');
    else if (canStep(G.map, p.x, p.y, dx, dy)) act('move', dx, dy);
    else if (dx && canStep(G.map, p.x, p.y, dx, 0)) act('move', dx, 0);
    else if (dy && canStep(G.map, p.x, p.y, 0, dy)) act('move', 0, dy);
  });

  addEventListener('resize', resize);
  addEventListener('pagehide', save);

  resize();
  showTitle();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 디버그 · 자동 테스트용
  window.__lantern = { get G() { return G; }, get mode() { return mode; }, act, choosePerk, startNew, vis };
})();
