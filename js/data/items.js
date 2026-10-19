/* ============================================================
 *  龙蛋物语 车卡 / 背包 / 商店  —  物品数据库
 *  数据来源：《龙蛋物语 全规则优化带书签 v2.4》道具章节 p44-p53
 *  ============================================================ */
window.DE = window.DE || {};

/* ---------- 道具特征表 (p45) ---------- */
/* 价格修正：先计算乘法（小数向上取整），再计算加法 */
DE.TRAITS = {
  multiplier: [
    { name: "可爱的",   mult: 2,   effect: "颜色或形状惹人喜爱。" },
    { name: "华丽的",   mult: 2,   effect: "颜色或形状十分美丽。" },
    { name: "结实的",   mult: 3,   effect: "耐久度变为原本的 2 倍，难以破坏。" },
    { name: "高品质的", mult: 5,   effect: "武器的命中 +1，防具的防御点 +1，其他道具的加值在原有基础上再 +1。" },
    { name: "二手的",   mult: 0.8, effect: "被人使用后卖掉的道具，耐久度减少为 1 点。" },
    { name: "恶心的",   mult: 0.8, effect: "看上去让人反胃。" },
    { name: "土气的",   mult: 0.8, effect: "审美不入流或者老旧。" },
    { name: "有异味的", mult: 0.7, effect: "散发着味道的道具，洗也洗不掉。" },
    { name: "被诅咒的", mult: 0.5, effect: "被诅咒的道具，持有和使用该道具的角色每天的【状态值】受到 -1 的减值。" },
    { name: "损坏的",   mult: 0.5, effect: "损坏的道具无法使用，需要修理。拥有这类特征的道具一般不会在市面上贩卖。" }
  ],
  material: [
    { name: "秘银的",   mult: 10, effect: "防具的减值恢复 1，尺寸 -2，耐久度自动变为 5。" },
    { name: "奥利哈刚的", mult: 50, effect: "绝对不会损坏，穿着此素材制作的装备时 HP 和 MP 的上限 +2。" }
  ],
  magic: [
    { name: "会走路的", add: 5000, effect: "移动时，此道具会自动追随角色，不用手持。" },
    { name: "发光的",   add: 1200, effect: "持续散发火把程度的光芒。" },
    { name: "会说话的", add: 2000, effect: "非常话唠。" },
    { name: "魔法强化的", add: 8000, effect: "武器的伤害 +1，防具的防御点 +1，其他道具的加值在原有基础上再 +1。" }
  ]
};
DE.ALL_TRAITS = function () {
  return DE.TRAITS.multiplier.concat(DE.TRAITS.material, DE.TRAITS.magic);
};
DE.findTrait = function (n) {
  return DE.ALL_TRAITS().filter(function (x) { return x.name === n; })[0] || null;
};
/* 计算价格：先乘法（向上取整）后加法 */
DE.calcTraitPrice = function (basePrice, traitNames) {
  var p = basePrice;
  (traitNames || []).forEach(function (n) {
    var t = DE.findTrait(n);
    if (t && typeof t.mult === "number") p = p * t.mult;
  });
  p = Math.ceil(p);
  (traitNames || []).forEach(function (n) {
    var t = DE.findTrait(n);
    if (t && typeof t.add === "number") p = p + t.add;
  });
  return p;
};

/* ---------- 道具类别 ---------- */
DE.CATEGORIES = {
  weapon:    { label: "武器",     icon: "⚔️", group: "装备" },
  armor:     { label: "铠甲",     icon: "🛡️", group: "装备" },
  shield:    { label: "盾",       icon: "🔰", group: "装备" },
  shoes:     { label: "鞋子",     icon: "🥾", group: "旅途装备" },
  cloak:     { label: "披风",     icon: "🧥", group: "旅途装备" },
  cane:      { label: "手杖",     icon: "🦯", group: "旅途装备" },
  hat:       { label: "帽子",     icon: "🎩", group: "旅途装备" },
  other:     { label: "其他",     icon: "👓", group: "旅途装备" },
  container: { label: "容器",     icon: "🎒", group: "容器" },
  large:     { label: "大型容器", icon: "📦", group: "容器" },
  food:      { label: "食物",     icon: "🍖", group: "消耗品" },
  daily:     { label: "日用杂货", icon: "🧴", group: "消耗品" },
  camp:      { label: "野营用品", icon: "⛺", group: "消耗品" },
  animal:    { label: "动物",     icon: "🐴", group: "动物" },
  herb:      { label: "药草",     icon: "🌿", group: "药草" },
  set:       { label: "道具套装", icon: "🎁", group: "套装" }
};

/* ---------- 物品主表 ----------
 * size: 尺寸 1/3/5   price: 金币
 * slot: weapon|body|shield 表示可装备，装备栏内尺寸视为 0
 */
DE.ITEMS = [
  /* ===== 武器 (p47) ===== */
  { id:"w_dagger", icon:"🗡️", name:"短剑", cat:"weapon", price:400, size:1, slot:"weapon", hand:"单手",
    hit:"敏捷+智力+1", dmg:"智力-1", durability:1,
    desc:"手掌大小的武器，除了战斗，短剑还能广泛运用在做饭、割草等工作中。" },
  { id:"w_longsword", icon:"⚔️", name:"长剑", cat:"weapon", price:700, size:3, slot:"weapon", hand:"单手",
    hit:"体力+敏捷", dmg:"体力", durability:3,
    desc:"较长的平刃武器，单刃为刀，双刃为剑，是世界广泛流传的武器。" },
  { id:"w_spear", icon:"🔱", name:"长枪", cat:"weapon", price:350, size:3, slot:"weapon", hand:"双手",
    hit:"体力+敏捷", dmg:"体力+1", durability:3,
    desc:"前段镶有尖刃的长木棒型武器，可以突刺，也可以用柄部殴打，用途多样，且价格便宜、使用方法简单。" },
  { id:"w_axe", icon:"🪓", name:"斧子", cat:"weapon", price:500, size:3, slot:"weapon", hand:"双手",
    hit:"体力+体力-1", dmg:"体力", durability:3,
    desc:"伐木用道具。该武器较为沉重，应变能力差，但可以只依仗力量使用。" },
  { id:"w_bow", icon:"🏹", name:"弓箭", cat:"weapon", price:750, size:3, slot:"weapon", hand:"双手",
    hit:"智力+敏捷-2", dmg:"敏捷", durability:3,
    desc:"猎人们常使用的射击武器，因为能够远距离攻击而十分受贵族和战士的欢迎（※ 箭矢无需购买，会自动补充）。" },

  /* ===== 铠甲 (p47) ===== */
  { id:"a_traveler", icon:"👕", name:"旅行者服装", cat:"armor", price:50, size:3, slot:"body",
    def:0, penalty:0, durability:3,
    desc:"普通的衣服，用料厚实、不易损坏，很受旅行者的喜爱，一般使用羊毛或棉花制造。" },
  { id:"a_light", icon:"🦺", name:"轻甲", cat:"armor", price:900, size:3, slot:"body",
    def:1, penalty:0, durability:3,
    desc:"用动物的皮加工，并且在重点部位用金属加强制成的铠甲，只能保护躯干，但相对轻巧，便于使用。" },
  { id:"a_medium", icon:"🛡️", name:"中甲", cat:"armor", price:2000, size:5, slot:"body",
    def:2, penalty:-1, durability:5,
    desc:"金属经过加工后制成的铠甲，除了躯干还能保护到四肢，但相当有重量。" },
  { id:"a_heavy", icon:"🏋️", name:"重甲", cat:"armor", price:10000, size:5, slot:"body",
    def:3, penalty:-3, durability:5,
    desc:"金属经过加工后制成的、覆盖全身的重甲，穿上后行动会受到很大的限制，穿着后的行动十分艰难。" },

  /* ===== 盾 (p47) ===== */
  { id:"s_small", icon:"🔰", name:"小盾", cat:"shield", price:400, size:3, slot:"shield", hand:"单手",
    block:7, penalty:0, durability:3,
    desc:"能够单手持有的盾，一般用皮革或木材制作，轻巧，不会妨碍战斗。" },
  { id:"s_large", icon:"🛡️", name:"大盾", cat:"shield", price:1200, size:3, slot:"shield", hand:"单手",
    block:9, penalty:-1, durability:3,
    desc:"能够遮挡半个身体的盾，多用金属制成，非常沉重，难以携带。" },

  /* ===== 旅途装备 · 鞋子 (p48) ===== */
  { id:"t_rainboots", icon:"🥾", name:"雨靴", cat:"shoes", price:300, size:1, bonus:"雨、暴雨、暴风雨 +1", durability:1,
    desc:"进行了防水加工，水难以渗透。为了防水，鞋帮也做得很高。" },
  { id:"t_walkingshoes", icon:"👟", name:"步行鞋", cat:"shoes", price:350, size:1, bonus:"有道路的地貌 +1", durability:1,
    desc:"使用了柔软的皮革制作，非常轻便，不会妨碍走路，适合在铺设的道路上行走。" },
  { id:"t_climbboots", icon:"🥾", name:"登山鞋", cat:"shoes", price:450, size:1, bonus:"岩地、丘陵、山峦、高山 +1", durability:1,
    desc:"鞋底进行了加厚处理，并做成防滑式样，即使在坚硬的岩地里行走也不会脚疼。" },
  { id:"t_snowboots", icon:"🥾", name:"雪地靴", cat:"shoes", price:500, size:1, bonus:"雪、暴风雪 +1", durability:1,
    desc:"为了保护脚趾不被冻伤，进行了特殊加工。" },
  { id:"t_mudboots", icon:"🥾", name:"泥地鞋", cat:"shoes", price:500, size:1, bonus:"湿地 +1", durability:1,
    desc:"为了不陷入泥潭，扩宽了鞋底，能够在泥地上滑动前行。" },
  { id:"t_forestboots", icon:"🥾", name:"林地靴", cat:"shoes", price:600, size:1, bonus:"树林、森林、密林 +1", durability:1,
    desc:"为了在枝叶茂盛的地方或草丛中行走而设计的靴子，能够彻底地保护脚底，结实不易损坏。" },

  /* ===== 旅途装备 · 披风 (p48) ===== */
  { id:"t_windcloak", icon:"🧥", name:"防风披风", cat:"cloak", price:120, size:3, bonus:"强风 +1", durability:3,
    desc:"附带帽子、遮盖全身的披风。披风上缝有重物，在大风中也不会被掀起来。" },
  { id:"t_coldcloak", icon:"🧥", name:"防寒披风", cat:"cloak", price:160, size:3, bonus:"寒冷 +1", durability:3,
    desc:"使用保温性良好的动物毛皮制作的披风，也可以当作睡具或毛毯使用。" },
  { id:"t_raincloak", icon:"🧥", name:"遮雨披风", cat:"cloak", price:400, size:3, bonus:"雨、暴雨、雪 +1", durability:3,
    desc:"使用防水加工后的皮革制作而成，能够防水。需要精心保养。" },
  { id:"t_camocloak", icon:"🥷", name:"迷彩披风", cat:"cloak", price:400, size:3, bonus:"选择的地貌【躲藏判定】+1", durability:3,
    desc:"购买时选择一种地貌作为迷彩纹样。该披风遮盖全身，并能融入周围的环境色。" },
  { id:"t_firecloak", icon:"🧥", name:"耐火披风", cat:"cloak", price:700, size:3, bonus:"减少 1 点高温伤害", durability:3,
    desc:"使用耐火怪物的毛皮制作而成，不能防水，沾水后将不能再被使用。" },
  { id:"t_suncloak", icon:"🧥", name:"遮阳披风", cat:"cloak", price:400, size:3, bonus:"炎热 +1", durability:3,
    desc:"为了让热气快速散发出去，使用了轻便且通气性良好的素材。" },

  /* ===== 旅途装备 · 手杖 (p48) ===== */
  { id:"t_walkingcane", icon:"🦯", name:"步行杖", cat:"cane", price:50, size:3, bonus:"不超过等级 3 的地貌 +1", durability:3,
    desc:"只对体力〈4〉的角色有效。步行杖能够帮助没有体力的旅行者，背负重行李时有一根步行杖会更加方便。" },
  { id:"t_climbcane", icon:"🥾", name:"爬山杖", cat:"cane", price:100, size:3, bonus:"丘陵、山峦 +1", durability:3,
    desc:"攀爬高山时，为了保持平衡而使用的手杖，可以调节长短。" },
  { id:"t_icecane", icon:"⛏️", name:"破冰杖", cat:"cane", price:280, size:3, bonus:"雪 +1", durability:3,
    desc:"专为刨雪开路而制作的手杖，底部装有金属以便凿开冻冰。" },

  /* ===== 旅途装备 · 帽子 (p48) ===== */
  { id:"t_hat", icon:"🎩", name:"帽子", cat:"hat", price:120, size:1, bonus:"—", durability:1,
    desc:"一般的帽子，颜色形状多样。人们相信帽子能够驱魔。" },
  { id:"t_sunhat", icon:"👒", name:"遮阳帽", cat:"hat", price:180, size:1, bonus:"炎热 +1", durability:1,
    desc:"帽檐非常大，用以遮住强烈的日照。一般使用麻和棉等通气素材制作。" },
  { id:"t_furhat", icon:"🧢", name:"毛皮帽", cat:"hat", price:200, size:1, bonus:"寒冷 +1", durability:1,
    desc:"使用保温性良好的动物毛皮制作的帽子，为了防寒，也遮住了耳朵。" },
  { id:"t_sandscarf", icon:"🧣", name:"防沙巾", cat:"hat", price:340, size:1, bonus:"沙漠 +1", durability:1,
    desc:"让人能在强风和沙尘暴中视物的头巾，质地厚实，能保护使用者不受阳光直晒。" },

  /* ===== 旅途装备 · 其他 (p48) ===== */
  { id:"t_goggles", icon:"🥽", name:"护目镜", cat:"other", price:4000, size:1, bonus:"雨、强风、暴雨、雪、暴风雨、暴风雪 +1", durability:1,
    desc:"在风吹雨打的环境下保护眼睛的道具，使用各种工艺复合制作而成，因此造价昂贵。" },
  { id:"t_accessory", icon:"💍", name:"饰品", cat:"other", price:100, priceText:"100 ～", size:1, bonus:"—", durability:1, variablePrice:true,
    desc:"戒指、耳环、项链等装饰品。材料包括金属、贝壳、干果等体现当地特色的素材。" },

  /* ===== 容器 (p51) ===== */
  { id:"c_waterskin", icon:"🧴", name:"水袋", cat:"container", price:30, size:1, durability:1,
    special:"holdsWater", holdsWater:true,
    desc:"使用动物皮和树皮加工而成的结实水袋，能够装入 1 天份的水。" },
  { id:"c_magicbottle", icon:"⚗️", name:"魔法瓶", cat:"container", price:2000, size:1, durability:1,
    bonus:"以寒冷、炎热为目标值的【移动判定】+1", holdsWater:true,
    desc:"以寒冷、炎热为目标值的【移动判定】获得 +1 加值。这个用魔法制作的瓶子能够维持瓶内液体的温度。容量能够装入 1 天份的水。" },
  { id:"c_sack", icon:"👝", name:"麻袋", cat:"container", price:10, size:1, capacity:3, durability:1,
    desc:"需要单手持用。没有什么装饰，只是个麻袋。" },
  { id:"c_waistpouch", icon:"👛", name:"腰包", cat:"container", price:30, size:1, capacity:2, durability:1,
    special:"oneOnly", desc:"腰上只能别一个腰包，腰包里可以装入想要马上取出来的小道具。" },
  { id:"c_herbbottle", icon:"🏺", name:"药草瓶", cat:"container", price:100, size:3, capacity:0, durability:3,
    special:"herbBottle", herbCapacity:10, lifetimeDays:7,
    desc:"经过特殊加工的瓶子，最多能够保存 10 个〈药草〉。从开始使用计算，第 7 天瓶子本身将失去保存能力，不能再使用。其中的药草也不能再装入其他容器。" },

  /* ===== 大型容器 (p51) ===== */
  { id:"L_bucket", icon:"🪣", name:"水桶", cat:"large", price:10, size:5, capacity:10, durability:5,
    holdsWater:true, waterDays:15,
    desc:"能够装入 15 天份水的木桶。没有装水的时候，被视为容量 10 的容器。" },
  { id:"L_backpack", icon:"🎒", name:"背包", cat:"large", price:20, size:3, capacity:5, durability:3,
    desc:"用来携带旅行必需品的普通背包。" },
  { id:"L_bigbackpack", icon:"🎒", name:"大背包", cat:"large", price:40, size:3, capacity:10, durability:3,
    desc:"能够装入很多货物的大背包。" },
  { id:"L_chest", icon:"🧰", name:"木箱", cat:"large", price:10, size:5, capacity:15, durability:5,
    penaltyNote:"人类搬运木箱时，【移动判定】受到 -1 减值",
    desc:"人类搬运木箱时，【移动判定】受到 -1 减值。能够装入很多货物，但很难运输。" },

  /* ===== 食物 (p50) ===== */
  { id:"f_ingredients", icon:"🥩", name:"食材", cat:"food", price:5, size:1, durability:1, perishDays:1,
    desc:"生肉和蔬菜等未经过处理的食材，因为没有加工，大约 24 小时后就会变得无法食用。" },
  { id:"f_wine", icon:"🍷", name:"酒", cat:"food", price:10, size:1, durability:1,
    desc:"各种各样的酒。角色若在【状态值】不超过 3 时饮酒，会陷入异常状态【激动：4】。" },
  { id:"f_badration", icon:"🥴", name:"难吃的干粮", cat:"food", price:5, size:1, durability:1,
    desc:"味道十分难吃，无法入口的食物。角色若在【状态值】不超过 3 时食用，则 MP 减为 1/2。" },
  { id:"f_ration", icon:"🍞", name:"干粮", cat:"food", price:10, size:1, durability:1,
    desc:"旅行中不可或缺的可携带食物，味道一般。" },
  { id:"f_goodration", icon:"🍱", name:"好吃的干粮", cat:"food", price:70, size:1, durability:1,
    desc:"超级好吃的食物，食用后第二天的【状态判定】获得 +1 加值。" },
  { id:"f_feed", icon:"🌾", name:"动物饲料", cat:"food", price:5, size:1, durability:1,
    desc:"为动物准备的可携带食物，只有在沙漠和高山的地貌时需要。" },

  /* ===== 日用杂货 (p50) ===== */
  { id:"d_perfume", icon:"🌸", name:"香水", cat:"daily", price:500, size:1, durability:1,
    desc:"装入小瓶里的好闻液体。能够在 12 小时之内暂时消除特征〈有异味的〉。" },
  { id:"d_quill", icon:"🪶", name:"羽毛笔", cat:"daily", price:2, size:1, durability:1,
    desc:"将鸟类羽毛的根部斜着剪短而制作成的笔。" },
  { id:"d_glasspen", icon:"🖊️", name:"玻璃笔", cat:"daily", price:120, size:1, durability:1,
    desc:"持笔部位为玻璃制作的高价笔。" },
  { id:"d_parchment", icon:"📜", name:"羊皮纸", cat:"daily", price:2, size:1, durability:1,
    desc:"用动物的皮加工制成的纸张，结实且难以损坏。" },
  { id:"d_leatherbook", icon:"📔", name:"革制书皮本", cat:"daily", price:100, size:1, durability:1,
    desc:"书皮是用动物的皮加固的笔记本。" },
  { id:"d_soap", icon:"🧼", name:"香皂", cat:"daily", price:5, size:1, durability:1,
    desc:"沾水后起泡，可以用来清洗身体。" },
  { id:"d_laundry", icon:"🧺", name:"洗衣套装", cat:"daily", price:15, size:3, durability:3,
    desc:"洗衣石和洗衣板的配套组合。" },
  { id:"d_umbrella", icon:"☂️", name:"伞", cat:"daily", price:50, size:3, durability:3,
    bonus:"以炎热或雨为目标值的【移动判定】+1",
    desc:"以炎热或雨为目标值的【移动判定】获得 +1 加值。伞能够单手使用，有各式各样的颜色、花纹和形状。" },
  { id:"d_compass", icon:"🧭", name:"指南针", cat:"daily", price:1500, size:1, durability:1,
    bonus:"【方向判定】+1",
    desc:"【方向判定】获得 +1 加值。能够辅助使用者辨认方向。" },
  { id:"d_torch", icon:"🔥", name:"火把", cat:"daily", price:5, size:1, durability:1,
    desc:"一端加装了助燃素材的木棍。能够照亮黑暗。" },
  { id:"d_lantern", icon:"🏮", name:"提灯", cat:"daily", price:80, size:1, durability:1,
    desc:"照明道具，附有遮风护罩，使火焰不易熄灭。" },
  { id:"d_firekit", icon:"🔥", name:"生火套装", cat:"daily", price:20, size:1, durability:1,
    desc:"包含了打火石在内，方便点火的便利配套组合。" },
  { id:"d_tableware", icon:"🍽️", name:"餐具", cat:"daily", price:10, size:1, durability:1,
    desc:"形状、大小、材质各不相同。" },
  { id:"d_cookware", icon:"🍳", name:"厨艺套装", cat:"daily", price:100, size:1, durability:1,
    desc:"包含刀具等做饭道具的便利配套组合。" },
  { id:"d_rope", icon:"🪢", name:"绳子", cat:"daily", price:50, size:1, durability:1,
    desc:"能够在各种情况下使用的牢固绳索，以 10 米为单位贩卖。" },
  { id:"d_mirror", icon:"🪞", name:"手镜", cat:"daily", price:300, size:1, durability:1,
    desc:"能够拿在手里的小镜子。" },
  { id:"d_instrument", icon:"🎻", name:"乐器", cat:"daily", price:300, priceText:"300 ～", size:3, sizeText:"3 ～", durability:3, variablePrice:true,
    desc:"有铃鼓、小号、竖琴、鲁特琴、小提琴、长笛、大键琴等，种类繁多。" },

  /* ===== 野营用品 (p50) ===== */
  { id:"k_blanket", icon:"🛌", name:"睡具", cat:"camp", price:40, size:1, durability:1,
    desc:"毛毯或休闲毯，轻便，便于携带。" },
  { id:"k_sleepbag", icon:"🛏️", name:"睡袋", cat:"camp", price:50, size:1, durability:1,
    desc:"1 人用的睡袋，能够在大多数环境下使用。" },
  { id:"k_tent", icon:"⛺", name:"帐篷", cat:"camp", price:120, size:3, durability:3,
    desc:"大小够 3 人用的帐篷。" },
  { id:"k_coldtent", icon:"⛺", name:"防寒帐篷", cat:"camp", price:300, size:5, durability:5,
    bonus:"天气【寒冷】时进行野营判定 +2",
    desc:"3 人用的帐篷。天气【寒冷】时宣言使用该帐篷进行野营判定可以获得 +2 加值。是寒冷的地区、冬日野营时不可缺少的道具。" },
  { id:"k_bigtent", icon:"🏕️", name:"大型帐篷", cat:"camp", price:500, size:5, durability:5,
    desc:"10 人用的大型帐篷，一般都是游牧民族在使用。" },
  { id:"k_heatstone", icon:"🪨", name:"加热石", cat:"camp", price:20, size:1, durability:1, consumable:true,
    desc:"能够使一桶洗澡水加热到 40 度。只能使用一次。" },
  { id:"k_tub", icon:"🛁", name:"携带式澡盆", cat:"camp", price:450, size:5, durability:5,
    desc:"可携带澡盆。" },
  { id:"k_pillow", icon:"🛋️", name:"枕头", cat:"camp", price:10, size:1, durability:1,
    desc:"睡觉时垫在头下的睡具，专为没有专用枕头便无法睡着的旅行者设计。" },
  { id:"k_doll", icon:"🧸", name:"布偶", cat:"camp", price:100, priceText:"100 ～", size:1, sizeText:"1 ～ 5", durability:1, variablePrice:true,
    desc:"仿照动物等形象制作的布艺品，形状和大小多样。" },
  { id:"k_incense", icon:"🕯️", name:"驱虫香", cat:"camp", price:10, size:1, durability:1, consumable:true,
    desc:"用虫子不会接近的香草、香木制作，使用一次效果可维持 12 小时。" },

  /* ===== 道具套装 (p51) ===== */
  { id:"set_travel", icon:"📦", name:"旅行基础套装", cat:"set", price:150, size:3, durability:3,
    contents:"大背包（其中包括睡袋、餐具、水袋、干粮 4 份，以及尺寸为 3 的空间）",
    desc:"基础套装中整理了最低限度的旅行所需道具，旅行者可以先购买基础套装，再准备其他道具。" },
  { id:"set_party", icon:"🎁", name:"队伍便利套装", cat:"set", price:800, size:10, sizeText:"合计 10（除动物）", durability:5,
    contents:"驮兽用动物、水桶、木箱（其中包括厨艺套装、火把 4 份、生火套装、香皂、洗衣套装、帐篷，和尺寸为 2 的空间）",
    desc:"队伍便利套装能够在很多时候派上用场，建议一个队伍最好购买 1 个队伍便利套装。" }
];

/* ---------- 药草 (p52-p53) ----------
 * 保质期规则：
 *   采集或购买 24 小时后腐坏，不能再使用；
 *   若装入〈药草瓶〉，可以保存最多 7 天（从瓶子开始使用算起，第 7 天瓶子本身失去保存能力）。
 * 使用：1 个药草只能发挥 1 次效果；战斗中使用药草需要花费 1 次行动；持有时尺寸记为 1。
 * 市场价格：1 级 100G / 2 级 300G / 3 级 800G / 4-5 级非卖品。
 * 只有都市的药草店会贩卖药草，一般商家不会收购药草。
 * 魔法系药草需要在发动魔法时使用，但一次魔法中只能使用 1 个药草。
 */
DE.HERB_RULES = {
  freshHours: 24,
  bottleDays: 7,
  bottleCapacity: 10,
  actionCost: "战斗中使用药草需要花费 1 次行动",
  size: 1,
  note: "1 个药草只能发挥 1 次效果。只有都市的药草店会贩卖药草，一般商家不会收购药草。",
  magicNote: "魔法系药草需要在发动魔法时使用，但一次魔法中只能使用 1 个药草。",
  priceByLevel: [
    { level: 1, price: 100 },
    { level: 2, price: 300 },
    { level: 3, price: 800 },
    { level: 4, price: null, priceText: "非卖品" },
    { level: 5, price: null, priceText: "非卖品" }
  ]
};

DE.HERB_SYSTEMS = {
  "身体系": { label: "身体系", color: "#7ea86b", effect: "恢复身体系异常状态与肉体损伤" },
  "精神系": { label: "精神系", color: "#6b8fb5", effect: "恢复精神系异常状态" },
  "魔法系": { label: "魔法系", color: "#9b7bb5", effect: "强化魔法效果，需在发动魔法时使用" }
};

DE.HERBS = [
  /* ===== 身体系 (p52) ===== */
  { id:"h_princess", icon:"🍎", name:"夕阳下的公主苹果", level:1, terrain:"草原", part:"果实", system:"身体系",
    effect:"缓和身体的疼痛。回复 2 点 HP。",
    desc:"形似苹果树的常青树，其果实是夕阳下的公主苹果，使用后有滋养身体、强健体魄的功效。" },
  { id:"h_trumpet", icon:"🌷", name:"王冠喇叭花", level:1, terrain:"荒野", part:"花朵", system:"身体系",
    effect:"睡觉前饮用有助眠效果。第二天的【状态判定】结果固定为 6。",
    desc:"一年生草本植物，盛开数朵闪闪发光的冠状花。颜色有白、紫、红、蓝等，根据当天天气而变化。" },
  { id:"h_giantpalm", icon:"🌴", name:"巨人掌叶", level:2, terrain:"岩地", part:"叶", system:"身体系",
    effect:"能够有效治疗足部疲劳。【移动判定】受伤后立即使用时，该伤害可以全部回复。",
    desc:"一年生草本植物，叶片巨大，表面涂满绿色粘液，喜水。" },
  { id:"h_lacquer", icon:"🍁", name:"大鬼漆", level:2, terrain:"树林", part:"树脂", system:"身体系",
    effect:"足够涂满一支箭的箭毒。提前在箭矢上涂抹可以使弓箭伤害 +2。",
    desc:"高度 4-5 米，灰白色树皮的落叶树。破坏树皮后，树干会渗出黑色的粘稠树液。" },
  { id:"h_redflower", icon:"🌺", name:"拂晓红花", level:3, terrain:"湿地", part:"茎", system:"身体系",
    effect:"使肉体恢复到原本状态。可以恢复身体系异常状态，使用后立即进行【状态判定】，且获得 +1 的加值。",
    desc:"菊科蓟属的植物，花朵赤红如同鲜血一般。其茎中含有麻醉成分，请谨慎使用。" },
  { id:"h_hangingdew", icon:"🪻", name:"吊钟露草", level:2, terrain:"丘陵", part:"花", system:"精神系",
    effect:"让使用者充满自信，若立即进行使用【精神】能力值的【判定】，则该判定获得 +1 加值。",
    desc:"超大型露草，绽放的花朵超过 1 米。生长于丘陵，花朵只在朝雾升起时才绽放。" },
  { id:"h_snowgrass", icon:"❄️", name:"月下的雪割草", level:3, terrain:"森林", part:"叶", system:"精神系",
    effect:"使注意力集中。当天所有行为的 MP 消耗减少 1 点。但此效果对只需消耗 1 点 MP 的行为无效。",
    desc:"只能在月光下成长的小株植物，成长 1 厘米需要一年时光。将其榨汁后可以使服用者精神振奋。" },
  { id:"h_nightdaisy", icon:"🌼", name:"白夜波斯菊", level:3, terrain:"山峦", part:"花", system:"精神系",
    effect:"使心情沉静。可以恢复精神系异常状态，使用后立即进行【状态判定】，且获得 +1 的加值。",
    desc:"淡紫色花瓣的菊花。只生长在寒冷地带，白夜出现时才会盛开。当地人民会将花瓣晒干制作成茶叶。" },
  { id:"h_nightbell", icon:"🔔", name:"夜色朦胧的风铃草", level:3, terrain:"夜晚（仅限等级 3 的地貌）", part:"花粉", system:"魔法系",
    effect:"魔法的威力增加“魔法使用者等级”。只对造成 HP 伤害或回复 HP 的魔法带来效果。",
    desc:"只在夜间盛开的一年生草本植物。花朵是淡紫色的袋状花，会在深夜中发出朦胧的光亮。" },
  { id:"h_waspnest", icon:"🐝", name:"不老王蜂的巢穴", level:4, terrain:"密林", part:"巢", system:"魔法系",
    effect:"魔法的效果时间延长 2 倍，但不会对效果时间为“瞬间”的魔法带来效果。",
    desc:"泥土做成的蚁穴状蜂巢，常见于密林深处。大小超过 2 米，外壁比石头更坚硬。" },
  { id:"h_tulip", icon:"🌷", name:"风鸣郁金香", level:4, terrain:"强风时的密林", part:"花", system:"魔法系",
    effect:"魔法的目标数量增加 1 个。只对原本目标为“1 个”的魔法带来效果。",
    desc:"只在刮着烈风之地冒芽的郁金香。花朵为翡翠色，花粉随风传播。" },
  { id:"h_blackmelon", icon:"🍈", name:"黑伽蓝瓜", level:4, terrain:"沙漠", part:"果实", system:"魔法系",
    effect:"使魔法不会对友方产生效果。只对目标为“1 个区域”或“全战场”的魔法有效。",
    desc:"甜瓜属植物，生长于枯木的树洞中。特征是茎、叶、花、果都是漆黑的，散发出奶酪发酵一样的气味——准确来说就是恶臭。" },
  { id:"h_boundarytree", icon:"🌿", name:"结界树枝", level:5, terrain:"高山", part:"枝干", system:"魔法系",
    effect:"将吟唱为“一般”的魔法变为“仪式”，魔法的目标变为在场的友方全员，效果时间变为 12 小时。但此效果对效果时间为“瞬间”的魔法无效，且只对目标为“1 个”的魔法有效。",
    desc:"被称为森林看守人的“结界树”的亚种树的树枝。该亚种树生长在高山上，树皮的硬度能够匹敌奥利哈刚。" }
];

/* ---------- 各地貌可入手药草表 (p53) ---------- */
DE.HERB_BY_TERRAIN = [
  { terrain:"草原", name:"夕阳下的公主苹果", system:"身体系" },
  { terrain:"荒野", name:"王冠喇叭花", system:"身体系" },
  { terrain:"树林", name:"大鬼漆", system:"身体系" },
  { terrain:"岩地", name:"巨人掌叶", system:"身体系" },
  { terrain:"丘陵", name:"吊钟露草", system:"精神系" },
  { terrain:"森林", name:"月下的雪割草", system:"精神系" },
  { terrain:"湿地", name:"拂晓红花", system:"身体系" },
  { terrain:"山峦", name:"白夜波斯菊", system:"精神系" },
  { terrain:"沙漠", name:"黑伽蓝瓜", system:"魔法系" },
  { terrain:"密林", name:"不老王蜂的巢穴", system:"魔法系" },
  { terrain:"高山", name:"结界树枝", system:"魔法系" },
  { terrain:"夜晚（仅限等级 3 的地貌）", name:"夜色朦胧的风铃草", system:"魔法系" },
  { terrain:"强风时的密林", name:"风鸣郁金香", system:"魔法系" }
];

/* ---------- 动物 (p49) ---------- */
DE.ITEMS = DE.ITEMS.concat([
  { id:"an_ride", icon:"🐴", name:"骑乘用动物", cat:"animal", price:900, size:0, durability:0, noDurability:true,
    animal:"骑乘", rideCapacity:1,
    desc:"等级 2 以下的地貌（草原 / 荒野 / 森林 / 丘陵 / 岩地）的【移动判定】获得 +1 加值。受过训练的动物，可以用于 1 人骑乘。" },
  { id:"an_largeride", icon:"🐘", name:"大型骑乘用动物", cat:"animal", price:3800, size:0, durability:0, noDurability:true,
    animal:"骑乘", rideCapacity:4,
    desc:"等级 2 以下的地貌（草原 / 荒野 / 森林 / 丘陵 / 岩地）的【移动判定】获得 +1 加值。可以用于最多 4 人骑乘。" },
  { id:"an_pack", icon:"🐴", name:"驮货用动物", cat:"animal", price:500, size:0, durability:0, noDurability:true,
    animal:"驮货", carryCapacity:15,
    desc:"能够驮运的合计尺寸为 15。专门用来驮运货物的动物。" },
  { id:"an_largepack", icon:"🐂", name:"大型驮货用动物", cat:"animal", price:2000, size:0, durability:0, noDurability:true,
    animal:"驮货", carryCapacity:30,
    desc:"能够驮运的合计尺寸为 30。专门用来驮运货物的大型动物。" },
  { id:"an_pet", icon:"🐈", name:"宠物", cat:"animal", price:300, size:0, durability:0, noDurability:true,
    animal:"宠物",
    desc:"尺寸大小在 1 米以内的宠物。例：猫、狗、兔、鸟、乌龟等。" }
]);

/* ---------- 动物的特征 (p49) ---------- */
DE.ANIMAL_TRAITS = [
  { name:"结实的",     mult:2,    effect:"在沙漠和高山地貌中不需要饲料。" },
  { name:"聪明的",     mult:3,    effect:"很聪明，能够在某种程度上理解主人的话。" },
  { name:"性格古怪的", mult:0.7,  effect:"有时候会不听主人的话。" },
  { name:"烦人的",     mult:0.7,  effect:"叫声或脚步声很吵。" },
  { name:"幼年的",     mult:0.3,  effect:"被购买后的 6 个月内没有任何能力，被视为〈宠物〉。" },
  { name:"忠诚的",     add:1000,  effect:"绝对不会离开主人。只要支付 1000 金币就能使已经持有的动物追加此特征。" },
  { name:"习惯旅行的", add:5000,  effect:"只有骑乘用动物能够追加此特征，全地貌的【移动判定】获得 +1 加值。只要支付 5000 金币就能使已经持有的动物追加此特征。" }
];

DE.calcAnimalPrice = function (basePrice, traitNames) {
  var p = basePrice;
  (traitNames || []).forEach(function (n) {
    var t = DE.ANIMAL_TRAITS.filter(function (x) { return x.name === n; })[0];
    if (t && t.mult) p = p * t.mult;
  });
  p = Math.ceil(p);
  (traitNames || []).forEach(function (n) {
    var t = DE.ANIMAL_TRAITS.filter(function (x) { return x.name === n; })[0];
    if (t && t.add) p = p + t.add;
  });
  return p;
};

/* ---------- 动物持有限制 (p49) ---------- */
DE.ANIMAL_RULES = {
  freeFeed: "1 名旅行者携带 1 只动物时，可以视为该动物自动寻找饲料和水。",
  extraFeed: "携带超过可携带上限数量的动物时，需要消耗相应数量的〈动物饲料〉和水。",
  trainerBonus: "拥有〔动物饲养〕技能的旅行者，动物的携带上限加 2 只。",
  harshTerrain: "但“沙漠”和“高山”的地貌极度缺乏饲料和水，携带的所有动物都需要消耗〈动物饲料〉和水。"
};

/* ---------- 药草 → 道具定义（供商店 / 背包统一走 DE.buy 与 DE.ITEMS 流程） ----------
 * 药草不是普通道具：4-5 级为非卖品，价格随等级固定。
 * 这里把它们转成带 isHerb 标记的道具定义，使购买、尺寸、耐久、容器逻辑完全复用。 */
DE.herbDef = function (h) {
  var pl = DE.HERB_RULES.priceByLevel.filter(function (x) { return x.level === h.level; })[0];
  var price = pl ? pl.price : null;
  return {
    id: h.id,
    name: h.name,
    isHerb: true,
    herbLevel: h.level,
    herbSystem: h.system,
    cat: "herb",
    size: DE.HERB_RULES.size,
    durability: DE.HERB_RULES.size,
    price: price,
    priceText: price == null ? "非卖品" : null,
    sellable: price != null,
    effect: h.effect,
    terrain: h.terrain,
    part: h.part,
    desc: h.effect + "\n" + h.desc
  };
};

/* 药草的全部道具定义 */
DE.HERB_DEFS = DE.HERBS.map(DE.herbDef);

/* 按 id 取药草道具定义 */
DE.findHerbDef = function (id) {
  return DE.HERB_DEFS.filter(function (x) { return x.id === id; })[0] || null;
};

/* 药草定义的尺寸 / 耐久统一为 1（规则：持有时药草的尺寸记为 1） */
DE.HERB_DEFS.forEach(function (d) { d.size = DE.HERB_RULES.size; d.durability = DE.HERB_RULES.size; });

if (typeof module !== "undefined" && module.exports) { module.exports = DE; }

/* ---------- 道具特征的配色与字体样式（背包 / 商店共用） ----------
 * kind 决定配色与字重，用于在卡片与格子上区分词条类型。 */
DE.TRAIT_STYLE = {
  "可爱的":    { kind:"good",    fg:"#d4508f", bg:"#fdeaf4", bd:"#f0b3d4", italic:true },
  "华丽的":    { kind:"good",    fg:"#b8860b", bg:"#fdf4dd", bd:"#e8cf94" },
  "结实的":    { kind:"good",    fg:"#4a7c3f", bg:"#e9f4e4", bd:"#b3d3a4", bold:true },
  "高品质的":  { kind:"best",    fg:"#a06a00", bg:"#fbeecb", bd:"#e0b45c", bold:true,
                 glow:"0 0 0 1px rgba(224,180,92,.55)" },
  "二手的":    { kind:"bad",     fg:"#7a6a52", bg:"#f2ede3", bd:"#d5c9b0" },
  "恶心的":    { kind:"bad",     fg:"#6b7a3a", bg:"#eef2e0", bd:"#c6d19c", italic:true },
  "土气的":    { kind:"bad",     fg:"#857a68", bg:"#f1ece2", bd:"#d3c9b6" },
  "有异味的":  { kind:"bad",     fg:"#7d6a4a", bg:"#f3ecdd", bd:"#d8c9a8" },
  "被诅咒的":  { kind:"curse",   fg:"#8a2a4a", bg:"#fae6ee", bd:"#e0a3bb", bold:true,
                 glow:"0 0 0 1px rgba(138,42,74,.35)" },
  "损坏的":    { kind:"broken",  fg:"#9c3a2a", bg:"#fbe9e5", bd:"#e3b0a5", strike:true },
  "秘银的":    { kind:"material",fg:"#2f7d8f", bg:"#e6f4f7", bd:"#a3d0da", bold:true },
  "奥利哈刚的":{ kind:"legend",  fg:"#7a4bb5", bg:"#f1e9fb", bd:"#c9aee8", bold:true,
                 glow:"0 0 0 1px rgba(122,75,181,.45)" },
  "会走路的":  { kind:"magic",   fg:"#2d6fa8", bg:"#e7f0fa", bd:"#a8c6e4" },
  "发光的":    { kind:"magic",   fg:"#c99000", bg:"#fdf5dd", bd:"#ecd392" },
  "会说话的":  { kind:"magic",   fg:"#2d6fa8", bg:"#e7f0fa", bd:"#a8c6e4", italic:true },
  "魔法强化的":{ kind:"magic",   fg:"#6b3fa0", bg:"#f0e8fa", bd:"#c4a8e2", bold:true }
};

/* 动物的特征 */
DE.ANIMAL_TRAIT_STYLE = {
  "结实的":    { kind:"good", fg:"#4a7c3f", bg:"#e9f4e4", bd:"#b3d3a4", bold:true },
  "聪明的":    { kind:"good", fg:"#2f7d8f", bg:"#e6f4f7", bd:"#a3d0da" },
  "性格古怪的":{ kind:"bad",  fg:"#8a6a2a", bg:"#f7efda", bd:"#ddc999" },
  "烦人的":    { kind:"bad",  fg:"#9c5a2a", bg:"#fbeee1", bd:"#e5c2a0" },
  "幼年的":    { kind:"bad",  fg:"#7a6a52", bg:"#f2ede3", bd:"#d5c9b0", italic:true },
  "忠诚的":    { kind:"best", fg:"#a06a00", bg:"#fbeecb", bd:"#e0b45c", bold:true },
  "习惯旅行的":{ kind:"best", fg:"#2d6fa8", bg:"#e7f0fa", bd:"#a8c6e4", bold:true }
};

/* 取某个特征的样式；找不到就给中性样式 */
DE.traitStyle = function (name) {
  return DE.TRAIT_STYLE[name] || DE.ANIMAL_TRAIT_STYLE[name] ||
    { kind:"plain", fg:"#6b5f50", bg:"#f2ede3", bd:"#d8cdb4" };
};
/* 生成一个特征标签的 HTML */
DE.traitChip = function (name, small) {
  var st = DE.traitStyle(name);
  var css = "color:" + st.fg + ";background:" + st.bg + ";border-color:" + st.bd + ";" +
    (st.bold ? "font-weight:700;" : "") +
    (st.italic ? "font-style:italic;" : "") +
    (st.strike ? "text-decoration:line-through;" : "") +
    (st.glow ? "box-shadow:" + st.glow + ";" : "");
  return '<span class="trait-chip' + (small ? " sm" : "") + ' k-' + st.kind + '" style="' + css + '">' +
    DE.ui.esc(name) + "</span>";
};
