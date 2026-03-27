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
  rainNowIcon: document.getElementById("rainNowIcon"),
  rainNowValue: document.getElementById("rainNowValue"),
  scoreValue: document.getElementById("scoreValue"),
  scoreCaption: document.getElementById("scoreCaption"),
  rainSummary: document.getElementById("rainSummary"),
  rainTimeline: document.getElementById("rainTimeline"),
  aqiUpdated: document.getElementById("aqiUpdated"),
  rainUpdated: document.getElementById("rainUpdated"),
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

function formatUpdatedLabel(isoString, prefix) {
  if (!isoString) {
    return `${prefix} unavailable`;
  }

  const observed = new Date(isoString);
  const label = observed.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return `${prefix} ${label} (${formatRelativeMinutes(isoString)})`;
}

function formatSingleTimeLabel(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    hour12: true
  });
}

function getStationRegion(name = "") {
  const lower = name.toLowerCase();
  if (lower.includes("east")) return "east";
  if (lower.includes("west")) return "west";
  if (lower.includes("north")) return "north";
  if (lower.includes("south")) return "south";
  if (lower.includes("central")) return "central";
  return "central";
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

  if (Number.isFinite(aqi) && aqi >= 101 && verdict.key === "walk") {
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

  if (Number.isFinite(aqi) && aqi >= 101) {
    reasons.push("AQI above 100 is not allowed to return 'Walk is good'.");
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

function classifyRainText(text = "") {
  const lower = text.toLowerCase();
  if (lower.includes("thundery") || lower.includes("showers") || lower.includes("rain")) {
    return { key: "wet", label: "Rain likely" };
  }
  if (lower.includes("cloudy")) {
    return { key: "light", label: "Watch skies" };
  }
  return { key: "dry", label: "Looks dry" };
}

function getRainIconMarkup(text = "") {
  const lower = text.toLowerCase();

  if (lower.includes("thundery")) {
    return `
      <svg class="rain-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 18h8a5 5 0 0 0 .6-10A6 6 0 0 0 4.2 9.8 4.3 4.3 0 0 0 7 18Z"/>
        <path fill="currentColor" d="M12 12l-2 4h2l-1 4 4-6h-2l1-2Z"/>
      </svg>
    `;
  }

  if (lower.includes("showers") || lower.includes("rain")) {
    return `
      <svg class="rain-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 16h8a5 5 0 0 0 .6-10A6 6 0 0 0 4.2 7.8 4.3 4.3 0 0 0 7 16Z"/>
        <path fill="currentColor" d="M9 18c0 .8-.4 1.4-1 1.9-.6-.5-1-1.1-1-1.9 0-.7.4-1.4 1-2 .6.6 1 1.3 1 2Zm4 0c0 .8-.4 1.4-1 1.9-.6-.5-1-1.1-1-1.9 0-.7.4-1.4 1-2 .6.6 1 1.3 1 2Zm4 0c0 .8-.4 1.4-1 1.9-.6-.5-1-1.1-1-1.9 0-.7.4-1.4 1-2 .6.6 1 1.3 1 2Z"/>
      </svg>
    `;
  }

  if (lower.includes("cloudy")) {
    return `
      <svg class="rain-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 17h9a4.5 4.5 0 0 0 .5-9A5.5 5.5 0 0 0 6 9.5 4 4 0 0 0 7 17Z"/>
      </svg>
    `;
  }

  return `
    <svg class="rain-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
      <path fill="currentColor" d="M12 2h1v4h-1zM12 18h1v4h-1zM2 12h4v1H2zM18 12h4v1h-4zM5.6 4.9l.7-.7 2.8 2.8-.7.7zM15.9 15.2l.7-.7 2.8 2.8-.7.7zM4.2 18l2.8-2.8.7.7L4.9 18.7zM16.5 7l2.8-2.8.7.7-2.8 2.8z"/>
    </svg>
  `;
}

function getRainAdjustmentFromForecast(text = "") {
  const lower = text.toLowerCase();

  if (lower.includes("thundery") || lower.includes("showers") || lower.includes("rain")) {
    return {
      hardStop: true,
      scoreText: "Hard stop",
      scoreCaption: "Rain forecast triggered",
      metricLabel: "Rain / showers",
      reasons: [
        `Regional forecast says "${text}".`,
        "Rain conditions are enough to skip the walk for now."
      ]
    };
  }

  return {
    hardStop: false,
    capToBrief: false,
    scoreText: "No rain stop",
    scoreCaption: "Rain forecast clear",
    metricLabel: text || "No rain expected",
    reasons: [
      `Regional forecast says "${text || "No rain expected"}".`,
      "Regional rain forecast does not tighten the verdict right now."
    ]
  };
}

function renderRainTimeline(record, region) {
  const periods = record?.periods || [];
  if (!periods.length) {
    els.rainSummary.textContent = "Rain forecast unavailable";
    els.rainTimeline.innerHTML = "";
    return;
  }

  const regionLabel = `${region.charAt(0).toUpperCase()}${region.slice(1)} region`;
  els.rainSummary.textContent = regionLabel;
  els.rainTimeline.innerHTML = periods.map((period) => {
    const forecast = period.regions?.[region] || period.regions?.central || { text: "Forecast unavailable" };
    const state = classifyRainText(forecast.text || "");
    const startLabel = formatSingleTimeLabel(period.timePeriod?.start);
    const endLabel = formatSingleTimeLabel(period.timePeriod?.end);

    return `
      <article class="rain-block ${state.key}">
        <div class="rain-header">
          <p class="rain-time">${startLabel} to ${endLabel}</p>
          ${getRainIconMarkup(forecast.text || "")}
        </div>
        <p class="rain-label">${state.label}</p>
        <p class="rain-detail">${forecast.text || "Forecast unavailable"}</p>
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
        <span class="station-state">${listVerdict.title}</span>
      </button>
    `;
  }).join("");
}

function renderDetail(detail, rainAdjustment) {
  const aqi = Number(detail.aqi);
  const temp = Number(detail.iaqi?.t?.v);
  const humidity = Number(detail.iaqi?.h?.v);
  let result = getVerdictDetails(aqi, temp, humidity);
  let verdict = result.verdict;
  const reasons = [...result.reasons];
  let scoreText = result.scoreText;
  let scoreCaption = result.scoreCaption;

  if (rainAdjustment?.hardStop) {
    verdict = verdictMap.skip;
    reasons.push(...rainAdjustment.reasons);
    scoreText = rainAdjustment.scoreText || "Hard stop";
    scoreCaption = `${result.scoreCaption} + rain`;
  } else if (rainAdjustment?.capToBrief && verdict.key === "walk") {
    verdict = verdictMap.brief;
    reasons.push(...rainAdjustment.reasons);
    scoreCaption = `${result.scoreCaption} + rain cap`;
  } else if (rainAdjustment?.reasons?.length) {
    reasons.push(...rainAdjustment.reasons);
    scoreCaption = `${result.scoreCaption} + no rain stop`;
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
  els.rainNowIcon.innerHTML = getRainIconMarkup(rainAdjustment?.metricLabel || "");
  els.rainNowValue.textContent = rainAdjustment?.metricLabel || "--";
  renderScore(scoreText, scoreCaption);
  els.aqiUpdated.textContent = formatUpdatedLabel(detail.time?.iso, "AQICN updated");
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

async function loadNeaForecast() {
  const payload = await fetchJson("https://api-open.data.gov.sg/v2/real-time/api/twenty-four-hr-forecast");
  if (payload.code !== 0 || !payload.data?.records?.length) {
    throw new Error("Could not load NEA regional forecast.");
  }
  return payload.data.records[0];
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
    const neaForecast = await loadNeaForecast();
    const region = getStationRegion(detail.city?.name || "");
    const currentForecast = neaForecast.periods?.[0]?.regions?.[region]?.text || neaForecast.periods?.[0]?.regions?.central?.text || "";
    const rainAdjustment = getRainAdjustmentFromForecast(currentForecast);
    renderDetail(detail, rainAdjustment);
    renderRainTimeline(neaForecast, region);
    els.rainUpdated.textContent = formatUpdatedLabel(neaForecast.updatedTimestamp, "NEA updated");
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
  if (button) {
    persistSelectedUid(button.dataset.uid);
    renderStations();
    await refresh();
    return;
  }
});

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
