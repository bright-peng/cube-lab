/** Dependency-free perspective renderer. Real 3D coordinates + depth sorting,
 * with integer state commits only after each animated slice turn. */
import {BASIS,SLOTS,COLORS,FACES,add,scale,dot,cross,rotate,colorAt} from './core.js';
const normals=FACES.map(f=>({face:f,...BASIS[f]}));
const stickerByKey=new Map(SLOTS.map(s=>[s.p.join(',')+'|'+s.face,s.index]));
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function roundedPoly(ctx,p,r=.10){
 ctx.beginPath();for(let i=0;i<p.length;i++){const prev=p[(i+3)%4],cur=p[i],next=p[(i+1)%4];const a=lerp(cur,prev,r),b=lerp(cur,next,r);if(!i)ctx.moveTo(...a);else ctx.lineTo(...a);ctx.quadraticCurveTo(...cur,...b);}ctx.closePath();
}
function inside(p,polygon){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export class CubeRenderer {
 constructor(canvas,{onSelect=()=>{},onTurn=()=>{}}={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.yaw=.62;this.pitch=.48;this.zoom=1;this.state=null;this.animation=null;this.selected=-1;this.focusFace=null;this.labels=true;this.hitboxes=[];this.dirty=false;
  this.resizeObserver=new ResizeObserver(()=>this.requestDraw());this.resizeObserver.observe(canvas);
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)>4)drag.moved=true;this.yaw-=dx*.009;this.pitch=Math.max(-1.4,Math.min(1.4,this.pitch+dy*.009));drag.x=e.clientX;drag.y=e.clientY;this.requestDraw();});
  canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const hit=this.pick(e);if(hit)onSelect(hit.slot);}drag=null;canvas.classList.remove('dragging');});
  canvas.addEventListener('pointercancel',()=>{drag=null;canvas.classList.remove('dragging');});
  canvas.addEventListener('dblclick',e=>{e.preventDefault();const hit=this.pick(e);if(hit&&!this.animation)onTurn(hit.face+(e.shiftKey?"'":''));});
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.7,Math.min(1.4,this.zoom-e.deltaY*.001));this.requestDraw();},{passive:false});
 }
 pick(e){const r=this.canvas.getBoundingClientRect(),p=[e.clientX-r.left,e.clientY-r.top];return this.hitboxes.slice().reverse().find(x=>inside(p,x.poly));}
 setState(s){this.state=s;this.requestDraw();}
 setSelection(id){this.selected=id;this.requestDraw();}
 resetCamera(){this.yaw=.62;this.pitch=.48;this.zoom=1;this.requestDraw();}
 requestDraw(){if(this.dirty)return;this.dirty=true;requestAnimationFrame(()=>{this.dirty=false;this.draw();});}
 animate(move,duration){
  if(duration<=0)return Promise.resolve();
  const angle=move.endsWith('2')?-Math.PI:move.endsWith("'")?Math.PI/2:-Math.PI/2;
  return new Promise(resolve=>{const start=performance.now();const frame=now=>{const t=Math.min(1,(now-start)/duration);this.animation={face:move[0],angle:angle*(t<.5?4*t*t*t:1-(-2*t+2)**3/2)};this.draw();if(t<1)requestAnimationFrame(frame);else{this.animation=null;resolve();}};requestAnimationFrame(frame);});
 }
 draw(){
  if(!this.state)return;
  const canvas=this.canvas,ctx=this.ctx,r=canvas.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h)return;
  const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);this.hitboxes=[];
  const eye=[Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)];
  const right=[Math.cos(this.yaw),0,-Math.sin(this.yaw)],up=cross(eye,right),distance=8;
  const unit=Math.min(w/5.8,h/6.05)*this.zoom;
  const project=p=>{const z=dot(p,eye),k=distance/(distance-z);return [w/2+dot(p,right)*unit*k,h*.47-dot(p,up)*unit*k];};
  // Restrained ground shadow, independent of turn state.
  ctx.save();ctx.translate(w*.5,h*.83);ctx.scale(1,.23);const shadow=ctx.createRadialGradient(0,0,0,0,0,unit*2.0);shadow.addColorStop(0,'rgba(0,0,0,.43)');shadow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,unit*2.0,0,2*Math.PI);ctx.fill();ctx.restore();
  const polygons=[];
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   if(x===0&&y===0&&z===0)continue;const p=[x,y,z];
   const turning=this.animation&&dot(p,BASIS[this.animation.face].n)===1;
   const tx=v=>turning?rotate(v,BASIS[this.animation.face].n,this.animation.angle):v;
   for(const b of normals){
    const normal=tx(b.n),center=tx(add(p,scale(b.n,.472)));
    if(dot(normal,add(scale(eye,distance),scale(center,-1)))<=0)continue;
    const quad=size=>[[-1,1],[1,1],[1,-1],[-1,-1]].map(([a,c])=>project(tx(add(add(add(p,scale(b.n,.473)),scale(b.r,a*size)),scale(b.up,c*size)))));
    const key=p.join(',')+'|'+b.face,slot=stickerByKey.get(key),has=slot!==undefined;
    polygons.push({depth:dot(center,eye),poly:quad(.472),sticker:has?quad(.409):null,slot,face:b.face,normal,center:project(center),label:has&&SLOTS[slot].row===1&&SLOTS[slot].col===1});
   }
  }
  polygons.sort((a,b)=>a.depth-b.depth);
  for(const q of polygons){
   roundedPoly(ctx,q.poly,.065);ctx.fillStyle='#17242e';ctx.fill();ctx.strokeStyle='#07121b';ctx.lineWidth=.7;ctx.stroke();
   if(!q.sticker)continue;
   const color=COLORS[colorAt(this.state,q.slot)];roundedPoly(ctx,q.sticker,.135);ctx.fillStyle=color;ctx.fill();
   const shade=Math.max(0,.11-dot(q.normal,[-.2,.8,.6])*.09);ctx.fillStyle=`rgba(0,0,0,${shade})`;ctx.fill();
   if(this.focusFace===q.face){ctx.strokeStyle='rgba(244,255,249,.65)';ctx.lineWidth=1.5;ctx.stroke();}
   if(this.state[q.slot]===this.selected){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#152937';ctx.lineWidth=1;ctx.stroke();}
   if(this.labels&&q.label){ctx.font=`600 ${Math.max(11,unit*.25)}px ui-monospace,monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(17,31,44,.8)';ctx.fillText(q.face,...q.center);}
   this.hitboxes.push({poly:q.sticker,slot:q.slot,face:q.face});
  }
 }
}
const svgNS='http://www.w3.org/2000/svg';
function svgNode(name,attrs={}){const e=document.createElementNS(svgNS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;}
// Three slice families (x/y/z). Each sticker lies on two slice loops;
// their inner/outer intersection distinguishes the two opposite faces.
export const RING_CIRCLES=[[134,256],[200,142],[266,256]].flatMap(([x,y],axis)=>[-1,0,1].map(layer=>({x,y,axis,layer,r:105+layer*19})));
export const RING_POINTS=SLOTS.map(slot=>{
 const loops=RING_CIRCLES.filter(c=>slot.n[c.axis]===0&&slot.p[c.axis]===c.layer),[a,b]=loops;
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),u=(a.r*a.r-b.r*b.r+d*d)/(2*d),h=Math.sqrt(a.r*a.r-u*u);
 const mx=a.x+u*dx/d,my=a.y+u*dy/d;
 const points=[{x:mx-h*dy/d,y:my+h*dx/d},{x:mx+h*dy/d,y:my-h*dx/d}];
 points.sort((p,q)=>Math.hypot(p.x-200,p.y-218)-Math.hypot(q.x-200,q.y-218));
 return {...points[slot.n.find(v=>v!==0)===1?0:1],loops};
});
export function renderNet(container,state,{mode='net',selected=-1,focus=null,onSelect=()=>{},onTurn=()=>{},labels=true}={}){
 const focused=container.contains(document.activeElement)?document.activeElement.dataset.slot:undefined;
 container.classList.toggle('ring-view',mode==='ring');
 const svg=svgNode('svg',{viewBox:mode==='ring'?'0 0 400 400':'0 0 360 280',role:'group','aria-label':mode==='ring'?'三组交叠圆轨道，54 个交点对应魔方贴纸':'魔方六面展开图'});
 const addSticker=(shape,index,label)=>{
  shape.setAttribute('fill',COLORS[colorAt(state,index)]);shape.setAttribute('stroke',state[index]===selected?'#ffffff':focus===SLOTS[index].face?'#dbf4ec':'#12202c');shape.setAttribute('stroke-width',state[index]===selected?3:1.7);shape.setAttribute('class','svg-sticker');shape.setAttribute('tabindex','0');shape.setAttribute('role','button');shape.setAttribute('aria-pressed',String(state[index]===selected));shape.setAttribute('aria-label',`${SLOTS[index].face}${index%9+1} / ${colorAt(state,index)}`);shape.dataset.slot=index;
  const title=svgNode('title');title.textContent=`${SLOTS[index].face}${index%9+1} / ${colorAt(state,index)}`;shape.append(title);shape.addEventListener('click',()=>onSelect(index));shape.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(index);}});svg.append(shape);if(label)svg.append(label);
 };
 if(mode==='net'){
  const layout={U:[1,0],L:[0,1],F:[1,1],R:[2,1],B:[3,1],D:[1,2]},step=23,gap=4,ox=15,oy=28;
  for(const f of FACES){const [gx,gy]=layout[f],x=ox+gx*84,y=oy+gy*83;
   for(let i=0;i<9;i++){const sx=x+i%3*step,sy=y+Math.floor(i/3)*step,index=FACES.indexOf(f)*9+i;
    const t=svgNode('text',{x:sx+10.5,y:sy+14.4,'text-anchor':'middle','font-size':i===4?12:8,'font-family':'ui-monospace,monospace','font-weight':600,fill:'#1a2b36','pointer-events':'none'});t.textContent=i===4?f:labels?String(i+1):'';
    addSticker(svgNode('rect',{x:sx,y:sy,width:21,height:21,rx:3}),index,t);
   }
  }
 }else{
  const point=RING_POINTS[state.indexOf(selected)];
  for(const c of RING_CIRCLES){
   const active=point?.loops.includes(c)||(focus&&BASIS[focus].n[c.axis]===c.layer&&c.layer!==0);
   svg.append(svgNode('circle',{cx:c.x,cy:c.y,r:c.r,fill:'none',stroke:active?'#a5edd5':'#73818b','stroke-width':active?2.8:1.8,opacity:active?1:.6,'class':'ring-track','data-axis':c.axis,'data-layer':c.layer,'data-active':!!active,'pointer-events':'none'}));
  }
  for(const [x,y,label]of [[200,11,'上下三层'],[67,395,'左右三层'],[333,395,'前后三层']]){
   const t=svgNode('text',{x,y,'text-anchor':'middle','font-size':11,fill:'#a4b8c5'});t.textContent=label;svg.append(t);
  }
  RING_POINTS.forEach(({x,y},index)=>{
   const t=svgNode('text',{x,y:y+3.2,'text-anchor':'middle','font-size':index%9===4?10:8.5,'font-family':'ui-monospace,monospace','font-weight':600,fill:'#152633','pointer-events':'none'});
   t.textContent=index%9===4?SLOTS[index].face:labels?String(index%9+1):'';
   addSticker(svgNode('circle',{cx:x,cy:y,r:7.8}),index,t);
  });
 }
 container.replaceChildren(svg);
 if(focused!==undefined)container.querySelector(`[data-slot="${focused}"]`)?.focus({preventScroll:true});
}
