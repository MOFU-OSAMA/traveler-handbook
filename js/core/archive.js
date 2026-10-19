/* ============================================================
 *  龙蛋物语 — 存档层（多槽位）
 *
 *  设计要点：**绝不破坏现有单存档**。
 *  · 老的 `dragonEgg.save.v1` 仍然是「当前角色」，所有页面照旧可读写；
 *  · 本模块在旁边维护一份索引 `dragonEgg.slots.v1`，
 *    每个槽位把自己的角色存到 `dragonEgg.slot.<id>`；
 *  · 第一次使用时把老存档「收养」成 1 号槽位 —— 不会丢角色。
 *
 *  用途：多开角色卡、切换角色。
 *  ============================================================ */
window.DE = window.DE || {};

DE.archive = (function () {

  var SLOTS_KEY = "dragonEgg.slots.v1";
  var SLOT_PREFIX = "dragonEgg.slot.";
  var MAX_SLOTS = 40;

  function ls() { return (typeof localStorage !== "undefined") ? localStorage : null; }
  function readJSON(k, dflt) {
    try {
      var raw = ls() && ls().getItem(k);
      if (!raw) return dflt;
      var o = JSON.parse(raw);
      return (o === null || o === undefined) ? dflt : o;
    } catch (e) { return dflt; }
  }
  function writeJSON(k, v) {
    try { ls().setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  /* ---------- 索引 ---------- */
  function index() {
    var ix = readJSON(SLOTS_KEY, null);
    if (!ix || !Array.isArray(ix.slots)) {
      ix = { version: 1, active: null, slots: [] };
    }
    /* 清洗：去掉坏条目 */
    ix.slots = ix.slots.filter(function (s) { return s && s.id; });
    return ix;
  }
  function saveIndex(ix) { return writeJSON(SLOTS_KEY, ix); }

  function slotKey(id) { return SLOT_PREFIX + id; }

  function getSlot(id) {
    var ix = index();
    return ix.slots.filter(function (s) { return s.id === id; })[0] || null;
  }
  function getCharacter(id) { return readJSON(slotKey(id), null); }

  /* ---------- 摘要（用于列表显示，不加载整份存档） ---------- */
  function summary(c) {
    if (!c) return null;
    var d = null;
    try { d = DE.derive ? DE.derive(c) : null; } catch (e) { d = null; }
    return {
      id: c.id || "",
      name: c.name || "",
      player: c.player || "",
      profession: c.profession || "",
      level: c.level || 1,
      title: (DE.PROFESSIONS || []).filter(function (p) { return p.id === c.profession; })[0],
      hp: c.hpCurrent == null ? (d ? d.hpMax : null) : c.hpCurrent,
      hpMax: d ? d.hpMax : null,
      mp: c.mpCurrent == null ? (d ? d.mpMax : null) : c.mpCurrent,
      mpMax: d ? d.mpMax : null,
      status: d ? d.status : null,
      statusPerfect: d ? d.statusPerfect : false,
      abilities: c.abilities || null,
      money: c.money || 0,
      statuses: (c.statuses || []).length,
      items: (c.inventory || []).length,
      hasPortrait: !!c.portrait,
      updatedAt: c._updatedAt || ""
    };
  }

  /* ---------- 新建槽位 ---------- */
  function add(character, meta) {
    var ix = index();
    if (ix.slots.length >= MAX_SLOTS) return { ok: false, msg: "存档位已满（上限 " + MAX_SLOTS + "）。" };
    meta = meta || {};
    var c = character;
    if (!c) {
      c = DE.newCharacter();
    }
    if (!c.id) c.id = DE.uid("ch");
    c._updatedAt = DE.gameISO ? DE.gameISO() : new Date().toISOString();

    var id = meta.slotId || c.id;
    var entry = {
      id: id,
      name: c.name || "",
      player: c.player || "",
      createdAt: new Date().toISOString(),
      updatedAt: c._updatedAt
    };
    if (!writeJSON(slotKey(id), c)) return { ok: false, msg: "写入存档失败（可能是空间不足）。" };
    ix.slots.push(entry);
    /* 如果之前没有「当前角色」（比如刚清空全部数据），第一个建出来的就应该是当前角色。
       不然存档列表里有卡、但 DE.archive.active() 是 null，很多地方会拿到空角色。 */
    if (!ix.active) {
      ix.active = id;
      try { ls().setItem(DE.SAVE_KEY, JSON.stringify(c)); } catch (e) {}
    }
    saveIndex(ix);
    return { ok: true, id: id, character: c };
  }

  /* ---------- 更新某个槽位的内容 ---------- */
  function put(id, character) {
    if (!getSlot(id)) return { ok: false, msg: "找不到槽位。" };
    character = character || {};
    if (!character.id) character.id = id;
    character._updatedAt = DE.gameISO ? DE.gameISO() : new Date().toISOString();
    if (!writeJSON(slotKey(id), character)) return { ok: false, msg: "写入存档失败。" };
    var ix = index();
    ix.slots.forEach(function (s) {
      if (s.id !== id) return;
      s.kind = character.kind || s.kind;
      s.name = character.name || s.name || "";
      s.player = character.player || s.player || "";
      s.updatedAt = character._updatedAt;
    });
    saveIndex(ix);
    return { ok: true };
  }

  function remove(id) {
    var ix = index();
    var before = ix.slots.length;
    ix.slots = ix.slots.filter(function (s) { return s.id !== id; });
    if (ix.slots.length === before) return { ok: false, msg: "找不到槽位。" };
    try { ls().removeItem(slotKey(id)); } catch (e) {}
    if (ix.active === id) ix.active = ix.slots.length ? ix.slots[0].id : null;
    saveIndex(ix);
    return { ok: true };
  }

  function rename(id, name) {
    var ix = index();
    var hit = null;
    ix.slots.forEach(function (s) { if (s.id === id) { s.name = name; hit = s; } });
    if (!hit) return { ok: false, msg: "找不到槽位。" };
    var c = getCharacter(id);
    if (c) {
      c.name = name;
      writeJSON(slotKey(id), c);
    }
    saveIndex(ix);
    return { ok: true };
  }

  function duplicate(id) {
    var c = getCharacter(id);
    if (!c) return { ok: false, msg: "找不到槽位。" };
    var copy = JSON.parse(JSON.stringify(c));
    copy.id = DE.uid("ch");
    copy.name = (copy.name || "未命名") + "（副本）";
    var r = add(copy);
    return r;
  }

  /* ---------- 当前槽位（与老的 SAVE_KEY 联动） ---------- */
  function active() { return index().active; }

  /* 把某个槽位设为「当前角色」——这样所有老页面不用改代码就能用 */
  function activate(id) {
    var c = getCharacter(id);
    if (!c) return { ok: false, msg: "找不到槽位。" };
    try { ls().setItem(DE.SAVE_KEY, JSON.stringify(c)); } catch (e) {
      return { ok: false, msg: "切换失败（空间不足）。" };
    }
    /* 时钟也按槽位分开：不同的世界不该共用同一天 */
    var ck = readJSON("dragonEgg.clock.slot." + id, null);
    if (ck) { try { ls().setItem(DE.CLOCK_KEY, JSON.stringify(ck)); } catch (e) {} }
    else { try { ls().setItem(DE.CLOCK_KEY, JSON.stringify(DE.clock.defaults())); } catch (e) {} }

    var ix = index();
    ix.active = id;
    saveIndex(ix);
    if (DE.store) DE.store.character = c;
    return { ok: true, character: c };
  }

  /* 把「当前角色」存回它自己的槽位 */
  function stashActive() {
    var id = active();
    if (!id) return { ok: false, msg: "没有激活的槽位。" };
    var c = null;
    try { c = JSON.parse(ls().getItem(DE.SAVE_KEY)); } catch (e) { c = null; }
    if (!c) return { ok: false, msg: "当前没有角色。" };
    var r = put(id, c);
    /* 时钟也存回去 */
    try {
      var ck = ls().getItem(DE.CLOCK_KEY);
      if (ck) ls().setItem("dragonEgg.clock.slot." + id, ck);
    } catch (e) {}
    return r;
  }

  /* ---------- 首次使用：把老存档收养进来 ---------- */
  function boot() {
    var ix = index();
    if (ix.slots.length) return ix;

    /* 有老存档 → 收养它 */
    var legacy = null;
    try {
      var raw = ls() && ls().getItem(DE.SAVE_KEY);
      if (raw) legacy = JSON.parse(raw);
    } catch (e) { legacy = null; }

    if (legacy) {
      var r = add(legacy);
      if (r.ok) {
        ix = index();
        ix.active = r.id;
        saveIndex(ix);
        /* 老存档的时钟也搬进来 */
        try {
          var ck = ls().getItem(DE.CLOCK_KEY);
          if (ck) ls().setItem("dragonEgg.clock.slot." + r.id, ck);
        } catch (e) {}
      }
      return index();
    }
    /* 没有老存档 → 建一个空的旅行者槽位 */
    var nr = add(DE.newCharacter({ kind: "traveler" }));
    if (nr.ok) {
      ix = index(); ix.active = nr.id; saveIndex(ix);
      try { ls().setItem(DE.SAVE_KEY, JSON.stringify(nr.character)); } catch (e) {}
    }
    return index();
  }

  /* ---------- 列表 ---------- */
  function list(filter) {
    filter = filter || {};
    var ix = index();
    return ix.slots.map(function (s) {
      var c = getCharacter(s.id);
      var sum = summary(c) || { id: s.id, name: s.name, kind: s.kind };
      sum.slotId = s.id;
      sum.createdAt = s.createdAt;
      sum.updatedAt = s.updatedAt || sum.updatedAt;
      sum.isActive = (ix.active === s.id);
      return sum;
    }).filter(function (s) {
      if (filter.kind && s.kind !== filter.kind) return false;
      return true;
    }).sort(function (a, b) {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
  }

  /* ---------- 导入 / 导出 ---------- */
  function exportSlot(id) {
    var c = getCharacter(id);
    if (!c) return null;
    return JSON.stringify({ kind: "dragonEgg.slot", version: 1, slot: getSlot(id), character: c }, null, 2);
  }
  function importSlot(text) {
    var o = null;
    try { o = JSON.parse(text); } catch (e) { return { ok: false, msg: "不是合法的 JSON。" }; }
    var c = o && o.character ? o.character : o;      // 也接受直接一张角色卡
    if (!c || typeof c !== "object") return { ok: false, msg: "里面没有角色卡数据。" };
    if (!c.abilities) return { ok: false, msg: "这不像一张龙蛋物语角色卡（缺少能力值）。" };
    /* 必须迁移：旧版导出的卡可能缺 bonus / equipped，
       不补的话 DE.derive 会抛 "reading 'hp'"。 */
    if (DE.migrate) { try { c = DE.migrate(c); } catch (e) {} }
    c.id = DE.uid("ch");
    var r = add(c);
    if (r.ok) r.msg = "已导入〈" + (c.name || "未命名") + "〉。";
    return r;
  }

  function clearAll() {
    var ix = index();
    ix.slots.forEach(function (s) { try { ls().removeItem(slotKey(s.id)); } catch (e) {} });
    ix.slots = []; ix.active = null;
    saveIndex(ix);
    return { ok: true };
  }


  return {
    SLOTS_KEY: SLOTS_KEY,
    MAX_SLOTS: MAX_SLOTS,
    boot: boot,
    index: index,
    list: list,
    add: add,
    put: put,
    remove: remove,
    rename: rename,
    duplicate: duplicate,
    activate: activate,
    active: active,
    stashActive: stashActive,
    getCharacter: getCharacter,
    getSlot: getSlot,
    summary: summary,
    exportSlot: exportSlot,
    importSlot: importSlot,
    clearAll: clearAll
  };
})();
