/* ============================================================
 *  龙蛋物语 — 状态层：数据模型、存档、游戏时钟、迁移
 *  全局命名空间 window.DE
 *  ============================================================ */
window.DE = window.DE || {};

DE.SAVE_KEY   = "dragonEgg.save.v1";

/* ---------- 工具 ---------- */
DE.uid = function (p) {
  return (p || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
};
DE.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
DE.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

/* ---------- 能力值阶段 ---------- */
/* 数值 -> 骰子阶段 */
DE.STAGES = [4, 6, 8, 10, 12];
DE.stageOf = function (v) { return DE.STAGES.indexOf(v) >= 0 ? DE.STAGES.indexOf(v) : 0; };
DE.stageDie = function (idx) { return "d" + DE.STAGES[DE.clamp(idx, 0, 4)]; };
/* 阶段升降 */
DE.shiftStage = function (v, delta) {
  var i = DE.clamp(DE.stageOf(v) + delta, 0, 4);
  return DE.STAGES[i];
};

/* ---------- 默认存档 ---------- */
DE.newCharacter = function (over) {
  var c = {
    id: DE.uid("ch"),
    portrait: "",                // 旅行者头像 / 立绘（压缩后的 dataURL）
    wagon: null,                 // 马车（DE.wagon.empty() 的形状）
    ledger: [],                  // 金币账本（DE.ledger）
    status: 10,                  // 状态值（角色卡上的独立数值栏，刻度 2~20）
    perfectBoostUsed: false,     // ★10 状态绝佳的「提升能力值」当天是否已用掉
    name: "",
    player: "",
    level: 1,
    exp: 0,
    gender: "",
    age: "",
    profession: "",
    talent: "",                  // 战斗 | 技术 | 魔法
    spells: [],                  // 已学会的一般魔法编号（咒语书）
    seasonMagic: "",             // 季节魔法选择的季节（春/夏/秋/冬）
    mpCurrent: null,             // 当前 MP（null 表示未记录，按上限算）
    hpCurrent: null,             // 当前 HP（null 表示未记录，按上限算）—— 旅行规则要改它
    abilitySet: "standard",      // average | standard | special
    // 能力值（存骰子阶段数值）
    abilities: { str: 4, agi: 4, int: 4, spr: 4 },
    // 额外加成
    bonus: { hp: 0, mp: 0, sizeLimit: 0 },
    // 装备（背包实例 id）
    equipped: { weapon1: null, weapon2: null, body: null, shield: null },
    favoredWeapons: [""],        // 擅长武器
    favoredTerrain: "",
    favoredWeather: "",
    personal: "",
    appearance: "",
    hometown: "",
    story: "",
    money: 1000,          // 规则书：角色在游戏开始时拥有 1000 金币
    inventory: [],
    // 旅行状态
    condition: 0,                 // 状态值 = 体力 + 精神
    statuses: [],                 // 异常状态 [{name, value, type}]
    notes: "",
    /* 缺粮/缺水：只记「从第几天开始缺」，累计天数和减值由 DE.supplyState 按游戏天数推算。
       这样时间倒退或重置时，缺粮状态会自动消失（以前用独立计数器，回到第 1 天也消不掉）。 */
    supplyShortFrom: null,
    supplyShortBase: 0
  };
  if (over) { for (var k in over) c[k] = over[k]; }
  if (c.abilities) c.condition = c.abilities.str + c.abilities.spr;
  if (DE.wagon) c.wagon = DE.wagon.migrate(c.wagon);
  /* 只有真正的新角色才记一笔「初始金币」。
   * migrate() 会用它当模板，所以那里传 bootstrap:false，避免把 1000 G 的开账
   * 带到老存档（金额不同的）头上。 */
  c.ledger = [];
  var wantInit = !(over && over.bootstrap === false);
  if (DE.ledger && wantInit) {
    c.ledger.push({
      id: DE.uid("lg"),
      at: (DE.gameISO ? DE.gameISO() : new Date().toISOString()),
      delta: c.money, cat: "init", note: "角色初始金币（规则书 1000 G）", balance: c.money
    });
  }
  return c;
};

/* ---------- 异常状态 -> 能力值 的联动（规则书 p74） ----------
 * 规则书：「当角色受到【重伤】或【疾病】等异常状态影响时，能力值会下降 1 阶段。
 *         能力值按照 12→10→8→6→4 的顺序下降，能力值不会小于 4。」
 * 同一个能力被多种异常状态压制就多降几级（下限仍是 4）。
 * 返回 { str:2, agi:1 } 这样的「降了几级」表。 */
DE.statusPenalties = function (c) {
  var out = {};
  if (!c || !Array.isArray(c.statuses)) return out;
  c.statuses.forEach(function (st) {
    var def = DE.statusDef ? DE.statusDef(st.name) : null;
    var keys = (def && def.affects) || [];
    keys.forEach(function (k) { out[k] = (out[k] || 0) + 1; });
  });
  return out;
};

/* 结算后的能力值。c.abilities 是「基础值」（书面值+状态绝佳提升），
   这里把异常状态的降级叠上去 —— 派生数值（HP/MP/行动值/状态值/尺寸上限）
   全部用这个结果算。 */
DE.effAbilities = function (c) {
  var base = (c && c.abilities) || {};
  var pen = DE.statusPenalties(c);
  var eff = {}, down = {};
  DE.ABILITY_KEYS.forEach(function (k) {
    var v = base[k.key];
    if (typeof v !== "number") { eff[k.key] = v; return; }
    var n = pen[k.key] || 0, cur = v;
    for (var i = 0; i < n; i++) {
      var nx = DE.abilityDown ? DE.abilityDown(cur) : null;
      if (nx === null || nx === undefined) break;   /* 到 4 就不再降 */
      cur = nx;
    }
    eff[k.key] = cur;
    if (cur !== v) down[k.key] = v - cur;
  });
  return { abilities: eff, down: down, levels: pen };
};

/* ---------- 派生数值 ---------- */
DE.derive = function (c) {
  /* 单人使用：角色卡一定有能力值。仍留一份兜底，防止坏存档。 */
  if (!c || !c.abilities) {
    return {
      status: 10, statusPerfect: false,
      hpMax: 0, mpMax: 0, action: 0, condition: 0,
      defense: 0, equipPenalty: 0, block: 0,
      sizeLimit: 0, sizeUsed: 0, sizeOver: 0, totalPenalty: 0,
      abilities: {}, abilitiesBase: {}, abilityDown: {}, statusPenalties: {},
      conditionBase: 0, noAbilities: true
    };
  }
  var raw = c.abilities;
  /* ⚠️ 一律用「结算后」的能力值 —— 异常状态会降能力值，
     降了之后 HP/MP/行动值/状态值/尺寸上限 必须跟着变。
     以前这里直接读 c.abilities，所以「重伤(敏捷-1阶段)」对行动值毫无影响。 */
  var link = DE.effAbilities(c);
  var ab = link.abilities;
  var B = c.bonus || {};
  var hpMax = ab.str * 2 + (B.hp || 0);
  var mpMax = ab.spr * 2 + (B.mp || 0);
  var action = ab.agi + ab.int;
  var condition = ab.str + ab.spr;
  // 装备的防御点 / 减值 / 格挡
  var def = 0, penalty = 0, block = 0;
  var EQ = c.equipped || {};
  ["weapon1", "weapon2", "body", "shield"].forEach(function (slot) {
    var inst = DE.findInstance(c, EQ[slot]);
    if (!inst) return;
    var base = DE.findItem(inst.itemId);
    if (!base) return;
    var eff = DE.effectiveStats(inst);
    var cat = base.cat;
    if (cat === "armor") { def += (eff.def || 0); penalty += (eff.penalty || 0); }
    if (cat === "shield") { block = Math.max(block, eff.block || 0); penalty += (eff.penalty || 0); }
  });
  // 尺寸上限：体力 + 2 + 旅行者等级 + 加成
  var sizeLimitBase = ab.str + 2 + (c.level || 1) + (B.sizeLimit || 0);
  /* 驮货用动物额外驮运量（规则书 p51：「驮货用动物可以搬运多个大型容器」，
   * 数据里 carryCapacity 驮货 15 / 大型驮货 30）。角色自身上限不变，动物另算。 */
  var carryLimit = (DE.carryCapacityOf ? DE.carryCapacityOf(c) : 0);
  var sizeLimit = sizeLimitBase + carryLimit;
  var used = DE.usedSize(c);
  var over = Math.max(0, used - sizeLimit);
  /* 状态值：独立数值栏（2~20）。★10 即为「状态绝佳」。 */
  var status = parseInt(c.status, 10);
  if (isNaN(status)) status = 10;
  status = Math.max(2, Math.min(20, status));
  var perfect = status >= 10;
  return {
    status: status, statusPerfect: perfect,
    hpMax: hpMax, mpMax: mpMax, action: action, condition: condition,
    defense: def, equipPenalty: penalty, block: block,
    sizeLimit: sizeLimit, sizeUsed: used, sizeOver: over,
    sizeLimitBase: sizeLimitBase, carryLimit: carryLimit,
    totalPenalty: penalty - over,
    /* 联动信息：结算后的能力值 + 被异常状态降了多少 + 基础值 */
    abilities: ab, abilitiesBase: raw,
    abilityDown: link.down, statusPenalties: link.levels,
    conditionBase: raw.str + raw.spr
  };
};

/* 启动：读取存档或新建角色并初始化时钟 */
DE.boot = function () {
  /* 存档层先就位：没有索引就把老存档收养成 1 号槽位（不丢角色） */
  if (DE.archive) {
    try { DE.archive.boot(); } catch (e) { console.warn("存档层初始化失败", e); }
  }
  var c = DE.load();
  if (!c) { c = DE.newCharacter(); DE.save(c); }
  /* 老存档修正：早期版本把初始金币误设成 500，若从未买过东西（背包为空且仍是 500）
     就补回规则书的 1000。已消费过的存档不动，避免凭空加钱。 */
  if (c.money === 500 && (!c.inventory || c.inventory.length === 0)) {
    c.money = 1000;
    DE.save(c);
  }
  DE.store.character = c;
  /* ---------- 时钟：只在「从来没存过」时初始化 ----------
   * ⚠️ 这里曾经写成 `if (!ck.startISO)`。但 DE.clock.defaults() 返回的是
   *    { gameISO, advHours, manual } —— **没有 startISO 这个字段**。
   *    于是条件永远成立，**每打开一个页面就把游戏时间重置回第 1 天**：
   *      首页推进到第 2 天 → 点开马车 / 背包 → 又变回第 1 天
   *      → 药草保质期跟着"复活"，看起来就是保质期根本不工作。
   *    正确做法：看 localStorage 里到底有没有存过，而不是猜某个字段。 */
  var rawClock = null;
  try { rawClock = localStorage.getItem(DE.CLOCK_KEY); } catch (e) { rawClock = null; }
  if (!rawClock) DE.clock.reset();
  return c;
};

/* ---------- 存档 ---------- */
DE.store = { character: null };

DE.save = function (c) {
  if (!c) c = DE.store.character;
  if (!c) return;
  c._updatedAt = new Date().toISOString();
  try { localStorage.setItem(DE.SAVE_KEY, JSON.stringify(c)); }
  catch (e) { console.warn("存档失败", e); }
  /* 同步写回它所属的存档槽位。
     限流 400ms —— 存档箱要能看到最新数据，但没必要每次按键都写两份。 */
  if (DE.archive) {
    var now = Date.now();
    if (!DE.save._lastSlot || now - DE.save._lastSlot > 400) {
      DE.save._lastSlot = now;
      try { DE.archive.stashActive(); } catch (e) { /* 槽位没建好就算了 */ }
    } else {
      clearTimeout(DE.save._timer);
      DE.save._timer = setTimeout(function () {
        DE.save._lastSlot = Date.now();
        try { DE.archive.stashActive(); } catch (e) {}
      }, 400);
    }
  }
};

DE.load = function () {
  var raw = null;
  try { raw = localStorage.getItem(DE.SAVE_KEY); } catch (e) {}
  if (!raw) return null;
  try {
    var c = JSON.parse(raw);
    c = DE.migrate(c);
    return c;
  } catch (e) { console.warn("读档失败", e); return null; }
};

/* 兼容旧版本存档 / 补全缺失字段 */
DE.migrate = function (c) {
  /* 模板不要带「初始金币」那一笔，否则老存档会被加上并不存在的 1000 G 账目 */
  var base = DE.newCharacter({ bootstrap: false });
  (function merge(dst, src) {
    for (var k in src) {
      if (src[k] === undefined || src[k] === null) continue;
      if (typeof src[k] === "object" && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) {
        merge(dst[k], src[k]);
      } else {
        dst[k] = src[k];
      }
    }
  })(base, c);
  if (!Array.isArray(base.inventory)) base.inventory = [];
  if (!base.equipped) base.equipped = { weapon1: null, weapon2: null, body: null, shield: null };
  if (DE.wagon) base.wagon = DE.wagon.migrate(base.wagon);
  if (DE.ledger) base.ledger = DE.ledger.migrate(base);
  /* 状态值：角色卡上的独立数值栏，刻度 2~20，起步 10（★10 = 状态绝佳） */
  var st = parseInt(base.status, 10);
  if (isNaN(st)) st = 10;
  base.status = Math.max(2, Math.min(20, st));

  /* 老存档：缺粮状态以前用独立计数器 supplyShortDays 存，
     现在改成「缺粮起始天 supplyShortFrom」+ 按游戏天数推算。
     这里一次性把老数据折算过来。 */
  if (!base.supplyShortFrom && typeof base.supplyShortDays === "number" && base.supplyShortDays > 0) {
    var curDay = 1;
    try { if (DE.clock && DE.clock.dayNumber) curDay = DE.clock.dayNumber(); } catch (e) {}
    base.supplyShortFrom = Math.max(1, curDay - base.supplyShortDays + 1);
    var pOld = (typeof base.supplyPenalty === "number") ? base.supplyPenalty : base.supplyShortDays;
    base.supplyShortBase = Math.max(1, pOld - (base.supplyShortDays - 1));
  }
  if (base.supplyShortFrom == null) base.supplyShortFrom = null;
  if (typeof base.supplyShortBase !== "number") base.supplyShortBase = 0;

  /* 老存档清理：丢掉历史版本（"旅行者/龙人两张卡"时期）留下的字段 */
  ["kind", "dragon", "dragonName", "dragonPortrait", "world"].forEach(function (k) {
    delete base[k];
  });
  return base;
};

/* ---------- 清空全部数据（首页「清空」按钮） ---------- */
DE.resetAll = function () {
  try { localStorage.removeItem(DE.SAVE_KEY); } catch (e) {}
  try { localStorage.removeItem(DE.CLOCK_KEY); } catch (e) {}
  if (DE.archive && DE.archive.clearAll) { try { DE.archive.clearAll(); } catch (e) {} }
  DE.store.character = null;
};
