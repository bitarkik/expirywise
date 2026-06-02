const LABEL_LOOKUP_KEY = "expirywise-product-lookup";
const LABEL_LOOKUP = {
  "7295217167": {
    name: "WHISKAS CHICKEN & LIVER ENTREE",
    category: "Pet Supplies",
    location: "Pet supplies",
    quantity: 24,
    receivedDate: "2026-04-21"
  },
  "237838": {
    name: "WHISKAS CHICKEN & LIVER ENTREE",
    category: "Pet Supplies",
    location: "Pet supplies",
    quantity: 24,
    receivedDate: "2026-04-21"
  }
};

const labelEls = {
  category: document.querySelector("#category"),
  form: document.querySelector("#productForm"),
  labelText: document.querySelector("#labelText"),
  location: document.querySelector("#location"),
  name: document.querySelector("#name"),
  parseLabelBtn: document.querySelector("#parseLabelBtn"),
  quantity: document.querySelector("#quantity"),
  receivedDate: document.querySelector("#receivedDate"),
  upc: document.querySelector("#upc")
};

if (labelEls.parseLabelBtn) {
  labelEls.parseLabelBtn.addEventListener("click", parseReceivingLabel);
}

if (labelEls.form) {
  labelEls.form.addEventListener("submit", () => {
    window.setTimeout(() => {
      const products = loadStoredProducts();
      if (!products.length) return;

      products[0].receivedDate = labelEls.receivedDate?.value || products[0].receivedDate || "";
      localStorage.setItem("expirywise-products", JSON.stringify(products));
      rememberLabelProduct(products[0]);
    }, 0);
  });
}

const originalFillFromLookup = window.fillFromLookup;
window.fillFromLookup = function fillFromLabelLookup(upc) {
  const saved = loadLabelLookup();
  const match = saved[upc] || LABEL_LOOKUP[upc];

  if (match) {
    fillLabelFields(match);
    showToast("Product details filled from saved label data.");
    return;
  }

  if (typeof originalFillFromLookup === "function") {
    originalFillFromLookup(upc);
  }
};

function parseReceivingLabel() {
  const parsed = extractReceivingLabel(labelEls.labelText?.value);
  if (!Object.keys(parsed).length) {
    showToast("No label details found. Try pasting clearer label text.");
    return;
  }

  if (parsed.sku) labelEls.upc.value = parsed.sku;
  fillLabelFields(parsed);
  window.fillFromLookup(labelEls.upc.value.trim());
  showToast("Receiving label details filled.");
}

function fillLabelFields(details) {
  if (details.name && labelEls.name) labelEls.name.value = details.name;
  if (details.category && labelEls.category) labelEls.category.value = details.category;
  if (details.location && labelEls.location) labelEls.location.value = details.location;
  if (details.quantity && labelEls.quantity) labelEls.quantity.value = details.quantity;
  if (details.receivedDate && labelEls.receivedDate) labelEls.receivedDate.value = details.receivedDate;
}

function extractReceivingLabel(text) {
  const raw = String(text || "").toUpperCase();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = {};

  const shipMatch = raw.match(/\bSHP\s+(\d{1,4})\b/);
  if (shipMatch) parsed.quantity = Number(shipMatch[1]);

  const dateMatch = raw.match(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/);
  if (dateMatch) {
    const year = Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]);
    parsed.receivedDate = `${year}-${dateMatch[1]}-${dateMatch[2]}`;
  }

  const barcodeLine = [...lines].reverse().find((line) => /^\d{8,14}$/.test(line));
  const itemLine = lines.find((line) => /^\d{5,6}$/.test(line));
  parsed.sku = itemLine || barcodeLine || "";

  if (lines.some((line) => /\bPET SUPPLIES\b/.test(line))) {
    parsed.category = "Pet Supplies";
    parsed.location = "Pet supplies";
  }

  const nameLine = lines.find(
    (line) =>
      /^[A-Z][A-Z '&-]{8,}$/.test(line) &&
      !/\b(CTN|SHP|PET SUPPLIES|CD)\b/.test(line)
  );
  if (nameLine) parsed.name = toTitleCase(nameLine);

  return parsed;
}

function rememberLabelProduct(product) {
  if (!product?.upc) return;

  const lookup = loadLabelLookup();
  lookup[product.upc] = {
    name: product.name,
    category: product.category,
    location: product.location,
    quantity: product.quantity,
    receivedDate: product.receivedDate
  };
  localStorage.setItem(LABEL_LOOKUP_KEY, JSON.stringify(lookup));
}

function loadLabelLookup() {
  try {
    return {
      ...LABEL_LOOKUP,
      ...(JSON.parse(localStorage.getItem(LABEL_LOOKUP_KEY)) || {})
    };
  } catch (error) {
    return { ...LABEL_LOOKUP };
  }
}

function loadStoredProducts() {
  try {
    return JSON.parse(localStorage.getItem("expirywise-products")) || [];
  } catch (error) {
    return [];
  }
}

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
