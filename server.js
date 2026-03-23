/* Configuration: Load 
   environment and 
   security modules */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const portNumber = process.env.PORT || 3000;
const cachePath = 
  path.join(__dirname, 'marketCache.json');

/* Constants: 2026 
   Baselines and 
   Exchange Projections */
const baseOilUSD = 65.00;
const baseGasCAD = 1.28;
const usdToCadRate = 1.38; 
const yuanDiscountFactor = 0.85;

/* Middleware: Enable 
   CORS and protect 
   from rate abuse */
app.use(cors());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

/* Logic: Fetch Brent 
   Crude and calculate 
   geopolitical metrics */
async function refreshMarketData() {
  const apiKey = process.env.OIL_API_KEY;
  const apiUrl = 
    `https://www.alphavantage.co/` +
    `query?function=BRENT` +
    `&apikey=${apiKey}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  if (!data.data || !data.data[0]) {
    throw new Error('Market API Timeout');
  }

  const priceUSD = 
    parseFloat(data.data[0].value);
  
  /* Calculations: Convert 
     to CAD and apply 
     Yuan trade discount */
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

  await fs.writeFile(
    cachePath, 
    JSON.stringify(freshData)
  );
  
  return freshData;
}

/* Route: Serve data 
   from JSON cache 
   to prevent lag */
app.get('/api/impactData', 
  async (req, res) => {
  try {
    let marketData;
    
    try {
      const cachedRaw = 
        await fs.readFile(cachePath, 'utf8');
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
    console.error("System Error:", error.message);
    res.status(500).json({ 
      status: "error", 
      message: "Data logic failure" 
    });
  }
});

/* Listener: Start 
   the Express engine */
app.listen(portNumber, () => {
  console.log(
    `Engine Live: http://localhost:${portNumber}`
  );
});