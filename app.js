// --- Map setup ---------------------------------------------------------------
// Default region: Austria (centered, country-level zoom).
const AUSTRIA = { center: [47.5162, 14.5501], zoom: 7 };

const map = L.map("map", { zoomControl: true }).setView(AUSTRIA.center, AUSTRIA.zoom);

// OpenTopoMap: topographic basemap with contour lines, relief and trails —
// well suited for hiking. Max zoom is 17 on their servers.
L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
  maxZoom: 17,
  // OSM-based tile servers require a Referer header. Some browsers strip it
  // by default for cross-origin image requests, so we set an explicit policy
  // that keeps the Referer when the destination is at least as secure.
  referrerPolicy: "no-referrer-when-downgrade",
  attribution:
    'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
    '<a href="http://viewfinderpanoramas.org">SRTM</a> | ' +
    'Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> ' +
    '(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
}).addTo(map);

// --- DOM refs ----------------------------------------------------------------
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const recenterBtn = document.getElementById("recenterBtn");
const latEl = document.getElementById("lat");
const lngEl = document.getElementById("lng");
const accEl = document.getElementById("acc");
const speedEl = document.getElementById("speed");
const headingEl = document.getElementById("heading");

// --- State -------------------------------------------------------------------
let watchId = null;
let marker = null;      // position dot
let accuracyCircle = null; // accuracy radius
let autoRecenter = true; // follow the user like GPS until they pan away

// Point-of-interest marker icon
const poiIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;' +
    "background:#e8590c;border:2px solid #fff;transform:rotate(-45deg);" +
    'box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 16],
});

// Custom blue location dot
const dotIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2d7ff9;border:3px solid #fff;box-shadow:0 0 0 2px rgba(45,127,249,0.5);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// --- Helpers -----------------------------------------------------------------
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", isError);
}

function fmt(value, digits = 5) {
  return value === null || value === undefined || Number.isNaN(value)
    ? "—"
    : value.toFixed(digits);
}

function updateReadout(coords) {
  latEl.textContent = fmt(coords.latitude);
  lngEl.textContent = fmt(coords.longitude);
  accEl.textContent = coords.accuracy != null ? `${Math.round(coords.accuracy)} m` : "—";
  speedEl.textContent =
    coords.speed != null && !Number.isNaN(coords.speed)
      ? `${(coords.speed * 3.6).toFixed(1)} km/h`
      : "—";
  headingEl.textContent =
    coords.heading != null && !Number.isNaN(coords.heading)
      ? `${Math.round(coords.heading)}°`
      : "—";
}

// --- Geolocation callbacks ---------------------------------------------------
function onPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const latlng = [latitude, longitude];

  setStatus("Tracking live position…");
  updateReadout(pos.coords);
  updatePoiAudio(latitude, longitude);

  if (!marker) {
    marker = L.marker(latlng, { icon: dotIcon }).addTo(map);
    accuracyCircle = L.circle(latlng, {
      radius: accuracy,
      color: "#2d7ff9",
      fillColor: "#2d7ff9",
      fillOpacity: 0.12,
      weight: 1,
    }).addTo(map);
    map.setView(latlng, 17);
    recenterBtn.disabled = false;
  } else {
    marker.setLatLng(latlng);
    accuracyCircle.setLatLng(latlng).setRadius(accuracy);
    if (autoRecenter) map.panTo(latlng);
  }
}

function onError(err) {
  const messages = {
    1: "Permission denied. Allow location access and try again.",
    2: "Position unavailable. Check your device's location services.",
    3: "Location request timed out. Retrying…",
  };
  setStatus(messages[err.code] || `Location error: ${err.message}`, true);
}

// --- Tracking control --------------------------------------------------------
function startTracking() {
  unlockPoiAudio();
  if (!("geolocation" in navigator)) {
    setStatus("Geolocation is not supported by this browser.", true);
    return;
  }

  setStatus("Requesting location permission…");
  startBtn.hidden = true;
  stopBtn.hidden = false;

  // watchPosition gives continuous, GPS-like updates.
  watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }
  if (accuracyCircle) {
    map.removeLayer(accuracyCircle);
    accuracyCircle = null;
  }
  autoRecenter = true;
  updateReadout({});
  stopAllPoiAudio();
  setStatus('Tracking stopped. Tap "Locate me" to start again.');
  stopBtn.hidden = true;
  startBtn.hidden = false;
}

// Stop following when the user drags the map; resume via Recenter.
map.on("dragstart", () => {
  autoRecenter = false;
});

recenterBtn.addEventListener("click", () => {
  autoRecenter = true;
  // Center on the live position if we have one, otherwise fall back to Austria.
  if (marker) {
    map.setView(marker.getLatLng(), 17);
  } else {
    map.setView(AUSTRIA.center, AUSTRIA.zoom);
  }
});

startBtn.addEventListener("click", startTracking);
stopBtn.addEventListener("click", stopTracking);

// --- Trails (GPX) ------------------------------------------------------------
const trailListEl = document.getElementById("trailList");
const modalEl = document.getElementById("trailModal");
const modalTitleEl = document.getElementById("trailModalTitle");
const modalMetaEl = document.getElementById("trailModalMeta");
const modalDescEl = document.getElementById("trailModalDesc");
const modalStartBtn = document.getElementById("trailModalStart");
const modalCloseBtn = document.getElementById("trailModalClose");

const TRAIL_STYLE = { color: "#3478c6", weight: 4, opacity: 0.85 };
const TRAIL_STYLE_SELECTED = { color: "#e8590c", weight: 6, opacity: 1 };

let trails = [];          // { name, layer, listItem }
let selectedTrail = null;

// --- Proximity audio ---------------------------------------------------------
const AUDIO_START_DISTANCE_M = 20; // Music starts within this distance
const AUDIO_FULL_VOLUME_DISTANCE_M = 5; // Full volume within this distance
const AUDIO_FADE_STEP = 0.05;        // volume decrease per fade tick
const AUDIO_FADE_INTERVAL_MS = 50;  // ms between fade ticks (~20 steps = ~1 s)

let poiAudios = [];
let audioUnlocked = false;

// Parse a GPX document into an array of { name, coords:[[lat,lng],...] } tracks.
function parseGpx(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid GPX file.");

  return Array.from(doc.querySelectorAll("trk")).map((trk, i) => {
    const name = trk.querySelector("name")?.textContent?.trim() || `Trail ${i + 1}`;
    const coords = Array.from(trk.querySelectorAll("trkpt")).map((pt) => [
      parseFloat(pt.getAttribute("lat")),
      parseFloat(pt.getAttribute("lon")),
    ]);
    return { name, coords };
  });
}

function selectTrail(trail) {
  if (selectedTrail) {
    selectedTrail.layer.setStyle(TRAIL_STYLE);
    selectedTrail.listItem.classList.remove("active");
  }
  selectedTrail = trail;
  trail.layer.setStyle(TRAIL_STYLE_SELECTED).bringToFront();
  trail.listItem.classList.add("active");
  autoRecenter = false; // looking at a trail, stop following the GPS dot
  map.fitBounds(trail.layer.getBounds(), { padding: [30, 30] });
  openTrailModal(trail);
}

function openTrailModal(trail) {
  modalTitleEl.textContent = trail.name;
  modalMetaEl.textContent = `${trail.distanceKm.toFixed(1)} km`;
  modalDescEl.textContent = trail.description;
  modalEl.hidden = false;
}

function closeTrailModal() {
  modalEl.hidden = true;
}

modalCloseBtn.addEventListener("click", closeTrailModal);

// "Start" mirrors the "Locate me" button: begin live tracking and follow the
// user's position, recentering on them once a fix arrives.
modalStartBtn.addEventListener("click", () => {
  unlockPoiAudio();

  autoRecenter = true;
  closeTrailModal();
  if (marker) {
    // Already have a fix — recenter on the user immediately.
    map.setView(marker.getLatLng(), 17);
  } else if (watchId === null) {
    startTracking();
  }
});

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;

  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function volumeFromDistance(distanceM) {
  if (distanceM >= AUDIO_START_DISTANCE_M) return 0;
  if (distanceM <= AUDIO_FULL_VOLUME_DISTANCE_M) return 1;

  const range = AUDIO_START_DISTANCE_M - AUDIO_FULL_VOLUME_DISTANCE_M;
  const closeness = (AUDIO_START_DISTANCE_M - distanceM) / range;

  return Math.max(0, Math.min(1, closeness));
}

function unlockPoiAudio() {
  if (audioUnlocked) return;

  poiAudios.forEach((poiAudio) => {
    const audio = poiAudio.audioEl;

    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        // Browser may still block audio until another user interaction.
      });
  });

  audioUnlocked = true;
}

function updatePoiAudio(userLat, userLng) {
  poiAudios.forEach((poiAudio) => {
    const distanceM = distanceMeters(
      userLat,
      userLng,
      poiAudio.lat,
      poiAudio.lng
    );
    const volume = volumeFromDistance(distanceM);

    if (volume > 0) {
      // In range: cancel any active fade, set volume directly, ensure playing.
      if (poiAudio.fadeTimer !== null) {
        clearInterval(poiAudio.fadeTimer);
        poiAudio.fadeTimer = null;
      }
      poiAudio.audioEl.volume = volume;
      if (poiAudio.audioEl.paused) {
        poiAudio.audioEl.play().catch(() => {});
      }
    } else if (poiAudio.fadeTimer === null && !poiAudio.audioEl.paused) {
      // Out of range and still playing: start a one-shot fade-out.
      poiAudio.fadeTimer = setInterval(() => {
        const next = Math.max(0, poiAudio.audioEl.volume - AUDIO_FADE_STEP);
        poiAudio.audioEl.volume = next;
        if (next === 0) {
          poiAudio.audioEl.pause();
          clearInterval(poiAudio.fadeTimer);
          poiAudio.fadeTimer = null;
        }
      }, AUDIO_FADE_INTERVAL_MS);
    }
  });
}

function stopAllPoiAudio() {
  poiAudios.forEach((poiAudio) => {
    if (poiAudio.fadeTimer !== null) {
      clearInterval(poiAudio.fadeTimer);
      poiAudio.fadeTimer = null;
    }
    poiAudio.audioEl.pause();
    poiAudio.audioEl.currentTime = 0;
    poiAudio.audioEl.volume = 0;
  });
}

// Great-circle distance (km) summed along a coordinate path.
function pathLengthKm(coords) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    const [la1, lo1] = coords[i - 1];
    const [la2, lo2] = coords[i];
    const dLat = rad(la2 - la1);
    const dLon = rad(lo2 - lo1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLon / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(a));
  }
  return km;
}

function addTrail(name, coords, description) {
  const layer = L.polyline(coords, TRAIL_STYLE).addTo(map);

  const listItem = document.createElement("li");
  const link = document.createElement("a");
  link.href = "#";
  link.className = "trail-link";
  link.textContent = name;
  listItem.appendChild(link);
  trailListEl.appendChild(listItem);

  const trail = {
    name,
    layer,
    listItem,
    description: description || "No description available for this trail yet.",
    distanceKm: pathLengthKm(coords),
  };
  trails.push(trail);

  link.addEventListener("click", (e) => {
    e.preventDefault();
    selectTrail(trail);
  });
  layer.on("click", () => selectTrail(trail));
  layer.bindTooltip(name, { sticky: true });
}

// Load one trail-data entry (embedded GPX string) into the map + list.
function loadEntry(entry) {
  const tracks = parseGpx(entry.gpx);
  tracks.forEach((track) => {
    // Use the entry's display name for single-track files; otherwise GPX names.
    const name = tracks.length === 1 && entry.name ? entry.name : track.name;
    addTrail(name, track.coords, entry.description);
  });

  // Points of interest along the trail.
  (entry.pois || []).forEach((poi) => {
  L.marker([poi.lat, poi.lng], { icon: poiIcon, title: poi.name })
    .addTo(map)
    .bindPopup(poi.name);

  if (poi.audio) {
    const audioEl = new Audio(poi.audio);
    audioEl.loop = true;
    audioEl.preload = "auto";
    audioEl.volume = 0;

    poiAudios.push({
      lat: poi.lat,
      lng: poi.lng,
      name: poi.name,
      audioEl,
      fadeTimer: null,
    });
  }
});
}

// Read trail data embedded via the trails/*.gpx.js scripts. This loads straight
// from the repo and works over file:// (no fetch / web server needed).
function loadTrails() {
  const entries = window.TRAIL_DATA || [];

  trailListEl.innerHTML = "";
  if (!entries.length) {
    trailListEl.innerHTML = '<li class="trail-empty">No trails listed.</li>';
    return;
  }

  // A single bad entry shouldn't hide the rest.
  entries.forEach((entry) => {
    try {
      loadEntry(entry);
    } catch (err) {
      console.error("Trail load failed:", err);
    }
  });

  if (!trails.length) {
    trailListEl.innerHTML = '<li class="trail-empty">No trails could be loaded.</li>';
    return;
  }

  // Frame all loaded trails so they're visible right away.
  const group = L.featureGroup(trails.map((t) => t.layer));
  map.fitBounds(group.getBounds(), { padding: [30, 30] });
}

loadTrails();
