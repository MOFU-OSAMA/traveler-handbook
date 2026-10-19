/* ============================================================
 *  龙蛋物语 — 马车（数据）
 *  来源：规则书 p171–p175「马车之旅 / 马车数据 / 马车改造」+
 *        用户提供的《马车房间增设规则》图示
 *  全部价格与效果照抄，不做推测；不可辨识处不收录。
 *  ============================================================ */
window.DE = window.DE || {};

DE.wagon = {

  /* ---------- 车种（p173） ---------- */
  TYPES: [
    {
      id: "light", name: "轻型马车", icon: "🛒",
      price: 3000, rentPerDay: 150,
      animals: "1 匹（大型驮货用动物 2 匹）",
      seats: 2, size: 20, capacity: "5（无人 15）",
      bonuses: ["【移动判定】+1"],
      desc: "近距离用小型马车，适合短距离移动和运货。有时也会被人类或小体型种族当作人力车来拉。",
      /* 房间规则（图示）
       * 3x3 / 4x4 是【一间房里的格子数】，不是房间数量。
       *   light：【默认】初始房间 x1，无法增添房间，但可以升级原本的初始房间
       *   four ：【默认】升级房间 x1，可添加房间 x2
       *   large：【默认】初始房间 x1，升级房间 x1，可添加房间 x3
       */
      startRooms: 1, addSlots: 0, upgradeSlots: 1, maxRooms: 1, canAddRooms: false
    },
    {
      id: "four", name: "四轮马车", icon: "🚚",
      price: 8000, rentPerDay: 400,
      animals: "2 匹（大型驮货用动物 1 匹）",
      seats: 6, size: 30, capacity: "20（无人 50）",
      bonuses: ["【移动判定】+1", "【野营判定】+1"],
      desc: "最普通的四轮马车，适用于运货、长距离旅行或公共马车等各种各样的用途。有着能够挡风遮雨的大顶篷，用作简易帐篷也十分方便。",
      startRooms: 1, addSlots: 2, upgradeSlots: 1, maxRooms: 3, canAddRooms: true
    },
    {
      id: "large", name: "大型马车", icon: "🏰",
      price: 20000, rentPerDay: 1000,
      animals: "4 匹（大型驮货用动物 2 匹）",
      seats: 6, size: 40, capacity: "20（无人 50）",
      bonuses: ["【移动判定】+2", "【野营判定】+2", "【礼仪教养】+2"],
      desc: "王公贵族和大商人等人物乘用的高级大型马车，加装了能够减缓车轮震动的减震装置，乘坐感受是其他车型无法比拟的舒适。",
      startRooms: 1, addSlots: 3, upgradeSlots: 1, maxRooms: 4, canAddRooms: true
    }
  ],
  findType: function (id) {
    return DE.wagon.TYPES.filter(function (t) { return t.id === id; })[0] || null;
  },

  /* ---------- 房间（图示） ---------- */
  ROOM_COST: { base: 1500, upgrade: 4000 },
  /* 卖回 / 降级一律退一半（和卖装潢、卖马车同一套规矩） */
  REFUND_RATE: 0.5,
  /* 增设一间房的实际价格（和 addRoom 用同一套算法，别写两遍） */
  roomPrice: function (w, index) {
    var t = DE.wagon.findType(w.type);
    if (!t) return DE.wagon.ROOM_COST.base;
    if (index === undefined) index = (w.rooms || []).length;
    var spec = DE.wagon.roomSpec(w.upgradeLevel);
    /* 第一间「增设」的房间按初始房间价 1500 G，之后按当前格数价 */
    return (index === t.startRooms && w.upgradeLevel === 1)
      ? DE.wagon.ROOM_COST.base : spec.price;
  },
  /* 退款一律向下取整，避免出现 0.5 G */
  refundOf: function (amount) {
    return Math.floor((amount || 0) * DE.wagon.REFUND_RATE);
  },

  roomSpec: function (level) {
    var n = level >= 2 ? 4 : 3;
    return { size: n, cells: n * n, price: level >= 2 ? 4000 : 1500,
             label: (level >= 2 ? "升级房间 " : "初始房间 ") + n + "×" + n };
  },
  /* 卧室里每张床能睡的人 */
  bedsPerRoom: 2,

  /* ---------- 内部装潢（图示 + p174 改造表） ---------- */
  INTERIOR: [
    { id: "chair", name: "椅子", icon: "🪑", price: 50, cells: 1, kind: "furniture",
      effect: "用来坐着，时间长了屁股痛痛。", short: "装饰 · 无判定加成" },
    { id: "bed", name: "床", icon: "🛏️", price: 1000, cells: 2, kind: "furniture",
      effect: "一张单人床。可供一人在【野营判定】失败时的回复量为 HP 和 MP 各 5 点。",
      short: "野营失败时 HP / MP 各 +5" },
    { id: "workbench", name: "工作台", icon: "🧰", price: 1500, cells: 1, kind: "fixture",
      effect: "用于辅助精细手工操作的铺展式作业台。手艺人进行〔制作〕〔修理〕判定时获得 +1 加值。",
      short: "手艺人〔制作〕〔修理〕+1" },
    { id: "cooking", name: "烹饪台", icon: "🍳", price: 1500, cells: 2, kind: "fixture",
      effect: "配备实用烹饪器具的铺展式厨房。手艺人（厨师）进行〔旅行料理〕判定时获得 +1 加值。",
      short: "手艺人（厨师）〔旅行料理〕+1" }
  ],

  /* ---------- 外部装潢（p174 马车改造） ---------- */
  EXTERIOR: [
    { id: "runners", name: "雪橇", icon: "🛷", price: 1000, cells: 0, kind: "fixture",
      effect: "可以安装在马车下部的雪上滑行用装置。目标值包含【雪】和【暴风雪】时，判定获得 +2 加值。",
      short: "【雪】【暴风雪】判定 +2" },
    { id: "canopy", name: "坚固的顶篷", icon: "⛺", price: 2000, cells: 0, kind: "fixture",
      effect: "将顶篷改为更加厚实、坚固的材料，以降低恶劣天气的影响。恶劣天气时的【野营判定】获得 +1 加值。",
      short: "恶劣天气【野营判定】+1" },
    { id: "wheels", name: "强化车轮", icon: "☸️", price: 2500, cells: 0, kind: "fixture",
      effect: "将车轮更换为强化材质，使行驶更为稳定。【移动判定】获得 +1 加值。",
      short: "【移动判定】+1" },
    { id: "armor", name: "装甲板", icon: "🛡️", price: 5000, cells: 0, kind: "fixture",
      effect: "加装厚实的装甲板，使马车在战斗中可以成为掩蔽物。战场里有马车时，位于“我方后方区域”的角色可获得防御点 +1 的加成。",
      short: "后方区域防御点 +1" }
  ],

  /* ---------- 房间用途 ---------- */
  ROOM_KINDS: [
    { id: "bedroom",   name: "寝室",   icon: "🛏️", desc: "放床提升野营失败时的回复。" },
    { id: "workshop",  name: "工房",   icon: "🔨", desc: "放工作台提升制作 / 修理。" },
    { id: "kitchen",   name: "厨房",   icon: "🍳", desc: "放烹饪台提升旅行料理。" },
    { id: "lounge",    name: "起居室", icon: "🛋️", desc: "放椅子，装饰用。" },
    { id: "storage",   name: "储物间", icon: "📦", desc: "空房间，留给行李。" }
  ],
  /* 房间的显示名：有自定义名就用它，否则回退到房型名 */
  roomName: function (room) {
    if (!room) return "房间";
    var custom = (room.name || "").trim();
    if (custom) return custom;
    return DE.wagon.findRoomKind(room.kind).name;
  },

  ROOM_NAME_MAX: 12,
  /* 给房间起名 / 改名（空字符串 = 恢复成房型名） */
  setRoomName: function (w, room, name) {
    if (!room) return { ok: false, msg: "没有这间房。" };
    var s = String(name === undefined || name === null ? "" : name).trim();
    /* 去掉换行，压缩连续空格 */
    s = s.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ");
    if (s.length > DE.wagon.ROOM_NAME_MAX)
      return { ok: false, msg: "名字太长了（最多 " + DE.wagon.ROOM_NAME_MAX + " 个字）。" };
    room.name = s;
    return { ok: true, msg: s ? "已改名为〈" + s + "〉。" : "已恢复成房型名。", name: s };
  },

  findRoomKind: function (id) {
    return DE.wagon.ROOM_KINDS.filter(function (k) { return k.id === id; })[0] || DE.wagon.ROOM_KINDS[0];
  },

  /* ---------- 全部可买项的查找 ---------- */
  allItems: function () {
    return DE.wagon.INTERIOR.concat(DE.wagon.EXTERIOR);
  },
  findItem: function (id) {
    return DE.wagon.allItems().filter(function (x) { return x.id === id; })[0] || null;
  },
  itemsOf: function (cat) {
    return cat === "exterior" ? DE.wagon.EXTERIOR : DE.wagon.INTERIOR;
  },

  /* ---------- 状态 ---------- */
  empty: function () {
    return {
      type: null,              // light | four | large
      upgradeLevel: 1,         // 每间房的格子数规格：1 = 3×3，2 = 4×4
      upgradeUsed: 0,          // 已用掉的「升级房间」名额
      addUsed: 0,              // 已用掉的「添加房间」名额
      roomCount: 0,
      rooms: [],               // { id, kind, grid, layout }
      owned: [],               // [{ itemId, qty }]
      updatedISO: new Date().toISOString()
    };
  },

  newRoom: function (level, kind, index) {
    var spec = DE.wagon.roomSpec(level);
    return {
      id: DE.uid("rm"),
      kind: kind || "storage",
      level: level || 1,
      grid: spec.size,
      placements: [],      // [{ pid, itemId, c, r, rot }] —— 家具实例（可拖拽 / 旋转）
      layout: {},          // 由 placements 推导出来的占格表（导出用）
      /* 空字符串 = 还没起名，显示时回退到房型名 */
      name: ""
    };
  },

  key: function (c, r) { return c + "," + r; },

  /* ---------- 拥有量 ---------- */

  /* 从任意实参里挑出「马车对象」和「家具 id」——
   * 有些调用点会多传一个角色对象，这里按类型识别，避免参数被顶位。 */
  _ids: function (args) {
    var w = null, id = null, qty = null;
    Array.prototype.slice.call(args).forEach(function (x) {
      if (typeof x === "string") { if (id === null) id = x; return; }
      if (typeof x === "number") { if (qty === null) qty = x; return; }
      if (x && typeof x === "object") {
        if (x.owned !== undefined || x.rooms !== undefined) w = x;
      }
    });
    return { w: w, id: id, qty: qty };
  },

  ownedQty: function (w, itemId) {
    var a = DE.wagon._ids(arguments);
    w = a.w; itemId = a.id;
    if (!w) return 0;
    var o = (w.owned || []).filter(function (x) { return x.itemId === itemId; })[0];
    return o ? o.qty : 0;
  },
  addOwned: function (w, itemId, qty) {
    var a = DE.wagon._ids(arguments);
    w = a.w; itemId = a.id; qty = a.qty || qty || 1;
    var o = (w.owned || []).filter(function (x) { return x.itemId === itemId; })[0];
    if (o) o.qty += qty;
    else { w.owned = w.owned || []; w.owned.push({ itemId: itemId, qty: qty }); }
    return w.owned;
  },
  removeOwned: function (w, itemId, qty) {
    var a = DE.wagon._ids(arguments);
    w = a.w; itemId = a.id; qty = a.qty || qty || 1;
    var o = (w.owned || []).filter(function (x) { return x.itemId === itemId; })[0];
    if (!o) return false;
    o.qty -= qty;
    if (o.qty <= 0) w.owned = w.owned.filter(function (x) { return x.itemId !== itemId; });
    return true;
  },
  /* 已经摆出去的某个家具数量（只数锚点格，"#2" 只是同一件的续格） */
  placedQty: function (w, itemId) {
    var a = DE.wagon._ids(arguments);
    w = a.w; itemId = a.id;
    var n = 0;
    if (!w) return 0;
    (w.rooms || []).forEach(function (rm) {
      DE.wagon.placementsOf(rm).forEach(function (p) { if (p.itemId === itemId) n++; });
    });
    return n;
  },
  /* 库里还有几件没摆出去 */
  stockQty: function (w, itemId) {
    var a = DE.wagon._ids(arguments);
    return DE.wagon.ownedQty(a.w, a.id) - DE.wagon.placedQty(a.w, a.id);
  },

  /* ---------- 摆放（带旋转） ---------- */
  /* 家具在某个旋转角度下占的格子数（宽 x 高） */
  footprint: function (itemId, rot) {
    var it = DE.wagon.findItem(itemId);
    if (!it) return { w: 1, h: 1 };
    rot = ((rot || 0) % 360 + 360) % 360;
    var n = Math.max(1, it.cells || 1);
    /* 0/180 横放；90/270 竖放 */
    return (rot === 90 || rot === 270) ? { w: 1, h: n } : { w: n, h: 1 };
  },

  /* 取某间房里的家具实例列表（注意：别叫 place —— 会和下面数据层的 place 重名） */
  placementsOf: function (room) {
    if (!room) return [];
    if (!Array.isArray(room.placements)) room.placements = [];
    return room.placements;
  },

  /* 重建 layout 占格表（c,r -> "itemId" 或 "itemId#2"） */
  _rebuildLayout: function (room) {
    var map = {};
    DE.wagon.placementsOf(room).forEach(function (p) {
      var fp = DE.wagon.footprint(p.itemId, p.rot);
      for (var dy = 0; dy < fp.h; dy++) {
        for (var dx = 0; dx < fp.w; dx++) {
          map[DE.wagon.key(p.c + dx, p.r + dy)] = (dx === 0 && dy === 0)
            ? p.itemId : (p.itemId + "#2");
        }
      }
    });
    room.layout = map;
    return map;
  },

  findPlacement: function (room, pid) {
    return DE.wagon.placementsOf(room).filter(function (p) { return p.pid === pid; })[0] || null;
  },

  /* 某件家具能否放在 (c,r) 并旋转 rot
   * 参数按类型识别，顺序可以随便传 —— 这样调用方多传 / 少传一个对象也不会
   * 悄悄把后面的参数顶位（之前就踩过这个坑：多传了角色对象导致家具 id 变成房间对象）。 */
  canPlace: function (a, b, c, d, e, f) {
    var room = null, itemId = null, nums = [];
    Array.prototype.slice.call(arguments).forEach(function (x) {
      if (typeof x === "string") { if (itemId === null) itemId = x; return; }
      if (typeof x === "number") { nums.push(x); return; }
      if (x && typeof x === "object") {
        if (x.grid !== undefined) room = x;          // 房间
        return;                                       // 角色 / 马车：忽略
      }
    });
    if (!room) return { ok: false, msg: "canPlace：没找到房间对象。" };
    if (!itemId) return { ok: false, msg: "canPlace：没找到家具 id。" };
    var cc = nums[0] || 0, rr = nums[1] || 0, rot = nums[2] || 0;

    var it = DE.wagon.findItem(itemId);
    if (!it) return { ok: false, msg: "找不到这件家具。" };
    rot = ((rot % 360) + 360) % 360;
    var fp = DE.wagon.footprint(itemId, rot);
    if (cc < 0 || rr < 0 || cc + fp.w > room.grid || rr + fp.h > room.grid)
      return { ok: false, msg: "放不下：这件家具在 " + rot + "° 时占 " +
        fp.w + "×" + fp.h + " 格，会超出房间。" };
    for (var dy = 0; dy < fp.h; dy++) {
      for (var dx = 0; dx < fp.w; dx++) {
        if (room.layout[DE.wagon.key(cc + dx, rr + dy)])
          return { ok: false, msg: "这里有东西挡住啦。" };
      }
    }
    return { ok: true, it: it, fp: fp, rot: rot, c: cc, r: rr };
  },

  addPlacement: function (w, room, itemId, c, r, rot) {
    rot = ((rot || 0) % 360 + 360) % 360;
    var chk = DE.wagon.canPlace(room, itemId, c, r, rot);
    if (!chk.ok) return chk;
    if (DE.wagon.stockQty(w, itemId) <= 0)
      return { ok: false, msg: "库存里没有〈" + chk.it.name + "〉了，先去购买。" };
    var p = { pid: DE.uid("wp"), itemId: itemId, c: c, r: r, rot: rot };
    DE.wagon.placementsOf(room).push(p);
    DE.wagon._rebuildLayout(room);
    return { ok: true, msg: "已摆上〈" + chk.it.name + "〉。", placement: p };
  },

  /* 把已有的一件家具移到新位置 / 新角度（拖拽、旋转都走这里） */
  movePlacement: function (w, room, pid, c, r, rot) {
    var p = DE.wagon.findPlacement(room, pid);
    if (!p) return { ok: false, msg: "找不到这件家具。" };
    rot = ((rot === undefined || rot === null) ? p.rot : rot);
    rot = ((rot % 360) + 360) % 360;
    var it = DE.wagon.findItem(p.itemId);
    var fp = DE.wagon.footprint(p.itemId, rot);
    if (c < 0 || r < 0 || c + fp.w > room.grid || r + fp.h > room.grid)
      return { ok: false, msg: "超出房间范围。" };
    /* 检查目标格（忽略自己原来占的格） */
    var mine = {};
    var oldFp = DE.wagon.footprint(p.itemId, p.rot);
    for (var dy = 0; dy < oldFp.h; dy++)
      for (var dx = 0; dx < oldFp.w; dx++) mine[DE.wagon.key(p.c + dx, p.r + dy)] = 1;
    for (var dy2 = 0; dy2 < fp.h; dy2++) {
      for (var dx2 = 0; dx2 < fp.w; dx2++) {
        var k = DE.wagon.key(c + dx2, r + dy2);
        if (room.layout[k] && !mine[k])
          return { ok: false, msg: "那里被〈" +
            ((DE.wagon.findItem(room.layout[k].replace(/#2$/, "")) || {}).name || "家具") + "〉占着。" };
      }
    }
    p.c = c; p.r = r; p.rot = rot;
    DE.wagon._rebuildLayout(room);
    return { ok: true, msg: "已移动〈" + (it ? it.name : "家具") + "〉。", placement: p };
  },

  /* 取出某格里的一件家具 */
  takeAt: function (w, room, c, r) {
    var v = (room.layout || {})[DE.wagon.key(c, r)];
    if (!v) return { ok: false, msg: "这一格是空的。" };
    var itemId = v.replace(/#2$/, "");
    /* 找到「占了这一格」的那件家具 */
    var hit = null;
    DE.wagon.placementsOf(room).forEach(function (p) {
      if (hit) return;
      var fp = DE.wagon.footprint(p.itemId, p.rot);
      if (p.itemId !== itemId) return;
      for (var dy = 0; dy < fp.h && !hit; dy++)
        for (var dx = 0; dx < fp.w && !hit; dx++)
          if (p.c + dx === c && p.r + dy === r) hit = p;
    });
    if (!hit) {                    /* 兜底：直接按 itemId 找第一件 */
      hit = DE.wagon.placementsOf(room).filter(function (p) { return p.itemId === itemId; })[0];
    }
    if (!hit) return { ok: false, msg: "找不到这件家具。" };
    room.placements = DE.wagon.placementsOf(room).filter(function (p) { return p.pid !== hit.pid; });
    DE.wagon._rebuildLayout(room);
    var it = DE.wagon.findItem(hit.itemId);
    return { ok: true, msg: "已收起〈" + (it ? it.name : "家具") + "〉。", itemId: hit.itemId };
  },

  /* 旋转某件家具（90° 一档，转不动就说明放不下） */
  rotatePlacement: function (w, room, pid) {
    var p = DE.wagon.findPlacement(room, pid);
    if (!p) return { ok: false, msg: "找不到这件家具。" };
    var it = DE.wagon.findItem(p.itemId);
    if (!it || (it.cells || 1) <= 1)
      return { ok: false, msg: "〈" + (it ? it.name : "这件家具") + "〉只占 1 格，旋转没有变化。" };
    var next = (p.rot + 90) % 360;
    var r = DE.wagon.movePlacement(w, room, pid, p.c, p.r, next);
    if (!r.ok) return { ok: false, msg: "转不过去：" + r.msg };
    return { ok: true, msg: "〈" + it.name + "〉转到 " + next + "°。", placement: p };
  },

  /* ---------- 购买 ---------- */
  buyType: function (c, w, typeId) {
    var t = DE.wagon.findType(typeId);
    if (!t) return { ok: false, msg: "找不到这种马车。" };
    if (w.type) return { ok: false, msg: "已经有马车了。换车请先卖掉现在的。" };
    if ((c.money || 0) < t.price)
      return { ok: false, msg: "金币不足：〈" + t.name + "〉要 " + t.price + " G，你只有 " + (c.money || 0) + " G。" };
    DE.ledger.spend(c, t.price, "wagon", "购买〈" + t.name + "〉");
    w.type = t.id;
    w.upgradeLevel = 1;
    w.upgradeUsed = 0;
    w.addUsed = 0;
    w.rooms = [];
    w.owned = [];
    for (var i = 0; i < t.startRooms; i++)
      w.rooms.push(DE.wagon.newRoom(1, i === 0 ? "bedroom" : "storage", i));
    w.roomCount = w.rooms.length;
    return { ok: true, msg: "买下了〈" + t.name + "〉（-" + t.price + " G），带 " + t.startRooms + " 间初始房间。" };
  },
  /* 增设房间（受车种上限限制） */
  addRoom: function (c, w, kind) {
    var t = DE.wagon.findType(w.type);
    if (!t) return { ok: false, msg: "还没有马车。" };
    var addLeft = (t.addSlots || 0) - (w.addUsed || 0);
    if (!t.canAddRooms || (t.addSlots || 0) === 0)
      return { ok: false, msg: "〈" + t.name + "〉无法增添房间（图示规则：只能升级原本的初始房间）。" };
    if (addLeft <= 0)
      return { ok: false, msg: "〈" + t.name + "〉的「可添加房间」名额用完了（" +
        (t.addSlots || 0) + "/" + (t.addSlots || 0) + "）。" };
    if (w.rooms.length >= t.maxRooms)
      return { ok: false, msg: "〈" + t.name + "〉最多 " + t.maxRooms + " 间房。" };
    var spec = DE.wagon.roomSpec(w.upgradeLevel);
    var room = DE.wagon.newRoom(w.upgradeLevel, kind || "storage", w.rooms.length);
    var price = DE.wagon.roomPrice(w, w.rooms.length);
    if ((c.money || 0) < price)
      return { ok: false, msg: "金币不足：增设房间要 " + price + " G，你只有 " + (c.money || 0) + " G。" };
    DE.ledger.spend(c, price, "wagon", "增设马车房间〈" + room.name + "〉（" +
      room.grid + "×" + room.grid + "）");
    w.rooms.push(room);
    w.addUsed = (w.addUsed || 0) + 1;
    w.roomCount = w.rooms.length;
    return { ok: true, msg: "增设了〈" + room.name + "〉（" + room.grid + "×" + room.grid +
      "，-" + price + " G）。" };
  },
  /* 升级房间规格 3×3 -> 4×4 */
  /* 升级：3×3 -> 4×4。按 placements 重建占格表，
   * 绝不能只改 layout —— placements 才是真身，不同步的话家具会「看不见但还占着格」。 */
  /* 升级：3×3 -> 4×4。按 placements 重建占格表 —— placements 才是真身，
   * 只改 layout 的话家具会「看不见但还占着格」。 */
  upgradeRooms: function (c, w) {
    var t = DE.wagon.findType(w.type);
    if (!t) return { ok: false, msg: "还没有马车。" };
    if ((t.upgradeSlots || 0) <= 0) return { ok: false, msg: "〈" + t.name + "〉没有「升级房间」名额。" };
    if ((w.upgradeUsed || 0) >= (t.upgradeSlots || 0))
      return { ok: false, msg: "〈" + t.name + "〉的「升级房间」名额用完了（" +
        (t.upgradeSlots || 0) + "/" + (t.upgradeSlots || 0) + "）。" };
    if (w.upgradeLevel >= 2) return { ok: false, msg: "房间格数已经是 4×4 了。" };
    var price = DE.wagon.ROOM_COST.upgrade;
    if ((c.money || 0) < price)
      return { ok: false, msg: "金币不足：升级房间要 " + price + " G，你只有 " + (c.money || 0) + " G。" };
    DE.ledger.spend(c, price, "wagon", "马车房间升级为 4×4");
    w.upgradeUsed = (w.upgradeUsed || 0) + 1;
    w.upgradeLevel = 2;
    var lost = 0;
    (w.rooms || []).forEach(function (rm) {
      rm.grid = 4;
      rm.level = 2;
      lost += DE.wagon._fitRoom(rm, 4);
    });
    return { ok: true, msg: "房间升级为 4×4（-" + price + " G）。" +
      (lost ? "有 " + lost + " 件家具超出了新范围，已收进仓库。" : ""), lost: lost };
  },

  /* 把房间里放不下的家具收起来，返回收起了几件。
   * 同时重建 layout —— 所有改变房间尺寸的地方都必须走这里。 */
  _fitRoom: function (rm, size) {
    if (!rm) return 0;
    var occupied = {}, keep = [], dropped = 0;
    DE.wagon.placementsOf(rm).forEach(function (p) {
      var it = DE.wagon.findItem(p.itemId);
      var rot = ((p.rot || 0) % 360 + 360) % 360;
      var fp = DE.wagon.footprint(p.itemId, rot);
      var fits = !!it && p.c >= 0 && p.r >= 0 &&
                 p.c + fp.w <= size && p.r + fp.h <= size;
      if (fits) {
        for (var dy = 0; dy < fp.h && fits; dy++)
          for (var dx = 0; dx < fp.w && fits; dx++)
            if (occupied[DE.wagon.key(p.c + dx, p.r + dy)]) fits = false;
      }
      if (!fits) { dropped++; return; }
      for (var dy2 = 0; dy2 < fp.h; dy2++)
        for (var dx2 = 0; dx2 < fp.w; dx2++)
          occupied[DE.wagon.key(p.c + dx2, p.r + dy2)] = 1;
      p.rot = rot;
      keep.push(p);
    });
    rm.placements = keep;
    DE.wagon._rebuildLayout(rm);
    return dropped;
  },

  /* 降级：4×4 -> 3×3，退还升级费的一半 */
  downgradeRooms: function (c, w) {
    var t = DE.wagon.findType(w.type);
    if (!t) return { ok: false, msg: "还没有马车。" };
    if ((w.upgradeLevel || 1) < 2)
      return { ok: false, msg: "房间本来就已经是 3×3 了，没什么可降的。" };
    var back = DE.wagon.refundOf(DE.wagon.ROOM_COST.upgrade);
    var lost = 0;
    (w.rooms || []).forEach(function (rm) {
      rm.grid = 3;
      rm.level = 1;
      lost += DE.wagon._fitRoom(rm, 3);
    });
    w.upgradeLevel = 1;
    w.upgradeUsed = Math.max(0, (w.upgradeUsed || 0) - 1);
    DE.ledger.earn(c, back, "wagon", "马车房间降级回 3×3（退还一半）");
    return { ok: true, msg: "房间降回 3×3（+" + back + " G，升级名额也退回来了）。" +
      (lost ? "有 " + lost + " 件家具放不下，已收进仓库。" : ""), lost: lost, back: back };
  },

  /* 拆除一间「增设」的房间，退还半价。初始房间不能拆（拆了就没地方住了）。 */
  sellRoom: function (c, w, index) {
    var t = DE.wagon.findType(w.type);
    if (!t) return { ok: false, msg: "还没有马车。" };
    if (index === undefined || index === null) return { ok: false, msg: "没说拆哪一间。" };
    var rooms = w.rooms || [];
    if (index < 0 || index >= rooms.length) return { ok: false, msg: "没有这一间房。" };
    if (index < (t.startRooms || 1))
      return { ok: false, msg: "初始房间不能拆除（拆了就没地方住了）。" };
    var rm = rooms[index];
    if (DE.wagon.placementsOf(rm).length)
      return { ok: false, msg: "〈" + DE.wagon.roomName(rm) +
        "〉里还有家具，先把它们收起来再拆。" };
    /* 退款按「当初买它的价格」算 */
    var back = DE.wagon.refundOf(DE.wagon.roomPrice(w, index));
    var name = DE.wagon.roomName(rm);
    rooms.splice(index, 1);
    w.addUsed = Math.max(0, (w.addUsed || 0) - 1);
    w.roomCount = rooms.length;
    DE.ledger.earn(c, back, "wagon", "拆除马车房间〈" + name + "〉（退还一半）");
    return { ok: true, msg: "拆除了〈" + name + "〉（+" + back +
      " G，名额也退回来了）。", back: back };
  },

  /* 买家具 */
  buyItem: function (c, w, itemId, qty) {
    var it = DE.wagon.findItem(itemId);
    if (!it) return { ok: false, msg: "找不到这件装潢。" };
    qty = Math.max(1, qty || 1);
    var total = it.price * qty;
    if ((c.money || 0) < total)
      return { ok: false, msg: "金币不足：〈" + it.name + "〉×" + qty + " 要 " + total +
        " G，你只有 " + (c.money || 0) + " G。" };
    DE.ledger.spend(c, total, "wagon", "购买马车装潢〈" + it.name + "〉×" + qty);
    DE.wagon.addOwned(w, itemId, qty);
    return { ok: true, msg: "买下〈" + it.name + "〉×" + qty + "（-" + total + " G）。" };
  },
  /* 卖出家具（半价回收） */
  sellItem: function (c, w, itemId) {
    var it = DE.wagon.findItem(itemId);
    if (!it) return { ok: false, msg: "找不到这件装潢。" };
    if (DE.wagon.stockQty(w, itemId) <= 0)
      return { ok: false, msg: "〈" + it.name + "〉没有闲置的，先把它从房间里收起来。" };
    var back = Math.floor(it.price / 2);
    DE.wagon.removeOwned(w, itemId, 1);
    DE.ledger.earn(c, back, "sell", "卖出马车装潢〈" + it.name + "〉（半价）");
    return { ok: true, msg: "卖出〈" + it.name + "〉（+" + back + " G）。" };
  },
  /* 卖掉马车 */
  sellWagon: function (c, w) {
    var t = DE.wagon.findType(w.type);
    if (!t) return { ok: false, msg: "还没有马车。" };
    var back = Math.floor(t.price / 2);
    /* 家具一并半价回收 */
    var extra = 0;
    (w.owned || []).forEach(function (o) {
      var it = DE.wagon.findItem(o.itemId);
      if (it) extra += Math.floor(it.price / 2) * o.qty;
    });
    DE.ledger.earn(c, back, "wagon", "卖掉〈" + t.name + "〉（半价）");
    if (extra) DE.ledger.earn(c, extra, "sell", "马车装潢回收（半价）");
    var name = t.name;
    var fresh = DE.wagon.empty();
    Object.keys(fresh).forEach(function (k) { w[k] = fresh[k]; });
    return { ok: true, msg: "卖掉了〈" + name + "〉（+" + back + " G）" +
      (extra ? "，家具回收 +" + extra + " G" : "") + "。" };
  },
  /* 从车上收下全部家具 */
  clearAll: function (w) {
    var n = 0;
    (w.rooms || []).forEach(function (rm) {
      n += DE.wagon.placementsOf(rm).length;
      rm.placements = [];
      rm.layout = {};
    });
    return n;
  },

  /* ---------- 统计 ---------- */
  stats: function (w) {
    var t = DE.wagon.findType(w.type);
    var out = {
      type: t, has: !!t,
      rooms: (w.rooms || []).length,
      grid: DE.wagon.roomSpec(w.upgradeLevel).size,
      upgradeLevel: w.upgradeLevel,
      cells: 0, used: 0, free: 0,
      invested: 0, beds: 0, fixtures: 0, furniture: 0,
      addSlots: 0, addUsed: 0, addLeft: 0,
      upgradeSlots: 0, upgradeUsed: 0, upgradeLeft: 0,
      bonuses: []
    };
    if (!t) return out;
    out.addSlots = t.addSlots || 0;
    out.addUsed = w.addUsed || 0;
    out.addLeft = Math.max(0, out.addSlots - out.addUsed);
    out.upgradeSlots = t.upgradeSlots || 0;
    out.upgradeUsed = w.upgradeUsed || 0;
    out.upgradeLeft = Math.max(0, out.upgradeSlots - out.upgradeUsed);
    (w.rooms || []).forEach(function (rm) {
      out.cells += rm.grid * rm.grid;
      DE.wagon.placementsOf(rm).forEach(function (p) {
        /* 「已用格数」按占格算，这样 2 格家具旋转后统计依然正确 */
        var fp = DE.wagon.footprint(p.itemId, p.rot);
        out.used += fp.w * fp.h;
        if (p.itemId === "bed") out.beds++;
      });
    });
    out.free = out.cells - out.used;
    out.invested = t.price + (w.rooms.length > t.startRooms ?
      (w.rooms.length - t.startRooms) * DE.wagon.roomSpec(w.upgradeLevel).price : 0) +
      (w.upgradeLevel >= 2 ? DE.wagon.ROOM_COST.upgrade : 0);
    (w.owned || []).forEach(function (o) {
      var it = DE.wagon.findItem(o.itemId);
      if (it) out.invested += it.price * o.qty;
    });
    /* 加值汇总 */
    t.bonuses.forEach(function (b) { out.bonuses.push(b); });
    var q = function (id) { return DE.wagon.ownedQty(w, id); };
    if (q("runners")) out.bonuses.push("【雪】【暴风雪】判定 +2（雪橇）");
    if (q("canopy")) out.bonuses.push("恶劣天气【野营判定】+1（坚固的顶篷）");
    if (q("wheels")) out.bonuses.push("【移动判定】+1（强化车轮）");
    if (q("armor")) out.bonuses.push("后方区域防御点 +1（装甲板）");
    if (q("workbench")) out.bonuses.push("手艺人〔制作〕〔修理〕+1（工作台）");
    if (q("cooking")) out.bonuses.push("手艺人（厨师）〔旅行料理〕+1（烹饪台）");
    if (out.beds) out.bonuses.push("野营失败时 HP / MP 各 +5（床 ×" + out.beds + "）");
    return out;
  },

  /* 取角色身上的马车，没有就建一个并回写。
   * 注意：一定要用这个，别自己 DE.wagon.empty() 建一个游离对象 —— 那样改动不会存进存档。 */
  ensure: function (c) {
    if (!c.wagon || typeof c.wagon !== "object") c.wagon = DE.wagon.empty();
    else DE.wagon.migrate(c.wagon);
    return c.wagon;
  },

  /* ---------- 迁移 ---------- */
  migrate: function (w) {
    var base = DE.wagon.empty();
    if (!w || typeof w !== "object") return base;
    for (var k in base) if (w[k] === undefined || w[k] === null) w[k] = base[k];
    if (!Array.isArray(w.rooms)) w.rooms = [];
    if (!Array.isArray(w.owned)) w.owned = [];
    if (w.upgradeLevel !== 2) w.upgradeLevel = 1;
    if (typeof w.upgradeUsed !== "number") w.upgradeUsed = w.upgradeLevel >= 2 ? 1 : 0;
    if (typeof w.addUsed !== "number") w.addUsed = 0;
    var t = DE.wagon.findType(w.type);
    if (!t) { w.type = null; w.rooms = []; w.owned = []; }
    if (t && w.rooms.length > t.maxRooms) {
      var dropped = w.rooms.length - t.maxRooms;
      w.rooms = w.rooms.slice(0, t.maxRooms);
      w.addUsed = Math.max(0, (w.addUsed || 0) - dropped);
    }
    if (t) {
      w.addUsed = Math.max(0, Math.min(t.addSlots || 0, w.addUsed || 0));
      w.upgradeUsed = Math.max(0, Math.min(t.upgradeSlots || 0, w.upgradeUsed || 0));
      if (w.upgradeLevel >= 2 && w.upgradeUsed === 0) w.upgradeUsed = 1;
    }
    w.rooms.forEach(function (rm) {
      var spec = DE.wagon.roomSpec(w.upgradeLevel);
      if (!Array.isArray(rm.placements)) rm.placements = [];
      if (!rm.layout || typeof rm.layout !== "object") rm.layout = {};
      if (rm.grid !== spec.size) rm.grid = spec.size;
      /* 老存档：只有 layout 没有 placements，按 layout 反推出来（旋转一律 0） */
      if (!rm.placements.length && Object.keys(rm.layout).length) {
        Object.keys(rm.layout).forEach(function (k) {
          var v = rm.layout[k];
          if (v.indexOf("#2") >= 0) return;
          var p2 = k.split(",");
          var it = DE.wagon.findItem(v);
          if (!it) return;
          rm.placements.push({ pid: DE.uid("wp"), itemId: v, c: +p2[0], r: +p2[1], rot: 0 });
        });
      }
      /* 清掉越界 / 非法 / 互相重叠的摆放 */
      var keep = [];
      var occupied = {};
      rm.placements.forEach(function (p) {
        var it = DE.wagon.findItem(p.itemId);
        if (!it) return;
        var rot = ((p.rot || 0) % 360 + 360) % 360;
        var fp = DE.wagon.footprint(p.itemId, rot);
        if (p.c < 0 || p.r < 0 || p.c + fp.w > rm.grid || p.r + fp.h > rm.grid) return;
        for (var dy = 0; dy < fp.h; dy++)
          for (var dx = 0; dx < fp.w; dx++)
            if (occupied[DE.wagon.key(p.c + dx, p.r + dy)]) return;
        for (var dy2 = 0; dy2 < fp.h; dy2++)
          for (var dx2 = 0; dx2 < fp.w; dx2++)
            occupied[DE.wagon.key(p.c + dx2, p.r + dy2)] = 1;
        if (!p.pid) p.pid = DE.uid("wp");
        p.rot = rot;
        keep.push(p);
      });
      rm.placements = keep;
      DE.wagon._rebuildLayout(rm);
      if (!rm.kind) rm.kind = "storage";
      /* 老的「第 N 间房」是自动名，升级成「留空 = 用房型名」 */
      if (typeof rm.name !== "string") rm.name = "";
      if (/^第\s*\d+\s*间房$/.test(rm.name)) rm.name = "";
    });
    /* 清掉非法的持有项 */
    w.owned = w.owned.filter(function (o) { return DE.wagon.findItem(o.itemId) && o.qty > 0; });
    w.roomCount = w.rooms.length;
    return w;
  }
};
