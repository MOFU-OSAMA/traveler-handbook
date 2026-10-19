/* ============================================================
 *  龙蛋物语 — 世界大地图
 *  一整张网格地图：点格子放地形图块，可命名、写便签、贴图；
 *  悬停预览简介。地形素材与贴纸/徽章完全分开。
 *  ============================================================ */
window.DE = window.DE || {};

DE.worldmap = {

  DEFAULTS: { cols: 24, rows: 16, cell: 46 },

  /* ---------- 默认地形图块 ---------- */
  /* color 用作底色，ink 用作文字/图标色；bg 可覆盖为渐变 */
  TERRAIN: [
    { id:"plain",    name:"草原",   icon:"🌿", color:"#a8c98a", ink:"#3c5a2c", hint:"开阔的草地，适合扎营。" },
    { id:"field",    name:"农田",   icon:"🌾", color:"#d9c98a", ink:"#6b5520", hint:"有人耕作的田地，通常靠近村落。" },
    { id:"forest",   name:"森林",   icon:"🌲", color:"#6f9b63", ink:"#22401c", hint:"树木茂密，容易迷路，但物产丰富。" },
    { id:"deepwood", name:"密林",   icon:"🌳", color:"#4e7a4a", ink:"#e9f3e4", hint:"几乎不见天日的深林。" },
    { id:"hill",     name:"丘陵",   icon:"⛰️", color:"#bfae83", ink:"#54452a", hint:"起伏的坡地，视野不错。" },
    { id:"rock",     name:"岩地",   icon:"🪨", color:"#a9a49a", ink:"#43403a", hint:"裸露的岩层，行走费力。" },
    { id:"mount",    name:"高山",   icon:"🏔️", color:"#9aa7b5", ink:"#2c3846", hint:"终年积雪的高山，需要装备。" },
    { id:"desert",   name:"沙漠",   icon:"🏜️", color:"#e5cd96", ink:"#7a5f22", hint:"极度缺水，白天酷热夜里严寒。" },
    { id:"wet",      name:"湿地",   icon:"🪷", color:"#8fb5a0", ink:"#254238", hint:"泥泞的沼泽，容易陷进去。" },
    { id:"lake",     name:"湖泊",   icon:"💧", color:"#8fc3dd", ink:"#1d4d66", hint:"淡水湖，可以补给饮水。" },
    { id:"river",    name:"河流",   icon:"〰️", color:"#a5d3e8", ink:"#1d4d66", hint:"需要找渡口或桥才能通过。" },
    { id:"sea",      name:"海洋",   icon:"🌊", color:"#6fa8cc", ink:"#eaf4fb", hint:"出海需要船。" },
    { id:"coast",    name:"海岸",   icon:"🏖️", color:"#e8dcae", ink:"#6b5a2a", hint:"海陆交界，常有渔村。" },
    { id:"snow",     name:"雪原",   icon:"❄️", color:"#dde8ef", ink:"#3c5566", hint:"一望无际的积雪。" },
    { id:"ruins",    name:"遗迹",   icon:"🏛️", color:"#c2b4a0", ink:"#4a3d2c", hint:"古老的建筑残骸，也许有宝物。" },
    { id:"dungeon",  name:"地下城", icon:"🕳️", color:"#8b8296", ink:"#f0ecf5", hint:"通往地下的入口，怪物出没。" },
    { id:"town",     name:"都市",   icon:"🏙️", color:"#e0b45c", ink:"#5a3d0e", hint:"大城市，可以买卖与补给、买到药草。" },
    { id:"village",  name:"村庄",   icon:"🏘️", color:"#dcc39a", ink:"#5a4522", hint:"小村落，能借宿、打听消息。" },
    { id:"camp",     name:"营地",   icon:"🔥", color:"#e8a06a", ink:"#5c2d0c", hint:"适合野营的地点。" },
    { id:"danger",   name:"危险区", icon:"💀", color:"#c98b8b", ink:"#4d1414", hint:"怪物的地盘，谨慎靠近。" },
    { id:"road",     name:"道路",   icon:"🛤️", color:"#d8cdb4", ink:"#6b5f45", hint:"铺设过的路，移动判定有加值。" },
    { id:"bridge",   name:"桥",     icon:"🌉", color:"#cdbba0", ink:"#4a3a24", hint:"过河用的桥。" },
    { id:"landmark", name:"地标",   icon:"🗼", color:"#c9a3d9", ink:"#452a52", hint:"醒目的地标，适合当方向参考。" },
    { id:"fog",      name:"未探索", icon:"❔", color:"#b9b3a6", ink:"#4a463c", hint:"还没去过的地方。" }
  ],
  findTerrain: function (id) {
    return DE.worldmap.TERRAIN.filter(function (t) { return t.id === id; })[0] || DE.worldmap.TERRAIN[0];
  },

  /* ---------- 地图块（用户上传的手绘区块图） ---------- */
  newTile: function (o) {
    o = o || {};
    return {
      id: DE.uid("mt"),
      name: o.name || "未命名地图块",
      dataUrl: o.dataUrl,
      width: o.width || 0,
      height: o.height || 0,
      bytes: DE.storage ? DE.storage.dataUrlBytes ? 0 : 0 : 0,
      terrain: o.terrain || "",     // 默认关联的地形（可选）
      note: o.note || "",
      createdISO: new Date().toISOString()
    };
  },

  /* ---------- 地图 ---------- */
  empty: function () {
    return {
      cols: DE.worldmap.DEFAULTS.cols,
      rows: DE.worldmap.DEFAULTS.rows,
      cell: DE.worldmap.DEFAULTS.cell,
      name: "我的世界地图",
      bg: "#f4efdf",
      cells: {},                     // "c,r" -> cell
      tiles: [],                     // 地图块素材库（与贴纸库分开）
      stamps: [],                    // 直接贴在地图上的自由贴纸/徽章
      updatedISO: new Date().toISOString()
    };
  },

  key: function (c, r) { return c + "," + r; },

  getCell: function (wm, c, r) { return wm.cells[DE.worldmap.key(c, r)] || null; },

  /* 放一个地形格；已存在则更新 */
  putCell: function (wm, c, r, patch) {
    var k = DE.worldmap.key(c, r);
    var cur = wm.cells[k] || {
      c: c, r: r, terrain: "plain", name: "", note: "", tileId: null, rot: 0, tint: 0
    };
    for (var p in patch) cur[p] = patch[p];
    wm.cells[k] = cur;
    return cur;
  },

  clearCell: function (wm, c, r) {
    var k = DE.worldmap.key(c, r);
    if (!wm.cells[k]) return false;
    delete wm.cells[k];
    return true;
  },

  /* 调整网格尺寸，保留范围内的格子 */
  resize: function (wm, cols, rows) {
    cols = Math.max(4, Math.min(120, cols | 0));
    rows = Math.max(4, Math.min(120, rows | 0));
    var next = {};
    Object.keys(wm.cells).forEach(function (k) {
      var p = k.split(",");
      var c = +p[0], r = +p[1];
      if (c < cols && r < rows) next[k] = wm.cells[k];
    });
    wm.cols = cols; wm.rows = rows; wm.cells = next;
    return wm;
  },

  /* ---------- 统计 ---------- */
  stats: function (wm) {
    var used = Object.keys(wm.cells || {}).length;
    var byTerrain = {};
    Object.keys(wm.cells || {}).forEach(function (k) {
      var t = wm.cells[k].terrain || "plain";
      byTerrain[t] = (byTerrain[t] || 0) + 1;
    });
    return {
      cols: wm.cols, rows: wm.rows,
      total: wm.cols * wm.rows,
      used: used,
      blank: wm.cols * wm.rows - used,
      byTerrain: byTerrain,
      tiles: (wm.tiles || []).length,
      stamps: (wm.stamps || []).length,
      named: Object.keys(wm.cells || {}).filter(function (k) {
        return (wm.cells[k].name || "").trim();
      }).length
    };
  },

  /* ---------- 地图块素材库 ---------- */
  addTileDef: function (wm, o) {
    if (!Array.isArray(wm.tiles)) wm.tiles = [];
    var t = DE.worldmap.newTile(o);
    t.bytes = (DE.journal && DE.journal.dataUrlBytes) ? DE.journal.dataUrlBytes(t.dataUrl) : 0;
    wm.tiles.push(t);
    return t;
  },
  findTileDef: function (wm, id) {
    return (wm.tiles || []).filter(function (t) { return t.id === id; })[0] || null;
  },
  removeTileDef: function (wm, id) {
    var i = -1;
    (wm.tiles || []).forEach(function (t, k) { if (t.id === id) i = k; });
    if (i < 0) return false;
    wm.tiles.splice(i, 1);
    /* 用它的格子回退成纯地形 */
    Object.keys(wm.cells || {}).forEach(function (k) {
      if (wm.cells[k].tileId === id) wm.cells[k].tileId = null;
    });
    return true;
  },
  tileBytes: function (wm) {
    return (wm.tiles || []).reduce(function (s, t) { return s + (t.bytes || 0); }, 0);
  },

  /* ---------- 地图上的自由贴纸 / 徽章 ---------- */
  addStamp: function (wm, o) {
    if (!Array.isArray(wm.stamps)) wm.stamps = [];
    var s = {
      id: DE.uid("ms"),
      libId: o.libId,               // 指向 DE.journal 的贴纸库
      name: o.name || "",
      x: o.x != null ? o.x : 40,
      y: o.y != null ? o.y : 40,
      w: o.w != null ? o.w : 90,
      rot: o.rot || 0,
      z: o.z || 1
    };
    wm.stamps.push(s);
    return s;
  },
  findStamp: function (wm, id) {
    return (wm.stamps || []).filter(function (s) { return s.id === id; })[0] || null;
  },
  removeStamp: function (wm, id) {
    var i = -1;
    (wm.stamps || []).forEach(function (s, k) { if (s.id === id) i = k; });
    if (i < 0) return false;
    wm.stamps.splice(i, 1);
    return true;
  },

  /* ---------- 迁移 ---------- */
  migrate: function (wm) {
    var base = DE.worldmap.empty();
    if (!wm || typeof wm !== "object") return base;
    for (var k in base) if (wm[k] === undefined || wm[k] === null) wm[k] = base[k];
    if (!wm.cells || typeof wm.cells !== "object" || Array.isArray(wm.cells)) wm.cells = {};
    if (!Array.isArray(wm.tiles)) wm.tiles = [];
    if (!Array.isArray(wm.stamps)) wm.stamps = [];
    wm.cols = Math.max(4, Math.min(120, wm.cols | 0 || 24));
    wm.rows = Math.max(4, Math.min(120, wm.rows | 0 || 16));
    wm.cell = Math.max(24, Math.min(120, wm.cell | 0 || 46));
    /* 校验每个格子 */
    Object.keys(wm.cells).forEach(function (key) {
      var cell = wm.cells[key];
      if (!cell || typeof cell !== "object") { delete wm.cells[key]; return; }
      if (!DE.worldmap.TERRAIN.some(function (t) { return t.id === cell.terrain; })) cell.terrain = "plain";
      if (cell.name === undefined) cell.name = "";
      if (cell.note === undefined) cell.note = "";
      if (cell.tileId === undefined) cell.tileId = null;
      if (cell.rot === undefined) cell.rot = 0;
    });
    return wm;
  }
};
