import {SOLVED,FACES,COLORS,SLOTS,applyMove,applyAlgorithm,parseAlgorithm,inverseMove,inverseAlgorithm,isSolved,colorAt,scramble,stageFlags,validateState} from './core.js';
import {solve as solveCube} from './solver.js';
import {CubeRenderer,renderNet} from './renderer.js';
import {LESSONS,FACE_NAMES,COLOR_NAMES,describeMove,macroName} from './lessons.js';
const $=id=>document.getElementById(id);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='cube-lab:v1';
let state=SOLVED.slice(),undoStack=[],redoStack=[],moveCount=0,selected=-1,activeLesson=0,view='net',labels=true;
let plan=null,cursor=0,busy=false,playing=false,solving=false,requestId=0,worker=null,solverTimeout=null,playSession=0;
let elapsed=0,timerStart=null,assisted=false,scrambleText='',toastTimer=null,speed=400,page='play';
let storageAvailable=true;
try{const raw=localStorage.getItem(STORE);if(raw){const saved=JSON.parse(raw);if(saved.version===1){state=validateState(saved.state);moveCount=Number.isSafeInteger(saved.moves)&&saved.moves>=0?saved.moves:0;elapsed=Number.isFinite(saved.elapsed)&&saved.elapsed>=0?saved.elapsed:0;assisted=!!saved.assisted;scrambleText=String(saved.scramble||'').slice(0,1500);activeLesson=Math.max(0,Math.min(6,Number(saved.lesson)||0));view=saved.view==='ring'?'ring':'net';speed=[40,170,400,800].includes(saved.speed)?saved.speed:400;}}}catch(error){storageAvailable=false;console.warn('Could not restore local cube state:',error.message);}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4800);}
function currentElapsed(){return elapsed+(timerStart===null?0:Date.now()-timerStart);}
function stopTimer(){elapsed=currentElapsed();timerStart=null;}
function timeText(ms){const total=Math.floor(ms/100);return String(Math.floor(total/600)).padStart(2,'0')+':'+String(Math.floor(total/10)%60).padStart(2,'0')+'.'+total%10;}
function save(){try{localStorage.setItem(STORE,JSON.stringify({version:1,state:Array.from(state),moves:moveCount,elapsed:currentElapsed(),assisted,scramble:scrambleText,lesson:activeLesson,view,speed}));storageAvailable=true;}catch{storageAvailable=false;}$('save-status').textContent=storageAvailable?'状态会保存在当前浏览器，不上传服务器。':'浏览器未允许本地保存。离开前请使用「导出进度」。';}
function snapshot(){return {state:state.slice(),moves:moveCount};}
function pushUndo(){undoStack.push(snapshot());if(undoStack.length>300)undoStack.shift();redoStack=[];}
function blocked(){return busy||playing||solving;}
function invalidatePlan(){playing=false;playSession++;plan=null;cursor=0;renderer.focusFace=null;renderPlayer();}
const renderer=new CubeRenderer($('cube-canvas'),{
 onSelect:slot=>{if(busy)return;selected=state[slot];renderVisuals();},
 onTurn:move=>userTurn(move)
});
function renderVisuals(){
 renderer.setState(state);renderer.setSelection(selected);renderer.labels=labels;
 renderNet($('flat-view'),state,{mode:view,labels,selected,focus:renderer.focusFace,onSelect:slot=>{if(busy)return;selected=state[slot];renderVisuals();}});
 if($('map-dialog').open){renderNet($('expanded-flat-view'),state,{mode:view,labels:true,selected,focus:renderer.focusFace,onSelect:slot=>{if(busy)return;selected=state[slot];renderVisuals();}});$('expanded-description').textContent=$('map-description').textContent;}
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
 $('map-description').textContent=view==='ring'?'从内到外 U / R / F / D / L / B；每圈顺时针 1–9。编码位置，不表示真实相邻。':'一次看全六个面。点选色块，与 3D 视图交叉定位。';
 if(selected>=0){const pos=state.indexOf(selected),slot=SLOTS[pos],kind=slot.p.filter(v=>v!==0).length;const type=kind===3?'角块':kind===2?'棱块':'中心';$('selection-text').textContent=`${type} · ${COLOR_NAMES[FACES[Math.floor(selected/9)]]}贴纸 · 当前位置 ${slot.face}${pos%9+1} · 原位 ${FACES[Math.floor(selected/9)]}${selected%9+1}`;}
 else $('selection-text').textContent='黄色在上，绿色朝前，白色在下。';
 const solved=isSolved(state);$('cube-state').textContent=solved?'已复原':assisted?'引导中':'练习中';$('cube-state').classList.toggle('solved',solved);$('move-count').textContent=String(moveCount);$('timer').textContent=timeText(currentElapsed());
 $('scramble-text').textContent=scrambleText||'还没有打乱。从右侧选择一节课，或直接开始。';
 renderStages();updateButtons();
}
function updateButtons(){
 const lock=blocked();
 for(const id of ['scramble','solve','reset','import-state','algorithm-input'])$(id).disabled=lock;
 document.querySelectorAll('[data-move],.lesson-actions button,[data-practice],#algorithm-form button').forEach(b=>b.disabled=lock);
 $('undo').disabled=lock||!undoStack.length;$('redo').disabled=lock||!redoStack.length;
 $('next-step').disabled=lock||!plan||cursor>=plan.steps.length;
 $('previous-step').disabled=lock||!plan||cursor===0;
 $('play-pause').disabled=solving||!plan||(!playing&&(busy||cursor>=plan.steps.length));
 $('play-pause').textContent=playing?'Ⅱ 暂停':'▶ 播放';
 $('solve').innerHTML=solving?'<span>◌</span>正在规划…':'<span>✦</span>分层求解';
 $('copy-solution').disabled=!plan;
}
function renderStages(){const flags=stageFlags(state);$('stage-list').innerHTML=LESSONS.map((lesson,i)=>`<button class="stage-button ${i===activeLesson?'active':''} ${flags[i]?'complete':''}" data-lesson="${i}" aria-pressed="${i===activeLesson}"><span class="stage-number">${flags[i]?'✓':String(i+1).padStart(2,'0')}</span><span class="stage-copy"><b>${lesson.title}</b><small>${lesson.tag}</small></span><span class="stage-arrow">›</span></button>`).join('');document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{activeLesson=Number(b.dataset.lesson);renderStages();renderLesson();save();});}
function renderLesson(){
 const l=LESSONS[activeLesson];$('lesson-detail').innerHTML=`<div class="lesson-tag">LESSON ${String(activeLesson+1).padStart(2,'0')} / ${l.tag}</div><h3>${l.subtitle}</h3><p>${l.goal}</p><code class="formula-chip">${escapeHTML(l.algorithm)}</code><p>${l.reason}</p><div class="lesson-actions" style="margin-top:12px"><button id="lesson-load" class="btn secondary">载入练习</button><button id="lesson-demo" class="btn ghost">分步演示 →</button></div>`;
 $('lesson-load').onclick=()=>loadLesson(activeLesson,false);$('lesson-demo').onclick=()=>loadLesson(activeLesson,true);updateButtons();
}
function showPage(name){page=name;document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id==='page-'+name));document.querySelectorAll('[data-page]').forEach(e=>{e.classList.toggle('active',e.dataset.page===name);e.setAttribute('aria-current',e.dataset.page===name?'page':'false');});if(name==='play')renderer.requestDraw();}
function setPlan(newPlan){plan={...newPlan,baseCount:moveCount};cursor=0;renderPlayer();renderVisuals();}
function renderPlayer(){
 $('player-content').hidden=!plan;
 if(!plan){$('player-title').textContent='让公式，一步一步发生。';$('player-description').textContent=solving?'正在根据当前状态规划适用的分层公式…':'点击「分层求解」生成七阶段路线，或载入右侧的公式练习。';updateButtons();return;}
 const done=cursor===plan.steps.length,step=plan.steps[cursor]||plan.steps[Math.max(0,cursor-1)];
 $('player-title').textContent=done?(isSolved(state)?'六面归一，复原完成。':'这组公式，已经执行完成。'):plan.title;
 $('player-description').textContent=plan.description;
 $('player-progress').style.width=(plan.steps.length?cursor/plan.steps.length*100:100)+'%';
 $('step-counter').textContent=`${cursor} / ${plan.steps.length} 步`;
 $('formula-name').textContent=step?(step.stage>=0?`${String(step.stage+1).padStart(2,'0')} · ${LESSONS[step.stage].title} / `:'')+macroName(step.name||'自定义公式'):'';
 $('algorithm-tokens').innerHTML=plan.steps.map((s,i)=>`<span class="alg-token ${i<cursor?'done':''} ${i===cursor?'current':''} ${i>0&&s.formula!==plan.steps[i-1].formula?'group-start':''}" title="第 ${i+1} 步：${escapeHTML(describeMove(s.move))}" ${i===cursor?'aria-current="step"':''}>${escapeHTML(s.move)}</span>`).join('');
 const current=$('algorithm-tokens').querySelector('.current');if(current){const box=$('algorithm-tokens'),top=current.offsetTop-box.offsetTop;if(top<box.scrollTop||top>box.scrollTop+box.clientHeight-30)box.scrollTop=top;}
 $('step-description').textContent=done?(isSolved(state)?'完整公式已回放验证。现在可以打乱再来一次。':'公式已结束；它未必是此状态的完整解。可重新点击「分层求解」。'):step?`下一步 ${step.move}：${describeMove(step.move)}。正对该面判断方向。`:'';
 renderer.focusFace=!done&&step?step.move[0]:null;renderer.requestDraw();updateButtons();
}
async function performMove(move,source='manual'){
 if(busy)return false;
 const before=snapshot();busy=true;renderer.focusFace=move[0];$('current-turn').hidden=false;$('current-turn').querySelector('b').textContent=move;$('current-turn').querySelector('span').textContent=describeMove(move);updateButtons();
 if(timerStart===null)timerStart=Date.now();
 try{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  await renderer.animate(move,reduced?0:speed*(move.endsWith('2')?1.25:1));
  undoStack.push(before);if(undoStack.length>300)undoStack.shift();redoStack=[];
  state=applyMove(state,move);moveCount++;if(source==='player')assisted=true;if(isSolved(state))stopTimer();
 }finally{busy=false;$('current-turn').hidden=true;renderer.focusFace=null;renderVisuals();save();}
 return true;
}
async function userTurn(move){if(blocked())return;invalidatePlan();await performMove(move);renderPlayer();}
async function nextStep(){
 if(busy||solving||!plan||cursor>=plan.steps.length)return;
 const p=plan,step=p.steps[cursor];if(step.stage>=0&&activeLesson!==step.stage){activeLesson=step.stage;renderLesson();}
 await performMove(step.move,'player');if(plan!==p)return;cursor++;moveCount=p.baseCount+cursor;renderPlayer();renderVisuals();save();
}
async function previousStep(){
 if(blocked()||!plan||cursor<=0)return;
 const p=plan;await performMove(inverseMove(p.steps[cursor-1].move),'player');cursor--;moveCount=p.baseCount+cursor;const step=p.steps[cursor];if(step.stage>=0){activeLesson=step.stage;renderLesson();}renderPlayer();renderVisuals();save();
}
async function togglePlay(){
 if(playing){playing=false;playSession++;updateButtons();return;}
 if(busy||solving||!plan||cursor>=plan.steps.length)return;
 playing=true;const session=++playSession;updateButtons();
 while(playing&&session===playSession&&plan&&cursor<plan.steps.length){await nextStep();if(playing)await new Promise(resolve=>setTimeout(resolve,speed>=400?85:12));}
 if(session===playSession){playing=false;updateButtons();}
}
function changeState(next,{scrambleLabel='',clearHistory=true}={}){
 invalidatePlan();stopTimer();elapsed=0;state=next.slice();moveCount=0;assisted=false;selected=-1;scrambleText=scrambleLabel;if(clearHistory){undoStack=[];redoStack=[];}renderVisuals();renderLesson();save();
}
function lessonPlan(i){const l=LESSONS[i],moves=parseAlgorithm(l.algorithm);return {title:`${l.title} · 公式练习`,description:'预设案例与本公式匹配。可以逐步前进、后退，或整组播放。',steps:moves.map(move=>({move,stage:i,formula:l.algorithm,name:'练习公式'})),algorithm:l.algorithm};}
function loadLesson(i,demo=false){
 if(blocked())return;activeLesson=i;const l=LESSONS[i];changeState(applyAlgorithm(SOLVED,inverseAlgorithm(l.algorithm)),{scrambleLabel:'练习设置：'+inverseAlgorithm(l.algorithm).join(' ')});renderer.resetCamera();showPage('play');setPlan(lessonPlan(i));toast(`已载入「${l.title}」的匹配案例。原魔方状态已替换。`);if(demo)togglePlay();
}
function undo(){if(blocked()||!undoStack.length)return;invalidatePlan();redoStack.push(snapshot());const previous=undoStack.pop();state=previous.state;moveCount=previous.moves;stopTimer();renderVisuals();save();}
function redo(){if(blocked()||!redoStack.length)return;invalidatePlan();undoStack.push(snapshot());const next=redoStack.pop();state=next.state;moveCount=next.moves;stopTimer();renderVisuals();save();}
function receiveSolution(result,id){
 if(id!==requestId)return;clearTimeout(solverTimeout);solving=false;
 if(!result.verified||!isSolved(applyAlgorithm(state,result.steps.map(s=>s.move)))){toast('求解结果未通过回放校验，已阻止执行。');renderPlayer();return;}
 const first=result.steps[0];if(first){activeLesson=first.stage;renderLesson();}
 setPlan({...result,title:'七阶段分层求解 · 已验证',description:`共 ${result.steps.length} 步，从当前状态计算；使用适用的分层公式，不倒放打乱，也不保证最短解。`});toast('解法已生成。先试着按「下一步」，看懂当前工作面。');
}
function solverFailure(message,id){if(id!==requestId)return;clearTimeout(solverTimeout);solving=false;toast('未能生成解法：'+message);renderPlayer();updateButtons();}
function requestSolution(){
 if(blocked())return;if(isSolved(state)){toast('魔方已经复原。先随机打乱，或载入一节公式练习。');return;}
 invalidatePlan();solving=true;const id=++requestId;renderPlayer();updateButtons();
 solverTimeout=setTimeout(()=>{if(worker){worker.terminate();worker=null;}solverFailure('计算超时，当前魔方已保留，请重试。',id);requestId++;},15000);
 try{
  if(!worker){
   if(globalThis.__CUBE_SOLVER_WORKER_SOURCE__){const url=URL.createObjectURL(new Blob([globalThis.__CUBE_SOLVER_WORKER_SOURCE__],{type:'text/javascript'}));worker=new Worker(url);setTimeout(()=>URL.revokeObjectURL(url),1000);}
   else worker=new Worker(new URL('./solver-worker.js',import.meta.url),{type:'module'});
   worker.onmessage=event=>{const d=event.data;if(d.id!==requestId)return;if(d.type==='result')receiveSolution(d.result,d.id);else if(d.type==='error')solverFailure(d.message,d.id);else if(d.type==='progress')$('player-description').textContent=`正在规划第 ${Math.min(7,d.stage+1)} 阶段，当前魔方不会改变…`;};
   worker.onerror=event=>{event.preventDefault();const active=requestId;if(worker){worker.terminate();worker=null;}try{receiveSolution(solveCube(state),active);}catch(e){solverFailure(e.message,active);}};
  }
  worker.postMessage({id,state:Array.from(state)});
 }catch{setTimeout(()=>{try{receiveSolution(solveCube(state),id);}catch(e){solverFailure(e.message,id);}},20);}
}
$('move-pad').innerHTML=FACES.map(f=>`<div class="face-controls"><div class="face-title"><i style="background:${COLORS[f]}"></i><b>${f}</b>${FACE_NAMES[f]}</div><div class="face-buttons">${[f,f+"'",f+'2'].map(m=>`<button data-move="${escapeHTML(m)}" title="${describeMove(m)}" aria-label="${describeMove(m)}">${escapeHTML(m)}</button>`).join('')}</div></div>`).join('');
document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>userTurn(b.dataset.move));
$('face-legend').innerHTML=FACES.map(f=>`<span title="${FACE_NAMES[f]} · ${COLOR_NAMES[f]}"><i style="background:${COLORS[f]}"></i>${f}</span>`).join('');
$('lesson-library').innerHTML=LESSONS.map((l,i)=>`<article class="lesson-card card"><div class="lesson-card-top"><b>${String(i+1).padStart(2,'0')}</b><span>${l.tag}</span></div><h3>${l.title}</h3><p>${l.goal}</p><code class="formula-chip">${escapeHTML(l.algorithm)}</code><p><strong>什么时候使用</strong><br>${l.when}</p><p><strong>观察重点</strong><br>${l.tips}</p><button data-practice="${i}" class="btn secondary">载入匹配案例 →</button></article>`).join('');
document.querySelectorAll('[data-practice]').forEach(b=>b.onclick=()=>{loadLesson(Number(b.dataset.practice));window.scrollTo({top:0,behavior:'smooth'});});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;renderVisuals();save();});
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$('show-labels').onchange=e=>{labels=e.target.checked;renderVisuals();};
$('scramble').onclick=()=>{if(blocked())return;const alg=scramble(22);changeState(applyAlgorithm(SOLVED,alg),{scrambleLabel:alg.join(' ')});toast('已从复原状态随机打乱 22 步。计时从第一次转动开始。');};
$('reset').onclick=()=>{if(blocked())return;changeState(SOLVED);toast('已复原魔方，并清空本次计时和历史。');};
$('solve').onclick=requestSolution;$('undo').onclick=undo;$('redo').onclick=redo;
$('camera-reset').onclick=()=>renderer.resetCamera();$('map-expand').onclick=()=>{$('map-dialog').showModal();renderVisuals();};$('map-close').onclick=()=>$('map-dialog').close();$('next-step').onclick=()=>{if(!playing)nextStep();};$('previous-step').onclick=previousStep;$('play-pause').onclick=togglePlay;
$('speed').value=String(speed);$('speed').onchange=e=>{speed=Number(e.target.value);save();};
$('algorithm-form').onsubmit=e=>{e.preventDefault();if(blocked())return;try{const moves=parseAlgorithm($('algorithm-input').value);if(!moves.length){toast('先输入一个公式，例如 R U R′ U′。');return;}setPlan({title:'自定义公式 · 观察变化',description:'在当前状态执行此公式。注意：任意公式不一定能复原当前魔方。',algorithm:moves.join(' '),steps:moves.map(move=>({move,stage:-1,formula:moves.join(' '),name:'自定义公式'}))});togglePlay();}catch(error){toast('公式无法识别。仅支持 U R F D L B、逆时针符号和 2；不支持括号或转体。');}};
$('help-open').onclick=()=>$('help-dialog').showModal();$('help-close').onclick=()=>$('help-dialog').close();$('help-start').onclick=()=>$('help-dialog').close();
$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=$('help-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('help-dialog').close();}});
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('export-state').onclick=()=>download(JSON.stringify({version:1,state:Array.from(state),moves:moveCount,elapsed:currentElapsed(),assisted,scramble:scrambleText},null,2),'cube-lab-progress.json','application/json');
$('import-state').onclick=()=>{if(!blocked())$('import-file').click();};
$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(blocked())throw new Error('请等待当前转动结束。');if(file.size>100000)throw new Error('进度文件过大。');const data=JSON.parse(await file.text());if(data.version!==1)throw new Error('不支持此进度格式。');const imported=validateState(data.state);if(blocked())throw new Error('当前正在转动，请稍后重新导入。');changeState(imported,{scrambleLabel:String(data.scramble||'导入的合法状态').slice(0,1500)});moveCount=Number.isSafeInteger(data.moves)&&data.moves>=0?data.moves:0;elapsed=Number.isFinite(data.elapsed)&&data.elapsed>=0?data.elapsed:0;assisted=!!data.assisted;renderVisuals();save();toast('进度已导入，并通过魔方物理合法性校验。');}catch(error){toast('无法导入：'+error.message);}finally{e.target.value='';}};
$('copy-solution').onclick=async()=>{if(!plan)return;const text=plan.steps.map(s=>s.move).join(' ');try{await navigator.clipboard.writeText(text);toast('完整公式已复制。');}catch{download(text,'cube-lab-solution.txt','text/plain;charset=utf-8');toast('浏览器禁止剪贴板访问，已改为导出公式文本。');}};
document.addEventListener('keydown',e=>{
 if(e.target.closest('input,textarea,select')||$('help-dialog').open)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
 if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||page!=='play')return;
 if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();togglePlay();}
 else if(e.key==='ArrowRight'){e.preventDefault();if(!playing)nextStep();}
 else if(e.key==='ArrowLeft'){e.preventDefault();previousStep();}
 else if(/^[urfdlb]$/i.test(e.key)){e.preventDefault();userTurn(e.key.toUpperCase()+(e.shiftKey?"'":''));}
});
window.addEventListener('beforeunload',save);
setInterval(()=>{if(timerStart!==null&&page==='play')$('timer').textContent=timeText(currentElapsed());},100);
renderVisuals();renderLesson();renderPlayer();save();
// Read-only diagnostics for automated browser checks; no state mutation interface.
globalThis.CubeLabDebug={snapshot:()=>({state:Array.from(state),solved:isSolved(state),moves:moveCount,busy,playing,solving,cursor,steps:plan?.steps.length||0,view,stageFlags:stageFlags(state),selected})};