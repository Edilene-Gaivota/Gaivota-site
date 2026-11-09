(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const candidates = [...document.querySelectorAll('.section-heading, .hero-experience, .support-explorer, .explore-heading, .learning-format, .learning-topics, .learning-invitation, .journey-content, .faq-intro, .faq-browser, .feedback-intro, .feedback-card, .contact-copy, .social-panel')];
  // Horizontal carousel contents keep their own motion and never disappear on swipe.
  const targets = candidates.filter(target => !target.closest('.explore-slide'));
  const inView = new WeakSet(), animations = new Map();
  let observer;
  function reveal(target) {
    animations.get(target)?.cancel();
    if (!target.animate || target.matches(':focus-within')) return;
    // The requested reveal uses the same brief, user-triggered effect on desktop and mobile.
    const animation = target.animate([
      { opacity: 0, translate: '0 32px' },
      { opacity: 1, translate: '0 0' }
    ], { duration: 850, delay: Number(target.dataset.revealDelay || 0), easing: 'cubic-bezier(.22,.75,.25,1)', fill: 'backwards' });
    animations.set(target, animation);
    animation.onfinish = () => { animation.cancel(); if (animations.get(target) === animation) animations.delete(target); };
  }
  function configureMotion() {
    observer?.disconnect();
    animations.forEach(animation => animation.cancel());animations.clear();
    targets.forEach(target => { inView.delete(target); target.classList.remove('reveal-pending'); });
    // Content is visible by default, including when scripts/observers are unavailable.
    if (!('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0) {
          if (!inView.has(entry.target)) { inView.add(entry.target); reveal(entry.target); }
        } else if (entry.intersectionRatio === 0) {
          // Rearm only after the whole block leaves the viewport; never hide a reader's text.
          inView.delete(entry.target);
          animations.get(entry.target)?.cancel();animations.delete(entry.target);
        }
      });
    }, { threshold: [0, .04] });
    targets.forEach(target => {
      target.dataset.revealDelay = target.matches('.learning-format')
        ? String([...target.parentElement.children].indexOf(target) * 85) : '0';
      observer.observe(target);
    });
  }
  targets.forEach(target => target.addEventListener('focusin', () => {
    inView.add(target);animations.get(target)?.cancel();animations.delete(target);
  }));
  configureMotion();
  motion.addEventListener('change', configureMotion);

  // A small visual response follows both pointer and keyboard activation.
  document.addEventListener('click', event => {
    const control = event.target.closest('.button, #menu');
    if (!control || motion.matches) return;
    const bounds = control.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'tap-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    const diameter = Math.max(bounds.width, bounds.height) * 2;
    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${(event.detail ? event.clientX - bounds.left : bounds.width / 2) - diameter / 2}px`;
    ripple.style.top = `${(event.detail ? event.clientY - bounds.top : bounds.height / 2) - diameter / 2}px`;
    control.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    setTimeout(() => ripple.remove(), 800);
  });

  const progress = document.querySelector('.reading-progress span');
  const back = document.querySelector('.back-to-top');
  const navLinks = [...document.querySelectorAll('#nav a[href^="#"]')];
  let frame = 0;
  function updateScroll() {
    frame = 0;
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0})`;
    back.hidden = scrollY < 700;
    document.querySelector('header').classList.toggle('has-scrolled', scrollY > 20);
    const reached = navLinks.filter(link => document.querySelector(link.getAttribute('href')).getBoundingClientRect().top < innerHeight * .4);
    const current = reached[reached.length - 1];
    navLinks.forEach(link => { if (link === current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }
  function queueScroll() {
    if (!frame) frame = requestAnimationFrame(updateScroll);
  }
  addEventListener('scroll', queueScroll, { passive: true });
  addEventListener('resize', queueScroll);
  if ('ResizeObserver' in window) new ResizeObserver(queueScroll).observe(document.body);
  updateScroll();
})();
