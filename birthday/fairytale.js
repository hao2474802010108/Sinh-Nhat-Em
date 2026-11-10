/* A small fairy, local fonts, and a story that unfolds as you scroll. */
(() => {
  'use strict';
  let started = false;
  window.initFairytale = () => {
    if (started) return;
    started = true;
    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const smallScreen = window.matchMedia('(max-width: 580px)');
    const intro = $('#fairyIntro');
    const traveler = $('#fairyTraveler');
    const guide = $('#fairyGuide');
    const canvas = $('#fairyDustCanvas');
    let ctx = null;
    try { ctx = canvas?.getContext('2d') || null; } catch (_) { /* Decorative only. */ }
    const chapters = $$('main > section');
    const particles = [];
    const colors = ['#dfbf7b', '#e5a7bf', '#f8e2ad', '#cca9d7', '#fff3d9'];
    let width = window.innerWidth;
    let height = window.innerHeight;
    let animation = 0;
    let scrollFrame = 0;
    let introStart = null;
    let lastFrame = 0;
    let scrollUntil = 0;
    let lastScroll = window.scrollY;
    let resizeTimer = 0;
    let guidePosition = { x: width - 60, y: height * .24 };
    let travelerSize = 120;
    let observer = null;
    const observed = new WeakSet();
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      if (!ctx || !canvas) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function addDust(x, y, count = 2, spread = 16) {
      if (!ctx || motion.matches || document.hidden) return;
      for (let i = 0; i < count; i++) {
        particles.push({ x: x + (Math.random() - .5) * spread, y: y + (Math.random() - .5) * spread,
          vx: (Math.random() - .5) * .55, vy: Math.random() * .6 + .25,
          age: 0, life: Math.random() * 700 + 700, size: Math.random() * 2.7 + 1,
          angle: Math.random() * Math.PI, color: colors[Math.floor(Math.random() * colors.length)], star: Math.random() > .4 });
      }
      if (particles.length > 130) particles.splice(0, particles.length - 130);
      requestDraw();
    }

    function drawParticles(delta) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += delta;
        if (p.age >= p.life) { particles.splice(i, 1); continue; }
        p.x += p.vx * delta / 16.67;
        p.y += p.vy * delta / 16.67;
        ctx.save();
        ctx.globalAlpha = Math.sin(Math.PI * p.age / p.life) * .82;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + p.age * .0003);
        ctx.beginPath();
        if (p.star) {
          for (let corner = 0; corner < 8; corner++) {
            const angle = corner * Math.PI / 4;
            const length = corner % 2 ? p.size * .28 : p.size * 1.8;
            const x = Math.cos(angle) * length;
            const y = Math.sin(angle) * length;
            corner ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.closePath();
        } else ctx.arc(0, 0, p.size * .6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function flightPoint(t) {
      const points = [
        { x: -100, y: height * .72 }, { x: width * .15, y: height * .48 },
        { x: width * .35, y: height * .22 }, { x: width * .59, y: height * .34 },
        { x: width * .78, y: height * .13 }, { x: width + 100, y: -120 }
      ];
      const position = clamp(t, 0, .99999) * (points.length - 1);
      const index = Math.floor(position);
      const u = position - index;
      const a = points[Math.max(0, index - 1)];
      const b = points[index];
      const c = points[Math.min(points.length - 1, index + 1)];
      const d = points[Math.min(points.length - 1, index + 2)];
      const at = key => .5 * ((2 * b[key]) + (-a[key] + c[key]) * u +
        (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * u * u +
        (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * u * u * u);
      return { x: at('x'), y: at('y') };
    }

    function endIntro() {
      introStart = null;
      if (intro) intro.hidden = true;
      document.body.classList.remove('fairy-arriving');
      if (guide && !motion.matches) {
        guide.hidden = false;
        guide.classList.add('is-guiding');
      }
      updateScenes();
    }

    function playIntro() {
      if (motion.matches || !intro || !traveler || document.hidden) return;
      intro.hidden = false;
      travelerSize = traveler.offsetWidth || (smallScreen.matches ? 115 : 140);
      // A fresh animation instance also makes replay work without forced layout.
      if (typeof intro.getAnimations === 'function') intro.getAnimations({ subtree: true }).forEach(item => {
        if (item.effect?.target === intro || item.effect?.target?.classList?.contains('fairy-intro-copy')) item.cancel();
      });
      intro.style.animation = 'none';
      const caption = $('.fairy-intro-copy');
      if (caption) caption.style.animation = 'none';
      requestAnimationFrame(() => {
        intro.style.removeProperty('animation');
        caption?.style.removeProperty('animation');
      });
      if (guide) guide.hidden = true;
      document.body.classList.add('fairy-arriving');
      particles.length = 0;
      introStart = performance.now();
      lastFrame = introStart;
      requestDraw();
    }

    function requestDraw() {
      if (!animation && !motion.matches && !document.hidden) animation = requestAnimationFrame(draw);
    }

    function draw(now) {
      animation = 0;
      if (motion.matches || document.hidden) {
        particles.length = 0;
        ctx?.clearRect(0, 0, width, height);
        return;
      }
      const delta = clamp(now - (lastFrame || now), 0, 40);
      lastFrame = now;
      if (introStart !== null) {
        const progress = clamp((now - introStart) / 5200, 0, 1);
        const point = flightPoint(progress);
        const next = flightPoint(Math.min(1, progress + .002));
        const rotation = clamp(Math.atan2(next.y - point.y, Math.max(1, next.x - point.x)) * 180 / Math.PI * .32, -22, 18);
        traveler.style.transform = `translate3d(${point.x}px,${point.y}px,0) translate(-50%,-50%) rotate(${rotation}deg)`;
        addDust(point.x + travelerSize * .34, point.y - travelerSize * .17, smallScreen.matches ? 1 : 2, 15);
        if (progress >= 1) endIntro();
      } else if (now < scrollUntil && !document.querySelector('dialog[open]')) {
        addDust(guidePosition.x + (smallScreen.matches ? 27 : 36), guidePosition.y + 22, 1, 9);
      }
      drawParticles(delta);
      if (introStart !== null || particles.length || now < scrollUntil) requestDraw();
    }

    function addChapterScenery() {
      chapters.filter(section => !section.classList.contains('hero')).forEach((section, index) => {
        if (section.querySelector('.chapter-mist')) return;
        const mist = document.createElement('div');
        mist.className = 'chapter-mist';
        mist.setAttribute('aria-hidden', 'true');
        mist.innerHTML = '<i></i><i></i><i></i>';
        const stars = document.createElement('div');
        stars.className = 'chapter-stars';
        stars.setAttribute('aria-hidden', 'true');
        for (let star = 0; star < 6; star++) {
          const item = document.createElement('span');
          item.textContent = star % 2 ? '✧' : '✦';
          item.style.setProperty('--star-x', `${[6, 91, 3, 94, 9, 88][star]}%`);
          item.style.setProperty('--star-y', `${[12, 25, 49, 65, 85, 93][star]}%`);
          item.style.setProperty('--star-size', `${[15, 25, 11, 17, 19, 12][star]}px`);
          item.style.setProperty('--star-delay', `${-star * .6 - index * .4}s`);
          stars.append(item);
        }
        section.prepend(mist, stars);
      });
    }

    function revealElements() {
      const elements = $$('.reveal, .memory-card');
      elements.forEach((element, index) => {
        if (observed.has(element)) return;
        observed.add(element);
        element.style.setProperty('--reveal-delay', `${element.classList.contains('memory-card') ? (index % (smallScreen.matches ? 2 : 4)) * 75 : index % 2 * 90}ms`);
        const bounds = element.getBoundingClientRect();
        if (motion.matches || !observer || (bounds.top < height * .96 && bounds.bottom > 0)) element.classList.add('visible');
        else observer.observe(element);
      });
    }

    function updateScenes() {
      scrollFrame = 0;
      const y = window.scrollY;
      const distance = Math.max(1, document.documentElement.scrollHeight - height);
      const progress = clamp(y / distance, 0, 1);
      const progressBar = $('.scroll-progress');
      if (progressBar) progressBar.style.width = `${progress * 100}%`;
      if (motion.matches) return;
      const hero = $('#home');
      if (hero && y < hero.offsetHeight + height) {
        hero.style.setProperty('--scene-y', `${Math.min(y * .075, 48)}px`);
        hero.style.setProperty('--portrait-y', `${-Math.min(y * .025, 16)}px`);
      }
      chapters.forEach(section => {
        const bounds = section.getBoundingClientRect();
        if (bounds.bottom < -150 || bounds.top > height + 150) return;
        const position = clamp((height * .5 - bounds.top) / Math.max(1, bounds.height), -.5, 1);
        section.style.setProperty('--cloud-shift', `${position * 28}px`);
        section.style.setProperty('--ornament-y', `${position * -16}px`);
        if (bounds.top < height * .75 && bounds.bottom > height * .15 && !section.classList.contains('chapter-awake')) {
          section.classList.add('chapter-awake');
          const heading = section.querySelector('h2');
          if (heading) {
            const box = heading.getBoundingClientRect();
            addDust(clamp(box.right - 20, 20, width - 25), clamp(box.top + 18, 10, height - 10), 17, 80);
          }
        }
      });
      const size = smallScreen.matches ? 44 : 58;
      guidePosition = { x: width - size - (smallScreen.matches ? 3 : 13), y: height * (.2 + progress * .45) + Math.sin(y / 420) * 17 };
      if (guide) guide.style.transform = `translate3d(${guidePosition.x}px,${guidePosition.y}px,0)`;
    }

    function onScroll() {
      const difference = Math.abs(window.scrollY - lastScroll);
      lastScroll = window.scrollY;
      if (introStart !== null && difference > 8) endIntro();
      if (!motion.matches && difference > .5) {
        scrollUntil = performance.now() + 240;
        requestDraw();
      }
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScenes);
    }

    addChapterScenery();
    resizeCanvas();
    if ('IntersectionObserver' in window && !motion.matches) {
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }), { threshold: .08, rootMargin: '0px 0px -28px 0px' });
    }
    revealElements();
    document.body.classList.add('fairy-ready');
    window.fairytaleObservePhotos = revealElements;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resizeCanvas(); updateScenes(); revealElements(); }, 120);
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        endIntro();
        cancelAnimationFrame(animation);
        animation = 0;
        particles.length = 0;
        ctx?.clearRect(0, 0, width, height);
      } else updateScenes();
    });
    document.addEventListener('pointerdown', event => {
      if (introStart !== null && !event.target.closest('#replayMagic')) endIntro();
    }, { passive: true });
    document.addEventListener('keydown', event => {
      if (introStart !== null && ['Escape', 'Tab', 'PageDown', 'ArrowDown', ' '].includes(event.key)) endIntro();
    });
    motion.addEventListener?.('change', () => {
      endIntro();
      particles.length = 0;
      cancelAnimationFrame(animation);
      animation = 0;
      ctx?.clearRect(0, 0, width, height);
      if (guide) guide.hidden = motion.matches;
      revealElements();
    });
    $('#replayMagic')?.addEventListener('click', playIntro);
    updateScenes();
    if (!motion.matches && !new URLSearchParams(location.search).has('edit') && window.scrollY < 80) playIntro();
    else if (guide && !motion.matches) { guide.hidden = false; guide.classList.add('is-guiding'); }
  };
})();
