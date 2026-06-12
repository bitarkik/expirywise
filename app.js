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
let installPrompt = null;
let inventoryMode = "action";

const els = {
  activeCount: document.querySelector("#activeCount"),
  barcode: document.querySelector("#barcode"),
  category: document.querySelector("#category"),
  clearHandledBtn: document.querySelector("#clearHandledBtn"),
  categoryFilter: document.querySelector("#categoryFilter"),
  confirmExpiryBtn: document.querySelector("#confirmExpiryBtn"),
  expiredCount: document.querySelector("#expiredCount"),
  expiryPrompt: document.querySelector("#expiryPrompt"),
  expiryDate: document.querySelector("#expiryDate"),
  exportBtn: document.querySelector("#exportBtn"),
  form: document.querySelector("#productForm"),
  importInput: document.querySelector("#importInput"),
  installBtn: document.querySelector("#installBtn"),
  inventoryBody: document.querySelector("#inventoryBody"),
  inventoryTabs: document.querySelectorAll("[data-inventory-mode]"),
  location: document.querySelector("#location"),
  name: document.querySelector("#name"),
  notes: document.querySelector("#notes"),
  notifyBtn: document.querySelector("#notifyBtn"),
  price: document.querySelector("#price"),
  promptExpiryDate: document.querySelector("#promptExpiryDate"),
  quantity: document.querySelector("#quantity"),
  receivedDate: document.querySelector("#receivedDate"),
  searchInput: document.querySelector("#searchInput"),
  seedBtn: document.querySelector("#seedBtn"),
  soonCount: document.querySelector("#soonCount"),
  sortFilter: document.querySelector("#sortFilter"),
  statusFilter: document.querySelector("#statusFilter"),
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
els.categoryFilter.addEventListener("change", render);
els.sortFilter.addEventListener("change", render);
els.statusFilter.addEventListener("change", render);
els.upc.addEventListener("change", () => fillFromLookup(els.upc.value.trim()));
els.seedBtn.addEventListener("click", loadDemo);
els.clearHandledBtn.addEventListener("click", clearHandled);
els.exportBtn.addEventListener("click", exportProducts);
els.importInput.addEventListener("change", importProducts);
els.installBtn.addEventListener("click", installApp);
els.notifyBtn.addEventListener("click", requestNotifications);
els.confirmExpiryBtn.addEventListener("click", confirmScannedExpiry);
document.querySelectorAll("[data-target-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.targetView));
});
document.addEventListener("click", (event) => {
  const inventoryTab = event.target.closest("[data-inventory-mode]");
  if (inventoryTab) {
    setInventoryMode(inventoryTab.dataset.inventoryMode);
  }
});
window.addEventListener("beforeinstallprompt", handleInstallPrompt);
window.addEventListener("appinstalled", handleAppInstalled);

registerServiceWorker();
renderCategoryOptions();
render();

function saveProduct(event) {
  event.preventDefault();

  const formData = new FormData(els.form);
  const product = {
    id: createId(),
    upc: String(formData.get("upc") || "").trim(),
    barcode: String(formData.get("barcode") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "Pantry"),
    location: String(formData.get("location") || "").trim(),
    quantity: Math.max(1, Number(formData.get("quantity") || 1)),
    price: normalizePrice(formData.get("price")),
    receivedDate: String(formData.get("receivedDate") || ""),
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
  showView("inventory");
  render();
}

function showView(name) {
  document.querySelectorAll(".app-view").forEach((view) => {
    const active = view.dataset.view === name;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });

  if (name === "inventory") {
    render();
  }
}

function setInventoryMode(mode) {
  inventoryMode = mode;
  els.inventoryTabs.forEach((button) => {
    const active = button.dataset.inventoryMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  render();
}

function fillFromLookup(upc) {
  const match = sampleLookup[upc];
  if (!match) return;

  els.name.value = match.name;
  els.category.value = match.category;
  els.location.value = match.location;
  showToast("Product details filled from the demo SKU lookup.");
}

function handleInstallPrompt(event) {
  event.preventDefault();
  installPrompt = event;
  els.installBtn.hidden = false;
}

async function installApp() {
  if (!installPrompt) {
    showToast("Use your browser menu to add ExpiryWise to your home screen.");
    return;
  }

  installPrompt.prompt();
  const result = await installPrompt.userChoice;
  installPrompt = null;
  els.installBtn.hidden = true;

  if (result.outcome === "accepted") {
    showToast("ExpiryWise is ready from your home screen.");
  }
}

function handleAppInstalled() {
  installPrompt = null;
  els.installBtn.hidden = true;
  showToast("ExpiryWise installed.");
}

function render() {
  const filtered = getFilteredProducts();
  renderCategoryOptions();
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
  const queue = getActionItems(items)
    .filter((product) => ["expired", "soon"].includes(getStatus(product).key) && !product.handled)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  els.timeline.innerHTML = "";
  els.timeline.hidden = inventoryMode !== "action";
  if (inventoryMode !== "action") return;

  if (!queue.length) {
    els.timeline.appendChild(emptyState("No products need action right now."));
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
        <span>${escapeHtml(product.location || product.category)} / ${status.label}</span>
      </div>
      <span class="status-pill ${status.key}">${status.label}</span>
    `;
    els.timeline.appendChild(row);
  });
}

function renderTable(items) {
  els.inventoryBody.innerHTML = "";
  const visibleItems = inventoryMode === "action" ? getActionItems(items) : items;

  if (!visibleItems.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.appendChild(emptyState(inventoryMode === "action" ? "No expired or due-soon products match this view." : "No products match this inventory view."));
    row.appendChild(cell);
    els.inventoryBody.appendChild(row);
    return;
  }

  getSortedProducts(visibleItems)
    .forEach((product) => {
      const status = getStatus(product);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="item-title">
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.upc || "No SKU")} / ${escapeHtml(product.category)} / ${escapeHtml(product.location || "No location")}${product.receivedDate ? ` / received ${formatDate(product.receivedDate)}` : ""}${product.price ? ` / $${escapeHtml(product.price)}` : ""}${product.barcode ? ` / barcode ${escapeHtml(product.barcode)}` : ""}</span>
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
  const category = els.categoryFilter.value;
  const status = els.statusFilter.value;

  return products.filter((product) => {
    const haystack = [
      product.name,
      product.upc,
      product.barcode,
      product.category,
      product.location,
      product.notes,
      product.receivedDate,
      product.price
    ]
      .join(" ")
      .toLowerCase();

    const productStatus = getStatus(product).key;
    const matchesQuery = !query || haystack.includes(query);
    const matchesCategory = category === "all" || category === product.category;
    const matchesStatus = status === "all" || status === productStatus;

    return matchesQuery && matchesCategory && matchesStatus;
  });
}

function getActionItems(items) {
  return items.filter((product) => {
    const status = getStatus(product).key;
    return !product.handled && ["expired", "soon"].includes(status);
  });
}

function getSortedProducts(items) {
  const sort = els.sortFilter.value;
  return [...items].sort((a, b) => {
    if (sort === "expiry-desc") return new Date(b.expiryDate) - new Date(a.expiryDate);
    if (sort === "name-asc") return a.name.localeCompare(b.name);
    if (sort === "qty-desc") return Number(b.quantity || 0) - Number(a.quantity || 0);
    if (sort === "received-desc") return new Date(b.receivedDate || 0) - new Date(a.receivedDate || 0);
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });
}

function renderCategoryOptions() {
  const selected = els.categoryFilter.value || "all";
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
  els.categoryFilter.innerHTML = '<option value="all">All categories</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.appendChild(option);
  });
  els.categoryFilter.value = categories.includes(selected) ? selected : "all";
}

function promptExpiryForScannedItem(value) {
  if (!els.name.value.trim()) {
    showToast(`Scanned ${value}. Add product details, then expiry date.`);
    els.name.focus();
    return;
  }

  els.promptExpiryDate.value = els.expiryDate.value || "";
  if (typeof els.expiryPrompt.showModal === "function") {
    els.expiryPrompt.showModal();
  } else {
    els.expiryDate.focus();
  }
  showToast(`Scanned ${value}. Add expiry date to save.`);
}

function confirmScannedExpiry(event) {
  event.preventDefault();
  if (!els.promptExpiryDate.value) {
    showToast("Add an expiry date first.");
    return;
  }

  els.expiryDate.value = els.promptExpiryDate.value;
  els.expiryPrompt.close();
  els.form.requestSubmit();
}

window.promptExpiryForScannedItem = promptExpiryForScannedItem;

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
      id: createId(),
      upc: "639277543210",
      barcode: "639277543210",
      name: "Apple Cinnamon Granola Bars",
      category: "Snacks",
      location: "Snack aisle",
      quantity: 8,
      price: "1.25",
      expiryDate: addDays(new Date(), 10),
      notes: "New case received during morning stocking.",
      handled: false,
      createdAt: new Date().toISOString()
    },
    {
      id: createId(),
      upc: "874220145611",
      barcode: "874220145611",
      name: "Shelf Stable Almond Milk",
      category: "Beverage",
      location: "Beverage wall",
      quantity: 12,
      price: "1.25",
      expiryDate: addDays(new Date(), 28),
      notes: "Watch the back row on bottom shelf.",
      handled: false,
      createdAt: new Date().toISOString()
    },
    {
      id: createId(),
      upc: "051933210904",
      barcode: "051933210904",
      name: "Chicken Noodle Soup",
      category: "Pantry",
      location: "Soup shelf",
      quantity: 5,
      price: "1.25",
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
    event.target.value = "";
  });
  reader.readAsText(file);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() => {
        showToast("Offline mode could not be enabled in this browser.");
      });
  });
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function normalizePrice(value) {
  const match = String(value || "").match(/\d+(?:\.\d{1,2})?/);
  if (!match) return "";
  return Number(match[0]).toFixed(2);
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
