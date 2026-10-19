/* ============================================================
 *  龙蛋物语 — 车卡规则数据
 *  来源：规则书「人物卡 - 车卡篇」p22-p24、p40-p42、职业章节
 *  ============================================================ */
window.DE = window.DE || {};

/* ---------- 第一步：选择职业 ---------- */
DE.PROFESSIONS = [
  { id:"bard", name:"吟游诗人", beginner:true, role:"在旅途中传唱故事的人，擅长情报与鼓舞同伴。",
    skills:["流浪之身","逸闻知识","音乐"] },
  { id:"merchant", name:"商人", beginner:true, role:"与金钱和人情打交道，买卖的一把好手。",
    skills:["对话技巧","动物饲养","生意兴隆"] },
  { id:"hunter", name:"猎人", beginner:true, role:"在大自然中求生，追踪怪物、处理猎物。",
    skills:["动物搜寻","材料加工","狩猎"] },
  { id:"apothecary", name:"药师", beginner:true, role:"采集药草、治疗伤势，队伍中的生命线。",
    skills:["治疗","应急处理","药草采摘"] },
  { id:"farmer", name:"农民", beginner:false, role:"体魄强健，能背更多的行囊。",
    skills:["健康","动物饲养","副业"] },
  { id:"artisan", name:"手艺人", beginner:false, role:"制作与修理道具的专家。",
    skills:["材料加工","物品制造","修理"] },
  { id:"noble", name:"贵族", beginner:false, role:"身居高位，精通礼仪与武艺。",
    skills:["礼仪教养","贵族知识","崇尚武艺"] },
  { id:"navigator", name:"领航员", beginner:false, expansion:true, role:"扩展职业，精通海路与航向。",
    skills:["航海术","天候预测","操舵"] },
  { id:"monk", name:"修行僧", beginner:false, expansion:true, role:"扩展职业，以修行锻炼身心。",
    skills:["修行","托钵","精神统一"] }
];

/* ---------- 职业技能表（附表「职业」） ---------- */
DE.PROFESSION_SKILLS = {
  "流浪之身": { ability:"—", target:"—", effect:"旅行判定有 +1 的加值。（移动判定、方向判定、野营判定）" },
  "逸闻知识": { ability:"智力+智力", target:"主持人决定", effect:"可以从听闻的情报中获得更多详细的知识。" },
  "音乐": { ability:"敏捷+精神", target:"地貌",
    effect:"【音乐】与环境一致时，每次使用消耗 1HP。\n伙伴全员在之后的判定中获得 +1 的加值（状态判定与行动判定不包含在内）。\n大成功：加值变为 +3\n大失败：状态值小于 6 的伙伴获得异常状态【激励：6】" },
  "对话技巧": { ability:"—", target:"—", effect:"进行交涉判定（智力+精神）时获得 +1 的加值。" },
  "动物饲养": { ability:"—", target:"—", effect:"能够持有的动物数量增加 2 只，总计 3 只。" },
  "生意兴隆": { ability:"智力+精神", target:"参照表 1",
    effect:"商人以更廉价的价格购入，并以更高价卖出。\n" +
      "主要使用条件：至少同时买卖 4 件相同的道具。\n" +
      "购买道具时，商人必须持有足以按照定价购入道具的金币数额。\n" +
      "判定成功后的交易价格根据判定结果变动，但即使失败，这桩交易也不会取消。\n" +
      "货物不足、或遇到奸商的阴谋时，此技能可能无法使用。\n" +
      "原则上使用〈生意兴隆〉购买的道具无法在同一城市中贩卖。" },
  "动物搜寻": { ability:"体力+智力", target:"地貌", effect:"寻找怪物的位置，并且攻击时对寻找到的怪物获得 +1 的伤害加值。" },
  "材料加工": { ability:"敏捷+智力", target:"怪物等级×2", effect:"加工怪物的遗骸。" },
  "狩猎": { ability:"敏捷+智力", target:"地貌",
    effect:"野营判定前，1 天最多 1 次。\n获得「判定结果 − 目标值」人份的食材，使用技能后无法参与【野营判定】。\n大成功：获得的全部食材的品质变为「好吃的」\n大失败：陷入异常状态【重伤：6】" },
  "治疗": { ability:"智力+精神", target:"自动成功",
    effect:"消耗 1 个「药草」和 1 天份的水。\n恢复【智力+精神判定】数值点的 HP。战斗中，HP 恢复点数为【智力判定（一个骰子）】的结果点数。" },
  "应急处理": { ability:"智力+精神", target:"【异常状态】数值",
    effect:"目标受到【异常状态】的影响，且未接受应急处理。\n使目标受到的【异常状态】无效化 1 小时，【异常状态】的数值永远下降药师角色的【等级】点。" },
  "药草采摘": { ability:"体力+智力", target:"地貌",
    effect:"早晨进行【移动判定】前，1 天最多判定 1 次。\n获得一个药草。\n大成功：一次获得三个药草\n大失败：获得异常状态【中毒：6】，无关现在【状态值】。" },
  "健康": { ability:"—", target:"—", effect:"每天的【状态判定】获得 +1 的加值。\n持有道具尺寸上限 +3" },
  "副业": { ability:"—", target:"—",
    effect:"从以下技能中选择 1 项变为可以使用，但判定受到 -1 的减值。\n音乐 / 生意兴隆 / 狩猎 / 动物搜寻 / 材料加工 / 药草采摘 / 治疗 / 应急处理 / 物品制造 / 修理 / 礼仪教养" },
  "物品制造": { ability:"体力+敏捷", target:"参照效果",
    effect:"制作 1 个道具，需从选择职业时决定的道具种类中选择。花费时间（道具尺寸×1 天）和材料费（道具价格的一半）。可再次挑战，不花材料费但花时间。\n道具定价：≤100g / ≤1000g / ≤1万g / ≤10万g / ＞10万g\n目标值：6 / 8 / 10 / 14 / 18" },
  "修理": { ability:"体力+敏捷", target:"参照效果",
    effect:"修理道具，恢复耐久度。花费时间（道具尺寸×1 天）和材料费（价格的 10%）。不管是否成功都需要花费材料费，可再次挑战，需要再次花费材料费。\n道具定价：≤100g / ≤1000g / ≤1万g / ≤10万g / ＞10万g\n目标值：6 / 8 / 10 / 14 / 18" },
  "礼仪教养": { ability:"敏捷+智力", target:"对抗", effect:"和身份地位高的人进行【礼仪】对抗并胜利后，可以给对方留下好印象。" },
  "贵族知识": { ability:"智力+智力", target:"主持人决定", effect:"可以从听闻的情报中获得更多详细的知识。" },
  "崇尚武艺": { ability:"—", target:"—",
    effect:"额外获得 1 个擅长武器，需从长剑 / 长枪 / 弓箭中选择。\n若重复选择已获得的擅长武器，该武器命中获得 +1 的加值。" },
  "航海术": { ability:"智力+敏捷", target:"地貌", effect:"扩展职业「领航员」的技能，用于判断航路与海况。" },
  "天候预测": { ability:"智力+精神", target:"参照效果", effect:"扩展职业「领航员」的技能，预知未来的天气变化。" },
  "操舵": { ability:"体力+敏捷", target:"参照效果", effect:"扩展职业「领航员」的技能，操纵船只。" },
  "修行": { ability:"体力+精神", target:"参照效果", effect:"扩展职业「修行僧」的技能，通过苦行锻炼肉体与精神。" },
  "托钵": { ability:"智力+精神", target:"参照效果", effect:"扩展职业「修行僧」的技能，向他人化缘获取食物。" },
  "精神统一": { ability:"精神+精神", target:"参照效果", effect:"扩展职业「修行僧」的技能，集中精神。" }
};

/* ---------- 第二步：选择特长类型 ---------- */
DE.TYPES = [
  { id:"battle", name:"战斗", ability:"坚韧", beginner:true,
    abilities:["坚韧","强力","专注"],
    desc:"擅长正面战斗的类型。", effect:"HP 上限获得 +4 加值" },
  { id:"tech", name:"技术", ability:"精确", beginner:true,
    abilities:["精确","快速","口袋"],
    desc:"擅长技巧与机智的类型。", effect:"【集中】时共计获得 +2 加值" },
  { id:"magic", name:"魔法", ability:"许愿", beginner:true,
    abilities:["许愿","咒语书","季节之法"],
    desc:"擅长魔法的类型。", effect:"MP 上限获得 +4 加值" }
];

/* ---------- 特长能力表（附表「特长」） ---------- */
DE.TALENT_ABILITIES = {
  "坚韧": { type:"战斗", effect:"HP 上限获得 +4 加值" },
  "强力": { type:"战斗", effect:"战斗中的【伤害判定】获得 +1 加值" },
  "专注": { type:"战斗", effect:"获得 1 种【擅长武器】" },
  "精确": { type:"技术", effect:"【集中】时共计获得 +2 加值" },
  "快速": { type:"技术", effect:"战斗中的【行动判定】获得 +1 加值" },
  "口袋": { type:"技术", effect:"可持有道具的尺寸上限 +3" },
  "许愿": { type:"魔法", effect:"MP 上限获得 +4 加值" },
  "咒语书": { type:"魔法", effect:"每等级获得 2 个咒语魔法" },
  "季节之法": { type:"魔法", effect:"掌握季节魔法" }
};

/* ---------- 第三步：决定能力值 ---------- */
/* 制作角色时能力值只能从 4 / 6 / 8 中选择 */
DE.ABILITY_KEYS = [
  { key:"str", name:"体力", short:"体", desc:"表示体力强弱、身体强健度" },
  { key:"agi", name:"敏捷", short:"敏", desc:"表示操作的灵活性、移动速度" },
  { key:"int", name:"智力", short:"智", desc:"表示头脑的灵活性、判断力" },
  { key:"spr", name:"精神", short:"精", desc:"表示集中力、勇气、心理承受能力、是否容易屈服于逆境等" }
];

/* 三种数值组合（制作角色时从中选择 1 种，并按照喜欢的顺序把这些数字分给各能力值）
 * 注意：只能改变分配给哪个能力值，不能改变组合中的数字本身。
 * 初始能力值上限为 8，10 与 12 需要靠等级提升获得。 */
DE.ABILITY_SETS = [
  { id:"average",  name:"平均型", values:[6,6,6,6], desc:"四项能力平均发展，最稳妥的选择。" },
  { id:"standard", name:"标准型", values:[4,6,6,8], desc:"一项突出、一项较弱。官方示例：体力 8、敏捷 4、智力 6、精神 6。" },
  { id:"special",  name:"专精型", values:[4,4,8,8], desc:"两项极强、两项很弱，追求鲜明的角色形象。" }
];

/* ---------- 第四步：擅长武器 ---------- */
DE.WEAPONS_CHAR = [
  { name:"短剑", includes:"包括匕首、短剑、肋差等。", hit:"【敏捷+智力】+1", dmg:"【智力】-1",
    hand:"为单手武器。", note:"短剑的命中较高，但伤害低。" },
  { name:"长剑", includes:"包括宽剑、细剑、刀等。", hit:"【敏捷+体力】", dmg:"【体力】",
    hand:"为单手武器。", note:"长剑的命中与伤害属性平衡。" },
  { name:"长枪", includes:"包括长矛、长戟、长枪等。", hit:"【敏捷+体力】", dmg:"【体力】+1",
    hand:"为双手武器。", note:"长枪是伤害高的武器。" },
  { name:"斧子", includes:"包括战斧、巨斧等。", hit:"【体力+体力】-1", dmg:"【体力】",
    hand:"为双手武器。", note:"斧子命中较低，但判定只需用到体力能力。" },
  { name:"弓箭", includes:"包括短弓、长弓、十字弓等。", hit:"【智力+敏捷】-2", dmg:"【敏捷】",
    hand:"为双手武器。", note:"弓箭可以从远距离进行攻击，但命中较低。" },
  { name:"空手", includes:"包括空手格斗，以及锄头和木杖等临时武器。", hit:"【敏捷+体力】", dmg:"【体力】-2（临时武器 -1）",
    hand:"需使用双手。", note:"手边没有武器时的紧急手段。" }
];

/* 非擅长武器：每次攻击 HP 减少 1 点 */
DE.NON_PROFICIENT_HP_COST = 1;

/* ---------- 车卡流程（8 步，按规则书 p22-p24 的印刷顺序） ---------- */
DE.CHAR_STEPS = [
  { n:1, title:"选择职业", detail:"创建角色的第一步就是选择职业。本游戏中的 7 种“职业”代表着角色的身份与地位，因此在选择职业时应该注意尽量不要和其他玩家选择重复的职业，以防角色的行为和定位冲突。新手推荐：吟游诗人 / 商人 / 猎人 / 药师；比较熟悉游戏的玩家可以尝试：农民 / 手艺人 / 贵族。" },
  { n:2, title:"决定初始能力值", detail:"在“4、6、8、10、12”中选择一个数字来代表体力 / 敏捷 / 智力 / 精神。但制作角色时只能从“4、6、8”中选择（初始能力值上限为 8）。从 3 种数值组合中选择 1 种，并按照喜欢的顺序把组合中的数字分给各能力值。" },
  { n:3, title:"选择特长", detail:"从战斗特长 / 技术特长 / 魔法特长这 3 种特长中选择 1 种作为角色特长。选择特长后，角色可以获得该特长的所有能力。" },
  { n:4, title:"选择擅长武器", detail:"在“短剑 / 长剑 / 长枪 / 斧子 / 弓箭”中选择 1 种。此时选择的武器视为游戏开始前即持有同种道具。使用不是【擅长武器】的武器进行攻击时，每进行 1 次攻击，生命点数会减少 1 点。" },
  { n:5, title:"决定随身物品", detail:"请随意决定 1 个你的角色应会持有的物品。该随身物品是用来表现角色性格的小道具，原则上来说没有任何数据。" },
  { n:6, title:"前往购物、准备道具", detail:"你的角色在游戏开始时拥有 1000 金币，请用来购买必要的道具和旅行装备，以及与你一起踏上旅程的动物等。" },
  { n:7, title:"设定角色", detail:"你需要做好角色的详细设定：角色名字、性别与年龄、印象颜色与外表特征、故乡与踏上旅程的原因、其他设定与角色性格等。角色的详细设定是你扮演角色时最重要的部分，可以一边和其他玩家商量，一边慢慢思考。" },
  { n:8, title:"（组队后）分配队伍职责", detail:"请在制作完角色、组成队伍踏上旅途前，分配好各自在队伍中的职责。" }
];

/* 队伍职责（组队后分配） */
DE.PARTY_ROLES = ["队长", "绘图员", "行李管理员", "日志记录员"];

/* ---------- 初始值 ---------- */
DE.START = {
  money: 1000,
  level: 1,
  exp: 0,
  favoredWeaponCount: 1,
  personalItems: 1,
  note: "角色在游戏开始时拥有 1000 金币。"
};

/* ---------- 郊游模式（面向新人玩家的简易模式） ---------- */
DE.PICNIC_MODE = {
  name: "郊游模式",
  desc: "和桌面扮演游戏的新人进行游戏，或进行一场时间很短的短游戏时，可以使用简单模式的规则来创造角色。",
  rules: [
    "简单模式中，不使用道具的「尺寸」「耐久」规则和「集中」规则。",
    "所有武器的命中都由【体力+敏捷】决定，伤害则由【体力】来决定。",
    "此模式默认自动补充水与食物，不需要使用「买卖」规则，游戏从备齐以下必要道具的状态开始。"
  ],
  sets: [
    { name:"旅行基础套装（全员）", items:"大背包、睡袋、餐具、水袋、干粮 2 份" },
    { name:"队伍便利套装（只需要一人持有）", items:"驮货用动物、水桶、木箱、厨艺套装、香皂、洗衣套装、火把、生火套装、帐篷" }
  ]
};

/* ---------- 等级提升（旅行者，最高 10 级） ---------- */
DE.LEVELUP = {
  maxLevel: 10,
  howTo: "旅行者每完成 1 次故事，也就是结束一段旅程后，就可以获得经验值。当经验值积累到一定量后，等级会自动提升。提升等级后，经验值仍会保留，不会清零。",
  expFormula: "每场故事中获得的经验为以下 3 项之和：\n1. 选该场故事中“地貌 + 天气”目标值中的最高值，获得下表相应经验。\n2. 主持人使用的特殊能力次数 × 50 点。\n3. 打倒怪物的最高等级 × 10 点。",
  expExample: "例：本次故事中，目标值最高的“地貌 + 天气”是雨中的草原（7），经验值为 100 点；主持人使用 1 次特殊能力，再获得经验值 50 点；出现的怪物中等级最高的是 3 级的史莱姆，获得经验值 30 点。因此每个旅行者获得 180 点经验点。",
  expSource: [
    { maxTargetValue:"5-7",   exp:100 },
    { maxTargetValue:"8-10",  exp:200 },
    { maxTargetValue:"11-13", exp:300 },
    { maxTargetValue:"超过 14", exp:500 }
  ],
  rewards: [
    "生命点数和精力点数提升：生命点数和精力点数<b>共成长 3 点</b>，可自由分配（例：HP+2 / MP+1，或 HP+0 / MP+3）。",
    "角色可持有道具的尺寸上限 +1。",
    "不同等级能获得新的能力（见等级提升表）。"
  ],
  abilityIncrease: "“提升能力值” = 任意 1 个能力值上升 1 阶段（4→6→8→10→12）。",
  /* 达到 minExp 即可升到该等级；newAbility 为该级获得的新能力 */
  table: [
    { level:1,  minExp:0,     newAbility:"初始等级" },
    { level:2,  minExp:100,   newAbility:"提升能力值" },
    { level:3,  minExp:600,   newAbility:"获得擅长地貌 / 天气" },
    { level:4,  minExp:1200,  newAbility:"提升能力值、增强对异常状态的抗性" },
    { level:5,  minExp:2000,  newAbility:"获得新职业" },
    { level:6,  minExp:3000,  newAbility:"提升能力值、获得新特长" },
    { level:7,  minExp:4200,  newAbility:"获得擅长地貌 / 天气" },
    { level:8,  minExp:5800,  newAbility:"提升能力值" },
    { level:9,  minExp:7500,  newAbility:"获得季节之龙的守护" },
    { level:10, minExp:10000, newAbility:"提升能力值、踏上传说之旅" }
  ]
};
DE.LEVELUP.expTable = DE.LEVELUP.table.map(function (r) {
  return { level: r.level, exp: r.minExp };
});
/* 根据经验值算出等级 */
DE.LEVELUP.levelForExp = function (exp) {
  var lv = 1;
  DE.LEVELUP.table.forEach(function (r) { if (exp >= r.minExp) lv = r.level; });
  return lv;
};

/* ---------- 状态值 / 异常状态 / 天气 / 地貌 ---------- */
DE.CONDITION = {
  formula: "状态值 = 体力 + 精神",
  perfect: "达到 ★10 则一天状态绝佳！任意 1 个能力值上升 1 阶段！",
  note: "次日的状态判定结果值大于等于异常状态数值则恢复正常。"
};

/* 异常状态（规则书 p74-p75）
 *  · 每种带一个「数值」；次日的【状态判定】结果 ≥ 该数值 就恢复正常。
 *  · affects = 它压制哪些能力值（各 -1 阶段，下限 4）。
 *    「所有能力值」按 4 项全算。 */
DE.STATUSES = {
  physical: [
    { name:"重伤", effect:"【敏捷】-1 阶段", affects:["agi"] },
    { name:"中毒", effect:"【体力】-1 阶段", affects:["str"] },
    { name:"疾病", effect:"【所有能力值】-1 阶段", affects:["str","agi","int","spr"] }
  ],
  mental: [
    { name:"萎靡", effect:"【精神】-1 阶段", affects:["spr"] },
    { name:"激动", effect:"【智力】-1 阶段", affects:["int"] },
    { name:"失神", effect:"【所有能力值】-1 阶段", affects:["str","agi","int","spr"] }
  ]
};

/* 按名字取异常状态的定义 */
DE.statusDef = function (name) {
  var all = (DE.STATUSES.physical || []).concat(DE.STATUSES.mental || []);
  return all.filter(function (x) { return x.name === name; })[0] || null;
};

/* 状态糟糕（状态值 ≤2）那天可选的 4 种 —— 规则书 p74 明确写了数值都是 4 */
DE.STATUS_BAD_DAY = ["重伤", "中毒", "萎靡", "激动"];
DE.STATUS_BAD_DAY_VALUE = 4;

DE.WEATHERS = [
  { name:"雨",     modifier:1 }, { name:"强风",   modifier:1 },
  { name:"雾",     modifier:1 }, { name:"炎热",   modifier:1 },
  { name:"寒冷",   modifier:1 }, { name:"暴雨",   modifier:3 },
  { name:"雪",     modifier:3 }, { name:"浓雾",   modifier:3 },
  { name:"黑暗",   modifier:3 }, { name:"暴风雨", modifier:5 },
  { name:"暴风雪", modifier:5 }
];

DE.TERRAIN_LEVELS = [
  { level:1, target:6,  names:["草原","荒野","有道路"] },
  { level:2, target:8,  names:["树林","丘陵","岩地"] },
  { level:3, target:10, names:["森林","湿地","山峦"] },
  { level:4, target:12, names:["沙漠","密林"] },
  { level:5, target:14, names:["高山"] }
];

/* ============================================================
 *  〈生意兴隆〉商人技能（规则书 p28）
 *  判定【智力 + 精神】，结果对照表 1 得出价格增减率。
 *  买入：按定价再打折；卖出：在一般售价基础上加价。
 * ============================================================ */
DE.BIZ_BOOM = {
  skill: "生意兴隆",
  ability: ["int", "spr"],
  minCount: 4,                      // 至少同时买卖 4 件相同的道具
  /* 表 1：判定结果 -> 价格增减率 */
  table: [
    { min:18, max:99, rate:0.80, label:"18~" },
    { min:14, max:17, rate:0.60, label:"14~17" },
    { min:10, max:13, rate:0.40, label:"10~13" },
    { min:8,  max:9,  rate:0.20, label:"8~9" },
    { min:6,  max:7,  rate:0.10, label:"6~7" },
    { min:-99, max:5, rate:0,    label:"5 以下" }
  ],
  note: "至少同时买卖 4 件相同的道具才能使用；" +
        "使用时商人必须持有足以按定价购入的金币；" +
        "判定失败交易也不会取消；" +
        "用〈生意兴隆〉买入的道具原则上不能在同一城市卖出。",
  /* 判定结果 -> 增减率 */
  rateOf: function (total) {
    var t = (DE.BIZ_BOOM.table || []).filter(function (x) {
      return total >= x.min && total <= x.max;
    })[0];
    return t ? t.rate : 0;
  },
  /* 买入单价：定价 ×（1 − 增减率） */
  buyPrice: function (basePrice, rate) {
    return Math.max(1, Math.round((basePrice || 0) * (1 - (rate || 0))));
  },
  /* 卖出单价：一般售价 ×（1 + 增减率） */
  sellPrice: function (baseSell, rate) {
    return Math.max(1, Math.round((baseSell || 0) * (1 + (rate || 0))));
  }
};

/* ============================================================
 *  判定通用规则（规则书 p70 判定规则 / p71 成败判定）
 *  —— 快捷旅行插件已删除，但这段是所有判定的共同基础，图鉴与生意兴隆在用。
 * ============================================================ */
DE.JUDGE_RULE = {
  diceCount: 2,
  success: "2 个骰子点数 + 修正值 ≥ 目标值（相等也算成功）",
  fail: "2 个骰子点数 + 修正值 < 目标值",
  critFail: "2 个骰子点数都是 1 → 大失败（道具耐久 −1，队伍全员获得 1 点大失败积分）",
  critOk: "2 个骰子点数都是骰子最大值，或都是 6 → 大成功",
  targetRef: [
    { target:4,  word:"简单" }, { target:7,  word:"比较困难" },
    { target:9,  word:"困难" }, { target:12, word:"相当困难" },
    { target:16, word:"一般人不可能" }, { target:20, word:"几乎是奇迹一般的成功" }
  ]
};

DE.SHEET_FIELDS = [
  { field:"角色名字", meaning:"旅行者的名字，也可以填昵称或别称。" },
  { field:"玩家名字", meaning:"操作该角色的玩家。" },
  { field:"等级 / 经验值", meaning:"角色当前等级与累计经验值。" },
  { field:"性别 / 年龄", meaning:"角色的性别与年龄。" },
  { field:"职业", meaning:"7 种职业之一，决定 3 个职业技能。" },
  { field:"特长", meaning:"战斗 / 技术 / 魔法之一，决定 3 个特长能力。" },
  { field:"能力值", meaning:"体力 / 敏捷 / 智力 / 精神，以骰子面数表示（4/6/8/10/12）。" },
  { field:"HP / MP", meaning:"HP 上限 = 体力×2；MP 上限 = 精神×2。" },
  { field:"状态值", meaning:"体力 + 精神，用于每日状态判定。" },
  { field:"大失败积分", meaning:"累计大失败次数。" },
  { field:"行动值", meaning:"敏捷 + 智力，战斗中决定行动顺序。" },
  { field:"擅长武器", meaning:"从短剑 / 长剑 / 长枪 / 斧子 / 弓箭中选择。" },
  { field:"擅长地貌 / 天气", meaning:"角色擅长的地形与天气。" },
  { field:"随身物品", meaning:"表现角色性格的小道具。" },
  { field:"印象颜色与外表特征", meaning:"角色喜欢的颜色、发色、眼睛、肤色、穿衣风格。" },
  { field:"故乡 / 踏上旅途的原因", meaning:"角色出身与旅行的动机。" },
  { field:"记述", meaning:"角色的背景故事与设定。" },
  { field:"装备", meaning:"武器、盾与铠甲、旅途装备（装备栏中的道具尺寸视为 0）。" },
  { field:"异常状态", meaning:"身体系（重伤 / 中毒 / 疾病）与精神系（萎靡 / 激动 / 失神）。" }
];

DE.CHAR_KINDS = [
  { id:"traveler",  name:"旅行者", detail:"玩家角色。拥有能力值、HP / MP、职业、特长与擅长武器，可以购物与持有道具。等级上限 10。" },
];

/* ============================================================
 *  咒语书规则（依据规则书魔法章节 + 角色卡附表）
 *  - 一般魔法（咒语）：每等级 2 个（p40「获得咒语魔法」），共 2 条正文规则，
 *    全部写在「魔法特长」这一节下 —— 也就是说咒语属于魔法特长
 *  - 1-3 级可学初级，4-6 级可学中级，7 级以上可学高级
 *  - 季节魔法：1 级自动获得初级，4 级自动获得中级，7 级自动获得高级
 *    （特长「季节之法」为掌握季节魔法的前提）
 *  ============================================================ */
DE.SPELL_RULE = {
  /* 每等级能学几个一般魔法。规则书 p40「魔法特长」一节原文：
   *   「获得咒语魔法（12页）
   *    你可以从初级咒语魔法中学习 2 个魔法。之后每次提升等级都能再学习 2 个魔法。」
   * 以及同页特长表：「咒语书 · 每等级获得 2 个咒语魔法」。
   *
   * 这两处说的是**同一条规则**（特长表那行是对这条的摘要），不是两条可以叠加的加成。
   * 所以：1 级 = 2 个、2 级 = 4 个、3 级 = 6 个 …… 就是「等级 × 2」。
   *
   * 但「获得咒语魔法」整段都写在**魔法特长**标题下，战斗 / 技术特长那两栏
   * 里没有这条，所以咒语栏位仍然只属于魔法特长。 */
  perLevel: 2,                       // 每等级 2 个（魔法特长）
  bonusPerLevelWithBook: 0,          // 「咒语书」是这条规则的出处，不再叠加
  levels: ["初级", "中级", "高级"],
  /* 等级 -> 可学习的最高魔法等级 */
  tierForLevel: function (lv) {
    if (lv >= 7) return "高级";
    if (lv >= 4) return "中级";
    return "初级";
  },
  tierIndex: function (tier) { return DE.SPELL_RULE.levels.indexOf(tier); },
  /* 某个魔法等级需要的最低角色等级 */
  minLevelFor: function (tier) { return tier === "高级" ? 7 : (tier === "中级" ? 4 : 1); },
  /* 咒语是魔法特长的东西：只有魔法特长才有咒语栏位 */
  hasSpellMagic: function (c) {
    var t = (DE.TYPES || []).filter(function (x) { return x.id === (c && c.talent); })[0];
    return !!(t && t.id === "magic");
  },
  /* 一共能学几个一般魔法：等级 × 每级 2 个（仅魔法特长） */
  slotsFor: function (c) {
    if (!DE.SPELL_RULE.hasSpellMagic(c)) return 0;
    var lv = Math.max(1, c.level | 0 || 1);
    return lv * DE.SPELL_RULE.perLevel;
  },
  /* 栏位从哪来的 —— 界面上直接展示，免得看不出来是怎么算的 */
  slotBreakdown: function (c) {
    var lv = Math.max(1, c.level | 0 || 1);
    var has = DE.SPELL_RULE.hasSpellMagic(c);
    return {
      level: lv,
      perLevel: DE.SPELL_RULE.perLevel,
      total: has ? lv * DE.SPELL_RULE.perLevel : 0,
      hasBook: has,                 // 兼容旧字段名：是否拥有咒语栏位
      isMagicTalent: has
    };
  },
  /* 季节魔法：按等级自动获得的档位，没有「季节之法」就没有 */
  seasonalTiers: function (c) {
    var e = DE.char.talentEffects(c);
    if (!e.seasonMagic) return [];
    var lv = Math.max(1, c.level | 0 || 1);
    var out = ["初级"];
    if (lv >= 4) out.push("中级");
    if (lv >= 7) out.push("高级");
    return out;
  }
};

/* 一般魔法按等级分组 */
DE.magicByTier = function (tier) {
  return DE.GENERAL_MAGIC.filter(function (m) { return m.level === tier; });
};

/* 季节魔法：季节名 -> { 初级:[], 中级:[], 高级:[] }（DE.seasons 是 ["春","夏","秋","冬"]） */
DE.seasonalBySeason = function () {
  var out = {};
  (DE.seasons || []).forEach(function (name) {
    out[name] = { 初级: [], 中级: [], 高级: [] };
  });
  DE.SEASONAL_MAGIC.forEach(function (m) {
    var key = m.season || m.seasonId || "";
    if (!out[key]) out[key] = { 初级: [], 中级: [], 高级: [] };
    if (!out[key][m.level]) out[key][m.level] = [];
    out[key][m.level].push(m);
  });
  return out;
};

/* 当前角色已掌握的季节魔法（按季节 + 已获得的档位） */
DE.knownSeasonal = function (c) {
  var tiers = DE.SPELL_RULE.seasonalTiers(c);
  if (!tiers.length) return [];
  var season = c.seasonMagic || "";
  return DE.SEASONAL_MAGIC.filter(function (m) {
    return (!season || m.season === season) && tiers.indexOf(m.level) >= 0;
  });
};

/* ---------- 已学咒语的增删 ---------- */
DE.knownGeneral = function (c) {
  var list = c.spells || [];
  return DE.GENERAL_MAGIC.filter(function (m) { return list.indexOf(m.no) >= 0; });
};
DE.spellSlotInfo = function (c) {
  var used = DE.knownGeneral(c).length;
  var total = DE.SPELL_RULE.slotsFor(c);
  return { used: used, total: total, left: total - used, over: used > total };
};
DE.canLearn = function (c, no) {
  var m = DE.GENERAL_MAGIC.filter(function (x) { return x.no === no; })[0];
  if (!m) return { ok: false, msg: "找不到这个魔法。" };
  if (c.spells && c.spells.indexOf(no) >= 0) return { ok: false, msg: "〈" + m.name + "〉已经学会了。" };
  var lv = c.level | 0 || 1;
  if (lv < DE.SPELL_RULE.minLevelFor(m.level))
    return { ok: false, msg: "需要角色等级 " + DE.SPELL_RULE.minLevelFor(m.level) +
      " 才能学习" + m.level + "魔法（当前 " + lv + " 级）。" };
  var si = DE.spellSlotInfo(c);
  var bd = DE.SPELL_RULE.slotBreakdown(c);
  /* 没有「咒语书」特长：直接说清楚，别报成「栏位已满」 */
    if (!bd.isMagicTalent)
    return { ok: false, msg: "咒语魔法只属于魔法特长（规则书 p40），当前特长不能学咒语。" };
  if (si.left <= 0)
    return { ok: false, msg: "咒语栏位已满（" + si.used + "/" + si.total + "）。提升等级或调整已学咒语。" };
  return { ok: true, msg: "" };
};
DE.learnSpell = function (c, no) {
  var r = DE.canLearn(c, no);
  if (!r.ok) return r;
  c.spells = c.spells || [];
  c.spells.push(no);
  var m = DE.GENERAL_MAGIC.filter(function (x) { return x.no === no; })[0];
  return { ok: true, msg: "已把〈" + m.name + "〉记入咒语书。" };
};
DE.forgetSpell = function (c, no) {
  var m = DE.GENERAL_MAGIC.filter(function (x) { return x.no === no; })[0];
  if (!m) return { ok: false, msg: "找不到这个魔法。" };
  c.spells = (c.spells || []).filter(function (x) { return x !== no; });
  return { ok: true, msg: "已从咒语书划掉〈" + m.name + "〉。" };
};

/* ============================================================
 *  能力值「阶段」与「状态绝佳」
 *  规则书：能力值以骰子面数表示，阶段为 4 → 6 → 8 → 10 → 12。
 *  ★10 = 状态绝佳：任意 1 个能力值上升 1 阶段。
 *  ============================================================ */
DE.ABILITY_STAGES = [4, 6, 8, 10, 12];

/* 取某个能力值所处阶段的下标（0~4）；不在阶段上则回退到不超过它的那个 */
DE.abilityStageIndex = function (v) {
  var idx = -1;
  DE.ABILITY_STAGES.forEach(function (x, i) { if (x <= v) idx = i; });
  return idx < 0 ? 0 : idx;
};

/* 上升 1 阶段后的数值；已经是 12 则返回 null（到顶） */
DE.abilityUp = function (v) {
  var i = DE.abilityStageIndex(v);
  if (i >= DE.ABILITY_STAGES.length - 1) return null;
  return DE.ABILITY_STAGES[i + 1];
};

/* 下降 1 阶段后的数值；已经是 4 则返回 null（到下限）
   规则书 p74：「能力值按照 12→10→8→6→4 的顺序下降，能力值不会小于 4。」 */
DE.abilityDown = function (v) {
  var i = DE.abilityStageIndex(v);
  if (i <= 0) return null;
  return DE.ABILITY_STAGES[i - 1];
};

/* 某个能力值是否可以再提升 */
DE.canRaiseAbility = function (c, key) {
  if (!c.abilities || typeof c.abilities[key] !== "number") return false;
  return DE.abilityUp(c.abilities[key]) !== null;
};

/* 有哪些能力值还能提升 */
DE.raisableAbilities = function (c) {
  return DE.ABILITY_KEYS.filter(function (k) { return DE.canRaiseAbility(c, k.key); });
};

/* 状态绝佳带来的「提升能力值」是否可用（状态值 ≥ 10 且当天还没用掉） */
DE.canUsePerfectBoost = function (c) {
  var st = parseInt(c.status, 10);
  if (isNaN(st)) st = 10;
  if (st < 10) return false;
  return !c.perfectBoostUsed;
};

/* 提升一个能力值 1 阶段。返回 { ok, from, to, msg } */
DE.raiseAbility = function (c, key) {
  var k = DE.ABILITY_KEYS.filter(function (x) { return x.key === key; })[0];
  if (!k) return { ok: false, msg: "找不到这个能力值。" };
  var from = c.abilities[key];
  var to = DE.abilityUp(from);
  if (to === null)
    return { ok: false, msg: "【" + k.name + "】已经是最高阶段 " + DE.ABILITY_STAGES[DE.ABILITY_STAGES.length - 1] + " 了。" };
  c.abilities[key] = to;
  /* HP / MP 上限跟着能力值走，这里顺手把派生值同步一次 */
  c.condition = c.abilities.str + c.abilities.spr;
  return { ok: true, key: key, from: from, to: to,
           msg: "★ 状态绝佳：【" + k.name + "】从 " + from + "（d" + from + "）提升到 " + to + "（d" + to + "）。" };
};

/* 让系统挑一个还能提升的能力值（优先最低的那个） */
DE.bestAbilityToRaise = function (c) {
  var list = DE.raisableAbilities(c);
  if (!list.length) return null;
  list.sort(function (a, b) { return c.abilities[a.key] - c.abilities[b.key]; });
  return list[0].key;
};
