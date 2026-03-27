const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const SELECTED_STATION_KEY = "dog-walk-selected-station-v2";
const LOCAL_TOKEN = window.WAQI_LOCAL_TOKEN || null;

const verdictMap = {
  walk: {
    key: "walk",
    mood: "Happy dog",
    title: "Walk is good",
    summary: "Conditions look comfortable for a normal outdoor walk."
  },
  brief: {
    key: "brief",
    mood: "Calm dog",
    title: "Keep it short",
    summary: "A short walk is okay, but a long or intense walk is not ideal."
  },
  skip: {
    key: "skip",
    mood: "Sad dog",
    title: "Better to skip",
    summary: "Conditions are rough enough that indoor play is the safer choice."
  }
};

const els = {
  statusMessage: document.getElementById("statusMessage"),
  heroCard: document.getElementById("heroCard"),
  stationName: document.getElementById("stationName"),
  stationMeta: document.getElementById("stationMeta"),
  updatedAt: document.getElementById("updatedAt"),
  moodLabel: document.getElementById("moodLabel"),
  verdictTitle: document.getElementById("verdictTitle"),
  verdictSummary: document.getElementById("verdictSummary"),
  aqiValue: document.getElementById("aqiValue"),
  tempValue: document.getElementById("tempValue"),
  humidityValue: document.getElementById("humidityValue"),
  pollutantValue: document.getElementById("pollutantValue"),
  scoreValue: document.getElementById("scoreValue"),
  scoreCaption: document.getElementById("scoreCaption"),
  rainSummary: document.getElementById("rainSummary"),
  rainTimeline: document.getElementById("rainTimeline"),
  stationList: document.getElementById("stationList")
};

let stations = [];
let selectedUid = localStorage.getItem(SELECTED_STATION_KEY) || null;

function setStatus(message, isError = false) {
  els.statusMessage.textContent = message;
  els.statusMessage.style.color = isError ? "var(--skip)" : "";
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

function persistSelectedUid(uid) {
  selectedUid = String(uid);
  localStorage.setItem(SELECTED_STATION_KEY, selectedUid);
}

function normalizeName(name = "") {
  return name
    .replace(/\s*-\s*Singapore.*$/i, "")
    .replace(/\s*,\s*Singapore.*$/i, "")
    .trim();
}

function formatPollutant(value = "") {
  const key = String(value).toLowerCase();
  const labels = {
    pm25: "PM2.5",
    pm10: "PM10",
    o3: "O3",
    no2: "NO2",
    so2: "SO2",
    co: "CO"
  };

  return labels[key] || String(value).toUpperCase();
}

function formatTemperature(value) {
  return Number.isFinite(value) ? `${Math.round(value)} C` : "--";
}

function formatHumidity(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "--";
}

function formatRelativeMinutes(isoString) {
  const observed = new Date(isoString);
  const minutes = Math.max(0, Math.round((Date.now() - observed.getTime()) / 60000));
  if (minutes <= 1) {
    return "just now";
  }
  return `${minutes} min ago`;
}

function formatObservedTime(time) {
  if (!time?.iso) {
    return "Station time unavailable";
  }

  const observed = new Date(time.iso);
  const label = observed.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return `Station reported ${label} (${formatRelativeMinutes(time.iso)})`;
}

function formatHourLabel(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    hour12: true
  });
}

function getAqiPenalty(aqi) {
  if (!Number.isFinite(aqi)) return 1;
  if (aqi <= 50) return 0;
  if (aqi <= 100) return 1;
  if (aqi <= 150) return 2;
  return 3;
}

function getTempPenalty(temp) {
  if (!Number.isFinite(temp)) return 0;
  if (temp >= 35) return 2;
  if (temp >= 32) return 1;
  return 0;
}

function getHumidityPenalty(humidity) {
  if (!Number.isFinite(humidity)) return 0;
  if (humidity >= 90) return 2;
  if (humidity >= 80) return 1;
  return 0;
}

function getVerdictDetails(aqi, temp, humidity) {
  if (Number.isFinite(aqi) && aqi >= 151) {
    return {
      verdict: verdictMap.skip,
      scoreText: "Hard stop",
      scoreCaption: "AQI threshold triggered",
      reasons: [
        `AQI ${aqi} is above the hard-stop threshold.`
      ]
    };
  }

  if (Number.isFinite(temp) && temp >= 35) {
    return {
      verdict: verdictMap.skip,
      scoreText: "Hard stop",
      scoreCaption: "Heat threshold triggered",
      reasons: [
        `Temperature ${Math.round(temp)} C is above the hard-stop heat threshold.`
      ]
    };
  }

  if (Number.isFinite(temp) && Number.isFinite(humidity) && temp >= 33 && humidity >= 85) {
    return {
      verdict: verdictMap.skip,
      scoreText: "Hard stop",
      scoreCaption: "Hot + humid threshold triggered",
      reasons: [
        `${Math.round(temp)} C with ${Math.round(humidity)}% humidity hits the hot-humid hard stop.`
      ]
    };
  }

  if (Number.isFinite(humidity) && humidity >= 95) {
    return {
      verdict: verdictMap.skip,
      scoreText: "Hard stop",
      scoreCaption: "Humidity threshold triggered",
      reasons: [
        `Humidity ${Math.round(humidity)}% is above the hard-stop threshold.`
      ]
    };
  }

  const aqiPenalty = getAqiPenalty(aqi);
  const tempPenalty = getTempPenalty(temp);
  const humidityPenalty = getHumidityPenalty(humidity);
  const total = aqiPenalty + tempPenalty + humidityPenalty;

  let verdict = verdictMap.skip;
  if (total <= 1) {
    verdict = verdictMap.walk;
  } else if (total <= 3) {
    verdict = verdictMap.brief;
  }

  if (Number.isFinite(aqi) && aqi > 80 && verdict.key === "walk") {
    verdict = verdictMap.brief;
  }

  const reasons = [
    Number.isFinite(aqi)
      ? `AQI ${aqi} adds ${aqiPenalty} point${aqiPenalty === 1 ? "" : "s"}.`
      : "AQI unavailable, so the app uses a conservative AQI penalty.",
    Number.isFinite(temp)
      ? `Temperature ${Math.round(temp)} C adds ${tempPenalty} point${tempPenalty === 1 ? "" : "s"}.`
      : "Temperature unavailable.",
    Number.isFinite(humidity)
      ? `Humidity ${Math.round(humidity)}% adds ${humidityPenalty} point${humidityPenalty === 1 ? "" : "s"}.`
      : "Humidity unavailable."
  ];

  if (Number.isFinite(aqi) && aqi > 80) {
    reasons.push("AQI above 80 caps the result at 'Keep it short'.");
  }

  return {
    verdict,
    reasons,
    scoreText: String(total),
    scoreCaption: `${aqiPenalty} AQI + ${tempPenalty} temp + ${humidityPenalty} humidity`
  };
}

function renderScore(scoreText, scoreCaption) {
  els.scoreValue.textContent = scoreText;
  els.scoreCaption.textContent = scoreCaption;
}

function classifyRain(rainMm, probability) {
  if (rainMm >= 2 || probability >= 80) {
    return { key: "wet", label: "Rain likely" };
  }
  if (rainMm >= 0.2 || probability >= 40) {
    return { key: "light", label: "Maybe rain" };
  }
  return { key: "dry", label: "Looks dry" };
}

function getRainAdjustment(rainNow, probabilityNow) {
  if (rainNow >= 2 || probabilityNow >= 80) {
    return {
      hardStop: true,
      reasons: [
        `Rain forecast for the current hour is ${rainNow.toFixed(1)} mm with ${Math.round(probabilityNow)}% probability.`,
        "Rain is heavy or highly likely right now, so the app recommends skipping the walk."
      ]
    };
  }

  if (rainNow >= 0.2 || probabilityNow >= 40) {
    return {
      hardStop: false,
      capToBrief: true,
      reasons: [
        `Rain forecast for the current hour is ${rainNow.toFixed(1)} mm with ${Math.round(probabilityNow)}% probability.`,
        "Light rain risk is enough to cap the verdict at 'Keep it short'."
      ]
    };
  }

  return {
    hardStop: false,
    capToBrief: false,
    reasons: [
      `Rain forecast for the current hour is ${rainNow.toFixed(1)} mm with ${Math.round(probabilityNow)}% probability.`,
      "Rain does not tighten the verdict right now."
    ]
  };
}

function renderRainTimeline(hourly) {
  if (!hourly?.time?.length) {
    els.rainSummary.textContent = "Rain forecast unavailable";
    els.rainTimeline.innerHTML = "";
    return;
  }

  const now = new Date();
  const upcoming = hourly.time
    .map((time, index) => ({
      time,
      rain: Number(hourly.rain?.[index]),
      probability: Number(hourly.precipitation_probability?.[index])
    }))
    .filter((item) => new Date(item.time) >= now)
    .slice(0, 8);

  if (!upcoming.length) {
    els.rainSummary.textContent = "No near-term forecast window";
    els.rainTimeline.innerHTML = "";
    return;
  }

  els.rainSummary.textContent = "Next 8 forecast hours";
  els.rainTimeline.innerHTML = upcoming.map((item) => {
    const rain = Number.isFinite(item.rain) ? item.rain : 0;
    const probability = Number.isFinite(item.probability) ? item.probability : 0;
    const state = classifyRain(rain, probability);

    return `
      <article class="rain-block ${state.key}">
        <p class="rain-time">${formatHourLabel(item.time)}</p>
        <p class="rain-label">${state.label}</p>
        <p class="rain-detail">${rain.toFixed(1)} mm • ${Math.round(probability)}%</p>
      </article>
    `;
  }).join("");
}

function renderStations() {
  els.stationList.innerHTML = stations.map((station) => {
    const active = Number(station.uid) === Number(selectedUid);
    const listVerdict = station.verdict || verdictMap.brief;
    return `
      <button class="station-item${active ? " is-active" : ""}" type="button" data-uid="${station.uid}" data-list-state="${listVerdict.key}">
        <span class="station-name">${station.name}</span>
        <span class="station-detail">AQI ${station.aqi}</span>
        <span class="station-state">${listVerdict.title}</span>
      </button>
    `;
  }).join("");
}

function renderDetail(detail, rainAdjustment) {
  const aqi = Number(detail.aqi);
  const temp = Number(detail.iaqi?.t?.v);
  const humidity = Number(detail.iaqi?.h?.v);
  const pollutant = formatPollutant(detail.dominentpol || "--");
  let result = getVerdictDetails(aqi, temp, humidity);
  let verdict = result.verdict;
  const reasons = [...result.reasons];

  if (rainAdjustment?.hardStop) {
    verdict = verdictMap.skip;
    reasons.push(...rainAdjustment.reasons);
  } else if (rainAdjustment?.capToBrief && verdict.key === "walk") {
    verdict = verdictMap.brief;
    reasons.push(...rainAdjustment.reasons);
  } else if (rainAdjustment?.reasons?.length) {
    reasons.push(...rainAdjustment.reasons);
  }

  els.heroCard.dataset.state = verdict.key;
  els.stationName.textContent = normalizeName(detail.city?.name || "Selected station");
  els.stationMeta.textContent = "Singapore";
  els.updatedAt.textContent = formatObservedTime(detail.time);
  els.moodLabel.textContent = verdict.mood;
  els.verdictTitle.textContent = verdict.title;
  els.verdictSummary.textContent = verdict.summary;
  els.aqiValue.textContent = Number.isFinite(aqi) ? String(aqi) : "--";
  els.tempValue.textContent = formatTemperature(temp);
  els.humidityValue.textContent = formatHumidity(humidity);
  els.pollutantValue.textContent = pollutant;
  renderScore(result.scoreText, result.scoreCaption);
}

function isSingaporeStation(station) {
  return /singapore/i.test(station.station?.name || "");
}

async function loadStations() {
  const payload = window.location.protocol === "file:" && LOCAL_TOKEN
    ? await fetchJson(`https://api.waqi.info/map/bounds/?latlng=1.15,103.55,1.50,104.10&token=${encodeURIComponent(LOCAL_TOKEN)}`)
    : await fetchJson("/api/stations");
  if (payload.status !== "ok" || !Array.isArray(payload.data)) {
    throw new Error("Could not load Singapore stations.");
  }

  return payload.data
    .filter(isSingaporeStation)
    .map((station) => ({
      uid: station.uid,
      aqi: station.aqi,
      name: normalizeName(station.station?.name || "Unnamed station")
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadStationDetail(uid) {
  const payload = window.location.protocol === "file:" && LOCAL_TOKEN
    ? await fetchJson(`https://api.waqi.info/feed/@${encodeURIComponent(uid)}/?token=${encodeURIComponent(LOCAL_TOKEN)}`)
    : await fetchJson(`/api/station?uid=${encodeURIComponent(uid)}`);
  if (payload.status !== "ok") {
    throw new Error("Could not load station detail.");
  }
  return payload.data;
}

async function loadRainForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: "Asia/Singapore",
    hourly: "rain,precipitation_probability",
    forecast_days: "1"
  });

  const payload = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  return payload.hourly;
}

async function enrichStationsWithVerdicts(baseStations) {
  const details = await Promise.all(baseStations.map(async (station) => {
    try {
      const detail = await loadStationDetail(station.uid);
      const aqi = Number(detail.aqi);
      const temp = Number(detail.iaqi?.t?.v);
      const humidity = Number(detail.iaqi?.h?.v);
      const verdict = getVerdictDetails(aqi, temp, humidity).verdict;

      return {
        ...station,
        aqi: Number.isFinite(aqi) ? aqi : station.aqi,
        verdict
      };
    } catch {
      return {
        ...station,
        verdict: getVerdictDetails(Number(station.aqi), NaN, NaN).verdict
      };
    }
  }));

  return details;
}

async function refresh() {
  setStatus("Loading latest reported station data...");

  try {
    stations = await loadStations();
    if (!stations.length) {
      throw new Error("No Singapore stations available.");
    }

    const selectedExists = stations.some((station) => Number(station.uid) === Number(selectedUid));
    if (!selectedExists) {
      persistSelectedUid(stations[0].uid);
    }

    stations = await enrichStationsWithVerdicts(stations);
    renderStations();
    const detail = await loadStationDetail(selectedUid);
    const [lat, lon] = detail.city?.geo || [];
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const hourlyRain = await loadRainForecast(lat, lon);
      const rainNow = Number(hourlyRain?.rain?.[0]) || 0;
      const probabilityNow = Number(hourlyRain?.precipitation_probability?.[0]) || 0;
      const rainAdjustment = getRainAdjustment(rainNow, probabilityNow);
      renderDetail(detail, rainAdjustment);
      renderRainTimeline(hourlyRain);
    } else {
      renderDetail(detail, null);
      els.rainSummary.textContent = "Rain forecast unavailable";
      els.rainTimeline.innerHTML = "";
    }
    setStatus("Showing latest reported station data.");
  } catch (error) {
    const localHint = window.location.protocol === "file:" && !LOCAL_TOKEN
      ? " Add a local token in local-config.js for local use."
      : "";
    setStatus((error.message || "Unable to load station data.") + localHint, true);
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-uid]");
  if (!button) {
    return;
  }

  persistSelectedUid(button.dataset.uid);
  renderStations();
  await refresh();
});

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
