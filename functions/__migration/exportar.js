const ORIGIN='https://gaivota-regularizacao-obras.contato962298.chatgpt.site';
const enc=new TextEncoder();
const escapeHTML=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const sha=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
function bytes(s){return typeof s==='string'?enc.encode(s):s;}
function combine(list){const out=new Uint8Array(list.reduce((n,x)=>n+x.length,0));let p=0;for(const x of list){out.set(x,p);p+=x.length;}return out;}
async function zip(files){
  const local=[],central=[];let offset=0;
  for(const [path,input] of files){
    const data=bytes(input),name=enc.encode(path);
    const gzip=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    if(gzip[3]!==0)throw Error('Unsupported gzip header');
    const compressed=gzip.slice(10,-8),crc=new DataView(gzip.buffer,gzip.byteOffset+gzip.length-8,8).getUint32(0,true);
    const a=new Uint8Array(30),av=new DataView(a.buffer);
    av.setUint32(0,0x04034b50,true);av.setUint16(4,20,true);av.setUint16(6,0x800,true);av.setUint16(8,8,true);av.setUint16(12,33,true);av.setUint32(14,crc,true);av.setUint32(18,compressed.length,true);av.setUint32(22,data.length,true);av.setUint16(26,name.length,true);
    const c=new Uint8Array(46),cv=new DataView(c.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(10,8,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,compressed.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);
    local.push(a,name,compressed);central.push(c,name);offset+=a.length+name.length+compressed.length;
  }
  const size=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);
  dv.setUint32(0,0x06054b50,true);dv.setUint16(8,files.size,true);dv.setUint16(10,files.size,true);dv.setUint32(12,size,true);dv.setUint32(16,offset,true);
  return combine([...local,...central,end]);
}
export async function onRequestGet({request}){
  const files=new Map(),queue=[],seen=new Set(),report={origin:ORIGIN,capturedAt:new Date().toISOString(),pages:[],resources:[],errors:[],external:[],fetchReferences:[]};
  function enqueue(value,base){
    if(!value||/^(data:|blob:|#|mailto:|tel:|javascript:)/i.test(value))return;
    const u=new URL(value.replaceAll('&amp;','&'),base);
    if(u.origin!==ORIGIN){report.external.push(u.href);return;}
    if(/\/(?:api|auth|login|avaliacoes)(?:\/|$)/.test(u.pathname)||u.pathname.startsWith('/cdn-cgi/'))return;
    if(!/\.(?:css|js|mjs|svg|png|jpe?g|webp|gif|ico|avif)$/i.test(u.pathname))return;
    if(!seen.has(u.href))queue.push(u.href);
  }
  function scan(text,base){
    for(const tag of text.matchAll(/<(?:img|script|source|link)\b[^>]*>/gi)){
      const m=tag[0].match(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/is);if(m)enqueue(m[2],base);
    }
    for(const m of text.matchAll(/url\(\s*["']?([^\)"']+)/gi))enqueue(m[1].trim(),base);
    for(const m of text.matchAll(/["'`]((?:\/|\.\/)?assets\/[^"'`\s<>]+\.(?:svg|png|jpe?g|webp|gif|ico|css|js)(?:\?[^"'`\s<>]*)?)["'`]/gi))enqueue(m[1],ORIGIN+'/');
    for(const m of text.matchAll(/fetch\s*\([^\n;]{0,240}/g))report.fetchReferences.push(m[0]);
  }
  async function retrieve(url){
    const r=await fetch(url,{redirect:'manual',headers:{'Accept':'*/*'}});
    if(!r.ok)throw Error('HTTP '+r.status);
    const data=new Uint8Array(await r.arrayBuffer());
    if(data.length>15_000_000)throw Error('File too large');
    return {data,type:r.headers.get('content-type')||''};
  }
  try{
    for(const [route,path] of [['/','index.html'],['/blog','blog/index.html']]){
      const r=await retrieve(ORIGIN+route);if(!r.type.includes('html'))throw Error('Expected HTML');
      const source=new TextDecoder().decode(r.data);scan(source,ORIGIN+route);
      let html=source.replace(/<base\b[^>]*>/gi,'').replaceAll(ORIGIN,'');
      html=html.replace(/<head([^>]*)>/i,'<head$1><base href="/"><meta name="robots" content="noindex,nofollow"><script src="/migration-preview.js"></script>');
      files.set(path,enc.encode(html));report.pages.push({route,path,bytes:r.data.length,sourceSha256:await sha(r.data)});
    }
    while(queue.length&&seen.size<40){
      const batch=[];
      while(queue.length&&batch.length<4&&seen.size<40){const url=queue.shift();if(seen.has(url))continue;seen.add(url);batch.push(url);}
      await Promise.all(batch.map(async url=>{
        try{
          const path=decodeURIComponent(new URL(url).pathname).replace(/^\//,'');if(path.split('/').includes('..'))throw Error('Invalid path');
          const r=await retrieve(url);if(r.type.includes('text/html'))throw Error('Asset returned HTML');
          files.set(path,r.data);report.resources.push({path,url,type:r.type,bytes:r.data.length,sha256:await sha(r.data)});
          if(/\.(?:css|js|mjs)$/i.test(path))scan(new TextDecoder().decode(r.data),url);
        }catch(e){report.errors.push({url,error:String(e)});}
      }));
    }
    report.external=[...new Set(report.external)];report.fetchReferences=[...new Set(report.fetchReferences)];
    report.totalBytes=[...files.values()].reduce((n,x)=>n+x.length,0);
    report.completeStaticResources=report.errors.length===0&&!queue.length;
    if(new URL(request.url).searchParams.get('format')==='manifest')return new Response('<!doctype html><meta charset="utf-8"><title>Arquivos originais recuperados</title><pre>'+escapeHTML(JSON.stringify(report,null,2))+'</pre>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
    if(!report.completeStaticResources)throw Error('Captura incompleta: consulte ?format=manifest');
    files.set('migration-preview.js',enc.encode("(()=>{const f=window.fetch.bind(window);window.fetch=(i,o={})=>{const m=String(o.method||(i instanceof Request?i.method:'GET')).toUpperCase();if(!['GET','HEAD'].includes(m))return Promise.resolve(new Response(JSON.stringify({ok:false,success:false,error:'Prévia: armazenamento de avaliações ainda não configurado. Nada foi enviado ou salvo.'}),{status:503,headers:{'Content-Type':'application/json'}}));return f(i,o);};})();"));
    files.set('_headers',enc.encode('/*\n  X-Robots-Tag: noindex, nofollow\n'));
    files.set('robots.txt',enc.encode('User-agent: *\nDisallow: /\n'));
    files.set('_redirects',enc.encode('/noticias /blog/ 302\n'));
    files.set('MANIFESTO-ORIGINAL.json',enc.encode(JSON.stringify(report,null,2)));
    files.set('LEIA-ME-MIGRACAO.md',enc.encode('# Gaivota — cópia da interface original\n\nArquivos HTML, CSS, JavaScript e imagens recuperados diretamente do site original, sem redesenhar os componentes. O manifesto registra fontes e hashes.\n\nEsta é uma prévia de migração: o armazenamento e a administração das avaliações, o editor privado e os serviços dinâmicos de notícias ainda precisam ser conectados à infraestrutura independente. Não há migração de dados privados. Envios por fetch estão bloqueados nesta prévia para não simular salvamento.\n\nPublique em um servidor HTTP com a raiz nesta pasta. Não desative o original antes da validação.\n'));
    const archive=await zip(files);
    return new Response(archive,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="Gaivota_Arquivos_Originais_Previa.zip"','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
  }catch(e){return new Response('A exportação não foi concluída: '+String(e),{status:502,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
}
