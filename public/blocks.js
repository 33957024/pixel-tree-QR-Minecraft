// Minecraft 方块库（精选常用方块）。每项：{ id, name, color }
// `color` 是该方块的代表色，用于界面色块与投影预览（非真实贴图）。
// 搜索支持：中文名、方块 id（如 "white_stained_glass" 或 "minecraft:white_stained_glass"）。
(function (global) {
  var DYE = {
    white: ['#F0F0F0', '白色'], orange: ['#F9801D', '橙色'], magenta: ['#C74EBD', '品红色'],
    light_blue: ['#3AB3DA', '淡蓝色'], yellow: ['#FED83D', '黄色'], lime: ['#80C71F', '黄绿色'],
    pink: ['#F38BAA', '粉红色'], gray: ['#474F52', '灰色'], light_gray: ['#9D9D97', '淡灰色'],
    cyan: ['#169C9C', '青色'], purple: ['#8932B8', '紫色'], blue: ['#3C44AA', '蓝色'],
    brown: ['#835432', '棕色'], green: ['#5E7C16', '绿色'], red: ['#B02E26', '红色'],
    black: ['#1D1D21', '黑色']
  };

  var blocks = [];

  // 16 色染色系列（染色玻璃 / 混凝土 / 羊毛 / 陶瓦 / 混凝土粉末）
  var FAMILIES = {
    stained_glass: '染色玻璃', concrete: '混凝土', wool: '羊毛',
    terracotta: '陶瓦', concrete_powder: '混凝土粉末'
  };
  Object.keys(FAMILIES).forEach(function (fam) {
    Object.keys(DYE).forEach(function (key) {
      blocks.push({ id: 'minecraft:' + key + '_' + fam, name: DYE[key][1] + FAMILIES[fam], color: DYE[key][0] });
    });
  });

  // 常用固体方块
  var SOLID = [
    ['minecraft:stone', '石头', '#7F7F7F'], ['minecraft:cobblestone', '圆石', '#6F6F6F'],
    ['minecraft:stone_bricks', '石砖', '#7A7A7A'], ['minecraft:mossy_stone_bricks', '苔石砖', '#6B7A5A'],
    ['minecraft:cracked_stone_bricks', '裂纹石砖', '#757575'], ['minecraft:granite', '花岗岩', '#8C6B5E'],
    ['minecraft:diorite', '闪长岩', '#BDBDBD'], ['minecraft:andesite', '安山岩', '#8C8C8C'],
    ['minecraft:deepslate', '深板岩', '#4A4A4A'], ['minecraft:cobbled_deepslate', '深板岩圆石', '#4E4E4E'],
    ['minecraft:tuff', '凝灰岩', '#6E6E6A'], ['minecraft:calcite', '方解石', '#D6D4CB'],
    ['minecraft:basalt', '玄武岩', '#3D3D3D'], ['minecraft:blackstone', '黑石', '#2E2E2E'],
    ['minecraft:obsidian', '黑曜石', '#191219'], ['minecraft:bedrock', '基岩', '#3D3D3D'],
    ['minecraft:dirt', '泥土', '#966C4A'], ['minecraft:grass_block', '草方块', '#7CB342'],
    ['minecraft:sand', '沙子', '#DBD3A0'], ['minecraft:red_sand', '红沙', '#C27A3A'],
    ['minecraft:sandstone', '砂岩', '#D6C98F'], ['minecraft:gravel', '沙砾', '#7F7F7F'],
    ['minecraft:snow_block', '雪块', '#F4FBFD'], ['minecraft:ice', '冰', '#7FB8FF'],
    ['minecraft:packed_ice', '浮冰', '#8CB4FF'], ['minecraft:blue_ice', '蓝冰', '#6E9FFF'],
    ['minecraft:glass', '玻璃', '#C8D8E0'],
    ['minecraft:oak_log', '橡木原木', '#6B5232'], ['minecraft:oak_planks', '橡木木板', '#B8945F'],
    ['minecraft:spruce_log', '云杉原木', '#3B2A16'], ['minecraft:spruce_planks', '云杉木板', '#6E512E'],
    ['minecraft:birch_log', '白桦原木', '#D7C8A0'], ['minecraft:birch_planks', '白桦木板', '#C6B07A'],
    ['minecraft:jungle_log', '丛林原木', '#6E4F2D'], ['minecraft:jungle_planks', '丛林木板', '#B08D5B'],
    ['minecraft:acacia_log', '金合欢原木', '#5F5342'], ['minecraft:acacia_planks', '金合欢木板', '#B46237'],
    ['minecraft:dark_oak_log', '深色橡木原木', '#3A2B18'], ['minecraft:dark_oak_planks', '深色橡木木板', '#503D28'],
    ['minecraft:mangrove_log', '红树原木', '#6E3E2E'], ['minecraft:cherry_log', '樱花原木', '#D9A7A0'],
    ['minecraft:cherry_planks', '樱花木板', '#E8C6B8'],
    ['minecraft:oak_leaves', '橡树树叶', '#4C7A2E'], ['minecraft:spruce_leaves', '云杉树叶', '#3B5F2A'],
    ['minecraft:birch_leaves', '白桦树叶', '#6E8A3E'], ['minecraft:jungle_leaves', '丛林树叶', '#2E6E2E'],
    ['minecraft:acacia_leaves', '金合欢树叶', '#4C7A2E'], ['minecraft:dark_oak_leaves', '深色橡树树叶', '#3B5F2A'],
    ['minecraft:coal_ore', '煤矿石', '#3A3A3A'], ['minecraft:iron_ore', '铁矿石', '#C7B199'],
    ['minecraft:copper_ore', '铜矿石', '#A98A6E'], ['minecraft:gold_ore', '金矿石', '#D8B95E'],
    ['minecraft:redstone_ore', '红石矿石', '#A64A3E'], ['minecraft:lapis_ore', '青金石矿石', '#3A5FA0'],
    ['minecraft:diamond_ore', '钻石矿石', '#8FD8D8'], ['minecraft:emerald_ore', '绿宝石矿石', '#2E7A2E'],
    ['minecraft:nether_quartz_ore', '下界石英矿石', '#B8A89E'], ['minecraft:ancient_debris', '远古残骸', '#6E4E3A'],
    ['minecraft:coal_block', '煤炭块', '#2E2E2E'], ['minecraft:iron_block', '铁块', '#D8D8D8'],
    ['minecraft:copper_block', '铜块', '#C77B5B'], ['minecraft:gold_block', '金块', '#E8C84A'],
    ['minecraft:redstone_block', '红石块', '#A42E1E'], ['minecraft:lapis_block', '青金石块', '#2A4A9A'],
    ['minecraft:diamond_block', '钻石块', '#7BD8D8'], ['minecraft:emerald_block', '绿宝石块', '#2EC56E'],
    ['minecraft:netherite_block', '下界合金块', '#3A3A3A'], ['minecraft:quartz_block', '石英块', '#E8E6DE'],
    ['minecraft:amethyst_block', '紫水晶块', '#9A7BD0'],
    ['minecraft:glowstone', '荧石', '#E8C878'], ['minecraft:sea_lantern', '海晶灯', '#9CBFA8'],
    ['minecraft:shroomlight', '菌光体', '#E8A878'], ['minecraft:jack_o_lantern', '南瓜灯', '#D8A038'],
    ['minecraft:pumpkin', '南瓜', '#C08038'], ['minecraft:melon', '西瓜', '#7A9A3E'],
    ['minecraft:brick', '红砖', '#9A4E3E'], ['minecraft:nether_bricks', '下界砖块', '#3A1E1E'],
    ['minecraft:prismarine', '海晶石', '#5E9A8A'], ['minecraft:purpur_block', '紫珀块', '#A88A9E'],
    ['minecraft:end_stone', '末地石', '#D8D8A8'], ['minecraft:magma_block', '岩浆块', '#6E3E2E'],
    ['minecraft:slime_block', '史莱姆块', '#6EBA5E'], ['minecraft:honey_block', '蜂蜜块', '#E8A848'],
    ['minecraft:moss_block', '苔藓块', '#4E7A3E'], ['minecraft:bone_block', '骨块', '#D8D0B0'],
    ['minecraft:hay_block', '干草块', '#C8A838'], ['minecraft:bookshelf', '书架', '#8A6E4E'],
    ['minecraft:crafting_table', '工作台', '#7A5E3E'], ['minecraft:furnace', '熔炉', '#6E6E6E'],
    ['minecraft:chest', '箱子', '#8A6E3E'], ['minecraft:barrel', '木桶', '#7A5E3E'],
    ['minecraft:shulker_box', '潜影盒', '#8A5E9E'], ['minecraft:lantern', '灯笼', '#C8A048'],
    ['minecraft:torch', '火把', '#C8A048']
  ];
  SOLID.forEach(function (b) { blocks.push({ id: b[0], name: b[1], color: b[2] }); });

  global.MC_BLOCKS = blocks;
})(window);
