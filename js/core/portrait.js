/* ============================================================
 *  龙蛋物语 — 头像 / 立绘上传
 *  头像 / 立绘上传控件。
 *  ============================================================ */
window.DE = window.DE || {};

DE.portrait = {

  DEFAULTS: { maxSide: 640, quality: 0.85 },

  /* 上传后压到长边 maxSide（头像 640 足够清晰，也省空间）
   * 优先用 DE.journal.readImage（和手账共用一套）；万一那个模块没加载，
   * 就用自带的 canvas 兜底 —— 绝不能因为少引一个脚本就让「上传」点了没反应。 */
  read: function (file, opts) {
    var o = {
      maxSide: (opts && opts.maxSide) || DE.portrait.DEFAULTS.maxSide,
      quality: (opts && opts.quality) || DE.portrait.DEFAULTS.quality,
      whiteToAlpha: !!(opts && opts.whiteToAlpha)
    };
    if (DE.journal && typeof DE.journal.readImage === "function") {
      return DE.journal.readImage(file, o);
    }
    return DE.portrait._readLocal(file, o);
  },

  /* 自带兜底：FileReader -> Image -> canvas 缩放 -> dataURL */
  _readLocal: function (file, o) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error("没有选到文件。")); return; }
      if (!/^image\//.test(file.type || "")) {
        reject(new Error("这不是图片文件。"));
        return;
      }
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error("读取文件失败。")); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("这张图片无法解码。")); };
        img.onload = function () {
          try {
            var w = img.width, h = img.height, k = 1;
            var max = Math.max(w, h);
            if (max > o.maxSide) k = o.maxSide / max;
            var cw = Math.max(1, Math.round(w * k));
            var ch = Math.max(1, Math.round(h * k));
            var cv = document.createElement("canvas");
            cv.width = cw; cv.height = ch;
            var ctx = cv.getContext("2d");
            ctx.drawImage(img, 0, 0, cw, ch);
            var url = cv.toDataURL("image/jpeg", o.quality);
            resolve({ dataUrl: url, width: cw, height: ch,
                      bytes: Math.round(url.length * 0.75) });
          } catch (e) { reject(e); }
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  },

  /* 渲染一个头像控件。
   * opts: { id, label, hint, value, shape: "round"|"card", onPick(dataUrl), onClear() } */
  render: function (opts) {
    var v = opts.value || "";
    var shape = opts.shape || "card";
    var box = document.createElement("div");
    box.className = "pt";
    box.innerHTML =
      '<div class="pt-head"><b>' + DE.ui.esc(opts.label || "头像") + "</b>" +
        (opts.hint ? '<span class="hint">' + DE.ui.esc(opts.hint) + "</span>" : "") + "</div>" +
      '<div class="pt-body' + (shape === "round" ? " round" : "") + '" id="' + opts.id + '">' +
        (v
          ? '<img src="' + v + '" alt="头像">'
          : '<div class="pt-empty"><span class="i">🖼️</span><span>点击或拖入图片</span></div>') +
        '<div class="pt-mask">' +
          '<button class="sm primary" data-pt="pick">' + (v ? "更换" : "上传") + "</button>" +
          (v ? '<button class="sm ghost" data-pt="clear">移除</button>' : "") +
        "</div>" +
      "</div>" +
      '<input type="file" accept="image/*" style="display:none" data-pt="file">';

    var body = box.querySelector(".pt-body");
    var input = box.querySelector('[data-pt="file"]');

    function open() { input.click(); }
    box.querySelector('[data-pt="pick"]').onclick = function (e) { e.stopPropagation(); open(); };
    body.onclick = open;
    var clr = box.querySelector('[data-pt="clear"]');
    if (clr) clr.onclick = function (e) {
      e.stopPropagation();
      if (opts.onClear) opts.onClear();
    };
    ["dragenter", "dragover"].forEach(function (ev) {
      body.addEventListener(ev, function (e) { e.preventDefault(); body.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      body.addEventListener(ev, function (e) { e.preventDefault(); body.classList.remove("over"); });
    });
    body.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handle(f);
    });
    input.onchange = function () { if (this.files && this.files[0]) handle(this.files[0]); };

    function handle(file) {
      DE.portrait.read(file).then(function (r) {
        if (opts.onPick) opts.onPick(r.dataUrl, r);
      }).catch(function (err) {
        DE.ui.toast("头像处理失败：" + err.message, "err");
      });
    }
    return box;
  },

  /* 把一个头像挂到容器里（会替换容器内容） */
  mount: function (container, opts) {
    container.innerHTML = "";
    container.appendChild(DE.portrait.render(opts));
  }
};
