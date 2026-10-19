/* ============================================================
 *  龙蛋物语 — 存储层
 *  主存储：IndexedDB（按磁盘空间计，通常可用到剩余空间的 60%，轻松上 GB）
 *  后备：  localStorage（约 5MB）——隐私模式 / 老浏览器自动降级
 *
 *  设计：内存里的手账对象仍是普通 JS 对象，图片字段统一为 dataURL，
 *        写入时把 dataURL 转成 Blob（IndexedDB 存二进制不膨胀 33%），
 *        读出时再转回 dataURL，页面代码无需关心差异。
 *  ============================================================ */
window.DE = window.DE || {};

DE.storage = {
  DB_NAME: "dragonEggDB",
  DB_VERSION: 1,
  STORE: "blobs",
  KEY: "journal",
  LS_KEY: "dragonEgg.journal.v1",

  _db: null,
  _mode: "unknown",        // idb | ls
  _ready: null,

  /* ---------- 能力探测 ---------- */
  hasIDB: function () {
    try { return typeof indexedDB !== "undefined" && !!indexedDB.open; }
    catch (e) { return false; }
  },

  open: function () {
    if (DE.storage._ready) return DE.storage._ready;
    DE.storage._ready = new Promise(function (resolve, reject) {
      if (!DE.storage.hasIDB()) { reject(new Error("no-indexeddb")); return; }
      var req;
      try { req = indexedDB.open(DE.storage.DB_NAME, DE.storage.DB_VERSION); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DE.storage.STORE)) {
          db.createObjectStore(DE.storage.STORE);
        }
      };
      req.onsuccess = function () { DE.storage._db = req.result; resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("idb-open-failed")); };
      req.onblocked = function () { reject(new Error("idb-blocked")); };
    });
    return DE.storage._ready;
  },

  /* 选择存储模式；返回 "idb" 或 "ls" */
  init: function () {
    if (DE.storage._mode !== "unknown") return Promise.resolve(DE.storage._mode);
    return DE.storage.open()
      .then(function () { DE.storage._mode = "idb"; return "idb"; })
      .catch(function () { DE.storage._mode = "ls"; return "ls"; });
  },

  mode: function () { return DE.storage._mode; },

  /* ---------- dataURL <-> Blob ---------- */
  dataURLtoBlob: function (d) {
    if (!d || d.indexOf("data:") !== 0) return null;
    var i = d.indexOf(",");
    var head = d.slice(5, i);
    var isB64 = /;base64/i.test(head);
    var mime = head.split(";")[0] || "application/octet-stream";
    var body = d.slice(i + 1);
    if (!isB64) {
      try { return new Blob([decodeURIComponent(body)], { type: mime }); }
      catch (e) { return null; }
    }
    var bin = atob(body);
    var len = bin.length;
    var buf = new Uint8Array(len);
    for (var k = 0; k < len; k++) buf[k] = bin.charCodeAt(k);
    return new Blob([buf], { type: mime });
  },

  blobToDataURL: function (b) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(b);
    });
  },

  /* 遍历对象里的图片字段（约定：值是以 "data:image" 开头的字符串） */
  IMG_KEYS: ["dataUrl"],
  walkImages: function (obj, fn) {
    if (!obj || typeof obj !== "object") return Promise.resolve();
    var jobs = [];
    (function rec(o) {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { o.forEach(rec); return; }
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (typeof v === "string" && v.indexOf("data:image") === 0) {
          jobs.push(fn(o, k, v));
        } else if (v && typeof v === "object") {
          rec(v);
        }
      });
    })(obj);
    return Promise.all(jobs);
  },

  /* ---------- 读 ---------- */
  load: function () {
    return DE.storage.init().then(function (mode) {
      if (mode === "ls") return DE.storage._loadLS();
      return DE.storage._loadIDB().catch(function () { return DE.storage._loadLS(); });
    });
  },

  _loadLS: function () {
    var raw = null;
    try { raw = localStorage.getItem(DE.storage.LS_KEY); } catch (e) {}
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  },

  _loadIDB: function () {
    return new Promise(function (resolve, reject) {
      var tx = DE.storage._db.transaction(DE.storage.STORE, "readonly");
      var req = tx.objectStore(DE.storage.STORE).get(DE.storage.KEY);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    }).then(function (rec) {
      if (!rec) {
        /* 首次使用：如果 localStorage 里有旧数据，迁移过来 */
        var legacy = DE.storage._loadLS();
        if (legacy) {
          return DE.storage.save(legacy, { silent: true }).then(function (r) {
            if (r.ok) {
              try { localStorage.removeItem(DE.storage.LS_KEY); } catch (e) {}
            }
            return legacy;
          });
        }
        return null;
      }
      /* Blob 还原为 dataURL */
      if (rec.blobs && rec.blobs.length) {
        return DE.storage.walkImages(rec.data, function (o, k, v) { return null; })
          .then(function () {
            var jobs = rec.blobs.map(function (b, i) {
              return b ? DE.storage.blobToDataURL(b) : Promise.resolve(null);
            });
            return Promise.all(jobs);
          })
          .then(function (urls) {
            var n = 0;
            DE.storage.walkImages(rec.data, function (o, k) {
              var u = urls[n++];
              if (u) o[k] = u; else delete o[k];
              return null;
            });
            return rec.data;
          });
      }
      return rec.data;
    });
  },

  /* ---------- 写 ---------- */
  /* 返回 Promise<{ok, error?, bytes?}> */
  save: function (data) {
    return DE.storage.init().then(function (mode) {
      if (mode === "ls") return DE.storage._saveLS(data);
      return DE.storage._saveIDB(data).catch(function (e) {
        /* IndexedDB 写失败（额度/权限）时退回 localStorage，并如实报告 */
        var r = DE.storage._saveLS(data);
        if (!r.ok) return { ok: false, error: "保存失败：" + (e && e.message ? e.message : e) };
        return r;
      });
    });
  },

  _saveLS: function (data) {
    try {
      localStorage.setItem(DE.storage.LS_KEY, JSON.stringify(data));
      return { ok: true, mode: "ls" };
    } catch (e) {
      var quota = /quota|exceeded|storage/i.test((e && e.name) + " " + (e && e.message));
      return {
        ok: false, mode: "ls",
        error: quota
          ? "浏览器本地存储（约 5MB）已满。建议改用支持 IndexedDB 的浏览器以获得 GB 级空间，或先导出手账备份后清理。"
          : "保存失败：" + (e && e.message ? e.message : e)
      };
    }
  },

  _saveIDB: function (data) {
    /* 抽出图片 -> Blob，其余走结构化克隆 */
    var blobs = [];
    var clone;
    try { clone = JSON.parse(JSON.stringify(data)); }
    catch (e) { return Promise.reject(e); }

    var pending = [];
    DE.storage.walkImages(clone, function (o, k, v) {
      var b = DE.storage.dataURLtoBlob(v);
      if (b) { blobs.push(b); o[k] = "«blob:" + (blobs.length - 1) + "»"; }
      else { delete o[k]; }
      return null;
    });
    return Promise.resolve(pending).then(function () {
      /* 把占位符换成真正的 Blob 对象 */
      DE.storage.walkImages(clone, function (o, k, v) {
        var m = /^«blob:(\d+)»$/.exec(v);
        if (m) o[k] = blobs[+m[1]];
        return null;
      });
      return new Promise(function (resolve, reject) {
        var tx = DE.storage._db.transaction(DE.storage.STORE, "readwrite");
        var rec = { data: clone, blobs: null, updatedISO: new Date().toISOString() };
        var req = tx.objectStore(DE.storage.STORE).put(rec, DE.storage.KEY);
        req.onsuccess = function () { resolve({ ok: true, mode: "idb" }); };
        req.onerror = function () { reject(req.error || new Error("idb-put-failed")); };
        tx.onabort = function () { reject(tx.error || new Error("idb-aborted")); };
      });
    });
  },

  clear: function () {
    try { localStorage.removeItem(DE.storage.LS_KEY); } catch (e) {}
    return DE.storage.init().then(function (mode) {
      if (mode !== "idb") return { ok: true };
      return new Promise(function (resolve) {
        var tx = DE.storage._db.transaction(DE.storage.STORE, "readwrite");
        tx.objectStore(DE.storage.STORE).delete(DE.storage.KEY);
        tx.oncomplete = function () { resolve({ ok: true }); };
        tx.onerror = function () { resolve({ ok: false }); };
      });
    });
  },

  /* ---------- 额度查询 ---------- */
  /* 返回 {usage, quota, available, percent} —— 单位字节；不支持时返回 null 字段 */
  estimate: function () {
    if (navigator.storage && navigator.storage.estimate) {
      return navigator.storage.estimate().then(function (e) {
        return {
          usage: e.usage || 0,
          quota: e.quota || 0,
          available: Math.max(0, (e.quota || 0) - (e.usage || 0)),
          percent: e.quota ? (e.usage / e.quota) * 100 : 0
        };
      }).catch(function () { return { usage: 0, quota: 0, available: 0, percent: 0 }; });
    }
    return Promise.resolve({ usage: 0, quota: 0, available: 0, percent: 0 });
  },

  /* 申请持久化存储，避免浏览器在空间紧张时清掉数据 */
  persist: function () {
    if (navigator.storage && navigator.storage.persist) {
      return navigator.storage.persist().then(function (granted) { return granted; })
        .catch(function () { return false; });
    }
    return Promise.resolve(false);
  },

  persisted: function () {
    if (navigator.storage && navigator.storage.persisted) {
      return navigator.storage.persisted().catch(function () { return false; });
    }
    return Promise.resolve(false);
  },

  fmt: function (n) {
    if (!n && n !== 0) return "—";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }
};
