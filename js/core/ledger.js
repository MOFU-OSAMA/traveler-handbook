/* ============================================================
 *  龙蛋物语 — 金币账本
 *  记录每一笔金钱变动（买 / 卖 / 任务奖励 / 手动调整…），
 *  让玩家随时看到钱的去向。
 *  所有改钱的地方都应该通过 DE.ledger.spend / earn / adjust 走，
 *  这样账目才不会漏。
 *  ============================================================ */
window.DE = window.DE || {};

DE.ledger = {

  MAX: 500,                    // 最多保留多少条（防止存档无限增长）

  /* 分类：图标 + 名称 + 颜色 */
  CATS: {
    reward:  { icon: "🎁", name: "任务奖励", dir: "in",  color: "#e8b04b" },
    buy:     { icon: "🛒", name: "购物",     dir: "out", color: "#d9776b" },
    sell:    { icon: "💰", name: "卖出",     dir: "in",  color: "#69c07a" },
    repair:  { icon: "🔧", name: "修理",     dir: "out", color: "#c98b6a" },
    wage:    { icon: "🧾", name: "工资 / 报酬", dir: "in", color: "#69c07a" },
    wagepay: { icon: "👷", name: "支付报酬", dir: "out", color: "#d9776b" },
    wagon:   { icon: "🐴", name: "马车",     dir: "out", color: "#4ec9d4" },
    adjust:  { icon: "✏️", name: "手动调整", dir: "both", color: "#8ea0b5" },
    init:    { icon: "🌱", name: "初始金币", dir: "in",  color: "#8ea0b5" },
    other:   { icon: "•",  name: "其他",     dir: "both", color: "#8ea0b5" }
  },
  findCat: function (id) {
    return DE.ledger.CATS[id] || DE.ledger.CATS.other;
  },

  list: function (c) {
    if (!c.ledger) c.ledger = [];
    return c.ledger;
  },

  /* 记一笔。delta > 0 收入，< 0 支出。balance 由调用方在改钱之后传进来。 */
  push: function (c, delta, cat, note, balance, extra) {
    if (!delta) return null;
    DE.ledger.list(c);
    var e = {
      id: DE.uid("lg"),
      at: DE.gameISO(),                 // 用游戏时间，和保质期同一套钟
      delta: delta,
      cat: cat || "other",
      note: note || "",
      balance: (balance === undefined || balance === null) ? c.money : balance
    };
    if (extra) for (var k in extra) e[k] = extra[k];
    c.ledger.push(e);
    if (c.ledger.length > DE.ledger.MAX) {
      c.ledger = c.ledger.slice(c.ledger.length - DE.ledger.MAX);
    }
    return e;
  },

  /* ---------- 便捷入口：都会记一笔 ---------- */

  /* 花钱。返回 false 表示钱不够（不动账）。 */
  spend: function (c, amount, cat, note, extra) {
    amount = Math.round(amount);
    if (amount <= 0) return false;
    if ((c.money || 0) < amount) return false;
    c.money -= amount;
    DE.ledger.push(c, -amount, cat, note, c.money, extra);
    return true;
  },

  /* 收钱 */
  earn: function (c, amount, cat, note, extra) {
    amount = Math.round(amount);
    if (amount <= 0) return false;
    c.money = (c.money || 0) + amount;
    DE.ledger.push(c, amount, cat, note, c.money, extra);
    return true;
  },

  /* 手动调整到某个数（或增减）。回传这次实际的变化量。 */
  adjust: function (c, delta, note) {
    delta = Math.round(delta);
    if (!delta) return { ok: false, msg: "没有变化。" };
    var before = c.money || 0;
    c.money = Math.max(0, before + delta);
    var real = c.money - before;
    if (!real) return { ok: false, msg: "金币已经是 0，无法再减。" };
    DE.ledger.push(c, real, "adjust", note || (real > 0 ? "手动加钱" : "手动扣钱"), c.money);
    return { ok: true, delta: real, money: c.money,
             msg: (real > 0 ? "加了 " : "扣了 ") + Math.abs(real) + " G，现在有 " + c.money + " G。" };
  },

  /* 设成某个具体数额 */
  setTo: function (c, value, note) {
    value = Math.max(0, Math.round(value));
    var before = c.money || 0;
    return DE.ledger.adjust(c, value - before, note || ("设定为 " + value + " G"));
  },

  /* ---------- 统计 ---------- */
  stats: function (c) {
    var l = DE.ledger.list(c);
    var income = 0, expense = 0;
    l.forEach(function (e) {
      if (e.delta > 0) income += e.delta; else expense += -e.delta;
    });
    var byCat = {};
    l.forEach(function (e) {
      var k = e.cat || "other";
      if (!byCat[k]) byCat[k] = { in: 0, out: 0, n: 0 };
      byCat[k].n++;
      if (e.delta > 0) byCat[k].in += e.delta; else byCat[k].out += -e.delta;
    });
    return {
      count: l.length,
      income: income, expense: expense,
      net: income - expense,
      byCat: byCat,
      first: l.length ? l[0].at : null,
      last: l.length ? l[l.length - 1].at : null
    };
  },

  /* 汇总成文本（可复制给主持人看） */
  asText: function (c) {
    var l = DE.ledger.list(c);
    var st = DE.ledger.stats(c);
    var out = ["=== 金币账本 ===",
      "当前金币：" + (c.money || 0) + " G",
      "累计收入：" + st.income + " G　累计支出：" + st.expense + " G　净额：" + st.net + " G",
      "共 " + st.count + " 笔记录", ""];
    l.slice().reverse().forEach(function (e) {
      var cat = DE.ledger.findCat(e.cat);
      out.push("[" + e.at.slice(0, 16).replace("T", " ") + "] " + cat.icon + " " + cat.name +
        "　" + (e.delta > 0 ? "+" : "") + e.delta + " G　余额 " + e.balance + " G" +
        (e.note ? "　" + e.note : ""));
    });
    return out.join("\n");
  },

  /* ---------- 迁移 ---------- */
  migrate: function (c) {
    if (!Array.isArray(c.ledger)) c.ledger = [];
    c.ledger = c.ledger.filter(function (e) {
      return e && typeof e === "object" && typeof e.delta === "number" && e.delta !== 0;
    }).map(function (e) {
      if (!e.id) e.id = DE.uid("lg");
      if (!e.at || isNaN(new Date(e.at).getTime())) e.at = DE.gameISO();
      if (!e.cat || !DE.ledger.CATS[e.cat]) e.cat = "other";
      if (typeof e.balance !== "number") e.balance = 0;
      if (typeof e.note !== "string") e.note = "";
      return e;
    });
    if (c.ledger.length > DE.ledger.MAX)
      c.ledger = c.ledger.slice(c.ledger.length - DE.ledger.MAX);
    /* 老存档：有钱但没有任何记录时，补一条「期初余额」，
       这样「账目 + 余额」能对上，不会看起来像丢了钱。 */
    if (!c.ledger.length && (c.money || 0) !== 0) {
      c.ledger.push({
        id: DE.uid("lg"),
        at: DE.gameISO(),
        delta: c.money,
        cat: "init",
        note: "期初余额（升级前的存档）",
        balance: c.money
      });
    }
    return c.ledger;
  }
};
