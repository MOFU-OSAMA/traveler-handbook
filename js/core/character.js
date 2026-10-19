/* ============================================================
 *  龙蛋物语 — 车卡（角色创建）逻辑
 *  依据：规则书「人物卡 - 车卡篇」
 *   1 选择职业  2 选择特长  3 决定能力值（4/6/8）
 *   4 计算 HP/MP  5 选择擅长武器  6 随身物品
 *   7 用 1000 金币购买道具  8 填写角色信息
 *  ============================================================ */
window.DE = window.DE || {};

DE.char = {

  /* ---------- 校验 ---------- */
  /* 校验能力值组合是否等于所选模板 */
  checkAbilitySet(c, setId) {
    var set = DE.ABILITY_SETS.filter(function (s) { return s.id === setId; })[0];
    if (!set) return { ok: false, need: [], msg: "请选择一种数值组合。" };
    var have = DE.ABILITY_KEYS.map(function (k) { return c.abilities[k.key]; });
    var want = set.values.slice().sort(function (a, b) { return a - b; });
    var got = have.slice().sort(function (a, b) { return a - b; });
    var ok = want.length === got.length && want.every(function (v, i) { return v === got[i]; });
    return {
      ok: ok, set: set, want: want, got: got,
      msg: ok ? "能力值分配符合「" + set.name + "」。" :
        "「" + set.name + "」需要 " + want.join(" / ") + "，当前为 " + got.join(" / ") + "。"
    };
  },

  /* 制作角色时能力值只能从 4/6/8 中选择 */
  ALLOWED_CREATE: [4, 6, 8],

  /* ---------- 特长能力派生 ---------- */
  talentEffects(c) {
    var out = { hp: 0, mp: 0, sizeLimit: 0, extraWeapon: 0, extraSpellPerLevel: 0, seasonMagic: false,
      notes: [] };
    var type = DE.TYPES.filter(function (t) { return t.id === c.talent; })[0];
    if (!type) return out;
    type.abilities.forEach(function (ab) {
      if (ab === "坚韧") { out.hp += 4; out.notes.push("坚韧：HP 上限 +4"); }
      if (ab === "许愿") { out.mp += 4; out.notes.push("许愿：MP 上限 +4"); }
      if (ab === "口袋") { out.sizeLimit += 3; out.notes.push("口袋：持有尺寸上限 +3"); }
      if (ab === "专注") { out.extraWeapon += 1; out.notes.push("专注：额外获得 1 种擅长武器"); }
      if (ab === "咒语书") { out.extraSpellPerLevel += 2; out.notes.push("咒语书：每等级获得 2 个咒语魔法"); }
      if (ab === "季节之法") { out.seasonMagic = true; out.notes.push("季节之法：掌握季节魔法"); }
      if (ab === "强力") out.notes.push("强力：战斗中的【伤害判定】+1");
      if (ab === "精确") out.notes.push("精确：【集中】时共计 +2");
      if (ab === "快速") out.notes.push("快速：战斗中的【行动判定】+1");
    });
    return out;
  },

  /* ---------- 职业技能派生 ---------- */
  professionSkills(c) {
    var p = DE.PROFESSIONS.filter(function (x) { return x.id === c.profession; })[0];
    if (!p) return [];
    return p.skills.map(function (n) {
      var d = DE.PROFESSION_SKILLS[n] || { ability: "—", target: "—", effect: "" };
      return { name: n, ability: d.ability, target: d.target, effect: d.effect };
    });
  },

  /* ---------- 应用特长 / 职业带来的一次性加成 ---------- */
  applyBonuses(c) {
    /* 兜底：坏存档没有 bonus 时不要抛错 */
    if (!c || !c.bonus) return { hp: 0, mp: 0, sizeLimit: 0 };
    var e = DE.char.talentEffects(c);
    c.bonus.hp = e.hp;
    c.bonus.mp = e.mp;
    c.bonus.sizeLimit = e.sizeLimit;
    return e;
  },


  /* ============================================================
   *  车卡规则自检
   *  逐条对照规则书（p22 / p23 / p24 / p40 / p42 / p44 / p100-114），
   *  返回 { ok, errors[], warns[], oks[] }。
   *  errors = 与规则书冲突，必须改；warns = 还没做完；oks = 已符合。
   *  ============================================================ */
    validate(c) {
    var E = [], W = [], O = [];
    var lv = c.level | 0 || 1;

    /* ---- 1 等级 ---- */
    if (lv < 1 || lv > DE.LEVELUP.maxLevel) {
      E.push("等级 " + lv + " 超出范围（旅行者 1~" + DE.LEVELUP.maxLevel + " 级）。");
    } else {
      O.push("等级 " + lv + "／" + DE.LEVELUP.maxLevel + " 级");
    }

    /* ---- 2 职业 ---- */
    var prof = DE.PROFESSIONS.filter(function (p) { return p.id === c.profession; })[0];
    if (!prof) W.push("还没选职业（规则书要求车卡第一步就是选职业）。");
    else O.push("职业：" + prof.name + "（含 " + (prof.skills || []).length + " 个职业技能）");

    /* ---- 3 能力值：只能从 4/6/8 选，且必须正好是所选组合的那四个数 ---- */
    var ab = c.abilities || {};
    /* DE.ABILITY_KEYS 是 [{key,name,short,desc}]，不是字符串数组 */
    var KEYS = DE.ABILITY_KEYS.map(function (k) { return k.key; });
    function abLabel(k) {
      var o = DE.ABILITY_KEYS.filter(function (x) { return x.key === k; })[0];
      return o ? o.name : k;
    }
    var missing = KEYS.filter(function (k) { return typeof ab[k] !== "number"; });
    if (missing.length) {
      /* 能力值缺失或不是数字：不能直接拿去查表，否则会崩 */
      E.push("能力值不完整：" + missing.map(function (k) {
        return abLabel(k) + "=" + (ab[k] === undefined ? "未设定" : JSON.stringify(ab[k]));
      }).join("、") + "。");
      ab = {};                       /* 后面基于能力值的计算全部跳过 */
      DE.ABILITY_KEYS.forEach(function (x) { ab[x.key] = 0; });
    }
    var bad = KEYS.filter(function (k) {
      return (missing.length ? false : DE.char.ALLOWED_CREATE.indexOf(ab[k]) < 0);
    });
    if (bad.length) {
      E.push("能力值 " + bad.map(function (k) {
        return abLabel(k) + "=" + ab[k];
      }).join("、") + " 不是 4/6/8 —— 制作角色时只能从 4、6、8 中选择（10 与 12 要靠升级取得）。");
    }
    var set = DE.ABILITY_SETS.filter(function (x) { return x.id === c.abilitySet; })[0];
    if (!set) {
      W.push("没有指定能力值组合，无法校验分配。");
    } else {
      /* checkAbilitySet 需要组合 id，且「没选组合」时要单独提示 */
      var chk = DE.char.checkAbilitySet(c, set.id);
      if (!chk.ok) {
        var gotTxt = (chk.got && chk.got.length) ? chk.got.join("/") : "（能力值不完整）";
        E.push("能力值分配与「" + set.name + "」不符：组合是 " + set.values.join("/") +
          "，需要按喜欢的顺序重新分配，当前是 " + gotTxt + "。");
      } else {
        O.push("能力值组合：" + set.name + "（" + set.values.join("/") + "）");
      }
    }

    /* ---- 4 特长：三种里选 1 种 ---- */
    var type = DE.TYPES.filter(function (t) { return t.id === c.talent; })[0];
    if (!type) W.push("还没选特长（战斗 / 技术 / 魔法 三选一）。");
    else O.push("特长：" + type.name + "（" + (type.abilities || []).join("、") + "）");

    /* ---- 5 擅长武器：五选一（郊游模式的「赤手空拳」除外）---- */
    var fw = (c.favoredWeapons || []).filter(function (x) { return x; });
    var e0 = DE.char.talentEffects(c);
    var needW = DE.START.favoredWeaponCount + (e0.extraWeapon || 0);
    var names = DE.WEAPONS_CHAR.map(function (w) { return w.name; });
    var unknown = fw.filter(function (x) { return names.indexOf(x) < 0; });
    if (unknown.length) E.push("擅长武器「" + unknown.join("、") + "」不在规则书的五选一里（" + names.join(" / ") + "）。");
    if (fw.length < needW) {
      if (!fw.length) W.push("还没选擅长武器（" + names.join(" / ") + " 五选一）。");
      else W.push("擅长武器只选了 " + fw.length + " 种，应该选 " + needW + " 种。");
    } else if (fw.length > needW) {
      E.push("擅长武器选了 " + fw.length + " 种，超出上限 " + needW + " 种" +
        (e0.extraWeapon ? "（含特长「专注」+1）" : "") + "。");
    } else {
      O.push("擅长武器：" + fw.join("、") + "（" + fw.length + "/" + needW + "）");
    }

    /* ---- 6 派生数值 ---- */
    var d = DE.derive(c);
    var hpWant = ab.str * 2 + (c.bonus.hp || 0);
    var mpWant = ab.spr * 2 + (c.bonus.mp || 0);
    if (d.hpMax !== hpWant) E.push("HP 上限应为 体力×2 = " + hpWant + "，当前 " + d.hpMax + "。");
    else O.push("HP 上限 " + d.hpMax + " = 体力 " + ab.str + " × 2");
    if (d.mpMax !== mpWant) E.push("MP 上限应为 精神×2 = " + mpWant + "，当前 " + d.mpMax + "。");
    else O.push("MP 上限 " + d.mpMax + " = 精神 " + ab.spr + " × 2");
    /* 和 DE.derive 用同一套「结算后」的能力值比 —— 否则身上有异常状态时
       （行动值已经被降过）这里会误报「行动值算错」。 */
    var abEff = d.abilities || ab;
    if (d.action !== abEff.agi + abEff.int) E.push("行动值应为 敏捷+智力 = " + (abEff.agi + abEff.int) + "，当前 " + d.action + "。");
    else O.push("行动值 " + d.action + " = 敏捷 " + abEff.agi + " + 智力 " + abEff.int);
    var szWant = ab.str + 2 + lv + (c.bonus.sizeLimit || 0);
    if (d.sizeLimit !== szWant) E.push("道具尺寸上限应为 体力+2+等级 = " + szWant + "，当前 " + d.sizeLimit + "。");
    else O.push("道具尺寸上限 " + d.sizeLimit + " = 体力 " + ab.str + " + 2 + 等级 " + lv +
      (c.bonus.sizeLimit ? " + 特长 " + c.bonus.sizeLimit : ""));

    /* ---- 7 特长带来的加成是否落实 ---- */
    if ((c.bonus.hp || 0) !== e0.hp) E.push("HP 加成为 " + (c.bonus.hp || 0) + "，特长「坚韧」应为 " + e0.hp + "。");
    if ((c.bonus.mp || 0) !== e0.mp) E.push("MP 加成为 " + (c.bonus.mp || 0) + "，特长「许愿」应为 " + e0.mp + "。");
    if ((c.bonus.sizeLimit || 0) !== e0.sizeLimit) E.push("尺寸上限加成为 " + (c.bonus.sizeLimit || 0) + "，特长「口袋」应为 " + e0.sizeLimit + "。");

    /* ---- 8 随身物品：1 个 ---- */
    if (!(c.personal || "").trim()) W.push("还没填随身物品（规则书要求 1 个，原则上没有数据）。");

    /* ---- 9 装备栏位 ---- */
    Object.keys(c.equipped || {}).forEach(function (k) {
      var id = c.equipped[k];
      if (!id) return;
      var inst = DE.findInstance(c, id);
      if (!inst) {
        E.push("「" + k + "」栏位指向一个已经不存在的道具（悬空引用），已在自检中忽略。");
        return;
      }
      var chk2 = DE.canEquip(c, inst, k);
      if (!chk2.ok) E.push("装备栏位冲突：" + chk2.msg);
      var slot = DE.SLOTS.filter(function (x) { return x.key === k; })[0];
      if (slot && slot.accept.indexOf(DE.instDef(inst).cat) < 0) {
        E.push("〈" + inst.name + "〉不该装在「" + (slot.label || k) + "」。");
      }
      if (inst.containerId) E.push("〈" + inst.name + "〉还装在容器里，却已被装备。");
    });

    /* ---- 10 咒语（魔法特长） ---- */
    var hasSpellAbility = (type && type.abilities.indexOf("咒语书") >= 0);
    var hasSeasonAbility = (type && type.abilities.indexOf("季节之法") >= 0);
    var known = DE.knownGeneral(c);
    var si = DE.spellSlotInfo(c);
    if (!type) {
      /* 没选特长，跳过 */
    } else if (!hasSpellAbility && known.length) {
      E.push("当前特长「" + type.name + "」没有「咒语书」能力，却已学了 " + known.length + " 个咒语。");
    } else if (hasSpellAbility && !known.length) {
      W.push("魔法特长还没学任何咒语（" + lv + " 级应学 " + si.total + " 个，每级 2 个）。");
    }
    if (known.length) {
      if (si.over) E.push("已学咒语 " + si.used + " 个，超出栏位上限 " + si.total +
        " 个（每级 2 个" + (hasSpellAbility ? "，特长「咒语书」每级再 +2" : "") + "）。");
      else O.push("咒语 " + si.used + "/" + si.total + " 个栏位");
      known.forEach(function (m) {
        var need = DE.SPELL_RULE.minLevelFor(m.level);
        if (lv < need) E.push("已学〈" + m.name + "〉是" + m.level + "魔法，需要等级 " + need + "。");
      });
      /* 重复 */
      var seen = {};
      (c.spells || []).forEach(function (no) {
        if (seen[no]) E.push("咒语里同一个魔法重复记录了两次（编号 " + no + "）。");
        seen[no] = 1;
      });
    }
    if (hasSeasonAbility && !c.seasonMagic) W.push("特长含「季节之法」，还没选季节（春/夏/秋/冬）。");
    if (!hasSeasonAbility && c.seasonMagic) E.push("选了季节「" + c.seasonMagic + "」，但当前特长没有「季节之法」。");
    if (hasSeasonAbility && c.seasonMagic) O.push("季节魔法：" + c.seasonMagic + "（" + DE.SPELL_RULE.seasonalTiers(c).join("/") + "）");

    /* ---- 11 金钱与购物 ---- */
    if (c.money < 0) E.push("金币为负数（" + c.money + "），不可能。");
    var spent = (c.inventory || []).reduce(function (n, x) {
      return n + (x.paidPrice || 0) * (x.qty || 1) * (x.containerId ? 0 : 1);
    }, 0);
    if (c.money + spent > DE.START.money + 1) {
      W.push("花掉的金币（约 " + spent + "）+ 剩余（" + c.money + "）超过了初始的 " +
        DE.START.money + " 金币 —— 如果中途有收入（卖东西 / 任务奖励）可忽略。");
    }

    /* ---- 12 尺寸 ---- */
    if (d.sizeOver > 0) {
      E.push("携带尺寸超出上限 " + d.sizeOver + " 点，所有判定会受到减值。");
    }
    var overCount = (DE.largeContainerCount ? DE.largeContainerCount(c) : 0);
    if (overCount > 1) E.push("同时携带了 " + overCount + " 个大型容器（木箱/水桶/背包），规则上只能带 1 个。");

    return { ok: E.length === 0, errors: E, warns: W, oks: O };
  },

  /* ---------- 数值总览 ---------- */
  summary(c) {
    /* 兜底：坏存档没有能力值时给一份空总览 */
    if (!c || !c.abilities) {
      return { hpMax:0, mpMax:0, action:0, condition:0, defense:0, penalty:0, block:0,
               sizeLimit:0, sizeUsed:0, sizeOver:0, sizeLimitBase:0, carryLimit:0,
               talent:null, profSkills:[],
               magic:null, errors:[], warns:[], oks:[], noAbilities:true };
    }
    DE.char.applyBonuses(c);
    var d = DE.derive(c);
    var e = DE.char.talentEffects(c);
    return {
      hpMax: d.hpMax, mpMax: d.mpMax, action: d.action, condition: d.condition,
      defense: d.defense, penalty: d.equipPenalty, block: d.block,
      sizeLimit: d.sizeLimit, sizeUsed: d.sizeUsed, sizeOver: d.sizeOver,
      /* 尺寸上限的构成：自身上限 + 驮货动物驮运量（规则书 p51） */
      sizeLimitBase: d.sizeLimitBase, carryLimit: d.carryLimit,
      talent: e,
      profSkills: DE.char.professionSkills(c),
      magic: DE.char.magicList(c)
    };
  },

  /* ---------- 魔法数量 ---------- */
  /* 咒语书：每等级获得 2 个咒语魔法；季节之法：掌握季节魔法 */
  magicList(c) {
    var e = DE.char.talentEffects(c);
    var generalSlots = e.extraSpellPerLevel ? e.extraSpellPerLevel * c.level : 0;
    var maxRank = c.level >= 7 ? "高级" : (c.level >= 4 ? "中级" : "初级");
    var pickable = DE.GENERAL_MAGIC.filter(function (m) {
      return ["初级", "中级", "高级"].indexOf(m.level) <= ["初级", "中级", "高级"].indexOf(maxRank);
    });
    return {
      hasSpellbook: !!e.extraSpellPerLevel,
      hasSeasonMagic: !!e.seasonMagic,
      generalSlots: generalSlots,
      maxRank: maxRank,
      pickable: pickable,
      chosen: c.spells || [],
      seasonMaxRank: maxRank
    };
  },

  /* ---------- 装备与擅长武器的可用性 ---------- */
  /* 只有擅长武器可以正常使用，否则每次攻击 HP -1 */
  weaponStatus(c, itemName) {
    var f = c.favoredWeapons || [];
    var m = f.filter(function (x) { return x && itemName.indexOf(x) >= 0; })[0];
    if (m) return { proficient: true, msg: "擅长武器" };
    return { proficient: false, msg: "非擅长武器：每次攻击 HP 减少 " + DE.NON_PROFICIENT_HP_COST + " 点" };
  },

  /* 把所选数值组合按「体力 > 精神 > 智力 > 敏捷」填入，用户可再自行调整 */
  applySetValues(cc) {
    var s = DE.ABILITY_SETS.filter(function (x) { return x.id === cc.abilitySet; })[0];
    if (!s) return cc;
    /* 数值组合按升序印刷（如标准型 4·6·6·8）。
     * 默认按「体力 > 精神 > 智力 > 敏捷」把较大的数字分给更常用的能力值；
     * 用户可以随时在能力值面板里自行调整。 */
    var vals = s.values.slice().sort(function (a, b) { return b - a; });
    ["str", "spr", "int", "agi"].forEach(function (k, i) { cc.abilities[k] = vals[i]; });
    return cc;
  },

  /* ---------- 新建 / 重置 ---------- */
  fresh(opts) {
    var c = DE.newCharacter();
    c.abilities = { str: 8, agi: 4, int: 6, spr: 6 };   // 标准型默认
    c.money = DE.START.money;
    if (opts) for (var k in opts) c[k] = opts[k];
    return c;
  },

  /* ---------- 初始装备一键配齐 ---------- */
  starterKit(c, which) {
    var added = [];
    function put(id, qty) {
      var def = DE.findItem(id);
      if (!def) return;
      DE.addItem(c, def, { qty: qty || 1, forceBag: true });
      added.push(def.name + (qty > 1 ? " ×" + qty : ""));
    }
    if (which === "travel") {
      put("L_bigbackpack"); put("k_sleepbag"); put("d_tableware");
      put("c_waterskin"); put("f_ration", 4);
    } else if (which === "party") {
      put("an_pack"); put("L_bucket"); put("L_chest");
      put("d_cookware"); put("d_torch", 4); put("d_firekit");
      put("d_soap"); put("d_laundry"); put("k_tent");
    } else if (which === "herb") {
      put("c_herbbottle");
    }
    DE.save(c);
    return added;
  },

  /* ---------- 导出 / 导入 ---------- */
  exportJSON(c) {
    return JSON.stringify({ app: "dragonEgg", version: 1, exportedAt: new Date().toISOString(), character: c }, null, 2);
  },
  importJSON(text) {
    var o = JSON.parse(text);
    var c = o.character || o;
    if (!c || !c.abilities) throw new Error("这不是有效的角色存档。");
    return DE.migrate(c);
  }
};

/* ---------- 常用导出文本（供打印 / 抄卡） ---------- */
DE.char.asText = function (c) {
  var s = DE.char.summary(c);
  var L = [];
  L.push("=== 龙蛋物语 角色卡 ===");
  L.push("角色名字：" + (c.name || "—") + "    玩家：" + (c.player || "—"));
  L.push("等级：" + c.level + "    经验值：" + c.exp + "    性别：" + (c.gender || "—") + "    年龄：" + (c.age || "—"));
  L.push("职业：" + (DE.professions ? "" : "") +
    ((DE.PROFESSIONS.filter(function (p) { return p.id === c.profession; })[0] || {}).name || "—") +
    "    特长：" + ((DE.TYPES.filter(function (t) { return t.id === c.talent; })[0] || {}).name || "—"));
  L.push("能力值：体力 " + c.abilities.str + " / 敏捷 " + c.abilities.agi +
         " / 智力 " + c.abilities.int + " / 精神 " + c.abilities.spr);
  L.push("HP " + s.hpMax + "    MP " + s.mpMax + "    状态值 " + s.condition + "    行动值 " + s.action);
  L.push("擅长武器：" + (c.favoredWeapons || []).filter(Boolean).join("、"));
  L.push("擅长地貌/天气：" + (c.favoredTerrain || "—") + " / " + (c.favoredWeather || "—"));
  L.push("持有尺寸：" + s.sizeUsed + " / " + s.sizeLimit + (s.sizeOver ? "（超出 " + s.sizeOver + "）" : ""));
  L.push("金币：" + c.money);
  L.push("印象颜色与外表特征：" + (c.appearance || "—"));
  L.push("故乡与踏上旅途的原因：" + (c.hometown || "—"));
  L.push("随身物品：" + (c.personal || "—"));
  L.push("记述：" + (c.story || "—"));
  L.push("");
  L.push("-- 职业技能 --");
  s.profSkills.forEach(function (k) {
    L.push("・" + k.name + "（" + k.ability + "／目标值：" + k.target + "）");
  });
  L.push("");
  L.push("-- 特长能力 --");
  s.talent.notes.forEach(function (n) { L.push("・" + n); });
  L.push("");
  L.push("-- 装备 --");
  DE.SLOTS.forEach(function (sl) {
    var inst = DE.findInstance(c, c.equipped[sl.key]);
    L.push("・" + sl.label + "：" + (inst ? inst.name + "（耐久 " + inst.durability + "/" + inst.durabilityMax + "）" : "—"));
  });
  L.push("");
  L.push("-- 背包 --");
  c.inventory.filter(function (x) { return !x.equipped; }).forEach(function (x) {
    var def = DE.instDef(x);
    L.push("・" + x.name + (x.qty > 1 ? " ×" + x.qty : "") +
      "（尺寸 " + DE.sizeOf(x) + (def && def.cat ? "，" + DE.CATEGORIES[def.cat].label : "") +
      "，耐久 " + x.durability + "/" + x.durabilityMax + "）");
  });
  return L.join("\n");
};
