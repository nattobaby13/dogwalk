module.exports = async (req, res) => {
  const apiKey = process.env.DATA_GOV_SG_API_KEY;

  try {
    const options = apiKey
      ? {
          headers: {
            "x-api-key": apiKey
          }
        }
      : undefined;
    const response = await fetch("https://api-open.data.gov.sg/v2/real-time/api/weather?api=wbgt", options);
    const payload = await response.json();

    res.statusCode = response.ok ? 200 : response.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unable to load NEA WBGT observations." }));
  }
};
