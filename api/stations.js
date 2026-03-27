module.exports = async (req, res) => {
  const token = process.env.WAQI_TOKEN;

  if (!token) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "WAQI_TOKEN is not configured." }));
    return;
  }

  const bounds = "1.15,103.55,1.50,104.10";
  const url = `https://api.waqi.info/map/bounds/?latlng=${bounds}&token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(url);
    const payload = await response.json();

    res.statusCode = response.ok ? 200 : response.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unable to load WAQI stations." }));
  }
};
