/* State: Central management
   prevents redundant DOM reads
   and keeps track of cached
   bounding client rectangles. */
const appState = {
  data: null,
  cardRects: new WeakMap(),
  isRendering: false
};

const ui = {};

/* Fetch: Parses JSON and
   triggers a batch render
   only when the network request
   successfully completes. */
async function fetchMarketImpact() {
  try {
    const response = await fetch('/api/impactData');
    const result = await response.json();

    if (result.status === "success") {
      appState.data = result;
      renderDashboard();
    }
  } catch (error) {
    console.error("Link Severed:", error);
  }
}

/* Paint: Batch DOM updates into
   a single synchronous function
   to ensure the browser paints
   all changes simultaneously. */
function renderDashboard() {
  if (!appState.data) return;

  const {
    oilPriceCad,
    yuanPriceCad,
    priceSpreadCad,
    gasShockCad
  } = appState.data;

  ui.oilCardValue.textContent = `$${oilPriceCad}`;
  ui.yuanCardValue.textContent = `$${yuanPriceCad}`;
  ui.spreadCardValue.textContent = `$${priceSpreadCad}`;
  ui.gasCardValue.textContent = `$${gasShockCad}`;
}

/* Cache: Store the bounding box
   on mouse enter so that the
   high-frequency mousemove
   never reads document layout. */
function cacheCardBounds(event) {
  const card = event.currentTarget;
  appState.cardRects.set(
    card,
    card.getBoundingClientRect()
  );
}

/* Physics: Calculate 3D tilt
   using the cached rectangle,
   deferring the CSS update to
   the next animation frame. */
function calculateCardPhysics(event) {
  const card = event.currentTarget;
  const rect = appState.cardRects.get(card);
  if (!rect) return;

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const rotateX = ((y - centerY) / centerY) * -4;
  const rotateY = ((x - centerX) / centerX) * 4;

  if (!appState.isRendering) {
    appState.isRendering = true;
    requestAnimationFrame(() => {
      card.style.setProperty('--rotateX', `${rotateX}deg`);
      card.style.setProperty('--rotateY', `${rotateY}deg`);
      appState.isRendering = false;
    });
  }
}

/* Reset: Return CSS variables
   to zero when the cursor leaves,
   allowing the CSS transition
   to glide back gracefully. */
function resetCardPhysics(event) {
  const card = event.currentTarget;
  card.style.setProperty('--rotateX', `0deg`);
  card.style.setProperty('--rotateY', `0deg`);
}

/* Init: Cache DOM nodes once
   parsing is complete, then
   attach all listeners to finalize
   the application boot phase. */
function initializeEngine() {
  ui.oilCardValue =
    document.querySelector('.oilPriceCard .value');
  ui.yuanCardValue =
    document.querySelector('.yuanPriceCard .value');
  ui.spreadCardValue =
    document.querySelector('.easternDiscountCard .value');
  ui.gasCardValue =
    document.querySelector('.gasShockCard .value');
  ui.refreshBtn =
    document.querySelector('.refreshAction');
  ui.glassCards =
    document.querySelectorAll('.glassCard');

  fetchMarketImpact();

  ui.glassCards.forEach(card => {
    card.addEventListener('mouseenter', cacheCardBounds);
    card.addEventListener('mousemove', calculateCardPhysics);
    card.addEventListener('mouseleave', resetCardPhysics);
  });

  ui.refreshBtn.addEventListener('click', () => {
    ui.refreshBtn.classList.add('shimmerActive');
    fetchMarketImpact();
    setTimeout(() => {
      ui.refreshBtn.classList.remove('shimmerActive');
    }, 350);
  });
}

window.addEventListener('DOMContentLoaded', initializeEngine);