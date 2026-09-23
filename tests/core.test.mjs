import test from 'node:test';import assert from 'node:assert/strict';
import {SOLVED,FACES,MOVE_TOKENS,applyMove,applyAlgorithm,inverseAlgorithm,inverseMove,isSolved,parseAlgorithm,validateState,scramble,facelets,stageFlags} from '../src/core.js';
import {solve,initialize,MACROS} from '../src/solver.js';
for(const f of FACES)test(`${f}: four turns are identity`,()=>assert.deepEqual(applyAlgorithm(SOLVED,[f,f,f,f]),SOLVED));
for(const m of MOVE_TOKENS)test(`${m}: inverse and legality`,()=>{const s=applyMove(SOLVED,m);assert.deepEqual(validateState(s),s);assert.deepEqual(applyMove(s,inverseMove(m)),SOLVED);});
test('Parser supports compact notation, rejects unsupported tokens',()=>{assert.deepEqual(parseAlgorithm("RUR'U' F2"),['R','U',"R'","U'",'F2']);assert.throws(()=>parseAlgorithm('R x'));assert.throws(()=>parseAlgorithm('R3'));assert.throws(()=>parseAlgorithm('<script>'));});
test('Known right trigger has order 6',()=>assert.ok(isSolved(applyAlgorithm(SOLVED,Array(6).fill("R U R' U'").join(' ')))));
test('F turns U bottom row to R left column',()=>{const s=facelets(applyMove(SOLVED,'F'));assert.equal(s[9]+s[12]+s[15],'UUU');});
test('Reject illegal flip, twist, parity and non-permutation',()=>{
 const flip=SOLVED.slice();[flip[5],flip[10]]=[flip[10],flip[5]];assert.throws(()=>validateState(flip));
 const twist=SOLVED.slice();[twist[8],twist[9],twist[20]]=[twist[9],twist[20],twist[8]];assert.throws(()=>validateState(twist));
 const swap=SOLVED.slice();[swap[5],swap[7]]=[swap[7],swap[5]];[swap[10],swap[19]]=[swap[19],swap[10]];assert.throws(()=>validateState(swap));assert.throws(()=>validateState(Array(54).fill(0)));
});
test('Complete pattern table cardinalities',()=>{assert.deepEqual(initialize().map(t=>t.count),[190080,136080,26880]);});
let seed=73021;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
test('Solve 200 independent random-move states with all postconditions',()=>{
 let total=0,max=0;for(let i=0;i<200;i++){
  const alg=scramble(15+i%36,random),state=applyAlgorithm(SOLVED,alg);validateState(state);
  const result=solve(state);assert.ok(result.verified);assert.ok(isSolved(applyAlgorithm(state,result.algorithm)));total+=result.steps.length;max=Math.max(max,result.steps.length);
 }
 console.log(JSON.stringify({randomStatesTested:200,averageMoves:total/200,maxMoves:max}));
});
test('Solved state returns no moves',()=>assert.equal(solve(SOLVED).steps.length,0));

for(let stage=1;stage<7;stage++)test(`Stage ${stage+1} macros preserve the previous stage`,()=>{for(const m of MACROS[stage])assert.ok(stageFlags(applyAlgorithm(SOLVED,m.alg))[stage-1],m.name);});
