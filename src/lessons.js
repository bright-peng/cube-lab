import {ALGORITHMS} from './solver.js';
export const FACE_NAMES={U:'上面',R:'右面',F:'前面',D:'下面',L:'左面',B:'后面'};
export const COLOR_NAMES={U:'黄色',R:'红色',F:'绿色',D:'白色',L:'橙色',B:'蓝色'};
export const LESSONS=[
 {title:'白色十字',tag:'建立坐标',subtitle:'先解决四个棱块',algorithm:'F2',goal:'让四个白色棱块回到底面，侧面颜色也要与各面的中心一致。',reason:'中心给出了颜色的归属。只拼出白色十字还不够，侧面的颜色也必须匹配。',when:'真实打乱时，先找白色棱块并规划短路径；练习案例已把一个白绿棱块放到对齐的位置，F2 将它送回底层。',tips:'始终以白色为底、黄色为顶。十字阶段由引擎搜索短转动路径，不套用一个固定万能公式。',sample:'F2'},
 {title:'底层角块',tag:'第一层',subtitle:'认识四步小循环',algorithm:ALGORITHMS.trigger,goal:'把带白色的四个角块放回底层，形成完整第一层。',reason:'右手四步会改变局部角块，又在完整执行后保留白色十字。可重复应用，并结合 U 调整目标块。',when:'先把目标角块移到它归属槽位的上方，再按朝向选择公式。载入练习提供一个恰好用一组右手四步解决的案例。',tips:'执行完最后的 U′ 才算一组。中间暂时破坏的颜色不代表公式错误。'},
 {title:'中层棱块',tag:'前两层',subtitle:'把不含黄色的棱块插入中层',algorithm:ALGORITHMS.middleRight,goal:'在不破坏底层的前提下，放好四个中层棱块。',reason:'先用顶层暂存目标块，再拆开并恢复底层角块，把棱块插到正确的位置。',when:'顶层寻找不带黄色的棱块。其正面颜色与 F 中心对齐、上方颜色与 R 中心一致时，用右插公式；左插需要镜像公式。',tips:'卡在错误中层位置的棱块，需要先用插入公式取出，再对齐重插。'},
 {title:'黄色十字',tag:'顶层朝向 · 棱',subtitle:'先让四个黄色棱贴纸朝上',algorithm:ALGORITHMS.yellowCross,goal:'只看顶层棱块，让黄色朝上的图案成为十字；先忽略角块。',reason:'F 将工作区域带到右手四步可处理的位置，结束时 F′ 把工作面恢复。',when:'该公式可处理横向一字案例。L 形和点形需要调整顶层方向、重复或使用变体；练习已摆放为匹配的案例。',tips:'此时只保证黄色朝上，不保证十字侧边颜色已经对齐。'},
 {title:'黄色顶面',tag:'顶层朝向 · 角',subtitle:'用 Sune 调整角块朝向',algorithm:ALGORITHMS.sune,goal:'保留前两层和黄色十字，让四个黄色角贴纸都朝上。',reason:'角块的位置与朝向是两个不同问题。Sune 主要在顶层操作，完整执行后保留前两层。',when:'Sune 不是任何黄顶图案都一次成功。载入练习得到与此式匹配的案例；真实求解器会组合 U、Sune 及逆式。',tips:'黄面全黄仍不一定复原：接下来还要排列顶层角块和棱块的位置。'},
 {title:'顶层角块归位',tag:'顶层排列 · 角',subtitle:'用 T-perm 调整角块位置',algorithm:ALGORITHMS.tperm,goal:'使四个顶层角块的侧面颜色也回到对应中心。',reason:'T-perm 保持顶层朝向，并交换一对角块和一对棱块；最后一阶段再处理棱块。',when:'这一节在顶面全部朝上、前两层完成后进行。真实状态可能需要顶层调整和不同工作面的 T-perm。',tips:'14 步较长，先分段慢放。不要中途停下来用其他公式“修复”暂时打散的底层。'},
 {title:'最后的棱块',tag:'完成复原',subtitle:'用 U-perm 轮换三个棱块',algorithm:ALGORITHMS.ua,goal:'保持角块不动，让剩余顶层棱块回到正确位置。',reason:'U-perm 只循环顶层的三个棱块。用其逆式可反向循环，用其他工作面版本可选择不同的固定棱块。',when:'顶层角块已归位时使用。若四个棱块都不对，可能需要多组公式；载入练习只需一组。',tips:'最后以六个面全部同色为准，而不是只看顶面。恭喜你，把最后一个局部问题解决了。'}
];
export function describeMove(move){return FACE_NAMES[move[0]]+' · '+(move.endsWith('2')?'转动 180°':move.endsWith("'")?'逆时针 90°':'顺时针 90°');}
export function macroName(name){return name.replace('Build cross','十字定位').replace('Align top','顶层对齐').replace('Right trigger','右手四步').replace('Right insertion','中层右插').replace('Left insertion','中层左插').replace('Yellow cross','黄色十字').replace('Sune','Sune / 小鱼').replace('T permutation','T-perm / 角块归位').replace('U permutation','U-perm / 棱块循环').replace('inverse','逆公式').replace(/@([FRBL])/g,(_,f)=>'· 工作面 '+f);}