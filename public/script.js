/* State: Central data store 
   to prevent redundant 
   DOM lookups */
const appState = {
  data: null,
  isLoaded: false
};

/* Elements: Cached DOM 
   references using 
   strict querySelector */
const ui = {
  oilCard:
    document.querySelector('.oilPriceCard'),
  yuanCard:
    document.querySelector('.yuanPriceCard'),
  spreadCard:
    document.querySelector('.easternDiscountCard'),
  gasCard:
    document.querySelector('.gasShockCard'),
  refreshBtn:
    document.querySelector('.refreshAction')
};

/* Core: Async engine 
   to pull 2026 market 
   metrics efficiently */
async function fetchMarketImpact() {
  try {
    const response =
      await fetch('http://localhost:3000/api/impactData');
    const result =
      await response.json();

    if (result.status === "success") {
      appState.data = result;
      renderDashboard();
    }
  } catch (error) {
    console.error("Link Severed:", error);
  }
}

/* UI Logic: High performance 
   rendering to avoid 
   layout thrashing */
function renderDashboard() {
  const {
    oilPriceCAD, 
    yuanPriceCAD,
    priceSpreadCAD,
    gasShockCAD
  } = appState.data;

  /* Batching: Write all DOM 
     changes in a single pass */
  ui.oilCard.querySelector('.value').innerText =
    `$${oilPriceCAD}`;
  ui.yuanCard.querySelector('.value').innerText =
    `$${yuanPriceCAD}`;
  ui.spreadCard.querySelector('.value').innerText =
    `$${priceSpreadCAD}`;
  ui.gasCard.querySelector('.value').innerText =
    `$${gasShockCAD}`;

  /* Animation: Trigger the 
     liquid glass bloom effect */
  document.querySelectorAll('.glassCard')
    .forEach(card => {
      card.classList.add('dataFresh');
    });
}

/* Motion: 3D Tilt logic 
   passing CSS variables to 
   avoid inline styling */
function applyCardPhysics(event) {
  const card = event.currentTarget;
  const rect =
    card.getBoundingClientRect();

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  const rotateX = 
    ((y - centerY) / centerY) * -4;
  const rotateY = 
    ((x - centerX) / centerX) * 4;

  card.style.setProperty('--rotateX', `${rotateX}deg`);
  card.style.setProperty('--rotateY', `${rotateY}deg`);
}

/* Reset: Return cards 
   to neutral state 
   on mouse leave */
function resetCardPhysics(event) {
  const card = event.currentTarget;
  card.style.setProperty('--rotateX', `0deg`);
  card.style.setProperty('--rotateY', `0deg`);
}

/* Init: Attach event 
   listeners and boot 
   the entire system */
function initializeEngine() {
  fetchMarketImpact();

  document.querySelectorAll('.glassCard')
    .forEach(card => {
      card.addEventListener('mousemove', applyCardPhysics);
      card.addEventListener('mouseleave', resetCardPhysics);
    });

  ui.refreshBtn.addEventListener('click', () => {
    /* Shimmer: One sweep 
       per manual click */
    ui.refreshBtn.classList.add('shimmerActive');
    fetchMarketImpact();
    setTimeout(() => {
      ui.refreshBtn.classList.remove('shimmerActive');
    }, 350);
  });
}

window.addEventListener('DOMContentLoaded', initializeEngine);