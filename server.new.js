/* Dependencies: Core 
   modules for security, 
   files, and networking */
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

/* Middleware: Enable 
   CORS for portfolio UI 
   and limit requests */
app.use(cors());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

/* Logic: Data engine 
   to fetch, calculate, 
   and persist market stats */
async function refreshMarketData() {
  const basePriceOil = 65.00;
  const basePriceGas = 1.28;
  const apiKey = process.env.OIL_API_KEY;
  const apiUrl = 
    `https://www.alphavantage.co/` +
    `query?function=BRENT` +
    `&apikey=${apiKey}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  if (!data.data || !data.data[0]) {
    throw new Error('API unreachable or empty');
  }

  const currentPriceOil = 
    parseFloat(data.data[0].value);

  /* Math: Calculate premium 
     but prevent negative 
     values via Math.max */
  const rawPremium = 
    currentPriceOil - basePriceOil;
  const warPremiumOil = 
    Math.max(0, rawPremium);
  
  const percentIncrease = 
    warPremiumOil / basePriceOil;
  const estimatedGasShock = 
    basePriceGas * (1 + percentIncrease);

  const freshData = {
    status: "success",
    currentPriceOil,
    warPremiumOil: 
      warPremiumOil.toFixed(2),
    estimatedGasShock: 
      estimatedGasShock.toFixed(2),
    lastUpdated: Date.now()
  };

  await fs.writeFile(
    cachePath, 
    JSON.stringify(freshData)
  );
  
  return freshData;
}

/* Route: Access point 
   for the dashboard's 
   data visualization */
app.get('/api/impactData', 
  async (req, res) => {
  try {
    let marketData;
    
    try {
      const cachedRaw = 
        await fs.readFile(cachePath, 'utf8');
      marketData = JSON.parse(cachedRaw);
      
      const oneDay = 24 * 60 * 60 * 1000;
      const isStale = 
        (Date.now() - marketData.lastUpdated) > oneDay;

      if (isStale) {
        console.log("Cache stale. Refreshing...");
        marketData = await refreshMarketData();
      }
    } catch (err) {
      console.log("Cache missing. Initializing...");
      marketData = await refreshMarketData();
    }

    res.json(marketData);

  } catch (error) {
    console.error("Engine Error:", error.message);
    res.status(500).json({ 
      status: "error", 
      message: "Data engine stalled" 
    });
  }
});

/* Listener: Initialize 
   the server process */
app.listen(portNumber, () => {
  console.log(
    `Engine Live: http://localhost:${portNumber}`
  );
});