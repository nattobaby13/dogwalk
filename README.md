# Pawcaster

Single-screen dog walk dashboard for Singapore using WAQI air data and NEA weather data.

## Deployment

This project is now set up to hide both WAQI and NEA credentials behind serverless routes.

For Vercel:

1. Add an environment variable named `WAQI_TOKEN`
2. Add an environment variable named `DATA_GOV_SG_API_KEY`
3. Deploy the project
4. The frontend will call:
   - `/api/stations`
   - `/api/station?uid=...`
   - `/api/nea-two-hour`
   - `/api/nea-two-hour?mode=day`
   - `/api/nea-rainfall`

## Data sources

- WAQI for AQI, temperature, humidity, and station timestamp
- NEA / data.gov.sg for 2-hour forecast, 24-hour forecast, and rainfall readings

