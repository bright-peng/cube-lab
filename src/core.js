/** Integer-coordinate cube model. State[position] = original sticker identity.
 * URFDLB face order, row-major viewed from outside each face. */
export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const COLORS = { U:'#f5cc42', R:'#ef6663', F:'#50cbb0', D:'#edf0f6', L:'#f5a05a', B:'#729bed' };
export const BASIS = {
 U:{n:[0,1,0],r:[1,0,0],up:[0,0,-1]}, R:{n:[1,0,0],r:[0,0,-1],up:[0,1,0]},
 F:{n:[0,0,1],r:[1,0,0],up:[0,1,0]}, D:{n:[0,-1,0],r:[1,0,0],up:[0,0,1]},
 L:{n:[-1,0,0],r:[0,0,1],up:[0,1,0]}, B:{n:[0,0,-1],r:[-1,0,0],up:[0,1,0]}
};
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const scale=(a,s)=>a.map(v=>v*s);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function rotate(v,axis,angle) { const c=Math.cos(angle),s=Math.sin(angle);return add(add(scale(v,c),scale(cross(axis,v),s)),scale(axis,dot(axis,v)*(1-c))); }
export const SLOTS = FACES.flatMap((face,fi)=>Array.from({length:9},(_,i)=>{
 const b=BASIS[face]; const row=Math.floor(i/3),col=i%3;
 return {index:fi*9+i,face,row,col,n:b.n,p:add(add(b.n,scale(b.r,col-1)),scale(b.up,1-row))};
}));
const slotKey=(p,n)=>p.join(',')+'|'+n.join(',');
const slotLookup=new Map(SLOTS.map(s=>[slotKey(s.p,s.n),s.index]));
export const SOLVED = Uint8Array.from({length:54},(_,i)=>i);
export const MOVE_TOKENS=FACES.flatMap(f=>[f,f+'2',f+"'"]);
export const PERMS={}; // Forward permutation: source position -> destination.
for(const face of FACES){
 const n=BASIS[face].n;
 const quarter=Uint8Array.from(SLOTS,s=>{
  if(dot(s.p,n)!==1)return s.index;
  const p=rotate(s.p,n,-Math.PI/2).map(Math.round),nn=rotate(s.n,n,-Math.PI/2).map(Math.round);
  return slotLookup.get(slotKey(p,nn));
 });
 for(const [suffix,times] of [['',1],['2',2],["'",3]]){
  PERMS[face+suffix]=Uint8Array.from(SLOTS,s=>{let j=s.index;for(let t=0;t<times;t++)j=quarter[j];return j;});
 }
}
export function parseAlgorithm(input) {
 if(typeof input!=='string')throw new Error('Algorithm must be text.');
 const text=input.replace(/[\u2018\u2019\u2032]/g,"'").trim();
 if(!text)return [];
 const out=[];let index=0;
 while(index<text.length){
  const rest=text.slice(index);const space=rest.match(/^[\s,]+/);if(space){index+=space[0].length;continue;}
  const m=rest.match(/^[URFDLB](?:2'?|')?/i);
  if(!m)throw new Error(`Invalid notation near "${rest.slice(0,14)}". Use U R F D L B, apostrophe, or 2.`);
  out.push(m[0].toUpperCase().replace("2'",'2'));index+=m[0].length;
  if(out.length>500)throw new Error('Maximum 500 moves per algorithm.');
 }
 return out;
}
export function inverseMove(m){return m.endsWith('2')?m:m.endsWith("'")?m[0]:m+"'";}
export function inverseAlgorithm(alg){return (Array.isArray(alg)?alg:parseAlgorithm(alg)).slice().reverse().map(inverseMove);}
export function applyPermutation(state,perm){const out=new Uint8Array(54);for(let i=0;i<54;i++)out[perm[i]]=state[i];return out;}
export function applyMove(state,m){if(!PERMS[m])throw new Error('Invalid move '+m);return applyPermutation(state,PERMS[m]);}
export function applyAlgorithm(state,alg){let s=new Uint8Array(state);for(const m of (Array.isArray(alg)?alg:parseAlgorithm(alg)))s=applyMove(s,m);return s;}
export function algorithmPermutation(alg){let p=Uint8Array.from(SOLVED);for(const m of parseAlgorithm(alg)){const q=PERMS[m];p=p.map(v=>q[v]);}return p;}
export const isSolved=s=>s.every((v,i)=>v===i);
export const colorAt=(s,i)=>FACES[Math.floor(s[i]/9)];
export const facelets=s=>Array.from(s,v=>FACES[Math.floor(v/9)]).join('');
export const positions=s=>{const p=new Uint8Array(54);s.forEach((v,i)=>p[v]=i);return p;};
export const EDGE_SLOTS=SLOTS.filter(s=>s.p.filter(x=>x!==0).length===2).map(s=>s.index);
export const CORNER_SLOTS=SLOTS.filter(s=>s.p.every(x=>x!==0)).map(s=>s.index);
export const DOWN_EDGES=[28,30,32,34],DOWN_CORNERS=[27,29,33,35];
export const MID_EDGES=[21,23,48,50],UP_EDGES=[1,3,5,7],UP_CORNERS=[0,2,6,8];
export function stageFlags(state){
 const pos=positions(state),fixed=ids=>ids.every(i=>pos[i]===i);
 const crossOK=fixed(DOWN_EDGES),bottomOK=crossOK&&fixed(DOWN_CORNERS),f2l=bottomOK&&fixed(MID_EDGES);
 const topCross=f2l&&UP_EDGES.every(i=>SLOTS[pos[i]].face==='U');
 const topFace=topCross&&UP_CORNERS.every(i=>SLOTS[pos[i]].face==='U');
 const corners=topFace&&fixed(UP_CORNERS);
 return [crossOK,bottomOK,f2l,topCross,topFace,corners,isSolved(state)];
}
/** Training random-move scramble, NOT a WCA uniform random-state scramble. */
export function scramble(length=22,random=Math.random){
 const axes={U:0,D:0,R:1,L:1,F:2,B:2},out=[];let prev='';
 for(let i=0;i<length;i++){let f;do{f=FACES[Math.floor(random()*6)];}while(f===prev || (i>1&&axes[f]===axes[prev]&&axes[prev]===axes[out[i-2][0]]));out.push(f+['',"'",'2'][Math.floor(random()*3)]);prev=f;}
 return out;
}
// Legality check also protects storage/import from malformed sticker arrays.
const groups=new Map();for(const s of SLOTS){const k=s.p.join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s.index);}
const parity=a=>{let p=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)p^=+(a[i]>a[j]);return p;};
// Standard URF,UFL,ULB,UBR,DFR,DLF,DBL,DRB and UR,UF,UL,UB,DR,DF,DL,DB,FR,FL,BL,BR.
const CF=[[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]];
const EF=[[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]];
export function validateState(input){
 if(!input||input.length!==54)throw new Error('State must contain 54 stickers.');
 const a=Array.from(input);if(a.some(x=>!Number.isInteger(x)||x<0||x>53)||new Set(a).size!==54)throw new Error('Sticker identities are invalid.');
 const s=Uint8Array.from(a);for(const f of FACES){const c=FACES.indexOf(f)*9+4;if(s[c]!==c)throw new Error('Centers must stay fixed.');}
 for(const ids of groups.values()){
  const origins=ids.map(i=>SLOTS[s[i]].p.join(','));if(origins.some(p=>p!==origins[0]))throw new Error('A cubie has been split.');
 }
 const cp=[],co=[],ep=[],eo=[];
 for(const ids of CF){let ori=ids.findIndex(i=>['U','D'].includes(colorAt(s,i)));if(ori<0)throw new Error('Invalid corner.');
  const colors=ids.map(i=>colorAt(s,i)), c=CF.findIndex(home=>home.every((j,k)=>colorAt(SOLVED,j)===colors[(k+ori)%3]));
  if(c<0)throw new Error('Mirrored corner.');cp.push(c);co.push(ori);
 }
 for(const ids of EF){const colors=ids.map(i=>colorAt(s,i));let found=false;
  for(let j=0;j<EF.length&&!found;j++)for(let o=0;o<2;o++)if(EF[j].every((k,t)=>colorAt(SOLVED,k)===colors[(t+o)%2])){ep.push(j);eo.push(o);found=true;break;}
  if(!found)throw new Error('Invalid edge.');
 }
 if(new Set(cp).size!==8||new Set(ep).size!==12||co.reduce((a,b)=>a+b,0)%3||eo.reduce((a,b)=>a+b,0)%2||parity(cp)!==parity(ep))throw new Error('Physically impossible cube state.');
 return s;
}
