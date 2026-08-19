// background.js
// MV3 service worker. For the MVP this just centralizes storage access and
// logging so it's easy to bolt on real TTS APIs, sync, etc. later without
// touching the content script's DOM logic.

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Lecture Ad Companion] installed");
});

// Simple message relay in case content script wants background to do work
// (e.g. calling an external TTS/summarization API instead of the browser's
// built-in SpeechSynthesis). Not used yet in the MVP but wired up so Cursor
// can extend it without restructuring.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true });
  }
  return true;
});
