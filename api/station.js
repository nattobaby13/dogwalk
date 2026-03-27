module.exports = async (req, res) => {
  const token = process.env.WAQI_TOKEN;
  const uid = req.query.uid;

  if (!token) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "WAQI_TOKEN is not configured." }));
    return;
  }

  if (!uid) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing uid query parameter." }));
    return;
  }

  const url = `https://api.waqi.info/feed/@${encodeURIComponent(uid)}/?token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(url);
    const payload = await response.json();

    res.statusCode = response.ok ? 200 : response.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unable to load WAQI station detail." }));
  }
};
