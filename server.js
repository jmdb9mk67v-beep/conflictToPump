/**
 * Configuration: Load 
 * environment and 
 * security modules 
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const portNumber = process.env.PORT || 3000;
const cachePath = path.join(__dirname, 'marketCache.json');

/* Constants: 2026 
   Baselines and 
   Exchange Projections */
const baseOilUSD = 65.00;
const baseGasCAD = 1.28;
const usdToCadRate = 1.38; 
const yuanDiscountFactor = 0.85;

/**
 * Production Security:
 * Trust Render proxy and 
 * enable CORS/Limiting
 */
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

/**
 * Logic: Fetch Brent 
 * with a fail-safe fallback 
 * to prevent 500 errors
 */
async function refreshMarketData() {
  const apiKey = process.env.OIL_API_KEY;
  const apiUrl = 
    `https://www.alphavantage.co/query?` +
    `function=BRENT&apikey=${apiKey}`;

  let priceUSD;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    /* Validation: Check if 
       API returned data or 
       a 'Note' (rate limit) */
    if (data && data.data && data.data[0]) {
      priceUSD = parseFloat(data.data[0].value);
      console.log("Market Data Fetched Successfully");
    } else {
      /* Fallback: Use 2026 
         projected baseline 
         if API is throttled */
      console.warn("API Limit/Error: Using Fallback Data");
      priceUSD = 78.50; 
    }
  } catch (apiError) {
    console.error("Network Error: Using Fallback");
    priceUSD = 78.50;
  }
  
  /* Calculations: Consistent 
     logic regardless of 
     the data source */
  const priceCAD = priceUSD * usdToCadRate;
  const priceYuanRouteCAD = 
    (priceUSD * yuanDiscountFactor) * usdToCadRate;
  
  const warPremiumCAD = 
    Math.max(0, priceCAD - (baseOilUSD * usdToCadRate));
  
  const percentIncrease = 
    warPremiumCAD / (baseOilUSD * usdToCadRate);
  
  const estimatedGasShock = 
    baseGasCAD * (1 + percentIncrease);

  const freshData = {
    status: "success",
    oilPriceCAD: priceCAD.toFixed(2),
    yuanPriceCAD: priceYuanRouteCAD.toFixed(2),
    priceSpreadCAD: 
      (priceCAD - priceYuanRouteCAD).toFixed(2),
    gasShockCAD: estimatedGasShock.toFixed(2),
    lastUpdated: Date.now()
  };

  /* Cache: Save to disk 
     to reduce future 
     API dependencies */
  await fs.writeFile(
    cachePath, 
    JSON.stringify(freshData)
  );
  
  return freshData;
}

/**
 * Route: Serve data 
 * from JSON cache 
 * to prevent lag 
 */
app.get('/api/impactData', async (req, res) => {
  try {
    let marketData;
    
    try {
      const cachedRaw = await fs.readFile(cachePath, 'utf8');
      marketData = JSON.parse(cachedRaw);
      
      const oneDay = 24 * 60 * 60 * 1000;
      if ((Date.now() - marketData.lastUpdated) > oneDay) {
        console.log("Refreshing Cache...");
        marketData = await refreshMarketData();
      }
    } catch (err) {
      console.log("Initializing Cache...");
      marketData = await refreshMarketData();
    }

    res.json(marketData);

  } catch (error) {
    console.error("Critical System Error:", error.message);
    res.status(500).json({ 
      status: "error", 
      message: "Logic failure" 
    });
  }
});

/* Static Assets & Fallback */
app.use(express.static('public'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* Listener */
app.listen(portNumber, () => {
  console.log(`Engine Live: http://localhost:${portNumber}`);
});