# Pawcaster

Pawcaster is a Singapore dog-walk dashboard designed for an always-on iPad display.

It combines:
- AQICN / WAQI air-quality data
- NEA / data.gov.sg weather, rainfall, PM2.5, and WBGT data
- a simple walk recommendation model

The main question it answers is:

`Should we go for a walk?`

## What the app shows

- Selected Singapore AQI station
- Current AQI from AQICN
- Temperature and humidity from AQICN
- WBGT from NEA
- 2-hour NEA weather forecast
- 24-hour NEA regional forecast
- Ground wetness estimate from nearby rainfall readings
- PM2.5 comparison between AQICN station data and data.gov regional data
- A walk recommendation:
  - `Walk is good`
  - `Keep it short`
  - `Better to skip`

## Stack

Frontend:
- Plain `HTML`
- Plain `CSS`
- Plain `JavaScript`

Backend:
- Vercel serverless functions in [`api/`](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\api)

Hosting:
- Vercel

## Project structure

- [index.html](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\index.html): app markup and metadata
- [styles.css](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\styles.css): layout and responsive styling
- [script.js](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\script.js): data loading, rendering, scoring, and station switching
- [api/stations.js](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\api\stations.js): WAQI Singapore station list proxy
- [api/station.js](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\api\station.js): WAQI station detail proxy
- [api/nea-two-hour.js](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\api\nea-two-hour.js): NEA 2-hour forecast and 24-hour forecast proxy
- [api/nea-rainfall.js](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\api\nea-rainfall.js): NEA rainfall proxy
- [api/nea-wbgt.js](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\api\nea-wbgt.js): NEA WBGT proxy
- [api/nea-pm25.js](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\api\nea-pm25.js): NEA PM2.5 proxy
- [site.webmanifest](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\site.webmanifest): installed web-app metadata
- [assets/](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\assets): app icon assets

## Data sources

### AQICN / WAQI

Used for:
- station list within Singapore bounds
- station AQI
- temperature
- humidity
- station timestamp
- dominant pollutant
- raw station PM2.5 when available

Frontend routes:
- `/api/stations`
- `/api/station?uid=...`

### NEA / data.gov.sg

Used for:
- 2-hour forecast
- 24-hour forecast
- rainfall readings
- WBGT readings
- regional PM2.5

Frontend routes:
- `/api/nea-two-hour`
- `/api/nea-two-hour?mode=day`
- `/api/nea-rainfall`
- `/api/nea-wbgt`
- `/api/nea-pm25`

## Walk decision logic

The walk score is primarily based on:
- AQI
- WBGT
- rain

Temperature and humidity are still displayed, but WBGT is the main heat-stress signal.

### AQI scoring

- `0-50` => `0` points
- `51-100` => `1` point
- `101-150` => `2` points
- `151+` => hard stop

### WBGT scoring

Preferred source:
- NEA `heatStress` category

Current mapping:
- `Low` => `0` points
- `Moderate` => `2` points
- `High` => hard stop

Fallback numeric WBGT rule:
- `< 28` => `0` points
- `28-29.9` => `1` point
- `30-31.9` => `2` points
- `32+` => hard stop

### Rain hard stop

If the NEA 2-hour forecast text contains:
- `rain`
- `showers`
- `thundery`

then the verdict becomes:
- `Better to skip`

### Final score bands

- `0-1` => `Walk is good`
- `2-3` => `Keep it short`
- `4+` => `Better to skip`

### Hard-stop labels shown in the UI

- `AQI stop`
- `WBGT stop`
- `Heat stop`
- `Humidity stop`
- `Rain stop`

## PM2.5 comparison card

The PM2.5 comparison card is meant to compare:
- AQICN station PM2.5
- data.gov regional PM2.5

It also shows an estimated AQI conversion on each side to make the values easier to compare visually.

Important:
- AQICN main `AQI` is an index, not raw PM2.5
- the comparison card should use raw PM2.5 where available
- data.gov PM2.5 is regional, not station-level

## Ground wetness

Ground wetness is inferred from:
- the nearest rainfall gauge
- recent rainfall readings collected on this device

It can show:
- `Likely dry`
- `Maybe damp`
- `Likely wet`
- `Unavailable`

## Resilience / optional feeds

The app is designed so one broken feed should not take down the whole page.

If one of these fails, Pawcaster should continue rendering the rest:
- 2-hour forecast
- 24-hour forecast
- rainfall
- WBGT
- PM2.5 comparison

Unavailable sections should degrade gracefully instead of crashing the app.

## Local use

You can open [index.html](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\index.html) directly.

Local config is read from [local-config.js](C:\Users\GeraldineQuekCaiTing\Documents\New%20project\local-config.js).

Example:

```js
window.WAQI_LOCAL_TOKEN = "YOUR_WAQI_TOKEN";
window.DATA_GOV_SG_API_KEY = "YOUR_DATA_GOV_KEY";
```

Notes:
- `WAQI_LOCAL_TOKEN` is needed for local WAQI calls
- `DATA_GOV_SG_API_KEY` helps for local data.gov calls
- some public data.gov endpoints may still work without the key, but production should use the key

## Deployment

This project is set up to hide both WAQI and data.gov credentials behind Vercel serverless routes.

### Required Vercel environment variables

- `WAQI_TOKEN`
- `DATA_GOV_SG_API_KEY`

### Deploy flow

1. Push the repo to GitHub
2. Import the repo into Vercel
3. Add the two environment variables
4. Deploy

## iPad / dedicated display setup

Recommended setup:
- open the site in Safari
- use `Add to Home Screen`
- use landscape orientation

The app includes:
- web app manifest
- Apple web-app title metadata
- Home Screen icon assets

This makes the iPad version feel more like a dedicated display.

## Related app

Rat Watch SG:
- [https://ratwatchsg.pages.dev](https://ratwatchsg.pages.dev)

## Attribution / disclaimer

- AQICN / World Air Quality Index Project and originating agencies
- NEA / data.gov.sg

Pawcaster is an unofficial convenience display and not an official health advisory.
