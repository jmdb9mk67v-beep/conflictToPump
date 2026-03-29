require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const portNumber = process.env.PORT || 3000;
const cachePath = path.join(__dirname, 'marketCache.json');

const baseOilUsd = 65.00;
const baseGasCad = 1.28;
const usdToCadRate = 1.38;
const yuanDiscountFactor = 0.85;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

/* Middleware: Limits incoming requests
   to protect the backend from spam
   and DDoS attacks. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

/* Network: Wrap the native fetch
   in an AbortController to enforce
   a strict timeout, preventing the
   Node thread from hanging forever. */
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 5000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(url, {
    ...options,
    signal: controller.signal
  });
  
  clearTimeout(id);
  return response;
}

/* Logic: Fetches external API data.
   Throws an error if the payload
   is invalid to prevent overwriting
   the cache with corrupted data. */
async function refreshMarketData() {
  const apiKey = process.env.OIL_API_KEY;
  const apiUrl =
    `https://www.alphavantage.co/query?` +
    `function=BRENT&interval=daily&apikey=${apiKey}`;

  let priceUsd;
  const response = await fetchWithTimeout(apiUrl);
  const data = await response.json();

  if (data && data.data && data.data[0]) {
    priceUsd = parseFloat(data.data[0].value);
    console.log("Market Data Fetched Successfully");
  } else {
    throw new Error("API Limit or Invalid Payload");
  }

  const priceCad = priceUsd * usdToCadRate;
  const priceYuanRouteCad =
    (priceUsd * yuanDiscountFactor) * usdToCadRate;

  const warPremiumCad =
    Math.max(0, priceCad - (baseOilUsd * usdToCadRate));

  const percentIncrease =
    warPremiumCad / (baseOilUsd * usdToCadRate);

  const estimatedGasShock =
    baseGasCad * (1 + percentIncrease);

  const freshData = {
    status: "success",
    oilPriceCad: priceCad.toFixed(2),
    yuanPriceCad: priceYuanRouteCad.toFixed(2),
    priceSpreadCad:
      (priceCad - priceYuanRouteCad).toFixed(2),
    gasShockCad: estimatedGasShock.toFixed(2),
    lastUpdated: Date.now()
  };

  await fs.writeFile(
    cachePath,
    JSON.stringify(freshData)
  );

  return freshData;
}

/* Route: Checks cache validity against
   a 2-hour TTL to respect API limits.
   Serves stale cache as a fallback if
   the external API request fails. */
app.get('/api/impactData', async (req, res) => {
  try {
    let marketData;
    let isCacheValid = false;
    const cacheTtl = 2 * 60 * 60 * 1000;

    try {
      const cachedRaw = await fs.readFile(cachePath, 'utf8');
      marketData = JSON.parse(cachedRaw);
      
      if ((Date.now() - marketData.lastUpdated) <= cacheTtl) {
        isCacheValid = true;
      }
    } catch (err) {
      console.log("No cache found on disk.");
    }

    if (!isCacheValid) {
      try {
        console.log("Refreshing market data...");
        marketData = await refreshMarketData();
      } catch (fetchError) {
        console.error("Fetch failed:", fetchError.message);
        
        if (!marketData) {
          return res.status(503).json({
            status: "error",
            message: "Service Unavailable"
          });
        }
        console.log("Serving stale cache as fallback.");
      }
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

app.use(express.static('public'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(portNumber, () => {
  console.log(`Engine Live: http://localhost:${portNumber}`);
});