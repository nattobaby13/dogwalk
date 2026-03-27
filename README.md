# Singapore Dog Walk Display

Single-screen iPad-friendly dashboard for Singapore stations using WAQI plus Open-Meteo rain forecast.

## Deployment

This project is now set up to hide the WAQI token behind serverless routes.

For Vercel:

1. Add an environment variable named `WAQI_TOKEN`
2. Deploy the project
3. The frontend will call:
   - `/api/stations`
   - `/api/station?uid=...`

## Data sources

- WAQI for AQI, temperature, humidity, pollutant, and station timestamp
- Open-Meteo for rain forecast

## Security note

Do not put the WAQI token back into `script.js`. Keep it in the server environment only.
