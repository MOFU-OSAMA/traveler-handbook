/* ============================================================
 *  龙蛋物语 — 存档管理界面（存档箱）
 *  所有页面共用：DE.saves.panel(container)
 *  ============================================================ */
window.DE = window.DE || {};

DE.saves = (function () {

  function fmtTime(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
             " " + p(d.getHours()) + ":" + p(d.getMinutes());
    } catch (e) { return "—"; }
  }

function kindLabel() { return "🧑‍🌾 旅行者"; }

  /* 职业名 */
  function profName(id) {
    var p = (DE.PROFESSIONS || []).filter(function (x) { return x.id === id; })[0];
    return p ? p.name : (id || "—");
  }

  function card(s) {
    var ab = s.abilities || {};
    var bar = function (v, max, cls) {
      var pct = max ? Math.round(v / max * 100) : 0;
      return '<div class="sv-bar"><i class="' + (cls || "") + '" style="width:' +
        Math.max(0, Math.min(100, pct)) + '%"></i></div>';
    };
    return '<div class="sv-card' + (s.isActive ? " on" : "") + '" data-sv="' + DE.ui.esc(s.slotId) + '">' +
      '<div class="sv-h">' +
        '<span class="sv-kind">' + kindLabel() + "</span>" +
        (s.isActive ? '<span class="badge teal">当前</span>' : "") +
        (s.hasPortrait ? '<span class="badge">有立绘</span>' : "") +
      "</div>" +
      '<div class="sv-n">' + DE.ui.esc(s.name || "（未命名）") + "</div>" +
      '<div class="sv-m">' +
        profName(s.profession) + "　等级 " + s.level +
        (s.player ? "　玩家 " + DE.ui.esc(s.player) : "") +
      "</div>" +
      '<div class="sv-stats">' +
        "<span>HP <b>" + (s.hp == null ? "—" : s.hp) + "/" + (s.hpMax == null ? "—" : s.hpMax) + "</b></span>" +
        "<span>MP <b>" + (s.mp == null ? "—" : s.mp) + "/" + (s.mpMax == null ? "—" : s.mpMax) + "</b></span>" +
        "<span>状态 <b>" + (s.status == null ? "—" : s.status) + "</b>" +
          (s.statusPerfect ? " ★" : "") + "</span>" +
        "<span>金币 <b>" + s.money + "</b></span>" +
      "</div>" +
      '<div class="sv-ab">体力 ' + (ab.str || "?") + "　敏捷 " + (ab.agi || "?") +
        "　智力 " + (ab.int || "?") + "　精神 " + (ab.spr || "?") + "</div>" +
      '<div class="sv-f">' +
        "<span>" + fmtTime(s.updatedAt) + "</span>" +
        '<span class="sv-acts">' +
          (s.isActive ? "" : '<button class="sm primary" data-svuse="' + DE.ui.esc(s.slotId) + '">切换</button>') +
          '<button class="sm ghost" data-svren="' + DE.ui.esc(s.slotId) + '">改名</button>' +
          '<button class="sm ghost" data-svdup="' + DE.ui.esc(s.slotId) + '">复制</button>' +
          '<button class="sm ghost" data-svexp="' + DE.ui.esc(s.slotId) + '">导出</button>' +
          '<button class="sm danger" data-svdel="' + DE.ui.esc(s.slotId) + '">删除</button>' +
        "</span>" +
      "</div>" +
    "</div>";
  }

  /* ---------- 面板 ---------- */
  /* opts: { onSwitch: fn, compact:bool } */
  /* ⚠️ 面板里所有选择器都必须限定在 el 之内。
     以前用文档级 DE.ui.$$("[data-svuse]")，在测试用的 DOM shim 里
     （只认 document 直属节点）查不到，按钮就静默不绑定 —— 点了没反应。 */
  function panel(container, opts) {
    opts = opts || {};
    var el = typeof container === "string" ? DE.ui.$(container) : container;
    if (!el) return;
    var ix = DE.archive.index();
    var all = DE.archive.list();
    var activeId = ix.active;

    el.innerHTML =
      '<div class="sv-top">' +
        '<span class="badge">共 <b>' + all.length + "</b> 个存档</span>" +
        '<span class="badge teal" id="svActiveName">当前：' + DE.ui.esc(
          (all.filter(function (s) { return s.isActive; })[0] || {}).name || "无") + "</span>" +
        '<span style="margin-left:auto"></span>' +
        '<button class="sm primary" id="svNewT">＋ 新建旅行者</button>' +
        '<button class="sm ghost" id="svImport">导入 JSON</button>' +
        '<input type="file" id="svFile" accept=".json,application/json" style="display:none">' +
      "</div>" +
      (all.length
        ? '<div class="sv-grid">' + all.map(card).join("") + "</div>"
        : '<div class="empty"><span class="big">🗃️</span>还没有存档。<br>' +
          '<span class="hint">点「＋ 新建旅行者」开始。</span></div>');

    /* 新建旅行者 */
    DE.ui.$("#svNewT", el).onclick = function () {
      var name = prompt("新旅行者的名字？（可以留空，之后再改）", "");
      if (name === null) return;
      var c = DE.newCharacter({ name: name || "" });
      var r = DE.archive.add(c);
      if (!r.ok) { DE.ui.toast(r.msg, "err"); return; }
      switchTo(r.id, opts, "已新建旅行者〈" + (name || "未命名") + "〉");
    };

    /* 切换 */
    DE.ui.$$("[data-svuse]", el).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-svuse");
        DE.archive.stashActive();                    // 先把当前角色存回去
        var r = DE.archive.activate(id);
        if (!r.ok) { DE.ui.toast(r.msg, "err"); return; }
        switchTo(id, opts, "已切换到〈" + (r.character.name || "未命名") + "〉", true);
      };
    });
    function switchTo(id, o, msg, alreadyActive) {
      if (!alreadyActive) { DE.archive.stashActive(); DE.archive.activate(id); }
      DE.ui.toast(msg + "　正在重新载入…", "ok");
      setTimeout(function () { location.reload(); }, 550);
    }

    /* 改名 */
    DE.ui.$$("[data-svren]", el).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-svren");
        var s = DE.archive.getSlot(id) || {};
        var cur = s.name || "";
        var name = prompt("新名字：", cur);
        if (name === null || name === cur) return;
        var r = DE.archive.rename(id, name);
        if (!r.ok) { DE.ui.toast(r.msg, "err"); return; }
        DE.ui.toast("已改名。", "ok");
        panel(el, opts);
      };
    });
    /* 复制 */
    DE.ui.$$("[data-svdup]", el).forEach(function (b) {
      b.onclick = function () {
        var r = DE.archive.duplicate(b.getAttribute("data-svdup"));
        if (!r.ok) { DE.ui.toast(r.msg, "err"); return; }
        DE.ui.toast("已复制存档。", "ok");
        panel(el, opts);
      };
    });
    /* 导出 */
    DE.ui.$$("[data-svexp]", el).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-svexp");
        var txt = DE.archive.exportSlot(id);
        if (!txt) { DE.ui.toast("导出失败。", "err"); return; }
        var s = DE.archive.getSlot(id) || {};
        var blob = new Blob([txt], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "龙蛋角色卡_" + (s.name || id) + ".json";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
        DE.ui.toast("已导出 JSON，可以发给别人导入。", "ok");
      };
    });
    /* 删除 */
    DE.ui.$$("[data-svdel]", el).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-svdel");
        var s = DE.archive.getSlot(id) || {};
        DE.ui.confirm({
          title: "删除存档",
          body: "确定删除〈" + DE.ui.esc(s.name || "未命名") + "〉吗？这个存档的背包、金币、手账都不会保留。",
          okText: "删除"
        }).then(function (ok) {
          if (!ok) return;
          var wasActive = (DE.archive.active() === id);
          var r = DE.archive.remove(id);
          if (!r.ok) { DE.ui.toast(r.msg, "err"); return; }
          DE.ui.toast("已删除。", "ok");
          if (wasActive) setTimeout(function () { location.reload(); }, 400);
          else panel(el, opts);
        });
      };
    });
    /* 导入 */
    DE.ui.$("#svImport", el).onclick = function () { DE.ui.$("#svFile").click(); };
    DE.ui.$("#svFile", el).onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var r = DE.archive.importSlot(String(fr.result || ""));
        if (!r.ok) { DE.ui.toast(r.msg, "err"); return; }
        DE.ui.toast(r.msg || "已导入。", "ok");
        panel(el, opts);
      };
      fr.readAsText(f);
      this.value = "";
    };
  }

  /* ---------- 顶部小按钮：显示当前角色，点开存档箱 ---------- */
  function button() {
    var ix = DE.archive.index();
    var s = DE.archive.list().filter(function (x) { return x.isActive; })[0];
    return '<button class="sm ghost" id="svBtn" title="存档箱：切换 / 新建 / 导出角色卡">' +
      "🗃️ " + DE.ui.esc((s && s.name) || "存档") + "</button>";
  }
  function bindButton() {
    var b = DE.ui.$("#svBtn");
    if (!b) return;
    b.onclick = function () { openDialog(); };
  }

  /* ---------- 弹窗版存档箱 ---------- */
  function openDialog() {
    var box = DE.ui.$("#svDialog");
    if (box) box.parentNode.removeChild(box);
    var ov = DE.ui.el("div", { id:"svDialog",
      style:"position:fixed;inset:0;background:rgba(40,32,22,.55);z-index:400;" +
            "display:flex;align-items:flex-start;justify-content:center;padding:26px;overflow:auto" });
    ov.innerHTML = '<div class="card" style="max-width:1000px;width:100%;margin:0">' +
      '<h2>🗃️ 存档箱<span class="hint" style="font-weight:400;margin-left:8px">' +
        '每个存档是独立的角色卡（背包 / 金币 / 手账都跟着走）</span>' +
        '<span style="margin-left:auto"></span>' +
        '<button class="sm ghost" id="svClose">关闭</button></h2>' +
      '<div id="svPanel"></div></div>';
    document.body.appendChild(ov);
    DE.ui.$("#svClose").onclick = function () { ov.parentNode.removeChild(ov); };
    ov.onclick = function (ev) { if (ev.target === ov) ov.parentNode.removeChild(ov); };
    panel(DE.ui.$("#svPanel"), { reload: function () { openDialog(); } });
  }

  return {
    panel: panel,
    button: button,
    bindButton: bindButton,
    openDialog: openDialog,
    fmtTime: fmtTime,
    kindLabel: kindLabel,
    profName: profName
  };
})();
