# 🛢️ Conflict-to-Pump: Energy Dashboard

**Live Demo:** [conflicttopump.onrender.com](https://conflicttopump.onrender.com)

A full-stack web application that tracks global oil 
prices and estimates the cost of gas per liter 
at the pump for 2026. 

## 🌟 What It Does
* **Real-Time Tracking:** Fetches live Brent Crude 
  oil prices from the Alpha Vantage API.
* **Gas Price Estimator:** Calculates the expected 
  cost of gas per liter in CAD based on global 
  market shifts.
* **Always Online:** If the live data API goes down, 
  the app automatically uses built-in 2026 fallback 
  data so the dashboard never breaks.

## 💻 Built With
* **Frontend:** HTML, CSS, and vanilla JavaScript.
* **Backend:** Node.js and Express.
* **Design:** Custom 3D hover effects featuring a 
  soft tilt, shimmer sweep, and a mature aesthetic.

## 🚀 How to Run It Locally
1. Clone this folder to your computer.
2. Open your terminal and run `npm install`.
3. Get a free API key from Alpha Vantage:
   https://www.alphavantage.co/support/#api-key
4. Create a new file named `.env` in the root folder.
5. Inside the `.env` file, type exactly this:
   `OIL_API_KEY=paste_your_free_key_here`
   (Do not add spaces around the equals sign).
6. Type `npm start` to run the local server.
7. Open `http://localhost:3000` in your browser.
