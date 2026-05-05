/* ============================================================
   Private CA Manager – Frontend App Logic
   ============================================================ */

// ---- State ----
let currentCA = null; // name of the currently selected CA
let currentLang = localStorage.getItem("lang") || "zh";
let currentTheme = localStorage.getItem("theme") || "dark";

// ---- i18n (loaded from /i18n/{lang}.json) ----
let i18nData = {};

async function loadI18n() {
  try {
    const [zh, en] = await Promise.all([
      fetch("/i18n/zh.json").then((r) => r.json()),
      fetch("/i18n/en.json").then((r) => r.json()),
    ]);
    i18nData = { zh, en };
  } catch (e) {
    console.warn("i18n load failed, using fallback", e);
    i18nData = { zh: {}, en: {} };
  }
}

function t(key, vars = {}) {
  const lang = currentLang === "zh" ? "zh" : "en";
  const fallback = lang === "zh" ? "en" : "zh";
  let msg =
    (i18nData[lang] && i18nData[lang][key]) ||
    (i18nData[fallback] && i18nData[fallback][key]) ||
    key;
  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replace(`{${k}}`, v);
  }
  return msg;
}

function applyLang() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
}

// ---- Theme ----
function applyTheme() {
  document.documentElement.setAttribute("data-theme", currentTheme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = currentTheme === "dark" ? "🌙" : "☀️";
  localStorage.setItem("theme", currentTheme);
}

// ---- Toast ----
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---- API helpers ----
const api = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || "Request failed");
    }
    return r.json();
  },
  async getText(url) {
    const r = await fetch(url);
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || "Request failed");
    }
    return r.text();
  },
  async post(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || "Request failed");
    }
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: "DELETE" });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || "Request failed");
    }
    return r.json();
  },
};

// ================================================================
// Navigation – Tab Switching
// ================================================================
function switchTab(tab) {
  document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach((el) => el.classList.remove("active"));

  document.getElementById(tab + "Tab").classList.add("active");
  document.querySelector(`.nav-tab[data-tab="${tab}"]`).classList.add("active");

  if (tab === "certs") {
    loadAllCerts();
  }

  if (tab === "help") {
    // Help tab is static content, just apply lang
    applyLang();
  }
}

// ================================================================
// CA Management
// ================================================================

// ---- Render CA list in left panel ----
async function loadCAList() {
  try {
    const cas = await api.get("/api/ca");
    const list = document.getElementById("caList");
    list.innerHTML = "";

    if (cas.length === 0) {
      list.innerHTML = `<p class="loading">${t("noCAs")}</p>`;
      return;
    }

    for (const ca of cas) {
      const item = document.createElement("div");
      item.className = "ca-item" + (currentCA === ca.name ? " active" : "");
      item.dataset.name = ca.name;

      const subjectStr = ca.subject
        ? ca.subject.map((s) => `${s.name}=${s.value}`).join(", ")
        : "N/A";

      const certCount = ca.certCount !== undefined ? ca.certCount : "";

      item.innerHTML = `
        <div class="ca-item-name">${escHtml(ca.name)}</div>
        <div class="ca-item-subject">${escHtml(subjectStr)}</div>
        <div class="ca-item-expiry">${t("expires")}: ${formatDate(ca.notAfter)}</div>
        ${ca.keyType ? `<div class="cert-count">${ca.keyType.toUpperCase()}</div>` : ""}
        ${certCount ? `<div class="cert-count">${certCount} cert(s)</div>` : ""}
      `;

      item.addEventListener("click", () => selectCA(ca.name));
      list.appendChild(item);
    }
  } catch (err) {
    document.getElementById("caList").innerHTML =
      `<p class="loading">${t("error")}: ${escHtml(err.message)}</p>`;
  }
}

// ---- Select a CA ----
async function selectCA(name) {
  currentCA = name;
  document.getElementById("welcomeView").classList.add("hidden");
  document.getElementById("caView").classList.remove("hidden");
  loadCAList(); // refresh active state

  try {
    const ca = await api.get(`/api/ca/${name}`);
    const el = document.getElementById("caName");
    el.textContent = ca.name;
    document.getElementById("downloadCaCert").href = `/api/ca/${name}/cert.pem`;

    const subjectStr = ca.subject
      ? ca.subject.map((s) => `${s.name}=${s.value}`).join(", ")
      : "N/A";

    document.getElementById("caMeta").innerHTML = `
      <p><strong>${t("subject")}</strong> ${escHtml(subjectStr)}</p>
      <p><strong>${t("serial")}</strong> ${escHtml(ca.serialNumber)}</p>
      <p><strong>${t("keyType")}</strong> ${escHtml((ca.keyType || "rsa").toUpperCase())}</p>
      <p><strong>${t("created")}</strong> ${formatDate(ca.notBefore)}</p>
      <p><strong>${t("expires")}</strong> ${formatDate(ca.notAfter)}</p>
    `;

    await loadCertList(name);
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ---- Load certificate list for a CA ----
async function loadCertList(caName) {
  try {
    const certs = await api.get(`/api/ca/${caName}/certs`);
    const list = document.getElementById("certList");
    list.innerHTML = "";

    if (certs.length === 0) {
      list.innerHTML = `<p class="loading">${t("noCerts")}</p>`;
      return;
    }

    for (const cert of certs) {
      list.appendChild(createCertCard(caName, cert));
    }
  } catch (err) {
    document.getElementById("certList").innerHTML =
      `<p class="loading">${t("error")}: ${escHtml(err.message)}</p>`;
  }
}

// ---- Create a certificate card DOM element ----
function createCertCard(caName, cert, showCaName = false) {
  const card = document.createElement("div");
  card.className = "cert-card";
  card.dataset.serial = cert.serial;

  const cn = cert.subject?.commonName || "Unknown";
  const sans = [];
  if (cert.dnsNames && cert.dnsNames.length > 0) sans.push(...cert.dnsNames);
  if (cert.ipAddresses && cert.ipAddresses.length > 0) sans.push(...cert.ipAddresses);
  const sanStr = sans.length > 0 ? `SAN: ${sans.join(", ")}` : "";

  let infoHTML = `
    <div class="cert-cn">${escHtml(cn)}</div>
    ${showCaName ? `<div class="cert-ca">${t("fromCA")}: ${escHtml(caName)}</div>` : ""}
    <div class="cert-serial">${t("serial")}: ${escHtml(cert.serial)}</div>
    ${sanStr ? `<div class="cert-serial">${escHtml(sanStr)}</div>` : ""}
    <div class="cert-expiry">${t("expires")}: ${formatDate(cert.notAfter)}</div>
    ${cert.keyType ? `<div class="cert-serial">${t("keyType")}: ${escHtml(cert.keyType.toUpperCase())}</div>` : ""}
  `;

  card.innerHTML = `
    <div class="cert-info">${infoHTML}</div>
    <div class="cert-actions">
      <button class="btn-preview preview-cert" data-ca="${caName}" data-serial="${cert.serial}">${t("preview")} ${t("certLabel")}</button>
      <button class="btn-preview preview-key" data-ca="${caName}" data-serial="${cert.serial}">${t("preview")} ${t("keyLabel")}</button>
      <a href="/api/cert/${caName}/${cert.serial}/cert.pem" class="btn-download" download>${t("certLabel")}</a>
      <a href="/api/cert/${caName}/${cert.serial}/key.pem" class="btn-download" download>${t("keyLabel")}</a>
      <button class="btn-delete" data-serial="${cert.serial}" data-cn="${escHtml(cn)}">${t("delete")}</button>
    </div>
  `;

  card.querySelector(".preview-cert").addEventListener("click", () =>
    showPreview(caName, cert.serial, "cert")
  );
  card.querySelector(".preview-key").addEventListener("click", () =>
    showPreview(caName, cert.serial, "key")
  );
  card.querySelector(".btn-delete").addEventListener("click", () =>
    deleteCertificate(caName, cert.serial, cn)
  );

  return card;
}

// ================================================================
// All Certificates Tab
// ================================================================
async function loadAllCerts() {
  const list = document.getElementById("allCertList");
  list.innerHTML = `<p class="loading">${t("loading")}</p>`;

  try {
    const cas = await api.get("/api/ca");
    list.innerHTML = "";

    let total = 0;
    for (const ca of cas) {
      const certs = await api.get(`/api/ca/${ca.name}/certs`);
      for (const cert of certs) {
        list.appendChild(createCertCard(ca.name, cert, true));
        total++;
      }
    }

    if (total === 0) {
      list.innerHTML = `<p class="loading">${t("noAllCerts")}</p>`;
    }
  } catch (err) {
    list.innerHTML = `<p class="loading">${t("error")}: ${escHtml(err.message)}</p>`;
  }
}

// ================================================================
// CRUD Operations
// ================================================================

// ---- Delete certificate ----
async function deleteCertificate(caName, serial, cn) {
  const msg = t("deleteConfirm", { cn, serial });
  if (!confirm(msg)) return;
  try {
    await api.del(`/api/cert/${caName}/${serial}`);
    showToast(t("certDeleted"));

    // Refresh both views
    if (currentCA === caName) await loadCertList(caName);
    await loadALL(); // refresh CA list counts too

    // Check if on all certs tab
    if (document.getElementById("certsTab").classList.contains("active")) {
      await loadAllCerts();
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ---- Create CA ----
function showNewCaForm() {
  showFormModal(t("createCA"), `
    <form id="newCaForm">
      <div class="form-group">
        <label for="caNameInput">${t("caName")} *</label>
        <input type="text" id="caNameInput" placeholder="my-root-ca" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="commonName">${t("commonName")} *</label>
          <input type="text" id="commonName" placeholder="My Root CA" required />
        </div>
        <div class="form-group">
          <label for="organizationName">${t("organization")}</label>
          <input type="text" id="organizationName" placeholder="My Company" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="countryName">${t("country")}</label>
          <input type="text" id="countryName" placeholder="US" maxlength="2" />
        </div>
        <div class="form-group">
          <label for="stateOrProvinceName">${t("state")}</label>
          <input type="text" id="stateOrProvinceName" placeholder="California" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="localityName">${t("locality")}</label>
          <input type="text" id="localityName" placeholder="San Francisco" />
        </div>
        <div class="form-group">
          <label for="caKeyType">${t("keyType")}</label>
          <select id="caKeyType">
            <option value="rsa">${t("keyTypeRsa")}</option>
            <option value="ed25519">${t("keyTypeEd25519")}</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeFormModal()">${t("cancel")}</button>
        <button type="submit" class="btn-primary">${t("createCA")}</button>
      </div>
    </form>
  `);

  document.getElementById("newCaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("caNameInput").value.trim();
    const commonName = document.getElementById("commonName").value.trim();
    if (!name || !commonName) {
      showToast(t("caName") + " and " + t("commonName") + " " + t("error").toLowerCase(), "error");
      return;
    }

    const subject = {
      commonName,
      organizationName: document.getElementById("organizationName").value.trim() || undefined,
      countryName: document.getElementById("countryName").value.trim() || undefined,
      stateOrProvinceName: document.getElementById("stateOrProvinceName").value.trim() || undefined,
      localityName: document.getElementById("localityName").value.trim() || undefined,
    };
    const keyType = document.getElementById("caKeyType").value;

    closeFormModal();
    try {
      showToast(t("generating"));
      await api.post("/api/ca", { name, subject, keyType });
      showToast(t("certCreated"));
      await loadCAList();
      await selectCA(name);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// ---- Sign certificate ----
function showSignCertForm() {
  if (!currentCA) return;

  showFormModal(t("signCertTitle", { name: currentCA }), `
    <form id="signCertForm">
      <div class="form-group">
        <div class="field-label-wrap">
          <label for="certCommonName">${t("commonNameReq")} *</label>
          <span class="info-icon">ℹ<span class="info-tooltip" data-i18n="helpFieldCN">Common Name is the primary domain the certificate protects.</span></span>
        </div>
        <input type="text" id="certCommonName" placeholder="myserver.example.com" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <div class="field-label-wrap">
            <label for="certOrg">${t("organization")}</label>
            <span class="info-icon">ℹ<span class="info-tooltip" data-i18n="helpFieldOrg">The legal entity name of the certificate applicant.</span></span>
          </div>
          <input type="text" id="certOrg" placeholder="My Company" />
        </div>
        <div class="form-group">
          <div class="field-label-wrap">
            <label for="certCountry">${t("country")}</label>
            <span class="info-icon">ℹ<span class="info-tooltip" data-i18n="helpFieldCountry">2-letter ISO 3166-1 code.</span></span>
          </div>
          <input type="text" id="certCountry" placeholder="US" maxlength="2" />
        </div>
      </div>
      <div class="form-group">
        <div class="field-label-wrap">
          <label for="dnsNames">${t("dnsNames")}</label>
          <span class="info-icon">ℹ<span class="info-tooltip" data-i18n="helpFieldSANDNS">Additional domain names for the certificate.</span></span>
        </div>
        <input type="text" id="dnsNames" placeholder="example.com, www.example.com" />
      </div>
      <div class="form-group">
        <div class="field-label-wrap">
          <label for="ipAddresses">${t("ipAddresses")}</label>
          <span class="info-icon">ℹ<span class="info-tooltip" data-i18n="helpFieldSANIP">IP addresses for the certificate.</span></span>
        </div>
        <input type="text" id="ipAddresses" placeholder="192.168.1.1, 10.0.0.1" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <div class="field-label-wrap">
            <label for="eku">${t("extendedKeyUsage")}</label>
            <span class="info-icon">ℹ<span class="info-tooltip" data-i18n="helpFieldEKU">Server or Client authentication.</span></span>
          </div>
          <select id="eku">
            <option value="serverAuth">${t("serverAuth")}</option>
            <option value="clientAuth">${t("clientAuth")}</option>
          </select>
        </div>
        <div class="form-group">
          <div class="field-label-wrap">
            <label for="days">${t("validityDays")}</label>
            <span class="info-icon">ℹ<span class="info-tooltip" data-i18n="helpFieldValidity">Certificate validity in days.</span></span>
          </div>
          <input type="number" id="days" value="364" min="1" max="3650" />
        </div>
        <div class="form-group">
          <label for="certKeyType">${t("keyType")}</label>
          <select id="certKeyType">
            <option value="rsa">${t("keyTypeRsa")}</option>
            <option value="ed25519">${t("keyTypeEd25519")}</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeFormModal()">${t("cancel")}</button>
        <button type="submit" class="btn-primary">${t("signCert").replace("+ ", "")}</button>
      </div>
    </form>
  `);

  document.getElementById("signCertForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const commonName = document.getElementById("certCommonName").value.trim();
    if (!commonName) {
      showToast(t("commonNameReq") + " is required", "error");
      return;
    }

    const dnsRaw = document.getElementById("dnsNames").value.trim();
    const ipRaw = document.getElementById("ipAddresses").value.trim();

    const body = {
      subject: {
        commonName,
        organizationName: document.getElementById("certOrg").value.trim() || undefined,
        countryName: document.getElementById("certCountry").value.trim() || undefined,
      },
      dnsNames: dnsRaw ? dnsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      ipAddresses: ipRaw ? ipRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
      eku: document.getElementById("eku").value,
      days: parseInt(document.getElementById("days").value, 10) || 364,
      keyType: document.getElementById("certKeyType").value,
    };

    closeFormModal();
    try {
      showToast(t("certSigning"));
      await api.post(`/api/ca/${currentCA}/certs`, body);
      showToast(t("certSigned"));
      await loadCertList(currentCA);
      await loadCAList(); // refresh cert count
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// ================================================================
// Preview Modal
// ================================================================
function showPreview(caName, serial, type) {
  const url = type === "cert"
    ? `/api/cert/${caName}/${serial}/cert.pem`
    : `/api/cert/${caName}/${serial}/key.pem`;

  const titleKey = type === "cert" ? "certPreview" : "keyPreview";
  const badgeLabel = type === "cert" ? t("certLabel") : t("keyLabel");
  const badgeClass = type === "cert" ? "certificate" : "private-key";

  const modal = document.getElementById("previewModal");
  modal.classList.remove("hidden");

  document.getElementById("previewTitle").textContent = t(titleKey) + ` — ${caName} / ${serial}`;
  document.getElementById("previewBadge").textContent = badgeLabel;
  document.getElementById("previewBadge").className = `preview-badge ${badgeClass}`;
  document.getElementById("previewContent").textContent = t("loading");

  let currentPem = "";

  api.getText(url).then((pem) => {
    currentPem = pem;
    document.getElementById("previewContent").textContent = pem;
  }).catch((err) => {
    document.getElementById("previewContent").textContent = `${t("error")}: ${err.message}`;
  });

  const copyBtn = document.getElementById("copyPreviewBtn");
  const newBtn = copyBtn.cloneNode(true);
  copyBtn.parentNode.replaceChild(newBtn, copyBtn);

  newBtn.addEventListener("click", async () => {
    if (!currentPem) return;
    try {
      await navigator.clipboard.writeText(currentPem);
      showToast(t("copied"));
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = currentPem;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(t("copied"));
    }
  });
}

function closePreviewModal() {
  document.getElementById("previewModal").classList.add("hidden");
}

// ---- Form Modal helpers ----
function showFormModal(title, html) {
  const overlay = document.getElementById("formModal");
  const content = document.getElementById("formModalContent");
  content.innerHTML = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="icon-btn modal-close" onclick="closeFormModal()">✕</button>
    </div>
    ${html}
  `;
  overlay.classList.remove("hidden");
  initTooltips(content);
  applyLang(); // translate tooltip text etc.
}

function closeFormModal() {
  document.getElementById("formModal").classList.add("hidden");
}

// ---- Info icon tooltip positioning ----
function initTooltips(container) {
  container.querySelectorAll(".info-icon").forEach((icon) => {
    icon.addEventListener("mouseenter", showTooltip);
    icon.addEventListener("mouseleave", hideTooltip);
  });
}

function showTooltip(e) {
  const icon = e.currentTarget;
  const tooltip = icon.querySelector(".info-tooltip");
  if (!tooltip) return;

  const rect = icon.getBoundingClientRect();
  const tw = 260; // tooltip width
  const th = tooltip.scrollHeight || 100;

  // Default: below icon (arrow points up)
  let top = rect.bottom + 10;
  let left = rect.left + rect.width / 2 - tw / 2;
  let arrowUp = false; // tooltip above icon means arrow points down

  // If not enough space below, place above
  if (top + th > window.innerHeight - 10) {
    top = rect.top - th - 10;
    arrowUp = true;
  }

  // Keep within viewport horizontally
  if (left < 10) left = 10;
  if (left + tw > window.innerWidth - 10) left = window.innerWidth - tw - 10;

  tooltip.style.top = top + "px";
  tooltip.style.left = left + "px";
  icon.dataset.arrowUp = arrowUp ? "1" : "0";
  icon.classList.add("tooltip-visible");
}

function hideTooltip(e) {
  const icon = e.currentTarget;
  icon.classList.remove("tooltip-visible");
  const tooltip = icon.querySelector(".info-tooltip");
  if (tooltip) {
    tooltip.style.top = "";
    tooltip.style.left = "";
  }
}

// ---- Refresh all helper ----
async function loadALL() {
  await loadCAList();
  if (currentCA) {
    try { await loadCertList(currentCA); } catch {}
  }
}

// ================================================================
// Helpers
// ================================================================
function escHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString(currentLang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ================================================================
// Event Bindings
// ================================================================

// Tab switching
document.querySelectorAll(".nav-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Theme toggle
document.getElementById("themeToggle").addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme();
});

// Lang toggle
document.getElementById("langToggle").addEventListener("click", () => {
  currentLang = currentLang === "zh" ? "en" : "zh";
  localStorage.setItem("lang", currentLang);
  applyLang();
  // Refresh UI text
  loadALL();
  if (document.getElementById("certsTab").classList.contains("active")) {
    loadAllCerts();
  }
  // Also update form elements if modal is open
});

// CA CRUD buttons
document.getElementById("newCaBtn").addEventListener("click", showNewCaForm);
document.getElementById("welcomeNewCaBtn").addEventListener("click", showNewCaForm);
document.getElementById("signCertBtn").addEventListener("click", showSignCertForm);

// Close modals on overlay click
document.getElementById("previewModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("previewModal")) {
    closePreviewModal();
  }
});
document.getElementById("formModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("formModal")) {
    closeFormModal();
  }
});

// ================================================================
// Init
// ================================================================
async function init() {
  // Restore saved settings
  currentLang = localStorage.getItem("lang") || "zh";
  currentTheme = localStorage.getItem("theme") || "dark";

  // Load i18n data before rendering
  await loadI18n();

  applyTheme();
  applyLang();

  await loadCAList();

  // Auto-select first CA
  const items = document.querySelectorAll(".ca-item");
  if (items.length > 0) {
    selectCA(items[0].dataset.name);
  }
}

init();
