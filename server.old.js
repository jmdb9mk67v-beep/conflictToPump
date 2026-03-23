/* Configuration: Setup 
   environment and 
   framework instances */
   require('dotenv').config();
const express = require('express');
const ratelimit = require('express-rate-limit');
const app = express();
const portNumber = process.env.PORT || 3000;

/* Limiter: Define the policy for 2026 API consumption */
const apiLimiter = rateLimit({
  windowsMS: 15 * 60 *1000, // 15 mins
  limit: 50, //Max 50 requests
  message: {
    status: "error",
    message: "Too many requests"
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/* Constants: Reference 
   baselines for 2026 
   market calculations */
const basePriceOil = 65.00;
const basePriceGas = 1.28;
app.use('/api/', apiLimiter);

/* Route: Fetches market 
   data and calculates 
   the economic impact */
app.get('/api/impactData', 
  async (req, res) => {
  try {
    const apiKey = 
      process.env.OIL_API_KEY;
    const apiUrl = 
      `https://www.alphavantage.co/query` +
      `query?function=BRENT` +
      `&apikey=${apiKey}`;

    const response = 
      await fetch(apiUrl);
    const data = 
      await response.json();

    /* Validation: Ensure 
       API returned valid 
       time series data */
    if (!data.data || 
        !data.data[0]) {
      throw new Error('API Fail');
    }

    const currentPriceOil = 
      parseFloat(data.data[0].value);
    
    const warPremiumOil = 
      currentPriceOil - basePriceOil;
    
    const percentIncrease = 
      warPremiumOil / basePriceOil;
    
    const estimatedGasShock = 
      basePriceGas * (1 + percentIncrease);

    /* Response: Send flat 
       JSON to minimize 
       frontend processing */
    res.json({
      status: "success",
      currentPriceOil,
      warPremiumOil: 
        warPremiumOil.toFixed(2),
      estimatedGasShock: 
        estimatedGasShock.toFixed(2),
      lastUpdated: 
        new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: "Market offline" 
    });
  }
});

/* Listener: Initialize 
   the server process */
app.listen(portNumber, () => {
  console.log(
    `Live: http://localhost:${portNumber}`
  );
});