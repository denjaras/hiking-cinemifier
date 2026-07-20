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
const debugToggleBtn = document.getElementById("debugToggle");
const debugBodyEl = document.getElementById("debugBody");
const debugStateEl = document.getElementById("debugState");
const debugDistancesEl = document.getElementById("debugDistances");
const debugLogEl = document.getElementById("debugLog");

debugToggleBtn.addEventListener("click", () => {
  const wasHidden = debugBodyEl.hidden;
  debugBodyEl.hidden = !wasHidden;
  debugToggleBtn.textContent = wasHidden ? "Debug ▴" : "Debug ▾";
});

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
  renderDebugDistances(latitude, longitude);

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

// --- Proximity audio (state-machine driven) ----------------------------------
// Exactly one POI's track plays at a time. Zone membership is tracked
// explicitly (entered / staying / left) instead of re-derived from raw
// distance on every GPS tick, so GPS jitter can't cause repeat-triggering
// or overlapping tracks.
const AUDIO_ENTER_RADIUS_M = 35; // must be at least this close to trigger entry
const AUDIO_EXIT_RADIUS_M = 50;  // must move at least this far to count as "left"
// The gap between enter/exit radii is a hysteresis buffer: phone GPS commonly
// drifts 10-20m in the mountains, so a single radius would flicker in/out
// right at the boundary and re-trigger the same track over and over.

const AUDIO_CACHE_NAME = "poi-audio-cache-v1";

let poiAudios = [];
let audioUnlocked = false;
let currentPoi = null; // POI we are currently considered "inside" of
let outroPoi = null;   // POI whose track is finishing after we left its zone

// --- Debug panel (in-field HUD, no console needed) ---------------------------
const DEBUG_LOG_MAX = 30;

function logDebugEvent(message) {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const li = document.createElement("li");
  li.innerHTML = `<span class="debug-log-time">${time}</span>${message}`;
  debugLogEl.prepend(li);
  while (debugLogEl.children.length > DEBUG_LOG_MAX) {
    debugLogEl.removeChild(debugLogEl.lastChild);
  }
}

function renderDebugState() {
  if (currentPoi) {
    debugStateEl.textContent = `INSIDE — ${currentPoi.name}`;
  } else if (outroPoi) {
    debugStateEl.textContent = `OUTRO — ${outroPoi.name}`;
  } else {
    debugStateEl.textContent = "SILENT";
  }
}

function renderDebugDistances(userLat, userLng) {
  debugDistancesEl.innerHTML = "";
  poiAudios.forEach((poiAudio) => {
    const d = distanceToPoi(userLat, userLng, poiAudio);
    const li = document.createElement("li");
    li.textContent = `${poiAudio.name}: ${d.toFixed(1)} m`;
    if (poiAudio === currentPoi || poiAudio === outroPoi) {
      li.classList.add("debug-current");
    }
    debugDistancesEl.appendChild(li);
  });
}

// --- Preload: fetch every POI's audio fully before the hike starts, so
// playback afterwards comes from an in-memory Blob (and, where supported, a
// Cache Storage entry) and is immune to spotty signal out on the trail.
const audioBlobCache = new Map(); // original path -> blob: object URL (or null on failure)

async function cacheStorageGet(url) {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cached = await cache.match(url);
    return cached ? await cached.blob() : null;
  } catch (_) {
    return null; // Cache Storage unavailable (file://, private mode, etc.)
  }
}

async function cacheStoragePut(url, blob) {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.put(
      url,
      new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg" } })
    );
  } catch (_) {
    // Non-fatal — preload still works via the in-memory blob for this session.
  }
}

// Resolve one audio path to a fully-downloaded blob: URL, reusing a prior
// Cache Storage copy if we have one so re-visits don't need the network at all.
async function preloadAudioFile(url) {
  if (audioBlobCache.has(url)) return audioBlobCache.get(url);

  const cachedBlob = await cacheStorageGet(url);
  if (cachedBlob) {
    const objectUrl = URL.createObjectURL(cachedBlob);
    audioBlobCache.set(url, objectUrl);
    return objectUrl;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    audioBlobCache.set(url, objectUrl);
    cacheStoragePut(url, blob); // fire-and-forget
    return objectUrl;
  } catch (err) {
    console.error(`Audio preload failed for "${url}":`, err);
    audioBlobCache.set(url, null); // remember the failure; caller falls back to streaming
    return null;
  }
}

// Preload every distinct audio file, reporting progress via setStatus().
async function preloadAllPoiAudio(urls) {
  const unique = Array.from(new Set(urls));
  if (!unique.length) return;

  let done = 0;
  setStatus(`Preparing offline audio… (0/${unique.length})`);
  await Promise.all(
    unique.map((url) =>
      preloadAudioFile(url).finally(() => {
        done++;
        setStatus(`Preparing offline audio… (${done}/${unique.length})`);
      })
    )
  );
}

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

function distanceToPoi(userLat, userLng, poiAudio) {
  return distanceMeters(userLat, userLng, poiAudio.lat, poiAudio.lng);
}

function stopPoiAudioHard(poiAudio) {
  if (!poiAudio) return;
  poiAudio.audioEl.pause();
  poiAudio.audioEl.currentTime = 0;
}

function playPoiAudioOnce(poiAudio) {
  poiAudio.audioEl.volume = 1;
  poiAudio.audioEl.currentTime = 0;
  poiAudio.audioEl.play().catch(() => {
    // Autoplay may still be blocked until a user gesture unlocks it.
  });
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

// Core state-transition logic. Called on every GPS fix, but only *acts* on
// enter/leave transitions — staying inside or outside an area is a no-op.
//
//   OUTSIDE -> INSIDE (enter): stop whatever was playing, play the new
//                              spot's track once, from the start.
//   INSIDE  -> INSIDE (stay):  do nothing, even if the track already
//                              finished playing (no looping).
//   INSIDE  -> OUTSIDE (exit): let the current track finish on its own,
//                              then go silent until the next entry.
function updatePoiAudio(userLat, userLng) {
  // 1) Are we still inside the POI we were last considered "inside" of?
  //    Uses the wider exit radius so GPS noise near the boundary doesn't
  //    flip us in and out repeatedly.
  let stillInsideCurrent = false;
  if (currentPoi) {
    stillInsideCurrent = distanceToPoi(userLat, userLng, currentPoi) <= AUDIO_EXIT_RADIUS_M;
  }

  if (stillInsideCurrent) {
    // Staying in the same area: never retrigger.
    return;
  }

  // 2) We've left currentPoi's zone (or had none). Find the closest POI
  //    we're newly within entry range of.
  let nearest = null;
  let nearestDist = Infinity;
  poiAudios.forEach((poiAudio) => {
    const d = distanceToPoi(userLat, userLng, poiAudio);
    if (d <= AUDIO_ENTER_RADIUS_M && d < nearestDist) {
      nearest = poiAudio;
      nearestDist = d;
    }
  });

  if (nearest && nearest !== currentPoi) {
    // Entering a (different) area: cut off anything still playing —
    // whichever spot it belonged to — then trigger this spot's track once.
    stopPoiAudioHard(currentPoi);
    stopPoiAudioHard(outroPoi);
    outroPoi = null;
    currentPoi = nearest;
    playPoiAudioOnce(currentPoi);
    logDebugEvent(`ENTER ${currentPoi.name} (${nearestDist.toFixed(1)}m)`);
    renderDebugState();
    return;
  }

  if (!nearest && currentPoi) {
    // Left every area with nothing new to enter: let the current track keep
    // playing to its natural end (no cut, no restart), then go silent.
    logDebugEvent(`EXIT ${currentPoi.name} → OUTRO`);
    outroPoi = currentPoi;
    currentPoi = null;
    renderDebugState();
  }
}

function stopAllPoiAudio() {
  poiAudios.forEach((poiAudio) => stopPoiAudioHard(poiAudio));
  currentPoi = null;
  outroPoi = null;
  renderDebugState();
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
    // Use the fully-preloaded blob: URL when we have one (offline-safe);
    // fall back to the original path (streamed) if preloading failed.
    const src = audioBlobCache.get(poi.audio) || poi.audio;
    const audioEl = new Audio(src);
    audioEl.loop = false; // single-shot; updatePoiAudio()'s state machine
                          // decides if/when it plays again
    audioEl.preload = "auto";
    audioEl.volume = 0;

    const poiAudioEntry = {
      lat: poi.lat,
      lng: poi.lng,
      name: poi.name,
      audioEl,
    };
    poiAudios.push(poiAudioEntry);

    // Once an outro track finishes on its own, the state is truly silent —
    // clear the pointer so the debug panel reflects that instead of showing
    // a stale "OUTRO" for a track that has already stopped.
    audioEl.addEventListener("ended", () => {
      if (outroPoi === poiAudioEntry) {
        outroPoi = null;
        logDebugEvent(`Track ended: ${poiAudioEntry.name} → SILENT`);
        renderDebugState();
      }
    });
  }
});
}

// Read trail data embedded via the trails/*.gpx.js scripts. This loads straight
// from the repo and works over file:// (no fetch / web server needed).
async function loadTrails() {
  const entries = window.TRAIL_DATA || [];

  trailListEl.innerHTML = "";
  if (!entries.length) {
    trailListEl.innerHTML = '<li class="trail-empty">No trails listed.</li>';
    return;
  }

  // Preload every POI's audio file fully before wiring anything up, so the
  // whole soundscape is already in memory (and, where supported, in Cache
  // Storage) by the time the hiker sets off with no signal.
  const audioUrls = [];
  entries.forEach((entry) =>
    (entry.pois || []).forEach((poi) => {
      if (poi.audio) audioUrls.push(poi.audio);
    })
  );

  startBtn.disabled = true;
  try {
    await preloadAllPoiAudio(audioUrls);
  } finally {
    startBtn.disabled = false;
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

  setStatus('Audio ready. Tap "Locate me" to start tracking.');
  renderDebugState();
}

loadTrails();
