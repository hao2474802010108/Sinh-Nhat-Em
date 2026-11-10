/* A little birthday magic. No uploaded photograph leaves this browser. */
(() => {
  'use strict';

  const exported = window.__BIRTHDAY_EXPORT__;
  const exportScope = exported?.id ? `-${exported.id}` : '';
  const STORAGE_KEY = `petit-fairytale-birthday-settings-v1${exportScope}`;
  const DB_NAME = `petit-fairytale-birthday-photos-v1${exportScope}`;
  const PHOTO_COUNT = 20;
  const DEFAULT_MESSAGES = [
    'Chúc mừng sinh nhật cô gái mà anh thương nhất. Cảm ơn em vì đã đến và làm những ngày bình thường của anh trở nên lấp lánh hơn.',
    'Mong tuổi mới của em có thật nhiều niềm vui, những giấc mơ thành hiện thực và những ngày được yêu thương thật dịu dàng. Cứ cười thật tươi, cứ là em — vì em luôn rất đặc biệt.',
    'Hôm nay, ngày mai và cả những sinh nhật về sau, anh vẫn muốn được ở bên cạnh, nắm tay em và cùng em viết tiếp câu chuyện của chúng mình. Thương em thật nhiều!'
  ];
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = exported?.config || window.BIRTHDAY_CONFIG || {};
  let stored = {};
  if (!exported || exportScope) {
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { /* Storage is optional. */ }
  }
  let config = {
    nickname: 'Công chúa của anh', birthday: '', sender: 'Người thương của em',
    message: DEFAULT_MESSAGES, ...base, ...stored
  };
  config.message = Array.isArray(config.message) && config.message.length ? config.message : DEFAULT_MESSAGES;
  const photos = Array.from({ length: PHOTO_COUNT }, (_, index) => {
    const supplied = base.photos?.[index];
    return {
      src: typeof supplied === 'string' ? supplied : supplied?.src || `assets/photo-${String(index + 1).padStart(2, '0')}.svg`,
      caption: supplied?.caption || `Một khoảnh khắc đáng yêu · ${String(index + 1).padStart(2, '0')}`
    };
  });
  if (Array.isArray(exported?.photos)) {
    exported.photos.slice(0, PHOTO_COUNT).forEach((item, index) => {
      if (typeof item === 'string' && item) photos[index].src = item;
      else if (item?.src) photos[index] = { ...photos[index], ...item };
    });
  }
  let dbPromise;
  let currentPhoto = 0;
  let uploadBusy = false;
  let hiddenPhotoInput;
  let currentEditSlot = 0;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'index' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function storedPhotos() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const request = db.transaction('photos', 'readonly').objectStore('photos').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (_) { return []; }
  }

  async function persistPhoto(index, data) {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put({ index, data });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (_) { return false; }
  }

  function status(message) {
    const target = $('#uploadStatus');
    if (target) target.textContent = message;
  }

  function birthdayLabel() {
    if (!config.birthday) return 'Một ngày thật đặc biệt';
    const date = new Date(`${config.birthday}T12:00:00`);
    return Number.isNaN(date.getTime()) ? config.birthday : `${date.getDate()} tháng ${date.getMonth() + 1}`;
  }

  function paragraphList(target, paragraphs) {
    if (!target) return;
    target.replaceChildren(...paragraphs.map(text => {
      const p = document.createElement('p');
      p.textContent = String(text).normalize('NFC').replaceAll('{name}', config.nickname);
      return p;
    }));
  }

  function applyCopy() {
    $$('[data-nickname]').forEach(el => { el.textContent = config.nickname; });
    $$('[data-birthday]').forEach(el => { el.textContent = birthdayLabel(); });
    $$('[data-sender]').forEach(el => { el.textContent = config.sender; });
    paragraphList($('#wishMessage'), config.message);
    paragraphList($('#letterBody'), config.message);
    if ($('#letterSender')) $('#letterSender').textContent = config.sender;
    document.title = `Chúc mừng sinh nhật, ${config.nickname} ♡`;
  }

  function renderPhotos() {
    const grid = $('#memoryGrid');
    if (grid) {
      grid.replaceChildren(...photos.map((photo, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `memory-card${[0, 3, 6, 9, 12, 15, 18].includes(index) ? ' card-tall' : ''}`;
        card.style.setProperty('--card-tilt', `${[ -2, 1.5, -1, 2, -1.5 ][index % 5]}deg`);
        card.style.setProperty('--i', String(index % 5));
        card.setAttribute('aria-label', `Xem ảnh ${index + 1}: ${photo.caption}`);
        const wrap = document.createElement('span');
        wrap.className = 'memory-image';
        const img = document.createElement('img');
        img.src = photo.src;
        img.alt = photo.caption;
        img.loading = 'lazy';
        img.decoding = 'async';
        wrap.append(img);
        const caption = document.createElement('span');
        caption.className = 'memory-caption';
        caption.textContent = photo.caption;
        const number = document.createElement('span');
        number.className = 'memory-index';
        number.textContent = String(index + 1).padStart(2, '0');
        card.append(wrap, caption, number);
        card.addEventListener('click', () => openPhoto(index));
        return card;
      }));
    }
    const hero = $('#heroPhoto');
    if (hero) {
      hero.src = photos[0].src;
      hero.alt = `Khoảnh khắc đáng yêu của ${config.nickname}`;
    }
    $$('img[data-photo-index]').forEach(img => {
      const photo = photos[Number(img.dataset.photoIndex)];
      if (photo) { img.src = photo.src; img.alt = photo.caption; }
    });
    renderEditorPhotos();
    window.fairytaleObservePhotos?.();
  }

  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else dialog.setAttribute('open', '');
    document.body.classList.add('dialog-open');
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
  }

  function updateLightbox() {
    const photo = photos[currentPhoto];
    if ($('#lightboxImage')) {
      $('#lightboxImage').src = photo.src;
      $('#lightboxImage').alt = photo.caption;
    }
    if ($('#lightboxCaption')) $('#lightboxCaption').textContent = photo.caption;
    if ($('#photoCounter')) $('#photoCounter').textContent = `${String(currentPhoto + 1).padStart(2, '0')} / ${PHOTO_COUNT}`;
  }

  function openPhoto(index) {
    currentPhoto = (index + PHOTO_COUNT) % PHOTO_COUNT;
    updateLightbox();
    showDialog($('#photoDialog'));
  }

  function renderEditorPhotos() {
    const grid = $('#editPhotoGrid');
    if (!grid) return;
    grid.replaceChildren(...photos.map((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'edit-photo-slot';
      button.setAttribute('aria-label', `Thay ảnh số ${index + 1}`);
      button.title = `Bấm để thay ảnh ${String(index + 1).padStart(2, '0')}`;
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = '';
      img.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = String(index + 1).padStart(2, '0');
      button.append(img, label);
      button.addEventListener('click', () => {
        if (uploadBusy) return;
        currentEditSlot = index;
        hiddenPhotoInput?.click();
      });
      return button;
    }));
  }

  function populateEditor() {
    const values = { editNickname: config.nickname, editBirthday: config.birthday, editSender: config.sender, editMessage: config.message.join('\n\n') };
    Object.entries(values).forEach(([id, value]) => { const field = document.getElementById(id); if (field) field.value = value || ''; });
    renderEditorPhotos();
  }

  function saveSettings(close = true) {
    const read = (id, fallback) => document.getElementById(id)?.value?.trim() || fallback;
    config = {
      ...config,
      nickname: read('editNickname', 'Công chúa của anh'),
      birthday: $('#editBirthday')?.value || '',
      sender: read('editSender', 'Người thương của em'),
      message: read('editMessage', DEFAULT_MESSAGES.join('\n\n')).split(/\n\s*\n/).map(line => line.trim()).filter(Boolean)
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nickname: config.nickname, birthday: config.birthday, sender: config.sender, message: config.message }));
    } catch (_) { status('Đã cập nhật. Bạn hãy tải bản hoàn chỉnh xuống để giữ lại món quà nhé.'); }
    applyCopy();
    if (close) closeDialog($('#editDialog'));
  }

  async function imageData(file) {
    if (!file.type.startsWith('image/')) throw new Error('not-image');
    if (file.size > 40 * 1024 * 1024) throw new Error('too-large');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const ratio = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', .86);
    } finally { URL.revokeObjectURL(url); }
  }

  async function uploadFiles(files, start = 0) {
    if (uploadBusy) return;
    const chosen = [...files].filter(file => file.type.startsWith('image/')).slice(0, PHOTO_COUNT - start);
    if (!chosen.length) { status('Bạn chọn ảnh JPG, PNG hoặc WebP nhé.'); return; }
    uploadBusy = true;
    $('#photoUpload')?.setAttribute('disabled', '');
    let complete = 0;
    let persistent = true;
    let failed = 0;
    try {
      for (let i = 0; i < chosen.length; i++) {
        status(`Đang đặt ảnh vào cuốn truyện… ${i + 1}/${chosen.length}`);
        try {
          const data = await imageData(chosen[i]);
          photos[start + i].src = data;
          persistent = (await persistPhoto(start + i, data)) && persistent;
          complete++;
        } catch (_) { failed++; }
      }
      renderPhotos();
      const success = complete ? `Đã thêm ${complete} ảnh. ${persistent ? 'Ảnh được giữ trong trình duyệt này.' : 'Hãy tải bản hoàn chỉnh để giữ lại ảnh.'}` : 'Chưa đọc được ảnh. Bạn thử chọn ảnh JPG hoặc PNG nhé.';
      status(`${success}${failed ? ` Có ${failed} ảnh chưa đọc được; bạn có thể bấm từng ô để chọn lại.` : ''}`);
    } finally {
      uploadBusy = false;
      $('#photoUpload')?.removeAttribute('disabled');
      if ($('#photoUpload')) $('#photoUpload').value = '';
      if (hiddenPhotoInput) hiddenPhotoInput.value = '';
    }
  }

  async function resetSettings() {
    if (!window.confirm('Đưa lời chúc và 20 ảnh về bản minh họa ban đầu?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* Optional persistence. */ }
    try {
      const db = await openDB();
      await new Promise(resolve => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').clear();
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch (_) { /* Optional persistence. */ }
    config = { nickname: 'Công chúa của anh', birthday: '', sender: 'Người thương của em', message: DEFAULT_MESSAGES, ...base };
    photos.forEach((photo, index) => {
      const supplied = base.photos?.[index];
      photo.src = typeof supplied === 'string' ? supplied : supplied?.src || `assets/photo-${String(index + 1).padStart(2, '0')}.svg`;
    });
    applyCopy();
    renderPhotos();
    populateEditor();
    status('Đã trở về bản minh họa ban đầu.');
  }

  function confetti() {
    const canvas = $('#confettiCanvas');
    if (!canvas || reducedMotion) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    const colors = ['#f7a8c4', '#ee6999', '#f7d58b', '#cbb4e8', '#fbdbe7', '#fff5cf'];
    const particles = Array.from({ length: 115 }, () => ({
      x: width * .5, y: height * .45,
      vx: (Math.random() - .5) * 17, vy: -Math.random() * 15 - 3,
      size: Math.random() * 7 + 4, angle: Math.random() * Math.PI,
      spin: (Math.random() - .5) * .15, color: colors[Math.floor(Math.random() * colors.length)],
      heart: Math.random() > .75
    }));
    let last = performance.now();
    const started = last;
    if (canvas._confettiFrame) cancelAnimationFrame(canvas._confettiFrame);
    function frame(now) {
      const step = Math.min((now - last) / 16.667, 2);
      last = now;
      ctx.clearRect(0, 0, width, height);
      const fade = Math.min(1, (4400 - (now - started)) / 850);
      particles.forEach(p => {
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.vy += .16 * step;
        p.vx *= Math.pow(.995, step);
        p.angle += p.spin * step;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = Math.max(0, fade);
        ctx.fillStyle = p.color;
        if (p.heart) {
          const s = p.size * .6;
          ctx.beginPath();
          ctx.moveTo(0, s);
          ctx.bezierCurveTo(-s * 2, 0, -s, -s * 1.5, 0, -s * .5);
          ctx.bezierCurveTo(s, -s * 1.5, s * 2, 0, 0, s);
          ctx.fill();
        } else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .55);
        ctx.restore();
      });
      if (now - started < 4400) canvas._confettiFrame = requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, width, height); canvas._confettiFrame = null; }
    }
    canvas._confettiFrame = requestAnimationFrame(frame);
  }

  let audioContext;
  let musicGain;
  let musicTimer;
  let musicPlaying = false;
  let nextNoteAt = 0;
  let melodyIndex = 0;
  const melody = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 76, 74, 72, 76, 79, 76, 74, 77, 81, 79, 76, 74, 72, 71, 69, 71, 72, null];
  const chords = [[48, 52, 55], [53, 57, 60], [57, 60, 64], [55, 59, 62]];

  function playNote(midi, start, duration, volume, type = 'sine') {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(start);
    osc.stop(start + duration + .05);
  }

  function musicUI() {
    const button = $('#musicToggle');
    if (!button) return;
    button.setAttribute('aria-pressed', String(musicPlaying));
    button.setAttribute('aria-label', musicPlaying ? 'Tắt nhạc nền' : 'Bật nhạc nền');
    button.classList.toggle('is-playing', musicPlaying);
    const label = $('.music-label', button);
    if (label) label.textContent = musicPlaying ? 'Tắt nhạc' : 'Bật nhạc';
  }

  async function toggleMusic() {
    try {
      if (musicPlaying) {
        musicPlaying = false;
        clearInterval(musicTimer);
        musicGain.gain.cancelScheduledValues(audioContext.currentTime);
        musicGain.gain.setTargetAtTime(0, audioContext.currentTime, .08);
        musicUI();
        return;
      }
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      audioContext ||= new Context();
      await audioContext.resume();
      if (!musicGain) { musicGain = audioContext.createGain(); musicGain.connect(audioContext.destination); }
      musicGain.gain.cancelScheduledValues(audioContext.currentTime);
      musicGain.gain.setValueAtTime(.42, audioContext.currentTime);
      musicPlaying = true;
      nextNoteAt = audioContext.currentTime + .08;
      melodyIndex = 0;
      function schedule() {
        if (!musicPlaying) return;
        while (nextNoteAt < audioContext.currentTime + .65) {
          const midi = melody[melodyIndex % melody.length];
          if (midi !== null) playNote(midi, nextNoteAt, .95, .09, 'sine');
          if (melodyIndex % 8 === 0) {
            const chord = chords[Math.floor(melodyIndex / 8) % chords.length];
            chord.forEach((note, index) => playNote(note, nextNoteAt + index * .025, 2.8, .035));
          }
          nextNoteAt += .38;
          melodyIndex++;
        }
      }
      schedule();
      musicTimer = setInterval(schedule, 150);
      musicUI();
    } catch (_) { musicPlaying = false; musicUI(); }
  }

  const asDataURL = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  async function embeddedAsset(source) {
    if (!source || /^(data:|blob:|#)/i.test(source)) return source;
    const response = await fetch(new URL(source, document.baseURI));
    if (!response.ok) throw new Error(`asset-${response.status}`);
    return asDataURL(await response.blob());
  }

  async function inlineCssAssets(css) {
    const matches = [...css.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g)];
    for (const match of matches) {
      const source = match[2].trim();
      if (/^(data:|#)/i.test(source)) continue;
      try { css = css.replaceAll(match[0], `url("${await embeddedAsset(source)}")`); }
      catch (_) { /* Optional external font URLs keep their network fallback. */ }
    }
    return css;
  }

  async function downloadPage() {
    const button = $('#downloadPage');
    if (uploadBusy || button?.disabled) return;
    if (button) button.disabled = true;
    const oldLabel = button?.textContent;
    if (button) button.textContent = 'Đang gói ghém món quà…';
    status('Đang tạo món quà có đầy đủ ảnh và lời chúc của bạn…');
    try {
      saveSettings(false);
      const clone = document.documentElement.cloneNode(true);
      const imageCache = new Map();
      const embed = async source => {
        if (!imageCache.has(source)) imageCache.set(source, embeddedAsset(source));
        return imageCache.get(source);
      };
      const exportPhotos = [];
      for (const photo of photos) exportPhotos.push({ ...photo, src: await embed(photo.src) });
      await Promise.all($$('img', clone).map(async img => {
        const src = img.getAttribute('src');
        if (src) img.setAttribute('src', await embed(src));
        img.removeAttribute('srcset');
      }));
      for (const link of $$('link[rel="stylesheet"]', clone)) {
        const href = link.getAttribute('href');
        try {
          const response = await fetch(new URL(href, document.baseURI));
          if (!response.ok) throw new Error('stylesheet');
          const style = document.createElement('style');
          style.textContent = await inlineCssAssets(await response.text());
          link.replaceWith(style);
        } catch (error) {
          if (!/^https?:/i.test(href || '')) throw error;
        }
      }
      for (const style of $$('style', clone)) style.textContent = await inlineCssAssets(style.textContent);
      for (const script of $$('script', clone)) {
        const src = script.getAttribute('src');
        if (src) {
          const response = await fetch(new URL(src, document.baseURI));
          if (!response.ok) throw new Error('script');
          script.textContent = await response.text();
          script.removeAttribute('src');
          script.removeAttribute('type');
          script.removeAttribute('defer');
          script.removeAttribute('async');
        }
      }
      $$('script[data-birthday-export]', clone).forEach(script => script.remove());
      const settingsScript = document.createElement('script');
      settingsScript.setAttribute('data-birthday-export', '');
      const exportConfig = { nickname: config.nickname, birthday: config.birthday, sender: config.sender, message: config.message };
      const exportId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      settingsScript.textContent = `window.__BIRTHDAY_EXPORT__=${JSON.stringify({ id: exportId, config: exportConfig, photos: exportPhotos }).replace(/</g, '\\u003c')};window.__BIRTHDAY_EXPORT__.config.photos=window.__BIRTHDAY_EXPORT__.photos;`;
      const firstScript = $('script', clone);
      if (firstScript) firstScript.before(settingsScript);
      else $('head', clone).append(settingsScript);
      $$('dialog', clone).forEach(dialog => dialog.removeAttribute('open'));
      $$('[data-runtime-photo-input]', clone).forEach(input => input.remove());
      $('#memoryGrid', clone)?.replaceChildren();
      $('#editPhotoGrid', clone)?.replaceChildren();
      $$('button', clone).forEach(item => item.removeAttribute('disabled'));
      const clonedMusic = $('#musicToggle', clone);
      if (clonedMusic) {
        clonedMusic.setAttribute('aria-pressed', 'false');
        clonedMusic.classList.remove('is-playing');
        if ($('.music-label', clonedMusic)) $('.music-label', clonedMusic).textContent = 'Bật nhạc';
      }
      const clonedDownload = $('#downloadPage', clone);
      if (clonedDownload) clonedDownload.textContent = oldLabel || 'Tải món quà hoàn chỉnh';
      const clonedStatus = $('#uploadStatus', clone);
      if (clonedStatus) clonedStatus.textContent = 'Bấm vào từng ô để thay ảnh, hoặc chọn cùng lúc 20 ảnh yêu thích.';
      const clonedWishButton = $('#wishButton', clone);
      if (clonedWishButton) {
        clonedWishButton.classList.remove('is-wished');
        clonedWishButton.innerHTML = '<svg class="icon"><use href="#i-star"/></svg>Em ước xong rồi!';
      }
      const clonedWishStatus = $('#wishStatus', clone);
      if (clonedWishStatus) clonedWishStatus.textContent = 'Mong mọi điều em ước đều trở thành sự thật. ♡';
      $$('.cake', clone).forEach(cake => {
        cake.classList.remove('is-blown');
        cake.setAttribute('aria-label', 'Chiếc bánh sinh nhật hồng có ba ngọn nến');
      });
      $$('.reveal', clone).forEach(el => el.classList.remove('visible'));
      const clonedProgress = $('.scroll-progress', clone);
      if (clonedProgress) clonedProgress.style.width = '0%';
      clone.querySelector('body').classList.remove('dialog-open', 'motion-ready', 'fairy-ready', 'fairy-arriving');
      $('#fairyIntro', clone)?.setAttribute('hidden', '');
      $('#fairyGuide', clone)?.setAttribute('hidden', '');
      $('#fairyTraveler', clone)?.removeAttribute('style');
      $('#fairyGuide', clone)?.removeAttribute('style');
      $('.fairy-intro-copy', clone)?.removeAttribute('style');
      $('#fairyIntro', clone)?.removeAttribute('style');
      $('.chapter-awake', clone).forEach(el => el.classList.remove('chapter-awake'));
      $('section', clone).forEach(el => ['--scene-y','--portrait-y','--cloud-shift','--ornament-y'].forEach(name => el.style.removeProperty(name)));
      $$('link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="preload"]', clone).forEach(link => link.remove());
      const favicon = $('link[rel="icon"]', clone);
      if (favicon?.getAttribute('href') && !favicon.getAttribute('href').startsWith('data:')) {
        try { favicon.setAttribute('href', await embed(favicon.getAttribute('href'))); } catch (_) { favicon.remove(); }
      }
      const blob = new Blob(['<!DOCTYPE html>\n', clone.outerHTML], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'sinh-nhat-cong-chua.html';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status('Đã tải món quà hoàn chỉnh! Bạn có thể gửi file HTML này cho người thương.');
    } catch (_) {
      status(location.protocol === 'file:'
        ? 'Để đóng gói ảnh, hãy mở bản xem trên web rồi bấm tải lại nhé. Ảnh và lời chúc bạn vừa chọn vẫn ở đây.'
        : 'Món quà chưa tải xong. Bạn giữ trang này và thử bấm tải thêm lần nữa nhé.');
    } finally {
      if (button) { button.disabled = false; button.textContent = oldLabel || 'Tải món quà hoàn chỉnh'; }
    }
  }

  async function init() {
    if (!exported || exportScope) {
      const saved = await storedPhotos();
      saved.forEach(item => { if (item.index >= 0 && item.index < PHOTO_COUNT && item.data) photos[item.index].src = item.data; });
    }
    applyCopy();
    renderPhotos();
    populateEditor();
    hiddenPhotoInput = document.createElement('input');
    hiddenPhotoInput.type = 'file';
    hiddenPhotoInput.accept = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
    hiddenPhotoInput.hidden = true;
    hiddenPhotoInput.setAttribute('data-runtime-photo-input', '');
    document.body.append(hiddenPhotoInput);
    hiddenPhotoInput.addEventListener('change', event => uploadFiles(event.target.files, currentEditSlot));
    $('#photoUpload')?.addEventListener('change', event => uploadFiles(event.target.files));
    $('#saveSettings')?.addEventListener('click', () => saveSettings(true));
    $('#resetSettings')?.addEventListener('click', resetSettings);
    $('#downloadPage')?.addEventListener('click', downloadPage);
    $$('[data-open-editor]').forEach(button => button.addEventListener('click', () => {
      populateEditor();
      showDialog($('#editDialog'));
    }));
    $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
    $$('dialog').forEach(dialog => {
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(dialog);
      });
      dialog.addEventListener('close', () => {
        if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
      });
    });
    $('#openStory')?.addEventListener('click', () => {
      confetti();
      $('#wishes')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
    });
    $('#wishButton')?.addEventListener('click', event => {
      $$('.cake').forEach(cake => {
        cake.classList.add('is-blown');
        cake.setAttribute('aria-label', 'Chiếc bánh sinh nhật hồng, ba ngọn nến đã được thổi tắt');
      });
      if ($('#wishStatus')) $('#wishStatus').textContent = 'Điều ước đã được gửi đến những vì sao. Mong mọi điều dịu dàng sẽ đến với em!';
      event.currentTarget.classList.add('is-wished');
      event.currentTarget.textContent = 'Điều ước của em đã cất cánh ♡';
      confetti();
    });
    $('#openLetter')?.addEventListener('click', () => {
      paragraphList($('#letterBody'), config.message);
      showDialog($('#letterDialog'));
    });
    $('#prevPhoto')?.addEventListener('click', () => { currentPhoto = (currentPhoto + PHOTO_COUNT - 1) % PHOTO_COUNT; updateLightbox(); });
    $('#nextPhoto')?.addEventListener('click', () => { currentPhoto = (currentPhoto + 1) % PHOTO_COUNT; updateLightbox(); });
    document.addEventListener('keydown', event => {
      if (!$('#photoDialog')?.open) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); $('#prevPhoto')?.click(); }
      if (event.key === 'ArrowRight') { event.preventDefault(); $('#nextPhoto')?.click(); }
    });
    let touchStart = null;
    $('#lightboxImage')?.addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, { passive: true });
    $('#lightboxImage')?.addEventListener('touchend', event => {
      if (touchStart === null) return;
      const delta = event.changedTouches[0].clientX - touchStart;
      if (Math.abs(delta) > 45) $(delta > 0 ? '#prevPhoto' : '#nextPhoto')?.click();
      touchStart = null;
    }, { passive: true });
    $('#musicToggle')?.addEventListener('click', toggleMusic);
    musicUI();
    window.initFairytale?.();
    const dropZone = $('#photoDrop');
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
      ['dragleave', 'drop'].forEach(type => dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
      dropZone.addEventListener('drop', event => uploadFiles(event.dataTransfer.files));
    }
    if (new URLSearchParams(location.search).has('edit')) showDialog($('#editDialog'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
