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

/* Logic: Isolate the API call
   with the timeout wrapper to
   ensure a fallback response is
   always served without delay. */
async function refreshMarketData() {
  const apiKey = process.env.OIL_API_KEY;
  const apiUrl =
    `https://www.alphavantage.co/query?` +
    `function=BRENT&apikey=${apiKey}`;

  let priceUsd;

  try {
    const response = await fetchWithTimeout(apiUrl);
    const data = await response.json();

    if (data && data.data && data.data[0]) {
      priceUsd = parseFloat(data.data[0].value);
      console.log("Market Data Fetched Successfully");
    } else {
      console.warn("API Limit: Using Fallback Data");
      priceUsd = 78.50;
    }
  } catch (apiError) {
    console.error("Network Error: Using Fallback");
    priceUsd = 78.50;
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

/* Route: Nested try-catch blocks
   ensure cache initialization on
   the very first run, preventing
   read errors on a cold boot. */
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

app.use(express.static('public'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(portNumber, () => {
  console.log(`Engine Live: http://localhost:${portNumber}`);
});