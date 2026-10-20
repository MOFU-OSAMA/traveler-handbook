/* ============================================================
 *  龙蛋物语 — 通用 UI 助手 + 游戏时钟 + 顶部导航
 *  ============================================================ */
window.DE = window.DE || {};

DE.CLOCK_KEY = "dragonEgg.clock.v2";

/* ---------- 小工具 ---------- */
DE.ui = {
  $(sel, root) { return (root || document).querySelector(sel); },
  $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },
  esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  },
  el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (html !== undefined) e.innerHTML = html;
    return e;
  },
  toast(msg, kind) {
    var t = DE.ui.$("#toast");
    if (!t) { t = DE.ui.el("div", { id: "toast", class: "toast" }); document.body.appendChild(t); }
    t.className = "toast show " + (kind || "");
    t.innerHTML = msg;
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.className = "toast " + (kind || ""); }, kind === "err" ? 5200 : 3600);
  },
  /* 参数：{title, body, okText, onOk} */
  confirm(opts) {
    return new Promise(function (res) {
      var ov = DE.ui.el("div", {
        style: "position:fixed;inset:0;background:rgba(40,32,22,.5);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px"
      });
      var box = DE.ui.el("div", {
        class: "card",
        style: "max-width:430px;width:100%;margin:0"
      }, '<h2>' + DE.ui.esc(opts.title || "确认") + '</h2><div style="font-size:13.5px;color:#6b5f50;white-space:pre-wrap">' +
         DE.ui.esc(opts.body || "") + '</div><div class="btnrow" style="justify-content:flex-end">' +
         '<button class="ghost" data-x="0">取消</button><button class="primary" data-x="1">' +
         DE.ui.esc(opts.okText || "确定") + '</button></div>');
      ov.appendChild(box); document.body.appendChild(ov);
      ov.addEventListener("click", function (e) {
        var v = e.target.getAttribute && e.target.getAttribute("data-x");
        if (e.target === ov) { document.body.removeChild(ov); return res(false); }
        if (v === null || v === undefined) return;
        document.body.removeChild(ov); res(v === "1");
      });
    });
  },
  /* 数值格式化 */
  money(n) { return (n === null || n === undefined) ? "—" : Number(n).toLocaleString("zh-CN") + " G"; },
  pct(n) { return Math.round(n * 100) + "%"; },
  dateLabel(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " +
           String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  },
  /* 尺寸显示 */
  sizeLabel(v) { return v === 0 ? "0（动物）" : String(v); }
};

/* ============================================================
 *  游戏时钟
 *  用途：药草 / 食材的保质期、每日状态判定、旅行天数
 *  纯手动：游戏时间只在调用 DE.clock.advance() 时前进，
 *  现实时间过去多久都不会影响它。
 *  ============================================================ */
/* ============================================================
 *  游戏内时间 —— 纯手动推进，不随现实时间流逝
 *  现实时间过去多久都不影响游戏时间；只有调用 advance() 才前进。
 *  ============================================================ */
DE.clock = {
  /* 第 1 天 08:00 的绝对毫秒数 —— 游戏时间以此为原点 */
  _BASE_HOURS: new Date(2026, 0, 1, 8, 0, 0).getTime() / 3600000,
  defaults() {
    /* gameISO：游戏内当前时刻；advHours：累计已推进的小时数 */
    return {
      gameISO: new Date(2026, 0, 1, 8, 0, 0).toISOString(),
      advHours: 0,
      manual: true
    };
  },
  load() {
    var c = null;
    try { c = JSON.parse(localStorage.getItem(DE.CLOCK_KEY)); } catch (e) { c = null; }
    if (!c || typeof c !== "object") return DE.clock.defaults();

    /* 迁移旧格式：以前是「现实时间 × 倍率」，把它的已过时间折算进来，
       然后彻底切断与现实时间的联系。 */
    if (typeof c.startReal === "number") {
      var realHours = (Date.now() - c.startReal) / 3600000 * (c.scale || 1);
      var base = new Date(2026, 0, 1, 8, 0, 0).getTime();
      var total = Math.max(0, realHours + (c.advHours || 0));
      var fresh = {
        gameISO: new Date(base + total * 3600000).toISOString(),
        advHours: total,
        manual: true
      };
      DE.clock.save(fresh);
      return fresh;
    }
    if (typeof c.gameISO !== "string" || isNaN(new Date(c.gameISO).getTime()))
      c.gameISO = DE.clock.defaults().gameISO;
    if (typeof c.advHours !== "number") c.advHours = 0;
    /* 规范化：第 1 天 08:00 = 0 小时 */
    var base = DE.clock._BASE_HOURS * 3600000;
    if (new Date(c.gameISO).getTime() < base) c.gameISO = new Date(base).toISOString();
    return c;
  },
  save(c) {
    try { localStorage.setItem(DE.CLOCK_KEY, JSON.stringify(c)); } catch (e) {}
    /* 同步到这个存档槽位自己的时钟。
       以前只写全局键，于是「推进时间 → 存档箱切换角色」会读回该槽位的旧时钟，
       时间直接倒退。存档层的 activate() 是按槽位恢复时钟的，所以这里必须成对写。 */
    try {
      if (DE.archive && DE.archive.active) {
        var id = DE.archive.active();
        if (id) localStorage.setItem("dragonEgg.clock.slot." + id, JSON.stringify(c));
      }
    } catch (e) {}
    return c;
  },

  /* 游戏内已经过的小时数。
     以 gameISO 直接换算，并在 load 时把起点规范成「第 1 天 08:00」。 */
  elapsedHours() {
    var c = DE.clock.load();
    return DE.clock._hoursFromISO(c.gameISO);
  },
  _hoursFromISO(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 0;
    /* 第 1 天 08:00 记为 0 小时 */
    return Math.max(0, d.getTime() / 3600000 - DE.clock._BASE_HOURS);
  },
  /* 游戏内的当前时刻 —— 只看游戏数据，与现实无关 */
  now() { return new Date(DE.clock.load().gameISO); },

  /* 一天从 08:00 起算，所以第 N 天 00:00~07:59 属于第 N-1 个 24 小时段 */
  dayNumber() {
    /* ⚠️ 单位陷阱：elapsedHours() 返回的是**小时**。
       以前这里写成 (h + 8*60) / (24*60) —— 小时加分钟、再除以分钟，
       结果天数几乎永远是 1（只有过了很久才会跳）。
       必须和 label() 用同一个算法：一天从 08:00 起算。 */
    var h = DE.clock.elapsedHours();
    return Math.floor((h + 8) / 24) + 1;
  },

  /* 时刻：以 08:00 为原点，换成钟表时间 */
  clockTime() {
    var h = DE.clock.elapsedHours();
    return (8 + h) % 24;
  },

  label() {
    var h = DE.clock.elapsedHours();
    var day = Math.floor((h + 8) / 24) + 1;
    var hh = Math.floor((8 + h) % 24);
    var mm = Math.floor(((8 + h) * 60) % 60);
    return "第 " + day + " 天 " + String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  },

  /* 手动推进（小时）。
     ⚠️ 每跨过一天就要结算食物和水（规则书 p77 旅行流程 ⑤：
        「消耗食物和水（一天结束时，每人需消耗食物和水各 1 天份）」）。
     结算结果存到 DE.clock.lastSupply，供页面弹提示。 */
  advance(hours) {
    var beforeDay = DE.clock.dayNumber();
    var c = DE.clock.load();
    hours = Number(hours) || 0;
    c.advHours = (c.advHours || 0) + hours;
    var t = new Date(c.gameISO).getTime() + hours * 3600000;
    if (t < DE.clock._BASE_HOURS * 3600000) t = DE.clock._BASE_HOURS * 3600000;
    c.gameISO = new Date(t).toISOString();
    DE.clock.save(c);
    DE.clock._settleSupply(beforeDay, DE.clock.dayNumber());

    /* 跨天后清理「当天有效」的药草增益（月下的雪割草等） */
    try {
      var _ch = DE.store && DE.store.character;
      if (_ch && DE.expireBuffs) {
        var _gone = DE.expireBuffs(_ch);
        if (_gone.length) {
          if (DE.save) DE.save(_ch);
          DE.clock.lastExpiredBuffs = _gone;
        }
      }
    } catch (e) {}

    return c;
  },

  /* 跨了几天就结算几天份的补给。
     只在**向前**推进时结算：时间回退不该吐回食物。
     但回退必须把「缺粮累计」清掉 —— 否则回到第一天，
     「第 1 天粮食用尽 -1」的减值和红字会一直挂着消不掉。 */
  _settleSupply(fromDay, toDay) {
    DE.clock.lastSupply = null;
    var ch = DE.store && DE.store.character;
    var n = (toDay | 0) - (fromDay | 0);

    if (n < 0) {
      /* 时间倒退：那段缺粮不存在了，直接清空 */
      if (ch) {
        ch.supplyShortFrom = null;
        ch.supplyShortBase = 0;
        ch.supplyShortDays = 0;
        ch.supplyPenalty = 0;
        if (DE.save) DE.save(ch);
      }
      return;
    }
    if (!n || !ch || !DE.consumeSupply) return;
    try {
      /* startDay 传 fromDay：这批被消耗的第一天 = fromDay + 1，
         consumeSupply 要靠它记录「缺粮从第几天开始」。 */
      var r = DE.consumeSupply(ch, n, fromDay);
      DE.clock.lastSupply = r;
      if (DE.save) DE.save(ch);
    } catch (e) { console.warn("补给结算失败", e); }
  },
  /* 直接跳到某一天（保留当天的时刻） */
  setDay(day) {
    var c = DE.clock.load();
    day = Math.max(1, day | 0);
    var cur = DE.clock.elapsedHours();
    var target = (day - 1) * 24 + (cur % 24);
    return DE.clock.advance(target - cur);
  },
  /* 把进度清零，回到第 1 天 08:00。
     ⚠️ 这里**不能**动角色的缺粮状态：DE.boot() 在「从来没有存过时钟」时
        也会调用本函数做初始化，那时 DE.store.character 刚就位，
        清一下就把新角色/刚读进来的存档状态抹掉了。
        要清缺粮状态请用 DE.clock.clearSupplyState()，只在用户明确重置时调。 */
  reset() { return DE.clock.save(DE.clock.defaults()); },

  /* 用户明确「重置游戏时间」时调用：时间回到第 1 天，缺粮累计也一并清空。 */
  clearSupplyState() {
    var ch = DE.store && DE.store.character;
    if (!ch) return;
    ch.supplyShortFrom = null;
    ch.supplyShortBase = 0;
    ch.supplyShortDays = 0;
    ch.supplyPenalty = 0;
    if (DE.save) DE.save(ch);
  },

  /* 兼容旧调用：不再有倍率概念 */
  setScale() { return DE.clock.load(); },
  scaleLabel() { return "手动推进（不随现实时间流逝）"; },
  isManual() { return true; }
};;

/* 相对时间描述 */
DE.relTime = function (iso) {
  if (!iso) return "—";
  var ms = DE.clock.now().getTime() - new Date(iso).getTime();
  var h = ms / 3600000;
  if (h < 0) return "刚刚";
  if (h < 1) return Math.max(1, Math.floor(ms / 60000)) + " 分钟前";
  if (h < 48) return Math.floor(h) + " 小时前";
  return Math.floor(h / 24) + " 天前";
};

/* 剩余时间描述 */
DE.fmtRemain = function (ms) {
  if (ms <= 0) return "已过期";
  var h = ms / 3600000;
  if (h >= 48) return Math.floor(h / 24) + " 天 " + Math.floor(h % 24) + " 小时";
  if (h >= 1) return Math.floor(h) + " 小时 " + Math.floor((ms % 3600000) / 60000) + " 分";
  return Math.max(1, Math.floor(ms / 60000)) + " 分钟";
};

/* ============================================================
 *  页面框架：顶栏 + 时钟条 + 过期提醒
 * ============================================================ */
DE.PAGES = [
  { href: "index.html",     label: "首页",     icon: "🏠" },
  { href: "create.html",    label: "车卡",     icon: "🧾" },
  { href: "bag.html",       label: "背包",     icon: "🎒" },
  { href: "spellbook.html", label: "咒语书",   icon: "📖" },
  { href: "wagon.html",     label: "马车",     icon: "🐴" },
  { href: "shop.html",      label: "商店",     icon: "🛒" },
  { href: "map.html",       label: "冒险地图", icon: "🗺️" },
  { href: "journal.html",   label: "手账本",   icon: "📔" },
  { href: "codex.html",     label: "图鉴",     icon: "📚" }
]

DE.ui.frame = function (opts) {
  opts = opts || {};
  var here = location.pathname.split("/").pop() || "index.html";
  var nav = DE.PAGES.map(function (p) {
    var act = (p.href === here) ? " class=\"active\"" : "";
    return '<a href="' + p.href + '"' + act + ">" + p.icon + " " + p.label + "</a>";
  }).join("");

  var bar = document.createElement("header");
  bar.className = "topbar";
  bar.innerHTML = '<div class="topbar-inner">' +
    '<div class="brand"><span class="egg">🥚</span><span>龙蛋物语 · 旅行者手册</span></div>' +
    '<nav class="mainnav">' + nav + "</nav></div>";
  var body = document.body;
  if (body.firstChild) body.insertBefore(bar, body.firstChild);
  else body.appendChild(bar);

  /* 顶部时钟条：纯手动推进，不跟现实时间挂钩 */
  var c = document.createElement("div");
  c.className = "clockbar";
  c.innerHTML = '<div class="clockbar-inner">' +
    '<button class="sm" id="clockOpen" title="打开游戏时间控件">—</button>' +
    '<span id="clockScale" class="badge teal">手动推进</span>' +
    '<span class="spacer"></span>' +
    '<span id="clockHerb" class="badge">—</span>' +
    "</div>";
  if (bar.parentNode) bar.parentNode.insertBefore(c, bar.nextSibling);
  else if (body.firstChild) body.insertBefore(c, body.firstChild);
  else body.appendChild(c);

  /* 点时间就打开弹窗 —— 控件不再占用页面版面 */
  DE.ui.clockButton(DE.ui.$("#clockOpen"));

  if (opts.after) opts.after();
  DE.ui.tick();
  /* 每 20 秒刷新一次时钟与保质期显示 */
  setInterval(DE.ui.tick, 20000);
};

/* 刷新所有与时间相关的显示 */
/* 监听别的标签页改了存档 —— 重新读档后回调。
   用途：首页改了 HP/MP，同时开着的咒语书要跟着变（它们读写同一份 c.mpCurrent）。 */
DE.ui.onCharacterChanged = function (fn) {
  try {
    if (typeof window === "undefined" || !window.addEventListener) return;
    window.addEventListener("storage", function (ev) {
      if (!ev || ev.key !== DE.SAVE_KEY) return;
      var fresh = null;
      try { fresh = DE.load(); } catch (e) { fresh = null; }
      if (!fresh) return;
      DE.store.character = fresh;
      try { fn(fresh); } catch (e) { console.warn("外部改动回调失败", e); }
    });
  } catch (e) {}
};

DE.ui.tick = function () {
  DE.ui.refreshClockButtons();
  var s = DE.ui.$("#clockScale");
  if (s) s.textContent = DE.clock.scaleLabel();
  var h = DE.ui.$("#clockHerb");
  var c = DE.store.character;
  if (h && c) {
    var a = DE.expiryAlerts(c);
    if (a.expired.length) {
      h.className = "badge red";
      h.textContent = "⚠ " + a.expired.length + " 件已过期";
    } else if (a.soon.length) {
      h.className = "badge gold";
      h.textContent = "⏳ " + a.soon.length + " 件即将过期";
    } else {
      h.className = "badge green";
      h.textContent = "✓ 无临期物品";
    }
  }
  if (DE.onTick) DE.onTick();
};

/* 渲染顶部过期提醒（供各页面调用） */
DE.ui.expiryBanner = function (container) {
  var c = DE.store.character;
  if (!c || !container) return;
  var a = DE.expiryAlerts(c);
  var html = "";
  if (a.expired.length) {
    html += '<div class="alert red"><span class="ico">⚠️</span><div><b>' + a.expired.length +
      ' 件药草 / 食材已经腐坏，不能再使用</b>' +
      a.expired.slice(0, 6).map(function (x) {
        return DE.ui.esc(x.inst.name) + "（" + DE.ui.esc(x.life.label) + "，已过期 " +
               DE.fmtRemain(-x.life.remainMs) + "）";
      }).join("、") +
      (a.expired.length > 6 ? " 等 " + a.expired.length + " 件" : "") +
      '<div style="margin-top:6px"><a href="bag.html">前往背包处理 →</a></div></div></div>';
  }
  if (a.soon.length) {
    html += '<div class="alert gold"><span class="ico">⏳</span><div><b>' + a.soon.length +
      ' 件物品将在 24 小时内过期</b>' +
      a.soon.slice(0, 6).map(function (x) {
        return DE.ui.esc(x.inst.name) + "（还剩 " + DE.fmtRemain(x.life.remainMs) + "）";
      }).join("、") +
      '<div style="margin-top:6px"><a href="bag.html">前往背包查看 →</a></div></div></div>';
  }
  container.innerHTML = html;
};

/* 载入本地存档（各页面首行调用） */
DE.ui.bootPage = function (opts) {
  DE.store.character = DE.boot();
  DE.ui.frame(opts);

};

/* ---------- 右键菜单（背包格子等使用） ---------- */
DE.ui.contextMenu = function (x, y, items) {
  DE.ui.closeContextMenu();
  var m = document.createElement("div");
  m.className = "ctxmenu";
  m.id = "ctxmenu";
  m.innerHTML = items.map(function (it, i) {
    if (it[0] === "-") return '<div class="sep"></div>';
    return '<div class="mi" data-mi="' + i + '">' + DE.ui.esc(it[0]) + "</div>";
  }).join("");
  document.body.appendChild(m);
  var w = m.offsetWidth || 150, h = m.offsetHeight || items.length * 30;
  m.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x)) + "px";
  m.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, y)) + "px";
  DE.ui.$$("[data-mi]", m).forEach(function (el) {
    el.onclick = function () {
      var fn = items[parseInt(el.getAttribute("data-mi"), 10)][1];
      DE.ui.closeContextMenu();
      if (fn) fn();
    };
  });
  setTimeout(function () {
    document.addEventListener("mousedown", DE.ui._ctxOutside);
    document.addEventListener("keydown", DE.ui._ctxKey);
  }, 0);
  return m;
};
DE.ui._ctxOutside = function (ev) {
  var m = document.getElementById("ctxmenu");
  if (m && m.contains(ev.target)) return;
  DE.ui.closeContextMenu();
};
DE.ui._ctxKey = function (ev) { if (ev.key === "Escape") DE.ui.closeContextMenu(); };
DE.ui.closeContextMenu = function () {
  var m = document.getElementById("ctxmenu");
  if (m && m.parentNode) m.parentNode.removeChild(m);
  document.removeEventListener("mousedown", DE.ui._ctxOutside);
  document.removeEventListener("keydown", DE.ui._ctxKey);
};

/* ============================================================
 *  游戏时间控件（背包 / 咒语书 / 手账本共用）
 *  纯手动推进，不跟现实时间挂钩。
 * ============================================================ */
DE.ui.clockPanel = function (container, onChange) {
  if (!container) return;
  var ADV = [
    { h: 1,   label: "＋1 小时" },
    { h: 4,   label: "＋4 小时" },
    { h: 8,   label: "＋8 小时" },
    { h: 24,  label: "＋1 天" },
    { h: 72,  label: "＋3 天" },
    { h: 168, label: "＋7 天" }
  ];
  function draw() {
    var h = DE.clock.elapsedHours();
    var day = Math.floor(h / 24) + 1;
    var hh = Math.floor(h % 24), mm = Math.floor((h * 60) % 60);
    container.innerHTML =
      '<div class="clockbox">' +
        '<div class="clk">' +
          '<div class="clk-day">第 ' + day + ' 天</div>' +
          '<div class="clk-time">' + String(hh).padStart(2, "0") + ":" +
            String(mm).padStart(2, "0") + "</div>" +
          '<div class="clk-note">手动推进 · 不随现实时间流逝</div>' +
        "</div>" +
        '<div class="clk-btns">' +
          ADV.map(function (a) {
            return '<button class="sm" data-adv="' + a.h + '">' + a.label + "</button>";
          }).join("") + "</div>" +
        '<div class="clk-extra">' +
          '<button class="sm ghost" data-clock="day">跳到第 … 天</button>' +
          '<button class="sm ghost" data-clock="set">设定时刻…</button>' +
          '<button class="sm ghost" data-clock="reset">↺ 回到第 1 天</button>' +
        "</div>" +
      "</div>";
    DE.ui.$$("[data-adv]", container).forEach(function (b) {
      b.onclick = function () {
        var hh2 = parseFloat(b.getAttribute("data-adv"));
        DE.clock.advance(hh2);
        DE.ui.toast(DE.ui.clockAdvanceMsg(hh2), "ok");
        draw();
        if (onChange) onChange();
      };
    });
    var d = container.querySelector('[data-clock="day"]');
    if (d) d.onclick = function () {
      var s2 = prompt("跳到第几天？（当前第 " + (Math.floor(DE.clock.elapsedHours() / 24) + 1) + " 天）", "1");
      if (s2 === null) return;
      var n = parseInt(s2, 10);
      if (isNaN(n) || n < 1) { DE.ui.toast("请输入 1 以上的整数。", "err"); return; }
      DE.clock.setDay(n);
      DE.ui.toast("已跳到第 " + n + " 天。", "ok");
      draw(); if (onChange) onChange();
    };
    var st = container.querySelector('[data-clock="set"]');
    if (st) st.onclick = function () {
      var cur = DE.clock.now();
      var s3 = prompt("设定游戏内时刻（第几天 时:分）",
        (Math.floor(DE.clock.elapsedHours() / 24) + 1) + " " +
        String(cur.getHours()).padStart(2, "0") + ":" + String(cur.getMinutes()).padStart(2, "0"));
      if (s3 === null) return;
      var m = String(s3).trim().match(/^(\d+)\s+(\d{1,2})\s*[:：]\s*(\d{1,2})$/);
      if (!m) { DE.ui.toast("格式应为「3 14:30」。", "err"); return; }
      var day = parseInt(m[1], 10), hh3 = parseInt(m[2], 10), mm3 = parseInt(m[3], 10);
      if (hh3 > 23 || mm3 > 59) { DE.ui.toast("时分超出范围。", "err"); return; }
      var curH = DE.clock.elapsedHours();
      var target = (day - 1) * 24 + hh3 + mm3 / 60;
      DE.clock.advance(target - curH);
      DE.ui.toast("游戏时间已设为 " + DE.clock.label() + "。", "ok");
      draw(); if (onChange) onChange();
    };
    var r = container.querySelector('[data-clock="reset"]');
    if (r) r.onclick = function () {
      DE.ui.confirm({ title: "重置游戏时间", okText: "重置",
        body: "回到第 1 天 08:00。所有药草的保质期会按新时间重新计算，确定吗？" })
        .then(function (ok) {
          if (!ok) return;
          DE.clock.reset();
          DE.ui.toast("游戏时间已重置。", "ok");
          draw(); if (onChange) onChange();
        });
    };
  }
  DE.ui._clockPanels = DE.ui._clockPanels || [];
  DE.ui._clockPanels.push(draw);
  draw();
  return { refresh: draw };
};
DE.ui.clockAdvanceMsg = function (hours) {
  var d = hours / 24;
  var what = (hours % 24 === 0 && d >= 1)
    ? (d === 1 ? "1 天" : (d === 7 ? "1 周" : d + " 天"))
    : (hours === 1 ? "1 小时" : hours + " 小时");
  return "游戏时间推进 " + what + "，现在是 " + DE.clock.label() + "。";
};
/* 让所有已挂载的时间控件一起刷新 */
DE.ui.refreshClocks = function () {
  (DE.ui._clockPanels || []).forEach(function (f) { try { f(); } catch (e) {} });
};

/* ============================================================
 *  金币账本 UI（首页 / 背包共用）
 * ============================================================ */
DE.ui.moneyHero = function (container, c, onChange) {
  if (!container) return;
  function draw() {
    var st = DE.ledger.stats(c);
    container.innerHTML =
      '<div class="moneyhero">' +
        '<div><div class="lbl">所持金</div>' +
          '<div class="amt">' + (c.money || 0) + "<small>G</small></div></div>" +
        '<div style="font-size:11.5px;color:#c0a97e;line-height:1.9">' +
          "累计收入 <b style='color:#9fd6a8'>+" + st.income + " G</b><br>" +
          "累计支出 <b style='color:#e8a89c'>−" + st.expense + " G</b><br>" +
          "净额 " + (st.net >= 0 ? "+" : "") + st.net + " G　·　" + st.count + " 笔</div>" +
        '<span class="sp"></span>' +
        '<div class="acts">' +
          '<button class="sm gold" data-mny="reward">🎁 发放奖励</button>' +
          '<button class="sm" data-mny="adjust">✏️ 调整金币</button>' +
          '<button class="sm ghost" data-mny="set">设为…</button>' +
          '<button class="sm ghost" data-mny="undo">↩ 撤销上一笔</button>' +
          '<button class="sm ghost" data-mny="text">📋 导出账本</button>' +
        "</div>" +
      "</div>";
    DE.ui.$$("[data-mny]", container).forEach(function (b) {
      b.onclick = function () { act(b.getAttribute("data-mny")); };
    });
  }
  function done(msg, ok) {
    DE.save(c);
    DE.ui.toast(msg, ok === false ? "err" : "ok");
    draw();
    if (onChange) onChange();
  }
  function act(kind) {
    if (kind === "reward") return DE.ui.rewardDialog(c, done);
    if (kind === "adjust") return DE.ui.adjustDialog(c, done);
    if (kind === "set") return DE.ui.setMoneyDialog(c, done);
    if (kind === "text") {
      var ov = DE.ui.el("div", { style: "position:fixed;inset:0;background:rgba(40,32,22,.55);z-index:300;display:flex;align-items:center;justify-content:center;padding:18px" });
      ov.innerHTML = '<div class="card" style="max-width:700px;width:100%;max-height:86vh;overflow:auto;margin:0">' +
        "<h2>金币账本</h2>" +
        '<textarea style="min-height:360px;font-family:ui-monospace,Consolas,monospace;font-size:12px">' +
        DE.ui.esc(DE.ledger.asText(c)) + "</textarea>" +
        '<div class="btnrow" style="justify-content:flex-end">' +
        '<button class="primary" id="lgCopy">复制</button>' +
        '<button class="ghost" id="lgClose">关闭</button></div></div>';
      document.body.appendChild(ov);
      ov.querySelector("#lgClose").onclick = function () { document.body.removeChild(ov); };
      ov.querySelector("#lgCopy").onclick = function () {
        var ta = ov.querySelector("textarea"); ta.select();
        try { document.execCommand("copy"); DE.ui.toast("已复制。", "ok"); }
        catch (e) { DE.ui.toast("复制失败，请手动选择。", "err"); }
      };
      return;
    }
    if (kind === "undo") {
      var l = DE.ledger.list(c);
      if (!l.length) { DE.ui.toast("还没有任何记录。", ""); return; }
      var e = l[l.length - 1];
      DE.ui.confirm({ title: "撤销上一笔", okText: "撤销",
        body: "撤回「" + DE.ledger.findCat(e.cat).name + "　" +
              (e.delta > 0 ? "+" : "") + e.delta + " G　" + e.note + "」？<br>" +
              "金币会回到 " + (c.money - e.delta) + " G，这条记录会被删除。" })
        .then(function (ok) {
          if (!ok) return;
          c.money = Math.max(0, c.money - e.delta);
          l.pop();
          done("已撤销一笔：" + (e.delta > 0 ? "+" : "") + e.delta + " G。");
        });
    }
  }
  draw();
  DE.ui._moneyHeroes = DE.ui._moneyHeroes || [];
  DE.ui._moneyHeroes.push(draw);
  return { refresh: draw };
};
DE.ui.refreshMoneyHeroes = function () {
  (DE.ui._moneyHeroes || []).forEach(function (f) { try { f(); } catch (e) {} });
};

/* ---------- 通用：搭一个弹窗 ---------- */
DE.ui.modal = function (title, bodyHtml, buttons, onOpen) {
  var ov = DE.ui.el("div", { style: "position:fixed;inset:0;background:rgba(40,32,22,.55);z-index:320;display:flex;align-items:center;justify-content:center;padding:18px" });
  ov.innerHTML = '<div class="card" style="max-width:460px;width:100%;max-height:88vh;overflow:auto;margin:0">' +
    "<h2>" + title + "</h2>" + bodyHtml +
    '<div class="btnrow" style="justify-content:flex-end">' +
    buttons.map(function (b, i) {
      return '<button class="' + (b.cls || "ghost") + '" data-mb="' + i + '">' + b.label + "</button>";
    }).join("") + "</div></div>";
  document.body.appendChild(ov);
  function close() { if (ov.parentNode) document.body.removeChild(ov); }
  DE.ui.$$("[data-mb]", ov).forEach(function (el) {
    el.onclick = function () {
      var b = buttons[parseInt(el.getAttribute("data-mb"), 10)];
      if (b.fn && b.fn(ov, close) === false) return;
      close();
    };
  });
  /* 第四个参数：初始化回调，用于给弹窗里的快捷按钮绑事件 */
  if (onOpen) onOpen(ov, close);
  return { el: ov, close: close };
};

/* ---------- 🎁 发放任务奖励 ---------- */
DE.ui.rewardDialog = function (c, done) {
  var PRESETS = [50, 100, 200, 300, 500, 1000];
  var last = c.ledger && c.ledger.length
    ? (c.ledger.filter(function (e) { return e.cat === "reward"; }).slice(-1)[0] || {}).note : "";
  DE.ui.modal("🎁 发放任务奖励",
    '<div class="hint" style="margin-bottom:11px">主持人给旅行者发奖励时用这里。金额会记进账本，写清楚来源方便日后查。</div>' +
    '<label class="fld"><span>金额（金币）</span>' +
      '<input type="number" id="rwAmt" min="1" step="1" value="100"></label>' +
    '<div class="btnrow" style="margin:-4px 0 12px">' +
      PRESETS.map(function (p) {
        return '<button class="sm ghost" data-rw="' + p + '">' + p + "</button>";
      }).join("") + "</div>" +
    '<label class="fld"><span>奖励来源 / 说明</span>' +
      '<input type="text" id="rwNote" placeholder="例如：完成「迷雾森林的岔路」" value="' +
      DE.ui.esc(last || "") + '"></label>' +
    '<div class="btnrow" style="margin:-4px 0 12px">' +
      ["完成委托", "任务奖励", "卖情报", "谢礼", "工资"].map(function (t) {
        return '<button class="sm ghost" data-rwnote="' + DE.ui.esc(t) + '">' + DE.ui.esc(t) + "</button>";
      }).join("") + "</div>" +
    '<div class="hint">当前金币：<b>' + (c.money || 0) + " G</b></div>",
    [{ label: "取消", cls: "ghost" },
     { label: "发放", cls: "primary", fn: function (ov) {
        var amt = parseInt(ov.querySelector("#rwAmt").value, 10);
        if (!amt || amt <= 0) { DE.ui.toast("请输入大于 0 的金额。", "err"); return false; }
        var note = ov.querySelector("#rwNote").value.trim() || "任务奖励";
        DE.ledger.earn(c, amt, "reward", note);
        done("已发放 " + amt + " G（" + note + "），现在有 " + c.money + " G。");
     } }],
    function (ov) {
      DE.ui.$$("[data-rw]", ov).forEach(function (b) {
        b.onclick = function () { ov.querySelector("#rwAmt").value = b.getAttribute("data-rw"); };
      });
      DE.ui.$$("[data-rwnote]", ov).forEach(function (b) {
        b.onclick = function () { ov.querySelector("#rwNote").value = b.getAttribute("data-rwnote"); };
      });
    });
};

/* ---------- ✏️ 调整金币 ---------- */
DE.ui.adjustDialog = function (c, done) {
  var PRESETS = [10, 50, 100, 500, 1000];
  DE.ui.modal("✏️ 调整金币",
    '<div class="hint" style="margin-bottom:11px">临时加钱或扣钱（买东西找零、罚款、路费等）。</div>' +
    '<div class="row">' +
      '<label class="fld"><span>金额</span><input type="number" id="adAmt" min="1" step="1" value="100"></label>' +
      '<label class="fld"><span>方向</span><select id="adDir">' +
        '<option value="in">增加（+）</option><option value="out">减少（−）</option></select></label>' +
    "</div>" +
    '<div class="btnrow" style="margin:-4px 0 12px">' +
      PRESETS.map(function (p) {
        return '<button class="sm ghost" data-ad="' + p + '">' + p + "</button>";
      }).join("") + "</div>" +
    '<label class="fld"><span>原因</span><input type="text" id="adNote" placeholder="例如：替村民修屋顶的谢礼"></label>' +
    '<div class="hint">当前金币：<b>' + (c.money || 0) + " G</b>（不会低于 0）</div>",
    [{ label: "取消", cls: "ghost" },
     { label: "确定", cls: "primary", fn: function (ov) {
        var amt = Math.abs(parseInt(ov.querySelector("#adAmt").value, 10) || 0);
        if (!amt) { DE.ui.toast("请输入金额。", "err"); return false; }
        var dir = ov.querySelector("#adDir").value;
        var note = ov.querySelector("#adNote").value.trim() || "手动调整";
        var r = DE.ledger.adjust(c, dir === "in" ? amt : -amt, note);
        done(r.msg, r.ok);
     } }],
    function (ov) {
      DE.ui.$$("[data-ad]", ov).forEach(function (b) {
        b.onclick = function () { ov.querySelector("#adAmt").value = b.getAttribute("data-ad"); };
      });
    });
};

/* ---------- 直接设定金额 ---------- */
DE.ui.setMoneyDialog = function (c, done) {
  DE.ui.modal("设为指定金额",
    '<div class="hint" style="margin-bottom:11px">把金币直接设成某个数（用于核对或重开）。差额会记进账本。</div>' +
    '<label class="fld"><span>目标金额</span><input type="number" id="stAmt" min="0" step="1" value="' +
      (c.money || 0) + '"></label>' +
    '<label class="fld"><span>原因</span><input type="text" id="stNote" placeholder="例如：重新核对"></label>',
    [{ label: "取消", cls: "ghost" },
     { label: "设定", cls: "primary", fn: function (ov) {
        var v = parseInt(ov.querySelector("#stAmt").value, 10);
        if (isNaN(v) || v < 0) { DE.ui.toast("请输入 0 以上的整数。", "err"); return false; }
        var note = ov.querySelector("#stNote").value.trim() || ("设定为 " + v + " G");
        var r = DE.ledger.setTo(c, v, note);
        done(r.ok ? r.msg : "金额没有变化。", r.ok);
     } }]);
};

/* ---------- 账本面板 ---------- */
DE.ui.ledgerPanel = function (container, c, onChange) {
  if (!container) return;
  var FILTER = "all";
  function draw() {
    var l = DE.ledger.list(c);
    var st = DE.ledger.stats(c);
    var cats = Object.keys(st.byCat).sort(function (a, b) { return st.byCat[b].n - st.byCat[a].n; });
    var rows = l.slice().reverse().filter(function (e) {
      return FILTER === "all" || e.cat === FILTER;
    });
    container.innerHTML =
      '<div class="lgsum">' +
        '<div class="b in"><div class="k">累计收入</div><div class="v">+' + st.income + "</div></div>" +
        '<div class="b out"><div class="k">累计支出</div><div class="v">−' + st.expense + "</div></div>" +
        '<div class="b net"><div class="k">净额</div><div class="v">' + (st.net >= 0 ? "+" : "") + st.net + "</div></div>" +
        '<div class="b"><div class="k">记录笔数</div><div class="v">' + st.count + "</div></div>" +
      "</div>" +
      '<div class="catbar">' +
        '<span class="cb' + (FILTER === "all" ? " on" : "") + '" data-lgf="all">全部 ' + l.length + "</span>" +
        cats.map(function (k) {
          var cat = DE.ledger.findCat(k);
          return '<span class="cb' + (FILTER === k ? " on" : "") + '" data-lgf="' + k + '">' +
            cat.icon + " " + cat.name + " " + st.byCat[k].n + "</span>";
        }).join("") +
      "</div>" +
      (rows.length
        ? '<div class="ledger"><table><thead><tr>' +
            "<th>时间</th><th>类别</th><th>金额</th><th>余额</th><th>说明</th>" +
            "</tr></thead><tbody>" +
            rows.map(function (e) {
              var cat = DE.ledger.findCat(e.cat);
              return "<tr>" +
                '<td class="tm">' + DE.ui.esc(String(e.at).slice(5, 16).replace("T", " ")) + "</td>" +
                '<td class="cat">' + cat.icon + " " + DE.ui.esc(cat.name) + "</td>" +
                '<td class="' + (e.delta > 0 ? "d-in" : "d-out") + '">' +
                  (e.delta > 0 ? "+" : "") + e.delta + "</td>" +
                '<td class="bal">' + e.balance + "</td>" +
                '<td class="nt">' + DE.ui.esc(e.note) + "</td>" +
                "</tr>";
            }).join("") + "</tbody></table></div>"
        : '<div class="empty"><span class="big">🧾</span>还没有金钱记录。<br>' +
          '<span class="hint">买东西、卖东西、发奖励都会自动记在这里。</span></div>');

    DE.ui.$$("[data-lgf]", container).forEach(function (x) {
      x.onclick = function () { FILTER = x.getAttribute("data-lgf"); draw(); };
    });
  }
  draw();
  DE.ui._ledgerPanels = DE.ui._ledgerPanels || [];
  DE.ui._ledgerPanels.push(draw);
  return { refresh: draw };
};
DE.ui.refreshLedgers = function () {
  (DE.ui._ledgerPanels || []).forEach(function (f) { try { f(); } catch (e) {} });
};

/* ============================================================
 *  状态值 UI（★10 = 状态绝佳）
 * ============================================================ */
DE.ui.STATUS_PRESETS = [
  { v: 12, name: "状态绝佳", icon: "🌟", desc: "高于 ★10，任意 1 个能力值上升 1 阶段" },
  { v: 10, name: "绝佳（★10）", icon: "✨", desc: "正好 ★10，一天状态绝佳" },
  { v: 8,  name: "正常", icon: "🙂", desc: "普通状态" },
  { v: 6,  name: "有点累", icon: "😮‍💨", desc: "疲劳，接近临界" },
  { v: 4,  name: "很差", icon: "🤒", desc: "状态低下" },
  { v: 2,  name: "濒危", icon: "🆘", desc: "刻度下限" }
];

/* ============================================================
 *  异常状态编辑器（角色卡总览用）
 *
 *  规则书 p74-p75：
 *   · 身体系：重伤（敏捷-1阶段）/ 中毒（体力-1阶段）/ 疾病（全能力-1阶段）
 *   · 精神系：萎靡（精神-1阶段）/ 激动（智力-1阶段）/ 失神（全能力-1阶段）
 *   · 每种带一个「数值」；次日的【状态判定】结果 ≥ 该数值 就恢复正常。
 *   · 状态糟糕（状态值 ≤2）的那天：从【重伤/中毒/萎靡/激动：4】里选 1 种。
 *
 *  这是**唯一**能录入异常状态的地方 —— 以前 c.statuses 只有存档摘要在读，
 *  谁都没有地方把它写进去。
 *  ============================================================ */
/* ============================================================
 *  异常状态卡的显隐 + 渲染（从 index.html 提出来，好让它可测）
 *
 *  规则：异常状态会压制能力值（规则书 p74-p75）。
 *
 
 * ============================================================ */
DE.ui.statusCard = function (opts) {
  opts = opts || {};
  var boxId = opts.box || "#statusEditor";
  var c = opts.character || (DE.store && DE.store.character);
  var box = DE.ui.$(boxId);
  var card = document.getElementById(opts.card || "statusCard");

  if (card) card.style.display = "";
  if (box) {
    box.style.display = "block";
    if (c) DE.ui.statusEditor(boxId, c, opts.onChange);
  }
  return { visible: true };
};

DE.ui.statusEditor = function (container, c, onChange) {
  /* ⚠️ 必须用 DE.ui.$ —— 调用方传的是 "#statusEditorCard"（带 #）。
     document.getElementById("#statusEditorCard") 会返回 null 并**静默什么都
     不做**（页面看上去就是"点不了"）。DE.ui.$ 两种写法都吃。 */
  var host = (typeof container === "string") ? DE.ui.$(container) : container;
  if (!host || !c) return;

  if (!Array.isArray(c.statuses)) c.statuses = [];

  function catOf(name) {
    var P = (DE.STATUSES && DE.STATUSES.physical) || [];
    var M = (DE.STATUSES && DE.STATUSES.mental) || [];
    if (P.some(function (x) { return x.name === name; })) return "physical";
    if (M.some(function (x) { return x.name === name; })) return "mental";
    return "physical";
  }
  function effectOf(name) {
    var all = ((DE.STATUSES && DE.STATUSES.physical) || [])
      .concat((DE.STATUSES && DE.STATUSES.mental) || []);
    var hit = all.filter(function (x) { return x.name === name; })[0];
    return hit ? hit.effect : "";
  }
  function derived() {
    try { return DE.derive ? DE.derive(c) : null; } catch (e) { return null; }
  }
  function statusNow() {
    var d = derived();
    return (d && d.status != null) ? d.status : 10;
  }
  /* 当前异常状态把各能力值压到了多少 —— 规则书 p74：降 1 阶段（下限 4） */
  function effAbilities() {
    if (DE.effAbilities) return DE.effAbilities(c);
    return { abilities: c.abilities || {}, down: {}, levels: {} };
  }
  /* 次日的状态判定 ≥ 数值 就恢复。
     预览用「当前状态值」当判定结果 —— 规则书里状态判定就是【体力+精神】，
     所以状态值就是这次判定的期望值；真结算时以输入框里的实际点数为准。 */
  function judgePreview() {
    var el = document.getElementById("stJudge");
    var v = parseInt((el && el.value) || "", 10);
    return isNaN(v) ? statusNow() : v;
  }
  function willRecover(st) {
    return judgePreview() >= (parseInt(st.value, 10) || 0);
  }

  function commit(msg) {
    DE.save(c);
    if (DE.archive) DE.archive.stashActive();
    render();
    if (onChange) onChange();
    if (msg) DE.ui.toast(msg, "ok");
  }

  /* 联动面板：异常状态把能力值降了多少 -> 派生数值跟着变了多少。
     注意别把局部变量取名为 derived —— 会把上面的 derived() 函数遮蔽掉。 */
  function linkBlock() {
    var e = effAbilities();
    var dv = derived();
    var downKeys = Object.keys(e.down || {});
    if (!downKeys.length) return "";
    var rows = downKeys.map(function (k) {
      var nm = (DE.ABILITY_KEYS.filter(function (x) { return x.key === k; })[0] || {}).name || k;
      var base = (c.abilities || {})[k];
      return '<span class="stdn">' + DE.ui.esc(nm) +
        ' <s>d' + base + '</s> \u2192 <b>d' + e.abilities[k] + "</b></span>";
    }).join("");
    var box = dv
      ? '<div class="stdnv">HP \u4e0a\u9650 <b>' + dv.hpMax + "</b>\u3000MP \u4e0a\u9650 <b>" + dv.mpMax +
        "</b>\u3000\u884c\u52a8\u503c <b>" + dv.action + "</b>\u3000\u72b6\u6001\u503c <b>" + dv.status +
        "</b>\uff08\u57fa\u7840 " + dv.conditionBase + "\uff09</div>"
      : "";
    return '<div class="stlink"><b>\u26a0\ufe0f \u5f02\u5e38\u72b6\u6001\u6b63\u5728\u538b\u5236\u80fd\u529b\u503c</b>' +
      '<div class="stdns">' + rows + "</div>" + box + "</div>";
  }

  function render() {
    c.statuses = c.statuses || [];
    var cur = c.statuses;
    var sn = statusNow();

    var chips = cur.length
      ? cur.map(function (st, i) {
          var ok = willRecover(st);
          return '<span class="stchip' + (ok ? " can" : "") + '" data-st="' + i + '" title="' +
            DE.ui.esc(effectOf(st.name) + "　次日的状态判定 ≥ " + st.value + " 就恢复") + '">' +
            (catOf(st.name) === "mental" ? "🧠 " : "🩹 ") + DE.ui.esc(st.name) +
            '<b class="v">：' + st.value + '</b>' +
            '<span class="need">≥' + st.value + "</span>" +
            '<span class="x" data-stx="' + i + '" title="移除">×</span></span>';
        }).join("")
      : '<span class="hint">目前没有异常状态。</span>';

    var recov = cur.filter(willRecover);
    var all = ((DE.STATUSES && DE.STATUSES.physical) || [])
      .concat((DE.STATUSES && DE.STATUSES.mental) || []);

    var out =
      '<div class="stbox">' +
        '<div class="sthd">' +
          '<b>异常状态</b>' +
          '<span class="hint">状态值 ' + sn +
            '　·　次日的【状态判定】≥ 数值 即恢复</span>' +
          (recov.length
            ? '<span class="badge teal" style="margin-left:auto">' + recov.length + ' 项可恢复</span>'
            : (cur.length ? '<span class="badge" style="margin-left:auto">' + cur.length + ' 项</span>' : "")) +
        "</div>" +
        '<div class="stlist">' + chips + "</div>" +
        linkBlock() +
        (cur.length
          ? '<div class="strec">' +
              '<b>次日的【状态判定】恢复</b>' +
              '<div class="hint">规则书 p74：次日的【状态判定】结果值 <b>≥ 数值</b> 就恢复正常。' +
                '把判定结果填进来，达到数值的会自动痊愈。</div>' +
              '<div class="btnrow" style="margin-top:6px;align-items:center">' +
                '<label class="inline hint">判定结果 ' +
                  '<input type="number" id="stJudge" value="' + sn + '" min="2" max="30" step="1" ' +
                  'style="width:64px;margin-left:5px"></label>' +
                '<button class="sm primary" data-stclear="1">🎲 判定并结算' +
                  (recov.length ? "（可痊愈 " + recov.length + " 项）" : "") + "</button>" +
                '<button class="sm ghost" data-stall="1" title="主持人判定用：直接按当前状态值结算">用状态值 ' + sn + ' 结算</button>' +
              "</div>" +
            "</div>"
          : "") +
        '<details class="stadd" data-stopen="' + (c._stOpen === false ? "0" : "1") +
          '"' + (c._stOpen === false ? "" : " open") + '>' +
          '<summary>🏷️ 选择要记录的异常状态（点一下加进去）</summary>' +
          '<div class="stform">' +
            all.map(function (a) {
              return '<button class="sm ghost" data-stadd="' + DE.ui.esc(a.name) + '" title="' +
                DE.ui.esc(a.effect) + '">' +
                (catOf(a.name) === "mental" ? "🧠 " : "🩹 ") + DE.ui.esc(a.name) + "</button>";
            }).join("") +
          "</div>" +
          '<div class="stform" style="margin-top:7px">' +
            '<label class="inline hint">数值 ' +
              '<input type="number" id="stVal" value="6" min="1" max="20" step="1" ' +
              'style="width:64px;margin-left:5px"></label>' +
            '<span class="hint">规则书里常见的是 4 和 6。数值越高越难恢复。</span>' +
          "</div>" +
          '<div class="hint" style="margin-top:5px">' +
            "状态糟糕（状态值 ≤2）的那天，从【重伤：4】【中毒：4】【萎靡：4】【激动：4】里选 1 种。" +
          "</div>" +
        "</details>" +
      "</div>";

    /* ⚠️ 不要每次都重设 innerHTML：
       页面每 20 秒 tick 一次，重设会把用户展开的 <details> 收起来，
       还会把正在点的按钮换掉（表现就是"点不了"）。内容没变就一个字节都不动。 */
    if (host._stHtml !== out) {
      host.innerHTML = out;
      host._stHtml = out;
      /* 记住用户有没有手动收起来，重建时还原（默认是展开的） */
      var det = host.querySelector(".stadd");
      if (det) det.addEventListener("toggle", function () {
        c._stOpen = !!det.open;
      });
    }

  function val() {
    var el = document.getElementById("stVal");
    return Math.max(1, Math.min(20, parseInt((el && el.value) || "6", 10) || 6));
  }
  DE.ui.$$("[data-stadd]", host).forEach(function (b) {
    b.onclick = function () {
      var nm = b.getAttribute("data-stadd");
      if (c.statuses.some(function (x) { return x.name === nm; })) {
        DE.ui.toast("已经有【" + nm + "】了。", "");
        return;
      }
      c.statuses.push({ name: nm, value: val(), type: catOf(nm) });
      commit("已记录【" + nm + "：" + val() + "】");
    };
  });
  DE.ui.$$("[data-stx]", host).forEach(function (x) {
    x.onclick = function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var i = parseInt(x.getAttribute("data-stx"), 10);
      var nm = (c.statuses[i] || {}).name || "";
      c.statuses.splice(i, 1);
      commit("已移除【" + nm + "】");
    };
  });
  /* 用「今天的状态判定结果」结算恢复。seed 给了就用它（方便测试与"用状态值结算"）。
     实际结算逻辑在 DE.statusJudgeSettle —— 判定器（首页 🎲）也调它，
     两处共用一份实现，避免规则漂移。 */
  function settle(seed) {
    var el = document.getElementById("stJudge");
    var rolled = (seed != null) ? seed : parseInt((el && el.value) || "", 10);
    var r = DE.statusJudgeSettle(c, rolled);
    if (!r.ok) { DE.ui.toast(r.msg, "err"); return; }
    if (!r.healed.length) {
      commit("判定 " + r.rolled + "：没有达到任何异常的数值，全部保留。");
    } else {
      commit("判定 " + r.rolled + "：痊愈 " + r.healed.join("、"));
    }
  }
  DE.ui.$$("[data-stclear]", host).forEach(function (b) {
    b.onclick = function () { settle(null); };
  });
  DE.ui.$$("[data-stall]", host).forEach(function (b) {
    b.onclick = function () { settle(statusNow()); };
  });
  /* 点标签可以改数值 */
  DE.ui.$$("[data-st]", host).forEach(function (sp) {
    sp.onclick = function (ev) {
      if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-stx") !== null) return;
      var i = parseInt(sp.getAttribute("data-st"), 10);
      var st = c.statuses[i];
      if (!st) return;
      var v = prompt("【" + st.name + "】的数值（次日的状态判定 ≥ 它 就恢复）：", st.value);
      if (v === null) return;
      var n = parseInt(v, 10);
      if (isNaN(n) || n < 1) { DE.ui.toast("数值要是 1 以上的整数。", "err"); return; }
      st.value = Math.min(20, n);
      commit("【" + st.name + "】数值改为 " + st.value);
    };
  });
}

render();
  return { render: render, count: function () { return c.statuses.length; } };
};

DE.ui.statusPanel = function (container, c, onChange) {
  if (!container) return;
  function canBoost() { return DE.canUsePerfectBoost && DE.canUsePerfectBoost(c); }
  function boostBlock() {
    if (!canBoost()) {
      if (!DE.raisableAbilities(c).length)
        return '<div class="boostbox done"><b>能力值已全部到顶</b>' +
          '<div class="hint">所有能力值都已经是 12（d12），没有可以再提升的阶段了。</div></div>';
      if (c.perfectBoostUsed)
        return '<div class="boostbox done"><b>✅ 今天的「提升能力值」已经用掉了</b>' +
          '<div class="hint">明天状态判定再次达到 ★10 时可以再用一次。</div>' +
          '<div class="btnrow" style="margin-top:7px">' +
          '<button class="sm ghost" data-boost="reset">↺ 重置（新的一天）</button></div></div>';
      return '<div class="boostbox off"><b>状态值低于 ★10</b>' +
        '<div class="hint">把状态值调到 <b>10 以上</b>（点上面的「🌟 状态绝佳」），' +
        '就能获得「任意 1 个能力值上升 1 阶段」的效果。</div></div>';
    }
    var list = DE.raisableAbilities(c);
    return '<div class="boostbox on"><b>★10 状态绝佳 · 任意 1 个能力值上升 1 阶段</b>' +
      '<div class="hint">规则书：能力值阶段为 4 → 6 → 8 → 10 → 12。选一个提升：</div>' +
      '<div class="boostopts">' +
        list.map(function (k) {
          var from = c.abilities[k.key], to = DE.abilityUp(from);
          return '<button class="bopt" data-boost="' + k.key + '">' +
            "<b>" + DE.ui.esc(k.name) + "</b>" +
            '<span class="stg">d' + from + " → <b>d" + to + "</b></span></button>";
        }).join("") +
        '<button class="bopt auto" data-boost="auto">' +
          "<b>🎲 让系统挑一个</b><span class='stg'>优先提升最低的能力值</span></button>" +
      "</div>" +
      '<div class="btnrow" style="margin-top:8px">' +
        '<button class="sm ghost" data-boost="skip">先不用</button>' +
        '<span class="hint" style="margin-left:6px">用掉之后，明天状态判定再来。</span>' +
      "</div></div>";
  }

  function draw() {
    var d = DE.derive(c);
    var v = d.status, pct = Math.round((v - 2) / 18 * 100);
    container.innerHTML =
      '<div class="statusbox">' +
        '<div class="statusdial' + (d.statusPerfect ? " perfect" : "") + '" style="--p:' + pct + '">' +
          '<div class="inner"><span class="num">' + v + "</span>" +
            '<span class="of">/ 20　刻度 2~20</span>' +
            (d.statusPerfect ? '<span class="tag">★ 状态绝佳</span>' : "") +
          "</div></div>" +
        '<div class="statusopts">' +
          DE.ui.STATUS_PRESETS.map(function (p) {
            return '<div class="sopt' + (v === p.v ? " on" : "") + '" data-status="' + p.v + '">' +
              "<b>" + p.icon + " " + p.name + "</b>" +
              '<span class="n">状态值 ' + p.v + "</span>" +
              '<div class="d">' + p.desc + "</div></div>";
          }).join("") +
        "</div>" +
      "</div>" +
      boostBlock() +
      '<div class="btnrow" style="margin-top:11px">' +
        '<button class="sm" data-status="+1">＋1</button>' +
        '<button class="sm" data-status="-1">−1</button>' +
        '<button class="sm ghost" data-status="set">直接设定…</button>' +
        '<span class="hint" style="margin-left:6px">状态值 = 体力 + 精神，达到 <b>★10</b> 即为一天状态绝佳。</span>' +
      "</div>";

    /* ★10 状态绝佳：提升能力值 */
    DE.ui.$$("[data-boost]", container).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-boost");
        if (k === "skip") { DE.ui.toast("留着以后用。只要状态值还在 ★10 以上，随时可以回来点。", ""); return; }
        if (k === "reset") {
          c.perfectBoostUsed = false;
          DE.save(c); DE.ui.toast("已重置（新的一天）。", "ok");
          draw(); if (onChange) onChange(); return;
        }
        if (k === "auto") {
          var pick = DE.bestAbilityToRaise(c);
          if (!pick) { DE.ui.toast("所有能力值都已经到顶了。", "err"); return; }
          k = pick;
        }
        var r = DE.raiseAbility(c, k);
        if (!r.ok) { DE.ui.toast(r.msg, "err"); return; }
        c.perfectBoostUsed = true;
        DE.save(c);
        DE.ui.toast(r.msg, "ok");
        draw();
        if (onChange) onChange();
      };
    });

    DE.ui.$$("[data-status]", container).forEach(function (x) {
      x.onclick = function () {
        var k = x.getAttribute("data-status");
        if (k === "set") {
          var s = prompt("设定状态值（2 ~ 20）", String(v));
          if (s === null) return;
          var n = parseInt(s, 10);
          if (isNaN(n)) { DE.ui.toast("请输入数字。", "err"); return; }
          apply(n);
          return;
        }
        if (k === "+1") return apply(v + 1);
        if (k === "-1") return apply(v - 1);
        apply(parseInt(k, 10));
      };
    });
  }
  function apply(n) {
    n = Math.max(2, Math.min(20, n));
    c.status = n;
    DE.save(c);
    DE.ui.toast("状态值设为 " + n + (n >= 10 ? "（★ 状态绝佳）" : "") + "。", "ok");
    draw();
    if (onChange) onChange();
  }
  draw();
  DE.ui._statusPanels = DE.ui._statusPanels || [];
  DE.ui._statusPanels.push(draw);
  return { refresh: draw };
};

/* ============================================================
 *  游戏时间 —— 弹窗（不再占据页面版面）
 * ============================================================ */
/* 把「刚刚推进时结算的补给」转成一句提示（没有结算就返回空串） */
DE.ui.supplyToast = function () {
  var r = DE.clock.lastSupply;
  if (!r || !r.days) return "";
  var parts = [];
  parts.push("消耗 " + r.days + " 天份食物和水");
  if (r.foodUsed || r.waterUsed)
    parts.push("（食物 " + r.foodUsed + "、水 " + r.waterUsed + "）");
  var msg = parts.join("");
  if (r.foodShortDays || r.waterShortDays) {
    var lack = [];
    if (r.foodShortDays) lack.push("口粮不足");
    if (r.waterShortDays) lack.push("水不足");
    msg += "　⚠ " + lack.join("、") + " → 所有判定 -" + r.penalty +
           "（减值每天累计，直到补给为止）";
  } else {
    msg += "　剩余：食物 " + r.foodLeft + " 天 / 水 " + r.waterLeft + " 天";
  }
  return msg;
};

DE.ui.openClockDialog = function (onChange) {
  var ADV = [
    { h: 1, label: "＋1 小时" }, { h: 4, label: "＋4 小时" }, { h: 8, label: "＋8 小时" },
    { h: 24, label: "＋1 天" }, { h: 72, label: "＋3 天" }, { h: 168, label: "＋7 天" }
  ];
  var box = DE.ui.modal("⏱ 游戏时间", '<div class="clockdlg" id="clockDlgBody"></div>',
    [{ label: "关闭", cls: "ghost" }]);
  var body = box.el.querySelector("#clockDlgBody");

  function draw() {
    var h = DE.clock.elapsedHours();
    var day = Math.floor((h + 8) / 24) + 1;
    var hh = Math.floor((8 + h) % 24), mm = Math.floor(((8 + h) * 60) % 60);
    body.innerHTML =
      '<div class="bigclock"><div class="d">第 ' + day + ' 天</div>' +
        '<div class="t">' + String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + "</div>" +
        '<div class="n">手动推进 · 与现实时间无关</div></div>' +
      "<h4>推进时间</h4>" +
      '<div class="advgrid">' + ADV.map(function (a) {
        return '<button class="sm" data-cadv="' + a.h + '">' + a.label + "</button>";
      }).join("") + "</div>" +
      '<div class="btnrow"><button class="sm ghost" data-cadv="-1">−1 小时</button>' +
        '<button class="sm ghost" data-cadv="-24">−1 天</button></div>' +
      "<h4>直接设定</h4>" +
      '<div class="setrow">' +
        '<label class="fld" style="margin:0"><span>第几天</span>' +
          '<input type="number" id="cdDay" min="1" step="1" value="' + day + '"></label>' +
        '<label class="fld" style="margin:0"><span>时</span>' +
          '<input type="number" id="cdH" min="0" max="23" step="1" value="' + hh + '"></label>' +
        '<label class="fld" style="margin:0"><span>分</span>' +
          '<input type="number" id="cdM" min="0" max="59" step="1" value="' + mm + '"></label>' +
      "</div>" +
      '<div class="btnrow"><button class="sm primary" id="cdSet">跳到这个时刻</button>' +
        '<button class="sm ghost" id="cdReset">↺ 回到第 1 天 08:00</button></div>' +
      '<div class="hint" style="margin-top:10px">药草 / 食材的保质期按这个时间计算：' +
        "未装瓶 <b>24 小时</b>，装入〈药草瓶〉<b>7 天</b>。</div>";

    DE.ui.$$("[data-cadv]", body).forEach(function (b) {
      b.onclick = function () {
        var hv = parseFloat(b.getAttribute("data-cadv"));
        DE.clock.advance(hv);
        var sup = DE.ui.supplyToast();
        DE.ui.toast((hv > 0 ? DE.ui.clockAdvanceMsg(hv) :
          ("游戏时间回退 " + Math.abs(hv) + " 小时，现在是 " + DE.clock.label() + "。")) +
          (sup ? "　" + sup : ""),
          (DE.clock.lastSupply && DE.clock.lastSupply.penalty) ? "err" : "ok");
        after();
      };
    });
    var setB = body.querySelector("#cdSet");
    if (setB) setB.onclick = function () {
      var d = parseInt(body.querySelector("#cdDay").value, 10) || 1;
      var hh2 = parseInt(body.querySelector("#cdH").value, 10) || 0;
      var mm2 = parseInt(body.querySelector("#cdM").value, 10) || 0;
      if (hh2 < 0 || hh2 > 23 || mm2 < 0 || mm2 > 59) {
        DE.ui.toast("时分的范围是 0~23 / 0~59。", "err"); return;
      }
      var cur = DE.clock.elapsedHours();
      var target = (d - 1) * 24 + (hh2 - 8) + mm2 / 60;
      DE.clock.advance(target - cur);
      var sup3 = DE.ui.supplyToast();
      DE.ui.toast("游戏时间已设为 " + DE.clock.label() + "。" + (sup3 ? "　" + sup3 : ""),
        (DE.clock.lastSupply && DE.clock.lastSupply.penalty) ? "err" : "ok");
      after();
    };
    var rst = body.querySelector("#cdReset");
    if (rst) rst.onclick = function () {
      DE.ui.confirm({ title: "重置游戏时间", okText: "重置",
        body: "回到第 1 天 08:00。所有药草的保质期会按新时间重新计算，确定吗？" })
        .then(function (ok) {
          if (!ok) return;
          DE.clock.reset();
          /* 用户明确重置：把缺粮/缺水的累计也清掉（第 1 天不可能已经饿了三天） */
          if (DE.clock.clearSupplyState) DE.clock.clearSupplyState();
          DE.ui.toast("游戏时间已重置。", "ok");
          after();
        });
    };
  }
  function after() {
    draw();
    DE.ui.refreshClocks();
    if (onChange) onChange();
    /* ⚠️ 关键：游戏时间变了，**页面上所有依赖时间的东西都必须重算** ——
       药草保质期、过期提醒、背包列表、保质期横幅全靠 DE.onTick 重渲染。
       以前这里只刷了时钟控件文字，所以推进时间后药草显示的还是旧值，
       看起来就像"保质期根本没在算"。 */
    try { DE.ui.tick(); } catch (e) {}
  }
  draw();
  return box;
};

/* 顶部时钟条上的「时间」按钮：打开弹窗并显示当前时间 */
DE.ui.clockButton = function (el) {
  if (!el) return;
  function draw() {
    el.textContent = "⏱ " + DE.clock.label();
  }
  el.title = "打开游戏时间控件（手动推进）";
  el.onclick = function (ev) {
    ev.preventDefault();
    DE.ui.openClockDialog(function () { draw(); });
  };
  draw();
  DE.ui._clockButtons = DE.ui._clockButtons || [];
  DE.ui._clockButtons.push(draw);
  return { refresh: draw };
};
DE.ui.refreshClockButtons = function () {
  (DE.ui._clockButtons || []).forEach(function (f) { try { f(); } catch (e) {} });
};
