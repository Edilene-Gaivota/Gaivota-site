import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';

// A captura altera somente a saída temporária de compilação da prévia.
// Não envia formulários, não usa sessões e não lê áreas administrativas.
if(process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH!=='previa-fiel-chat') process.exit(0);
const ORIGIN='https://gaivota-regularizacao-obras.contato962298.chatgpt.site';
const report={origin:ORIGIN,capturedAt:new Date().toISOString(),pages:[],files:[],errors:[],externalResources:[],apiCandidates:[]};
const queue=[],seen=new Set(),saved=new Map();
const sha=data=>createHash('sha256').update(data).digest('hex');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const decode=s=>s.replaceAll('&amp;','&');
const safePath=p=>{p=decodeURIComponent(p).replace(/^\/+/, '');if(!p||p.split('/').includes('..')||p.startsWith('.git/'))throw Error('Invalid path');return p};
async function put(path,data){await mkdir(dirname(path),{recursive:true});await writeFile(path,data);saved.set(path,Buffer.from(data));}
async function load(url){
  let error;
  for(let attempt=0;attempt<3;attempt++){
    try{const r=await fetch(url,{headers:{'User-Agent':'Gaivota-owned-site-migration/1.0'},redirect:'follow',signal:AbortSignal.timeout(30000)});
      if(!r.ok)throw Error('HTTP '+r.status);
      if(new URL(r.url).origin!==ORIGIN)throw Error('Unexpected redirect to '+r.url);
      const data=Buffer.from(await r.arrayBuffer());if(data.length>20_000_000)throw Error('Resource too large');
      return {data,type:r.headers.get('content-type')||'',url:r.url};
    }catch(e){error=e;if(attempt<2)await new Promise(r=>setTimeout(r,800));}
  }
  throw error;
}
function enqueue(value,base){
  if(!value||/^(data:|blob:|mailto:|tel:|javascript:|#)/i.test(value))return;
  const u=new URL(decode(value),base);
  if(u.origin!==ORIGIN){report.externalResources.push(u.href);return;}
  if(/\/(?:api|auth|login|logout|avaliacoes)(?:\/|$)/.test(u.pathname))return;
  if(u.pathname.startsWith('/cdn-cgi/'))return;
  queue.push(u.href);
}
function scan(text,base,kind){
  if(kind==='html'){
    for(const m of text.matchAll(/<(?:img|script|source|video|audio|link)\b[^>]*>/gi)){
      const tag=m[0];
      if(/^<link/i.test(tag)&&!/(?:stylesheet|icon|preload|modulepreload)/i.test(tag))continue;
      const v=tag.match(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/is);if(v)enqueue(v[2],base);
      const ss=tag.match(/\bsrcset\s*=\s*(["'])(.*?)\1/is);if(ss)for(const item of ss[2].split(','))enqueue(item.trim().split(/\s+/)[0],base);
    }
  }
  if(kind==='css'||kind==='html')for(const m of text.matchAll(/url\(\s*["']?([^\)"']+)["']?\s*\)/gi))enqueue(m[1].trim(),base);
  for(const m of text.matchAll(/["'`]((?:\/|\.\/)?assets\/[^"'`\s<>]+\.(?:svg|png|jpe?g|webp|gif|ico|css|js)(?:\?[^"'`\s<>]*)?)["'`]/gi))enqueue(m[1],ORIGIN+'/');
  for(const m of text.matchAll(/["'`]((?:\/|https?:\/\/)[^"'`\s]*\/(?:api|_api|__api)\/[^"'`\s]*)["'`]/g))report.apiCandidates.push(m[1]);
  for(const m of text.matchAll(/fetch\s*\(\s*(["'`])([^"'`]+)\1/g))report.apiCandidates.push(m[2]);
}
function localize(html,base){
  html=html.replace(/<base\b[^>]*>/gi,'');
  html=html.replace(/\b(src|href|poster)\s*=\s*(["'])(.*?)\2/gis,(full,attr,q,value)=>{
    if(/^(#|data:|mailto:|tel:|javascript:)/i.test(value))return full;
    try{const u=new URL(decode(value),base);if(u.origin===ORIGIN)return attr+'='+q+u.pathname+u.search+u.hash+q;}catch{}
    return full;
  });
  html=html.replaceAll(ORIGIN,'');
  // Protege a prévia contra envio acidental e indexação; não modifica a aparência.
  html=html.replace(/<head([^>]*)>/i,'<head$1><base href="/"><meta name="robots" content="noindex,nofollow"><script src="/migration-preview.js"></script>');
  return html;
}
for(const [route,path] of [['/','index.html'],['/blog','blog/index.html']]){
  const r=await load(ORIGIN+route);
  if(!r.type.includes('html'))throw Error('HTML not returned for '+route);
  const raw=r.data.toString('utf8');
  scan(raw,r.url,'html');
  await put(path,localize(raw,r.url));
  await put('__migration/source/'+path+'.txt',raw);
  const head=raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1]||'';
  const css=[...raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]);
  const inline=[...raw.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!m[1].includes('src=')).map(m=>m[2]);
  report.pages.push({route,path,bytes:r.data.length,sha256:sha(r.data),headWithoutInline:head.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi,''),inlineStyles:css.map(s=>s.length),inlineScripts:inline.map(s=>s.length)});
  for(let i=0;i<inline.length;i++)await put('__migration/inline-'+(route==='/'?'home':'blog')+'-'+i+'.html','<!doctype html><meta charset="utf-8"><pre>'+esc(inline[i])+'</pre>');
}
while(queue.length&&seen.size<120){
  const url=queue.shift();if(seen.has(url))continue;seen.add(url);
  try{
    const u=new URL(url),path=safePath(u.pathname),r=await load(url);
    if(r.type.includes('text/html'))throw Error('Resource returned HTML');
    await put(path,r.data);
    report.files.push({path,url,bytes:r.data.length,type:r.type,sha256:sha(r.data)});
    if(/\.(?:css|js|mjs)$/.test(path)||/css|javascript/.test(r.type)){
      const text=r.data.toString('utf8');scan(text,url,/css/.test(r.type)||path.endsWith('.css')?'css':'js');
      await put('__migration/code/'+path+'.html','<!doctype html><meta charset="utf-8"><pre>'+esc(text)+'</pre>');
    }
  }catch(e){report.errors.push({url,error:String(e)});}
}
report.externalResources=[...new Set(report.externalResources)];report.apiCandidates=[...new Set(report.apiCandidates)];
const previewScript=`(()=>{'use strict';const nativeFetch=window.fetch.bind(window);window.fetch=(input,options={})=>{const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();if(!['GET','HEAD'].includes(method)){return Promise.resolve(new Response(JSON.stringify({ok:false,success:false,error:'Esta é uma prévia de migração. O armazenamento de avaliações ainda não foi conectado; nada foi enviado ou salvo.'}),{status:503,headers:{'Content-Type':'application/json'}}));}return nativeFetch(input,options);};})();`;
await put('migration-preview.js',previewScript);
await put('_headers','/*\n  X-Robots-Tag: noindex, nofollow\n  X-Gaivota-Environment: faithful-preview\n  Referrer-Policy: strict-origin-when-cross-origin\n');
await put('robots.txt','User-agent: *\nDisallow: /\n');
await put('__migration/report.json',JSON.stringify(report,null,2));
await put('__migration/report.html','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório técnico da captura Gaivota</title><h1>Captura dos arquivos públicos originais</h1><pre>'+esc(JSON.stringify(report,null,2))+'</pre></html>');
console.log(JSON.stringify(report,null,2));
if(!report.files.some(f=>/logo\.png$/.test(f.path)))throw Error('Logotipo original não recuperado; prévia não será publicada');
if(report.errors.length)console.warn('Existem recursos pendentes no relatório');
