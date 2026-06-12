const LABEL_LOOKUP_KEY = "expirywise-product-lookup";
const OCR_MAX_EDGE = 1600;
const OCR_JPEG_QUALITY = 0.82;
const LABEL_LOOKUP = {
  "7295217167": {
    name: "Whiskas Chicken & Liver Entree",
    category: "Pet Supplies",
    location: "Pet supplies",
    barcode: "7295217167",
    price: "1.75",
    quantity: 24,
    receivedDate: "2026-04-21"
  },
  "237838": {
    name: "Whiskas Chicken & Liver Entree",
    category: "Pet Supplies",
    location: "Pet supplies",
    barcode: "7295217167",
    price: "1.75",
    quantity: 24,
    receivedDate: "2026-04-21"
  }
};

const labelEls = {
  barcode: document.querySelector("#barcode"),
  category: document.querySelector("#category"),
  expiryDate: document.querySelector("#expiryDate"),
  form: document.querySelector("#productForm"),
  labelPhotoInput: document.querySelector("#labelPhotoInput"),
  labelText: document.querySelector("#labelText"),
  location: document.querySelector("#location"),
  name: document.querySelector("#name"),
  ocrProgress: document.querySelector("#ocrProgress"),
  ocrStatus: document.querySelector("#ocrStatus"),
  ocrStatusText: document.querySelector("#ocrStatusText"),
  parseLabelBtn: document.querySelector("#parseLabelBtn"),
  price: document.querySelector("#price"),
  quantity: document.querySelector("#quantity"),
  receivedDate: document.querySelector("#receivedDate"),
  upc: document.querySelector("#upc")
};

if (labelEls.parseLabelBtn) {
  labelEls.parseLabelBtn.addEventListener("click", parseReceivingLabel);
}

if (labelEls.labelPhotoInput) {
  labelEls.labelPhotoInput.addEventListener("change", scanReceivingLabelPhoto);
}

if (labelEls.form) {
  labelEls.form.addEventListener("submit", () => {
    window.setTimeout(() => {
      const products = loadStoredProducts();
      if (!products.length) return;

      products[0].receivedDate = labelEls.receivedDate?.value || products[0].receivedDate || "";
      products[0].price = normalizePrice(labelEls.price?.value || products[0].price || "");
      products[0].barcode = labelEls.barcode?.value || products[0].barcode || "";
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
  if (!hasParsedFields(parsed)) {
    showToast("No label details found. Try pasting clearer label text.");
    return;
  }

  applyReceivingLabel(parsed);
  showToast("Receiving label details filled.");
}

async function scanReceivingLabelPhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!window.Tesseract) {
    showToast("OCR is not available yet. Try again online once, or paste label text manually.");
    event.target.value = "";
    return;
  }

  setOcrStatus(true, "Preparing photo...", 0);

  try {
    const ocrImage = await prepareImageForOcr(file);
    setOcrStatus(true, "Reading label...", 0.05);

    const result = await Tesseract.recognize(ocrImage, "eng", {
      logger(message) {
        if (message.status) {
          setOcrStatus(true, toTitleCase(message.status), message.progress || 0);
        }
      }
    });
    const text = result?.data?.text || "";
    labelEls.labelText.value = text.trim();

    const parsed = extractReceivingLabel(text);
    if (!hasParsedFields(parsed)) {
      showToast("OCR finished, but no label fields were found. You can correct the text and parse again.");
      return;
    }

    applyReceivingLabel(parsed);
    showToast("Label scanned. Review the fields, then add expiry date.");

    if (labelEls.name?.value.trim() && typeof window.promptExpiryForScannedItem === "function") {
      window.promptExpiryForScannedItem(labelEls.upc.value.trim() || labelEls.barcode.value.trim() || "label");
    }
  } catch (error) {
    showToast("That photo could not be processed. Try a closer label photo or paste label text manually.");
  } finally {
    setOcrStatus(false, "", 0);
    event.target.value = "";
  }
}

function applyReceivingLabel(parsed) {
  const lookupKey = parsed.sku || parsed.barcode || labelEls.upc?.value.trim() || labelEls.barcode?.value.trim();
  if (lookupKey) window.fillFromLookup(lookupKey);
  if (parsed.sku && labelEls.upc) labelEls.upc.value = parsed.sku;
  if (parsed.barcode && labelEls.barcode) labelEls.barcode.value = parsed.barcode;
  fillLabelFields(parsed);
}

function fillLabelFields(details) {
  if (details.name && labelEls.name) labelEls.name.value = details.name;
  if (details.category && labelEls.category) labelEls.category.value = details.category;
  if (details.location && labelEls.location) labelEls.location.value = details.location;
  if (details.quantity && labelEls.quantity) labelEls.quantity.value = details.quantity;
  if (details.receivedDate && labelEls.receivedDate) labelEls.receivedDate.value = details.receivedDate;
  if (details.price && labelEls.price) labelEls.price.value = normalizePrice(details.price);
  if (details.barcode && labelEls.barcode) labelEls.barcode.value = details.barcode;
}

function extractReceivingLabel(text) {
  const raw = normalizeOcrText(text);
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

  const priceMatch = raw.match(/\$\s*(\d+(?:\.\d{1,2})?)\b/);
  if (priceMatch) parsed.price = normalizePrice(priceMatch[1]);

  const barcodeLine = [...lines].reverse().find((line) => /^\d{8,14}$/.test(line));
  const itemLine = lines.find((line) => /^\d{5,6}$/.test(line));
  if (itemLine) parsed.sku = itemLine;
  if (barcodeLine) parsed.barcode = barcodeLine;
  if (!parsed.sku && barcodeLine) parsed.sku = barcodeLine;

  const categoryLine = lines.find((line) => /^\d{2,3}\s+[A-Z][A-Z '&-]{2,}$/.test(line));
  if (categoryLine) {
    parsed.category = toTitleCase(categoryLine.replace(/^\d{2,3}\s+/, ""));
    parsed.location = parsed.category;
  } else if (lines.some((line) => /\bPET SUPPLIES\b/.test(line))) {
    parsed.category = "Pet Supplies";
    parsed.location = "Pet Supplies";
  }

  const nameLine = lines.find(
    (line) =>
      /^[A-Z][A-Z0-9 '&.,-]{8,}$/.test(line) &&
      /[A-Z]{3}/.test(line) &&
      !/^\d{2,3}\s+[A-Z]/.test(line) &&
      !/\b(CTN|SHP|PET SUPPLIES|CD)\b/.test(line) &&
      !/\$/.test(line)
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
    barcode: product.barcode,
    price: product.price,
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

function normalizeOcrText(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[|]/g, "1")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\b5HP\b/g, "SHP");
}

async function prepareImageForOcr(file) {
  const image = await loadImageForResize(file);
  const scale = Math.min(1, OCR_MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    closeLoadedImage(image);
    return file;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  closeLoadedImage(image);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob || file),
      "image/jpeg",
      OCR_JPEG_QUALITY
    );
  });
}

async function loadImageForResize(file) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    image.src = url;
  });
}

function closeLoadedImage(image) {
  if (typeof image.close === "function") {
    image.close();
  }
}

function normalizePrice(value) {
  const match = String(value || "").match(/\d+(?:\.\d{1,2})?/);
  if (!match) return "";
  return Number(match[0]).toFixed(2);
}

function hasParsedFields(parsed) {
  return ["sku", "barcode", "name", "category", "quantity", "receivedDate", "price"].some((key) => parsed[key]);
}

function setOcrStatus(visible, text, progress) {
  if (!labelEls.ocrStatus) return;
  labelEls.ocrStatus.hidden = !visible;
  if (labelEls.ocrStatusText) labelEls.ocrStatusText.textContent = text || "Reading label...";
  if (labelEls.ocrProgress) labelEls.ocrProgress.value = Math.max(0, Math.min(1, Number(progress) || 0));
}

window.extractReceivingLabel = extractReceivingLabel;
window.applyReceivingLabel = applyReceivingLabel;
