const STORAGE_KEY = "expirywise-products";
const REMINDER_DAYS = 14;

const sampleLookup = {
  "639277543210": {
    name: "Apple Cinnamon Granola Bars",
    category: "Snacks",
    location: "Snack aisle"
  },
  "874220145611": {
    name: "Shelf Stable Almond Milk",
    category: "Beverage",
    location: "Beverage wall"
  },
  "051933210904": {
    name: "Chicken Noodle Soup",
    category: "Pantry",
    location: "Soup shelf"
  }
};

let products = loadProducts();
let scanStream = null;
let scanTimer = null;

const els = {
  activeCount: document.querySelector("#activeCount"),
  category: document.querySelector("#category"),
  clearHandledBtn: document.querySelector("#clearHandledBtn"),
  expiredCount: document.querySelector("#expiredCount"),
  expiryDate: document.querySelector("#expiryDate"),
  exportBtn: document.querySelector("#exportBtn"),
  form: document.querySelector("#productForm"),
  importInput: document.querySelector("#importInput"),
  inventoryBody: document.querySelector("#inventoryBody"),
  location: document.querySelector("#location"),
  name: document.querySelector("#name"),
  notes: document.querySelector("#notes"),
  notifyBtn: document.querySelector("#notifyBtn"),
  quantity: document.querySelector("#quantity"),
  scanBtn: document.querySelector("#scanBtn"),
  scanVideo: document.querySelector("#scanVideo"),
  searchInput: document.querySelector("#searchInput"),
  seedBtn: document.querySelector("#seedBtn"),
  soonCount: document.querySelector("#soonCount"),
  statusFilter: document.querySelector("#statusFilter"),
  stopScanBtn: document.querySelector("#stopScanBtn"),
  timeline: document.querySelector("#timeline"),
  todayLabel: document.querySelector("#todayLabel"),
  upc: document.querySelector("#upc")
};

els.todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
}).format(new Date());

els.form.addEventListener("submit", saveProduct);
els.searchInput.addEventListener("input", render);
els.statusFilter.addEventListener("change", render);
els.upc.addEventListener("change", () => fillFromLookup(els.upc.value.trim()));
els.seedBtn.addEventListener("click", loadDemo);
els.clearHandledBtn.addEventListener("click", clearHandled);
els.exportBtn.addEventListener("click", exportProducts);
els.importInput.addEventListener("change", importProducts);
els.notifyBtn.addEventListener("click", requestNotifications);
els.scanBtn.addEventListener("click", startScan);
els.stopScanBtn.addEventListener("click", stopScan);

render();

function saveProduct(event) {
  event.preventDefault();

  const formData = new FormData(els.form);
  const product = {
    id: crypto.randomUUID(),
    upc: String(formData.get("upc") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "Pantry"),
    location: String(formData.get("location") || "").trim(),
    quantity: Number(formData.get("quantity") || 1),
    expiryDate: String(formData.get("expiryDate")),
    notes: String(formData.get("notes") || "").trim(),
    handled: false,
    createdAt: new Date().toISOString()
  };

  products = [product, ...products];
  persist();
  els.form.reset();
  els.quantity.value = 1;
  showToast(`${product.name} is now tracked.`);
  render();
}

function fillFromLookup(upc) {
  const match = sampleLookup[upc];
  if (!match) return;

  els.name.value = match.name;
  els.category.value = match.category;
  els.location.value = match.location;
  showToast("Product details filled from the demo UPC lookup.");
}

async function startScan() {
  if (!("BarcodeDetector" in window)) {
    showToast("This browser does not support live barcode scanning yet. Enter the UPC manually.");
    return;
  }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    els.scanVideo.srcObject = scanStream;
    els.scanVideo.hidden = false;
    els.stopScanBtn.hidden = false;
    await els.scanVideo.play();

    const detector = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
    });

    scanTimer = window.setInterval(async () => {
      const codes = await detector.detect(els.scanVideo);
      if (!codes.length) return;

      const value = codes[0].rawValue;
      els.upc.value = value;
      fillFromLookup(value);
      stopScan();
      showToast(`Scanned ${value}.`);
    }, 650);
  } catch (error) {
    showToast("Camera access was not available. Manual entry is ready.");
  }
}

function stopScan() {
  window.clearInterval(scanTimer);
  scanTimer = null;
  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop());
  }
  scanStream = null;
  els.scanVideo.hidden = true;
  els.stopScanBtn.hidden = true;
}

function render() {
  const filtered = getFilteredProducts();
  renderCounts();
  renderTimeline(filtered);
  renderTable(filtered);
  maybeShowReminder();
}

function renderCounts() {
  const active = products.filter((product) => !product.handled);
  els.activeCount.textContent = active.length;
  els.expiredCount.textContent = active.filter((product) => getStatus(product).key === "expired").length;
  els.soonCount.textContent = active.filter((product) => getStatus(product).key === "soon").length;
}

function renderTimeline(items) {
  const queue = items
    .filter((product) => ["expired", "soon"].includes(getStatus(product).key) && !product.handled)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  els.timeline.innerHTML = "";
  if (!queue.length) {
    els.timeline.appendChild(emptyState("No markdown checks are due right now."));
    return;
  }

  queue.slice(0, 6).forEach((product) => {
    const status = getStatus(product);
    const expiry = parseDate(product.expiryDate);
    const row = document.createElement("article");
    row.className = "timeline-item";
    row.innerHTML = `
      <div class="date-badge">${expiry.getDate()}<small>${expiry.toLocaleString(undefined, { month: "short" })}</small></div>
      <div class="item-title">
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.location || product.category)} · ${status.label}</span>
      </div>
      <span class="status-pill ${status.key}">${status.label}</span>
    `;
    els.timeline.appendChild(row);
  });
}

function renderTable(items) {
  els.inventoryBody.innerHTML = "";
  if (!items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.appendChild(emptyState("No products match this inventory view."));
    row.appendChild(cell);
    els.inventoryBody.appendChild(row);
    return;
  }

  items
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
    .forEach((product) => {
      const status = getStatus(product);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="item-title">
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.upc || "No UPC")} · ${escapeHtml(product.category)} · ${escapeHtml(product.location || "No location")}</span>
          </div>
        </td>
        <td>${formatDate(product.expiryDate)}</td>
        <td><span class="status-pill ${status.key}">${status.label}</span></td>
        <td>${Number(product.quantity || 1)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="toggle" data-id="${product.id}">${product.handled ? "Reopen" : "Handled"}</button>
            <button type="button" data-action="delete" data-id="${product.id}">Delete</button>
          </div>
        </td>
      `;
      els.inventoryBody.appendChild(row);
    });

  els.inventoryBody.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", handleRowAction);
  });
}

function handleRowAction(event) {
  const { action, id } = event.currentTarget.dataset;
  if (action === "toggle") {
    products = products.map((product) =>
      product.id === id ? { ...product, handled: !product.handled } : product
    );
  }

  if (action === "delete") {
    products = products.filter((product) => product.id !== id);
  }

  persist();
  render();
}

function getFilteredProducts() {
  const query = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;

  return products.filter((product) => {
    const haystack = [
      product.name,
      product.upc,
      product.category,
      product.location,
      product.notes
    ]
      .join(" ")
      .toLowerCase();

    const productStatus = getStatus(product).key;
    const matchesQuery = !query || haystack.includes(query);
    const matchesStatus = status === "all" || status === productStatus;

    return matchesQuery && matchesStatus;
  });
}

function getStatus(product) {
  if (product.handled) {
    return { key: "handled", label: "Handled" };
  }

  const days = daysUntil(product.expiryDate);
  if (days < 0) {
    return { key: "expired", label: `${Math.abs(days)}d expired` };
  }
  if (days <= REMINDER_DAYS) {
    return { key: "soon", label: `${days}d left` };
  }
  return { key: "ok", label: "In date" };
}

function maybeShowReminder() {
  if (!("Notification" in window)) return;

  const due = products.filter((product) => {
    const status = getStatus(product).key;
    return !product.handled && ["expired", "soon"].includes(status);
  });

  if (!due.length || Notification.permission !== "granted") return;

  const today = new Date().toISOString().slice(0, 10);
  const reminderKey = `expirywise-reminded-${today}`;
  if (localStorage.getItem(reminderKey)) return;

  localStorage.setItem(reminderKey, "true");
  new Notification("ExpiryWise markdown reminder", {
    body: `${due.length} product${due.length === 1 ? "" : "s"} need an expiry check today.`
  });
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast("Browser notifications are not supported here.");
    return;
  }

  const permission = await Notification.requestPermission();
  showToast(permission === "granted" ? "Reminder notifications are enabled." : "Notifications were not enabled.");
  render();
}

function loadDemo() {
  products = [...createDemoProducts(), ...products];
  persist();
  render();
  showToast("Demo products loaded.");
}

function createDemoProducts() {
  return [
    {
      id: crypto.randomUUID(),
      upc: "639277543210",
      name: "Apple Cinnamon Granola Bars",
      category: "Snacks",
      location: "Snack aisle",
      quantity: 8,
      expiryDate: addDays(new Date(), 10),
      notes: "New case received during morning stocking.",
      handled: false,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      upc: "874220145611",
      name: "Shelf Stable Almond Milk",
      category: "Beverage",
      location: "Beverage wall",
      quantity: 12,
      expiryDate: addDays(new Date(), 28),
      notes: "Watch the back row on bottom shelf.",
      handled: false,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      upc: "051933210904",
      name: "Chicken Noodle Soup",
      category: "Pantry",
      location: "Soup shelf",
      quantity: 5,
      expiryDate: addDays(new Date(), -2),
      notes: "Needs removal check.",
      handled: false,
      createdAt: new Date().toISOString()
    }
  ];
}

function clearHandled() {
  products = products.filter((product) => !product.handled);
  persist();
  render();
  showToast("Handled products cleared.");
}

function exportProducts() {
  const blob = new Blob([JSON.stringify(products, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `expirywise-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importProducts(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Expected an array");
      products = imported;
      persist();
      render();
      showToast("Inventory imported.");
    } catch (error) {
      showToast("That file could not be imported.");
    }
  });
  reader.readAsText(file);
}

function loadProducts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function daysUntil(dateValue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseDate(dateValue);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / 86400000);
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function formatDate(value) {
  return parseDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function emptyState(text) {
  const template = document.querySelector("#emptyStateTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector("span").textContent = text;
  return node;
}

function showToast(message) {
  document.querySelectorAll(".toast").forEach((toast) => toast.remove());
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
