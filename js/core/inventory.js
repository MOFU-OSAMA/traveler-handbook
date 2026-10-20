/* ============================================================
 *  龙蛋物语 — 背包 / 物品 / 保质期 引擎
 *  规则依据：道具章节 p44（尺寸·耐久·买卖）、p51（容器）、p52（药草保质期）
 *  ============================================================ */
window.DE = window.DE || {};

/* ---------- 基础查询 ---------- */
DE.findItem = function (id) {
  return DE.ITEMS.filter(function (x) { return x.id === id; })[0] || null;
};
DE.findHerb = function (id) {
  return DE.HERBS.filter(function (x) { return x.id === id; })[0] || null;
};
DE.findInstance = function (c, instId) {
  if (!c || !instId) return null;
  return c.inventory.filter(function (x) { return x.instId === instId; })[0] || null;
};
DE.instDef = function (inst) {
  if (!inst) return null;
  return inst.herbId ? DE.findHerb(inst.herbId) : DE.findItem(inst.itemId);
};

/* ---------- 物品实例 ---------- */
/* kind: "item" | "herb" */
DE.makeInstance = function (def, opts) {
  opts = opts || {};
  var isHerb = !!def.isHerb;
  var traits = opts.traits || [];
  var inst = {
    instId: DE.uid("i"),
    kind: isHerb ? "herb" : "item",
    itemId: isHerb ? null : def.id,
    herbId: isHerb ? def.id : null,
    name: def.name,
    qty: opts.qty || 1,
    traits: traits,
    // 价格快照（购买时的实际单价）
    paidPrice: opts.paidPrice != null ? opts.paidPrice : DE.priceOf(def, traits),
    // 耐久：道具的耐久数据 = 尺寸；〈结实的〉耐久×2；〈奥利哈刚的〉不会损坏
    durabilityMax: DE.durabilityOf(def, traits),
    durability: DE.durabilityOf(def, traits),
    containerId: opts.containerId || null,
    // 装备
    equipped: false,
    // 容器状态
    openedISO: opts.openedISO || null,   // 药草瓶：开始使用时间
    // 保质期
    collectedISO: opts.collectedISO || (isHerb ? DE.gameISO() : null),
    // 药草瓶内容
    herbIds: opts.herbIds || [],
    // 自定义
    note: opts.note || ""
  };
  if (def.perishDays) inst.collectedISO = opts.collectedISO || DE.gameISO();
  return inst;
};

/* 有效尺寸（秘银的 -2） */
DE.sizeOf = function (inst) {
  var def = DE.instDef(inst);
  if (!def) return 0;
  var s = def.size || 1;
  if (inst.traits && inst.traits.indexOf("秘银的") >= 0) s = Math.max(0, s - 2);
  return s;
};

/* 有效耐久上限 */
DE.durabilityOf = function (def, traits) {
  traits = traits || [];
  if (traits.indexOf("奥利哈刚的") >= 0) return 999;         // 绝对不会损坏
  var d = def.durability != null ? def.durability : (def.size || 1);
  if (traits.indexOf("结实的") >= 0) d = d * 2;              // 耐久度变为原本的 2 倍
  if (traits.indexOf("二手的") >= 0) d = 1;                  // 耐久度减少为 1 点
  if (traits.indexOf("秘银的") >= 0) d = 5;                  // 耐久度自动变为 5
  return d;
};

/* 有效数值（高品质的 / 魔法强化的 加成） */
DE.effectiveStats = function (inst) {
  var def = DE.instDef(inst);
  if (!def) return {};
  var out = { def: def.def || 0, block: def.block || 0, penalty: def.penalty || 0,
              hitBonus: 0, dmgBonus: 0, genericBonus: 0 };
  var t = inst.traits || [];
  if (t.indexOf("高品质的") >= 0) { out.hitBonus += 1; out.def += 1; out.genericBonus += 1; }
  if (t.indexOf("魔法强化的") >= 0) { out.dmgBonus += 1; out.def += 1; out.genericBonus += 1; }
  if (def.cat === "shield" && (t.indexOf("高品质的") >= 0 || t.indexOf("魔法强化的") >= 0)) out.block += 1;
  if (t.indexOf("秘银的") >= 0 && def.slot === "body") out.penalty = out.penalty + 1;
  return out;
};

/* 游戏内当前时刻（ISO 字符串）。
 * 关键：药草 / 药草瓶的时间戳必须用【游戏时间】写入，
 * 因为 shelfLife() 是用 DE.clock.now() 读的 —— 用 real time 写会永远不过期。 */
DE.gameISO = function () { return DE.clock.now().toISOString(); };

/* 单个实例的总价 */
DE.priceOf = function (def, traits) {
  if (def.isHerb) {
    if (typeof def.price === "number") return def.price;      // 已由 DE.herbDef 定好价格
    var lv = def.herbLevel || def.level;
    var pl = DE.HERB_RULES.priceByLevel.filter(function (x) { return x.level === lv; })[0];
    return pl ? pl.price : null;
  }
  return DE.calcTraitPrice(def.price || 0, traits || []);
};

/* ---------- 容器 ---------- */
DE.containerOf = function (c, inst) {
  if (!inst || !inst.containerId) return null;
  return DE.findInstance(c, inst.containerId);
};
/* 容器已用容量（其中物品尺寸之和 × 数量） */
DE.containerUsed = function (c, containerInst) {
  if (!containerInst) return 0;
  return c.inventory.reduce(function (s, x) {
    if (x.containerId !== containerInst.instId) return s;
    return s + DE.sizeOf(x) * (x.qty || 1);
  }, 0);
};
DE.containerCapacity = function (containerInst) {
  var def = DE.instDef(containerInst);
  if (!def) return 0;
  return def.capacity || 0;
};

/* ---------- 持有尺寸 ---------- */
/* 规则：装备栏中的武器、防具、旅途装备视为尺寸 0，不计入持有尺寸。
 *       未装备的道具与容器全部计入。 */
DE.usedSize = function (c) {
  if (!c || !c.inventory) return 0;
  return c.inventory.reduce(function (s, x) {
    if (x.equipped) return s;               // 装备栏内视为尺寸 0
    if (x.containerId) {                    // 容器内的道具不重复计入（容器本身已计入）
      var room = DE.findInstance(c, x.containerId);
      var rd = room ? DE.instDef(room) : null;
      if (rd && (rd.capacity || 0) > 0) return s;
    }
    return s + DE.sizeOf(x) * (x.qty || 1);
  }, 0);
};
DE.sizeLimitOf = function (c) {
  return c.abilities.str + 2 + c.level + (c.bonus.sizeLimit || 0);
};
/* 超限带来的全判定减值 */
DE.overSizePenalty = function (c) {
  return Math.max(0, DE.usedSize(c) - DE.totalSizeLimit(c));
};

/* ---------- 查找放置位置 ---------- */
/* 找一个能容纳 size 尺寸的容器（优先容量最小且放得下的，否则返回 null 表示放背包主仓） */
DE.findRoom = function (c, size, qty) {
  qty = qty || 1;
  var need = size * qty;
  var containers = c.inventory.filter(function (x) {
    var d = DE.instDef(x);
    return d && (d.cat === "container" || d.cat === "large") && (d.capacity || 0) > 0 && !x.equipped;
  });
  // 只允许“大型容器”嵌套常规容器；规则上每个角色只能持有 1 个大型容器
  var best = null;
  containers.forEach(function (ct) {
    var cap = DE.containerCapacity(ct);
    if (cap <= 0) return;
    var used = DE.containerUsed(c, ct);
    if (used + need <= cap) {
      if (!best || cap < DE.containerCapacity(best)) best = ct;
    }
  });
  return best;
};

/* 每个角色只能持有 1 个大型容器 */
DE.largeContainerCount = function (c) {
  return c.inventory.filter(function (x) {
    var d = DE.instDef(x);
    return d && d.cat === "large";
  }).length;
};
DE.hasHerbBottle = function (c) {
  return c.inventory.filter(function (x) {
    var d = DE.instDef(x); return d && d.special === "herbBottle";
  })[0] || null;
};

/* ============================================================
 *  容器种类适配（规则书 p51「容器」）
 *
 *  规则书原文：
 *    · 容器可以装入与「容量」栏中记载数值相同尺寸的道具。
 *    · 每名角色行走时只能持有 1 个大型容器（木箱／水桶／背包）。
 *    · 驮货用动物可以搬运多个大型容器。
 *
 *  另有两条数据里写着、但以前没人用的规则：
 *    · 驮货用动物 carryCapacity：能驮运的合计尺寸（驮货 15 / 大型驮货 30）
 *    · 木箱 penaltyNote：人类搬运时【移动判定】-1
 *    · 水袋 / 魔法瓶 waterDays:1、水桶 waterDays:15（能装几天份的水）
 * ============================================================ */

/* 驮货用动物实例列表（animal === "驮货"） */
DE.packAnimals = function (c) {
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  return inv.filter(function (x) {
    var d = DE.instDef(x);
    return d && d.cat === "animal" && d.animal === "驮货" && !x.equipped;
  });
};

/* 驮货动物合计可驮尺寸 */
DE.carryCapacityOf = function (c) {
  return DE.packAnimals(c).reduce(function (s, x) {
    var d = DE.instDef(x);
    return s + ((d && d.carryCapacity) || 0) * (x.qty || 1);
  }, 0);
};

/* 实际可持有尺寸上限 = 角色自身上限 + 驮货动物可驮尺寸
 * 规则书没写"动物尺寸算给角色"，但尺寸统计是统一一份的，
 * 所以动物的驮运能力就体现为上限的加值。 */
DE.totalSizeLimit = function (c) {
  return DE.sizeLimitOf(c) + DE.carryCapacityOf(c);
};

/* 大型容器可持有数量：没有驮货动物时 1 个；有动物则不受限（动物驮着）。
 * 平衡点是动物的 carryCapacity —— 多带的容器及其货物要吃得下那份驮运量。 */
DE.largeContainerLimit = function (c) {
  return DE.packAnimals(c).length ? Infinity : 1;
};

/* 【移动判定】减值：人类搬运木箱 -1（规则书 p51）。
 * 返回 { value, reasons[] }，value 为负数或 0。 */
DE.movePenalty = function (c) {
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  var reasons = [], value = 0;
  inv.forEach(function (x) {
    var d = DE.instDef(x);
    if (!d || d.cat !== "large") return;
    var m = /-\s*(\d+)/.exec(d.penaltyNote || "");
    if (!m) return;
    var n = parseInt(m[1], 10) * (x.qty || 1);
    value -= n;
    reasons.push("携带〈" + x.name + "〉【移动判定】" + (n === 1 ? "" : String(n)) + " -" + n);
  });
  return { value: value, reasons: reasons };
};

/* 水容器合计能装几天份的水（水袋 1 / 魔法瓶 1 / 水桶 15） */
DE.waterDaysOf = function (c) {
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  return inv.reduce(function (s, x) {
    var d = DE.instDef(x);
    if (!d || !d.holdsWater) return s;
    return s + (d.waterDays || 1) * (x.qty || 1);
  }, 0);
};

/* 容器分类：把背包里的容器按规则种类分好，供背包页分组展示
 * 注意优先级：药草瓶虽然 cat 也是 "container"，但它有自己的上限/寿命规则，
 * 必须单独归到 special，不能和小型容器混在一起。 */
DE.containerGroups = function (c) {
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  var groups = { large: [], container: [], special: [] };
  inv.forEach(function (x) {
    var d = DE.instDef(x);
    if (!d) return;
    if (d.special === "herbBottle") groups.special.push(x);
    else if (d.cat === "large") groups.large.push(x);
    else if (d.cat === "container") groups.container.push(x);
  });
  return groups;
};

/* 未装入任何容器的散装道具（容器类与动物本身除外） */
DE.looseItems = function (c) {
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  return inv.filter(function (x) {
    if (x.equipped) return false;
    if (x.containerId) return false;
    var d = DE.instDef(x);
    if (!d) return false;
    return !(d.cat === "container" || d.cat === "large" || d.cat === "animal" || d.special === "herbBottle");
  });
};

/* ---------- 保质期引擎 ---------- */
/* 药草：采集/购买 24 小时后腐坏；放入〈药草瓶〉后，从瓶子开始使用算起第 7 天
 *       瓶子本身失去保存能力（其中的药草也不能再装入其他容器）。 */
DE.shelfLife = function (c, inst) {
  var def = DE.instDef(inst);
  if (!def) return null;
  var now = DE.clock.now().getTime();

  if (inst.kind === "herb") {
    var bottle = DE.hasHerbBottle(c);
    var bottled = bottle && inst.containerId === bottle.instId;
    if (bottled) {
      var startISO = bottle.openedISO || bottle.createdISO;
      var start = startISO ? new Date(startISO).getTime() : now;
      var exp = start + DE.HERB_RULES.bottleDays * 24 * 3600 * 1000;
      return {
        mode: "bottle", containerName: bottle.name,
        startISO: startISO, expireISO: new Date(exp).toISOString(),
        totalMs: DE.HERB_RULES.bottleDays * 24 * 3600 * 1000,
        remainMs: exp - now, expired: now >= exp,
        label: DE.HERB_RULES.bottleDays + " 天（药草瓶）"
      };
    }
    var c0 = inst.collectedISO ? new Date(inst.collectedISO).getTime() : now;
    var exp0 = c0 + DE.HERB_RULES.freshHours * 3600 * 1000;
    return {
      mode: "fresh", containerName: null,
      startISO: inst.collectedISO, expireISO: new Date(exp0).toISOString(),
      totalMs: DE.HERB_RULES.freshHours * 3600 * 1000,
      remainMs: exp0 - now, expired: now >= exp0,
      label: DE.HERB_RULES.freshHours + " 小时（未保鲜）"
    };
  }

  /* 其它会腐坏的食物（食材 24 小时） */
  if (def.perishDays) {
    var c1 = inst.collectedISO ? new Date(inst.collectedISO).getTime() : now;
    var exp1 = c1 + def.perishDays * 24 * 3600 * 1000;
    return {
      mode: "perish", containerName: null,
      startISO: inst.collectedISO, expireISO: new Date(exp1).toISOString(),
      totalMs: def.perishDays * 24 * 3600 * 1000,
      remainMs: exp1 - now, expired: now >= exp1,
      label: def.perishDays * 24 + " 小时"
    };
  }
  return null;
};

/* 全部带保质期的条目，按紧急度排序 */
DE.expiryList = function (c) {
  var out = [];
  /* 兜底：inventory 不是数组时当空处理 */
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  inv.forEach(function (inst) {
    var sl = DE.shelfLife(c, inst);
    if (sl) out.push({ inst: inst, life: sl });
  });
  out.sort(function (a, b) { return a.life.remainMs - b.life.remainMs; });
  return out;
};

/* 过期提醒：返回 {expired:[], soon:[]}（soon = 24 小时内到期） */
DE.expiryAlerts = function (c) {
  var l = DE.expiryList(c);
  return {
    expired: l.filter(function (x) { return x.life.expired; }),
    soon: l.filter(function (x) { return !x.life.expired && x.life.remainMs <= 24 * 3600 * 1000; }),
    all: l
  };
};

/* 更短的剩余时间（表格里用，完整版见 fmtRemain） */
DE.fmtRemainBrief = function (ms) {
  if (ms <= 0) return "已腐坏";
  var h = ms / 3600000;
  if (h >= 24) return Math.floor(h / 24) + " 天";
  if (h >= 1) return Math.floor(h) + " 小时";
  return Math.max(1, Math.floor(ms / 60000)) + " 分";
};

DE.fmtRemain = function (ms) {
  if (ms <= 0) return "已腐坏";
  var h = ms / 3600000;
  if (h >= 48) return Math.floor(h / 24) + " 天 " + Math.floor(h % 24) + " 小时";
  if (h >= 1) return Math.floor(h) + " 小时 " + Math.floor((ms % 3600000) / 60000) + " 分";
  return Math.max(1, Math.floor(ms / 60000)) + " 分钟";
};

/* ---------- 背包操作 ---------- */
DE.addItem = function (c, def, opts) {
  opts = opts || {};
  var qty = opts.qty || 1;
  var traits = opts.traits || [];
  var inst = DE.makeInstance(def, opts);
  // 药草瓶：记录开始使用时间
  if (def.special === "herbBottle") inst.createdISO = DE.gameISO();
  // 容器归属
  if (opts.containerId) {
    inst.containerId = opts.containerId;
  } else if (def.cat === "herb") {
    // 药草优先装入〈药草瓶〉以延长保质期
    var bottle = DE.hasHerbBottle(c);
    if (bottle) {
      var bd = DE.instDef(bottle);
      var inside = c.inventory.filter(function (x) { return x.containerId === bottle.instId; }).length;
      var opened = bottle.openedISO ? new Date(bottle.openedISO).getTime() : null;
      var stillOk = !opened || DE.clock.now().getTime() < opened + (bd.lifetimeDays || 7) * 24 * 3600 * 1000;
      if (inside < (bd.herbCapacity || 10) && stillOk) {
        if (!bottle.openedISO) bottle.openedISO = DE.gameISO();
        inst.containerId = bottle.instId;
      }
    }
  } else if (!def.slot || opts.forceBag) {
    /* 自动收纳只针对「普通道具」。两类东西绝不自动塞进容器：
       · 动物（cat "animal"）是活物，塞进背包/木箱不合理；
       · 容器本身（cat "container" / "large"）不自动套娃 ——
         否则〈水桶〉会被塞进〈木箱〉，大型容器层层嵌套，
         把「每名角色只能持有 1 个大型容器」这条规则绕过去。 */
    var noAutoNest = (def.cat === "animal" || def.cat === "container" || def.cat === "large");
    var room = noAutoNest ? null : DE.findRoom(c, DE.sizeOf(inst), qty);
    inst.containerId = room ? room.instId : null;
  }
  c.inventory.push(inst);
  return inst;
};

/* 药草装入药草瓶 */
DE.putHerbInBottle = function (c, herbInst, bottleInst) {
  if (!bottleInst) {
    bottleInst = DE.hasHerbBottle(c);
    if (!bottleInst) return { ok: false, msg: "没有〈药草瓶〉，无法延长药草的保质期。" };
  }
  var def = DE.instDef(bottleInst);
  var cap = def.herbCapacity || 10;
  var inside = c.inventory.filter(function (x) { return x.containerId === bottleInst.instId; });
  if (inside.length >= cap) return { ok: false, msg: "〈" + bottleInst.name + "〉已装满（最多 " + cap + " 个药草）。" };
  // 瓶子开始使用时间：第一次放入时记录
  if (!bottleInst.openedISO) bottleInst.openedISO = DE.gameISO();
  var opened = new Date(bottleInst.openedISO).getTime();
  var limit = opened + (def.lifetimeDays || 7) * 24 * 3600 * 1000;
  if (DE.clock.now().getTime() >= limit) {
    return { ok: false, msg: "〈" + bottleInst.name + "〉已使用超过 " + (def.lifetimeDays || 7) + " 天，失去保存能力，不能再使用。" };
  }
  herbInst.containerId = bottleInst.instId;
  return { ok: true, msg: "已将〈" + herbInst.name + "〉放入〈" + bottleInst.name + "〉，保质期延长至 " + (def.lifetimeDays || 7) + " 天。" };
};

DE.removeInstance = function (c, instId) {
  var idx = -1;
  c.inventory.forEach(function (x, i) { if (x.instId === instId) idx = i; });
  if (idx < 0) return false;
  // 卸下装备
  for (var s in c.equipped) if (c.equipped[s] === instId) c.equipped[s] = null;
  // 把里面的东西倒出来
  c.inventory.forEach(function (x) { if (x.containerId === instId) x.containerId = null; });
  c.inventory.splice(idx, 1);
  return true;
};

/* 数量增减（同类堆叠：仅对无特征的消耗品） */
DE.consume = function (c, instId, n) {
  n = n || 1;
  var inst = DE.findInstance(c, instId);
  if (!inst) return false;
  if ((inst.qty || 1) <= n) { DE.removeInstance(c, instId); return true; }
  inst.qty -= n;
  return true;
};

/* ---------- 装备 ---------- */
DE.SLOTS = [
  { key: "weapon1", label: "武器 1", accept: ["weapon"] },
  { key: "weapon2", label: "武器 2", accept: ["weapon"] },
  { key: "body",    label: "盾与铠甲 · 身体", accept: ["armor"] },
  { key: "shield",  label: "盾与铠甲 · 盾", accept: ["shield"] }
];

DE.canEquip = function (c, inst, slotKey) {
  var def = DE.instDef(inst);
  var slot = DE.SLOTS.filter(function (s) { return s.key === slotKey; })[0];
  if (!def || !slot) return { ok: false, msg: "无法装备到该栏位。" };
  if (slot.accept.indexOf(def.cat) < 0) return { ok: false, msg: "〈" + def.name + "〉不能装备到「" + slot.label + "」。" };
  if (inst.containerId) {
    var ct = DE.findInstance(c, inst.containerId);
    if (ct) return { ok: false, msg: "请先把〈" + def.name + "〉从〈" + ct.name + "〉中取出。" };
  }
  return { ok: true };
};

DE.equip = function (c, instId, slotKey) {
  var inst = DE.findInstance(c, instId);
  if (!inst) return { ok: false, msg: "找不到该道具。" };
  var chk = DE.canEquip(c, inst, slotKey);
  if (!chk.ok) return chk;
  // 双手武器 / 盾的互斥处理由 UI 提示，这里只做基础占用
  c.equipped[slotKey] = instId;
  inst.equipped = true;
  inst.equippedSlot = slotKey;
  return { ok: true, msg: "已装备〈" + inst.name + "〉到「" + slotKey + "」。" };
};

DE.unequip = function (c, slotKey) {
  var id = c.equipped[slotKey];
  if (!id) return { ok: false, msg: "该栏位没有装备。" };
  var inst = DE.findInstance(c, id);
  if (inst) { inst.equipped = false; inst.equippedSlot = null; }
  c.equipped[slotKey] = null;
  return { ok: true, msg: "已卸下装备。" };
};

/* ---------- 商店 ---------- */
DE.buy = function (c, def, opts) {
  opts = opts || {};
  var qty = opts.qty || 1;
  var traits = opts.traits || [];
  var unit = DE.priceOf(def, traits);
  if (unit == null) return { ok: false, msg: "〈" + def.name + "〉是非卖品，无法购买（只能在对应地貌采集）。" };
  var total = unit * qty;
  if ((c.money || 0) < total) return { ok: false, msg: "金币不足：需要 " + total + " G，你只有 " + (c.money || 0) + " G。" };

  // 大型容器限制（有驮货动物则不受限 —— 规则书 p51）
  if (def.cat === "large" && DE.largeContainerCount(c) >= DE.largeContainerLimit(c) && !opts.allowExtra) {
    return {
      ok: false,
      msg: "每名角色行走时只能持有 1 个大型容器（木箱 / 水桶 / 背包）。" +
           "带一只〈驮货用动物〉可以让它帮你搬多个大型容器。"
    };
  }
  // 腰包限制
  if (def.special === "oneOnly") {
    var has = c.inventory.filter(function (x) { return x.itemId === def.id; }).length;
    if (has >= 1) return { ok: false, msg: "腰上只能别一个腰包。" };
  }
  // 尺寸上限检查
  var probe = DE.makeInstance(def, { traits: traits });
  var after = DE.usedSize(c) + DE.sizeOf(probe) * qty;
  var limit = DE.totalSizeLimit(c);   /* 含驮货动物驮运量 */
  var warn = after > limit;

  var paidTraits = traits.length ? "（" + traits.join("、") + "）" : "";
  DE.ledger.spend(c, total, "buy", "购买〈" + def.name + "〉×" + qty + paidTraits,
    { itemId: def.id, qty: qty });
  var made = [];
  for (var i = 0; i < qty; i++) {
    made.push(DE.addItem(c, def, {
      traits: traits, paidPrice: unit, qty: 1,
      collectedISO: opts.collectedISO,     // 药草 / 食材的采集（购买）时间
      containerId: opts.containerId
    }));
  }
  DE.save(c);
  return {
    ok: true, instances: made, total: total, unit: unit, overSize: warn,
    msg: "购买 " + qty + " 个〈" + def.name + "〉，花费 " + total + " G。" +
         (warn ? " ⚠ 持有尺寸已达 " + after + " / " + limit + "，超出的 " + (after - limit) + " 点将使所有判定受到减值。" : "")
  };
};

DE.sell = function (c, instId, qty) {
  qty = qty || 1;
  var inst = DE.findInstance(c, instId);
  if (!inst) return { ok: false, msg: "找不到该道具。" };
  if (inst.durability != null && inst.durability <= 0) {
    return { ok: false, msg: "耐久度为 0 的〈损坏的〉道具不能贩卖。" };
  }
  var def = DE.instDef(inst);
  if (inst.kind === "herb") return { ok: false, msg: "一般商家不会收购药草，〈" + inst.name + "〉无法卖出。" };
  var half = Math.floor((inst.paidPrice || def.price || 0) / 2);
  var total = half * qty;
  DE.ledger.earn(c, total, "sell", "卖出〈" + inst.name + "〉×" + qty + "（半价）",
    { itemId: inst.itemId || inst.herbId, qty: qty });
  DE.consume(c, instId, qty);
  DE.save(c);
  return { ok: true, msg: "卖出 " + qty + " 个〈" + inst.name + "〉，获得 " + total + " G（购买价格的一半）。", total: total };
};

/* 道具修理（城市设施）：恢复耐久到初始值 */
/* 丢弃道具：不减钱，直接移除；会先卸下装备、清掉容器引用 */
DE.dropItem = function (c, instId, qty) {
  qty = Math.max(1, qty || 1);
  var x = DE.findInstance(c, instId);
  if (!x) return { ok: false, msg: "找不到这个道具。" };
  var name = x.name;
  if (x.equippedSlot) {
    /* 注意：装备栏字段是 c.equipped（不是 c.equipment），写错会留下悬空引用 */
    var eq = c.equipped || (c.equipped = {});
    if (eq[x.equippedSlot] === x.instId) eq[x.equippedSlot] = null;
    x.equipped = false;
    x.equippedSlot = null;
  }
  /* 同栏位若还指向这个实例，一并清掉 */
  Object.keys(c.equipped || {}).forEach(function (k) {
    if (c.equipped[k] === x.instId) c.equipped[k] = null;
  });
  c.inventory.forEach(function (y) { if (y.containerId === x.instId) y.containerId = null; });
  if ((x.qty || 1) > qty) {
    x.qty -= qty;
  } else {
    c.inventory = c.inventory.filter(function (y) { return y.instId !== x.instId; });
  }
  return { ok: true, msg: "已丢弃 " + qty + " 个〈" + name + "〉。" };
};

DE.repairCost = function (inst) {
  var price = inst.paidPrice || 0;
  return Math.floor(price / 2);   // 物品制造/修理：材料费为价格的一半
};
DE.repair = function (c, instId) {
  var inst = DE.findInstance(c, instId);
  if (!inst) return { ok: false, msg: "找不到该道具。" };
  var cost = DE.repairCost(inst);
  if ((c.money || 0) < cost) return { ok: false, msg: "金币不足：修理需要 " + cost + " G。" };
  DE.ledger.spend(c, cost, "repair", "修理〈" + inst.name + "〉");
  inst.durability = inst.durabilityMax;
  DE.save(c);
  return { ok: true, msg: "修理〈" + inst.name + "〉花费 " + cost + " G，耐久度恢复为 " + inst.durabilityMax + "。" };
};

/* 消耗（使用道具）：耐久 / 数量减少 */
DE.useItem = function (c, instId) {
  var inst = DE.findInstance(c, instId);
  if (!inst) return { ok: false, msg: "找不到该道具。" };
  var def = DE.instDef(inst);
  // 药草与一次性道具：直接消耗
  if (inst.kind === "herb" || (def && def.consumable)) {
    DE.consume(c, instId, 1);
    DE.save(c);
    return { ok: true, msg: "已使用〈" + inst.name + "〉。", consumed: true };
  }
  // 食物：吃完减少数量
  if (def && def.cat === "food") {
    DE.consume(c, instId, 1);
    DE.save(c);
    return { ok: true, msg: "已食用〈" + inst.name + "〉。", consumed: true };
  }
  return { ok: false, msg: "〈" + inst.name + "〉不是可以消耗使用的道具。" };
};

/* 判定大失败 -> 耐久 -1 */
DE.damageItem = function (c, instId, n) {
  n = n || 1;
  var inst = DE.findInstance(c, instId);
  if (!inst) return { ok: false, msg: "找不到该道具。" };
  if ((inst.traits || []).indexOf("奥利哈刚的") >= 0) {
    return { ok: true, msg: "〈" + inst.name + "〉是奥利哈刚材质，绝对不会损坏。", durability: inst.durability };
  }
  inst.durability = Math.max(0, (inst.durability == null ? inst.durabilityMax : inst.durability) - n);
  DE.save(c);
  return {
    ok: true, durability: inst.durability,
    msg: "〈" + inst.name + "〉耐久度 -" + n + " → " + inst.durability + "/" + inst.durabilityMax +
         (inst.durability === 0 ? "（已损坏，无法使用，需要修理）" : "")
  };
};

/* ---------- 搜索 / 统计 ---------- */
DE.searchItems = function (q, cat) {
  q = (q || "").trim().toLowerCase();
  return DE.ITEMS.filter(function (it) {
    if (cat && cat !== "all" && it.cat !== cat) return false;
    if (!q) return true;
    return (it.name + " " + (it.desc || "") + " " + (DE.CATEGORIES[it.cat] ? DE.CATEGORIES[it.cat].label : "")).toLowerCase().indexOf(q) >= 0;
  });
};
DE.inventoryStats = function (c) {
  var n = c.inventory.length;
  var herbs = c.inventory.filter(function (x) { return x.kind === "herb"; }).length;
  /* 注意：动物之类的道具是 noDurability:true、durability:0，
     它们根本没有耐久概念，不能被算成「已损坏」。
     （以前漏了这个判断，带一只驮货动物就会显示「已损坏 1」。） */
  var dmg = c.inventory.filter(function (x) {
    if (x.durability == null || x.durability > 0) return false;
    var d = DE.instDef(x);
    return !(d && d.noDurability);
  }).length;
  var alerts = DE.expiryAlerts(c);
  return { count: n, herbs: herbs, damaged: dmg, expired: alerts.expired.length, soon: alerts.soon.length };
};

/* ============================================================
 *  〈生意兴隆〉自动化（规则书 p28）
 *  —— 商人在商店里「同时买卖至少 4 件相同的道具」时，
 *     掷【智力 + 精神】，按表 1 得出价格增减率，自动改价成交。
 *  ============================================================ */
DE.bizBoom = (function () {

  var rng = function () { return Math.random(); };
  function setRng(fn) { rng = fn || function () { return Math.random(); }; }

  function rule() { return DE.BIZ_BOOM || {}; }

  /* 角色会不会这个技能 */
  function hasSkill(c) {
    if (!c) return false;
    /* 商人职业自带；〈副业〉也可能选到 */
    var prof = (DE.PROFESSIONS || []).filter(function (p) { return p.id === c.profession; })[0];
    if (prof && (prof.skills || []).indexOf(rule().skill) >= 0) return true;
    if (Array.isArray(c.skills) && c.skills.indexOf(rule().skill) >= 0) return true;
    if (c.sideJob === rule().skill) return true;     // 〈副业〉选的那一项
    return false;
  }

  /* 能不能用：条件是否满足 */
  /* opts: { kind:"item", id, buyQty, sellQty } */
  function canUse(c, opts) {
    opts = opts || {};
    var R = rule();
    var min = R.minCount || 4;
    var errs = [], warns = [];

    if (!hasSkill(c)) errs.push("这个角色没有〈" + R.skill + "〉技能（商人自带，或〈副业〉选它）。");
    if (c && c.tradeBan && c.tradeBan.id === opts.id) {
      errs.push("〈" + (c.tradeBan.name || "该道具") + "〉是用〈生意兴隆〉买进的，原则上不能在同一城市卖出。");
    }

    var bq = parseInt(opts.buyQty || 0, 10) || 0;
    var sq = parseInt(opts.sellQty || 0, 10) || 0;
    if (bq + sq < min) {
      errs.push("至少同时买卖 " + min + " 件相同的道具（现在买 " + bq + " + 卖 " + sq + " = " + (bq + sq) + "）。");
    }
    if (bq > 0 && sq > 0) {
      /* 规则是「相同的道具」，所以买卖必须指同一种 */
      /* 这里由调用方保证 id 一致 */
    }
    /* 购买时须持有「按定价」够用的金币 */
    if (bq > 0) {
      var base = baseBuyPrice(c, opts);
      var needBase = base * bq;
      if ((c.money || 0) < needBase) {
        errs.push("购买时必须持有足以按定价购入的金币：定价 " + base + " × " + bq +
                  " = " + needBase + " G，你只有 " + (c.money || 0) + " G。");
      }
    }
    /* 卖出的份数不能超过持有量（按道具种类算） */
    if (sq > 0) {
      var have = countOf(c, opts.id);
      if (have < sq) errs.push("你只有 " + have + " 件可卖，卖不出 " + sq + " 件。");
    }
    if (bq === 0 && sq === 0) errs.push("还没决定买卖数量。");

    return { ok: errs.length === 0, errors: errs, warns: warns };
  }

  /* 该道具的「定价」（受特性影响前，按 traits 算） */
  function baseBuyPrice(c, opts) {
    var def = findDef(opts);
    if (!def) return 0;
    return DE.priceOf(def, opts.traits || []) || 0;
  }
  /* 一般售价（没有生意兴隆时卖一件能拿多少）= 入手价的一半 */
  function baseSellPrice(c, opts) {
    if (opts.sellUnit != null) return opts.sellUnit;
    var inst = firstOwned(c, opts.id);
    var def = findDef(opts);
    var paid = inst && inst.paidPrice != null ? inst.paidPrice : (def ? def.price : 0);
    return Math.floor((paid || 0) / 2);
  }
  function findDef(opts) {
    if (opts.def) return opts.def;
    if (opts.kind === "herb") return DE.herbDef ? DE.herbDef(opts.id, opts.level) : DE.findItem(opts.id);
    return DE.findItem(opts.id);
  }
  /* 注意：背包实例的主键字段是 instId（不是 id）。
     一开始写成 x.id === id，永远是 undefined，导致「卖出」静默失败。 */
  function instKey(x) { return x ? (x.instId || x.id) : null; }
  function ownedInstances(c, id) {
    return (c.inventory || []).filter(function (x) {
      return x.itemId === id || x.herbId === id || instKey(x) === id;
    });
  }
  function countOf(c, id) {
    return ownedInstances(c, id).reduce(function (s, x) { return s + (x.qty || 1); }, 0);
  }
  function firstOwned(c, id) { return ownedInstances(c, id)[0] || null; }

  /* 掷判定【智力 + 精神】，返回 { rolled, total, rate, label } */
  function roll(c, extraMod) {
    var R = rule();
    var ab = (R.ability || ["int","spr"]);
    /* 骰面 = 能力值（4/6/8/10/12 → d4~d12）。规则书 p70：判定一律掷 2 个骰子。 */
    var dice = ab.map(function (k) { return c.abilities[k] || 4; });
    var rolled = dice.map(function (d) {
      return Math.min(d, Math.max(1, Math.floor(rng() * d) + 1));
    });
    var sum = rolled[0] + rolled[1];
    var mod = extraMod || 0;
    /* 副业选的〈生意兴隆〉判定 −1（规则书〈副业〉原文） */
    if (c && c.sideJob === R.skill) mod -= 1;
    /* 「所有判定受到 -N 减值」也要算在生意判定上：
       尺寸超限（p74）、食物/水用尽（p78）、装备减值。
       异常状态不在这里 —— 它压低的是能力值，上面 dice 已经反映。 */
    if (DE.judgmentPenalty) {
      try { mod += DE.judgmentPenalty(c, "other").value; } catch (e) {}
    }
    var total = sum + mod;
    var isCrit = (rolled[0] === 1 && rolled[1] === 1);
    var isBig = (rolled[0] === dice[0] && rolled[1] === dice[1]) ||
                (rolled[0] === 6 && rolled[1] === 6);
    var rate = isCrit ? 0 : (R.rateOf ? R.rateOf(total) : 0);
    return {
      dice: dice, rolled: rolled, sum: sum, mod: mod, total: total,
      crit: isCrit, big: isBig,
      rate: rate, label: isBig ? "大成功" : (isCrit ? "大失败" : (rate ? (rate * 100) + "%" : "无增减"))
    };
  }

  /* 报价：把一次交易的账算清楚，但不落库 */
  /* opts: { kind, id, def, level, traits, buyQty, sellQty, rollTotal } */
  function quote(c, opts) {
    opts = opts || {};
    var R = rule();
    var bq = parseInt(opts.buyQty || 0, 10) || 0;
    var sq = parseInt(opts.sellQty || 0, 10) || 0;
    var baseBuy = baseBuyPrice(c, opts);
    var baseSell = baseSellPrice(c, opts);
    var rate = (opts.rate != null) ? opts.rate : 0;
    var buyUnit = R.buyPrice ? R.buyPrice(baseBuy, rate) : baseBuy;
    var sellUnit = R.sellPrice ? R.sellPrice(baseSell, rate) : baseSell;
    var costBase = baseBuy * bq;
    var cost = buyUnit * bq;
    var gainBase = baseSell * sq;
    var gain = sellUnit * sq;
    return {
      baseBuy: baseBuy, baseSell: baseSell,
      buyUnit: buyUnit, sellUnit: sellUnit,
      buyQty: bq, sellQty: sq,
      costBase: costBase, cost: cost, saved: costBase - cost,
      gainBase: gainBase, gain: gain, extra: gain - gainBase,
      net: gain - cost,
      rate: rate,
      moneyAfter: (c.money || 0) - cost + gain
    };
  }

  /* 真正执行一桩〈生意兴隆〉交易 */
  function execute(c, opts) {
    opts = opts || {};
    var R = rule();
    var chk = canUse(c, opts);
    if (!chk.ok) return { ok: false, msg: chk.errors[0], errors: chk.errors };

    var r = roll(c, opts.mod || 0);
    var q = quote(c, {
      kind: opts.kind, id: opts.id, def: opts.def, level: opts.level,
      traits: opts.traits, buyQty: opts.buyQty, sellQty: opts.sellQty, rate: r.rate
    });

    var done = [];
    var def = findDef(opts);
    var nm = def ? def.name : (opts.id || "?");

    /* 关键：先把「卖出的那一批」定下来 —— 必须是交易前就持有的库存。
       否则同一桩里「买 4 卖 4」会先把刚买的卖掉，等于没买，还绕过了
       「用生意兴隆买入的不能在同一城市卖出」这条规则。 */
    var sellIds = [];
    if (q.sellQty > 0) {
      sellIds = ownedInstances(c, opts.id).slice(0, q.sellQty).map(instKey);
    }

    /* 买入 */
    if (q.buyQty > 0) {
      var bought = 0;
      for (var i = 0; i < q.buyQty; i++) {
        /* 用 DE.buy 的机制但走我们的单价：先记账再入库，保持与商店一致 */
        if ((c.money || 0) < q.buyUnit) break;
        var res = buyOneAt(c, def, opts, q.buyUnit);
        if (!res || !res.ok) break;
        bought++;
      }
      q.bought = bought;
      done.push("买入〈" + nm + "〉×" + bought + "，单价 " + q.buyUnit + " G" +
                (r.rate ? "（定价 " + q.baseBuy + "，省 " + (q.buyUnit * bought < q.costBase ? q.costBase - q.buyUnit * bought : 0) + " G）" : ""));
      /* 记下「用生意兴隆买的，不能在同一城市卖」 */
      if (r.rate > 0 && bought > 0) {
        c.tradeBan = { id: opts.id, name: nm, rate: r.rate, at: DE.gameISO ? DE.gameISO() : "" };
      }
    }

    /* 卖出（只卖交易前持有的那些） */
    if (q.sellQty > 0) {
      var sold = sellListAt(c, sellIds, q.sellUnit, nm);
      q.sold = sold;
      done.push("卖出〈" + nm + "〉×" + sold + "，单价 " + q.sellUnit + " G" +
                (r.rate ? "（一般价 " + q.baseSell + "，多赚 " + (q.sellUnit * sold - q.baseSell * sold) + " G）" : ""));
    }

    DE.save(c);
    return {
      ok: true, roll: r, quote: q, done: done,
      msg: "〈生意兴隆〉判定：" + r.rolled.join(" + ") + " = " + r.sum +
           (r.mod ? " " + (r.mod > 0 ? "+" : "") + r.mod : "") +
           "　→　" + r.label + "（价格增减率 " + Math.round(r.rate * 100) + "%）\n" +
           done.join("\n")
    };
  }

  /* 按指定单价买 1 个（走账本） */
  function buyOneAt(c, def, opts, unit) {
    if ((c.money || 0) < unit) return { ok: false, msg: "金币不足" };
    DE.ledger.spend(c, unit, "buy",
      "购买〈" + def.name + "〉×1（生意兴隆 单价 " + unit + " G）",
      { itemId: def.id, qty: 1 });
    DE.addItem(c, def, {
      traits: opts.traits || [], paidPrice: unit, qty: 1,
      collectedISO: DE.gameISO ? DE.gameISO() : new Date().toISOString()
    });
    return { ok: true };
  }

  /* 按指定单价卖出「指定的那几件」（id 列表） */
  function sellListAt(c, ids, unit, nm) {
    var sold = 0;
    (ids || []).forEach(function (iid) {
      var inst = DE.findInstance(c, iid);
      if (!inst) return;                       /* 可能已被别的操作消耗掉 */
      DE.ledger.earn(c, unit, "sell",
        "卖出〈" + (inst.name || nm) + "〉×1（生意兴隆 单价 " + unit + " G）",
        { itemId: inst.itemId || inst.herbId, qty: 1 });
      DE.consume(c, iid, 1);
      sold++;
    });
    return sold;
  }

  return {
    setRng: setRng,
    hasSkill: hasSkill,
    canUse: canUse,
    roll: roll,
    quote: quote,
    execute: execute,
    baseBuyPrice: baseBuyPrice,
    baseSellPrice: baseSellPrice,
    sellListAt: sellListAt,
    instKey: instKey,
    countOf: countOf
  };
})();


/* ============================================================
 *  食物与水的每日消耗（规则书 p77 / p78）
 *
 *  p77 旅行流程 ⑤：
 *    「消耗食物和水（一天结束时，每人需消耗食物和水各 1 天份）。」
 *
 *  p78 食物和水不足时的减值：
 *    「在食物或水用尽的状态下继续旅行，所有判定受到 -1 减值，
 *      若食物与水都用尽则减值变为 -2。
 *      减值每过 1 天都会累计，直到食物和水补给为止。
 *      比如食物用尽后的第一天减值为 -1，第二天为 -2。」
 *
 *  p78 补给：
 *    「食物的获得方式包括在城镇购买和对怪物遗骸进行材料加工。
 *      水可以在进入城镇、接近清澈水源时自动补给。」
 *
 *  ⚠️ 水的模型（配合 p51 容器规则）：
 *    ——水是**存进水容器**里的，不是一件叫「水」的道具。
 *      水袋 / 魔法瓶 能装 1 天份，水桶能装 15 天份。
 *      所以「喝水」= 扣容器里的存量，**绝不能把水袋本身吃掉**。
 *      （旧代码 WATER_ITEM_ID = "c_waterskin" 就是把水袋当消耗品，会直接把水袋删掉。）
 * ============================================================ */

/* ---------- 口粮判定 ---------- */
/* 能吃进肚子当一天饭的：干粮类。
   食材要炊事处理（p78「材料加工」）、酒是饮品、动物饲料是喂动物的，都不算人的口粮。 */
DE.FOOD_ITEM_IDS  = ["f_ration", "f_badration", "f_goodration"];
DE.NOT_FOOD_IDS   = ["f_feed", "f_wine", "f_ingredients"];
/* 先吃难吃的，把好吃的留到后面（难吃的干粮有负面效果，玩家自然先消耗） */
DE.FOOD_PRIORITY  = ["f_badration", "f_ration", "f_goodration"];

DE.isFoodItem = function (it) {
  if (!it) return false;
  var def = null;
  try { def = DE.instDef ? DE.instDef(it) : (it.itemId ? DE.findItem(it.itemId) : null); }
  catch (e) { def = null; }
  if (!def) return false;
  if (DE.NOT_FOOD_IDS.indexOf(def.id) >= 0) return false;
  if (DE.FOOD_ITEM_IDS.indexOf(def.id) >= 0) return true;
  if (def.cat === "food") return true;                 /* 以后新加的干粮也算 */
  return /干粮|口粮/.test(def.name || it.name || "");
};

/* ---------- 水容器 ---------- */
/* 这件道具是不是「能装水」的容器 */
DE.isWaterContainer = function (it) {
  if (!it) return false;
  var def = DE.instDef(it);
  return !!(def && def.holdsWater);
};
/* 兼容旧名字：以前 isWaterItem 指的是「水袋道具本身」，语义是错的。
   现在只表示「这是盛水的容器」。 */
DE.isWaterItem = function (it) { return DE.isWaterContainer(it); };

/* 一个水容器能装几天份（水袋/魔法瓶 1，水桶 15） */
DE.waterCapOf = function (inst) {
  if (!inst) return 0;
  var def = DE.instDef(inst);
  if (!def || !def.holdsWater) return 0;
  return def.waterDays || 1;
};
/* 水容器里现在还剩几天份。没有 water 字段 = 满的（刚买 / 老存档）。 */
DE.waterLeftOf = function (inst) {
  var cap = DE.waterCapOf(inst);
  if (!cap) return 0;
  if (typeof inst.water !== "number" || isNaN(inst.water)) return cap;
  return Math.max(0, Math.min(cap, inst.water));
};

/* 所有水容器（含空标记），供 UI 明细用 */
DE.waterSlots = function (c) {
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  return inv.filter(DE.isWaterContainer).map(function (x) {
    return { inst: x, cap: DE.waterCapOf(x), left: DE.waterLeftOf(x), name: x.name };
  });
};
/* 当前存水天数（UI 上的「水量」就是它） */
DE.waterDaysOf = function (c) {
  return DE.waterSlots(c).reduce(function (s, w) { return s + w.left; }, 0);
};
/* 水容器合计容量 */
DE.waterCapacityOf = function (c) {
  return DE.waterSlots(c).reduce(function (s, w) { return s + w.cap; }, 0);
};

/* 补充水（进入城镇 / 接近清澈水源 —— p78 自动补给）。
   把所有水容器补满，返回补了多少天份。 */
DE.refillWater = function (c) {
  var n = 0;
  DE.waterSlots(c).forEach(function (w) {
    var add = w.cap - w.left;
    if (add > 0) { w.inst.water = w.cap; n += add; }
  });
  return n;
};

/* ---------- 口粮总数 ---------- */
DE.foodSlots = function (c) {
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  return inv.filter(function (x) { return !x.equipped && DE.isFoodItem(x); });
};
/* 现有口粮够吃几天（每 1 份 = 1 天，干粮 k 份就是 k 天） */
DE.foodDaysOf = function (c) {
  return DE.foodSlots(c).reduce(function (s, x) { return s + (x.qty || 1); }, 0);
};

/* ---------- 吃一份 / 喝一天 ---------- */
/* 吃掉 1 份口粮：按 难吃 → 普通 → 好吃 的顺序。成功返回被吃的实例。 */
function eatOneDay(c) {
  var inv = (c && Array.isArray(c.inventory)) ? c.inventory : [];
  for (var p = 0; p < DE.FOOD_PRIORITY.length; p++) {
    var wantId = DE.FOOD_PRIORITY[p];
    for (var i = 0; i < inv.length; i++) {
      var it = inv[i];
      if (!it || it.equipped) continue;
      if (!DE.isFoodItem(it)) continue;
      var def = DE.instDef(it);
      if (!def || def.id !== wantId) continue;
      if ((it.qty || 1) > 1) it.qty = it.qty - 1;
      else inv.splice(i, 1);
      return { kind: "food", name: it.name || "口粮" };
    }
  }
  /* 兜底：上面顺序没匹配到（比如以后新增的干粮），就吃随便一份 */
  for (var j = 0; j < inv.length; j++) {
    var x = inv[j];
    if (!x || x.equipped || !DE.isFoodItem(x)) continue;
    if ((x.qty || 1) > 1) x.qty = x.qty - 1;
    else inv.splice(j, 1);
    return { kind: "food", name: x.name || "口粮" };
  }
  return null;
}

/* 喝掉 1 天份水：从存水最多的容器里扣？不 —— 从小容器（水袋）先喝，
   大容器（水桶）留作储备，这也符合实际用法。 */
function drinkOneDay(c) {
  var slots = DE.waterSlots(c).filter(function (w) { return w.left > 0; });
  if (!slots.length) return null;
  slots.sort(function (a, b) { return a.cap - b.cap; });
  var w = slots[0];
  w.inst.water = w.left - 1;
  return { kind: "water", name: w.name };
}

/* ---------- 一天的补给结算 ---------- */
/* 补给状态（不改数据，纯读） */
/* 当前游戏天数（判定缺粮累计用） */
function supplyCurDay() {
  try {
    if (DE.clock && DE.clock.dayNumber) return DE.clock.dayNumber();
  } catch (e) {}
  return 1;
}

/* 补给状态。
 *
 * ⚠️ 缺粮累计天数的唯一真相是「缺粮起始天」c.supplyShortFrom ——
 *    不是独立计数器。累计天数 = 当前游戏天数 − 起始天 + 1。
 *
 *    为什么必须这样：以前用 supplyShortDays 自己 +1 累计，
 *    于是时间回到第一天时那个计数器丝毫没有变化，
 *    「第 1 天粮食用尽 -1」的减值和红字提示就一直挂着消不掉。
 *    现在倒退/重置时间后，算出来的天数 ≤ 0，缺粮状态自动归零。 */
DE.supplyState = function (c, asOfDay) {
  var food = DE.foodDaysOf(c);
  var water = DE.waterDaysOf(c);
  /* asOfDay 用于「结算某一批日子」时按那批的最后一天算，
     不传就按当前游戏天数（UI / 判定都用这个）。 */
  var curDay = (typeof asOfDay === "number" && !isNaN(asOfDay)) ? asOfDay : supplyCurDay();
  var shortDays = 0, penalty = 0, from = null;

  if (c && c.supplyShortFrom != null) {
    from = c.supplyShortFrom;
    var n = curDay - from + 1;
    if (n > 0) {
      shortDays = n;
      var base = c.supplyShortBase || 1;
      penalty = base + (n - 1);
    } else {
      /* 时间被退回到缺粮开始之前 —— 那段缺粮不再存在 */
      from = null;
      c.supplyShortFrom = null;
      c.supplyShortBase = 0;
    }
  }

  /* ⚠️ 不要再往 c.supplyShortDays / c.supplyPenalty 写回！
     以前写回之后，下一次调用又把这些旧字段当成「老存档」读回来，
     于是刚清掉的缺粮状态立刻复活 —— 自己毒自己。 */

  return {
    foodDays: food, waterDays: water,
    waterCapacity: DE.waterCapacityOf(c),
    foodShort: food < 1, waterShort: water < 1,
    shortFrom: from, shortDays: shortDays, penalty: penalty
  };
};

/* 消耗 N 天份食物和水（一天结束时各 1 天份 —— p77）。
   返回详细结果，供页面提示。 */
DE.consumeSupply = function (c, days, startDay) {
  days = Math.max(0, Math.floor(Number(days) || 0));
  var res = {
    days: days, foodUsed: 0, waterUsed: 0,
    foodShortDays: 0, waterShortDays: 0,
    penalty: 0, shortDays: 0, foodLeft: 0, waterLeft: 0, log: []
  };
  if (!c || !days) {
    if (c) { res.foodLeft = DE.foodDaysOf(c); res.waterLeft = DE.waterDaysOf(c); }
    return res;
  }
  if (!Array.isArray(c.inventory)) c.inventory = [];
  if (c.supplyShortFrom === undefined) c.supplyShortFrom = null;
  if (typeof c.supplyShortBase !== "number") c.supplyShortBase = 0;

  /* startDay = 这批日子**之前**那天的天数（第一天被消耗的日子 = startDay + 1）。
     不传就假设这批紧挨在当前天之前。 */
  if (typeof startDay !== "number" || isNaN(startDay)) {
    startDay = supplyCurDay() - days;
  }

  for (var d = 0; d < days; d++) {
    var dayNum = startDay + d + 1;          /* 正在结算的是第几天 */
    var f = eatOneDay(c);
    var w = drinkOneDay(c);
    if (f) res.foodUsed++;
    if (w) res.waterUsed++;

    if (!f || !w) {
      if (!f) res.foodShortDays++;
      if (!w) res.waterShortDays++;
      /* p78：食物或水用尽 → -1；两者都用尽 → -2；之后每过 1 天再累计 -1。
         这里只记录「从哪天开始缺」，累计天数交给 DE.supplyState 按天数推算。 */
      var base = (!f && !w) ? 2 : 1;
      if (c.supplyShortFrom == null) {
        c.supplyShortFrom = dayNum;
        c.supplyShortBase = base;
      } else {
        /* 一直在缺：若中途变成两样都缺，起始基数取较大的那个 */
        c.supplyShortBase = Math.max(c.supplyShortBase || 1, base);
      }
      var st0 = DE.supplyState(c, dayNum);
      res.log.push("第 " + dayNum + " 天" +
        (!f ? "没有口粮" : "") + (!f && !w ? "、" : "") + (!w ? "没有水" : "") +
        "，判定减值累计到 -" + st0.penalty + "。");
    } else {
      /* 补给正常：累计清零（p78「直到食物和水补给为止」） */
      c.supplyShortFrom = null;
      c.supplyShortBase = 0;
    }
  }

  var st = DE.supplyState(c, startDay + days);
  res.penalty = st.penalty;
  res.shortDays = st.shortDays;
  res.foodLeft = st.foodDays;
  res.waterLeft = st.waterDays;
  return res;
};

/* 补给缺口的可读说明（首页 / 背包用） */
DE.supplyWarning = function (c) {
  var s = DE.supplyState(c);
  if (!s.penalty) return "";
  var what = [];
  if (s.foodShort) what.push("口粮");
  if (s.waterShort) what.push("水");
  if (!what.length) what.push("食物和水");
  return what.join("与") + "已用尽 " + s.shortDays + " 天，所有判定 -" + s.penalty +
         "（每天继续累计，直到补给为止）。";
};

/* ============================================================
 *  判定减值总表 + 判定掷骰（规则书 p70 / p51 / p74 / p78）
 *
 *  规则里「所有判定受到 -N 减值」的来源有好几处，散着放必然漏：
 *    · p78 食物或水用尽        → 所有判定 -1（两样都缺 -2），每天累计
 *    · p74 持有尺寸超过上限    → 所有判定受到超出点数的减值
 *    · 装备 中甲 -1 / 重甲 -3 / 大盾 -1 → 所有判定
 *    · p51 人类搬运〈木箱〉    → **仅**【移动判定】-1
 *    · p74 异常状态           → 不在这里：它直接压低能力值（骰面），已由 effAbilities 处理
 *  所以统一收口到 DE.judgmentPenalty(c, typeId)。
 * ============================================================ */

/* 判定种类（p77 旅行流程 1~4） */
DE.JUDGE_TYPES = [
  { id: "status",    name: "状态判定",  ab: ["str", "spr"], icon: "💗",
    desc: "每天开始，判定角色一天中的身体状况" },
  { id: "move",      name: "移动判定",  ab: ["str", "agi"], icon: "🥾",
    desc: "是否会因移动产生疲劳　目标值 = 地貌 + 天气" },
  { id: "direction", name: "方向判定",  ab: ["int", "int"], icon: "🧭",
    desc: "是否迷路、能否正确到达目的地　目标值 = 地貌 + 天气" },
  { id: "camp",      name: "野营判定",  ab: ["agi", "int"], icon: "⛺",
    desc: "能否找到适合野营的地点　目标值 = 地貌 + 天气" }
];

/* 汇总一次判定要吃到的全部减值。
 * typeId = 判定种类 id；没有值的判定类型传 "other"（比如副业判定）。 */
DE.judgmentPenalty = function (c, typeId) {
  var parts = [], value = 0;
  function add(src, v, note) {
    if (!v) return;
    value += v;
    parts.push({ src: src, v: v, note: note || "" });
  }
  if (!c) return { value: 0, parts: parts };

  /* ① 补给缺口（p78）：所有判定 */
  try {
    var sup = DE.supplyState(c);
    if (sup.penalty) add("食物 / 水用尽", -sup.penalty,
      "已缺 " + sup.shortDays + " 天，每天继续累计");
  } catch (e) {}

  /* ② 持有尺寸超限（p74）：所有判定 */
  try {
    var over = DE.overSizePenalty(c);
    if (over) add("持有尺寸超限", -over, "超出 " + over + " 点");
  } catch (e) {}

  /* ③ 装备减值（中甲 / 重甲 / 大盾）：所有判定 */
  try {
    var d = DE.derive ? DE.derive(c) : null;
    var eq = d ? (d.equipPenalty || 0) : 0;
    if (eq) add("装备减值", eq, "铠甲 / 盾牌带来的修正");
  } catch (e) {}

  /* ④ 木箱（p51）：**只有移动判定** */
  if (typeId === "move") {
    try {
      var mp = DE.movePenalty(c);
      if (mp.value) add("携带〈木箱〉", mp.value, "人类搬运木箱【移动判定】-1");
    } catch (e) {}
  }
  return { value: value, parts: parts };
};

/* 掷一次判定：2 个骰子点数 + 修正值 ≥ 目标值（DE.JUDGE_RULE）。
 * 骰面 = 该判定用到的两个能力值（异常状态已经把它们压低了 → 骰面变小）。
 * opts: { type, target, mod, ab }  —— mod 是额外的外部修正（天赋 / 道具等）
 * 返回结构完整，UI 和测试都用它。 */
DE.rollJudge = function (c, opts) {
  opts = opts || {};
  var type = DE.JUDGE_TYPES.filter(function (t) { return t.id === opts.type; })[0]
             || DE.JUDGE_TYPES[0];
  var abEff = (DE.effAbilities ? DE.effAbilities(c).abilities : (c && c.abilities)) || {};
  var ab = opts.ab || type.ab;
  /* 骰面 = 能力值本身（4/6/8/10/12 → d4~d12）。4 是下限，坏数据也不会算出 d0。 */
  var dice = ab.map(function (k) { return Math.max(4, abEff[k] || 4); });
  var rolled = dice.map(function (d) {
    return Math.min(d, Math.max(1, Math.floor(Math.random() * d) + 1));
  });
  var sum = rolled[0] + rolled[1];

  var pen = DE.judgmentPenalty(c, type.id);
  var bonus = DE.judgmentBonus(c, type.id);       /* 药草带来的加值 / 固定结果 */
  var extra = Number(opts.mod) || 0;
  var mod = pen.value + bonus.value + extra;
  var total = sum + mod;
  /* 王冠喇叭花：本次【状态判定】结果直接固定 */
  if (bonus.fixed != null) total = bonus.fixed;

  var target = Number(opts.target);
  if (isNaN(target)) target = 7;

  /* 用完就消耗掉一次性药草增益（statusJudge / statusFix / sprJudge） */
  if (c) { try { DE.buffConsumeAfterJudge(c, type.id); DE.save(c); } catch (e) {} }

  var critFail = (rolled[0] === 1 && rolled[1] === 1);
  var bigOk = (rolled[0] === dice[0] && rolled[1] === dice[1]) ||
              (rolled[0] === 6 && rolled[1] === 6);
  return {
    type: type, typeId: type.id, typeName: type.name,
    ab: ab, dice: dice, rolled: rolled, sum: sum,
    penalty: pen.value, parts: pen.parts,
    bonus: bonus.value, bonusParts: bonus.parts, fixedTotal: bonus.fixed,
    extraMod: extra, mod: mod,
    total: total, target: target,
    success: total >= target,
    critFail: critFail, bigOk: bigOk,
    label: critFail ? "大失败" : (bigOk ? "大成功" : (total >= target ? "成功" : "失败"))
  };
};

/* ============================================================
 *  判定结果的效果（规则书 p77 旅行流程 ②③④）
 *
 *  ② 移动判定【体力+敏捷】目标值 = 地貌 + 天气
 *      成功    本次移动不会对身体造成伤害
 *      失败    HP 减少到**现在值的二分之一**（向下取整）
 *      大成功  直到第二天【状态判定】前，状态值 +1
 *      大失败  HP 减少到**现在值的四分之一**（向下取整）
 *
 *  ③ 方向判定【智力+智力】目标值 = 地貌 + 天气
 *      成功    向目的地前进，没有迷路
 *      失败    迷路，移动距离为二分之一
 *      大成功  可以在任何地貌中，不降低移动速度地前进
 *      大失败  回到当天开始进行移动的地方
 *      （都是叙事结果，程序只提示，不改数值）
 *
 *  ④ 野营判定【敏捷+智力】目标值 = 地貌 + 天气
 *      成功    第二天，HP 回复到现在的 2 倍，MP 完全回复
 *      失败    第二天，HP 和 MP 只回复 2 点
 *      大成功  第二天，HP 和 MP 完全回复；第二天的状态值 +1
 *      大失败  不回复 HP 和 MP；第二天的状态值 -1
 *
 *  ① 状态判定【体力+精神】→ 交给 DE.statusJudgeSettle（p74 异常状态恢复）
 * ============================================================ */

/* ---------- HP / MP 当前值（null = 按上限） ---------- */
DE.hpMaxOf = function (c) { try { return DE.derive(c).hpMax; } catch (e) { return 0; } };
DE.mpMaxOf = function (c) { try { return DE.derive(c).mpMax; } catch (e) { return 0; } };
DE.hpNow = function (c) {
  var mx = DE.hpMaxOf(c);
  var v = (c && c.hpCurrent);
  if (v === null || v === undefined || isNaN(v)) return mx;
  return Math.max(0, Math.min(mx, Math.round(v)));
};
DE.mpNow = function (c) {
  var mx = DE.mpMaxOf(c);
  var v = (c && c.mpCurrent);
  if (v === null || v === undefined || isNaN(v)) return mx;
  return Math.max(0, Math.min(mx, Math.round(v)));
};
/* 写 HP/MP：等于上限时存 null（表示"满"，这样升级后自动跟上） */
DE.setHP = function (c, v) {
  var mx = DE.hpMaxOf(c);
  v = Math.max(0, Math.min(mx, Math.round(Number(v) || 0)));
  c.hpCurrent = (v >= mx) ? null : v;
  return v;
};
DE.setMP = function (c, v) {
  var mx = DE.mpMaxOf(c);
  v = Math.max(0, Math.min(mx, Math.round(Number(v) || 0)));
  c.mpCurrent = (v >= mx) ? null : v;
  return v;
};
/* 状态值 2~20（★10 = 绝佳） */
DE.setStatus = function (c, v) {
  v = Math.max(2, Math.min(20, Math.round(Number(v) || 10)));
  c.status = v;
  return v;
};

/* ---------- 状态判定：异常状态恢复（p74） ---------- */
/* 次日【状态判定】结果值 ≥ 异常状态的数值 → 该项恢复。 */
DE.statusJudgeSettle = function (c, rolled) {
  rolled = parseInt(rolled, 10);
  if (isNaN(rolled)) return { ok: false, msg: "先填【状态判定】的结果。" };
  var keep = [], healed = [];
  (c.statuses || []).forEach(function (st) {
    if (rolled >= (parseInt(st.value, 10) || 0)) healed.push(st.name);
    else keep.push(st);
  });
  c.statuses = keep;
  c.lastStatusJudge = rolled;
  return {
    ok: true, rolled: rolled, healed: healed,
    kept: keep.map(function (s) { return s.name; })
  };
};

/* ---------- 判定结果的效果表 ---------- */
DE.JUDGE_EFFECTS = {
  move: {
    success:  { hp: "none",      status: 0,  note: "本次移动不会对身体造成伤害。" },
    fail:     { hp: "half",      status: 0,  note: "HP 减少到现在值的二分之一（向下取整）。" },
    bigOk:    { hp: "none",      status: +1, note: "直到第二天【状态判定】前，状态值 +1。" },
    critFail: { hp: "quarter",   status: 0,  note: "HP 减少到现在值的四分之一（向下取整）。" }
  },
  direction: {
    success:  { hp: "none", status: 0, note: "向目的地前进，没有迷路。" },
    fail:     { hp: "none", status: 0, note: "迷路：本段移动距离减半。" },
    bigOk:    { hp: "none", status: 0, note: "可以在任何地貌中不降低移动速度地前进。" },
    critFail: { hp: "none", status: 0, note: "回到当天开始进行移动的地方。" }
  },
  camp: {
    success:  { hp: "double", status: 0,  mp: "full",  note: "第二天 HP 回复到现在的 2 倍，MP 完全回复。" },
    fail:     { hp: "plus2",  status: 0,  mp: "plus2", note: "第二天 HP 和 MP 只回复 2 点。" },
    bigOk:    { hp: "full",   status: +1, mp: "full",  note: "第二天 HP / MP 完全回复，状态值 +1。" },
    critFail: { hp: "none",   status: -1, mp: "none",  note: "不回复 HP 和 MP，第二天状态值 -1。" }
  },
  status: {
    recovery: { note: "按【状态判定】结果结算异常状态恢复（p74）。" }
  }
};

/* 把一个判定结果"效果键"归一化：大失败 > 大成功 > 成功/失败 */
DE.judgeOutcomeKey = function (judge) {
  if (!judge) return "fail";
  if (judge.critFail) return "critFail";
  if (judge.bigOk) return "bigOk";
  return judge.success ? "success" : "fail";
};

/* 计算（不落库）这次判定会改什么，供 UI 预览 */
DE.previewJudgeEffect = function (c, judge) {
  var out = { ok: true, typeId: judge && judge.typeId, key: DE.judgeOutcomeKey(judge),
              changes: [], note: "" };
  if (!c || !judge) return { ok: false, changes: [] };
  var typeId = judge.typeId;

  /* 状态判定：只结算异常状态 */
  if (typeId === "status") {
    var healed = (c.statuses || []).filter(function (st) {
      return (judge.total | 0) >= (parseInt(st.value, 10) || 0);
    }).map(function (st) { return st.name; });
    out.note = DE.JUDGE_EFFECTS.status.recovery.note;
    out.changes.push({ what: "异常状态", from: (c.statuses || []).length + " 项",
                       to: healed.length ? ("痊愈 " + healed.join("、")) : "全部保留" });
    return out;
  }

  var eff = (DE.JUDGE_EFFECTS[typeId] || {})[out.key];
  if (!eff) { out.ok = false; return out; }
  out.note = eff.note || "";

  /* HP */
  var hpMx = DE.hpMaxOf(c), hp = DE.hpNow(c), hpNew = hp;
  if (eff.hp === "half") hpNew = Math.floor(hp / 2);
  else if (eff.hp === "quarter") hpNew = Math.floor(hp / 4);
  else if (eff.hp === "double") hpNew = Math.min(hpMx, hp * 2);
  else if (eff.hp === "plus2") hpNew = Math.min(hpMx, hp + 2);
  else if (eff.hp === "full") hpNew = hpMx;
  if (hpNew !== hp) out.changes.push({ what: "HP", from: hp, to: hpNew });

  /* MP */
  var mpMx = DE.mpMaxOf(c), mp = DE.mpNow(c), mpNew = mp;
  if (eff.mp === "full") mpNew = mpMx;
  else if (eff.mp === "plus2") mpNew = Math.min(mpMx, mp + 2);
  if (mpNew !== mp) out.changes.push({ what: "MP", from: mp, to: mpNew });

  /* 状态值 */
  if (eff.status) {
    var st = parseInt(c.status, 10); if (isNaN(st)) st = 10;
    var stNew = Math.max(2, Math.min(20, st + eff.status));
    if (stNew !== st) out.changes.push({ what: "状态值", from: st, to: stNew });
  }
  return out;
};

/* 真正应用这次判定的效果，返回 { ok, msgs[], preview } */
DE.applyJudgeEffect = function (c, judge) {
  if (!c || !judge) return { ok: false, msgs: ["没有角色或判定结果。"] };
  var pv = DE.previewJudgeEffect(c, judge);
  if (!pv.ok) return { ok: false, msgs: ["这个判定没有可应用的效果。"] };

  /* ① 状态判定：结算异常状态 */
  if (judge.typeId === "status") {
    var r = DE.statusJudgeSettle(c, judge.total);
    if (!r.ok) return { ok: false, msgs: [r.msg] };
    var msg = r.healed.length
      ? "判定 " + r.rolled + "：痊愈 " + r.healed.join("、")
      : "判定 " + r.rolled + "：没有达到任何异常的数值，全部保留。";
    return { ok: true, msgs: [msg], preview: pv };
  }

  /* ② 其余：HP / MP / 状态值 */
  var eff = (DE.JUDGE_EFFECTS[judge.typeId] || {})[pv.key];
  if (!eff) return { ok: false, msgs: ["这个判定没有可应用的效果。"] };

  var msgs = [];
  var hpMx = DE.hpMaxOf(c), hp = DE.hpNow(c), hpNew = hp;
  if (eff.hp === "half") hpNew = Math.floor(hp / 2);
  else if (eff.hp === "quarter") hpNew = Math.floor(hp / 4);
  else if (eff.hp === "double") hpNew = Math.min(hpMx, hp * 2);
  else if (eff.hp === "plus2") hpNew = Math.min(hpMx, hp + 2);
  else if (eff.hp === "full") hpNew = hpMx;
  if (hpNew !== hp) { DE.setHP(c, hpNew); msgs.push("HP " + hp + " → " + DE.hpNow(c)); }

  var mpMx = DE.mpMaxOf(c), mp = DE.mpNow(c), mpNew = mp;
  if (eff.mp === "full") mpNew = mpMx;
  else if (eff.mp === "plus2") mpNew = Math.min(mpMx, mp + 2);
  if (mpNew !== mp) { DE.setMP(c, mpNew); msgs.push("MP " + mp + " → " + DE.mpNow(c)); }

  if (eff.status) {
    var st0 = parseInt(c.status, 10); if (isNaN(st0)) st0 = 10;
    var st1 = DE.setStatus(c, st0 + eff.status);
    if (st1 !== st0) msgs.push("状态值 " + st0 + " → " + st1);
  }
  if (!msgs.length) msgs.push("这个结果没有改变任何数值。");
  if (eff.note) msgs.push(eff.note);
  return { ok: true, msgs: msgs, preview: pv };
};


/* ============================================================
 *  药草效果 × 角色属性联动
 *  ------------------------------------------------------------
 *  规则依据：规则书 p52（药草）＋ 角色卡「技能表」（药师：治疗 / 应急处理 / 药草采摘）
 *
 *  每种药草在 items.js 里带一个 apply 字段，形如：
 *    { heal: 2 }                                          立刻回复 HP
 *    { cureSystem: "身体系", statusJudgeBonus: 1 }         解除异常状态 + 立即状态判定加值
 *    { buff: { kind, value, scope, label } }               施加临时增益
 *
 *  临时增益 c.buffs 的作用范围（scope）：
 *    next       下一次对应判定后自动消耗
 *    nextMagic  下一次魔法后自动消耗（目前由 UI 提示，手动清除）
 *    day        跨天自动失效
 *    scene      场景内有效，手动清除
 * ============================================================ */

/* 异常状态属于身体系还是精神系（按 DE.STATUSES 的分组判断，不依赖 st.type） */
DE.statusSystemOf = function (name) {
  var P = (DE.STATUSES && DE.STATUSES.physical) || [];
  var M = (DE.STATUSES && DE.STATUSES.mental) || [];
  var i;
  for (i = 0; i < P.length; i++) { if (P[i].name === name) return "身体系"; }
  for (i = 0; i < M.length; i++) { if (M[i].name === name) return "精神系"; }
  return null;
};

/* 当前所有临时增益 */
DE.buffList = function (c) { return (c && c.buffs) || []; };

/* 加一条增益 */
DE.buffAdd = function (c, herbDef, spec) {
  c.buffs = c.buffs || [];
  var b = {
    id: DE.uid("bf"),
    herbId: herbDef ? herbDef.id : "",
    herbName: herbDef ? herbDef.name : "",
    kind: spec.kind,
    value: spec.value,
    factor: spec.factor,
    hours: spec.hours,
    scope: spec.scope || "scene",
    label: spec.label || "",
    day: DE.clock ? DE.clock.dayNumber() : 1,
    addedISO: DE.gameISO ? DE.gameISO() : new Date().toISOString()
  };
  c.buffs.push(b);
  return b;
};

/* 移除一条增益 */
DE.buffRemove = function (c, id) {
  if (!c || !c.buffs) return false;
  var before = c.buffs.length;
  c.buffs = c.buffs.filter(function (b) { return b.id !== id; });
  return c.buffs.length !== before;
};

/* 跨天清理 day 范围增益。返回被清掉的列表。 */
DE.expireBuffs = function (c) {
  if (!c || !c.buffs || !c.buffs.length) return [];
  var day = DE.clock ? DE.clock.dayNumber() : 1;
  var gone = [], keep = [];
  c.buffs.forEach(function (b) {
    if (b.scope === "day" && b.day !== day) gone.push(b);
    else keep.push(b);
  });
  if (gone.length) c.buffs = keep;
  return gone;
};

/* 手动/自动消耗某些种类的增益 */
DE.buffConsume = function (c, kinds) {
  if (!c || !c.buffs || !c.buffs.length) return [];
  var want = [].concat(kinds), gone = [], keep = [];
  c.buffs.forEach(function (b) {
    if (want.indexOf(b.kind) >= 0) gone.push(b);
    else keep.push(b);
  });
  if (gone.length) c.buffs = keep;
  return gone;
};

/* 判定时把「药草增益」算进来。
   返回 { value, parts, fixed } —— fixed 表示结果被固定成某个值（王冠喇叭花）。 */
DE.judgmentBonus = function (c, typeId, abKeys) {
  var parts = [], value = 0, fixed = null;
  if (!c) return { value: 0, parts: parts, fixed: null };
  var type = (DE.JUDGE_TYPES || []).filter(function (x) { return x.id === typeId; })[0];
  /* abKeys 用于技能判定（治疗 = 智力+精神），不传则按判定类型的固定组合 */
  var keys = abKeys || (type && type.ab) || [];
  var usesSpr = keys.indexOf("spr") >= 0;

  (c.buffs || []).forEach(function (b) {
    if (b.kind === "statusFix") {
      if (typeId !== "status") return;
      fixed = parseInt(b.value, 10) || 6;
      parts.push({ src: "〈" + b.herbName + "〉", v: 0,
        note: "本日【状态判定】结果固定为 " + fixed });
    } else if (b.kind === "statusJudge") {
      if (typeId !== "status") return;
      var v1 = parseInt(b.value, 10) || 0;
      value += v1;
      parts.push({ src: "〈" + b.herbName + "〉", v: v1, note: b.label || "药草：状态判定加值" });
    } else if (b.kind === "sprJudge") {
      if (!usesSpr) return;
      var v2 = parseInt(b.value, 10) || 0;
      value += v2;
      parts.push({ src: "〈" + b.herbName + "〉", v: v2, note: b.label || "药草：精神判定加值" });
    }
  });
  return { value: value, parts: parts, fixed: fixed };
};

/* 判定用完后消耗掉一次性增益（next 范围）。
   注意：fixed 也要消耗 —— 「第二天的状态判定」只用一次。 */
DE.buffConsumeAfterJudge = function (c, typeId) {
  var gone = [];
  if (!c) return gone;
  var type = (DE.JUDGE_TYPES || []).filter(function (x) { return x.id === typeId; })[0];
  var usesSpr = !!(type && type.ab && type.ab.indexOf("spr") >= 0);
  var kinds = [];
  if (typeId === "status") kinds.push("statusJudge", "statusFix");
  if (usesSpr) kinds.push("sprJudge");
  if (kinds.length) gone = DE.buffConsume(c, kinds);
  return gone;
};

/* MP 消耗换算（月下的雪割草）：消耗 >1 点的行为 -1，只耗 1 点的不变 */
DE.mpCostOf = function (c, base) {
  var n = parseInt(base, 10);
  if (isNaN(n) || n <= 0) return 0;
  if (n <= 1) return n;                     /* 对只需 1 点的行为无效 */
  var down = 0;
  (c && c.buffs || []).forEach(function (b) {
    if (b.kind === "mpCostDown") down += (parseInt(b.value, 10) || 0);
  });
  return Math.max(1, n - down);
};

/* 药草在 UI 上的效果摘要（含过期状态） */
DE.herbPreview = function (c, inst) {
  var def = DE.instDef(inst);
  if (!def) return null;
  var life = DE.shelfLife(c, inst);
  var ap = def.apply || {};
  var tags = [];
  if (ap.heal) tags.push("回复 " + ap.heal + " HP");
  if (ap.cureSystem) tags.push("解除" + ap.cureSystem + "异常状态");
  if (ap.statusJudgeBonus) tags.push("状态判定 +" + ap.statusJudgeBonus);
  if (ap.buff && ap.buff.label) tags.push(ap.buff.label);
  return {
    def: def, life: life,
    expired: !!(life && life.expired),
    system: def.system || "",
    tags: tags,
    canUse: !(life && life.expired)
  };
};

/* 使用一个药草：把效果真正作用到角色身上 */
DE.useHerb = function (c, instId) {
  var inst = DE.findInstance(c, instId);
  if (!inst) return { ok: false, msg: "找不到该药草。" };
  if (inst.kind !== "herb") {
    return { ok: false, msg: "〈" + inst.name + "〉不是药草。" };
  }
  var def = DE.instDef(inst);
  if (!def) return { ok: false, msg: "药草数据缺失。" };

  var life = DE.shelfLife(c, inst);
  if (life && life.expired) {
    return { ok: false, msg: "〈" + inst.name + "〉已经腐坏，不能使用。" };
  }

  var ap = def.apply || {};
  var msgs = [], cured = [], added = [];
  var hpFrom = null, hpTo = null;

  /* ① 回复 HP */
  if (ap.heal) {
    hpFrom = DE.hpNow(c);
    var mx = DE.hpMaxOf(c);
    DE.setHP(c, Math.min(mx, hpFrom + ap.heal));
    hpTo = DE.hpNow(c);
    if (hpTo > hpFrom) {
      msgs.push("HP " + hpFrom + " → " + hpTo + "（+" + (hpTo - hpFrom) + "／上限 " + mx + "）");
    } else {
      msgs.push("HP 已满（" + hpFrom + "／" + mx + "），没有变化（药草仍被消耗）");
    }
  }

  /* ② 解除异常状态 */
  if (ap.cureSystem) {
    var keep = [];
    (c.statuses || []).forEach(function (st) {
      if (DE.statusSystemOf(st.name) === ap.cureSystem) cured.push(st.name);
      else keep.push(st);
    });
    if (cured.length) {
      c.statuses = keep;
      msgs.push("解除" + ap.cureSystem + "异常状态：" + cured.join("、"));
    } else {
      msgs.push("当前没有" + ap.cureSystem + "异常状态可以解除");
    }
  }

  /* ③ 使用后立即进行状态判定（+1） */
  if (ap.statusJudgeBonus) {
    var b0 = DE.buffAdd(c, def, {
      kind: "statusJudge", value: ap.statusJudgeBonus, scope: "next",
      label: "立即进行【状态判定】时 +" + ap.statusJudgeBonus
    });
    added.push(b0);
    msgs.push("立即进行一次【状态判定】，本次结果 +" + ap.statusJudgeBonus + "（已记入增益）");
  }

  /* ④ 通用临时增益 */
  if (ap.buff) {
    var b1 = DE.buffAdd(c, def, ap.buff);
    added.push(b1);
    msgs.push("获得增益：" + b1.label);
  }

  /* ⑤ 消耗 1 个 */
  DE.consume(c, instId, 1);
  try { DE.save(c); } catch (e) {}

  return {
    ok: true, msg: msgs.join("　"), msgs: msgs,
    cured: cured, buffs: added, hp: { from: hpFrom, to: hpTo }
  };
};


/* ============================================================
 *  药师技能（DE.apothecary）
 *  规则依据：规则书「技能表」—— 治疗 / 应急处理 / 药草采摘
 *
 *   治疗     智力+精神   消耗 1 个药草 + 1 天份的水，回复【判定】点 HP
 *                        战斗中改为【智力判定（一个骰子）】的结果点数
 *   应急处理 智力+精神   异常状态无效化 1 小时，数值永久 -药师等级
 *   药草采摘 体力+智力   早晨【移动判定】前，1 天最多 1 次
 *                        成功获得 1 个药草；大成功 3 个；大失败【中毒：6】
 * ============================================================ */

/* 异常状态是否处于「应急处理」造成的无效化中（按游戏时间算 1 小时） */
DE.statusNullified = function (st) {
  if (!st || !st.nullUntil) return false;
  try {
    var until = new Date(st.nullUntil).getTime();
    if (isNaN(until)) return false;
    return DE.clock.now().getTime() < until;
  } catch (e) { return false; }
};

/* 喝掉 n 天份的水（治疗等技能用）。水不够就整体不消耗。 */
DE.consumeWaterDays = function (c, n) {
  n = Math.max(1, parseInt(n, 10) || 1);
  var have = DE.waterDaysOf(c);
  if (have < n) {
    return { ok: false, msg: "水不够：需要 " + n + " 天份，现有 " + have + " 天份。" };
  }
  var used = [];
  for (var i = 0; i < n; i++) {
    var r = drinkOneDay(c);
    if (!r) break;
    used.push(r.name);
  }
  return { ok: true, used: used, msg: "消耗 " + used.length + " 天份的水" };
};

/* 技能判定：能力值由调用方指定（不走 JUDGE_TYPES 的固定组合）。
   与 rollJudge 的区别：不消耗状态判定的药草增益，但会算「精神判定」类增益。 */
DE.skillJudge = function (c, abKeys, target, extraMod) {
  var abEff = (DE.effAbilities ? DE.effAbilities(c).abilities : (c && c.abilities)) || {};
  var dice = abKeys.map(function (k) { return Math.max(4, abEff[k] || 4); });
  var rolled = dice.map(function (d) {
    return Math.min(d, Math.max(1, Math.floor(Math.random() * d) + 1));
  });
  var sum = rolled[0] + rolled[1];
  var pen = DE.judgmentPenalty(c, "skill");
  var bonus = DE.judgmentBonus ? DE.judgmentBonus(c, "skill", abKeys) : { value: 0, parts: [] };
  /* extraMod：〈副业〉选的技能判定 -1 就靠这个传进来 */
  var ex = Number(extraMod) || 0;
  var mod = pen.value + bonus.value + ex;
  var total = sum + mod;
  var tgt = parseInt(target, 10);
  if (isNaN(tgt)) tgt = 7;
  var critFail = (rolled[0] === 1 && rolled[1] === 1);
  var bigOk = (rolled[0] === dice[0] && rolled[1] === dice[1]) ||
              (rolled[0] === 6 && rolled[1] === 6);
  return {
    dice: dice, rolled: rolled, sum: sum,
    penalty: pen.value, penParts: pen.parts,
    bonus: bonus.value, bonusParts: bonus.parts, extraMod: ex,
    mod: mod, total: total, target: tgt,
    success: total >= tgt, critFail: critFail, bigOk: bigOk,
    label: critFail ? "大失败" : (bigOk ? "大成功" : (total >= tgt ? "成功" : "失败"))
  };
};

/* ============================================================
 *  〈副业〉—— 农民专属：选 1 项其他职业技能，判定 -1
 * ============================================================ */

/* 副业状态：{ eligible, skills, skill, penalty, has } */
DE.sideJobInfo = function (c) {
  var conf = DE.SIDE_JOB || {};
  var list = conf.skills || [];
  var prof = (DE.PROFESSIONS || []).filter(function (p) { return p.id === (c && c.profession); })[0];
  var eligible = !!(prof && (prof.skills || []).indexOf(conf.skill || "副业") >= 0);
  var cur = (c && c.sideJob) || "";
  /* 职业没有〈副业〉、或选的值不在清单里 → 一律视为没选
     （换职业后残留的 sideJob 不能继续生效） */
  if (!eligible || list.indexOf(cur) < 0) cur = "";
  return {
    eligible: eligible,
    skills: list,
    skill: cur,
    penalty: (conf.penalty == null ? -1 : conf.penalty),
    has: !!cur,
    note: conf.note || ""
  };
};

/* 能不能用某个技能：本职技能（无减值）或副业选的那一项（有减值） */
DE.canUseSkill = function (c, skillName) {
  var prof = (DE.PROFESSIONS || []).filter(function (p) { return p.id === (c && c.profession); })[0];
  if (prof && (prof.skills || []).indexOf(skillName) >= 0) {
    return { ok: true, source: "profession", penalty: 0 };
  }
  var sj = DE.sideJobInfo(c);
  if (sj.has && sj.skill === skillName) {
    return { ok: true, source: "sideJob", penalty: sj.penalty };
  }
  return { ok: false, source: null, penalty: 0 };
};

/* 用某个技能时的额外修正（副业 → -1；本职 → 0） */
DE.skillPenaltyOf = function (c, skillName) {
  var u = DE.canUseSkill(c, skillName);
  return u.ok ? u.penalty : 0;
};

/* 角色拥有的全部技能（本职 3 个 + 副业 1 个），带判定信息 */
DE.skillListOf = function (c) {
  var out = [];
  var prof = (DE.PROFESSIONS || []).filter(function (p) { return p.id === (c && c.profession); })[0];
  function push(name, source, penalty) {
    var d = (DE.PROFESSION_SKILLS || {})[name] || { ability: "—", target: "—", effect: "" };
    out.push({ name: name, ability: d.ability, target: d.target, effect: d.effect,
               source: source, penalty: penalty });
  }
  if (prof) (prof.skills || []).forEach(function (n) { push(n, "profession", 0); });
  var sj = DE.sideJobInfo(c);
  if (sj.has) push(sj.skill, "sideJob", sj.penalty);
  return out;
};

DE.apothecary = (function () {

  /* 有没有药师系技能（药师本人，或〈副业〉选了其中一项的农民） */
  function is(c) {
    return !!(c && (DE.canUseSkill(c, "治疗").ok ||
                    DE.canUseSkill(c, "应急处理").ok ||
                    DE.canUseSkill(c, "药草采摘").ok));
  }

  /* 可用的药草（未腐坏） */
  function usableHerbs(c) {
    return ((c && c.inventory) || []).filter(function (x) {
      if (x.kind !== "herb") return false;
      var lf = DE.shelfLife(c, x);
      return !(lf && lf.expired);
    });
  }

  /* ---------- 治疗 ---------- */
  /* opts: { instId, inCombat } */
  function heal(c, opts) {
    opts = opts || {};
    var use = DE.canUseSkill(c, "治疗");
    if (!use.ok) return { ok: false, msg: "这个角色没有【治疗】技能（药师自带，或〈副业〉选它）。" };
    var sideTxt = (use.source === "sideJob") ? "　〈副业〉判定 " + use.penalty + " 已计入。" : "";
    var inst = DE.findInstance(c, opts.instId);
    if (!inst || inst.kind !== "herb") return { ok: false, msg: "请先选择一个药草。" };
    var lf = DE.shelfLife(c, inst);
    if (lf && lf.expired) return { ok: false, msg: "〈" + inst.name + "〉已经腐坏，不能使用。" };
    if (DE.waterDaysOf(c) < 1) return { ok: false, msg: "水不够：【治疗】需要 1 天份的水。" };

    var bits, total;
    if (opts.inCombat) {
      /* 战斗中：HP 恢复点数 = 【智力判定（一个骰子）】的结果点数 */
      var abEff = DE.effAbilities(c).abilities;
      var face = Math.max(4, abEff.int || 4);
      var die = Math.min(face, Math.max(1, Math.floor(Math.random() * face) + 1));
      var pen = DE.judgmentPenalty(c, "skill");
      var cmod = pen.value + use.penalty;
      total = Math.max(1, die + cmod);
      bits = "战斗中·智力单骰 d" + face + "(" + die + ")" +
             (cmod ? " 判定修正 " + (cmod > 0 ? "+" + cmod : cmod) : "") + " → " + total + " 点";
    } else {
      var r = DE.skillJudge(c, ["int", "spr"], 0, use.penalty);
      total = Math.max(1, r.total);
      bits = "d" + r.dice[0] + "(" + r.rolled[0] + ") + d" + r.dice[1] + "(" + r.rolled[1] +
             ") = " + r.sum + "，" + (r.mod ? "修正 " + (r.mod > 0 ? "+" + r.mod : r.mod) + " " : "") +
             "合计 " + r.total + " 点";
      /* 用掉了「精神判定」类一次性增益 */
      DE.buffConsume(c, ["sprJudge"]);
    }

    var from = DE.hpNow(c), mx = DE.hpMaxOf(c);
    DE.setHP(c, Math.min(mx, from + total));
    var healed = DE.hpNow(c) - from;

    DE.consume(c, inst.instId, 1);
    DE.consumeWaterDays(c, 1);
    DE.save(c);
    return {
      ok: true, healed: healed, total: total, detail: bits,
      from: from, to: DE.hpNow(c), hpMax: mx,
      msg: "【治疗】" + bits + "，HP " + from + " → " + DE.hpNow(c) +
           "（回复 " + healed + " 点）。消耗〈" + inst.name + "〉+ 1 天份的水。" + sideTxt
    };
  }

  /* ---------- 应急处理 ---------- */
  /* 使目标受到的异常状态无效化 1 小时，且该异常状态数值永久 -药师等级 */
  function firstAid(c, statusName) {
    var use = DE.canUseSkill(c, "应急处理");
    if (!use.ok) return { ok: false, msg: "这个角色没有【应急处理】技能（药师自带，或〈副业〉选它）。" };
    var list = c.statuses || [];
    var st = list.filter(function (x) { return x.name === statusName; })[0];
    if (!st) return { ok: false, msg: "没有〈" + statusName + "〉这个异常状态。" };
    if (st.emergencyISO) {
      return { ok: false, msg: "〈" + statusName + "〉已经接受过应急处理了（同一次异常只能处理一次）。" };
    }

    /* 规则书技能表：使用能力值 = 智力+精神，目标值 = 【异常状态】数值 */
    var oldValue = parseInt(st.value, 10) || 0;
    var r = DE.skillJudge(c, ["int", "spr"], oldValue, use.penalty);
    var sideTxt = (use.source === "sideJob") ? "　〈副业〉判定 " + use.penalty + " 已计入。" : "";
    var det = "判定 " + r.rolled[0] + " + " + r.rolled[1] +
              (r.mod ? " 修正 " + (r.mod > 0 ? "+" + r.mod : r.mod) : "") +
              " = " + r.total + " vs 目标 " + oldValue;

    if (!r.success) {
      DE.save(c);
      return {
        ok: true, success: false, roll: r, statusName: statusName,
        msg: "【应急处理】" + r.label + "：" + det + "，这次没有成功（可以再试）。" + sideTxt
      };
    }

    var lv = Math.max(1, parseInt(c.level, 10) || 1);
    st.nullUntil = new Date(DE.clock.now().getTime() + 3600000).toISOString();
    st.value = Math.max(0, oldValue - lv);
    st.emergencyISO = DE.gameISO();
    DE.save(c);
    return {
      ok: true, success: true, roll: r, value: st.value, nullUntil: st.nullUntil,
      msg: "【应急处理】" + det + "　成功：〈" + statusName + "〉1 小时内无效化，数值 " +
           oldValue + " → " + st.value + "（-" + lv + "，药师等级）。" + sideTxt
    };
  }

  /* ---------- 药草采摘 ---------- */
  /* 判定：体力 + 智力，目标值 = 地貌。1 天最多 1 次。
     成功 → 获得 1 个药草；大成功 → 3 个；大失败 → 【中毒：6】
     返回里 success/bigOk 时，调用方再用 grant() 发放药草（让玩家选种类）。 */
  function gather(c, opts) {
    opts = opts || {};
    var useG = DE.canUseSkill(c, "药草采摘");
    if (!useG.ok) return { ok: false, msg: "这个角色没有【药草采摘】技能（药师自带，或〈副业〉选它）。" };
    var day = DE.clock.dayNumber();
    if (c.lastGatherDay === day) {
      return { ok: false, msg: "今天已经采摘过了（药草采摘 1 天最多 1 次）。" };
    }
    var tgt = parseInt(opts.target, 10);
    if (isNaN(tgt) || tgt <= 0) return { ok: false, msg: "请填写地貌决定的目标值。" };

    c.lastGatherDay = day;   /* 不管成败，今天都算用掉了 */
    var r = DE.skillJudge(c, ["str", "int"], tgt, useG.penalty);
    DE.buffConsume(c, ["sprJudge"]);
    var gSide = (useG.source === "sideJob") ? "　〈副业〉判定 " + useG.penalty + " 已计入。" : "";

    if (r.critFail) {
      c.statuses = c.statuses || [];
      c.statuses.push({ name: "中毒", value: 6, type: "physical" });
      DE.save(c);
      return {
        ok: true, gathered: 0, critFail: true, bigOk: false, roll: r,
        msg: "【药草采摘】大失败！获得异常状态【中毒：6】（与现在状态值无关）。" +
             "判定：" + r.rolled[0] + "+" + r.rolled[1] + "=" + r.sum + " vs " + tgt + gSide
      };
    }
    if (!r.success) {
      DE.save(c);
      return {
        ok: true, gathered: 0, critFail: false, bigOk: false, roll: r,
        msg: "【药草采摘】失败，没有采到药草。判定：" +
             r.rolled[0] + "+" + r.rolled[1] + "=" + r.sum + " vs " + tgt + gSide
      };
    }
    var n = r.bigOk ? 3 : 1;
    return {
      ok: true, gathered: n, critFail: false, bigOk: r.bigOk, roll: r, needPick: true,
      msg: "【药草采摘】" + (r.bigOk ? "大成功！一次获得 3 个药草" : "成功，获得 1 个药草") +
           "（请在下面选择种类）。判定：" + r.rolled[0] + "+" + r.rolled[1] + "=" + r.sum + " vs " + tgt + gSide
    };
  }

  /* 发放采到的药草 */
  function grant(c, herbId, n) {
    var raw = DE.findHerb(herbId);
    if (!raw) return { ok: false, msg: "找不到该药草。" };
    n = Math.max(1, parseInt(n, 10) || 1);
    var made = [];
    for (var i = 0; i < n; i++) {
      made.push(DE.addItem(c, DE.herbDef(raw), {}));
    }
    DE.save(c);
    return { ok: true, made: made, msg: "获得〈" + raw.name + "〉×" + n + "（采集时间 = 现在）。" };
  }

  /* 技能可用状态（给 UI 用） */
  function state(c) {
    var day = DE.clock.dayNumber();
    var herbs = usableHerbs(c);
    var he = DE.canUseSkill(c, "治疗");
    var fa = DE.canUseSkill(c, "应急处理");
    var ga = DE.canUseSkill(c, "药草采摘");
    return {
      isApothecary: is(c),
      anySkill: he.ok || fa.ok || ga.ok,
      heal: { ok: he.ok, penalty: he.penalty, sideJob: he.source === "sideJob" },
      firstAid: { ok: fa.ok, penalty: fa.penalty, sideJob: fa.source === "sideJob" },
      gather: { ok: ga.ok, penalty: ga.penalty, sideJob: ga.source === "sideJob" },
      herbCount: herbs.length,
      water: DE.waterDaysOf(c),
      canHeal: he.ok && herbs.length > 0 && DE.waterDaysOf(c) >= 1,
      statuses: (c.statuses || []).slice(),
      gatheredToday: c.lastGatherDay === day,
      canGather: ga.ok && c.lastGatherDay !== day
    };
  }

  return { is: is, heal: heal, firstAid: firstAid, gather: gather, grant: grant,
           state: state, usableHerbs: usableHerbs };
})();


/* ============================================================
 *  通用技能判定
 *  ------------------------------------------------------------
 *  规则书技能表给每个技能写了「使用能力值」和「目标值」。
 *  有专门界面的技能（治疗 / 应急处理 / 药草采摘 / 生意兴隆）走各自的流程；
 *  其余技能（音乐 / 狩猎 / 动物搜寻 / 材料加工 / 物品制造 / 修理 / 礼仪教养）
 *  用这里的通用判定：掷【使用能力值】两个骰子 + 修正 ≥ 目标值。
 * ============================================================ */

/* 把「智力+精神」「精神+精神」这类写法解析成能力值 key 数组 */
DE.abilityKeysOf = function (txt) {
  var MAP = { "体力": "str", "敏捷": "agi", "智力": "int", "精神": "spr" };
  var out = [];
  String(txt || "").split(/[+＋/／、,，\s]+/).forEach(function (w) {
    var k = MAP[w.trim()];
    if (k) out.push(k);
  });
  if (!out.length) return null;
  if (out.length === 1) out.push(out[0]);      /* 理论上都是两段，兜底 */
  return out.slice(0, 2);
};

/* 这个技能的判定信息：{ ok, name, ability, target, effect, penalty, keys, rollable } */
DE.skillInfoOf = function (c, skillName) {
  var use = DE.canUseSkill(c, skillName);
  var d = (DE.PROFESSION_SKILLS || {})[skillName] || null;
  var keys = d ? DE.abilityKeysOf(d.ability) : null;
  return {
    ok: use.ok,
    name: skillName,
    ability: d ? d.ability : "—",
    target: d ? d.target : "—",
    effect: d ? d.effect : "",
    source: use.source,
    penalty: use.penalty,
    keys: keys,
    /* 「—」表示被动技能/没有判定 */
    rollable: !!(use.ok && keys),
    hasTool: !!(DE.TOOL_SKILLS && DE.TOOL_SKILLS[skillName])
  };
};

/* 掷一次通用技能判定。target 由玩家填（主持人决定 / 地貌 / 参照效果表）。 */
DE.skillJudgeByName = function (c, skillName, target) {
  var info = DE.skillInfoOf(c, skillName);
  if (!info.ok) {
    return { ok: false, msg: "这个角色没有〈" + skillName + "〉技能。" };
  }
  if (!info.keys) {
    return { ok: false, msg: "〈" + skillName + "〉没有判定能力值（" + info.ability + "），不需要掷骰。" };
  }
  var r = DE.skillJudge(c, info.keys, target, info.penalty);
  if (info.keys.indexOf("spr") >= 0) DE.buffConsume(c, ["sprJudge"]);
  DE.save(c);
  return {
    ok: true, roll: r, info: info,
    msg: "【" + skillName + "】" + r.label + "：" +
         "d" + r.dice[0] + "(" + r.rolled[0] + ") + d" + r.dice[1] + "(" + r.rolled[1] + ") = " + r.sum +
         (r.mod ? "，修正 " + (r.mod > 0 ? "+" + r.mod : r.mod) : "") +
         "，合计 " + r.total + " vs 目标 " + r.target +
         (info.source === "sideJob" ? "　〈副业〉判定 " + info.penalty + " 已计入。" : "")
  };
};


/* ============================================================
 *  ［修理］［物品制造］—— 手艺人技能自动化
 *  ------------------------------------------------------------
 *  规则书 p36：
 *   修理      体力+敏捷判定 ≥ 表 1；时间 = 尺寸×1天；材料费 = 价格 10%
 *             不管成败都要付材料费；重试再付一次；任何道具都能修
 *   物品制造  体力+敏捷判定 ≥ 表 1；时间 = 尺寸×1天；材料费 = 价格一半
 *             只能做「选择职业时决定的道具种类」；重试不花材料费、只花时间
 *  表 1：≤100g→6 ／ ≤1000g→8 ／ ≤1万g→10 ／ ≤10万g→14 ／ ＞10万g→18
 * ============================================================ */
DE.craft = (function () {

  function rule() { return DE.CRAFT_RULE || {}; }
  function rate(kind) {
    var m = rule().materialRate || {};
    return (typeof m[kind] === "number") ? m[kind] : 0;
  }

  /* 道具的「基础定价」—— 规则明确说材料费按不包含特征加价的价格算 */
  function basePriceOf(inst) {
    var def = DE.instDef(inst);
    if (!def) return 0;
    var p = def.price;
    return (typeof p === "number" && p > 0) ? p : 0;
  }

  /* 花费时间：道具尺寸 × 1 天（尺寸至少算 1 天） */
  function daysOf(size) {
    var n = Math.round(Number(size) || 0);
    return Math.max(1, n);
  }

  /* 推进游戏时间（会触发每日补给结算） */
  function advanceDays(days) {
    if (!days || !DE.clock || !DE.clock.advance) return null;
    var from = DE.clock.dayNumber();
    DE.clock.advance(days * 24);
    return { days: days, fromDay: from, toDay: DE.clock.dayNumber(), supply: DE.clock.lastSupply || null };
  }

  /* ---------------- 工坊记录（独立于金币账本） ---------------- */
  var MAX_LOG = 100;

  function pushLog(c, entry) {
    if (!c) return null;
    if (!Array.isArray(c.craftLog)) c.craftLog = [];
    var e = {
      id: DE.uid("cl"),
      at: (DE.gameISO ? DE.gameISO() : new Date().toISOString()),
      day: (DE.clock && DE.clock.dayNumber ? DE.clock.dayNumber() : 1),
      kind: entry.kind || "craft",
      name: entry.name || "",
      success: !!entry.success,
      dice: entry.dice || [],
      rolled: entry.rolled || [],
      sum: entry.sum,
      mod: entry.mod,
      total: entry.total,
      target: entry.target,
      material: entry.material || 0,
      days: entry.days || 0,
      costFree: !!entry.costFree,
      sideJob: !!entry.sideJob,
      detail: entry.detail || "",
      timeLabel: entry.timeLabel || ""
    };
    c.craftLog.push(e);
    if (c.craftLog.length > MAX_LOG) c.craftLog = c.craftLog.slice(-MAX_LOG);
    return e;
  }

  /* 返回副本，调用方随意排序不会改到存档 */
  function logOf(c) { return (((c && c.craftLog) || [])).slice(); }

  function clearLog(c) {
    if (!c) return { ok: false, msg: "没有角色。" };
    var n = (c.craftLog || []).length;
    c.craftLog = [];
    DE.save(c);
    return { ok: true, msg: n ? ("已清空 " + n + " 条工坊记录。") : "工坊记录本来就是空的。" };
  }

  /* ---------------- 修理 ---------------- */
  function repairInfo(c, inst) {
    var use = DE.canUseSkill(c, rule().repairSkill || "修理");
    if (!use.ok) return { ok: false, msg: "这个角色没有【修理】技能（手艺人自带，或〈副业〉选它）。" };
    if (!inst) return { ok: false, msg: "找不到这件道具。" };
    var dmax = inst.durabilityMax;
    if (typeof dmax !== "number" || dmax <= 0) {
      return { ok: false, msg: "〈" + inst.name + "〉没有耐久度，不能修理。" };
    }
    if (inst.durability >= dmax) {
      return { ok: false, msg: "〈" + inst.name + "〉耐久是满的（" + inst.durability + "/" + dmax + "），不需要修理。" };
    }
    var price = basePriceOf(inst);
    var material = price > 0 ? Math.max(1, Math.floor(price * rate("repair"))) : 0;
    return {
      ok: true, use: use,
      price: price,
      target: DE.craftTargetOf(price),
      material: material,
      days: daysOf(DE.sizeOf(inst)),
      durability: inst.durability,
      durabilityMax: dmax
    };
  }

  /* 能修的道具（耐久没满的都算） */
  function repairable(c) {
    var out = [];
    ((c && c.inventory) || []).forEach(function (x) {
      if (typeof x.durabilityMax !== "number" || x.durabilityMax <= 0) return;
      if (x.durability >= x.durabilityMax) return;
      var info = repairInfo(c, x);
      if (info.ok) out.push({ inst: x, info: info });
    });
    return out;
  }

  function doRepair(c, instId, opts) {
    opts = opts || {};
    var inst = DE.findInstance(c, instId);
    var info = repairInfo(c, inst);
    if (!info.ok) return { ok: false, msg: info.msg };
    if ((c.money || 0) < info.material) {
      return { ok: false, msg: "金币不足：材料费要 " + info.material + " G，你现在有 " + (c.money || 0) + " G。" };
    }

    var r = DE.skillJudge(c, rule().ability || ["str", "agi"], info.target, info.use.penalty);
    /* 规则：不管判定是否成功，都需要花费材料费 */
    if (info.material > 0) {
      DE.ledger.spend(c, info.material, "craft", "修理材料：〈" + inst.name + "〉");
    }
    var before = inst.durability;
    if (r.success) inst.durability = inst.durabilityMax;
    var time = (opts.advance === false) ? null : advanceDays(info.days);
    pushLog(c, {
      kind: "repair", name: inst.name, success: r.success,
      dice: r.dice, rolled: r.rolled, sum: r.sum, mod: r.mod, total: r.total, target: info.target,
      material: info.material, days: info.days,
      sideJob: info.use.source === "sideJob",
      detail: r.success
        ? ("耐久 " + before + " → " + inst.durability + "/" + inst.durabilityMax)
        : ("耐久仍为 " + before + "/" + inst.durabilityMax + "（材料费已付）"),
      timeLabel: time ? ("第 " + time.fromDay + " 天 → 第 " + time.toDay + " 天") : ""
    });
    DE.save(c);

    var det = "判定 " + r.rolled[0] + " + " + r.rolled[1] +
      (r.mod ? " 修正 " + (r.mod > 0 ? "+" + r.mod : r.mod) : "") +
      " = " + r.total + " vs 目标 " + info.target;
    var msgs = ["【修理】" + r.label + "：" + det];
    msgs.push(r.success
      ? "〈" + inst.name + "〉耐久 " + before + " → " + inst.durability + "/" + inst.durabilityMax
      : "〈" + inst.name + "〉耐久仍为 " + before + "/" + inst.durabilityMax + "（材料费已付，可以再修一次）");
    msgs.push("材料费 " + info.material + " G　耗时 " + info.days + " 天");
    if (info.use.source === "sideJob") msgs.push("〈副业〉判定 " + info.use.penalty + " 已计入");
    if (time) msgs.push("游戏时间 → " + DE.clock.label());
    return {
      ok: true, success: r.success, roll: r, info: info, time: time,
      before: before, after: inst.durability, material: info.material,
      msg: msgs.join("　")
    };
  }

  /* ---------------- 物品制造 ---------------- */
  function craftCandidates(c) {
    var cats = (c && c.craftCats) || [];
    var excl = DE.CRAFT_EXCLUDE_CATS || [];
    return (DE.ITEMS || []).filter(function (it) {
      if (excl.indexOf(it.cat) >= 0) return false;
      if (typeof it.price !== "number" || it.price <= 0) return false;
      if (cats.length && cats.indexOf(it.cat) < 0) return false;
      return true;
    });
  }

  function craftInfo(c, itemId) {
    var use = DE.canUseSkill(c, rule().craftSkill || "物品制造");
    if (!use.ok) return { ok: false, msg: "这个角色没有【物品制造】技能（手艺人自带，或〈副业〉选它）。" };
    var def = DE.findItem(itemId);
    if (!def) return { ok: false, msg: "找不到这个道具。" };
    var cats = (c && c.craftCats) || [];
    if (!cats.length) {
      return { ok: false, msg: "还没在「车卡」页选「可制作的道具种类」，没法制造。" };
    }
    if (cats.indexOf(def.cat) < 0) {
      return { ok: false, msg: "〈" + def.name + "〉不属于你选定的制作种类。" };
    }
    var price = (typeof def.price === "number" && def.price > 0) ? def.price : 0;
    if (!price) return { ok: false, msg: "〈" + def.name + "〉没有定价，不能制造。" };
    var pending = c.craftPending || null;
    var isRetry = !!(pending && pending.itemId === itemId);
    var full = Math.max(1, Math.floor(price * rate("craft")));
    return {
      ok: true, use: use, def: def,
      price: price,
      target: DE.craftTargetOf(price),
      fullMaterial: full,
      material: isRetry ? 0 : full,
      isRetry: isRetry,
      days: daysOf(def.size || 1)
    };
  }

  function doCraft(c, itemId, opts) {
    opts = opts || {};
    var info = craftInfo(c, itemId);
    if (!info.ok) return { ok: false, msg: info.msg };
    if ((c.money || 0) < info.material) {
      return { ok: false, msg: "金币不足：材料费要 " + info.material + " G，你现在有 " + (c.money || 0) + " G。" };
    }

    var r = DE.skillJudge(c, rule().ability || ["str", "agi"], info.target, info.use.penalty);
    if (info.material > 0) {
      DE.ledger.spend(c, info.material, "craft", "制作材料：〈" + info.def.name + "〉");
    }
    var made = null;
    if (r.success) {
      made = DE.addItem(c, info.def, {});
      c.craftPending = null;
    } else {
      /* 规则：可再次挑战，重试不花材料费、只花时间 */
      c.craftPending = { itemId: itemId, name: info.def.name, paidISO: DE.gameISO() };
    }
    var time = (opts.advance === false) ? null : advanceDays(info.days);
    pushLog(c, {
      kind: "craft", name: info.def.name, success: r.success,
      dice: r.dice, rolled: r.rolled, sum: r.sum, mod: r.mod, total: r.total, target: info.target,
      material: info.material, days: info.days, costFree: info.isRetry,
      sideJob: info.use.source === "sideJob",
      detail: r.success ? ("做出〈" + info.def.name + "〉") : "失败（材料已投入，可免费重试）",
      timeLabel: time ? ("第 " + time.fromDay + " 天 → 第 " + time.toDay + " 天") : ""
    });
    DE.save(c);

    var det = "判定 " + r.rolled[0] + " + " + r.rolled[1] +
      (r.mod ? " 修正 " + (r.mod > 0 ? "+" + r.mod : r.mod) : "") +
      " = " + r.total + " vs 目标 " + info.target;
    var msgs = ["【物品制造】" + r.label + "：" + det];
    msgs.push(r.success
      ? "做好了一个〈" + info.def.name + "〉"
      : "这次没做出来（材料已投入，重试只花时间、不再收材料费）");
    msgs.push((info.isRetry ? "材料费 0 G（上一次已付）" : "材料费 " + info.material + " G") +
      "　耗时 " + info.days + " 天");
    if (info.use.source === "sideJob") msgs.push("〈副业〉判定 " + info.use.penalty + " 已计入");
    if (time) msgs.push("游戏时间 → " + DE.clock.label());
    return {
      ok: true, success: r.success, roll: r, info: info, time: time,
      made: made, material: info.material,
      msg: msgs.join("　")
    };
  }

  /* 放弃/清除「已付材料费的那次制作」 */
  function clearPending(c) {
    if (!c || !c.craftPending) return { ok: false, msg: "没有进行中的制作。" };
    var nm = c.craftPending.name || "道具";
    c.craftPending = null;
    DE.save(c);
    return { ok: true, msg: "已放弃重做〈" + nm + "〉（材料费不退）。" };
  }

  function state(c) {
    var rep = DE.canUseSkill(c, rule().repairSkill || "修理");
    var crf = DE.canUseSkill(c, rule().craftSkill || "物品制造");
    return {
      any: rep.ok || crf.ok,
      repair: { ok: rep.ok, penalty: rep.penalty, sideJob: rep.source === "sideJob" },
      craft: { ok: crf.ok, penalty: crf.penalty, sideJob: crf.source === "sideJob" },
      cats: (c && c.craftCats) || [],
      candidates: crf.ok ? craftCandidates(c) : [],
      pending: (c && c.craftPending) || null,
      log: logOf(c)
    };
  }

  return {
    basePriceOf: basePriceOf,
    repairInfo: repairInfo,
    repairable: repairable,
    doRepair: doRepair,
    craftCandidates: craftCandidates,
    craftInfo: craftInfo,
    doCraft: doCraft,
    clearPending: clearPending,
    advanceDays: advanceDays,
    pushLog: pushLog,
    logOf: logOf,
    clearLog: clearLog,
    state: state
  };
})();
