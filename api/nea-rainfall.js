module.exports = async (req, res) => {
  const apiKey = process.env.DATA_GOV_SG_API_KEY;

  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "DATA_GOV_SG_API_KEY is not configured." }));
    return;
  }

  try {
    const response = await fetch("https://api-open.data.gov.sg/v2/real-time/api/rainfall", {
      headers: {
        "x-api-key": apiKey
      }
    });
    const payload = await response.json();

    res.statusCode = response.ok ? 200 : response.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unable to load NEA rainfall readings." }));
  }
};
