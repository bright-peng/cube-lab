/** Tiny deterministic bundler for this fixed, dependency-free module graph.
 * Generates one self-contained HTML file, including a Blob worker. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const read=path=>readFile(path,'utf8');
const strip=code=>code.replace(/^import[^\n]*\n/gm,'').replace(/^export\s+/gm,'');
await mkdir('dist',{recursive:true});
const core=strip(await read('src/core.js')),solver=strip(await read('src/solver.js'));
const worker='(()=>{\n'+core+'\n'+solver+'\n'+strip(await read('src/solver-worker.js'))+'\n})();';
// Preserve the imported alias which the flat bundle no longer introduces.
const app=strip(await read('src/app.js')).replaceAll('solveCube(','solve(').replaceAll("new URL('./solver-worker.js',import.meta.url)","new URL('src/solver-worker.js',location.href)");
const bundle='(()=>{\n\"use strict\";\nglobalThis.__CUBE_SOLVER_WORKER_SOURCE__='+JSON.stringify(worker)+';\n'+core+'\n'+solver+'\n'+strip(await read('src/renderer.js'))+'\n'+strip(await read('src/lessons.js'))+'\n'+app+'\n})();';
let html=await read('index.html');html=html.replace('<link rel="stylesheet" href="src/style.css">','<style>\n'+await read('src/style.css')+'\n</style>');
html=html.replace('<script type="module" src="src/app.js"></script>','<script>\n'+bundle.replace(/<\/script/gi,'<\\/script')+'\n</script>');
await writeFile('dist/index.html',html);
console.log(`Built dist/index.html (${(Buffer.byteLength(html)/1024).toFixed(1)} KB), no runtime network requests.`);
