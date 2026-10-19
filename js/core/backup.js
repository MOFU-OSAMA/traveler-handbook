/* ============================================================
 *  龙蛋物语 — 存档备份与迁移
 *
 *  两种用途，两种格式：
 *
 *  ① 全量备份  dragonEgg.backup  —— 网站版本更迭时整体迁移用。
 *     包含：所有旅行者存档、游戏时间（含每个槽位自己的时间）、手账/地图。
 *     导入 = 整体覆盖本机数据，然后刷新页面。
 *
 *  ② 旅行者状态  dragonEgg.traveler —— 给「龙人端」（主持人/GM）用的精简快照。
 *     只放带团时需要看的东西：能力值、HP/MP、状态值、异常状态、物资、减值。
 *     这个格式是**对外契约**，字段只增不减，改动必须升 version。
 *
 *  两种格式都带 app / version / exportedAt，导入方可以先看 version 再决定怎么读。
 * ============================================================ */
window.DE = window.DE || {};

DE.backup = (function () {
  var FORMAT_ALL = "dragonEgg.backup";
  var FORMAT_TRAVELER = "dragonEgg.traveler";
  var VERSION_ALL = 1;
  var VERSION_TRAVELER = 1;

  var SLOT_PREFIX = "dragonEgg.slot.";
  var SLOT_CLOCK_PREFIX = "dragonEgg.clock.slot.";

  function nowISO() { return new Date().toISOString(); }
  function readJSON(k) {
    try {
      var raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
  function profName(id) {
    var p = (DE.PROFESSIONS || []).filter(function (x) { return x.id === id; })[0];
    return p ? p.name : (id || "");
  }
  function typeName(id) {
    var t = (DE.TYPES || []).filter(function (x) { return x.id === id; })[0];
    return t ? t.name : (id || "");
  }
  function itemName(c, inst) {
    var d = DE.instDef ? DE.instDef(inst) : null;
    return d ? d.name : (inst.name || "?");
  }
  function catLabel(cat) {
    var c = (DE.CATEGORIES || {})[cat];
    return c ? c.label : (cat || "");
  }

  /* ---------- ① 全量备份 ---------- */

  /* 收集当前所有数据（手账是异步存储，所以整体返回 Promise） */
  function collect() {
    var journalP = (DE.journal && DE.journal.load)
      ? DE.journal.load().catch(function () { return null; })
      : Promise.resolve(null);

    return journalP.then(function (J) {
      var ix = (DE.archive && DE.archive.index) ? DE.archive.index() : { slots: [], active: null };
      var slots = [];
      ix.slots.forEach(function (s) {
        var ch = DE.archive.getCharacter(s.id);
        if (!ch) return;
        slots.push({
          slot: s,
          character: ch,
          clock: readJSON(SLOT_CLOCK_PREFIX + s.id)      /* 每个槽位自己的游戏时间 */
        });
      });
      return {
        app: "dragonEgg",
        format: FORMAT_ALL,
        version: VERSION_ALL,
        exportedAt: nowISO(),
        note: "龙蛋物语旅行者手册 · 全量备份（旅行者 + 游戏时间 + 手账地图）。导入会覆盖本机数据。",
        activeSlot: ix.active || null,
        clock: readJSON(DE.CLOCK_KEY),
        slots: slots,
        journal: J
      };
    });
  }

  function exportAll() {
    return collect().then(function (o) {
      return JSON.stringify(o, null, 2);
    });
  }

  /* 导入：接受全量备份，也接受老的单张角色卡（向后兼容） */
  function importAll(text) {
    return new Promise(function (resolve) {
      var o = null;
      try { o = JSON.parse(String(text || "")); }
      catch (e) { return resolve({ ok: false, msg: "不是合法的 JSON。" }); }
      if (!o || typeof o !== "object") return resolve({ ok: false, msg: "文件内容不是对象。" });

      /* --- 老格式：单张角色卡 --- */
      if (o.format !== FORMAT_ALL) {
        var single = o.character || (o.abilities ? o : null);
        if (!single || !single.abilities) {
          return resolve({ ok: false, msg: "认不出这个文件：既不是全量备份，也不是角色卡。" });
        }
        single = DE.migrate ? DE.migrate(single) : single;
        single.id = DE.uid("ch");
        var r = DE.archive.add(single);
        return resolve({
          ok: !!r.ok, reload: false,
          msg: r.ok ? "已导入单张角色卡〈" + (single.name || "未命名") + "〉。" : (r.msg || "导入失败。")
        });
      }

      if (typeof o.version === "number" && o.version > VERSION_ALL) {
        return resolve({
          ok: false,
          msg: "这份备份来自更新的版本（v" + o.version + "），请先升级网站再导入。"
        });
      }

      var slots = Array.isArray(o.slots) ? o.slots : [];
      if (!slots.length) return resolve({ ok: false, msg: "备份里没有任何旅行者存档。" });

      /* 先清空旧的，再整体写入 —— 这是「覆盖式恢复」，语义明确 */
      try {
        var ixOld = DE.archive.index();
        ixOld.slots.forEach(function (s) {
          try { localStorage.removeItem(SLOT_PREFIX + s.id); } catch (e) {}
          try { localStorage.removeItem(SLOT_CLOCK_PREFIX + s.id); } catch (e) {}
        });
        localStorage.removeItem(DE.SAVE_KEY);
        localStorage.removeItem(DE.CLOCK_KEY);
      } catch (e) {}

      var ix = { version: 1, slots: [], active: null };
      var n = 0;
      slots.forEach(function (entry) {
        var ch = entry && entry.character;
        var sl = entry && entry.slot;
        if (!ch || !ch.abilities) return;
        var id = (sl && sl.id) || DE.uid("ch");
        try {
          ch = DE.migrate ? DE.migrate(ch) : ch;
        } catch (e) {}
        ch.id = id;
        if (!writeJSON(SLOT_PREFIX + id, ch)) return;
        if (entry.clock) writeJSON(SLOT_CLOCK_PREFIX + id, entry.clock);
        ix.slots.push({
          id: id,
          name: (sl && sl.name) || ch.name || "",
          createdAt: (sl && sl.createdAt) || nowISO(),
          updatedAt: (sl && sl.updatedAt) || nowISO()
        });
        n++;
      });
      if (!n) return resolve({ ok: false, msg: "备份里的角色数据都读不出来。" });

      /* 当前角色 = 备份里的 activeSlot，找不到就用第一个 */
      var activeId = null;
      if (o.activeSlot && ix.slots.some(function (s) { return s.id === o.activeSlot; })) {
        activeId = o.activeSlot;
      } else activeId = ix.slots[0].id;
      ix.active = activeId;
      try {
        localStorage.setItem(DE.archive.SLOTS_KEY, JSON.stringify(ix));
        var act = readJSON(SLOT_PREFIX + activeId);
        if (act) localStorage.setItem(DE.SAVE_KEY, JSON.stringify(act));
        if (o.clock) writeJSON(DE.CLOCK_KEY, o.clock);
      } catch (e) {
        return resolve({ ok: false, msg: "写入失败（空间不足？）：" + e.message });
      }

      /* 手账是异步存储，最后保存再刷新 */
      var journalP = (o.journal && DE.journal && DE.journal.save)
        ? DE.journal.save(DE.journal._migrate ? DE.journal._migrate(o.journal) : o.journal)
        : Promise.resolve();

      return journalP.then(function () {
        resolve({
          ok: true, reload: true,
          msg: "已恢复 " + n + " 位旅行者" + (o.journal ? " + 手账" : "") + "，正在刷新…",
          slots: n, hasJournal: !!o.journal
        });
      }).catch(function () {
        resolve({ ok: true, reload: true, msg: "旅行者已恢复（手账保存失败），正在刷新…", slots: n });
      });
    });
  }

  /* ---------- ② 龙人端：旅行者状态快照 ---------- */

  /* 单个旅行者的状态（给主持人看的那一屏）。
     字段只增不减；要改名/删字段记得升 VERSION_TRAVELER。 */
  function travelerStatus(c) {
    if (!c || !c.abilities) return null;
    var s = DE.char.summary(c);
    var d = DE.derive(c);
    var sup = DE.supplyState(c);
    var pen = DE.judgmentPenalty(c, "other");
    var mp = DE.movePenalty(c);

    /* 装备 */
    var eq = {};
    ["weapon1", "weapon2", "body", "shield"].forEach(function (k) {
      var inst = DE.findInstance(c, (c.equipped || {})[k]);
      eq[k] = inst ? itemName(c, inst) : null;
    });

    /* 背包：按容器分组给个概要（GM 关心物资够不够） */
    var groups = DE.containerGroups(c);
    var inv = (c.inventory || []).map(function (x) {
      var d2 = DE.instDef(x);
      return {
        name: x.name || (d2 && d2.name) || "?",
        cat: d2 ? d2.cat : "",
        catLabel: d2 ? catLabel(d2.cat) : "",
        qty: x.qty || 1,
        size: DE.sizeOf(x)
      };
    });

    /* 咒语（已学的一般魔法 + 季节魔法） */
    var spells = [];
    try {
      if (DE.knownGeneral) {
        DE.knownGeneral(c).forEach(function (m) {
          spells.push({ no: m.no, name: m.name, level: m.level, season: m.season, mp: m.mp });
        });
      }
    } catch (e) {}

    return {
      app: "dragonEgg.traveler",
      version: VERSION_TRAVELER,
      exportedAt: nowISO(),
      traveler: {
        name: c.name || "",
        player: c.player || "",
        level: c.level || 1,
        exp: c.exp || 0,
        gender: c.gender || "",
        age: c.age || "",
        profession: { id: c.profession || "", name: profName(c.profession) },
        talent: { id: c.talent || "", name: typeName(c.talent) },

        abilities: {
          str: c.abilities.str, agi: c.abilities.agi,
          int: c.abilities.int, spr: c.abilities.spr
        },
        /* 被异常状态压过之后的能力值（骰面） */
        abilitiesEffective: {
          str: d.abilities.str, agi: d.abilities.agi,
          int: d.abilities.int, spr: d.abilities.spr
        },

        hp: { now: DE.hpNow(c), max: d.hpMax },
        mp: { now: DE.mpNow(c), max: d.mpMax },
        status: { value: s.status, condition: d.condition, perfect: s.statusPerfect },
        action: d.action,
        defense: s.defense,
        block: s.block || 0,

        size: { used: s.sizeUsed, limit: s.sizeLimit, over: s.sizeOver },
        carryLimit: s.carryLimit || 0,
        largeContainers: groups.large.length,
        largeContainerLimit: (DE.largeContainerLimit(c) === Infinity
          ? null : DE.largeContainerLimit(c)),

        statuses: (c.statuses || []).map(function (st) {
          return { name: st.name, value: st.value, type: st.type || "" };
        }),

        supplies: {
          foodDays: sup.foodDays,
          waterDays: sup.waterDays,
          waterCapacity: sup.waterCapacity,
          penalty: sup.penalty,
          shortDays: sup.shortDays
        },

        /* 所有判定要吃的减值（含木箱只算移动判定的那部分单独给） */
        penalties: {
          total: pen.value,
          items: pen.parts,
          moveExtra: mp.value,
          equip: s.penalty
        },

        money: c.money,
        equipment: eq,
        inventory: inv,
        spells: spells,
        favoredWeapons: (c.favoredWeapons || []).filter(Boolean),
        favoredTerrain: c.favoredTerrain || "",
        favoredWeather: c.favoredWeather || "",
        appearance: c.appearance || "",
        hometown: c.hometown || "",
        story: c.story || "",
        notes: c.notes || "",
        portrait: c.portrait || ""
      }
    };
  }

  function exportTravelerStatus(c) {
    var o = travelerStatus(c);
    return o ? JSON.stringify(o, null, 2) : "";
  }

  /* 全队：主持人一次拿走所有人 */
  function exportPartyStatus() {
    var list = [];
    try {
      DE.archive.list().forEach(function (sm) {
        var ch = DE.archive.getCharacter(sm.id);
        var st = travelerStatus(ch);
        if (st) list.push(st.traveler);
      });
    } catch (e) {}
    return JSON.stringify({
      app: "dragonEgg.party",
      version: VERSION_TRAVELER,
      exportedAt: nowISO(),
      count: list.length,
      travelers: list
    }, null, 2);
  }

  /* ---------- 下载 / 读取文件 ---------- */
  function download(filename, text) {
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" +
           p(d.getHours()) + p(d.getMinutes());
  }

  return {
    FORMAT_ALL: FORMAT_ALL, FORMAT_TRAVELER: FORMAT_TRAVELER,
    VERSION_ALL: VERSION_ALL, VERSION_TRAVELER: VERSION_TRAVELER,
    collect: collect, exportAll: exportAll, importAll: importAll,
    travelerStatus: travelerStatus,
    exportTravelerStatus: exportTravelerStatus,
    exportPartyStatus: exportPartyStatus,
    download: download, stamp: stamp
  };
})();
