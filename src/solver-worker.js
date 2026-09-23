import {solve} from './solver.js';
self.onmessage=event=>{const {id,state}=event.data;try{const result=solve(state,p=>self.postMessage({id,type:'progress',...p}));self.postMessage({id,type:'result',result});}catch(error){self.postMessage({id,type:'error',message:error.message});}};
