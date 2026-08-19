// content-youtube.js
// Runs on every youtube.com page. Watches the player for ad state and, while
// an ad is playing, shows an overlay and reads the next chunk of the user's
// uploaded lecture notes out loud using the browser's built-in TTS.
//
// AD DETECTION APPROACH
// YouTube adds the class "ad-showing" (and related ad-* classes) to the
// player element while an ad plays, and removes it when the ad ends. This is
// undocumented DOM behavior (no public API for this), so it can break if
// YouTube changes their markup. That's an accepted tradeoff for an MVP.
// We watch with a MutationObserver instead of polling.

const PLAYER_SELECTOR = "#movie_player";
const AD_INDICATOR_CLASS = "ad-showing";

let currentIndex = 0;
let notesChunks = [];
let isReading = false;
let overlayEl = null;

async function loadNotes() {
  const { lectureNotes = [] } = await chrome.storage.local.get("lectureNotes");
  notesChunks = lectureNotes;
}

// Reload notes whenever the popup saves new ones, without needing a page refresh.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.lectureNotes) {
    notesChunks = changes.lectureNotes.newValue || [];
  }
});

function buildOverlay() {
  const el = document.createElement("div");
  el.id = "lecture-ad-overlay";
  el.innerHTML = `
    <div class="lac-header">📚 Lecture notes (ad break)</div>
    <div class="lac-text" id="lac-text"></div>
    <div class="lac-controls">
      <button id="lac-pause">Pause</button>
      <button id="lac-skip">Skip section</button>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector("#lac-pause").addEventListener("click", () => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
    } else if (speechSynthesis.paused) {
      speechSynthesis.resume();
    }
  });

  el.querySelector("#lac-skip").addEventListener("click", () => {
    speechSynthesis.cancel();
    currentIndex = (currentIndex + 1) % Math.max(notesChunks.length, 1);
    speakCurrentChunk();
  });

  return el;
}

function showOverlay() {
  if (!overlayEl) overlayEl = buildOverlay();
  overlayEl.classList.add("lac-visible");
}

function hideOverlay() {
  if (overlayEl) overlayEl.classList.remove("lac-visible");
}

function speakCurrentChunk() {
  if (!notesChunks.length) {
    setOverlayText("No lecture notes uploaded yet. Click the extension icon to upload a PDF.");
    return;
  }
  const text = notesChunks[currentIndex];
  setOverlayText(text);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.onend = () => {
    currentIndex = (currentIndex + 1) % notesChunks.length;
  };
  speechSynthesis.cancel(); // stop anything queued
  speechSynthesis.speak(utterance);
}

function setOverlayText(text) {
  const target = document.getElementById("lac-text");
  if (target) target.textContent = text;
}

function startReading() {
  if (isReading) return;
  isReading = true;
  showOverlay();
  speakCurrentChunk();
}

function stopReading() {
  if (!isReading) return;
  isReading = false;
  speechSynthesis.cancel();
  hideOverlay();
}

function isAdShowing(player) {
  if (!player) return false;
  return player.classList.contains(AD_INDICATOR_CLASS);
}

function watchPlayer() {
  const player = document.querySelector(PLAYER_SELECTOR);
  if (!player) {
    // Player not mounted yet (SPA navigation) — retry shortly.
    setTimeout(watchPlayer, 1000);
    return;
  }

  const observer = new MutationObserver(() => {
    if (isAdShowing(player)) {
      startReading();
    } else {
      stopReading();
    }
  });

  observer.observe(player, { attributes: true, attributeFilter: ["class"] });

  // Handle case where an ad is already playing when the script attaches.
  if (isAdShowing(player)) startReading();
}

loadNotes().then(watchPlayer);
