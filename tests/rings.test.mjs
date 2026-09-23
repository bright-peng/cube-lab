import test from 'node:test';
import assert from 'node:assert/strict';
import {SLOTS,PERMS} from '../src/core.js';
import {RING_CIRCLES,RING_POINTS} from '../src/renderer.js';

test('Ring intersections preserve sticker identity and slice turn order',()=>{
 assert.equal(RING_CIRCLES.length,9);
 assert.equal(RING_POINTS.length,54);
 for(const [i,p]of RING_POINTS.entries()){
  const onCircle=RING_CIRCLES.filter(c=>Math.abs(Math.hypot(p.x-c.x,p.y-c.y)-c.r)<1e-8);
  assert.deepEqual(onCircle,p.loops);
  assert.equal(onCircle.length,2);
  for(const c of onCircle){assert.equal(SLOTS[i].n[c.axis],0);assert.equal(SLOTS[i].p[c.axis],c.layer);}
  for(const q of RING_POINTS.slice(i+1))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>18,'Dots must not overlap');
 }
 for(const c of RING_CIRCLES){
  const ids=RING_POINTS.map((p,i)=>({...p,index:i})).filter(p=>p.loops.includes(c)).sort((p,q)=>Math.atan2(p.y-c.y,p.x-c.x)-Math.atan2(q.y-c.y,q.x-c.x)).map(p=>p.index);
  assert.equal(ids.length,12);
  if(!c.layer)continue;
  const face=SLOTS.find(s=>s.n[c.axis]===c.layer).face;
  for(const [suffix,shift]of [['',c.layer===1?9:3],["'",c.layer===1?3:9],['2',6]]){
   ids.forEach((id,i)=>assert.equal(PERMS[face+suffix][id],ids[(i+shift)%12],`${face+suffix}: loop follows the real cube turn`));
  }
 }
});
