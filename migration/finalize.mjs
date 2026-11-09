import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const ORIGIN='https://gaivota-regularizacao-obras.contato962298.chatgpt.site';
if(process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME!=='previa-fiel-chat')throw Error('Apenas a branch de previa pode ser modificada');
const report=JSON.parse(await readFile('__migration/report.json','utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
async function publicJSON(route,file,fallback){
  try{
    const r=await fetch(ORIGIN+route,{redirect:'manual',signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw Error('HTTP '+r.status);
    if(!(r.headers.get('content-type')||'').includes('json'))throw Error('Resposta não JSON');
    const value=await r.json(),text=JSON.stringify(value,null,2);
    await writeFile(file,text);
    return {route,file,ok:true,sha256:sha(text),items:Array.isArray(value.items)?value.items.length:null};
  }catch(e){await writeFile(file,JSON.stringify(fallback,null,2));return {route,file,ok:false,error:String(e)};}
}
await mkdir('data',{recursive:true});
const data=[];
data.push(await publicJSON('/api/journal','data/journal.json',{items:[]}));
data.push(await publicJSON('/api/news','data/news.json',{items:[],checkedAt:null}));
data.push(await publicJSON('/api/feedback','data/feedback.json',{items:[]}));
data.push(await publicJSON('/gallery.json','gallery.json',{photos:[]}));
for(const [route,path] of [['/','index.html'],['/blog','blog/index.html']]){
  let html=await readFile('__migration/source/'+path+'.txt','utf8');
  // Remove somente o desafio de transporte injetado pela hospedagem anterior.
  html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(all,attributes,body)=>!attributes.includes('src=')&&/\b__CF\$cv\$params|challenge-platform/.test(body)?'':all);
  html=html.replace(/<base\b[^>]*>/gi,'');
  html=html.replace(/\b(src|href|poster)\s*=\s*(["'])(.*?)\2/gis,(all,key,quote,value)=>{
    if(/^(#|data:|mailto:|tel:|javascript:)/i.test(value))return all;
    try{const u=new URL(value.replaceAll('&amp;','&'),ORIGIN+route);if(u.origin===ORIGIN)return key+'='+quote+u.pathname+u.search+u.hash+quote;}catch{}
    return all;
  });
  html=html.replaceAll(ORIGIN,'');
  html=html.replace(/<head([^>]*)>/i,'<head$1><base href="'+(route==='/'?'/':'/blog/')+'"><meta name="robots" content="noindex,nofollow"><script src="/migration-preview.js"></script>');
  html=html.replace('Sua avaliação será salva aqui no site após a confirmação.','Prévia de migração: o armazenamento de avaliações ainda não está conectado.');
  await writeFile(path,html);
}
// Mantém todas as imagens referenciadas pela galeria pública, quando houver.
const gallery=JSON.parse(await readFile('gallery.json','utf8'));
for(const photo of Array.isArray(gallery.photos)?gallery.photos:[]){
  if(typeof photo.src!=='string'||!/^\/?assets\/[A-Za-z0-9_./-]+$/.test(photo.src)||photo.src.includes('..'))continue;
  const path=photo.src.replace(/^\//,'');
  try{await readFile(path);}catch{const r=await fetch(ORIGIN+'/'+path);if(!r.ok)throw Error('Galeria: HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,b);}
}
const unique=[...new Map(report.files.map(x=>[x.path,x])).values()];
const verified=[];
for(const entry of unique){const b=await readFile(entry.path);if(sha(b)!==entry.sha256)throw Error('Arquivo diferente do original: '+entry.path);verified.push({path:entry.path,bytes:b.length,sha256:entry.sha256});}
const migration={capturedAt:report.capturedAt,finalizedAt:new Date().toISOString(),source:ORIGIN,branch:'previa-fiel-chat',productionModified:false,verifiedOriginalFiles:verified,publicData:data,modifications:['Caminhos locais para a nova hospedagem','Remoção do desafio temporário de transporte da hospedagem anterior','Bloqueio de gravações na prévia','Aviso de prévia no formulário','Noindex na prévia'],pending:['Armazenamento e moderação autenticada de avaliações','Editor privado do blog','Rotina independente de atualização das notícias'],newsMode:'snapshot — não há atualização automática de notícias'};
await writeFile('migration/verification.json',JSON.stringify(migration,null,2));
await mkdir('functions/api',{recursive:true});
await writeFile('functions/api/[[path]].js',`export async function onRequest({request,env}) {
 const path=new URL(request.url).pathname,headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Gaivota-Data-Mode':'migration-snapshot'};
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({ok:false,error:'Prévia: armazenamento de avaliações ainda não configurado. Nada foi enviado ou salvo.'}),{status:503,headers});
 if(path==='/api/feedback/session')return new Response(JSON.stringify({owner:false}),{headers});
 const routes={'/api/journal':'/data/journal.json','/api/news':'/data/news.json','/api/feedback':'/data/feedback.json'};
 if(!routes[path])return new Response(JSON.stringify({error:'Área ainda não migrada'}),{status:404,headers});
 const r=await env.ASSETS.fetch(new Request(new URL(routes[path],request.url),{method:'GET'}));
 if(!r.ok||!(r.headers.get('Content-Type')||'').includes('json'))return new Response(JSON.stringify({error:'Cópia pública indisponível'}),{status:503,headers});
 return new Response(request.method==='HEAD'?null:await r.text(),{headers});
}
`);
await writeFile('_redirects','/noticias /blog/ 302\n/avaliacoes /migracao.html 302\n/blog/escrever /migracao.html 302\n');
await writeFile('migracao.html','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Prévia de migração Gaivota</title><link rel="stylesheet" href="/style.css"><main style="max-width:760px;margin:12vh auto;padding:24px"><h1>Prévia de migração</h1><p>A interface original foi preservada. A administração de avaliações e o editor privado ainda não foram conectados à hospedagem independente.</p><p>Nenhuma avaliação é salva nesta prévia. As notícias exibidas são uma cópia datada da publicação original, não um serviço de atualização automática.</p><a href="/">Voltar ao site</a></main></html>');
await writeFile('README.md','# Gaivota — prévia fiel do site original\n\nEsta branch preserva os arquivos públicos reais do site original. Não é um redesenho. A branch main e a publicação de produção não foram modificadas.\n\n## Publicação\nOs arquivos já estão recuperados neste repositório: não é necessário acessar o site original para servir esta cópia. Não há compilação obrigatória.\n\n## Verificação\nConsulte migration/verification.json: hashes SHA-256 dos estilos, scripts e imagens originais; cópia datada dos dados públicos.\n\n## Limitações\nAvaliações não são gravadas nesta prévia. Editor do blog e administração autenticada pendentes. Notícias usam fotografia datada dos dados públicos e não se atualizam automaticamente. Áreas privadas e dados não públicos não foram copiados.\n\n## Manutenção\nModifique os arquivos desta branch para testar; somente depois da validação visual a cópia deve ser integrada à main. A captura automática não roda em instalações. Os utilitários de migration são ferramentas explícitas para recuperar uma versão do original, não dependências do site em execução.\n');
const pkg=JSON.parse(await readFile('package.json','utf8'));pkg.scripts={build:'node -e "console.log(\'Site estático: arquivos originais já recuperados\')"'};await writeFile('package.json',JSON.stringify(pkg,null,2));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));delete lock.packages[''].hasInstallScript;await writeFile('package-lock.json',JSON.stringify(lock,null,2));
await rm('functions/__migration',{recursive:true,force:true});
// ZIP da cópia efetivamente armazenada, sem ferramentas de captura nem arquivos privados.
const zipResult=spawnSync('python3',['-c',`import pathlib,zipfile\nroot=pathlib.Path('.')\nwith zipfile.ZipFile('Gaivota-Previa-Original.zip','w',zipfile.ZIP_DEFLATED) as z:\n for p in root.rglob('*'):\n  if not p.is_file(): continue\n  rel=p.as_posix()\n  if rel.startswith(('.git/','.github/','__migration/','migration/','node_modules/')): continue\n  if p.suffix=='.zip': continue\n  if rel in ('package.json','package-lock.json'): continue\n  z.write(p,rel)\n z.write('migration/verification.json','VERIFICACAO.json')\n`],{encoding:'utf8'});
if(zipResult.status!==0)throw Error(zipResult.stderr);
console.log(JSON.stringify({verifiedFiles:verified.length,publicData:data,zipCreated:true,productionModified:false},null,2));
