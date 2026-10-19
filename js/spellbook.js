/* ============================================================
 *  龙蛋物语 — 咒语书
 *  一般魔法（咒语）学习 / 季节魔法 / MP 记录
 *  ============================================================ */
DE.ui.bootPage({ after: function () {
  var $ = DE.ui.$;
  var c = DE.store.character;
  var TAB = "learn";              // learn | all | seasonal
  var TIER = "all";
  var OPEN = {};                  // 展开的咒语编号
  /* 筛选条件 */
  var F = { q: "", chant: "all", mp: "all", sort: "no" };
  var QUICK = [];                 // 快捷筛选（预设）

  function persist() { return DE.save(c); }

  /* MP 逻辑统一走 DE.mpNow / DE.setMP —— 首页生命值卡用的是同一套，
     两边读写 c.mpCurrent 同一个字段，蓝条天然联动。 */
  function mpMax() { return DE.mpMaxOf(c); }
  function mpNow() { return DE.mpNow(c); }
  function setMp(v) {
    DE.setMP(c, v);
    persist();
    render();
  }

  /* ---------- 施法者状态 ---------- */
  function renderCaster() {
    var d = DE.derive(c);
    var e = DE.char.talentEffects(c);
    var type = DE.TYPES.filter(function (t) { return t.id === c.talent; })[0];
    var prof = DE.PROFESSIONS.filter(function (p) { return p.id === c.profession; })[0];
    $("#casterBox").innerHTML =
      '<div class="statgrid">' +
        '<div class="stat"><div class="k">角色</div><div class="v" style="font-size:15px">' +
          DE.ui.esc(c.name || "（未命名）") + "</div></div>" +
        '<div class="stat"><div class="k">等级</div><div class="v">' + (c.level || 1) + "</div></div>" +
        /* 注意：DE.derive() 不返回 spr，能力值要从 c.abilities 取 */
        '<div class="stat"><div class="k">精神</div><div class="v">' +
          (c.abilities ? c.abilities.spr : "—") + "</div></div>" +
        '<div class="stat"><div class="k">MP 上限</div><div class="v">' + d.mpMax + "</div></div>" +
        '<div class="stat"><div class="k">特长</div><div class="v" style="font-size:14px">' +
          (type ? DE.ui.esc(type.name) : "—") + "</div></div>" +
        '<div class="stat"><div class="k">职业</div><div class="v" style="font-size:14px">' +
          (prof ? DE.ui.esc(prof.name) : "—") + "</div></div>" +
      "</div>" +
      '<div class="hint" style="margin-top:9px">可学 ' + DE.SPELL_RULE.tierForLevel(c.level || 1) +
        "魔法（角色等级 " + (c.level || 1) + "）" +
        (e.seasonMagic ? "　·　特长「季节之法」已掌握季节魔法" : "") + "</div>";

    var max = d.mpMax, now = mpNow();
    var pct = max ? Math.round(now / max * 100) : 0;
    var bar = $("#mpBar");
    bar.className = "mpbar" + (now === 0 ? " empty" : (pct <= 25 ? " low" : ""));
    $("#mpFill").style.width = pct + "%";
    $("#mpLeft").innerHTML = "MP <b>" + now + " / " + max + "</b>";
    $("#mpRight").textContent = now === 0 ? "已耗尽" : (pct <= 25 ? "所剩不多" : "状态良好");
  }

  /* ---------- 咒语栏位 ---------- */
  function renderSlots() {
    var si = DE.spellSlotInfo(c);
    var bd = DE.SPELL_RULE.slotBreakdown(c);
    var talentName = (DE.TYPES.filter(function (t) { return t.id === c.talent; })[0] || {}).name;

    /* 没有「咒语书」特长就没有咒语栏位 —— 说清原因，别只显示 0 */
    if (!bd.hasBook) {
      $("#slotBox").innerHTML =
        '<div class="hint">当前特长是「' + DE.ui.esc(talentName || "未选") +
        '」，<b>没有「咒语书」能力</b>，所以没有咒语栏位。</div>' +
        '<div class="hint" style="margin-top:8px">咒语魔法只有魔法特长的「咒语书」才能获得：' +
        "每个等级 2 个。想学咒语请把特长改成<b>魔法</b>。</div>";
      return;
    }
    var pips = "";
    for (var i = 0; i < si.total; i++) {
      pips += '<span class="slotpip' + (i < si.used ? (si.over && i >= si.total ? " over" : " used") : "") +
        '">' + (i < si.used ? "✦" : "") + "</span>";
    }
    var learned = DE.knownGeneral(c);
    $("#slotBox").innerHTML =
      '<div style="font-size:13px;margin-bottom:8px">已用 <b style="color:' +
        (si.over ? "#b0473c" : "var(--teal-dk)") + '">' + si.used + " / " + si.total + "</b>" +
        (si.over ? '　<span style="color:#b0473c">超出栏位</span>' : "") + "</div>" +
      /* 栏位怎么算出来的 —— 免得看不出数量是怎么来的 */
      '<div class="hint" style="margin:-2px 0 9px">等级 <b>' + bd.level +
        "</b> × 每级 <b>" + bd.perLevel + "</b> 个 = <b>" + bd.total + "</b> 个栏位" +
        '（规则书 p40：1 级学 2 个，之后每升 1 级再学 2 个）</div>' +
      '<div class="slotlist">' + pips + "</div>" +
      (learned.length
        ? '<div style="margin-top:11px">' + learned.map(function (m) {
            return '<div class="learnedrow"><span class="n">' + DE.ui.esc(m.name) + "</span>" +
              '<span class="mp">' + m.mp + " MP</span>" +
              '<button class="sm ghost" data-forget="' + m.no + '" title="划掉">✕</button></div>';
          }).join("") + "</div>"
        : '<div class="hint" style="margin-top:10px">还没有学会任何咒语。</div>');

    DE.ui.$$("[data-forget]").forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var r = DE.forgetSpell(c, parseInt(b.getAttribute("data-forget"), 10));
        persist();
        DE.ui.toast(r.msg, r.ok ? "ok" : "err");
        render();
      };
    });
  }

  /* ---------- 季节魔法 ---------- */
  function renderSeason() {
    var tiers = DE.SPELL_RULE.seasonalTiers(c);
    var has = tiers.length > 0;
    var known = DE.knownSeasonal(c);
    $("#seasonBox").innerHTML =
      (has
        ? '<div class="hint" style="margin-bottom:8px">已自动获得 ' + tiers.join(" / ") + "季节魔法。</div>"
        : '<div class="hint" style="margin-bottom:8px">需要特长「季节之法」才能掌握季节魔法。</div>') +
      '<div class="seasonpick" style="margin-bottom:9px">' +
        DE.seasons.map(function (s) {
          return '<span class="sp' + (c.seasonMagic === s ? " on" : "") + '" data-season="' + s + '">' +
            s + "</span>";
        }).join("") +
      "</div>" +
      (has && c.seasonMagic
        ? '<div style="font-size:12.5px">' + (known.length
            ? known.map(function (m) { return '<div class="learnedrow"><span class="n">' +
                DE.ui.esc(m.name) + '</span><span class="mp">' + m.mp + " MP</span></div>"; }).join("")
            : '<span class="hint">这一季还没有对应档位的魔法。</span>') + "</div>"
        : '<div class="hint">' + (has ? "先选一个季节。" : "") + "</div>");

    DE.ui.$$("[data-season]").forEach(function (x) {
      x.onclick = function () {
        c.seasonMagic = x.getAttribute("data-season");
        persist(); render();
        DE.ui.toast("季节魔法已设为「" + c.seasonMagic + "」。", "ok");
      };
    });
  }

  /* ---------- 页签 ---------- */
  function renderTabs() {
    var si = DE.spellSlotInfo(c);
    var tabs = [
      { id: "learn", label: "🎓 可学咒语", n: "" },
      { id: "all", label: "📚 全部一般魔法", n: DE.GENERAL_MAGIC.length },
      { id: "seasonal", label: "🌦️ 季节魔法", n: DE.SEASONAL_MAGIC.length }
    ];
    $("#sbTabs").innerHTML = tabs.map(function (t) {
      return '<span class="tb' + (TAB === t.id ? " on" : "") + '" data-tab="' + t.id + '">' +
        t.label + (t.n !== "" ? '<span class="n">' + t.n + "</span>" : "") + "</span>";
    }).join("") +
    (TAB !== "seasonal"
      ? '<span style="margin-left:auto"></span>' +
        ["all", "初级", "中级", "高级"].map(function (x) {
          return '<span class="tb' + (TIER === x ? " on" : "") + '" data-tier="' + x + '">' +
            (x === "all" ? "全部等级" : x) + "</span>";
        }).join("")
      : "");
    DE.ui.$$("[data-tab]").forEach(function (x) {
      x.onclick = function () { TAB = x.getAttribute("data-tab"); render(); };
    });
    DE.ui.$$("[data-tier]").forEach(function (x) {
      x.onclick = function () { TIER = x.getAttribute("data-tier"); render(); };
    });
    if (TAB === "seasonal") $("#sbTabs").style.flexWrap = "wrap";
  }

  /* ---------- 筛选 ---------- */
  function mpInRange(mp, range) {
    if (range === "all") return true;
    var p = range.split("-");
    return mp >= parseInt(p[0], 10) && mp <= parseInt(p[1], 10);
  }
  function matchFilter(m) {
    if (F.q) {
      var hay = (m.name + " " + m.effect + " " + (m.target || "") + " " + (m.range || "") +
        " " + (m.duration || "") + " " + (m.season || "")).toLowerCase();
      if (hay.indexOf(F.q) < 0) return false;
    }
    if (F.chant !== "all" && m.chant !== F.chant) return false;
    if (!mpInRange(m.mp, F.mp)) return false;
    /* 快捷预设 */
    for (var i = 0; i < QUICK.length; i++) {
      var q = QUICK[i];
      if (q === "heal" && !/回复|治愈|治疗|伤势|HP/.test(m.effect)) return false;
      if (q === "buff" && !/加值|判定\】\+/.test(m.effect)) return false;
      if (q === "camp" && !/野营/.test(m.effect)) return false;
      if (q === "travel" && !/移动|方向|地形|天气|道路/.test(m.effect)) return false;
      if (q === "battle" && !/伤害|命中|攻击|武器|战斗/.test(m.effect)) return false;
      if (q === "cheap" && m.mp > 2) return false;
    }
    return true;
  }
  function sortList(list) {
    var out = list.slice();
    if (F.sort === "mp") out.sort(function (a, b) { return a.mp - b.mp || a.no - b.no; });
    else if (F.sort === "mpdesc") out.sort(function (a, b) { return b.mp - a.mp || a.no - b.no; });
    else if (F.sort === "name") out.sort(function (a, b) { return a.name.localeCompare(b.name, "zh-CN"); });
    else out.sort(function (a, b) { return a.no - b.no; });
    return out;
  }
  function filterActive() {
    return !!(F.q || F.chant !== "all" || F.mp !== "all" || QUICK.length);
  }

  /* ---------- 筛选 UI ---------- */
  var QUICK_DEF = [
    { id: "heal",   label: "💚 回复系" },
    { id: "buff",   label: "⬆️ 判定加值" },
    { id: "battle", label: "⚔️ 战斗用" },
    { id: "travel", label: "🧭 旅行用" },
    { id: "camp",   label: "⛺ 野营用" },
    { id: "cheap",  label: "🪙 2 MP 以下" }
  ];
  function renderFilter() {
    var chants = {};
    DE.GENERAL_MAGIC.concat(DE.SEASONAL_MAGIC).forEach(function (m) { chants[m.chant] = 1; });
    var sel = $("#fchant");
    var cur = sel.value || "all";
    sel.innerHTML = '<option value="all">全部咏唱</option>' +
      Object.keys(chants).sort().map(function (x) {
        return '<option value="' + DE.ui.esc(x) + '">' + DE.ui.esc(x) + "</option>";
      }).join("");
    sel.value = F.chant;

    sel.onchange = function () { F.chant = sel.value; renderList(); };
    $("#fmp").onchange = function () { F.mp = this.value; renderList(); };
    $("#fsort").onchange = function () { F.sort = this.value; renderList(); };
    var q = $("#fq");
    if (q && q.value !== F.q) q.value = F.q;
    if (q) q.oninput = function () { F.q = this.value.trim().toLowerCase(); renderList(); };

    $("#fquick").innerHTML = QUICK_DEF.map(function (x) {
      return '<span class="cw' + (QUICK.indexOf(x.id) >= 0 ? " on" : "") + '" data-quick="' + x.id +
        '">' + x.label + "</span>";
    }).join("") +
    (filterActive() ? '<span class="cw" data-quick="__clear" style="border-color:#d9a89c;color:#b0473c">' +
      '✕ 清除全部筛选</span>' : "");

    DE.ui.$$("[data-quick]").forEach(function (x) {
      x.onclick = function () {
        var id = x.getAttribute("data-quick");
        if (id === "__clear") { F = { q: "", chant: "all", mp: "all", sort: F.sort }; QUICK = []; }
        else {
          var k = QUICK.indexOf(id);
          if (k >= 0) QUICK.splice(k, 1); else QUICK.push(id);
        }
        renderFilter(); renderList();
      };
    });
  }

  /* ---------- 一张咒语卡 ---------- */
  function spellCard(m, learned, locked, why) {
    var open = !!OPEN[m.no];
    var lvCls = m.level === "初级" ? "lv1" : (m.level === "中级" ? "lv2" : "lv3");
    return '<div class="spellcard' + (learned ? " learned" : "") + (locked ? " locked" : "") +
      (open ? " open" : "") + '" data-spell="' + m.no + '">' +
      '<div class="top"><span class="no">#' + m.no + "</span>" +
        '<span class="nm">' + DE.ui.esc(m.name) + "</span>" +
        '<span class="mp">' + m.mp + " MP</span></div>" +
      '<div class="tags">' +
        '<span class="tg ' + lvCls + '">' + DE.ui.esc(m.level) + "</span>" +
        '<span class="tg chant">咏唱 ' + DE.ui.esc(m.chant) + "</span>" +
        '<span class="tg">' + DE.ui.esc(m.target) + "</span>" +
        '<span class="tg">射程 ' + DE.ui.esc(m.range) + "</span>" +
        (m.season ? '<span class="tg season">' + DE.ui.esc(m.season) + "</span>" : "") +
      "</div>" +
      '<div class="eff">' + DE.ui.esc(m.effect) + "</div>" +
      (!open ? '<div class="more">▾ 展开全文</div>' : '<div class="more">▴ 收起</div>') +
      '<div class="hint" style="margin-top:5px">持续 ' + DE.ui.esc(m.duration) + "</div>" +
      (why ? '<div class="why">' + DE.ui.esc(why) + "</div>" : "") +
      "</div>";
  }

  function tierHead(name, list) {
    return '<div class="tierhead"><h3>' + name + '</h3><span class="badge">' + list.length +
      " 个</span><span class=\"ln\"></span></div>";
  }

  /* ---------- 列表 ---------- */
  function renderList() {
    var box = $("#spellList");
    var lv = c.level | 0 || 1;

    if (TAB === "seasonal") {
      var bySeason = DE.seasonalBySeason();
      var tiers = DE.SPELL_RULE.seasonalTiers(c);
      box.innerHTML = DE.seasons.map(function (s) {
        var g = bySeason[s] || {};
        var html = '<div class="tierhead"><h3>' + s + "之魔法</h3>" +
          (tiers.length && c.seasonMagic === s
            ? '<span class="badge teal">已掌握 ' + tiers.join("/") + "</span>" : "") +
          '<span class="ln"></span></div>';
        ["初级", "中级", "高级"].forEach(function (t) {
          var list = sortList((g[t] || []).filter(matchFilter));
          if (!list.length) return;
          if (TIER !== "all" && TIER !== t) return;
          var mine = c.seasonMagic === s && tiers.indexOf(t) >= 0;
          html += '<div class="hint" style="margin:8px 0 7px">' + t + "（" + list.length + " 个）" +
            (mine ? "　✅ 你已掌握" : (tiers.indexOf(t) >= 0 ? "　选择这个季节即可掌握" : "")) + "</div>";
          html += '<div class="spellgrid">' + list.map(function (m) {
            return spellCard(m, mine, false, "");
          }).join("") + "</div>";
        });
        return html;
      }).join("");
      bindCards();
      return;
    }

    var all = DE.GENERAL_MAGIC.filter(matchFilter);
    var out = "";
    if (!all.length) {
      box.innerHTML = '<div class="empty"><span class="big">🔍</span>没有符合条件的魔法。<br>' +
        '<span class="hint">试着放宽筛选条件，或点「清除全部筛选」。</span></div>';
      $("#fcount").innerHTML = "<b>0</b> 个结果";
      return;
    }
    ["初级", "中级", "高级"].forEach(function (t) {
      if (TIER !== "all" && TIER !== t) return;
      var list = sortList(all.filter(function (m) { return m.level === t; }));
      if (!list.length) return;
      var need = DE.SPELL_RULE.minLevelFor(t);
      out += tierHead(t, list) +
        (lv < need ? '<div class="hint" style="margin:-3px 0 9px;color:#b0473c">需要角色等级 ' +
          need + "（当前 " + lv + " 级）</div>"
          : '<div class="hint" style="margin:-3px 0 9px">已解锁</div>') +
        '<div class="spellgrid">' + list.map(function (m) {
          var learned = (c.spells || []).indexOf(m.no) >= 0;
          var chk = DE.canLearn(c, m.no);
          var locked = !learned && !chk.ok;
          return spellCard(m, learned, locked, locked ? chk.msg : "");
        }).join("") + "</div>";
    });
    box.innerHTML = out;
    var mine = all.filter(function (m) { return (c.spells || []).indexOf(m.no) >= 0; }).length;
    $("#fcount").innerHTML = "共 <b>" + all.length + "</b> 个结果" +
      (filterActive() ? "（已筛选，全部 " + DE.GENERAL_MAGIC.length + " 个）" : "") +
      "　·　其中已学会 <b>" + mine + "</b> 个";
    bindCards();
  }

  function bindCards() {
    DE.ui.$$("[data-spell]").forEach(function (el) {
      el.onclick = function () {
        var no = parseInt(el.getAttribute("data-spell"), 10);
        var m = DE.GENERAL_MAGIC.concat(DE.SEASONAL_MAGIC).filter(function (x) { return x.no === no; })[0];
        if (!m) return;
        var isSeason = DE.SEASONAL_MAGIC.indexOf(m) >= 0;
        if (isSeason) {
          OPEN[no] = !OPEN[no];
          renderList();
          return;
        }
        var learned = (c.spells || []).indexOf(no) >= 0;
        /* 单击：已学 -> 展开/收起；未学 -> 直接尝试学会 */
        if (!learned) {
          var r = DE.learnSpell(c, no);
          persist();
          DE.ui.toast(r.msg, r.ok ? "ok" : "err");
          render();
          return;
        }
        OPEN[no] = !OPEN[no];
        renderList();
      };
    });
  }

  /* ---------- MP 按钮 ---------- */
  DE.ui.$$("[data-mp]").forEach(function (b) {
    b.onclick = function () {
      var v = b.getAttribute("data-mp");
      if (v === "rest") {
        setMp(mpMax());
        DE.ui.toast("休息完毕，MP 已回满。", "ok");
        return;
      }
      if (v === "set") {
        var s = prompt("设定当前 MP（0 ~ " + mpMax() + "）", String(mpNow()));
        if (s === null) return;
        var n = parseInt(s, 10);
        if (isNaN(n)) { DE.ui.toast("请输入数字。", "err"); return; }
        setMp(n);
        return;
      }
      var cost = Math.abs(parseInt(v, 10));
      var now = mpNow();
      if (now < cost) {
        DE.ui.toast("MP 不足：需要 " + cost + "，当前只有 " + now + "。", "err");
        return;
      }
      setMp(now - cost);
      DE.ui.toast("已消耗 " + cost + " MP，剩余 " + mpNow() + "。", "ok");
    };
  });

  function render() {
    renderCaster(); renderSlots(); renderSeason(); renderTabs(); renderFilter(); renderList();
    DE.ui.expiryBanner($("#expiryBanner"));
  }

  /* 别的标签页改了存档（比如首页生命值卡扣了蓝）→ 重新读档并重绘蓝条。
     两边读写的是同一个 c.mpCurrent，所以这里读到的就是最新值。 */
  DE.ui.onCharacterChanged(function (fresh) { c = fresh; render(); });
  DE.onTick = function () { renderCaster(); };
  render();
}});
