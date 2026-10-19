/* ============================================================
 *  龙蛋物语 — 旅行手账
 *  记录冒险中获得的地图图块、徽章、贴纸与旅行记录。
 *  图块以 dataURL 存于浏览器本地；支持导出 / 导入整本手账。
 *  ============================================================ */
window.DE = window.DE || {};

DE.JOURNAL_KEY = "dragonEgg.journal.v1";

/* ---------- 图块类型 ---------- */
DE.STICKER_KINDS = {
  map:    { label: "地图图块", icon: "🗺️", color: "#7ea86b",
            desc: "手绘地图的碎片，可以拖到「地图拼贴」页自由摆放。" },
  badge:  { label: "徽章",     icon: "🏅", color: "#b8892f",
            desc: "冒险中获得的徽章，代表一段功绩。" },
  sticker:{ label: "贴纸",     icon: "✨", color: "#6b8fb5",
            desc: "装饰用的小贴纸。" },
  stamp:  { label: "印章",     icon: "🔖", color: "#9b7bb5",
            desc: "城镇、公会或季节之龙盖下的印章。" }
};

/* 冒险记录默认的天气标签（与规则书天气表一致） */
DE.JOURNAL_WEATHERS = DE.WEATHERS ? DE.WEATHERS.map(function (w) { return w.name; })
                                  : ["雨", "强风", "雾", "炎热", "寒冷", "暴雨", "雪", "浓雾", "黑暗", "暴风雨", "暴风雪"];

/* ---------- 图像处理 ---------- */
/* 把上传的图片压到合适的尺寸与质量，避免占满 localStorage。
 * maxSide 默认 1280，质量 0.82：一张照片通常落在 150-250KB。 */
DE.journal = {

  DEFAULTS: { maxSide: 1280, quality: 0.82, maxBytesWarn: 200 * 1024 },

  /* 手账纸张（拼贴页背景） */
  PAPERS: [
    { id:"plain",  name:"素纸",   css:"#fdfaf2",
      style:"background:#fdfaf2" },
    { id:"grid",   name:"方格纸", css:"#fdfaf2",
      style:"background:#fdfaf2;background-image:linear-gradient(rgba(120,140,170,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(120,140,170,.18) 1px,transparent 1px);background-size:22px 22px" },
    { id:"line",   name:"横线纸", css:"#fdfaf2",
      style:"background:#fdfaf2;background-image:linear-gradient(rgba(120,140,170,.22) 1px,transparent 1px);background-size:100% 28px" },
    { id:"dot",    name:"点阵纸", css:"#fdfaf2",
      style:"background:#fdfaf2;background-image:radial-gradient(rgba(120,140,170,.35) 1.2px,transparent 1.2px);background-size:20px 20px" },
    { id:"kraft",  name:"牛皮纸", css:"#e8dcc0",
      style:"background:linear-gradient(180deg,#eadfc4,#e2d3b0)" },
    { id:"sepia",  name:"旧纸",   css:"#f2e7d0",
      style:"background:radial-gradient(circle at 30% 20%,#f7efdb,#e9dcc0)" },
    { id:"night",  name:"夜行",   css:"#2c3444",
      style:"background:linear-gradient(180deg,#333d50,#242b39)", dark:true }
  ],
  DEFAULT_PAPER: "grid",

  findPaper: function (id) {
    return DE.journal.PAPERS.filter(function (p) { return p.id === id; })[0] || DE.journal.PAPERS[0];
  },

  /* 读文件 -> 压缩后的 dataURL */
  readImage: function (file, opts) {
    opts = opts || {};
    var maxSide = opts.maxSide || DE.journal.DEFAULTS.maxSide;
    var quality = opts.quality || DE.journal.DEFAULTS.quality;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error("请选择图片文件（PNG / JPG / WebP / GIF）。"));
        return;
      }
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error("读取文件失败。")); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("这不是有效的图片，或格式不被浏览器支持。")); };
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            var scale = Math.min(1, maxSide / Math.max(w, h));
            var tw = Math.max(1, Math.round(w * scale));
            var th = Math.max(1, Math.round(h * scale));
            var cv = document.createElement("canvas");
            cv.width = tw; cv.height = th;
            var ctx = cv.getContext("2d");
            /* 透明底图（PNG 贴纸）保留透明通道 */
            var keepAlpha = /png|webp|gif/i.test(file.type);
            if (!keepAlpha) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, tw, th); }
            ctx.drawImage(img, 0, 0, tw, th);

            /* 去白底：把接近白色的像素变成透明，方便贴纸叠在纸上 */
            var knockedOut = 0;
            if (opts.whiteToAlpha) {
              try {
                var d = ctx.getImageData(0, 0, tw, th);
                var px = d.data;
                var tol = opts.whiteTolerance != null ? opts.whiteTolerance : 26;
                for (var i = 0; i < px.length; i += 4) {
                  var r2 = px[i], g2 = px[i + 1], b2 = px[i + 2];
                  if (r2 >= 255 - tol && g2 >= 255 - tol && b2 >= 255 - tol) {
                    px[i + 3] = 0; knockedOut++;
                  }
                }
                ctx.putImageData(d, 0, 0);
                keepAlpha = true;      /* 去白底必须走 PNG 才能保留透明 */
              } catch (e) { knockedOut = -1; }   // 跨域等异常时静默跳过
            }

            var out = keepAlpha ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", quality);
            resolve({ dataUrl: out, width: tw, height: th, origWidth: w, origHeight: h,
                      resized: scale < 1, keepAlpha: keepAlpha, knockedOut: knockedOut,
                      bytes: DE.journal.dataUrlBytes(out),
                      /* 顺手给出 Blob，存储层写 IndexedDB 时可直接复用 */
                      blob: (function () { try { return DE.storage.dataURLtoBlob(out); } catch (e) { return null; } })() });
          } catch (e) { reject(new Error("图片处理失败：" + e.message)); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  },

  /* dataURL 的实际字节数 */
  dataUrlBytes: function (d) {
    if (!d) return 0;
    var i = d.indexOf(",");
    var b64 = i >= 0 ? d.slice(i + 1) : d;
    var pad = (b64.match(/=+$/) || [""])[0].length;
    return Math.floor(b64.length * 3 / 4) - pad;
  },

  fmtBytes: function (n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  },

  /* ---------- 手账数据 ---------- */
  empty: function () {
    var first = DE.journal.newPage({ title: "主地图", group: "" });
    return {
      stickers: [], entries: [], groups: [],
      pages: [first], activePageId: first.id,
      /* 贴纸库：既可以直接贴到手账页上，也可以作为「奖励贴纸」的素材 */
      library: [],
      /* 手账纸张样式 */
      paper: DE.journal.DEFAULT_PAPER,
      /* 世界大地图 */
      worldmap: DE.worldmap ? DE.worldmap.empty() : null,
      canvasBg: "#fdfaf2", updatedISO: new Date().toISOString()
    };
  },

  /* ---------- 地图页 ---------- */
  newPage: function (o) {
    o = o || {};
    return {
      id: DE.uid("pg"),
      title: o.title || "新地图",
      group: o.group || "",
      bg: o.bg || "#fdfaf2",
      grid: o.grid !== false,
      note: o.note || "",
      createdISO: new Date().toISOString()
    };
  },

  findPage: function (j, id) {
    return (j.pages || []).filter(function (p) { return p.id === id; })[0] || null;
  },

  activePage: function (j) {
    if (!j.pages || !j.pages.length) {
      j.pages = [DE.journal.newPage({ title: "主地图" })];
      j.activePageId = j.pages[0].id;
    }
    return DE.journal.findPage(j, j.activePageId) || j.pages[0];
  },

  addPage: function (j, o) {
    var p = DE.journal.newPage(o);
    j.pages.push(p);
    j.activePageId = p.id;
    return p;
  },

  /* 复制一页（连同页上的图块一起复制） */
  duplicatePage: function (j, id) {
    var src = DE.journal.findPage(j, id);
    if (!src) return null;
    var copy = DE.journal.newPage({ title: src.title + " 副本", group: src.group, bg: src.bg, grid: src.grid, note: src.note });
    var map = {};
    j.stickers.forEach(function (s) {
      if (s.pageId !== src.id) return;
      var n = DE.journal.addSticker(j, {
        kind: s.kind, name: s.name, dataUrl: s.dataUrl, width: s.width, height: s.height,
        source: s.source, note: s.note, earnedISO: s.earnedISO
      });
      n.placed = true; n.x = s.x; n.y = s.y; n.scale = s.scale; n.rot = s.rot; n.z = s.z;
      n.pageId = copy.id;
      map[s.id] = n.id;
    });
    j.pages.push(copy);
    j.activePageId = copy.id;
    return copy;
  },

  removePage: function (j, id) {
    if ((j.pages || []).length <= 1) return { ok: false, msg: "至少要保留一页地图。" };
    var i = -1;
    j.pages.forEach(function (p, k) { if (p.id === id) i = k; });
    if (i < 0) return { ok: false, msg: "找不到该地图页。" };
    /* 页上的图块退回收藏（不删除图片数据） */
    var back = 0;
    j.stickers.forEach(function (s) {
      if (s.pageId === id) { s.placed = false; s.pageId = null; back++; }
    });
    j.pages.splice(i, 1);
    if (j.activePageId === id) j.activePageId = j.pages[0].id;
    return { ok: true, msg: "已删除该地图页，" + back + " 张图块已退回收藏。", returned: back };
  },

  /* ---------- 分组 ---------- */
  addGroup: function (j, name) {
    name = (name || "").trim();
    if (!name) return null;
    if ((j.groups || []).indexOf(name) < 0) j.groups.push(name);
    return name;
  },

  removeGroup: function (j, name) {
    var i = (j.groups || []).indexOf(name);
    if (i < 0) return false;
    j.groups.splice(i, 1);
    j.stickers.forEach(function (s) { if (s.group === name) s.group = ""; });
    j.pages.forEach(function (p) { if (p.group === name) p.group = ""; });
    return true;
  },

  /* 手账里出现过的全部分组（含未登记的） */
  allGroups: function (j) {
    var set = {};
    (j.groups || []).forEach(function (g) { if (g) set[g] = 1; });
    (j.stickers || []).forEach(function (s) { if (s.group) set[s.group] = 1; });
    (j.pages || []).forEach(function (p) { if (p.group) set[p.group] = 1; });
    return Object.keys(set).sort();
  },

  /* 异步：从 IndexedDB（或降级后的 localStorage）读取并做迁移 */
  load: function () {
    return DE.storage.load().then(function (j) {
      if (!j) return DE.journal.empty();
      return DE.journal._migrate(j);
    }).catch(function () { return DE.journal.empty(); });
  },

  /* 同步的后备读法（仅在存储层不可用时使用） */
  loadSync: function () {
    var raw = null;
    try { raw = localStorage.getItem(DE.JOURNAL_KEY); } catch (e) {}
    if (!raw) return DE.journal.empty();
    try { return DE.journal._migrate(JSON.parse(raw)); }
    catch (e) { return DE.journal.empty(); }
  },

  _migrate: function (j) {
    try {
      var base = DE.journal.empty();
      for (var k in base) if (j[k] === undefined || j[k] === null) j[k] = base[k];
      if (!Array.isArray(j.stickers)) j.stickers = [];
      if (!Array.isArray(j.entries)) j.entries = [];
      if (!Array.isArray(j.groups)) j.groups = [];
      if (!Array.isArray(j.library)) j.library = [];
      j.worldmap = DE.worldmap ? DE.worldmap.migrate(j.worldmap) : j.worldmap;
      if (!j.paper) j.paper = DE.journal.DEFAULT_PAPER;
      if (!Array.isArray(j.pages) || !j.pages.length) j.pages = [DE.journal.newPage({ title: "主地图" })];
      if (!DE.journal.findPage(j, j.activePageId)) j.activePageId = j.pages[0].id;
      /* 旧存档：已摆放但没有 pageId 的图块归入第一页 */
      j.stickers.forEach(function (s) {
        if (s.pageId === undefined) s.pageId = (s.placed ? j.pages[0].id : null);
        if (s.group === undefined) s.group = "";
      });
      /* 旧存档：冒险记录还没有拼贴 / 笔记本字段 */
      j.entries.forEach(function (e) {
        if (!Array.isArray(e.items)) e.items = [];
        if (!Array.isArray(e.badges)) e.badges = [];
        if (!e.paper) e.paper = j.paper;
        if (!e.cover) e.cover = DE.journal.DEFAULT_COVER;
        if (e.desc === undefined) e.desc = "";
        /* 单张拼贴的老数据升级成「第一张纸」 */
        if (!Array.isArray(e.pages) || !e.pages.length) {
          e.pages = [DE.journal.newLeaf({ paper: e.paper, items: e.items })];
        } else {
          e.pages.forEach(function (l) {
            if (!l.id) l.id = DE.uid("lf");
            if (!Array.isArray(l.items)) l.items = [];
            if (!l.paper) l.paper = e.paper || j.paper;
            if (l.title === undefined) l.title = "";
            /* 自由涂鸦：老存档没有就补空数组；顺手丢掉点数不足 2 的残笔 */
            if (!Array.isArray(l.strokes)) l.strokes = [];
            l.strokes = l.strokes.filter(function (st) {
              if (!st || !Array.isArray(st.pts) || st.pts.length < 2) return false;
              if (!st.kind) st.kind = "ink";
              if (st.alpha == null) st.alpha = 1;
              return true;
            });
          });
        }
      });
      return j;
    } catch (e) { return DE.journal.empty(); }
  },

  /* 异步保存。返回 Promise<{ok, mode?, error?}> */
  save: function (j) {
    j.updatedISO = new Date().toISOString();
    DE.journal.book = j;
    /* 存储模式尚未确定时给出一致的提示 */
    if (DE.storage.mode() !== "idb" && DE.storage.mode() !== "ls") {
      return DE.storage.init().then(function () { return DE.storage.save(j); });
    }
    return DE.storage.save(j);
  },

  /* 清空（含底层存储） */
  clearAll: function () {
    return DE.storage.clear().then(function () { return true; })
      .catch(function () { return false; });
  },

  totalBytes: function (j) {
    var a = (j.stickers || []).reduce(function (s, k) { return s + DE.journal.dataUrlBytes(k.dataUrl); }, 0);
    var m = j.worldmap ? (DE.worldmap.tileBytes(j.worldmap) +
      (j.worldmap.stamps || []).reduce(function (n, st) {
        var lb = (j.library || []).filter(function (x) { return x.id === st.libId; })[0];
        return n;                                   // 贴纸字节已计入 library
      }, 0)) : 0;
    return a + DE.journal.libBytes(j) + m;
  },

  /* ---------- 图块操作 ---------- */
  addSticker: function (j, s) {
    var st = {
      id: DE.uid("st"),
      kind: s.kind || "sticker",
      name: s.name || "未命名图块",
      dataUrl: s.dataUrl,
      width: s.width || 0,
      height: s.height || 0,
      bytes: DE.journal.dataUrlBytes(s.dataUrl),
      note: s.note || "",
      source: s.source || "",            // 来源：哪张地图 / 哪个城镇 / 哪段冒险
      group: s.group || "",              // 分组：季节 / 城镇 / 章节
      earnedISO: s.earnedISO || new Date().toISOString(),
      placed: false,
      pageId: null,                      // 摆在哪一页地图上
      x: 0, y: 0, scale: 1, rot: 0, z: 0
    };
    j.stickers.push(st);
    return st;
  },

  findSticker: function (j, id) {
    return (j.stickers || []).filter(function (s) { return s.id === id; })[0] || null;
  },

  removeSticker: function (j, id) {
    var i = -1;
    j.stickers.forEach(function (s, k) { if (s.id === id) i = k; });
    if (i < 0) return false;
    j.stickers.splice(i, 1);
    return true;
  },

  /* ---------- 冒险记录 ---------- */
  addEntry: function (j, e) {
    var it = {
      id: DE.uid("en"),
      title: e.title || "未命名旅程",
      day: e.day != null ? e.day : DE.clock.dayNumber(),
      terrain: e.terrain || "",
      weather: e.weather || "",
      members: e.members || "",
      loot: e.loot || "",
      badges: e.badges || [],          // 贴到这一页的徽章（贴纸 id）
      note: e.note || "",
      /* 笔记本：封面样式 + 多张纸 */
      cover: e.cover || DE.journal.DEFAULT_COVER,
      desc: e.desc || "",
      paper: e.paper || j.paper || DE.journal.DEFAULT_PAPER,
      /* 兼容旧结构：单张拼贴的内容升级成第一张纸 */
      pages: Array.isArray(e.pages) ? e.pages : [DE.journal.newLeaf({
        paper: e.paper || j.paper || DE.journal.DEFAULT_PAPER,
        items: e.items || []
      })],
      createdISO: new Date().toISOString()
    };
    j.entries.unshift(it);
    return it;
  },

  /* ---------- 封面样式 ---------- */
  COVERS: [
    { id:"kraft",  name:"牛皮本",  css:"linear-gradient(135deg,#c9a878,#a8814f)", ink:"#4a3418" },
    { id:"forest", name:"森林绿",  css:"linear-gradient(135deg,#5f8b6a,#3d6149)", ink:"#eef6ef" },
    { id:"night",  name:"夜空蓝",  css:"linear-gradient(135deg,#3b4a6b,#252f45)", ink:"#e6ecf7" },
    { id:"wine",   name:"酒红",    css:"linear-gradient(135deg,#8e3b3b,#5f2424)", ink:"#fbeceb" },
    { id:"rose",   name:"樱粉",    css:"linear-gradient(135deg,#d59aa8,#b0707f)", ink:"#fff4f6" },
    { id:"ink",    name:"墨黑",    css:"linear-gradient(135deg,#3a3a3c,#1e1e20)", ink:"#efeff2" }
  ],
  DEFAULT_COVER: "kraft",
  findCover: function (id) {
    return DE.journal.COVERS.filter(function (c) { return c.id === id; })[0] || DE.journal.COVERS[0];
  },

  /* ---------- 笔记本里的一「张」纸 ---------- */
  newLeaf: function (o) {
    o = o || {};
    return {
      id: DE.uid("lf"),
      /* 自由涂鸦：每笔 { color, size, pts:[[x,y],...] }，坐标是 0~1 的相对值，
         所以换纸尺寸 / 导出大图都不会偏。 */
      strokes: (o.strokes || []).slice(),
      title: o.title || "",
      paper: o.paper || DE.journal.DEFAULT_PAPER,
      items: o.items || [],
      createdISO: new Date().toISOString()
    };
  },

  leavesOf: function (e) {
    if (!e) return [];
    if (!Array.isArray(e.pages) || !e.pages.length) {
      e.pages = [DE.journal.newLeaf({ paper: e.paper, items: e.items || [] })];
    }
    return e.pages;
  },

  findLeaf: function (e, leafId) {
    return DE.journal.leavesOf(e).filter(function (l) { return l.id === leafId; })[0] || null;
  },

  addLeaf: function (e, o) {
    var l = DE.journal.newLeaf(o);
    DE.journal.leavesOf(e).push(l);
    return l;
  },

  duplicateLeaf: function (e, leafId) {
    var src = DE.journal.findLeaf(e, leafId);
    if (!src) return null;
    var copy = DE.journal.newLeaf({
      title: src.title, paper: src.paper,
      items: JSON.parse(JSON.stringify(src.items || []))
    });
    /* 新纸上的元素要有自己的 id */
    copy.items.forEach(function (it) { it.id = DE.uid("it"); });
    var ls = DE.journal.leavesOf(e);
    ls.splice(ls.indexOf(src) + 1, 0, copy);
    return copy;
  },

  removeLeaf: function (e, leafId) {
    var ls = DE.journal.leavesOf(e);
    if (ls.length <= 1) return { ok: false, msg: "每本笔记本至少保留一张纸。" };
    var i = -1;
    ls.forEach(function (l, k) { if (l.id === leafId) i = k; });
    if (i < 0) return { ok: false, msg: "找不到这张纸。" };
    ls.splice(i, 1);
    return { ok: true };
  },

  /* ---------- 元素操作改为「针对某张纸」 ---------- */
  addItemToLeaf: function (e, leafId, o) {
    var l = DE.journal.findLeaf(e, leafId);
    if (!l) return null;
    var it = DE.journal.newItem(o);
    l.items.push(it);
    return it;
  },

  findLeafItem: function (e, leafId, itemId) {
    var l = DE.journal.findLeaf(e, leafId);
    if (!l) return null;
    return (l.items || []).filter(function (i) { return i.id === itemId; })[0] || null;
  },

  removeLeafItem: function (e, leafId, itemId) {
    var l = DE.journal.findLeaf(e, leafId);
    if (!l) return false;
    var i = -1;
    (l.items || []).forEach(function (x, k) { if (x.id === itemId) i = k; });
    if (i < 0) return false;
    l.items.splice(i, 1);
    return true;
  },

  /* ---------- 自由涂鸦 ---------- */
  /* 涂鸦一笔。kind:
   *   ink    自由笔（pts 为路径）
   *   line   直线（pts[0] -> pts[1]）
   *   rect   矩形（pts[0] 左上、pts[1] 右下）
   *   ellipse 椭圆（外接矩形同上）
   *   arrow  箭头（pts[0] -> pts[1]）
   *   fill   荧光笔（半透明粗线）
   */
  addStroke: function (leaf, stroke) {
    if (!leaf) return null;
    if (!Array.isArray(leaf.strokes)) leaf.strokes = [];
    var st = {
      kind: stroke.kind || "ink",
      color: stroke.color || "#3a3128",
      size: stroke.size || 3,
      alpha: stroke.alpha != null ? stroke.alpha : 1,
      pts: (stroke.pts || []).map(function (p) { return [p[0], p[1]]; })
    };
    leaf.strokes.push(st);
    return st;
  },

  /* 擦除：把和 (x,y) 半径 r 相交的笔画删掉或切开。
   * 返回被改动的笔数。坐标与 pts 一样是 0~1 相对值。 */
  eraseAt: function (leaf, x, y, r) {
    if (!leaf || !Array.isArray(leaf.strokes)) return 0;
    var out = [], touched = 0;
    leaf.strokes.forEach(function (st) {
      var pts = st.pts || [];
      /* 形状类：命中外接框就整笔删掉 */
      if (st.kind && st.kind !== "ink") {
        var x0 = Math.min(pts[0][0], pts[1][0]), x1 = Math.max(pts[0][0], pts[1][0]);
        var y0 = Math.min(pts[0][1], pts[1][1]), y1 = Math.max(pts[0][1], pts[1][1]);
        if (x >= x0 - r && x <= x1 + r && y >= y0 - r && y <= y1 + r) { touched++; return; }
        out.push(st); return;
      }
      /* 自由笔：按命中切成若干段 */
      var segs = [], seg = [];
      pts.forEach(function (p) {
        var d = Math.sqrt((p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y));
        if (d <= r) {
          if (seg.length >= 2) segs.push(seg);
          seg = [];
        } else {
          seg.push(p);
        }
      });
      if (seg.length >= 2) segs.push(seg);
      if (segs.length === 1 && segs[0].length === pts.length) { out.push(st); return; }
      touched++;
      segs.forEach(function (g) {
        out.push({ kind: st.kind || "ink", color: st.color, size: st.size,
                   alpha: st.alpha != null ? st.alpha : 1, pts: g });
      });
    });
    leaf.strokes = out;
    return touched;
  },
  undoStroke: function (leaf) {
    if (!leaf || !Array.isArray(leaf.strokes) || !leaf.strokes.length) return false;
    leaf.strokes.pop();
    return true;
  },
  clearStrokes: function (leaf) {
    if (!leaf || !Array.isArray(leaf.strokes)) return 0;
    var n = leaf.strokes.length;
    leaf.strokes = [];
    return n;
  },
  strokeCount: function (leaf) {
    return (leaf && Array.isArray(leaf.strokes)) ? leaf.strokes.length : 0;
  },

  itemsOfLeaf: function (leaf) {
    return (leaf && Array.isArray(leaf.items) ? leaf.items.slice() : [])
      .sort(function (a, b) { return (a.z || 0) - (b.z || 0); });
  },

  /* 整本笔记本的元素总数 */
  itemCount: function (e) {
    return DE.journal.leavesOf(e).reduce(function (n, l) {
      return n + ((l.items && l.items.length) || 0);
    }, 0);
  },

  /* ---------- 拼贴元素 ---------- */
  /* type: "sticker"（引用贴纸库）| "text"（手写文字） */
  newItem: function (o) {
    o = o || {};
    return {
      id: DE.uid("it"),
      type: o.type || "sticker",
      stickerId: o.stickerId || null,   // type=sticker 时指向 library
      text: o.text || "",
      x: o.x != null ? o.x : 30,
      y: o.y != null ? o.y : 30,
      w: o.w != null ? o.w : (o.type === "text" ? 220 : 120),
      rot: o.rot || 0,
      z: o.z || 1,
      font: o.font || "hand",           // hand | serif | mono
      size: o.size || 26,
      color: o.color || "#3a3128",
      paperTape: !!o.paperTape             // 顶部一条胶带装饰
    };
  },

  /* 兼容旧接口：一律操作「第一张纸」。
   * 注意：绝不能写回 e.items —— 那个字段在迁移后已经废弃，
   * 写进去的东西在界面上看不见，导出时也会被丢掉。 */
  addItem: function (j, entryId, o) {
    var e = DE.journal.findEntry(j, entryId);
    if (!e) return null;
    var leaves = DE.journal.leavesOf(e);
    if (!leaves.length) DE.journal.addLeaf(e, {});
    return DE.journal.addItemToLeaf(e, DE.journal.leavesOf(e)[0].id, o);
  },

  /* 兼容旧接口：在整个笔记本的所有纸上找 */
  findItem: function (j, entryId, itemId) {
    var e = DE.journal.findEntry(j, entryId);
    if (!e) return null;
    var found = null;
    DE.journal.leavesOf(e).forEach(function (lf) {
      var hit = DE.journal.findLeafItem(e, lf.id, itemId);
      if (hit) found = hit;
    });
    return found;
  },

  /* 兼容旧接口：从所在的那张纸上移除 */
  removeItem: function (j, entryId, itemId) {
    var e = DE.journal.findEntry(j, entryId);
    if (!e) return false;
    var done = false;
    DE.journal.leavesOf(e).forEach(function (lf) {
      if (!done && DE.journal.removeLeafItem(e, lf.id, itemId)) done = true;
    });
    return done;
  },

  /* 兼容旧接口：整个笔记本里所有纸上的元素 */
  itemsOf: function (e) {
    var out = [];
    DE.journal.leavesOf(e).forEach(function (lf) {
      out = out.concat(DE.journal.itemsOfLeaf(lf));
    });
    return out;
  },

  /* ---------- 贴纸库 ---------- */
  addStickerLib: function (j, o) {
    if (!Array.isArray(j.library)) j.library = [];
    var it = {
      id: DE.uid("lib"),
      name: o.name || "未命名贴纸",
      dataUrl: o.dataUrl,
      width: o.width || 0,
      height: o.height || 0,
      bytes: DE.journal.dataUrlBytes(o.dataUrl),
      group: o.group || "",
      kind: o.kind || "sticker",       // badge | sticker | stamp | map | reward
      note: o.note || "",
      createdISO: new Date().toISOString()
    };
    j.library.push(it);
    return it;
  },

  findLib: function (j, id) {
    return (j.library || []).filter(function (x) { return x.id === id; })[0] || null;
  },

  removeLib: function (j, id) {
    var i = -1;
    (j.library || []).forEach(function (x, k) { if (x.id === id) i = k; });
    if (i < 0) return false;
    j.library.splice(i, 1);
    /* 同时清掉地图上的贴纸 */
    if (j.worldmap && Array.isArray(j.worldmap.stamps)) {
      j.worldmap.stamps = j.worldmap.stamps.filter(function (st) { return st.libId !== id; });
    }
    /* 同时清掉所有笔记本里引用它的贴纸元素 */
    (j.entries || []).forEach(function (e) {
      DE.journal.leavesOf(e).forEach(function (l) {
        if (Array.isArray(l.items)) {
          l.items = l.items.filter(function (it) { return it.stickerId !== id; });
        }
      });
    });
    return true;
  },

  libGroups: function (j) {
    var set = {};
    (j.library || []).forEach(function (x) { if (x.group) set[x.group] = 1; });
    return Object.keys(set).sort();
  },

  /* 贴纸库占用的字节 */
  libBytes: function (j) {
    return (j.library || []).reduce(function (s, x) { return s + (x.bytes || 0); }, 0);
  },

  /* ---------- 拼贴页吸附（与地图同一套逻辑，尺寸用元素实际像素） ---------- */
  snapItem: function (moving, others, tol, canvasW, canvasH) {
    return DE.journal.snap(moving, others, tol, canvasW, canvasH);
  },

  findEntry: function (j, id) {
    return (j.entries || []).filter(function (e) { return e.id === id; })[0] || null;
  },

  removeEntry: function (j, id) {
    var i = -1;
    j.entries.forEach(function (e, k) { if (e.id === id) i = k; });
    if (i < 0) return false;
    j.entries.splice(i, 1);
    return true;
  },

  /* ---------- 统计 ---------- */
  stats: function (j) {
    var by = { map: 0, badge: 0, sticker: 0, stamp: 0 };
    (j.stickers || []).forEach(function (s) { by[s.kind] = (by[s.kind] || 0) + 1; });
    return {
      total: (j.stickers || []).length,
      byKind: by,
      placed: (j.stickers || []).filter(function (s) { return s.placed; }).length,
      entries: (j.entries || []).length,
      pages: (j.pages || []).length,
      groups: DE.journal.allGroups(j).length,
      library: (j.library || []).length,
      scrapItems: (j.entries || []).reduce(function (n, e) {
        return n + DE.journal.itemCount(e);
      }, 0),
      leaves: (j.entries || []).reduce(function (n, e) {
        return n + DE.journal.leavesOf(e).length;
      }, 0),
      mapCells: j.worldmap ? Object.keys(j.worldmap.cells || {}).length : 0,
      mapTiles: j.worldmap ? (j.worldmap.tiles || []).length : 0,
      mapStamps: j.worldmap ? (j.worldmap.stamps || []).length : 0,
      bytes: DE.journal.totalBytes(j) + DE.journal.libBytes(j)
    };
  },

  /* 某一页上的图块（按 z 升序） */
  tilesOfPage: function (j, pageId) {
    return (j.stickers || []).filter(function (s) { return s.placed && s.pageId === pageId; })
      .sort(function (a, b) { return (a.z || 0) - (b.z || 0); });
  },

  /* ---------- 吸附对齐 ----------
   * 拖动中的图块与其他图块 / 画布中线的距离在 tol 像素内即吸附。
   * 返回 {x, y, guides:[{axis,pos,from,to}]}，guides 用于画辅助线。 */
  snap: function (moving, others, tol, canvasW, canvasH) {
    tol = tol || 8;
    var w = moving.w, h = moving.h;
    var cand = { x: [], y: [] };

    /* 移动块的 3 条竖线 / 3 条横线 */
    function vlines(x) { return [x, x + w / 2, x + w]; }
    function hlines(y) { return [y, y + h / 2, y + h]; }

    /* 画布中线 */
    cand.x.push({ v: canvasW / 2, kind: "canvas" });
    cand.y.push({ v: canvasH / 2, kind: "canvas" });

    (others || []).forEach(function (o) {
      var ov = vlines(o.x), oh = hlines(o.y);
      ov.forEach(function (v, i) { cand.x.push({ v: v, i: i, other: o }); });
      oh.forEach(function (v, i) { cand.y.push({ v: v, i: i, other: o }); });
    });

    var guides = [];
    var rx = moving.x, ry = moving.y;
    var bestX = null, bestY = null;

    var mv = vlines(moving.x);
    cand.x.forEach(function (c) {
      mv.forEach(function (m, mi) {
        var d = c.v - m;
        if (Math.abs(d) <= tol && (!bestX || Math.abs(d) < Math.abs(bestX.d))) {
          bestX = { d: d, pos: c.v, mi: mi, other: c.other, kind: c.kind };
        }
      });
    });
    var mh = hlines(moving.y);
    cand.y.forEach(function (c) {
      mh.forEach(function (m, mi) {
        var d = c.v - m;
        if (Math.abs(d) <= tol && (!bestY || Math.abs(d) < Math.abs(bestY.d))) {
          bestY = { d: d, pos: c.v, mi: mi, other: c.other, kind: c.kind };
        }
      });
    });

    if (bestX) {
      rx = moving.x + bestX.d;
      guides.push({ axis: "v", pos: bestX.pos });
    }
    if (bestY) {
      ry = moving.y + bestY.d;
      guides.push({ axis: "h", pos: bestY.pos });
    }
    return { x: Math.round(rx), y: Math.round(ry), guides: guides };
  },

  /* ---------- 导出 / 导入 ---------- */
  exportJSON: function (j) {
    return JSON.stringify({
      app: "dragonEgg", kind: "journal", version: 1,
      exportedAt: new Date().toISOString(),
      journal: {
        stickers: j.stickers, entries: j.entries, groups: j.groups || [],
        pages: j.pages || [], activePageId: j.activePageId || null,
        library: j.library || [], paper: j.paper || DE.journal.DEFAULT_PAPER,
        worldmap: j.worldmap || null,
        canvasBg: j.canvasBg
      }
    }, null, 2);
  },

  importJSON: function (text) {
    var o = JSON.parse(text);
    var j = o.journal || o;
    if (!j || !Array.isArray(j.stickers)) throw new Error("这不是有效的手账存档。");
    var out = {
      stickers: j.stickers, entries: j.entries || [], groups: j.groups || [],
      library: j.library || [], paper: j.paper || DE.journal.DEFAULT_PAPER,
      worldmap: DE.worldmap ? DE.worldmap.migrate(j.worldmap) : (j.worldmap || null),
      pages: (Array.isArray(j.pages) && j.pages.length) ? j.pages : [DE.journal.newPage({ title: "主地图" })],
      activePageId: j.activePageId || null,
      canvasBg: j.canvasBg || "#fdfaf2",
      updatedISO: new Date().toISOString()
    };
    if (!DE.journal.findPage(out, out.activePageId)) out.activePageId = out.pages[0].id;
    /* 兼容旧备份：已摆放但无 pageId 的图块归入第一页 */
    out.stickers.forEach(function (s) {
      if (s.pageId === undefined) s.pageId = (s.placed ? out.pages[0].id : null);
      if (s.group === undefined) s.group = "";
    });
    /* 兼容旧备份：冒险记录没有拼贴字段时补上 */
    out.entries.forEach(function (e) {
      if (!Array.isArray(e.items)) e.items = [];
      if (!e.paper) e.paper = out.paper;
      if (!e.cover) e.cover = DE.journal.DEFAULT_COVER;
      if (e.desc === undefined) e.desc = "";
      if (!Array.isArray(e.pages) || !e.pages.length) {
        e.pages = [DE.journal.newLeaf({ paper: e.paper, items: e.items })];
      } else {
        e.pages.forEach(function (l) {
          if (!l.id) l.id = DE.uid("lf");
          if (!Array.isArray(l.items)) l.items = [];
          if (!l.paper) l.paper = e.paper || out.paper;
          if (l.title === undefined) l.title = "";
        });
      }
    });
    return out;
  }
};

DE.journal.book = null;

/* 取当前世界地图（没有就建一张） */
DE.journal.worldmap = function (j) {
  j = j || DE.journal.book;
  if (!j) return null;
  if (!j.worldmap) j.worldmap = DE.worldmap.empty();
  return j.worldmap;
};
