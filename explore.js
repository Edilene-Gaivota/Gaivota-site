(()=>{
  const section=document.querySelector('.explore-section'),track=document.querySelector('#explore-track');if(!section||!track)return;
  const slides=[...track.children],tabs=[...document.querySelectorAll('[data-explore]')],motion=matchMedia('(prefers-reduced-motion: reduce)');
  // A translated rail owns the motion; native scroll snapping cannot finish a flick early.
  const rail=document.createElement('div');rail.className='explore-rail';rail.append(...slides);track.append(rail);track.classList.add('is-enhanced');
  const gallery=document.querySelector('#explore-photos'),galleryIndex=slides.indexOf(gallery),aboutIndex=slides.findIndex(slide=>slide.id==='explore-about');
  let active=0,visible=false,paused=motion.matches,hovered=false,focused=false,photo=0,frames=[],timer,animation=0,moveFrame=0,drag=null,suppressClick=false,offset=0,wheelTime=0,trackWidth=track.clientWidth;
  const prev=document.querySelector('#explore-prev'),next=document.querySelector('#explore-next'),screen=document.querySelector('#gallery-screen');
  const wrap=index=>(index%slides.length+slides.length)%slides.length;
  const step=()=>slides.length>1?slides[1].offsetLeft-slides[0].offsetLeft:slides[0].offsetWidth;
  const targetFor=index=>index*step();
  let destination=0;
  function moveTo(value){
    offset=value;
    // Reuse the real slides in a circular track: no duplicate IDs, forms or timers.
    // A slide changes its virtual slot only while entirely outside the viewport.
    const cycle=step()*slides.length;
    slides.forEach((slide,i)=>{slide.style.transform=`translate3d(${Math.round((offset-targetFor(i))/cycle)*cycle}px,0,0)`;});
    rail.style.transform=`translate3d(${-offset}px,0,0)`;
  }
  function activate(index){active=wrap(index);tabs.forEach((tab,i)=>tab.setAttribute('aria-current',String(i===active)));slides.forEach((slide,i)=>{slide.inert=i!==active;slide.setAttribute('aria-hidden',String(i!==active));});prev.disabled=next.disabled=slides.length<2;document.querySelector('#explore-position').textContent=(active+1)+' / '+slides.length;schedule();}
  function stopAnimation(){
    cancelAnimationFrame(animation);animation=0;
    // offset always describes the last painted frame, never the destination.
  }
  function animateTo(index,instant=false,velocity=0){
    stopAnimation();destination=index;track.classList.add('is-interacting');activate(index);
    const from=offset,to=targetFor(index),distance=to-from;
    const finish=()=>{destination=active;moveTo(targetFor(active));animation=0;track.classList.remove('is-interacting');};
    if(instant||Math.abs(distance)<.5){finish();return;}
    // Keep explicit navigation perceptible even when the OS requests less motion.
    // Reduced motion gets a short, non-overshooting settle; never an abrupt swap.
    const duration=motion.matches?220:Math.min(1000,780+Math.abs(distance)*.08);
    const initialSpeed=Math.max(0,Math.min(4,velocity*duration/distance));
    const spring=t=>1-(1+(8-initialSpeed)*t)*Math.exp(-8*t);
    const end=spring(1);
    let started=null;
    function settle(now){
      if(started===null)started=now;
      const progress=Math.min(1,(now-started)/duration);
      // A damped curve carries the release momentum and settles without a snap.
      moveTo(from+distance*spring(progress)/end);
      if(progress<1)animation=requestAnimationFrame(settle);
      else finish();
    }
    animation=requestAnimationFrame(settle);
  }
  function nearest(){return Math.round(offset/step());}
  function closestIndex(index){return index+Math.round((offset/step()-index)/slides.length)*slides.length;}
  tabs.forEach(tab=>tab.addEventListener('click',()=>animateTo(closestIndex(Number(tab.dataset.explore)))));
  prev.addEventListener('click',()=>animateTo(destination-1));next.addEventListener('click',()=>animateTo(destination+1));
  track.addEventListener('wheel',event=>{
    const delta=event.shiftKey&&!event.deltaX?event.deltaY:event.deltaX;if(!delta||(!event.shiftKey&&Math.abs(delta)<=Math.abs(event.deltaY)))return;
    event.preventDefault();const now=performance.now(),fresh=now-wheelTime>180;wheelTime=now;
    if(fresh&&!drag&&Math.abs(delta)>3)animateTo(destination+(delta>0?1:-1));
  },{passive:false});
  track.addEventListener('keydown',event=>{if(event.target!==track)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();animateTo(destination+(event.key==='ArrowRight'?1:-1));}});
  document.querySelectorAll('[data-open-about]').forEach(link=>link.addEventListener('click',()=>animateTo(closestIndex(aboutIndex))));
  track.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0||event.target.closest('a,button,input,select,textarea,summary'))return;
    stopAnimation();track.classList.add('is-interacting');
    drag={x:event.clientX,y:event.clientY,lastX:event.clientX,left:offset,index:nearest(),id:event.pointerId,sampleTime:performance.now(),velocity:0,frameTime:performance.now(),pointerType:event.pointerType,moved:false};suppressClick=false;
  });
  function followPointer(now){
    moveFrame=0;if(!drag)return;
    const target=drag.left-(drag.lastX-drag.x);
    const elapsed=Math.min(48,Math.max(1,now-drag.frameTime));drag.frameTime=now;
    const response=drag.pointerType==='mouse'&&!motion.matches?1-Math.exp(-elapsed/42):1;
    const distance=target-offset;
    moveTo(Math.abs(distance)<.5?target:offset+distance*response);
    if(Math.abs(target-offset)>.25)moveFrame=requestAnimationFrame(followPointer);
  }
  track.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.abs(dy)>Math.abs(dx)*1.2&&Math.abs(dy)>10){drag=null;track.classList.remove('is-interacting');return;}
    if(!drag.moved&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){drag.moved=true;track.setPointerCapture(drag.id);track.classList.add('is-dragging');}
    if(drag.moved){
      event.preventDefault();const now=performance.now();
      drag.velocity=(event.clientX-drag.lastX)/Math.max(1,now-drag.sampleTime);
      drag.sampleTime=now;drag.lastX=event.clientX;
      if(!moveFrame)moveFrame=requestAnimationFrame(followPointer);
    }
  });
  function endDrag(event,cancelled=false){
    if(!drag||event.pointerId!==drag.id)return;const state=drag;drag=null;cancelAnimationFrame(moveFrame);moveFrame=0;
    if(track.hasPointerCapture(state.id))track.releasePointerCapture(state.id);track.classList.remove('is-dragging');
    const delta=(cancelled?state.lastX:event.clientX)-state.x,dy=event.clientY-state.y;
    // A quick release can arrive before a move frame (or even a pointermove).
    const horizontal=state.moved||(Math.abs(delta)>18&&Math.abs(delta)>Math.abs(dy)*1.2);
    if(!horizontal){animateTo(nearest());return;}
    const elapsed=Math.max(1,performance.now()-state.sampleTime);
    const releaseVelocity=event.clientX===state.lastX?state.velocity:(event.clientX-state.lastX)/elapsed;
    const flick=elapsed<100&&Math.abs(releaseVelocity)>.45&&Math.sign(releaseVelocity)===Math.sign(delta);
    const threshold=Math.min(96,slides[wrap(state.index)].offsetWidth*.16);
    const change=!cancelled&&(Math.abs(delta)>=threshold||(Math.abs(delta)>18&&flick));
    suppressClick=true;setTimeout(()=>{suppressClick=false;},0);animateTo(state.index+(change?(delta<0?1:-1):0),false,cancelled?0:-releaseVelocity);
  }
  track.addEventListener('pointerup',event=>endDrag(event));track.addEventListener('pointercancel',event=>endDrag(event,true));
  // Touch starts with implicit capture on the child. Its bubbling capture-loss
  // event must not cancel the gesture when capture transfers to the track.
  track.addEventListener('lostpointercapture',event=>{if(event.target===track)endDrag(event,true);});
  track.addEventListener('pointerleave',()=>{if(drag&&!drag.moved){drag=null;track.classList.remove('is-interacting');}});
  track.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation();}},true);
  track.addEventListener('dragstart',event=>event.preventDefault());
  const pause=document.querySelector('#gallery-pause'),position=document.querySelector('#gallery-position');let realPhotos=false;
  function showPhoto(index,announce=false){photo=(index+frames.length)%frames.length;frames.forEach((frame,i)=>{frame.classList.toggle('is-active',i===photo);frame.setAttribute('aria-hidden',String(i!==photo));});position.textContent=(realPhotos?'Foto ':'Prévia ')+(photo+1)+' de '+frames.length;if(announce)document.querySelector('#gallery-announcement').textContent=position.textContent;schedule();}
  function schedule(){clearTimeout(timer);if(frames.length>1&&active===galleryIndex&&visible&&!paused&&!hovered&&!focused&&!document.hidden)timer=setTimeout(()=>showPhoto(photo+1),5000);}
  pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Reproduzir':'Pausar';pause.setAttribute('aria-pressed',String(paused));schedule();});pause.textContent=paused?'Reproduzir':'Pausar';pause.setAttribute('aria-pressed',String(paused));
  document.querySelector('#gallery-prev').addEventListener('click',()=>showPhoto(photo-1,true));document.querySelector('#gallery-next').addEventListener('click',()=>showPhoto(photo+1,true));
  screen.addEventListener('mouseenter',()=>{hovered=true;schedule();});screen.addEventListener('mouseleave',()=>{hovered=false;schedule();});
  gallery.addEventListener('focusin',()=>{focused=true;schedule();});gallery.addEventListener('focusout',()=>{setTimeout(()=>{focused=gallery.contains(document.activeElement);schedule();},0);});document.addEventListener('visibilitychange',schedule);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.15}).observe(section);
  new ResizeObserver(()=>{if(track.clientWidth!==trackWidth){trackWidth=track.clientWidth;animateTo(active,true);}}).observe(track);motion.addEventListener('change',()=>{paused=motion.matches;pause.textContent=paused?'Reproduzir':'Pausar';pause.setAttribute('aria-pressed',String(paused));schedule();});
  const svg='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="8" y="11" width="48" height="42" rx="5"/><circle cx="23" cy="25" r="5"/><path d="m10 47 15-13 10 9 8-8 11 11"/></svg>';
  function render(photos){realPhotos=photos.length>0;const entries=realPhotos?photos:[0,1,2];screen.replaceChildren();entries.forEach((item,i)=>{const frame=document.createElement('figure');frame.className='gallery-frame';if(realPhotos){const img=document.createElement('img');img.src=item.src;img.alt=item.alt;img.loading='lazy';frame.append(img);if(item.caption){const caption=document.createElement('figcaption');caption.textContent=item.caption;frame.append(caption);}}else{frame.classList.add('gallery-placeholder');frame.dataset.tone=i;frame.innerHTML=svg;const title=document.createElement('strong'),hint=document.createElement('small');title.textContent='Foto 0'+(i+1);hint.textContent='Espaço reservado para suas fotos';frame.append(title,hint);}screen.append(frame);});frames=[...screen.children];document.querySelector('#gallery-empty-label').hidden=realPhotos;if(realPhotos)document.querySelector('#gallery-note').textContent='As fotos avançam automaticamente. Você também pode pausar e escolher o ritmo.';showPhoto(0);}
  render([]);activate(0);moveTo(0);
  fetch('/gallery.json').then(response=>response.ok?response.json():Promise.reject()).then(data=>{const photos=Array.isArray(data.photos)?data.photos.filter(item=>item&&typeof item.src==='string'&&/^\/?assets\/[a-zA-Z0-9_./-]+$/.test(item.src)&&!item.src.includes('..')&&typeof item.alt==='string'):[];if(photos.length)render(photos);}).catch(()=>{});
})();
