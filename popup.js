// popup.js
// Extracts text from an uploaded PDF (client-side, via pdf.js) and splits it
// into short chunks sized for a typical ad break (~15-30s of speech each).
// Chunks are saved to chrome.storage.local and read by content-youtube.js.

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.min.js");

const WORDS_PER_CHUNK = 40; // roughly 15-20 seconds of TTS at normal rate

const fileInput = document.getElementById("file-input");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("chunk-preview");

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setStatus(`Reading ${file.name}...`, "");

  try {
    const text = await extractTextFromPdf(file);
    const chunks = chunkText(text, WORDS_PER_CHUNK);

    if (!chunks.length) {
      setStatus("Couldn't find any text in that PDF. Is it scanned images?", "error");
      return;
    }

    await chrome.storage.local.set({ lectureNotes: chunks });
    setStatus(`Loaded ${chunks.length} sections from ${file.name}. Go watch a video!`, "success");
    renderPreview(chunks);
  } catch (err) {
    console.error(err);
    setStatus("Something went wrong reading that PDF.", "error");
  }
});

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n\n";
  }
  return fullText.trim();
}

function chunkText(text, wordsPerChunk) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
}

function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = cls;
}

function renderPreview(chunks) {
  previewEl.innerHTML = chunks
    .slice(0, 5)
    .map((c, i) => `<div class="chunk-item"><strong>#${i + 1}</strong> ${escapeHtml(c)}</div>`)
    .join("");
  if (chunks.length > 5) {
    previewEl.innerHTML += `<div class="chunk-item">…and ${chunks.length - 5} more</div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Show existing notes on popup open, if any.
(async function init() {
  const { lectureNotes = [] } = await chrome.storage.local.get("lectureNotes");
  if (lectureNotes.length) {
    setStatus(`${lectureNotes.length} sections currently loaded.`, "success");
    renderPreview(lectureNotes);
  }
})();
