(function () {
  var q = new URLSearchParams(location.search);
  if (!q.has("__m")) return;

  function box(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.left), y: Math.round(r.top),
      display: cs.display, position: cs.position,
      fontSize: cs.fontSize, color: cs.color, overflowX: cs.overflowX
    };
  }
  function pick(sel) { try { return box(document.querySelector(sel)); } catch (e) { return null; } }

  function collect() {
    var out = {
      page: location.pathname,
      href: location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
      doc: { scrollW: document.documentElement.scrollWidth,
             clientW: document.documentElement.clientWidth },
      named: {},          // 具名选择器
      horizontalOverflow: [],   // 比视口宽的元素（横向滚动条的元凶）
      undefinedText: [],        // 文字里出现 undefined / NaN
      tinyText: []              // 小于 10px 的文字
    };

    var SELECTORS = {
      wrap: ".wrap",
      pageTitle: ".page-title",
      travelerCard: "#cardTraveler > .grid.c2 > .card",
      dragonWrap: "#dragonWrap",
      dragonCard: "#cardDragon",
      dragonInnerCard: "#cardDragon .card",
      casterBox: "#casterBox",
      slotBox: "#slotBox",
      mpBar: "#mpBar",
      wgRooms: "#wgRooms",
      pixroom: "#pixroom",
      bagGrid: "#bagGrid",
      moneyHero: "#moneyHero",
      statusPanel: "#statusPanel",
      clockChip: "#clockChip",
      ledgerPanel: "#ledgerPanel"
    };
    Object.keys(SELECTORS).forEach(function (k) { out.named[k] = pick(SELECTORS[k]); });

    // 该有内容却是空的容器（这类问题截图上看不出来，必须靠测量）
    out.empties = [];
    var WATCH = ["#checkPanel","#slotBox","#casterBox","#portraitSlot",
                 "#dragonWrap","#dragonCard","#stepNav","#stepDoc","#moneyHero","#statusPanel",
                 "#wgRooms","#bagGrid","#expiryTable","#derivedBox","#professionBox"];
    WATCH.forEach(function (sel) {
      var e = document.querySelector(sel);
      if (!e) return;   /* 本页没有这个元素很正常，不算问题 */
      var r = e.getBoundingClientRect();
      var txt = (e.textContent || "").trim();
      var kids = e.children ? e.children.length : 0;
      if (r.height < 2 && !txt && !kids) out.empties.push(sel + " : 高 0 且空");
      else if (!txt && !kids) out.empties.push(sel + " : 有高度但内部完全没有节点");
    });

    // 上传控件是否存在（头像上传依赖它）
    out.uploads = [];
    var bodies = document.querySelectorAll(".pt-body");
    for (var u = 0; u < bodies.length; u++) {
      var b = bodies[u];
      var r = b.getBoundingClientRect();
      var inps = b.parentNode ? b.parentNode.getElementsByTagName("input") : [];
      var hasFile = false;
      for (var q = 0; q < inps.length; q++) {
        if ((inps[q].type || "") === "file") hasFile = true;
      }
      out.uploads.push({
        id: b.id || "(无 id)",
        w: Math.round(r.width), h: Math.round(r.height),
        hasImage: !!b.getElementsByTagName("img").length,
        emptyLabel: !!b.querySelector(".pt-empty"),
        hasFileInput: hasFile,
        fileInputs: inps.length
      });
    }
    out.journalReadImage = !!(window.DE && DE.journal && typeof DE.journal.readImage === "function");

    // 网格类组件的实际尺寸（徽章墙 / 贴纸库 —— 这类"看着太大"的问题必须量出来）
    out.grids = [];
    [".badgewall", ".stickerlib"].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (g) {
        var r = g.getBoundingClientRect();
        if (!r.height) return;
        var kids = g.children ? g.children.length : 0;
        var first = g.children && g.children[0];
        var fr = first ? first.getBoundingClientRect() : null;
        var img = first ? first.querySelector("img") : null;
        var ir = img ? img.getBoundingClientRect() : null;
        /* 列数 = 容器宽 / 单格宽 */
        var cols = (fr && fr.width) ? Math.round(r.width / fr.width) : 0;
        out.grids.push({
          sel: sel,
          containerW: Math.round(r.width), containerH: Math.round(r.height),
          items: kids,
          cellW: fr ? Math.round(fr.width) : null,
          cellH: fr ? Math.round(fr.height) : null,
          imgH: ir ? Math.round(ir.height) : null,
          cols: cols,
          overflowY: g.scrollHeight > g.clientHeight + 2
        });
      });
    });

    // 重复 id（同一 id 出现多次 = 页面上真的有重复块）
    var idCount = {};
    var ids = document.querySelectorAll("[id]");
    for (var a = 0; a < ids.length; a++) {
      var v = ids[a].id;
      idCount[v] = (idCount[v] || 0) + 1;
    }
    out.duplicateIds = Object.keys(idCount).filter(function (k) { return idCount[k] > 1; })
      .map(function (k) { return k + " x" + idCount[k]; });

    // 关键字段在页面上出现几次（用来判断「基本信息」这类块有没有重复）
    out.fieldCounts = {};
    ["d_name","d_player","d_clan","d_level","d_sessions","d_lp","d_mission",
     "f_name","f_profession","sec-basic","sec-weapon","sec-derived"].forEach(function (sel) {
      try { out.fieldCounts[sel] = document.querySelectorAll("#" + sel).length; } catch (e) {}
    });
    out.headings = Array.prototype.slice.call(document.querySelectorAll("h2, h3"))
      .map(function (h) { return (h.textContent || "").trim().slice(0, 24); });

    // 横向溢出检查
    var all = document.querySelectorAll("body *");
    for (var i = 0; i < all.length && out.horizontalOverflow.length < 25; i++) {
      var el = all[i];
      var r = el.getBoundingClientRect();
      if (r.width > window.innerWidth + 2) {
        out.horizontalOverflow.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && String(el.className).slice(0, 60)) || "",
          id: el.id || "",
          w: Math.round(r.width)
        });
      }
    }

    // 文字异常
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      var t = (n.nodeValue || "").trim();
      if (!t) continue;
      var pe = n.parentElement;
      if (!pe) continue;
      var pt = (pe.tagName || "").toLowerCase();
      if (pt === "script" || pt === "style" || pt === "template") continue;
      if (/undefined|NaN|\[object Object\]/.test(t) && out.undefinedText.length < 20) {
        out.undefinedText.push({ text: t.slice(0, 60), parent: pe.tagName.toLowerCase() + (pe.id ? "#" + pe.id : "") });
      }
      var fs = parseFloat(getComputedStyle(pe).fontSize) || 0;
      if (fs > 0 && fs < 10 && out.tinyText.length < 10) {
        out.tinyText.push({ text: t.slice(0, 40), fontSize: fs });
      }
    }
    return out;
  }

  function send() {
    var data = collect();
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/__measure", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(JSON.stringify(data));
    } catch (e) {}
    // 页面上给个反馈
    try {
      var tag = document.createElement("div");
      tag.textContent = "已把 " + data.page + " 的几何发给服务器 ✓";
      tag.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:999999;background:#1f7a4d;" +
        "color:#fff;font:12px system-ui;padding:6px 10px;border-radius:8px";
      document.body.appendChild(tag);
      setTimeout(function () { if (tag.parentNode) tag.parentNode.removeChild(tag); }, 2500);
    } catch (e) {}
  }

  if (document.readyState === "complete") setTimeout(send, 400);
  else window.addEventListener("load", function () { setTimeout(send, 400); });
})();
