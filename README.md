# Lecture Notes Ad Companion — MVP

A Chrome extension that reads your lecture notes out loud whenever a YouTube
ad starts playing, so ad breaks become study time.

## What this MVP does

- Upload a **PDF** of your lecture slides/notes via the popup.
- The extension extracts the text and splits it into ~40-word chunks
  (roughly one ad break's worth of speech each).
- On YouTube, a `MutationObserver` watches the video player for YouTube's
  `ad-showing` CSS class.
- When an ad starts: a small overlay appears and the browser's built-in
  `SpeechSynthesis` API reads the next chunk aloud. Pause/skip buttons included.
- When the ad ends: speech stops and the overlay hides.
- Progress through your notes persists across ad breaks (`currentIndex`
  advances each time a chunk finishes).

## What's intentionally NOT in the MVP (and why)

- **Netflix support.** Netflix's ad and video playback runs behind DRM
  (Widevine/PlayReady) inside an encrypted, sandboxed pipeline. There's no
  reliable DOM signal like YouTube's `ad-showing` class to detect ad state,
  and content scripts can't inspect the DRM'd video element. Supporting
  Netflix would likely require a different detection strategy (e.g. watching
  network request patterns, or Netflix may not expose ad breaks to
  third-party companies at all outside their own ad platform). Scope this
  out separately before investing time in it.
- **PPTX parsing.** Parsing `.pptx` client-side means unzipping the file and
  parsing its internal XML (it's a zip of XML files), which is more moving
  parts than an MVP needs. For now, ask users to export PowerPoint to PDF
  (File → Export → PDF) — `popup.js` already handles PDF text extraction via
  `pdf.js`. Real PPTX parsing (e.g. via a library like `pptx2json` or a
  small backend conversion step) is a good next iteration.
- **AI-generated audio/video.** This MVP uses the browser's free, built-in
  `speechSynthesis` API (robotic but zero-cost, zero-latency, no API key).
  Swapping in a real TTS API (ElevenLabs, OpenAI TTS, etc.) or actually
  generating short video clips is a clear v2 — the `background.js` service
  worker is already wired up as the place to make those external API calls
  from (content scripts have CSP restrictions that make external fetches
  awkward).
- **Ad-blocking or ad-skipping.** This extension does not block, skip, or
  modify the ad itself — it only detects that one is playing and shows
  content *alongside* it. Actually interfering with ad playback would
  violate YouTube's Terms of Service for extensions distributed on the
  Chrome Web Store.

## File structure

```
lecture-ad-extension/
├── manifest.json          # MV3 config
├── background.js          # service worker (message relay, future API calls)
├── content-youtube.js      # ad detection + speech playback on youtube.com
├── overlay.css             # styling for the on-page overlay
├── popup.html / popup.js / popup.css   # upload UI + PDF parsing
└── lib/
    ├── pdf.min.js           # pdf.js (Mozilla), bundled for offline/CSP-safe use
    └── pdf.worker.min.js
```

## Running it locally

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this folder
4. Click the extension icon, upload a PDF of lecture notes
5. Go to youtube.com and play a video with ads — when an ad starts, the
   overlay should appear and start reading

## Known fragility (flag to Cursor / fix soon)

- **Ad detection is DOM-scraping, not an official API.** `content-youtube.js`
  depends on YouTube's `#movie_player` element having an `ad-showing` class.
  This is unofficial behavior and can break if YouTube changes their
  frontend. Worth adding a fallback detector (e.g. watching for the presence
  of `.ytp-ad-player-overlay` or the skip-ad button) so one signal breaking
  doesn't kill ad detection entirely.
- **No icons** are set in `manifest.json` — add `icons` field + PNGs before
  publishing to the Chrome Web Store (not required for local testing).
- **speechSynthesis voice quality** varies a lot by OS/browser. Consider
  letting the user pick a voice in the popup (`speechSynthesis.getVoices()`).
- **Chunking is word-count based**, not sentence-aware, so a chunk can cut
  off mid-sentence at an ad break boundary. Sentence-aware chunking (split on
  `. ` boundaries and only close a chunk once you're at/over the target word
  count) would sound more natural.

## Suggested next steps (roughly in priority order)

1. Test ad detection reliability across a bunch of real YouTube ad breaks.
2. Sentence-aware chunking.
3. Voice picker in the popup.
4. PPTX support (unzip + parse `ppt/slides/slideN.xml`, pull `<a:t>` text runs).
5. Swap `speechSynthesis` for a higher-quality TTS API via `background.js`.
6. Investigate Netflix feasibility as a separate spike — don't assume it's
   possible until you've tested ad-state detection there directly.
