const MINT = "8sP1Djg5fn4CRYQn9LrzQHQqdWkha7MNxszgKNVSpump";
const PUMP = "https://pump.fun/coin/" + MINT;

function ensurePanel() {
  if (document.getElementById("coin-panel")) return;
  const panel = document.createElement("div");
  panel.className = "coin-panel";
  panel.id = "coin-panel";
  panel.hidden = true;
  panel.innerHTML =
    '<p class="coin-note"><svg viewBox="0 0 397 311" aria-hidden="true"><path fill="url(#sol)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7zM64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8zM333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/><defs><linearGradient id="sol" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs></svg>Сеть Solana</p>' +
    '<p class="coin-help">Это монета CHAN на pump.fun. Скопируй адрес или купи монету. Кошелёк нужен в сети Solana.</p>' +
    '<div class="coin-actions"><button type="button" id="coin-copy">Скопировать адрес</button><a id="coin-buy" target="_blank" rel="noopener">Купить</a></div>' +
    '<p class="coin-mint"></p>' +
    '<p class="coin-warn">01.11.2026 был выпущен мемкоин и её цена 0.00000266 $</p>';
  document.body.appendChild(panel);
  panel.querySelector("#coin-buy").href = PUMP;
  panel.querySelector(".coin-mint").textContent = MINT;
  panel.querySelector("#coin-copy").addEventListener("click", async () => {
    const button = panel.querySelector("#coin-copy");
    try {
      await navigator.clipboard.writeText(MINT);
      button.textContent = "Скопировано";
    } catch (e) {
      button.textContent = "Не скопировалось";
    }
    setTimeout(() => { button.textContent = "Скопировать адрес"; }, 1600);
  });
}

function bind() {
  const toggle = document.getElementById("coin-toggle");
  const panel = document.getElementById("coin-panel");
  if (!toggle || !panel || toggle.dataset.bound) return;
  toggle.dataset.bound = "1";
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#coin-toggle, #coin-panel")) {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

ensurePanel();
bind();
