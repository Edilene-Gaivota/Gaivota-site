(()=>{
 const fetchJson=async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Não foi possível consultar '+url);return r.json();};
 const show=(item,authored)=>{
  const headline=item.title||'',summary=item.summary||'',url='/blog/?artigo='+encodeURIComponent(authored?item.id:'oficial-'+item.slug);
  const preview=document.querySelector('.journal-preview');
  if(preview){
   const label=preview.querySelector('.journal-label'),title=preview.querySelector('h3'),p=preview.querySelector('p'),signature=preview.querySelector('.journal-signature');
   if(label)label.textContent=authored?item.category:'Notícia oficial · '+item.category;
   if(title)title.textContent=headline;
   if(p)p.textContent=summary;
   if(signature)signature.textContent=authored?'Edilene Gaivota':'Fonte: '+(item.sourceName||'órgão oficial');
   let link=preview.querySelector('a.journal-preview-link');
   if(!link){link=document.createElement('a');link.className='text-link journal-preview-link';preview.insertBefore(link,signature||null);}
   link.href=url;link.textContent=authored?'Ler a publicação':'Entender a notícia';
  }
  const windowCard=document.querySelector('.editorial-window');
  if(windowCard){
   const label=windowCard.querySelector('.journal-label'),title=windowCard.querySelector('h4'),p=windowCard.querySelector('p'),link=windowCard.querySelector('a');
   if(label)label.textContent=authored?'Leitura em destaque':'Notícias em foco · fonte oficial';
   if(title)title.textContent=headline;
   if(p)p.textContent=summary;
   if(link){link.href=url;link.textContent=authored?'Continuar a leitura':'Entender a notícia';}
  }
  const byline=document.querySelector('.editorial-byline');
  if(byline&&!authored)byline.textContent='Resumos de fontes oficiais e conteúdos autorais identificados pela minha assinatura.';
 };
 Promise.allSettled([fetchJson('/api/journal'),fetchJson('/api/news')]).then(([journal,news])=>{
  const authored=journal.status==='fulfilled'&&Array.isArray(journal.value.items)?journal.value.items:[];
  if(authored.length){show(authored[0],true);return;}
  const official=news.status==='fulfilled'&&Array.isArray(news.value.items)?[...news.value.items]:[];
  official.sort((a,b)=>(b.activePriority||0)-(a.activePriority||0)||String(b.publishedAt).localeCompare(String(a.publishedAt)));
  if(official.length)show(official[0],false);
 });
})();
