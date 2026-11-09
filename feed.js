(function () {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }
  const SUB_KEY = 'chan-subscribed';
  const postsByKey = new Map();

  function readSubs() {
    try {
      const raw = JSON.parse(localStorage.getItem(SUB_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (e) {
      return new Set();
    }
  }
  function writeSubs(set) {
    localStorage.setItem(SUB_KEY, JSON.stringify(Array.from(set)));
  }
  function paintSubscribe(button, on) {
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = button.querySelector('span');
    if (label) label.textContent = on ? 'Вы подписаны' : 'Подписаться';
  }
  function bindActions(root) {
    const subs = readSubs();
    root.querySelectorAll('.feed-subscribe').forEach((button) => {
      const channel = button.dataset.subscribeChannel;
      if (!channel || button.dataset.bound === '1') return;
      button.dataset.bound = '1';
      paintSubscribe(button, subs.has(channel));
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const next = readSubs();
        const on = !next.has(channel);
        if (on) next.add(channel);
        else next.delete(channel);
        writeSubs(next);
        document.querySelectorAll('.feed-subscribe').forEach((other) => {
          if (other.dataset.subscribeChannel === channel) paintSubscribe(other, on);
        });
      });
    });
    root.querySelectorAll('.feed-share').forEach((button) => {
      if (button.dataset.bound === '1') return;
      button.dataset.bound = '1';
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        const url = button.dataset.shareUrl || location.href;
        const title = document.title;
        try {
          if (navigator.share) {
            await navigator.share({ title: title, url: url });
            return;
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
        try {
          await navigator.clipboard.writeText(url);
          button.setAttribute('aria-label', 'Ссылка скопирована');
        } catch (e) {}
      });
    });
  }

  function mediaUrl(username, id, file) {
    const value = String(file || '');
    if (value.charAt(0) === '/') return value.split('/').map((part) => encodeURIComponent(part)).join('/');
    return '/media/' + encodeURIComponent(username) + '/' + encodeURIComponent(String(id)) + '/' +
      value.split('/').map(encodeURIComponent).join('/');
  }
  function channelHref(username) {
    return '/' + encodeURIComponent(username) + '/';
  }
  function frameUrl(src) {
    return String(src || '').replace(/\.mp4(?=$|[?#])/i, '.jpg');
  }
  function fitPlayer(wrap, w, h) {
    if (!wrap || !w || !h) return;
    wrap.style.aspectRatio = w + ' / ' + h;
    wrap.classList.toggle('is-tall', h > w);
  }
  function showFirstFrame(video) {
    if (!video || video.dataset.framed === '1') return;
    video.dataset.framed = '1';
    video.autoplay = false;
    video.removeAttribute('autoplay');
    video.muted = false;
    video.defaultMuted = false;
    video.removeAttribute('muted');
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    const raw = video.getAttribute('src') || '';
    const clean = raw.split('#')[0];
    if (clean && !video.getAttribute('poster')) video.poster = frameUrl(clean);
    if (clean && raw.indexOf('#t=') < 0) video.setAttribute('src', clean + '#t=0.001');
    const wrap = video.closest('.feed-video-player');
    const poster = new Image();
    poster.onload = () => fitPlayer(wrap, poster.naturalWidth, poster.naturalHeight);
    if (video.poster) poster.src = video.poster;
    const fit = () => fitPlayer(wrap, video.videoWidth, video.videoHeight);
    if (video.readyState >= 1) fit();
    else video.addEventListener('loadedmetadata', fit);
    watchPlayback(video);
  }
  let videoObserver = null;
  function watchPlayback(video) {
    if (!video || video.dataset.watch === '1' || !('IntersectionObserver' in window)) return;
    video.dataset.watch = '1';
    if (!videoObserver) {
      videoObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          if (el.dataset.userPlayed !== '1') return;
          if (entry.intersectionRatio <= 0.4 && !el.paused) el.pause();
        });
      }, { threshold: [0, 0.4, 0.75] });
    }
    videoObserver.observe(video);
  }
  function pauseOtherVideos(current) {
    document.querySelectorAll('video').forEach((other) => {
      if (other !== current && !other.paused) other.pause();
    });
  }
  document.addEventListener('play', (event) => {
    const video = event.target;
    if (!video || video.tagName !== 'VIDEO') return;
    video.dataset.userPlayed = '1';
    watchPlayback(video);
    pauseOtherVideos(video);
  }, true);
  function fillMedia(box, username, id, media) {
    if (!box || box.childElementCount || !media || !media.length) return;
    if (media.length > 1) box.classList.add('has-grid');
    media.forEach((item) => {
      const src = mediaUrl(username, id, item.path);
      if (item.type === 'video') {
        const wrap = document.createElement('div');
        wrap.className = 'feed-video-player';
        const video = document.createElement('video');
        video.className = 'feed-video';
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.poster = frameUrl(src);
        video.src = src + '#t=0.001';
        wrap.appendChild(video);
        box.appendChild(wrap);
        showFirstFrame(video);
        return;
      }
      if (item.type === 'photo') {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = '';
        img.src = src;
        box.appendChild(img);
        return;
      }
      const link = document.createElement('a');
      link.href = src;
      link.textContent = String(item.path || 'файл').split('/').pop();
      box.appendChild(link);
    });
  }
  function hydrate(article) {
    const key = article.dataset.postKey || '';
    const slash = key.indexOf('/');
    if (slash < 1 || article.dataset.hydrated === '1') return;
    const post = postsByKey.get(key);
    if (!post) return;
    article.dataset.hydrated = '1';
    const username = key.slice(0, slash);
    const id = key.slice(slash + 1);
    const box = article.querySelector('.feed-post-media');
    const text = article.querySelector('.feed-post-text');
    if (text && post.html) text.innerHTML = post.html;
    fillMedia(box, username, id, post.media || []);
    collapseText(text);
  }
  function collapseText(text) {
    if (!text || text.dataset.collapseReady === '1') return;
    text.dataset.collapseReady = '1';
    text.classList.add('is-collapsed');
    if (text.scrollHeight <= text.clientHeight + 1) {
      text.classList.remove('is-collapsed');
      return;
    }
    const more = document.createElement('button');
    more.className = 'feed-expand';
    more.type = 'button';
    const label = document.createElement('span');
    label.textContent = 'Показать всё';
    more.appendChild(label);
    more.addEventListener('click', () => {
      text.classList.remove('is-collapsed');
      more.remove();
    });
    text.insertAdjacentElement('afterend', more);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function letter(name) {
    const m = String(name || '').match(/[0-9A-Za-zА-Яа-яЁё]/);
    return m ? m[0].toUpperCase() : '#';
  }
  function when(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins >= 0 && mins < 1) return 'сейчас';
    if (mins >= 1 && mins <= 60) return mins + ' мин назад';
    return d.toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Moscow'
    });
  }
  function paintTimes(root) {
    (root || document).querySelectorAll('time[datetime]').forEach((node) => {
      const text = when(node.getAttribute('datetime'));
      if (text) node.textContent = text;
    });
  }
  function shareHtml(url) {
    return '<button class="feed-share" type="button" data-share-url="' + esc(url) + '" aria-label="Поделиться">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v8h16v-8"/><path d="M12 16V3"/><path d="M7 8l5-5 5 5"/></svg></button>';
  }
  function subscribeHtml(username) {
    return '<button class="feed-subscribe" type="button" data-subscribe-channel="' + esc(username) + '" aria-pressed="false">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>' +
      '<span>Подписаться</span></button>';
  }
  function card(username, post, channelOnly, title) {
    const href = channelHref(username);
    const chHref = '/' + encodeURIComponent(username) + '/';
    const name = title || username;
    const text = post.html || esc(post.text || post.description || post.title || ('Пост ' + post.id));
    const date = post.date || '';
    const dateHtml = date ? '<time datetime="' + esc(date) + '">' + esc(when(date)) + '</time>' : '';
    const shareUrl = location.origin + href;
    const actions = shareHtml(shareUrl) + subscribeHtml(username);
    const header = channelOnly
      ? '<header class="feed-post-head"><a class="feed-post-time" href="' + href + '">' + dateHtml + '</a>' + actions + '</header>'
      : '<header class="feed-post-head"><a class="feed-avatar" href="' + chHref + '" data-letter="' + esc(letter(name)) + '">' +
        '<img src="/photo/' + encodeURIComponent(username) + '.jpg" alt="" loading="lazy"></a><div class="feed-author">' +
        '<a class="feed-channel" href="' + chHref + '">' + esc(name) + '</a>' +
        (date ? '<a class="feed-post-time" href="' + href + '">' + dateHtml + '</a>' : '') +
        '</div>' + actions + '</header>';
    return '<article class="feed-item" data-post-key="' + esc(username + '/' + post.id) + '">' +
      header + '<div class="feed-post-text">' + text + '</div><div class="feed-post-media"></div></article>';
  }

  const list = document.getElementById('feed-list');
  let lockedScrollY = 0;
  function blockLockedScroll(event) {
    event.preventDefault();
  }
  function lockFeedScroll() {
    if (document.body.classList.contains('feed-no-scroll')) return;
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.top = '-' + lockedScrollY + 'px';
    document.body.classList.add('feed-no-scroll');
    window.addEventListener('touchmove', blockLockedScroll, { passive: false });
    window.addEventListener('wheel', blockLockedScroll, { passive: false });
  }
  function unlockFeedScroll() {
    if (!document.body.classList.contains('feed-no-scroll')) return;
    document.body.classList.remove('feed-no-scroll');
    document.body.style.top = '';
    window.removeEventListener('touchmove', blockLockedScroll);
    window.removeEventListener('wheel', blockLockedScroll);
    window.scrollTo(0, lockedScrollY);
  }

  function useTouchLightbox() {
    return window.matchMedia('(max-width: 760px), (hover: none) and (pointer: coarse)').matches;
  }
  function ensureLightbox() {
    let box = document.querySelector('.feed-lightbox');
    if (box) return box;
    box = document.createElement('dialog');
    box.className = 'feed-lightbox';
    box.innerHTML =
      '<button class="feed-lightbox-close" type="button" aria-label="Закрыть">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="feed-lightbox-stage"><img class="feed-lightbox-image" alt="" draggable="false"></div>';
    document.body.appendChild(box);
    const stage = box.querySelector('.feed-lightbox-stage');
    const view = box.querySelector('.feed-lightbox-image');
    const pointers = new Map();
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let pinch = null;
    let single = null;
    let moved = false;
    let suppressClick = false;

    function applyTransform() {
      view.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + scale.toFixed(4) + ')';
    }
    function layoutCenter() {
      const rect = stage.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    function scaleAround(next, anchorX, anchorY) {
      const center = layoutCenter();
      const cx = center.x + tx;
      const cy = center.y + ty;
      const k = next / (scale || 1);
      scale = next;
      tx = (anchorX - (anchorX - cx) * k) - center.x;
      ty = (anchorY - (anchorY - cy) * k) - center.y;
    }
    function resetTransform() {
      scale = 1;
      tx = 0;
      ty = 0;
      pinch = null;
      single = null;
      moved = false;
      pointers.clear();
      view.style.transition = '';
      view.style.transform = '';
      box.style.removeProperty('--lb-fade');
    }
    function clampPan(animate) {
      const rect = stage.getBoundingClientRect();
      const maxX = Math.max(0, (view.offsetWidth * scale - rect.width) / 2);
      const maxY = Math.max(0, (view.offsetHeight * scale - rect.height) / 2);
      tx = Math.min(maxX, Math.max(-maxX, tx));
      ty = Math.min(maxY, Math.max(-maxY, ty));
      view.style.transition = animate ? 'transform .2s ease' : 'none';
      applyTransform();
    }
    function closeLightbox() {
      if (typeof box.close === 'function' && box.open) box.close();
      else {
        box.removeAttribute('open');
        unlockFeedScroll();
        resetTransform();
      }
    }
    function snapBack() {
      view.style.transition = 'transform .2s ease';
      scale = 1;
      tx = 0;
      ty = 0;
      box.style.removeProperty('--lb-fade');
      applyTransform();
    }
    function dismissLightbox() {
      const dist = Math.hypot(tx, ty) || 1;
      view.style.transition = 'transform .18s ease';
      tx += (tx / dist) * 180;
      ty += (ty / dist) * 180;
      box.style.setProperty('--lb-fade', '0');
      applyTransform();
      setTimeout(closeLightbox, 170);
    }
    function readTouches(list) {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    function dropTouches(list) {
      for (let i = 0; i < list.length; i++) pointers.delete(list[i].identifier);
    }
    function points() {
      return Array.from(pointers.values());
    }
    function beginPinch() {
      const pts = points();
      if (pts.length < 2) return;
      single = null;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      pinch = {
        dist: dist,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2
      };
      view.style.transition = 'none';
    }
    function beginSingle() {
      const pts = points();
      if (!pts.length) return;
      pinch = null;
      single = { x: pts[0].x, y: pts[0].y, tx: tx, ty: ty };
      view.style.transition = 'none';
    }
    box.querySelector('.feed-lightbox-close').addEventListener('click', closeLightbox);
    box.addEventListener('click', (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.target === box || event.target.classList.contains('feed-lightbox-stage')) closeLightbox();
    });
    box.addEventListener('close', () => {
      unlockFeedScroll();
      resetTransform();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && box.open) closeLightbox();
    });
    box.addEventListener('touchmove', (event) => {
      if (box.classList.contains('is-touch')) event.preventDefault();
    }, { passive: false });
    stage.addEventListener('touchstart', (event) => {
      if (!box.classList.contains('is-touch')) return;
      box.classList.add('is-gesture');
      readTouches(event.changedTouches);
      if (pointers.size >= 2) beginPinch();
      else beginSingle();
    }, { passive: true });
    stage.addEventListener('touchmove', (event) => {
      if (!box.classList.contains('is-touch')) return;
      event.preventDefault();
      readTouches(event.changedTouches);
      const pts = points();
      if (pts.length >= 2) {
        if (!pinch) beginPinch();
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const next = Math.min(4, Math.max(1, scale * (dist / pinch.dist)));
        scaleAround(next, pinch.midX, pinch.midY);
        tx += midX - pinch.midX;
        ty += midY - pinch.midY;
        pinch = { dist: dist, midX: midX, midY: midY };
        moved = true;
        applyTransform();
        return;
      }
      if (!single || !pts.length) return;
      const dx = pts[0].x - single.x;
      const dy = pts[0].y - single.y;
      if (Math.hypot(dx, dy) > 8) moved = true;
      if (scale > 1.02) {
        tx = single.tx + dx;
        ty = single.ty + dy;
        applyTransform();
        return;
      }
      tx = dx;
      ty = dy;
      const drag = Math.hypot(dx, dy);
      box.style.setProperty('--lb-fade', String(Math.max(0.35, 1 - drag / 360)));
      applyTransform();
    }, { passive: false });
    stage.addEventListener('touchend', (event) => {
      if (!box.classList.contains('is-touch')) return;
      dropTouches(event.changedTouches);
      if (pointers.size >= 2) {
        beginPinch();
        return;
      }
      if (pointers.size === 1) {
        beginSingle();
        return;
      }
      const didMove = moved;
      pinch = null;
      single = null;
      box.classList.remove('is-gesture');
      if (didMove) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 350);
      }
      if (scale > 1.02) {
        clampPan(true);
        moved = false;
        return;
      }
      if (Math.hypot(tx, ty) > 72) dismissLightbox();
      else snapBack();
      moved = false;
    });
    stage.addEventListener('touchcancel', () => {
      pointers.clear();
      pinch = null;
      single = null;
      box.classList.remove('is-gesture');
      if (scale > 1.02) clampPan(true);
      else snapBack();
    });
    box._resetTransform = resetTransform;
    return box;
  }
  function openLightbox(img) {
    const box = ensureLightbox();
    const view = box.querySelector('.feed-lightbox-image');
    if (box._resetTransform) box._resetTransform();
    const touch = useTouchLightbox();
    box.classList.toggle('is-touch', touch);
    view.src = img.currentSrc || img.src;
    view.alt = img.alt || '';
    if (touch) lockFeedScroll();
    if (box.open) return;
    if (typeof box.showModal === 'function') box.showModal();
    else box.setAttribute('open', '');
  }
  document.addEventListener('click', (event) => {
    const img = event.target.closest && event.target.closest('.feed-post-media img, .post-media img');
    if (!img || !img.src || img.closest('.feed-lightbox')) return;
    event.preventDefault();
    openLightbox(img);
  });

  bindActions(document);
  paintTimes(document);
  setInterval(() => paintTimes(document), 30000);
  document.querySelectorAll('video').forEach(showFirstFrame);

  const bar = document.querySelector('.site-header');
  if (bar) {
    let lastY = window.scrollY || 0;
    let acc = 0;
    let frame = 0;
    const onScroll = () => {
      const y = Math.max(0, window.scrollY || 0);
      const dy = y - lastY;
      lastY = y;
      if (y < 8) {
        acc = 0;
        bar.classList.remove('is-hidden');
        return;
      }
      if ((dy > 0 && acc < 0) || (dy < 0 && acc > 0)) acc = 0;
      acc += dy;
      if (acc > 12) {
        bar.classList.add('is-hidden');
        acc = 0;
      } else if (acc < -12) {
        bar.classList.remove('is-hidden');
        acc = 0;
      }
    };
    window.addEventListener('scroll', () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        onScroll();
      });
    }, { passive: true });
  }

  if (!list) return;

  const more = document.getElementById('feed-more');
  const sentinel = document.getElementById('feed-sentinel');
  const RESERVED = { media: 1, css: 1, js: 1, icon: 1, icons: 1, photo: 1, privacy: 1, assets: 1 };
  function channelFromPage() {
    if (list.dataset.channel) return list.dataset.channel;
    const parts = location.pathname.split('/').filter(Boolean);
    if (!parts.length || parts[0].toLowerCase() === 'index.html') return '';
    const name = parts[0].replace(/\.html$/i, '');
    if (!name || RESERVED[name.toLowerCase()]) return '';
    if (parts.length === 1) return name;
    if (parts.length === 2 && (/^index\.html$/i.test(parts[1]) || /^\d+$/.test(parts[1]))) return name;
    return '';
  }
  const channel = channelFromPage();
  if (channel) list.dataset.channel = channel;
  const PAGE = 12;
  let queue = [];
  let packs = [];
  const authored = {
    title: document.title,
    description: ((document.querySelector('meta[name="description"]') || {}).content) || ''
  };

  function renderNext() {
    const slice = queue.splice(0, PAGE);
    if (!slice.length) {
      if (more) more.hidden = true;
      return;
    }
    const html = slice.map((item) => item.html).join('');
    list.insertAdjacentHTML('beforeend', html);
    const fresh = Array.from(list.querySelectorAll('.feed-item')).slice(-slice.length);
    fresh.forEach(hydrate);
    bindActions(list);
    paintTimes(list);
    if (more) more.hidden = queue.length === 0;
  }

  function setMeta(attr, key, value) {
    if (!value) return;
    let node = document.head.querySelector('meta[' + attr + '="' + key + '"]');
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(attr, key);
      document.head.appendChild(node);
    }
    node.setAttribute('content', value);
  }
  function setCanonical(url) {
    let node = document.head.querySelector('link[rel="canonical"]');
    if (!node) {
      node = document.createElement('link');
      node.rel = 'canonical';
      document.head.appendChild(node);
    }
    node.href = url;
  }
  function setLd(data) {
    let node = document.getElementById('chan-ld');
    if (!data) {
      if (node) node.remove();
      return;
    }
    if (!node) {
      node = document.createElement('script');
      node.id = 'chan-ld';
      node.type = 'application/ld+json';
      document.head.appendChild(node);
    }
    node.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }
  function fillHooks(pack, count) {
    document.querySelectorAll('[data-posts]').forEach((el) => {
      el.textContent = String(count);
    });
    if (!pack) return;
    document.querySelectorAll('[data-channel-title]').forEach((el) => {
      el.textContent = pack.title || pack.username || '';
    });
    document.querySelectorAll('[data-channel-about]').forEach((el) => {
      el.textContent = pack.about || (pack.seo && pack.seo.description) || '';
    });
  }
  function applySeo() {
    if (!channel || !packs.length) return;
    const pack = packs[0];
    const name = pack.title || channel;
    const origin = location.origin;
    const count = (pack.posts || []).length;
    fillHooks(pack, count);
    const url = origin + channelHref(channel);
    const description = (pack.seo && pack.seo.description) || pack.about || authored.description || '';
    const title = (pack.seo && pack.seo.title) || name;
    document.title = title;
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:title', title);
    setCanonical(url);
    const newest = (pack.posts || []).slice().sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0)).slice(0, 100);
    setLd({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      numberOfItems: count,
      itemListElement: newest.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title || ('Пост ' + item.id),
        url: url
      }))
    });
  }

  function buildQueue() {
    const seen = new Set(Array.from(list.querySelectorAll('[data-post-key]')).map((el) => el.dataset.postKey));
    const items = [];
    packs.forEach((pack) => {
      const username = pack.username;
      const title = pack.title || username;
      (pack.posts || []).forEach((post) => {
        postsByKey.set(username + '/' + post.id, post);
        const key = username + '/' + post.id;
        if (seen.has(key)) return;
        items.push({ date: post.date, html: card(username, post, Boolean(channel), title) });
      });
    });
    items.sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));
    queue = items;
    list.querySelectorAll('.feed-item').forEach(hydrate);
    if (more) more.hidden = queue.length === 0;
    renderNext();
    applySeo();
  }

  function loadJson(url) {
    return fetch(url, { cache: 'no-cache' }).then((res) => (res.ok ? res.json() : null));
  }
  function loadFeed() {
    const job = channel
      ? loadJson('/' + encodeURIComponent(channel) + '.json').then((pack) => (pack && pack.posts ? [pack] : []))
      : loadJson('/channels.json').then((manifest) => {
          const entries = manifest && Array.isArray(manifest.channels) ? manifest.channels : [];
          return Promise.all(entries.map((item) => {
            const name = typeof item === 'string' ? item : item && item.username;
            return name ? loadJson('/' + encodeURIComponent(name) + '.json') : null;
          })).then((loaded) => loaded.filter((pack) => pack && Array.isArray(pack.posts)));
        });
    job.then((loaded) => {
      packs = loaded;
      if (!channel) fillHooks(null, packs.reduce((sum, pack) => sum + pack.posts.length, 0));
      buildQueue();
    }).catch(() => {});
  }

  loadFeed();
  if (more) more.addEventListener('click', renderNext);
  if (sentinel && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) renderNext();
    }, { rootMargin: '600px' });
    io.observe(sentinel);
  }
})();
