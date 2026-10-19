/* ============================================================
 *  龙蛋物语 — 世界大地图
 *  网格绘制 / 地形调色板 / 地图块素材 / 贴纸徽章 / 悬停预览 / 导出
 *  ============================================================ */
DE.ui.bootPage({ after: function () {
  var $ = DE.ui.$;
  var c = DE.store.character;
  var J = DE.journal.empty();
  DE.journal.book = J;
  var wm = null;

  var brush = { type: "terrain", terrain: "plain", tileId: null };  // 当前画笔
  var erase = false;                 // 兼容旧逻辑：橡皮
  var showGrid = true;
  var selStampId = null;
  var painting = false;
  var tool = "pointer";              // pointer | brush | eraser | pan
  var selCell = null;                // {c, r}
  var ZOOMS = [26, 32, 38, 46, 56, 68, 82, 100, 120];
  var lastCvCursor = "";

  /* ---------- 工具 ---------- */
  function persist() {
    return DE.journal.save(J).then(function (r) {
      if (!r || !r.ok) { DE.ui.toast((r && r.error) || "保存失败。", "err"); return false; }
      return true;
    }).catch(function (e) {
      DE.ui.toast("保存失败：" + (e && e.message ? e.message : e), "err");
      return false;
    });
  }
  function save() { return persist().then(function (ok) { if (ok) render(); }); }

  function cellStyle(cell) {
    var t = DE.worldmap.findTerrain(cell.terrain);
    var tile = cell.tileId ? DE.worldmap.findTileDef(wm, cell.tileId) : null;
    if (tile) return { tile: tile, terrain: t };
    return { tile: null, terrain: t };
  }

  /* ---------- 网格 ---------- */
  function renderGrid() {
    var cell = wm.cell;
    var grid = $("#grid");
    grid.style.gridTemplateColumns = "repeat(" + wm.cols + ", " + cell + "px)";
    grid.style.gridAutoRows = cell + "px";
    var html = [];
    for (var r = 0; r < wm.rows; r++) {
      for (var cc = 0; cc < wm.cols; cc++) {
        var c0 = DE.worldmap.getCell(wm, cc, r);
        if (!c0) {
          var isSel0 = selCell && selCell.c === cc && selCell.r === r;
          html.push('<div class="wm-cell' + (isSel0 ? " sel" : "") + '" data-c="' + cc + '" data-r="' + r + '" ' +
            'style="background:rgba(255,255,255,.42);' + (showGrid ? "" : "border-color:transparent") + '"></div>');
          continue;
        }
        var t = DE.worldmap.findTerrain(c0.terrain);
        var tile = c0.tileId ? DE.worldmap.findTileDef(wm, c0.tileId) : null;
        var nm = (c0.name || "").trim();
        var isSel = selCell && selCell.c === cc && selCell.r === r;
        html.push('<div class="wm-cell painted' + (isSel ? " sel" : "") + '" data-c="' + cc + '" data-r="' + r + '" ' +
          'style="background:' + t.color + ";" + (showGrid ? "" : "border-color:transparent") + '">' +
          (tile ? '<img src="' + tile.dataUrl + '" alt="">'
                : '<span class="ic" style="color:' + t.ink + '">' + t.icon + "</span>") +
          (nm ? '<span class="nm" style="color:' + t.ink + '">' + DE.ui.esc(nm) + "</span>" : "") +
          "</div>");
      }
    }
    grid.innerHTML = html.join("");
  }

  /* ---------- 地图上的贴纸 ---------- */
  function renderStamps() {
    var layer = $("#stampl");
    layer.innerHTML = (wm.stamps || []).map(function (s) {
      var lb = DE.journal.findLib(J, s.libId);
      if (!lb) return "";
      return '<div class="wm-stamp' + (selStampId === s.id ? " sel" : "") + '" data-stamp="' + s.id + '" ' +
        'style="left:' + s.x + "px;top:" + s.y + "px;width:" + s.w + "px;z-index:" + (s.z || 1) + ";" +
        "transform:rotate(" + (s.rot || 0) + 'deg)">' +
        '<img src="' + lb.dataUrl + '" alt="' + DE.ui.esc(lb.name) + '"></div>';
    }).join("");
    layer.style.pointerEvents = "none";
    DE.ui.$$("[data-stamp]").forEach(function (el) {
      el.style.pointerEvents = "auto";
      el.addEventListener("mousedown", startStampDrag);
      el.addEventListener("touchstart", startStampDrag, { passive: false });
    });
  }

  /* ---------- 工具条 ---------- */
  var TOOLS = [
    { id:"pointer", label:"鼠标",  key:"🖱️", tip:"点格子即选中，在右侧编辑便签（默认）" },
    { id:"brush",   label:"画笔",  key:"🖌️", tip:"点 / 拖动格子连续绘制当前地形或地图块" },
    { id:"eraser",  label:"橡皮",  key:"🧽", tip:"点 / 拖动格子清除" },
    { id:"pan",     label:"平移",  key:"✋", tip:"拖动画面查看地图（也可用滚轮 / 滚动条）" }
  ];

  function renderTools() {
    var html = TOOLS.map(function (t) {
      return '<span class="tool' + (tool === t.id ? " on" : "") + '" data-tool="' + t.id +
        '" title="' + DE.ui.esc(t.tip) + '"><span class="k">' + t.key + "</span>" + t.label + "</span>";
    }).join("") +
    '<span class="toolsep"></span>' +
    '<span class="tool zoom" data-zoom="out" title="缩小格子">🔍−</span>' +
    '<span class="tool zoom" data-zoom="in" title="放大格子">🔍＋</span>' +
    '<span class="zoomnow" id="zoomNow" title="点一下复位到 100%">缩放 <b>' + zoomPct() + '%</b></span>';
    $("#tools").innerHTML = html;

    DE.ui.$$("[data-tool]").forEach(function (x) {
      x.onclick = function () {
        tool = x.getAttribute("data-tool");
        if (tool !== "pan") $("#stage").classList.remove("dragging");
        renderTools();
        applyCursor();
        DE.ui.toast(TOOLS.filter(function (t) { return t.id === tool; })[0].tip, "");
      };
    });
    DE.ui.$$("[data-zoom]").forEach(function (x) {
      x.onclick = function () { zoomBy(x.getAttribute("data-zoom") === "in" ? 1 : -1); };
    });
    var zn = $("#zoomNow");
    if (zn) zn.onclick = function () { setZoom(46); };
  }

  function zoomPct() { return Math.round(wm.cell / 46 * 100); }
  function setZoom(px) {
    wm.cell = Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], px));
    renderGrid(); renderStamps(); renderTools();
  }
  function zoomBy(dir) {
    var cur = wm.cell, idx = 0;
    for (var i = 0; i < ZOOMS.length; i++) if (ZOOMS[i] <= cur) idx = i;
    var next = dir > 0 ? (ZOOMS[idx + 1] || ZOOMS[ZOOMS.length - 1])
                       : (ZOOMS[idx - 1] || ZOOMS[0]);
    if (next === cur) { DE.ui.toast(dir > 0 ? "已经是最大缩放。" : "已经是最小缩放。", ""); return; }
    setZoom(next);
  }
  function applyCursor() {
    var stage = $("#stage");
    stage.className = "wm-stage" + (tool === "pan" ? " pan" : "");
    stage.style.cursor = tool === "pan" ? "grab"
                       : (tool === "pointer" ? "pointer" : "crosshair");
  }

  /* ---------- 单格即时重绘（拖动绘制时不整片重排） ---------- */
  function paintCellEl(el, cc, r) {
    if (!el) return;
    var cell = DE.worldmap.getCell(wm, cc, r);
    var isSel = selCell && selCell.c === cc && selCell.r === r;
    el.className = "wm-cell" + (cell ? " painted" : "") + (isSel ? " sel" : "");
    if (!cell) {
      el.style.background = "rgba(255,255,255,.42)";
      el.innerHTML = "";
      return;
    }
    var t = DE.worldmap.findTerrain(cell.terrain);
    var tile = cell.tileId ? DE.worldmap.findTileDef(wm, cell.tileId) : null;
    var nm = (cell.name || "").trim();
    el.style.background = t.color;
    el.innerHTML = (tile ? '<img src="' + tile.dataUrl + '" alt="">'
                         : '<span class="ic" style="color:' + t.ink + '">' + t.icon + "</span>") +
      (nm ? '<span class="nm" style="color:' + t.ink + '">' + DE.ui.esc(nm) + "</span>" : "");
  }

  function cellEl(cc, r) {
    return $("#grid").querySelector('[data-c="' + cc + '"][data-r="' + r + '"]');
  }

  /* ---------- 选中格子 -> 右侧便签面板 ---------- */
  function selectCell(cc, r) {
    selCell = (cc === null) ? null : { c: cc, r: r };
    var grid = $("#grid");
    DE.ui.$$(".wm-cell.sel", grid).forEach(function (e) { e.classList.remove("sel"); });
    if (selCell) {
      var el = cellEl(cc, r);
      if (el) el.classList.add("sel");
    }
    renderInspector();
  }

  /* ---------- 调色板 ---------- */
  function renderPalette() {
    var html = DE.worldmap.TERRAIN.map(function (t) {
      var on = brush.type === "terrain" && !erase && brush.terrain === t.id;
      return '<div class="t' + (on ? " on" : "") + '" data-terrain="' + t.id + '" title="' +
        DE.ui.esc(t.name + "：" + t.hint) + '">' +
        '<div class="sw" style="background:' + t.color + ';color:' + t.ink + '">' + t.icon + "</div>" +
        '<div class="lb">' + DE.ui.esc(t.name) + "</div></div>";
    }).join("");
    $("#pal").innerHTML = html;
    DE.ui.$$("[data-terrain]").forEach(function (x) {
      x.onclick = function () {
        brush = { type: "terrain", terrain: x.getAttribute("data-terrain"), tileId: null };
        erase = false;
        renderPalette(); renderAssets(); updateHint();
      };
    });
    var t = DE.worldmap.findTerrain(brush.terrain);
    $("#palNow").textContent = erase ? "橡皮" : (brush.type === "tile" ? "地图块" : t.icon + " " + t.name);
  }

  /* ---------- 素材 ---------- */
  function renderAssets() {
    var tiles = wm.tiles || [];
    $("#tileCount").textContent = tiles.length;
    $("#tileGrid").innerHTML = tiles.map(function (t) {
      var on = brush.type === "tile" && !erase && brush.tileId === t.id;
      return '<div class="asset" data-tiledef="' + t.id + '" title="' + DE.ui.esc(t.name) +
        (t.note ? "：" + DE.ui.esc(t.note) : "") + '" ' +
        (on ? 'style="border-color:var(--teal);box-shadow:0 0 0 2px rgba(63,125,116,.25)"' : "") + ">" +
        '<img src="' + t.dataUrl + '" alt=""><div class="n">' + DE.ui.esc(t.name) + "</div>" +
        '<span class="x" data-deltile="' + t.id + '" title="删除">×</span></div>';
    }).join("") || '<div class="hint">还没有地图块素材。</div>';
    DE.ui.$$("[data-tiledef]").forEach(function (x) {
      x.onclick = function (ev) {
        if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-deltile")) return;
        brush = { type: "tile", terrain: brush.terrain, tileId: x.getAttribute("data-tiledef") };
        erase = false;
        renderPalette(); renderAssets(); updateHint();
      };
    });
    DE.ui.$$("[data-deltile]").forEach(function (b) {
      b.onclick = function (ev) {
        ev.stopPropagation();
        var t = DE.worldmap.findTileDef(wm, b.getAttribute("data-deltile"));
        DE.ui.confirm({ title: "删除地图块", body: "确定删除〈" + t.name + "〉吗？用它铺过的格子会变回纯地形。", okText: "删除" })
          .then(function (ok) {
            if (!ok) return;
            DE.worldmap.removeTileDef(wm, t.id);
            if (brush.tileId === t.id) brush = { type: "terrain", terrain: brush.terrain, tileId: null };
            save();
          });
      };
    });

    var lib = J.library || [];
    $("#stampCount").textContent = lib.length;
    $("#stampGrid").innerHTML = lib.map(function (x) {
      return '<div class="asset" data-stampdef="' + x.id + '" title="' + DE.ui.esc(x.name) + '">' +
        '<img src="' + x.dataUrl + '" alt=""><div class="n">' + DE.ui.esc(x.name) + "</div></div>";
    }).join("") || '<div class="hint">贴纸库是空的，去手账本上传徽章或奖励贴纸。</div>';
    DE.ui.$$("[data-stampdef]").forEach(function (x) {
      x.onclick = function () {
        var id = x.getAttribute("data-stampdef");
        var lib2 = DE.journal.findLib(J, id);
        var n = (wm.stamps || []).length;
        var s = DE.worldmap.addStamp(wm, {
          libId: id, name: lib2 ? lib2.name : "",
          x: 40 + (n % 6) * 30, y: 40 + Math.floor(n / 6) * 30,
          w: 90, z: n + 1
        });
        selStampId = s.id;
        save();
      };
    });
  }

  function updateHint() {
    if (!wm) return;
    var t = DE.worldmap.findTerrain(brush.terrain);
    var tn = TOOLS.filter(function (x) { return x.id === tool; })[0];
    var paint = tool === "brush" || tool === "eraser";
    $("#selHint").innerHTML = !paint
      ? "当前工具 <b>" + tn.key + " " + tn.label + "</b>　" + DE.ui.esc(tn.tip) +
        (tool === "pointer" ? "　← 点格子就会在右侧打开「格子便签」。" : "")
      : (tool === "eraser"
          ? "🧽 橡皮：点或拖动格子即可清除。"
          : (brush.type === "tile"
              ? "🖌️ 画笔（地图块）：<b>" + DE.ui.esc(DE.worldmap.findTileDef(wm, brush.tileId).name) +
                "</b>　点或拖动格子铺上去。"
              : "🖌️ 画笔（地形）：<b>" + DE.ui.esc(t.name) + "</b>　" + DE.ui.esc(t.hint) +
                "　点或拖动格子绘制。"));
  }

  /* ---------- 统计 ---------- */
  function renderStats() {
    if (!wm) return;                 // 地图还没载入完成时先跳过
    var st = DE.worldmap.stats(wm);
    var top = Object.keys(st.byTerrain).sort(function (a, b) {
      return st.byTerrain[b] - st.byTerrain[a];
    }).slice(0, 10).map(function (k) {
      var t = DE.worldmap.findTerrain(k);
      return '<span style="background:' + t.color + ';color:' + t.ink + ';border-color:transparent">' +
        t.icon + " " + DE.ui.esc(t.name) + " " + st.byTerrain[k] + "</span>";
    }).join("");
    $("#statsBox").innerHTML =
      '<div class="statgrid">' +
        '<div class="stat"><div class="k">网格</div><div class="v" style="font-size:16px">' +
          st.cols + "×" + st.rows + "</div></div>" +
        '<div class="stat"><div class="k">已绘制</div><div class="v">' + st.used + "</div></div>" +
        '<div class="stat"><div class="k">空白</div><div class="v">' + st.blank + "</div></div>" +
        '<div class="stat"><div class="k">有地名</div><div class="v">' + st.named + "</div></div>" +
        '<div class="stat"><div class="k">地图块素材</div><div class="v">' + st.tiles + "</div></div>" +
        '<div class="stat"><div class="k">贴纸 / 徽章</div><div class="v">' + st.stamps + "</div></div>" +
      "</div>" +
      (top ? '<div class="tstat" style="margin-top:11px">' + top + "</div>" : "");
  }

  /* ---------- 右侧「格子便签」面板 ---------- */
  function renderInspector() {
    var box = $("#insp");
    if (!box) return;
    if (!wm) { box.innerHTML = ""; return; }

    if (!selCell) {
      box.innerHTML = '<div class="card"><div class="hd"><b>📝 格子便签</b></div>' +
        '<div class="empty"><span class="big">👆</span>' +
        "用 <b>🖱️ 鼠标</b> 工具点任意格子<br>就能在这里写地名与便签<br>" +
        '<span style="font-size:11.5px">也可以双击格子弹出完整编辑窗</span></div></div>';
      return;
    }

    var cell = DE.worldmap.getCell(wm, selCell.c, selCell.r);
    var terrain = DE.worldmap.findTerrain(cell ? cell.terrain : "plain");
    var cellName = cell ? (cell.name || "") : "";
    var note = cell ? (cell.note || "") : "";
    var tileId = cell ? (cell.tileId || "") : "";

    var tOpts = DE.worldmap.TERRAIN.map(function (t) {
      return '<option value="' + t.id + '"' + (cell && cell.terrain === t.id ? " selected" : "") + ">" +
        t.icon + " " + DE.ui.esc(t.name) + "</option>";
    }).join("");

    var tilePick = '<div class="tilepick">' +
      '<div class="tp none' + (!tileId ? " on" : "") + '" data-picktile="" title="只显示地形图标">纯地形</div>' +
      (wm.tiles || []).map(function (t) {
        return '<div class="tp' + (tileId === t.id ? " on" : "") + '" data-picktile="' + t.id +
          '" title="' + DE.ui.esc(t.name) + '"><img src="' + t.dataUrl + '" alt=""></div>';
      }).join("") + "</div>";

    box.innerHTML = '<div class="card">' +
      '<div class="hd"><span class="sw" style="background:' + terrain.color + '"></span>' +
        "<b>" + DE.ui.esc(cellName || terrain.name) + "</b>" +
        '<span class="coord">' + (selCell.c + 1) + " 列 · " + (selCell.r + 1) + " 行</span></div>" +
      '<div class="bd">' +
        '<div class="tinfo">' + terrain.icon + " <b>" + DE.ui.esc(terrain.name) + "</b>　" +
          DE.ui.esc(terrain.hint) + "</div>" +
        '<label class="fld"><span>地名</span>' +
          '<input type="text" id="ipName" value="' + DE.ui.esc(cellName) + '" placeholder="例如：银月镇">' +
          '<div class="quick">' +
            ["银月镇", "迷雾森林", "龙骨峰", "旧王都", "渡口"].map(function (n) {
              return '<span class="q" data-quickname="' + DE.ui.esc(n) + '">' + DE.ui.esc(n) + "</span>";
            }).join("") +
          "</div></label>" +
        '<label class="fld"><span>地形</span><select id="ipTerrain">' + tOpts + "</select></label>" +
        '<label class="fld"><span>便签（鼠标移上去就能看到）</span>' +
          '<textarea id="ipNote" placeholder="这里有什么、发生过什么、要注意什么…">' + DE.ui.esc(note) + "</textarea>" +
          '<div class="quick">' +
            ["有药草店", "可以补给", "怪物出没", "有渡口", "遗迹入口"].map(function (n) {
              return '<span class="q" data-quicknote="' + DE.ui.esc(n) + '">＋' + DE.ui.esc(n) + "</span>";
            }).join("") +
          "</div></label>" +
        '<div class="fld"><span>地图块素材</span>' + tilePick + "</div>" +
        '<div class="btnrow">' +
          '<button class="sm primary" id="ipSave">保存这一格</button>' +
          '<button class="sm ghost" id="ipClear">清除格子</button>' +
          '<button class="sm ghost" id="ipClose">取消选中</button>' +
        "</div>" +
      "</div></div>";

    var nameEl = $("#ipName"), noteEl = $("#ipNote"),
        terEl = $("#ipTerrain");

    function commit(live) {
      DE.worldmap.putCell(wm, selCell.c, selCell.r, {
        name: nameEl.value,
        note: noteEl.value,
        terrain: terEl.value,
        tileId: (function () {
          var on = DE.ui.$$("[data-picktile].on", box)[0];
          return on ? (on.getAttribute("data-picktile") || null) : null;
        })()
      });
      paintCellEl(cellEl(selCell.c, selCell.r), selCell.c, selCell.r);
      if (live) { persist(); } else { save(); }
    }

    /* 即时保存：输入停下 500ms 或失焦就写入 */
    var timer = null;
    function later() {
      clearTimeout(timer);
      timer = setTimeout(function () { commit(true); }, 500);
    }
    nameEl.addEventListener("input", later);
    noteEl.addEventListener("input", later);
    nameEl.addEventListener("blur", function () { clearTimeout(timer); commit(true); });
    noteEl.addEventListener("blur", function () { clearTimeout(timer); commit(true); });
    terEl.addEventListener("change", function () { commit(false); });
    noteEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); commit(false); }
    });

    DE.ui.$$("[data-picktile]", box).forEach(function (p) {
      p.onclick = function () {
        DE.ui.$$("[data-picktile]", box).forEach(function (o) { o.classList.remove("on"); });
        p.classList.add("on");
        commit(false);
      };
    });
    DE.ui.$$("[data-quickname]", box).forEach(function (q) {
      q.onclick = function () { nameEl.value = q.getAttribute("data-quickname"); commit(false); };
    });
    DE.ui.$$("[data-quicknote]", box).forEach(function (q) {
      q.onclick = function () {
        var txt = q.getAttribute("data-quicknote");
        noteEl.value = noteEl.value ? (noteEl.value.replace(/\s+$/, "") + "\n" + txt) : txt;
        commit(true);
      };
    });
    var sv = $("#ipSave");
    if (sv) sv.onclick = function () {
      commit(false);
      DE.ui.toast("第 " + (selCell.c + 1) + " 列 · 第 " + (selCell.r + 1) + " 行已保存。", "ok");
    };
    var cl = $("#ipClear");
    if (cl) cl.onclick = function () {
      DE.worldmap.clearCell(wm, selCell.c, selCell.r);
      paintCellEl(cellEl(selCell.c, selCell.r), selCell.c, selCell.r);
      save();
    };
    var cc = $("#ipClose");
    if (cc) cc.onclick = function () { selectCell(null); };
  }

  /* ---------- 悬停预览 ---------- */
  var tip = $("#tip");
  function showTip(x, y, cc, r) {
    var cell = DE.worldmap.getCell(wm, cc, r);
    var t = DE.worldmap.findTerrain(cell ? cell.terrain : "fog");
    var tile = cell && cell.tileId ? DE.worldmap.findTileDef(wm, cell.tileId) : null;
    tip.innerHTML =
      '<div class="h"><span class="sw" style="background:' + t.color + '"></span>' +
      "<b>" + DE.ui.esc((cell && cell.name) || t.name) + "</b></div>" +
      '<div class="c">' + t.icon + " " + DE.ui.esc(t.name) +
        (cell ? "" : "（未绘制）") + (tile ? "　🧩 " + DE.ui.esc(tile.name) : "") + "</div>" +
      '<div class="n">' + DE.ui.esc((cell && cell.note) || t.hint) + "</div>" +
      '<div class="p">第 ' + (cc + 1) + " 列 · 第 " + (r + 1) + " 行　双击可编辑</div>";
    tip.classList.add("on");
    var w = tip.offsetWidth || 250, h = tip.offsetHeight || 120;
    var left = Math.min(window.innerWidth - w - 10, x + 16);
    var top = Math.max(8, Math.min(window.innerHeight - h - 10, y + 16));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }
  function hideTip() { tip.classList.remove("on"); }

  /* ---------- 绘制交互 ---------- */
  function paintAt(target) {
    var cc = +target.getAttribute("data-c");
    var r = +target.getAttribute("data-r");
    if (erase) {
      if (!DE.worldmap.clearCell(wm, cc, r)) return false;
    } else if (brush.type === "tile" && brush.tileId) {
      DE.worldmap.putCell(wm, cc, r, { tileId: brush.tileId });
    } else {
      var cur = DE.worldmap.getCell(wm, cc, r);
      DE.worldmap.putCell(wm, cc, r, { terrain: brush.terrain, tileId: cur ? cur.tileId : null });
    }
    return true;
  }

  function bindGrid() {
    var grid = $("#grid");
    var stage = $("#stage");
    var pan = null;

    function cellOf(t) {
      if (!t || !t.getAttribute) return null;
      var cc = t.getAttribute("data-c"), r = t.getAttribute("data-r");
      if (cc === null || r === null) return null;
      return { c: +cc, r: +r, el: t };
    }

    /* 按当前工具处理一次落笔 */
    function useTool(cell, isDrag) {
      if (!cell) return false;
      if (tool === "pointer") {
        if (isDrag) return false;
        selectCell(cell.c, cell.r);
        return false;
      }
      if (tool === "pan") return false;
      if (tool === "eraser") {
        if (!DE.worldmap.clearCell(wm, cell.c, cell.r)) return false;
        paintCellEl(cell.el, cell.c, cell.r);
        return true;
      }
      /* 画笔 */
      if (brush.type === "tile" && brush.tileId) {
        DE.worldmap.putCell(wm, cell.c, cell.r, { tileId: brush.tileId });
      } else {
        var cur = DE.worldmap.getCell(wm, cell.c, cell.r);
        DE.worldmap.putCell(wm, cell.c, cell.r, {
          terrain: brush.terrain, tileId: cur ? cur.tileId : null
        });
      }
      paintCellEl(cell.el, cell.c, cell.r);
      return true;
    }

    /* ---- 鼠标 ---- */
    grid.onmousedown = function (ev) {
      /* 中键 / 空格 = 临时平移 */
      if (ev.button === 1) { startPan(ev); ev.preventDefault(); return; }
      if (tool === "pan") { startPan(ev); ev.preventDefault(); return; }
      var cell = cellOf(ev.target);
      if (!cell) return;
      ev.preventDefault();
      painting = (tool === "brush" || tool === "eraser");
      if (useTool(cell, false) === false && tool === "pointer") return;
    };

    grid.onmouseover = function (ev) {
      var cell = cellOf(ev.target);
      if (!cell) return;
      cell.el.classList.add("brushing");
      showTip(ev.clientX, ev.clientY, cell.c, cell.r);
      if (painting) useTool(cell, true);
    };
    grid.onmouseout = function (ev) {
      if (ev.target && ev.target.classList) ev.target.classList.remove("brushing");
    };
    grid.ondblclick = function (ev) {
      var cell = cellOf(ev.target);
      if (!cell) return;
      painting = false;
      cellDialog(cell.c, cell.r);
    };
    grid.oncontextmenu = function (ev) {
      /* 右键：在画笔 / 橡皮之间快速切换成橡皮 */
      var cell = cellOf(ev.target);
      if (!cell) return;
      ev.preventDefault();
      if (tool === "eraser") { DE.worldmap.clearCell(wm, cell.c, cell.r); }
      else { tool = "eraser"; }
      paintCellEl(cell.el, cell.c, cell.r);
      renderTools();
      save();
    };

    /* ---- 平移 ---- */
    function startPan(ev) {
      pan = { x: ev.clientX, y: ev.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
      stage.classList.add("dragging");
      document.addEventListener("mousemove", onPan);
      document.addEventListener("mouseup", endPan);
    }
    function onPan(ev) {
      if (!pan) return;
      stage.scrollLeft = pan.sl - (ev.clientX - pan.x);
      stage.scrollTop = pan.st - (ev.clientY - pan.y);
    }
    function endPan() {
      pan = null;
      stage.classList.remove("dragging");
      document.removeEventListener("mousemove", onPan);
      document.removeEventListener("mouseup", endPan);
    }

    /* ---- 触屏 ---- */
    var tStart = null;
    grid.addEventListener("touchstart", function (ev) {
      if (ev.touches.length > 1) return;              // 双指留给缩放/滚动
      var cell = cellOf(ev.target);
      if (!cell) return;
      if (tool === "pan") return;
      ev.preventDefault();
      tStart = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, moved: false };
      if (tool === "brush" || tool === "eraser") { painting = true; useTool(cell, false); }
    }, { passive: false });
    grid.addEventListener("touchmove", function (ev) {
      if (!tStart) return;
      var t = ev.touches[0];
      if (Math.abs(t.clientX - tStart.x) > 6 || Math.abs(t.clientY - tStart.y) > 6) tStart.moved = true;
      if (!painting) return;
      ev.preventDefault();
      var el = document.elementFromPoint ? document.elementFromPoint(t.clientX, t.clientY) : null;
      var cell = cellOf(el);
      if (cell) useTool(cell, true);
    }, { passive: false });
    grid.addEventListener("touchend", function (ev) {
      if (tStart && !tStart.moved && tool === "pointer") {
        var cell = cellOf(ev.target);
        if (cell) selectCell(cell.c, cell.r);
      }
      if (painting) { painting = false; save(); }
      tStart = null;
    });

    stage.addEventListener("mouseleave", function () { hideTip(); });
    document.addEventListener("mouseup", function () {
      if (painting) { painting = false; save(); }
    });

    /* ---- Ctrl + 滚轮缩放 ---- */
    stage.addEventListener("wheel", function (ev) {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        zoomBy(ev.deltaY < 0 ? 1 : -1);
      }
    }, { passive: false });

    /* ---- 快捷键：1~4 切工具，0 复位缩放 ---- */
    document.addEventListener("keydown", function (ev) {
      var tag = (ev.target && ev.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (ev.key === "1") { tool = "pointer"; renderTools(); applyCursor(); }
      else if (ev.key === "2") { tool = "brush"; renderTools(); applyCursor(); }
      else if (ev.key === "3") { tool = "eraser"; renderTools(); applyCursor(); }
      else if (ev.key === "4") { tool = "pan"; renderTools(); applyCursor(); }
      else if (ev.key === "0") { setZoom(46); }
      else if (ev.key === "Escape") { selectCell(null); hideTip(); }
    });
  }

  /* ---------- 格子编辑 ---------- */
  function cellDialog(cc, r) {
    var cell = DE.worldmap.getCell(wm, cc, r) ||
      DE.worldmap.putCell(wm, cc, r, { terrain: brush.terrain });
    var ov = DE.ui.el("div", { style: "position:fixed;inset:0;background:rgba(40,32,22,.55);z-index:300;display:flex;align-items:center;justify-content:center;padding:18px" });
    var t = DE.worldmap.findTerrain(cell.terrain);
    var terrainOpts = DE.worldmap.TERRAIN.map(function (x) {
      return '<option value="' + x.id + '"' + (x.id === cell.terrain ? " selected" : "") + ">" +
        x.icon + " " + DE.ui.esc(x.name) + "</option>";
    }).join("");
    var tileOpts = '<option value="">— 不用素材，只显示地形 —</option>' +
      (wm.tiles || []).map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === cell.tileId ? " selected" : "") + ">" +
          DE.ui.esc(x.name) + "</option>";
      }).join("");
    ov.innerHTML = '<div class="card" style="max-width:470px;width:100%;max-height:88vh;overflow:auto;margin:0">' +
      "<h2>编辑第 " + (cc + 1) + " 列 · 第 " + (r + 1) + " 行</h2>" +
      '<div class="hint" style="margin-bottom:10px">当前：' + t.icon + " " + DE.ui.esc(t.name) + "</div>" +
      '<label class="fld"><span>地名</span><input type="text" id="clName" value="' + DE.ui.esc(cell.name || "") + '" placeholder="例如：银月镇 / 迷雾森林"></label>' +
      '<label class="fld"><span>地形</span><select id="clTerrain">' + terrainOpts + "</select></label>" +
      '<label class="fld"><span>地图块素材</span><select id="clTile">' + tileOpts + "</select></label>" +
      '<label class="fld"><span>便签（鼠标移上去就能看到）</span><textarea id="clNote" ' +
        'placeholder="这里有什么、发生过什么、要注意什么…">' + DE.ui.esc(cell.note || "") + "</textarea></label>" +
      '<div class="btnrow" style="justify-content:space-between">' +
        '<button class="danger sm" id="clDel">清除这一格</button>' +
        '<span><button class="ghost" data-x="0">取消</button> ' +
        '<button class="primary" data-x="1">保存</button></span></div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#clDel").onclick = function () {
      DE.worldmap.clearCell(wm, cc, r);
      document.body.removeChild(ov);
      save();
    };
    DE.ui.$$("[data-x]", ov).forEach(function (b) {
      b.onclick = function () {
        if (b.getAttribute("data-x") === "1") {
          DE.worldmap.putCell(wm, cc, r, {
            name: ov.querySelector("#clName").value,
            terrain: ov.querySelector("#clTerrain").value,
            tileId: ov.querySelector("#clTile").value || null,
            note: ov.querySelector("#clNote").value
          });
        }
        document.body.removeChild(ov);
        save();
      };
    });
  }

  /* ---------- 贴纸拖动 ---------- */
  var sDrag = null;
  function startStampDrag(ev) {
    var el = ev.currentTarget;
    var s = DE.worldmap.findStamp(wm, el.getAttribute("data-stamp"));
    if (!s) return;
    ev.preventDefault();
    ev.stopPropagation();
    var stage = $("#stage");
    var rect = stage.getBoundingClientRect();
    var p = ev.touches ? ev.touches[0] : ev;
    sDrag = { s: s, el: el, dx: p.clientX - rect.left + stage.scrollLeft - s.x,
              dy: p.clientY - rect.top + stage.scrollTop - s.y, moved: false };
    selStampId = s.id;
    el.classList.add("sel");
    document.addEventListener("mousemove", onStampDrag);
    document.addEventListener("touchmove", onStampDrag, { passive: false });
    document.addEventListener("mouseup", endStampDrag);
    document.addEventListener("touchend", endStampDrag);
  }
  function onStampDrag(ev) {
    if (!sDrag) return;
    ev.preventDefault();
    var stage = $("#stage");
    var rect = stage.getBoundingClientRect();
    var p = ev.touches ? ev.touches[0] : ev;
    sDrag.s.x = Math.round(p.clientX - rect.left + stage.scrollLeft - sDrag.dx);
    sDrag.s.y = Math.round(p.clientY - rect.top + stage.scrollTop - sDrag.dy);
    sDrag.moved = true;
    sDrag.el.style.left = sDrag.s.x + "px";
    sDrag.el.style.top = sDrag.s.y + "px";
  }
  function endStampDrag() {
    if (!sDrag) return;
    document.removeEventListener("mousemove", onStampDrag);
    document.removeEventListener("touchmove", onStampDrag);
    document.removeEventListener("mouseup", endStampDrag);
    document.removeEventListener("touchend", endStampDrag);
    var moved = sDrag.moved;
    sDrag.el.classList.remove("sel");
    sDrag = null;
    if (moved) save();
  }

  /* ---------- 上传：地图块素材（与贴纸分开） ---------- */
  function uploadTiles(files) {
    var list = Array.prototype.slice.call(files);
    if (!list.length) return;
    var done = 0, failed = [];
    DE.ui.toast("正在处理 " + list.length + " 张地图块…", "");
    list.forEach(function (f) {
      DE.journal.readImage(f, { maxSide: 900, quality: 0.86 }).then(function (r) {
        DE.worldmap.addTileDef(wm, {
          name: f.name.replace(/\.[^.]+$/, ""),
          dataUrl: r.dataUrl, width: r.width, height: r.height
        });
        done++;
        if (done + failed.length === list.length) finish();
      }).catch(function (e) {
        failed.push(f.name + "：" + e.message);
        if (done + failed.length === list.length) finish();
      });
    });
    function finish() {
      if (failed.length) DE.ui.toast("有 " + failed.length + " 张失败：" + failed.slice(0, 2).join("；"), "err");
      persist().then(function (ok) {
        if (!failed.length && ok) DE.ui.toast("已加入 " + done + " 张地图块。", "ok");
        render();
      });
    }
  }

  function bindUpload() {
    var z = $("#upTiles"), fi = $("#fileTiles");
    z.onclick = function () { fi.click(); };
    ["dragenter", "dragover"].forEach(function (e2) {
      z.addEventListener(e2, function (e) { e.preventDefault(); z.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (e2) {
      z.addEventListener(e2, function (e) { e.preventDefault(); z.classList.remove("over"); });
    });
    z.addEventListener("drop", function (e) {
      var fs = e.dataTransfer && e.dataTransfer.files;
      if (fs && fs.length) uploadTiles(fs);
    });
    fi.onchange = function () { if (this.files && this.files.length) uploadTiles(this.files); };
  }

  /* ---------- 顶部工具 ---------- */
  function bindTools() {
    $("#wmName").addEventListener("input", function () { wm.name = this.value; });
    $("#wmName").addEventListener("blur", function () { save(); });

    $("#btnResize").onclick = function () {
      var cols = parseInt($("#wmCols").value, 10) || wm.cols;
      var rows = parseInt($("#wmRows").value, 10) || wm.rows;
      var cell = parseInt($("#wmCell").value, 10) || wm.cell;
      var lost = 0;
      Object.keys(wm.cells).forEach(function (k) {
        var p = k.split(",");
        if (+p[0] >= cols || +p[1] >= rows) lost++;
      });
      function apply() {
        DE.worldmap.resize(wm, cols, rows);
        wm.cell = Math.max(24, Math.min(120, cell));
        save();
      }
      if (lost) {
        DE.ui.confirm({
          title: "缩小地图", okText: "继续",
          body: "有 " + lost + " 个已绘制的格子会超出新范围并被删除，确定吗？"
        }).then(function (ok) { if (ok) apply(); });
      } else apply();
    };

    $("#btnFillAll").onclick = function () {
      DE.ui.confirm({
        title: "整片填充", okText: "填充",
        body: "把整张地图都填成当前选中的地形？已有的地格会被覆盖（地名与便签保留）。"
      }).then(function (ok) {
        if (!ok) return;
        for (var r = 0; r < wm.rows; r++) {
          for (var cc = 0; cc < wm.cols; cc++) {
            var cur = DE.worldmap.getCell(wm, cc, r);
            DE.worldmap.putCell(wm, cc, r, {
              terrain: brush.terrain, tileId: cur ? cur.tileId : null
            });
          }
        }
        save();
      });
    };

    $("#btnGridLines").onclick = function () {
      showGrid = !showGrid;
      renderGrid();
      DE.ui.toast(showGrid ? "已显示网格线。" : "已隐藏网格线。", "");
    };

    $("#btnClearMap").onclick = function () {
      DE.ui.confirm({ title: "清空地图", okText: "清空", body: "会清除所有已绘制的地格与地图上的贴纸（素材库保留）。" })
        .then(function (ok) {
          if (!ok) return;
          wm.cells = {}; wm.stamps = []; selStampId = null;
          save();
        });
    };

    $("#btnErase").onclick = function () {
      erase = !erase;
      if (erase) selStampId = null;
      renderPalette(); renderAssets(); updateHint();
      DE.ui.toast(erase ? "橡皮已选中：点格子清除。" : "已切回画笔。", "");
    };

    $("#btnExportMap").onclick = exportMap;
  }

  /* ---------- 导出整张地图 ---------- */
  function exportMap() {
    var cell = wm.cell;
    var W = wm.cols * cell, H = wm.rows * cell;
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = wm.bg || "#f4efdf";
    ctx.fillRect(0, 0, W, H);

    /* 先铺地形底色，再画图标/素材图 */
    var imgJobs = [];
    for (var r = 0; r < wm.rows; r++) {
      for (var cc = 0; cc < wm.cols; cc++) {
        var c0 = DE.worldmap.getCell(wm, cc, r);
        var x = cc * cell, y = r * cell;
        if (!c0) {
          ctx.fillStyle = "rgba(255,255,255,.42)";
          ctx.fillRect(x, y, cell, cell);
        } else {
          var t = DE.worldmap.findTerrain(c0.terrain);
          ctx.fillStyle = t.color;
          ctx.fillRect(x, y, cell, cell);
          var tile = c0.tileId ? DE.worldmap.findTileDef(wm, c0.tileId) : null;
          if (tile) {
            imgJobs.push({ img: tile.dataUrl, x: x, y: y, w: cell, h: cell, cover: true });
          } else {
            ctx.font = Math.round(cell * 0.52) + "px serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(t.icon, x + cell / 2, y + cell / 2);
          }
          if ((c0.name || "").trim()) {
            ctx.font = "bold " + Math.max(8, Math.round(cell * 0.2)) + "px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillStyle = "rgba(255,255,255,.85)";
            ctx.fillText(c0.name, x + cell / 2, y + cell - 2);
            ctx.fillStyle = t.ink;
            ctx.fillText(c0.name, x + cell / 2, y + cell - 3);
          }
        }
        ctx.strokeStyle = "rgba(90,72,45,.16)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + .5, y + .5, cell - 1, cell - 1);
      }
    }
    /* 地图上的贴纸 */
    (wm.stamps || []).forEach(function (s) {
      var lb = DE.journal.findLib(J, s.libId);
      if (!lb) return;
      imgJobs.push({ img: lb.dataUrl, x: s.x, y: s.y, w: s.w,
                     h: s.w * ((lb.height || 1) / (lb.width || 1)), rot: s.rot || 0 });
    });

    var left = imgJobs.length;
    function done() {
      if (left > 0) return;
      var a = document.createElement("a");
      a.href = cv.toDataURL("image/png");
      a.download = "龙蛋物语世界地图_" + String(wm.name || "").replace(/[\\/:*?"<>|\s]/g, "") + ".png";
      a.click();
      DE.ui.toast("整张地图已导出。", "ok");
    }
    if (!left) { done(); return; }
    DE.ui.toast("正在合成地图（" + left + " 个素材）…", "");
    imgJobs.forEach(function (jb) {
      var im = new Image();
      im.onload = function () {
        ctx.save();
        if (jb.rot) {
          ctx.translate(jb.x + jb.w / 2, jb.y + jb.h / 2);
          ctx.rotate(jb.rot * Math.PI / 180);
          ctx.drawImage(im, -jb.w / 2, -jb.h / 2, jb.w, jb.h);
        } else {
          ctx.drawImage(im, jb.x, jb.y, jb.w, jb.h);
        }
        ctx.restore();
        left--; done();
      };
      im.onerror = function () { left--; done(); };
      im.src = jb.img;
    });
  }

  /* ---------- 总渲染 ---------- */
  var gridBound = false;
  function render() {
    if (!wm) return;                 // 尚未载入
    if (!gridBound) { bindGrid(); gridBound = true; }
    renderTools();
    applyCursor();
    $("#wmName").value = wm.name || "";
    $("#wmCols").value = wm.cols;
    $("#wmRows").value = wm.rows;
    $("#wmCell").value = wm.cell;
    $("#stage").style.background = wm.bg || "#f4efdf";
    renderPalette(); renderAssets(); renderGrid(); renderStamps();
    renderInspector();
    updateHint(); renderStats();
    DE.ui.expiryBanner($("#expiryBanner"));
  }

  bindTools(); bindUpload();
  DE.onTick = renderStats;

  /* ---------- 异步启动 ---------- */
  $("#grid").innerHTML = '<div class="empty" style="grid-column:1/-1;padding:60px">正在载入地图…</div>';
  DE.storage.init().then(function (mode) {
    if (mode !== "idb") DE.ui.toast("无法使用 IndexedDB，已降级到 localStorage（约 5MB）。", "err");
    return DE.journal.load();
  }).then(function (loaded) {
    J = loaded;
    DE.journal.book = J;
    wm = DE.journal.worldmap(J);
    render();
  }).catch(function () {
    DE.ui.toast("地图载入失败。", "err");
    wm = DE.worldmap.empty();
    render();
  });

}});
