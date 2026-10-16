(function () {
  const SUB_KEY = 'chan-subscribed';

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
    return '/' + encodeURIComponent(username) + '/' + encodeURIComponent(String(id)) + '/' +
      String(file || '').split('/').map(encodeURIComponent).join('/');
  }
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
        video.src = src;
        wrap.appendChild(video);
        box.appendChild(wrap);
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
    article.dataset.hydrated = '1';
    const username = key.slice(0, slash);
    const id = key.slice(slash + 1);
    const box = article.querySelector('.feed-post-media');
    const text = article.querySelector('.feed-post-text');
    fetch('/' + encodeURIComponent(username) + '/' + encodeURIComponent(id) + '/post.json', { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((post) => {
        if (!post) return;
        if (text && post.html) text.innerHTML = post.html;
        fillMedia(box, username, id, post.media || []);
        collapseText(text);
      })
      .catch(() => {});
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
    more.textContent = 'Показать всё';
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
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
    const href = '/' + encodeURIComponent(username) + '/' + encodeURIComponent(String(post.id)) + '/';
    const chHref = '/' + encodeURIComponent(username) + '/';
    const name = title || username;
    const text = esc(post.preview || post.title || ('Пост ' + post.id));
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
  function ensureLightbox() {
    let box = document.querySelector('.feed-lightbox');
    if (box) return box;
    box = document.createElement('dialog');
    box.className = 'feed-lightbox';
    box.innerHTML =
      '<button class="feed-lightbox-close" type="button" aria-label="Закрыть">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="feed-lightbox-stage"><img class="feed-lightbox-image" alt=""></div>';
    document.body.appendChild(box);
    box.querySelector('.feed-lightbox-close').addEventListener('click', () => box.close());
    box.addEventListener('click', (event) => {
      if (event.target === box || event.target.classList.contains('feed-lightbox-stage')) box.close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && box.open) box.close();
    });
    return box;
  }
  document.addEventListener('click', (event) => {
    const img = event.target.closest && event.target.closest('.feed-post-media img, .post-media img');
    if (!img || !img.src) return;
    const box = ensureLightbox();
    const view = box.querySelector('.feed-lightbox-image');
    view.src = img.currentSrc || img.src;
    view.alt = img.alt || '';
    if (typeof box.showModal === 'function') box.showModal();
    else box.setAttribute('open', '');
  });

  bindActions(document);
  if (!list) return;
  list.querySelectorAll('.feed-item').forEach(hydrate);

  const more = document.getElementById('feed-more');
  const sentinel = document.getElementById('feed-sentinel');
  const channel = list.dataset.channel || '';
  const PAGE = 12;
  let queue = [];

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
    if (more) more.hidden = queue.length === 0;
  }

  fetch('/_index.json', { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || !data.posts) return;
      const seen = new Set(Array.from(list.querySelectorAll('[data-post-key]')).map((el) => el.dataset.postKey));
      const titles = data.channels || {};
      const items = [];
      Object.entries(data.posts).forEach(([username, posts]) => {
        if (channel && username !== channel) return;
        const title = titles[username] && titles[username].title;
        (posts || []).forEach((post) => {
          const key = username + '/' + post.id;
          if (seen.has(key)) return;
          items.push({ date: post.date, html: card(username, post, Boolean(channel), title) });
        });
      });
      items.sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));
      queue = items;
      if (more) more.hidden = queue.length === 0;
    })
    .catch(() => {});

  if (more) more.addEventListener('click', renderNext);
  if (sentinel && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) renderNext();
    }, { rootMargin: '600px' });
    io.observe(sentinel);
  }
})();
