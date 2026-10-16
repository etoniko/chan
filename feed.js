(function () {
  const list = document.getElementById('feed-list');
  const more = document.getElementById('feed-more');
  const sentinel = document.getElementById('feed-sentinel');
  if (!list) return;
  const channel = list.dataset.channel || '';
  const PAGE = 12;

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
  function card(username, post, channelOnly, title) {
    const href = '/' + encodeURIComponent(username) + '/' + encodeURIComponent(String(post.id)) + '/';
    const chHref = '/' + encodeURIComponent(username) + '/';
    const name = title || username;
    const text = esc(post.preview || post.title || ('Пост ' + post.id));
    const date = post.date || '';
    const dateHtml = date ? '<time datetime="' + esc(date) + '">' + esc(when(date)) + '</time>' : '';
    const header = channelOnly
      ? '<header class="feed-post-head"><a class="feed-post-time" href="' + href + '">' + dateHtml + '</a></header>'
      : '<header class="feed-post-head"><a class="feed-avatar" href="' + chHref + '" data-letter="' + esc(letter(name)) + '">' +
        '<img src="/photo/' + encodeURIComponent(username) + '.jpg" alt="" loading="lazy"></a><div class="feed-author">' +
        '<a class="feed-channel" href="' + chHref + '">' + esc(name) + '</a>' +
        (date ? '<a class="feed-post-time" href="' + href + '">' + dateHtml + '</a>' : '') +
        '</div></header>';
    return '<article class="feed-item" data-post-key="' + esc(username + '/' + post.id) + '">' +
      header + '<div class="feed-post-text">' + text + '</div><div class="feed-post-media"></div></article>';
  }

  let queue = [];
  function renderNext() {
    const slice = queue.splice(0, PAGE);
    if (!slice.length) {
      if (more) more.hidden = true;
      return;
    }
    list.insertAdjacentHTML('beforeend', slice.map((item) => item.html).join(''));
    if (more) more.hidden = queue.length === 0;
  }

  fetch('/_index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.posts) return;
      const seen = new Set(Array.from(list.querySelectorAll('[data-post-key]')).map((el) => el.dataset.postKey));
      const titles = data.channels || {};
      const items = [];
      for (const [username, posts] of Object.entries(data.posts)) {
        if (channel && username !== channel) continue;
        const title = titles[username] && titles[username].title;
        for (const post of posts || []) {
          const key = username + '/' + post.id;
          if (seen.has(key)) continue;
          items.push({ date: post.date, html: card(username, post, Boolean(channel), title) });
        }
      }
      items.sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));
      queue = items;
      if (more) more.hidden = queue.length === 0;
    })
    .catch(() => {});

  if (more) more.addEventListener('click', renderNext);
  if (sentinel && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) renderNext();
    }, { rootMargin: '400px' });
    io.observe(sentinel);
  }
})();
