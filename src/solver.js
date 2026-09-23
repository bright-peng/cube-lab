/** Seven-stage solver. Macro search uses state, never scramble/history.
 * Exact reverse-BFS pattern tables for cross, corners, and middle edges.
 * Small quotient-graph searches for the four last-layer stages.
 * Every result is replayed and verified before it is returned. */
import {SOLVED,SLOTS,FACES,PERMS,MOVE_TOKENS,EDGE_SLOTS,CORNER_SLOTS,DOWN_EDGES,DOWN_CORNERS,MID_EDGES,UP_EDGES,UP_CORNERS,applyPermutation,applyAlgorithm,algorithmPermutation,parseAlgorithm,inverseAlgorithm,positions,stageFlags,isSolved,validateState} from './core.js';
export const ALGORITHMS={trigger:"R U R' U'",left:"L' U' L U",middleRight:"U R U' R' U' F' U F",middleLeft:"U' L' U L U F U' F'",yellowCross:"F R U R' U' F'",sune:"R U R' U R U2 R'",tperm:"R U R' U' R' F R2 U' R' U' R U R' F'",ua:"R U' R U R U R U' R' U' R2"};
export const STAGE_NAMES=['White cross','First-layer corners','Middle-layer edges','Yellow cross','Yellow face','Top corner positions','Top edge positions'];
const macro=(alg,name)=>({alg,moves:parseAlgorithm(alg),perm:algorithmPermutation(alg),name});
function rotations(alg,name,inverse=true){
 const ring=['F','R','B','L'],out=[];
 for(let r=0;r<4;r++){
  const a=parseAlgorithm(alg).map(m=>{const i=ring.indexOf(m[0]);return (i<0?m[0]:ring[(i+r)%4])+m.slice(1);}).join(' ');
  out.push(macro(a,name+(r?' @'+ring[r]:'')));
  if(inverse)out.push(macro(inverseAlgorithm(a).join(' '),name+' inverse'+(r?' @'+ring[r]:'')));
 }
 return out;
}
const UMAC=['U',"U'",'U2'].map(x=>macro(x,'Align top'));
export const MACROS=[
 MOVE_TOKENS.map(x=>macro(x,'Build cross')),
 [...UMAC,...rotations(ALGORITHMS.trigger,'Right trigger')],
 [...UMAC,...rotations(ALGORITHMS.middleRight,'Right insertion'),...rotations(ALGORITHMS.middleLeft,'Left insertion')],
 [...UMAC,...rotations(ALGORITHMS.yellowCross,'Yellow cross')],
 [...UMAC,...rotations(ALGORITHMS.sune,'Sune')],
 [...UMAC,...rotations(ALGORITHMS.tperm,'T permutation')],
 [...rotations(ALGORITHMS.ua,'U permutation')]
];
const caches=new Map();
function buildTable(targets,slots,macros){
 const n=slots.length,size=n**4,encode=a=>((a[0]*n+a[1])*n+a[2])*n+a[3];
 const local=new Int16Array(54).fill(-1);slots.forEach((v,i)=>local[v]=i);
 const transitions=macros.map(m=>Uint8Array.from(slots,x=>{const k=local[m.perm[x]];if(k<0)throw new Error('Pattern transition outside domain.');return k;}));
 const dist=new Int8Array(size).fill(-1),queue=new Int32Array(size),solved=encode(targets.map(x=>local[x]));let head=0,tail=1;queue[0]=solved;dist[solved]=0;
 while(head<tail){const k=queue[head++];let q=k;const d=q%n;q=Math.floor(q/n);const c=q%n;q=Math.floor(q/n);const b=q%n;const a=Math.floor(q/n);
  for(const t of transitions){const next=((t[a]*n+t[b])*n+t[c])*n+t[d];if(dist[next]<0){dist[next]=dist[k]+1;queue[tail++]=next;}}
 }
 return {dist,transitions,encode,local,n,count:tail,maxDepth:dist.reduce((a,b)=>Math.max(a,b),0)};
}
export function initialize(onProgress=()=>{}){
 for(let stage=0;stage<3;stage++)if(!caches.has(stage)){
  onProgress({stage,text:'Preparing pattern table '+(stage+1)+'/3'});
  const targets=[DOWN_EDGES,DOWN_CORNERS,MID_EDGES][stage],slots=stage===1?CORNER_SLOTS:EDGE_SLOTS;
  caches.set(stage,buildTable(targets,slots,MACROS[stage]));
 }
 return Array.from(caches,([stage,t])=>({stage,count:t.count,maxDepth:t.maxDepth}));
}
function patternPlan(state,stage){
 const table=caches.get(stage),targets=[DOWN_EDGES,DOWN_CORNERS,MID_EDGES][stage],pos=positions(state);
 let a=targets.map(id=>table.local[pos[id]]);const result=[];
 let k=table.encode(a),distance=table.dist[k];if(distance<0)throw new Error('State is outside this stage domain.');
 while(distance>0){let found=false;
  for(let i=0;i<MACROS[stage].length;i++){const next=a.map(x=>table.transitions[i][x]),nk=table.encode(next);if(table.dist[nk]===distance-1){result.push(MACROS[stage][i]);a=next;k=nk;distance--;found=true;break;}}
  if(!found)throw new Error('Pattern path could not be reconstructed.');
 }
 return result;
}
function lastLayerPlan(state,stage){
 const targets=(stage===3||stage===6)?UP_EDGES:UP_CORNERS;
 const key=s=>{const p=positions(s);return targets.map(i=>p[i]).join(',');};
 const goal=s=>{const p=positions(s);return targets.every(i=>stage<5?SLOTS[p[i]].face==='U':p[i]===i);};
 if(goal(state))return [];
 const queue=[{s:state,parent:-1,mi:-1}],seen=new Set([key(state)]);let h=0,found=-1;
 outer:while(h<queue.length){const node=queue[h];for(let i=0;i<MACROS[stage].length;i++){
   const s=applyPermutation(node.s,MACROS[stage][i].perm),k=key(s);if(seen.has(k))continue;seen.add(k);queue.push({s,parent:h,mi:i});
   if(goal(s)){found=queue.length-1;break outer;}
   if(queue.length>3000)throw new Error('Last-layer search exceeded its safety limit.');
  }h++;
 }
 if(found<0)throw new Error('No formula path found.');
 const result=[];for(let i=found;queue[i].parent>=0;i=queue[i].parent)result.push(MACROS[stage][queue[i].mi]);return result.reverse();
}
export function solve(input,onProgress=()=>{}){
 let state=validateState(input);initialize(onProgress);
 const stages=[],steps=[];
 for(let stage=0;stage<7;stage++){
  onProgress({stage,text:'Solving stage '+(stage+1)+'/7'});
  const plan=stage<3?patternPlan(state,stage):lastLayerPlan(state,stage),groups=[],start=steps.length;
  for(const m of plan){const group={name:m.name,algorithm:m.alg,start:steps.length,end:steps.length+m.moves.length,stage};groups.push(group);
   for(const move of m.moves)steps.push({move,stage,group:groups.length-1,formula:m.alg,name:m.name});
   state=applyPermutation(state,m.perm);
  }
  if(!stageFlags(state)[stage])throw new Error('Stage '+(stage+1)+' did not meet its postcondition.');
  stages.push({index:stage,name:STAGE_NAMES[stage],start,end:steps.length,groups});
 }
 if(!isSolved(state)||!isSolved(applyAlgorithm(input,steps.map(s=>s.move))))throw new Error('Solution verification failed.');
 return {stages,steps,algorithm:steps.map(s=>s.move).join(' '),verified:true,method:'layer-by-layer-macro-search'};
}
