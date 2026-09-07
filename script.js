const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('#nav');toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open))});nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false')}));

const hero=document.querySelector('.hero');
const art=document.querySelector('.hero-art-shell');
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

const heroSlides=[...document.querySelectorAll('.hero-slide')];
if(heroSlides.length>1&&!reduceMotion.matches){
  let heroSlideIndex=0;
  window.setInterval(()=>{
    heroSlides[heroSlideIndex].classList.remove('is-active');
    heroSlideIndex=(heroSlideIndex+1)%heroSlides.length;
    heroSlides[heroSlideIndex].classList.add('is-active');
  },3400);
}

if(hero&&art&&!reduceMotion.matches){
  hero.addEventListener('pointermove',event=>{
    const bounds=hero.getBoundingClientRect();
    const x=(event.clientX-bounds.left)/bounds.width-.5;
    const y=(event.clientY-bounds.top)/bounds.height-.5;
    art.style.setProperty('--tilt-x',`${x*5}deg`);
    art.style.setProperty('--tilt-y',`${y*-4}deg`);
    art.style.setProperty('--move-x',`${x*12}px`);
    art.style.setProperty('--move-y',`${y*8}px`);
  });
  hero.addEventListener('pointerleave',()=>{
    ['--tilt-x','--tilt-y','--move-x','--move-y'].forEach(prop=>art.style.removeProperty(prop));
  });
  window.addEventListener('scroll',()=>{
    const bounds=hero.getBoundingClientRect();
    if(bounds.bottom>0){art.style.setProperty('--move-y',`${Math.max(-18,window.scrollY*-.035)}px`)}
  },{passive:true});
}

const contactForm=document.querySelector('#contact-form');
const contactDialog=document.querySelector('#contact-dialog');
const senderDetails=document.querySelector('#sender-details');
const dialogClose=document.querySelector('.dialog-close');
const requestCv=document.querySelector('#request-cv');
const senderNameField=document.querySelector('#sender-name-field');
const senderName=senderDetails?.querySelector('[name="sender_name"]');
const dialogKicker=document.querySelector('#dialog-kicker');
const dialogTitle=document.querySelector('#dialog-title');
const dialogCopy=document.querySelector('#dialog-copy');
let contactStartedAt=Date.now();
let requestMode='message';

function setRequestMode(mode){
  requestMode=mode;
  const isCv=mode==='cv';
  senderNameField.hidden=isCv;
  senderNameField.style.display=isCv?'none':'';
  senderName.required=!isCv;
  dialogKicker.textContent=isCv?'Request my CV':'Before you send';
  dialogTitle.textContent=isCv?'Please enter your email':'How can I reply?';
  dialogCopy.textContent=isCv?'I’ll send you a copy of my CV.':'Please add your name and email so Joma can reply.';
  document.querySelector('#dialog-action')?.replaceChildren(isCv?'Request my CV':'Send message');
}

requestCv?.addEventListener('click',event=>{
  event.preventDefault();
  setRequestMode('cv');
  contactStartedAt=Date.now();
  contactDialog.showModal();
  contactDialog.querySelector('input[name="sender_email"]')?.focus();
});

contactForm?.addEventListener('submit',event=>{
  event.preventDefault();
  if(!contactForm.reportValidity())return;
  setRequestMode('message');
  contactStartedAt=Date.now();
  contactDialog.showModal();
  contactDialog.querySelector('input')?.focus();
});

dialogClose?.addEventListener('click',()=>contactDialog.close());
contactDialog?.addEventListener('click',event=>{
  if(event.target===contactDialog)contactDialog.close();
});

senderDetails?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!senderDetails.reportValidity())return;
  const submitButton=senderDetails.querySelector('[type="submit"]');
  const message=requestMode==='cv'?'CV request from portfolio website.':contactForm?.querySelector('textarea[name="message"]')?.value.trim();
  const details=new FormData(senderDetails);
  submitButton.disabled=true;
  submitButton.textContent='Sending…';
  try{
    const response=await fetch('/api/contact',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        name:requestMode==='cv'?'CV requester':details.get('sender_name'),
        email:details.get('sender_email'),
        website:details.get('website'),
        message,
        startedAt:contactStartedAt
      })
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.message||'Your message could not be sent.');
    contactDialog.close();
    contactForm.reset();
    senderDetails.reset();
    const toast=document.querySelector('#form-toast');
    toast?.classList.remove('error');
    toast?.querySelector('strong')?.replaceChildren(requestMode==='cv'?'CV request sent.':'Message sent.');
    toast?.querySelector('span')?.replaceChildren(requestMode==='cv'?'Thanks—Joma will send the CV to your email.':'Thanks—Joma can now review your message.');
    toast?.classList.add('show');
    window.setTimeout(()=>toast?.classList.remove('show'),5000);
  }catch(error){
    const toast=document.querySelector('#form-toast');
    toast?.classList.add('show','error');
    toast?.querySelector('strong')?.replaceChildren('Message not sent.');
    toast?.querySelector('span')?.replaceChildren(error.message||'Please try again.');
    window.setTimeout(()=>toast?.classList.remove('show','error'),6000);
  }finally{
    submitButton.disabled=false;
    submitButton.innerHTML=`<span id="dialog-action">${requestMode==='cv'?'Request my CV':'Send message'}</span> <span aria-hidden="true">↗</span>`;
  }
});

const videoDialog=document.querySelector('#video-dialog');
const videoFrame=document.querySelector('#video-frame');
const videoTitle=document.querySelector('#video-dialog-title');
const videoClose=document.querySelector('.video-close');

function closeVideo(){
  videoDialog?.close();
  videoFrame?.replaceChildren();
}

document.querySelectorAll('.reel-card').forEach(card=>card.addEventListener('click',()=>{
  const id=card.dataset.vimeo;
  if(!id||!videoDialog||!videoFrame)return;
  const iframe=document.createElement('iframe');
  iframe.src=`https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1&dnt=1&title=0&byline=0&portrait=0`;
  iframe.title=card.dataset.title||'Portfolio video';
  iframe.allow='autoplay; fullscreen; picture-in-picture';
  iframe.allowFullscreen=true;
  videoTitle.textContent=iframe.title;
  videoFrame.replaceChildren(iframe);
  videoDialog.showModal();
}));

videoClose?.addEventListener('click',closeVideo);
videoDialog?.addEventListener('click',event=>{if(event.target===videoDialog)closeVideo()});
videoDialog?.addEventListener('close',()=>videoFrame?.replaceChildren());

const revealTargets=document.querySelectorAll('.section-heading, .skill-card, .lab-copy, .flow-card, .portfolio-feature, .portfolio-subhead, .archive-grid figure, .motion-strip, .contact > *');
if(!reduceMotion.matches&&'IntersectionObserver' in window){
  revealTargets.forEach((item,index)=>{
    item.classList.add('reveal-item');
    item.style.setProperty('--reveal-delay',`${(index%4)*80}ms`);
  });
  const revealObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },{threshold:.12,rootMargin:'0px 0px -40px'});
  revealTargets.forEach(item=>revealObserver.observe(item));
}

const visitorCount=document.querySelector('#visitor-count');
if(visitorCount){
  const storageKey='kuncepto_portfolio_visit_counted';
  let alreadyCounted=false;
  try{alreadyCounted=localStorage.getItem(storageKey)==='yes'}catch{}
  fetch('/api/visits',{method:alreadyCounted?'GET':'POST'})
    .then(response=>response.ok?response.json():Promise.reject(new Error('Counter unavailable')))
    .then(result=>{
      visitorCount.textContent=Number(result.count||0).toLocaleString();
      if(!alreadyCounted){try{localStorage.setItem(storageKey,'yes')}catch{}}
    })
    .catch(()=>visitorCount.closest('.visitor-count')?.remove());
}
