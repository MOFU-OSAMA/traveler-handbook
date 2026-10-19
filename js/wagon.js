/* ============================================================
 *  龙蛋物语 — 马车页
 *  买车 / 房间增设与升级 / 家具摆放 / 外部设施 / 加值汇总
 *  ============================================================ */
DE.ui.bootPage({ after: function () {
  var $ = DE.ui.$;
  var c = DE.store.character;
  var w = DE.wagon.ensure(c);

  var CAT = "interior";        // interior | exterior
  var PICK = null;             // 当前选中的家具 id（点格子摆放）
  var ROOM = null;             // null = 看马车外部图；数字 = 进入第 N 间房
  var SELPID = null;           // 房间里当前选中的那件家具

  function persist() { return DE.save(c); }
  function save() { persist(); render(); }
  function money() { return DE.ui.money(c.money); }

  /* ---------- 顶部状态 ---------- */
  function renderTop() {
    var st = DE.wagon.stats(w);
    var chips = '<div class="wg-chip">💰 金币 <b>' + c.money + " G</b></div>";
    if (st.has) {
      chips += '<div class="wg-chip">' + st.type.icon + " " + DE.ui.esc(st.type.name) + "</div>";
      chips += '<div class="wg-chip">房间 <b>' + st.rooms + "/" + st.type.maxRooms + "</b></div>";
      chips += '<div class="wg-chip">格子 <b>' + st.grid + "×" + st.grid + "</b></div>";
      chips += '<div class="wg-chip">已摆放 <b>' + st.used + "/" + st.cells + "</b></div>";
      chips += '<div class="wg-chip gold">累计投入 <b>' + st.invested + " G</b></div>";
    } else {
      chips += '<div class="wg-chip">还没有马车</div>';
    }
    $("#wgTop").innerHTML =
      "<h2>🐴 " + (st.has ? DE.ui.esc(st.type.name) : "马车之旅") + "</h2>" +
      '<div class="sub">' + (st.has
        ? DE.ui.esc(st.type.desc)
        : "买一辆马车，路上会舒服很多 —— 疲劳大幅降低，还能带上家具与设施。") + "</div>" +
      '<div class="wg-line">' + chips + "</div>";
  }

  /* ---------- 车种卡片 ---------- */
  function renderTypes() {
    $("#wgTypes").innerHTML = DE.wagon.TYPES.map(function (t) {
      var afford = (c.money || 0) >= t.price;
      return '<div class="wg-t">' +
        '<div class="ph"><span class="tagline">' +
          (t.canAddRooms ? "可增设 " + (t.maxRooms - t.startRooms) + " 间" : "不可增设房间") +
          (t.canUpgradeRoom ? " · 可升级" : "") + "</span>" + t.icon + "</div>" +
        '<div class="bd">' +
          "<h3>" + DE.ui.esc(t.name) + "</h3>" +
          '<div class="price">' + t.price + " G　<span style=\"color:var(--d-dim);font-weight:400\">租 " +
            t.rentPerDay + " G / 天</span></div>" +
          '<div class="spec">' +
            "<span>最小动物数</span><b>" + DE.ui.esc(t.animals) + "</b>" +
            "<span>最大乘员数</span><b>" + t.seats + " 人</b>" +
            "<span>尺寸 / 装载量</span><b>" + t.size + " / " + DE.ui.esc(t.capacity) + "</b>" +
            "<span>初始房间</span><b>" + t.startRooms + " 间（3×3）</b>" +
          "</div>" +
          '<div class="bonus">' + t.bonuses.map(function (b) {
            return "<span>" + DE.ui.esc(b) + "</span>";
          }).join("") + "</div>" +
          '<div class="desc">' + DE.ui.esc(t.desc) + "</div>" +
          '<button class="wg-btn ' + (afford ? "primary" : "") + '" data-buytype="' + t.id + '"' +
            (afford ? "" : " disabled") + ">" +
            (afford ? "买下 " + t.price + " G" : "金币不足") + "</button>" +
        "</div></div>";
    }).join("");
    DE.ui.$$("[data-buytype]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-buytype");
        var t = DE.wagon.findType(id);
        DE.ui.confirm({ title: "购买马车", okText: "买下（" + t.price + " G）",
          body: "买下〈" + t.name + "〉会花掉 " + t.price + " 金币（不含动物），并附赠 " +
                t.startRooms + " 间 " + DE.wagon.roomSpec(1).label + "。" })
          .then(function (ok) {
            if (!ok) return;
            var r = DE.wagon.buyType(c, w, id);
            DE.ui.toast(r.msg, r.ok ? "ok" : "err");
            if (r.ok) save();
          });
      };
    });
  }

  /* ---------- 像素房间资源 ---------- */
  var ART = {
    room: { 3: "assets/wagon/room-3x3.png", 4: "assets/wagon/room-4x4.png" },
    /* 家具贴图（从用户画的那张图里切出来的） */
    furn: {
      chair:     "assets/wagon/furniture/chair.png",
      workbench: "assets/wagon/furniture/workbench.png",
      cooking:   "assets/wagon/furniture/cooking.png",
      bed:       "assets/wagon/furniture/bed.png"
    },
    /* 贴图原始像素尺寸（从用户画的图里切出来的）—— 用来保持比例 */
    fsize: {
      chair:     { w: 33, h: 68 },
      workbench: { w: 49, h: 73 },
      cooking:   { w: 93, h: 86 },
      bed:       { w: 92, h: 68 }
    }
  };
  /* 底图里地板区域的几何（像素，基于原始 PNG） */
  var GEO = {
    3: { cell: 34, fx: 18, fy: 65 },     /* room-3x3.png 130x180 */
    4: { cell: 32, fx: 18, fy: 65 }      /* room-4x4.png 165x213 */
  };
  var SCALE = { 3: 2, 4: 2 };            /* 放大倍数（像素风整数放大） */

  /* ---------- 房间 ---------- */
  /* 车身上的一个房间段（外部图里的一块） */
  function roomSeg(rm, ri) {
    var t = DE.wagon.findType(w.type);
    var kind = DE.wagon.findRoomKind(rm.kind);
    var used = DE.wagon.placementsOf(rm).length;
    var cur = ROOM === ri ? " cur" : "";
    /* 初始房间不给「拆」——拆了就没地方住了 */
    var canSell = t && ri >= (t.startRooms || 1);
    return '<div class="rm' + cur + '" data-enter="' + ri + '" title="点击进入这间房">' +
      '<span class="who">' + used + " 件</span>" +
      (canSell ? '<span class="rmdel" data-sellroom="' + ri +
        '" title="拆除这间房（退还一半）">×</span>' : "") +
      '<span class="ic">' + kind.icon + "</span>" +
      '<span class="lb">' + DE.ui.esc(DE.wagon.roomName(rm)) + "</span>" +
      '<span class="sz">' + rm.grid + "×" + rm.grid + "</span></div>";
  }

  /* 还没有建的空位（可添加房间的名额） */
  function emptySlots() {
    var t = DE.wagon.findType(w.type);
    if (!t || !t.canAddRooms) return "";
    var st = DE.wagon.stats(w);
    var out = "";
    for (var i = 0; i < st.addLeft; i++) {
      out += '<div class="slot" data-addslot="1" title="添加房间（' +
        DE.wagon.roomSpec(w.upgradeLevel).price + ' G）">＋<span>添加房间</span></div>';
    }
    for (var k = 0; k < st.addUsed; k++) { /* 已用的名额不显示 */ }
    return out;
  }

  /* 马车外部图 */
  function renderExterior() {
    var t = DE.wagon.findType(w.type);
    if (!t) return;
    var spec = DE.wagon.roomSpec(w.upgradeLevel);
    $("#wgGridHint").textContent = spec.label;
    var st = DE.wagon.stats(w);

    $("#wgRooms").innerHTML =
      '<div class="wgex">' +
        '<div class="exwrap">' +
          '<div class="cart">' +
            w.rooms.map(roomSeg).join("") + emptySlots() +
          "</div>" +
          '<div class="wheels"><i></i><i></i></div>' +
        "</div>" +
        '<div class="cap">' + t.icon + " <b>" + DE.ui.esc(t.name) + "</b>　" +
          "房间 <b>" + w.rooms.length + "/" + t.maxRooms + "</b>　" +
          "可添加 <b>" + st.addLeft + "/" + st.addSlots + "</b>　" +
          "升级 <b>" + st.upgradeLeft + "/" + st.upgradeSlots + "</b><br>" +
          "<b>点车厢里的房间就能进去摆放家具，进去后点房间名可以改名。</b>" +
          (t.canAddRooms ? "" : "（" + DE.ui.esc(t.name) + "不能增添房间，但可以升级这间）") +
        "</div>" +
      "</div>";

    DE.ui.$$("[data-enter]").forEach(function (el) {
      var ri = parseInt(el.getAttribute("data-enter"), 10);
      el.onclick = function (ev) {
        var tg = ev && ev.target;
        if (tg && tg.getAttribute && tg.getAttribute("data-sellroom") !== null) return;
        ROOM = ri;
        renderRooms();
      };
    });
    DE.ui.$$("[data-sellroom]").forEach(function (b) {
      b.onclick = function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        askSellRoom(parseInt(b.getAttribute("data-sellroom"), 10));
      };
    });
    DE.ui.$$("[data-addslot]").forEach(function (el) {
      el.onclick = function () { askAddRoom(); };
    });
  }

  /* 请求拆除一间房 */
  function askSellRoom(ri) {
    var t = DE.wagon.findType(w.type);
    var rm = w.rooms[ri];
    if (!t || !rm) return;
    var back = DE.wagon.refundOf(DE.wagon.roomPrice(w, ri));
    var used = DE.wagon.placementsOf(rm).length;
    if (used) {
      DE.ui.toast("〈" + DE.wagon.roomName(rm) + "〉里还有 " + used +
        " 件家具，先把它们收起来再拆。", "err");
      return;
    }
    DE.ui.confirm({ title: "拆除房间",
      okText: "拆除（退还 " + back + " G）",
      body: "拆掉〈" + DE.wagon.roomName(rm) + "〉（" + rm.grid + "×" + rm.grid +
        "），退还 " + back + " G，「可添加房间」名额也会退回来。\n" +
        "这一间房的名字和装修都会消失，确定吗？" })
      .then(function (ok) {
        if (!ok) return;
        var r = DE.wagon.sellRoom(c, w, ri);
        DE.ui.toast(r.msg, r.ok ? "ok" : "err");
        if (r.ok) { if (ROOM === ri) ROOM = null; save(); }
      });
  }

  /* 请求房间降级 */
  function askDowngrade() {
    var back = DE.wagon.refundOf(DE.wagon.ROOM_COST.upgrade);
    DE.ui.confirm({ title: "房间降级",
      okText: "降回 3×3（退还 " + back + " G）",
      body: "把每间房从 4×4 降回 3×3，退还 " + back + " G（升级费的一半），" +
        "「升级房间」名额也会退回来。\n" +
        "放不下的家具会自动收进仓库（不会丢）。确定吗？" })
      .then(function (ok) {
        if (!ok) return;
        var r = DE.wagon.downgradeRooms(c, w);
        DE.ui.toast(r.msg, r.ok ? "ok" : "err");
        if (r.ok) save();
      });
  }

  /* 请求增设房间 */
  function askAddRoom() {
    var t = DE.wagon.findType(w.type);
    var spec = DE.wagon.roomSpec(w.upgradeLevel);
    var price = w.rooms.length > t.startRooms ? spec.price : DE.wagon.ROOM_COST.base;
    DE.ui.confirm({ title: "添加房间", okText: "添加（" + price + " G）",
      body: "为〈" + t.name + "〉添加一间 " + spec.label + "（" + price + " G）。" })
      .then(function (ok) {
        if (!ok) return;
        var r = DE.wagon.addRoom(c, w, "storage");
        DE.ui.toast(r.msg, r.ok ? "ok" : "err");
        if (r.ok) save();
      });
  }

  /* 单个房间的内部 —— 像素风：底图 + 可拖拽 / 旋转的家具贴图 */
  function renderRoomInner(ri) {
    var t = DE.wagon.findType(w.type);
    var rm = w.rooms[ri];
    if (!rm) { ROOM = null; return renderExterior(); }
    var kind = DE.wagon.findRoomKind(rm.kind);
    var g = GEO[rm.grid] || GEO[3];
    var sc = SCALE[rm.grid] || 2;
    var artW = rm.grid === 4 ? 165 : 130;
    var artH = rm.grid === 4 ? 213 : 180;
    var visW = artW * sc, visH = artH * sc;
    var cell = g.cell * sc;
    function PX(v) { return (v * sc / visW * 100) + "%"; }
    function PY(v) { return (v * sc / visH * 100) + "%"; }
    function PW(v) { return (v * sc / visW * 100) + "%"; }
    function PH(v) { return (v * sc / visH * 100) + "%"; }

    /* 每个格子被哪件家具占着 */
    var posMap = {};
    DE.wagon.placementsOf(rm).forEach(function (p) {
      var fp = DE.wagon.footprint(p.itemId, p.rot);
      for (var dy = 0; dy < fp.h; dy++)
        for (var dx = 0; dx < fp.w; dx++)
          posMap[p.c + dx + "," + (p.r + dy)] = p;
    });

    /* 地板格（点击摆放 / 选中） */
    var cells = [];
    for (var r = 0; r < rm.grid; r++) {
      for (var c = 0; c < rm.grid; c++) {
        cells.push('<div class="fc" data-px="1" data-c="' + c + '" data-r="' + r + '" ' +
          'style="left:' + PX(g.fx + c * g.cell) + ";top:" + PY(g.fy + r * g.cell) +
          ";width:" + PW(g.cell) + ";height:" + PH(g.cell) + '" title="第 ' + (c + 1) +
          " 列 · 第 " + (r + 1) + ' 行"></div>');
      }
    }

    /* 家具贴图 */
    var sprites = [];
    DE.wagon.placementsOf(rm).forEach(function (p) {
      var it = DE.wagon.findItem(p.itemId);
      var src = ART.furn[p.itemId];
      if (!it || !src) return;
      var fp = DE.wagon.footprint(p.itemId, p.rot);
      var boxW = fp.w * g.cell, boxH = fp.h * g.cell;
      /* 按原图比例缩放并居中，避免拉伸变形 */
      var fs = ART.fsize[p.itemId] || { w: 1, h: 1 };
      var k = Math.min(boxW / fs.w, boxH / fs.h);
      var iw = fs.w * k, ih = fs.h * k;
      var offX = (boxW - iw) / 2, offY = (boxH - ih) / 2;
      var sel = (SELPID === p.pid);
      sprites.push('<div class="pf' + (sel ? " sel" : "") + '" data-pf="' + p.pid + '" ' +
        'style="left:' + PX(g.fx + p.c * g.cell) + ";top:" + PY(g.fy + p.r * g.cell) +
        ";width:" + PW(boxW) + ";height:" + PH(boxH) + ";z-index:" + (10 + (p.r * 10 + p.c)) + '">' +
        '<img src="' + src + '" alt="' + DE.ui.esc(it.name) + '" ' +
          'style="position:absolute;left:' + (offX / boxW * 100) + "%;top:" + (offY / boxH * 100) +
          "%;width:" + (iw / boxW * 100) + "%;height:" + (ih / boxH * 100) +
          "%;transform:rotate(" + (p.rot || 0) + 'deg)">' +
        '<span class="rot" data-rot="' + p.pid + '" title="旋转 90°">⟳</span>' +
        '<span class="del" data-del="' + p.pid + '" title="收起">×</span>' +
        '<span class="grip">拖动摆放</span></div>');
    });

    var used = 0;
    DE.wagon.placementsOf(rm).forEach(function (p) {
      var fp = DE.wagon.footprint(p.itemId, p.rot);
      used += fp.w * fp.h;
    });
    var total = rm.grid * rm.grid;
    var pct = total ? Math.round(used / total * 100) : 0;

    $("#wgRooms").innerHTML =
      '<div class="wgin-bar">' +
        '<button class="back" id="wgBack">← 回到马车外部</button>' +
        (function () {
          var tt = DE.wagon.findType(w.type);
          if (!tt || ri < (tt.startRooms || 1)) return "";
          return '<button class="back danger" id="wgSellRoom" ' +
            'title="拆除这间房，退还一半">🗑 拆除这间</button>';
        })() +
        '<span class="ti">' + kind.icon + " " +
          '<span id="wgRoomNameTxt" title="点一下可以改名" style="border-bottom:1px dashed var(--d-dim);cursor:text">' +
            DE.ui.esc(DE.wagon.roomName(rm)) + "</span>" +
          '<input id="wgRoomName" maxlength="' + DE.wagon.ROOM_NAME_MAX + '" ' +
            'placeholder="' + DE.ui.esc(kind.name) + '" ' +
            'value="' + DE.ui.esc(rm.name || "") + '" ' +
            'style="display:none;width:150px" ' +
            'title="最多 ' + DE.wagon.ROOM_NAME_MAX + ' 个字，留空恢复房型名">' +
          '<span style="font-size:11.5px;color:var(--d-dim);margin-left:8px">第 ' +
            (ri + 1) + " 间</span></span>" +
        '<span class="wg-chip" style="font-size:11.5px">每间房 ' + rm.grid + "×" + rm.grid + "</span>" +
        '<select class="wg-btn sm" id="wgKind">' + DE.wagon.ROOM_KINDS.map(function (k) {
          return '<option value="' + k.id + '"' + (k.id === rm.kind ? " selected" : "") + ">" +
            k.icon + " " + DE.ui.esc(k.name) + "</option>";
        }).join("") + "</select>" +
        '<span class="wg-chip" style="font-size:11.5px;margin-left:auto">占用 <b>' + used + "/" +
          total + "</b></span>" +
      "</div>" +
      '<div class="pixroom-wrap"><div class="pixroom" id="pixroom" ' +
        'style="width:' + visW + "px;height:" + visH + 'px">' +
        '<img class="floorart" src="' + ART.room[rm.grid] + '" alt="房间" ' +
          'style="width:' + visW + "px;height:" + visH + 'px">' +
        cells.join("") + sprites.join("") +
      "</div></div>" +
      '<div class="hint" style="text-align:center;color:var(--d-dim);margin-top:10px">' +
        (PICK
          ? "已选中〈" + DE.ui.esc((DE.wagon.findItem(PICK) || {}).name || "") +
            "〉 —— 把鼠标移到房间里再松手即可摆放。"
          : "在下面的目录里点「摆放」，然后拖到房间里；" +
            "<b>拖动</b>家具可换位置，悬停出现 <b>⟳ 旋转</b> 与 <b>× 收起</b>。") +
      "</div>";

    $("#wgBack").onclick = function () { ROOM = null; SELPID = null; renderRooms(); };
    if ($("#wgSellRoom")) $("#wgSellRoom").onclick = function () { askSellRoom(ri); };

    /* 改名：点名字 -> 变输入框；回车 / 失焦保存，Esc 取消 */
    var nameTxt = $("#wgRoomNameTxt"), nameInp = $("#wgRoomName");
    function commitName() {
      if (!nameInp) return;
      var res = DE.wagon.setRoomName(w, rm, nameInp.value);
      DE.ui.toast(res.msg, res.ok ? "ok" : "err");
      if (res.ok) save();
      else renderRoomInner(ri);      /* 名字太长：退回原状，不写坏数据 */
    }
    function editName(on) {
      if (!nameTxt || !nameInp) return;
      nameTxt.style.display = on ? "none" : "";
      nameInp.style.display = on ? "" : "none";
      if (on) { nameInp.value = rm.name || ""; nameInp.focus(); if (nameInp.select) nameInp.select(); }
    }
    if (nameTxt) nameTxt.onclick = function () { editName(true); };
    if (nameInp) {
      nameInp.onkeydown = function (ev) {
        ev = ev || {};
        if (ev.key === "Enter") commitName();
        else if (ev.key === "Escape") { editName(false); renderRoomInner(ri); }
      };
      nameInp.onblur = function () { commitName(); };
    }
    $("#wgKind").onchange = function () { w.rooms[ri].kind = this.value; save(); };

    var box = $("#pixroom");
    if (!box) return;

    /* 客户端坐标 -> 格子 */
    function cellFrom(clientX, clientY) {
      var rect = box.getBoundingClientRect();
      var scale = rect.width / artW;
      var px = (clientX - rect.left) / scale;
      var py = (clientY - rect.top) / scale;
      var c = Math.round((px - g.fx - g.cell / 2) / g.cell);
      var r = Math.round((py - g.fy - g.cell / 2) / g.cell);
      return { c: Math.max(0, Math.min(rm.grid - 1, c)),
               r: Math.max(0, Math.min(rm.grid - 1, r)) };
    }
    function clearGhost() {
      DE.ui.$$(".fc.ghost", box).forEach(function (x) { x.classList.remove("ghost"); });
    }
    function ghost(c, r) {
      clearGhost();
      var el = DE.ui.$$('.fc[data-c="' + c + '"][data-r="' + r + '"]', box)[0];
      if (el) el.classList.add("ghost");
    }

    /* 拖拽放置（目录里已选中家具） */
    var placing = null;
    box.addEventListener("mousedown", function (ev) {
      if (!PICK) return;
      if (ev.target.getAttribute && ev.target.getAttribute("data-rot")) return;
      if (ev.target.getAttribute && ev.target.getAttribute("data-del")) return;
      if (ev.target.closest && ev.target.closest("[data-pf]")) return;
      ev.preventDefault();
      placing = true;
      var g0 = cellFrom(ev.clientX, ev.clientY);
      ghost(g0.c, g0.r);
    });
    box.addEventListener("mousemove", function (ev) {
      if (!placing) return;
      var g1 = cellFrom(ev.clientX, ev.clientY);
      ghost(g1.c, g1.r);
    });
    document.addEventListener("mouseup", function (ev) {
      if (!placing) return;
      placing = null;
      var g2 = cellFrom(ev.clientX, ev.clientY);
      var rect = box.getBoundingClientRect();
      var inside = ev.clientX >= rect.left && ev.clientX <= rect.right &&
                   ev.clientY >= rect.top && ev.clientY <= rect.bottom;
      clearGhost();
      if (!inside || !PICK) return;
      var res = DE.wagon.addPlacement(w, rm, PICK, g2.c, g2.r, 0);
      DE.ui.toast(res.msg, res.ok ? "ok" : "err");
      if (res.ok) {
        SELPID = res.placement.pid;
        if (DE.wagon.stockQty(w, PICK) <= 0) PICK = null;
      }
      save();
    });

    /* 空格点击：没选家具时提示 */
    DE.ui.$$("[data-px]", box).forEach(function (el) {
      el.addEventListener("click", function () {
        if (PICK) return;
        var c = parseInt(el.getAttribute("data-c"), 10);
        var r = parseInt(el.getAttribute("data-r"), 10);
        var p = posMap[c + "," + r];
        if (p) { SELPID = p.pid; renderRoomInner(ri); return; }
        DE.ui.toast("先在目录里点「摆放」选一件家具。", ""); 
      });
    });

    /* 拖动已有家具 */
    DE.ui.$$("[data-pf]", box).forEach(function (el) {
      var pid = el.getAttribute("data-pf");
      el.addEventListener("mousedown", function (ev) {
        if (ev.target.getAttribute && (ev.target.getAttribute("data-rot") ||
            ev.target.getAttribute("data-del"))) return;
        ev.preventDefault(); ev.stopPropagation();
        var p = DE.wagon.findPlacement(rm, pid);
        if (!p) return;
        SELPID = pid;
        el.classList.add("drag");
        var grab = { c: p.c, r: p.r };
        var g3 = cellFrom(ev.clientX, ev.clientY);
        var offC = g3.c - p.c, offR = g3.r - p.r;
        function mv(e2) {
          var g4 = cellFrom(e2.clientX, e2.clientY);
          ghost(g4.c - offC, g4.r - offR);
        }
        function up(e2) {
          document.removeEventListener("mousemove", mv);
          document.removeEventListener("mouseup", up);
          el.classList.remove("drag");
          clearGhost();
          var g5 = cellFrom(e2.clientX, e2.clientY);
          var res = DE.wagon.movePlacement(w, rm, pid, g5.c - offC, g5.r - offR, p.rot);
          if (!res.ok) {
            DE.ui.toast(res.msg, "err");
            /* 放不下就回到原位，不留半截状态 */
            DE.wagon.movePlacement(w, rm, pid, grab.c, grab.r, p.rot);
            renderRoomInner(ri);
            return;
          }
          save();
        }
        document.addEventListener("mousemove", mv);
        document.addEventListener("mouseup", up);
      });
    });

    /* 旋转 / 收起 */
    DE.ui.$$("[data-rot]", box).forEach(function (b) {
      b.addEventListener("mousedown", function (ev) { ev.stopPropagation(); });
      b.onclick = function (ev) {
        ev.stopPropagation();
        var r2 = DE.wagon.rotatePlacement(w, rm, b.getAttribute("data-rot"));
        DE.ui.toast(r2.msg, r2.ok ? "ok" : "err");
        if (r2.ok) save(); else renderRoomInner(ri);
      };
    });
    DE.ui.$$("[data-del]", box).forEach(function (b) {
      b.addEventListener("mousedown", function (ev) { ev.stopPropagation(); });
      b.onclick = function (ev) {
        ev.stopPropagation();
        var pid = b.getAttribute("data-del");
        var p = DE.wagon.findPlacement(rm, pid);
        if (!p) return;
        var res = DE.wagon.takeAt(w, rm, p.c, p.r);
        DE.ui.toast(res.msg, res.ok ? "ok" : "err");
        if (SELPID === pid) SELPID = null;
        if (res.ok) save();
      };
    });
  }

  function renderRooms() {
    var t = DE.wagon.findType(w.type);
    if (!t) return;
    var spec = DE.wagon.roomSpec(w.upgradeLevel);
    var st0 = DE.wagon.stats(w);

    /* 顶部按钮：加房 / 升级 / 收起 */
    var addTxt = t.canAddRooms
      ? "＋ 添加房间（" + st0.addUsed + "/" + st0.addSlots + "　" +
        (w.rooms.length > t.startRooms ? spec.price : DE.wagon.ROOM_COST.base) + " G）"
      : "✕ 无法添加房间";
    var upTxt = "⬆ 升级房间 " + spec.size + "×" + spec.size + " → 4×4（" +
      st0.upgradeUsed + "/" + st0.upgradeSlots + "　" + DE.wagon.ROOM_COST.upgrade + " G）";
    $("#wgRoomBtns").innerHTML =
      '<span class="wg-chip" style="font-size:11.5px">房间 <b>' + w.rooms.length + "/" +
        t.maxRooms + "</b></span>" +
      '<button class="wg-btn sm" data-room="add"' +
        (!t.canAddRooms || st0.addLeft <= 0 ? " disabled" : "") + ">" + addTxt + "</button>" +
      '<button class="wg-btn sm gold" data-room="upgrade"' +
        (st0.upgradeLeft <= 0 || w.upgradeLevel >= 2 ? " disabled" : "") + ">" + upTxt + "</button>" +
      '<button class="wg-btn sm" data-room="clear">🧹 全部收起</button>' +
      '<button class="wg-btn sm" data-room="downgrade"' +
        (w.upgradeLevel < 2 ? " disabled" : "") +
        ' title="把每间房降回 3×3，退还升级费的一半">⬇ 房间降级（退 ' +
        DE.wagon.refundOf(DE.wagon.ROOM_COST.upgrade) + ' G）</button>';

    DE.ui.$$("[data-room]").forEach(function (b) {
      b.onclick = function () {
        var act = b.getAttribute("data-room");
        if (act === "clear") {
          var n = DE.wagon.clearAll(w);
          DE.ui.toast(n ? "收起了 " + n + " 格家具。" : "房间里本来就没有东西。", n ? "ok" : "");
          save(); return;
        }
        if (act === "upgrade") {
          DE.ui.confirm({ title: "升级房间", okText: "升级（" + DE.wagon.ROOM_COST.upgrade + " G）",
            body: "把每间房从 " + spec.size + "×" + spec.size + " 升级为 4×4。" +
                  "房间里的家具会保留（超出范围的会收进仓库）。" })
            .then(function (ok) {
              if (!ok) return;
              var r = DE.wagon.upgradeRooms(c, w);
              DE.ui.toast(r.msg, r.ok ? "ok" : "err");
              if (r.ok) save();
            });
          return;
        }
        if (act === "add") askAddRoom();
        if (act === "downgrade") askDowngrade();
      };
    });

    if (ROOM === null || ROOM === undefined || !w.rooms[ROOM]) {
      ROOM = null;
      renderExterior();
    } else {
      renderRoomInner(ROOM);
    }
  }

  /* ---------- 目录 ---------- */
  function renderCat() {
    var list = DE.wagon.itemsOf(CAT);
    $("#wgCat").innerHTML = list.map(function (it) {
      var stock = DE.wagon.stockQty(w, it.id);
      var owned = DE.wagon.ownedQty(w, it.id);
      var on = PICK === it.id;
      return '<div class="wg-c"' + (on ? ' style="border-color:var(--d-amber);box-shadow:0 0 0 1px rgba(232,176,75,.35)"' : "") + ">" +
        '<div class="hd"><span class="ic">' + it.icon + "</span>" +
          '<span class="n"><b>' + DE.ui.esc(it.name) + "</b>" +
          '<span class="k">' + DE.ui.esc(it.kind === "fixture" ? "设施" : "家具") +
          (it.cells ? "　尺寸 " + it.cells + " 格子" : "　不占格子") + "</span></span>" +
          '<span class="pr">' + it.price + " G</span></div>" +
        '<div class="ef">' + DE.ui.esc(it.effect) + "</div>" +
        '<div class="ft">' +
          '<span class="stock' + (stock > 0 ? "" : " zero") + '">库存 <b>' + stock + "</b>" +
            (owned ? " / 共 " + owned : "") + "</span>" +
          '<button class="wg-btn sm ' + (stock > 0 ? "primary" : "") + '" data-buy="' + it.id +
            '"' + ((c.money || 0) >= it.price ? "" : " disabled") + ">购买</button>" +
          (stock > 0 ? '<button class="wg-btn sm" data-pick="' + it.id + '">' +
              (on ? "已选中" : "摆放") + "</button>" : "") +
          (stock > 0 ? '<button class="wg-btn sm" data-sell="' + it.id + '">卖 ' +
              Math.floor(it.price / 2) + " G</button>" : "") +
        "</div></div>";
    }).join("");

    DE.ui.$$("[data-buy]").forEach(function (b) {
      b.onclick = function () {
        var r = DE.wagon.buyItem(c, w, b.getAttribute("data-buy"), 1);
        DE.ui.toast(r.msg, r.ok ? "ok" : "err");
        if (r.ok) save();
      };
    });
    DE.ui.$$("[data-pick]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-pick");
        PICK = (PICK === id) ? null : id;
        var it = DE.wagon.findItem(id);
        DE.ui.toast(PICK ? "已选中〈" + it.name + "〉，点房间里的空格摆放。" : "已取消选择。", "");
        renderCat(); renderRooms();
      };
    });
    DE.ui.$$("[data-sell]").forEach(function (b) {
      b.onclick = function () {
        var r = DE.wagon.sellItem(c, w, b.getAttribute("data-sell"));
        DE.ui.toast(r.msg, r.ok ? "ok" : "err");
        if (r.ok) save();
      };
    });

    $("#wgBuyHint").innerHTML =
      CAT === "interior"
        ? "🏠 <b>内部装潢</b>：摆在房间里的家具。<b>床</b>能提升野营失败时的回复，<b>工作台 / 烹饪台</b>给手艺人的判定加值，<b>椅子</b>纯装饰。买完点「摆放」，再点房间里的空格。"
        : "🔧 <b>外部装潢</b>：装在车身上的改造设施（规则书 p174「马车改造」）。改造项目数量不限，买下就立刻生效，不占房间格子。";
  }

  function renderCatTabs() {
    $("#wgCatTabs").innerHTML = [["interior", "🏠 内部装潢"], ["exterior", "🔧 外部装潢"]]
      .map(function (x) {
        var n = DE.wagon.itemsOf(x[0]).length;
        return '<span class="wg-tab' + (CAT === x[0] ? " on" : "") + '" data-cat="' + x[0] + '">' +
          x[1] + '<span class="n">' + n + "</span></span>";
      }).join("");
    DE.ui.$$("[data-cat]").forEach(function (x) {
      x.onclick = function () { CAT = x.getAttribute("data-c"); PICK = null; renderCatTabs(); renderCat(); };
    });
  }

  /* ---------- 加值汇总 ---------- */
  function renderBonuses() {
    var st = DE.wagon.stats(w);
    $("#wgBonuses").innerHTML = st.bonuses.length
      ? st.bonuses.map(function (b) { return "<span>" + DE.ui.esc(b) + "</span>"; }).join("")
      : '<span style="background:rgba(255,255,255,.05);border-color:var(--d-line);color:var(--d-dim)">还没有任何加值</span>';
  }

  /* ---------- 规则与数据 ---------- */
  function renderRules() {
    var st = DE.wagon.stats(w);
    if (!st.has) return;
    var t = st.type;
    var spec = DE.wagon.roomSpec(w.upgradeLevel);
    $("#wgRules").innerHTML =
      '<div class="wg-chip" style="margin-bottom:12px">' + t.icon + " <b style=\"color:#fff\">" +
        DE.ui.esc(t.name) + "</b>　价格 " + t.price + " G（不含动物）　租 " + t.rentPerDay + " G / 天</div>" +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:11px">' +
        [["最小动物数", t.animals], ["最大乘员数", t.seats + " 人（另需 1 名车夫）"],
         ["尺寸", String(t.size)], ["装载量", t.capacity],
         ["房间", w.rooms.length + " / " + t.maxRooms + " 间"],
         ["房间规格", spec.label + "（" + spec.price + " G）"]]
        .map(function (x) {
          return '<div class="wg-chip" style="flex-direction:column;align-items:flex-start;gap:2px">' +
            '<span style="font-size:11px;color:var(--d-dim)">' + x[0] + "</span>" +
            "<b>" + DE.ui.esc(x[1]) + "</b></div>";
        }).join("") +
      "</div>";

    $("#wgSell").onclick = function () {
      DE.ui.confirm({ title: "卖掉马车", okText: "卖掉",
        body: "卖掉〈" + t.name + "〉会退回车价的一半，家具也会按半价回收。房间与装潢会全部清空。" })
        .then(function (ok) {
          if (!ok) return;
          var r = DE.wagon.sellWagon(c, w);
          PICK = null;
          DE.ui.toast(r.msg, r.ok ? "ok" : "err");
          if (r.ok) save();
        });
    };
  }

  /* ---------- 总渲染 ---------- */
  function render() {
    w = DE.wagon.ensure(c);        // 每次都重新取，避免闭包里的引用过期
    var has = !!DE.wagon.findType(w.type);
    renderTop();
    $("#wgNoWagon").style.display = has ? "none" : "block";
    $("#wgHasWagon").style.display = has ? "block" : "none";
    if (has) {
      renderCatTabs(); renderRooms(); renderCat(); renderBonuses(); renderRules();
    } else {
      renderTypes();
    }
    DE.ui.expiryBanner($("#expiryBanner"));
  }

  /* 外部（测试 / 其他页面）改了马车之后，调 DE.onTick() 就能整体重绘 */
  DE.onTick = function () { render(); };
  render();
}});
