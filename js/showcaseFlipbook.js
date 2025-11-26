// assets/js/showcaseFlipbook.js
// Showcase + flip-style viewer for department magazines

let magazines = [];
let filteredMagazines = [];
let currentPdf = null;
let currentIssue = null;
let currentPage = 1;

const showcaseGrid = document.getElementById("showcaseGrid");
const showcaseStatus = document.getElementById("showcaseStatus");
const searchInput = document.getElementById("searchInput");

const titleElement = document.getElementById("currentTitle");
const metaElement = document.getElementById("currentMeta");
const viewerErrorElement = document.getElementById("viewerError");
const pageInfoElement = document.getElementById("pageInfo");

const canvasLeft = document.getElementById("pageLeft");
const canvasRight = document.getElementById("pageRight");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const openPdfLink = document.getElementById("openPdfLink");
const downloadPdfLink = document.getElementById("downloadPdfLink");

const yearSpan = document.getElementById("yearSpan");

// Footer year
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

// PDF.js worker
if (window["pdfjsLib"]) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.js";
} else {
  console.error("PDF.js not loaded.");
}

function clearViewer(message = "Select a magazine to view") {
  currentPdf = null;
  currentIssue = null;
  currentPage = 1;

  titleElement.textContent = message;
  metaElement.textContent = "";
  viewerErrorElement.textContent = "";
  pageInfoElement.textContent = "No magazine loaded";

  const ctxLeft = canvasLeft.getContext("2d");
  const ctxRight = canvasRight.getContext("2d");
  ctxLeft.clearRect(0, 0, canvasLeft.width, canvasLeft.height);
  ctxRight.clearRect(0, 0, canvasRight.width, canvasRight.height);

  prevBtn.disabled = true;
  nextBtn.disabled = true;
  disablePdfLinks();
}

function enablePdfLinks(issue) {
  if (!issue || !issue.file) {
    disablePdfLinks();
    return;
  }
  openPdfLink.href = issue.file;
  downloadPdfLink.href = issue.file;
  openPdfLink.classList.remove("disabled");
  downloadPdfLink.classList.remove("disabled");
  openPdfLink.setAttribute("aria-disabled", "false");
  downloadPdfLink.setAttribute("aria-disabled", "false");
}

function disablePdfLinks() {
  openPdfLink.href = "#";
  downloadPdfLink.href = "#";
  openPdfLink.classList.add("disabled");
  downloadPdfLink.classList.add("disabled");
  openPdfLink.setAttribute("aria-disabled", "true");
  downloadPdfLink.setAttribute("aria-disabled", "true");
}

// Load magazines.json
async function loadMagazines() {
  try {
    showcaseStatus.textContent = "Loading magazines…";
    const res = await fetch("data/magazines.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("magazines.json must contain an array.");
    }

    magazines = data.sort(
      (a, b) => (b.year || 0) - (a.year || 0) || String(b.id).localeCompare(String(a.id))
    );
    filteredMagazines = [...magazines];

    showcaseStatus.textContent =
      magazines.length > 0 ? `${magazines.length} issues loaded.` : "No issues found.";

    renderShowcase();

    // Load from URL hash if present
    const initialId = window.location.hash.replace("#", "").trim();
    if (initialId) {
      const match = magazines.find((m) => String(m.id) === initialId);
      if (match) {
        loadIssue(match);
        return;
      }
    }

    // Optionally auto-open latest issue
    if (magazines.length > 0) {
      loadIssue(magazines[0]);
    } else {
      clearViewer();
    }
  } catch (err) {
    console.error("Error loading magazines:", err);
    showcaseStatus.textContent = "Error loading magazines list.";
    clearViewer("Unable to load magazine list");
  }
}

function renderShowcase() {
  showcaseGrid.innerHTML = "";

  filteredMagazines.forEach((issue) => {
    const card = document.createElement("article");
    card.className = "showcase-card";
    card.dataset.id = issue.id;

    const cover = document.createElement("div");
    cover.className = "showcase-card__cover";

    if (issue.coverImage) {
      const img = document.createElement("img");
      img.src = issue.coverImage;
      img.alt = issue.title || "Magazine cover";
      cover.appendChild(img);
    } else {
      // Text fallback
      const label = document.createElement("span");
      label.textContent = (issue.month || "") + " " + (issue.year || "");
      cover.appendChild(label);
    }

    const body = document.createElement("div");
    body.className = "showcase-card__body";

    const title = document.createElement("h3");
    title.className = "showcase-card__title";
    title.textContent = issue.title || issue.id || "Untitled";

    const meta = document.createElement("p");
    meta.className = "showcase-card__meta";
    const year = issue.year ? String(issue.year) : "Unknown year";
    const month = issue.month || "Unknown month";
    meta.textContent = `${month} ${year}`;

    body.appendChild(title);
    body.appendChild(meta);

    card.appendChild(cover);
    card.appendChild(body);

    card.addEventListener("click", () => loadIssue(issue));

    showcaseGrid.appendChild(card);
  });

  if (filteredMagazines.length === 0) {
    showcaseStatus.textContent = "No magazines match your search.";
  } else {
    showcaseStatus.textContent = `${filteredMagazines.length} issue(s) shown.`;
  }

  highlightActiveCard();
}

function highlightActiveCard() {
  const cards = showcaseGrid.querySelectorAll(".showcase-card");
  cards.forEach((card) => {
    if (currentIssue && card.dataset.id === String(currentIssue.id)) {
      card.classList.add("showcase-card--active");
    } else {
      card.classList.remove("showcase-card--active");
    }
  });
}

// Load + show a magazine
async function loadIssue(issue) {
  if (!issue || !issue.file) {
    viewerErrorElement.textContent = "Selected magazine is missing a PDF file path.";
    return;
  }

  clearViewer("Loading magazine…");
  viewerErrorElement.textContent = "";

  currentIssue = issue;
  currentPage = 1;

  if (issue.id) {
    history.replaceState(null, "", `#${issue.id}`);
  }

  titleElement.textContent = issue.title || "Magazine";
  const year = issue.year ? String(issue.year) : "Unknown year";
  const month = issue.month || "Unknown month";
  const desc = issue.description || "";
  metaElement.textContent = `${month} ${year}${desc ? " – " + desc : ""}`;

  highlightActiveCard();

  try {
    currentPdf = await pdfjsLib.getDocument(issue.file).promise;
    enablePdfLinks(issue);

    if (!currentPdf.numPages || currentPdf.numPages < 1) {
      throw new Error("PDF has no pages.");
    }

    await renderSpread(currentPage);
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  } catch (err) {
    console.error("Error loading PDF:", err);
    viewerErrorElement.textContent =
      "Unable to load this magazine. Please verify the PDF file path.";
    clearViewer("Unable to load selected magazine");
  }
}

// Render a double-page spread
async function renderSpread(pageNumber) {
  if (!currentPdf) return;

  const total = currentPdf.numPages;
  const leftPage = pageNumber;
  const rightPage = pageNumber + 1;

  pageInfoElement.textContent = `Pages ${leftPage}${
    rightPage <= total ? "–" + rightPage : ""
  } of ${total}`;

  viewerErrorElement.textContent = "";

  await renderPageToCanvas(leftPage, canvasLeft);

  if (rightPage <= total) {
    canvasRight.style.display = "block";
    await renderPageToCanvas(rightPage, canvasRight);
  } else {
    const ctxRight = canvasRight.getContext("2d");
    ctxRight.clearRect(0, 0, canvasRight.width, canvasRight.height);
    canvasRight.style.display = "none";
  }

  prevBtn.disabled = leftPage <= 1;
  nextBtn.disabled = rightPage > total;
}

async function renderPageToCanvas(pageNumber, canvas) {
  try {
    const page = await currentPdf.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });

    const maxWidth = 400;
    const maxHeight = 520;
    const scale = Math.min(
      maxWidth / unscaledViewport.width,
      maxHeight / unscaledViewport.height
    );

    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch (err) {
    console.error(`Error rendering page ${pageNumber}:`, err);
    viewerErrorElement.textContent =
      "Error rendering one of the pages in this magazine.";
  }
}

// Navigation
prevBtn.addEventListener("click", () => {
  if (!currentPdf) return;
  if (currentPage > 1) {
    currentPage = Math.max(1, currentPage - 2); // flip back 2 pages
    renderSpread(currentPage);
  }
});

nextBtn.addEventListener("click", () => {
  if (!currentPdf) return;
  const total = currentPdf.numPages;
  if (currentPage + 1 < total) {
    currentPage = currentPage + 2; // flip forward 2 pages
    renderSpread(currentPage);
  }
});

// Search
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    filteredMagazines = [...magazines];
    renderShowcase();
    return;
  }

  filteredMagazines = magazines.filter((issue) => {
    const haystack =
      `${issue.title || ""} ${issue.month || ""} ${issue.year || ""} ${
        issue.description || ""
      }`.toLowerCase();
    return haystack.includes(q);
  });

  renderShowcase();
});

// Init
document.addEventListener("DOMContentLoaded", loadMagazines);
