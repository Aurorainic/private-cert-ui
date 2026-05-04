/* ============================================================
   Private CA Manager – Frontend App Logic
   ============================================================ */

// ---- State ----
let currentCA = null; // name of the currently selected CA

// ---- DOM refs ----
const caListEl = document.getElementById("caList");
const welcomeView = document.getElementById("welcomeView");
const caView = document.getElementById("caView");
const caNameEl = document.getElementById("caName");
const caMetaEl = document.getElementById("caMeta");
const certListEl = document.getElementById("certList");
const downloadCaCertEl = document.getElementById("downloadCaCert");
const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");

// ---- Toast ----
function showToast(message, type = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
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

// ---- Render CA list in sidebar ----
async function loadCAList() {
  try {
    const cas = await api.get("/api/ca");
    caListEl.innerHTML = "";

    if (cas.length === 0) {
      caListEl.innerHTML = '<p class="loading">No CAs yet. Create one!</p>';
      return;
    }

    for (const ca of cas) {
      const item = document.createElement("div");
      item.className = "ca-item" + (currentCA === ca.name ? " active" : "");
      item.dataset.name = ca.name;

      const subjectStr = ca.subject
        ? ca.subject.map((s) => `${s.name}=${s.value}`).join(", ")
        : "N/A";

      item.innerHTML = `
        <div class="ca-item-name">${escHtml(ca.name)}</div>
        <div class="ca-item-subject">${escHtml(subjectStr)}</div>
        <div class="ca-item-expiry">Expires: ${formatDate(ca.notAfter)}</div>
      `;

      item.addEventListener("click", () => selectCA(ca.name));
      caListEl.appendChild(item);
    }
  } catch (err) {
    caListEl.innerHTML = `<p class="loading">Error: ${escHtml(err.message)}</p>`;
  }
}

// ---- Select a CA ----
async function selectCA(name) {
  currentCA = name;
  welcomeView.classList.add("hidden");
  caView.classList.remove("hidden");
  showView("ca");
  loadCAList(); // refresh active state

  try {
    const ca = await api.get(`/api/ca/${name}`);
    caNameEl.textContent = ca.name;
    downloadCaCertEl.href = `/api/ca/${name}/cert.pem`;

    const subjectStr = ca.subject
      ? ca.subject.map((s) => `${s.name}=${s.value}`).join(", ")
      : "N/A";

    caMetaEl.innerHTML = `
      <p><strong>Subject</strong> ${escHtml(subjectStr)}</p>
      <p><strong>Serial</strong> ${escHtml(ca.serialNumber)}</p>
      <p><strong>Created</strong> ${formatDate(ca.notBefore)}</p>
      <p><strong>Expires</strong> ${formatDate(ca.notAfter)}</p>
    `;

    await loadCertList(name);
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ---- Load certificate list ----
async function loadCertList(caName) {
  try {
    const certs = await api.get(`/api/ca/${caName}/certs`);
    certListEl.innerHTML = "";

    if (certs.length === 0) {
      certListEl.innerHTML =
        '<p class="loading">No certificates signed yet. Click "+ Sign Certificate" to create one.</p>';
      return;
    }

    for (const cert of certs) {
      const card = document.createElement("div");
      card.className = "cert-card";
      card.dataset.serial = cert.serial;

      const cn = cert.subject?.commonName || "Unknown";
      const sans = [];
      if (cert.dnsNames && cert.dnsNames.length > 0) {
        sans.push(...cert.dnsNames);
      }
      if (cert.ipAddresses && cert.ipAddresses.length > 0) {
        sans.push(...cert.ipAddresses);
      }
      const sanStr = sans.length > 0 ? `SAN: ${sans.join(", ")}` : "";

      card.innerHTML = `
        <div class="cert-info">
          <div class="cert-cn">${escHtml(cn)}</div>
          <div class="cert-serial">Serial: ${escHtml(cert.serial)}</div>
          ${sanStr ? `<div class="cert-serial">${escHtml(sanStr)}</div>` : ""}
          <div class="cert-expiry">Expires: ${formatDate(cert.notAfter)}</div>
        </div>
        <div class="cert-actions">
          <a href="/api/cert/${caName}/${cert.serial}/cert.pem" class="btn-download" download>Cert</a>
          <a href="/api/cert/${caName}/${cert.serial}/key.pem" class="btn-download" download>Key</a>
          <button class="btn-delete" data-serial="${cert.serial}" data-cn="${escHtml(cn)}">Delete</button>
        </div>
      `;

      const deleteBtn = card.querySelector(".btn-delete");
      deleteBtn.addEventListener("click", () => deleteCertificate(caName, cert.serial, cn));

      certListEl.appendChild(card);
    }
  } catch (err) {
    certListEl.innerHTML = `<p class="loading">Error: ${escHtml(err.message)}</p>`;
  }
}

// ---- Delete certificate ----
async function deleteCertificate(caName, serial, cn) {
  if (!confirm(`Delete certificate "${cn}" (serial: ${serial})? This cannot be undone.`)) {
    return;
  }
  try {
    await api.del(`/api/cert/${caName}/${serial}`);
    showToast(`Certificate "${cn}" deleted`);
    await loadCertList(caName);
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ---- Show modal ----
function showModal(html) {
  modalContent.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
}

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ---- New CA form ----
function showNewCaForm() {
  showModal(`
    <h2>Create New Certificate Authority</h2>
    <form id="newCaForm">
      <div class="form-group">
        <label for="caName">CA Name *</label>
        <input type="text" id="caNameInput" placeholder="my-root-ca" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="commonName">Common Name *</label>
          <input type="text" id="commonName" placeholder="My Root CA" required />
        </div>
        <div class="form-group">
          <label for="organizationName">Organization</label>
          <input type="text" id="organizationName" placeholder="My Company" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="countryName">Country (2-letter)</label>
          <input type="text" id="countryName" placeholder="US" maxlength="2" />
        </div>
        <div class="form-group">
          <label for="stateOrProvinceName">State</label>
          <input type="text" id="stateOrProvinceName" placeholder="California" />
        </div>
      </div>
      <div class="form-group">
        <label for="localityName">Locality</label>
        <input type="text" id="localityName" placeholder="San Francisco" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Create CA</button>
      </div>
    </form>
  `);

  document.getElementById("newCaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("caNameInput").value.trim();
    const commonName = document.getElementById("commonName").value.trim();

    if (!name || !commonName) {
      showToast("CA Name and Common Name are required", "error");
      return;
    }

    const subject = {
      commonName,
      organizationName: document.getElementById("organizationName").value.trim() || undefined,
      countryName: document.getElementById("countryName").value.trim() || undefined,
      stateOrProvinceName: document.getElementById("stateOrProvinceName").value.trim() || undefined,
      localityName: document.getElementById("localityName").value.trim() || undefined,
    };

    closeModal();

    try {
      showToast("Creating CA... (this may take a moment for 4096-bit key generation)");
      const result = await api.post("/api/ca", { name, subject });
      showToast(`CA "${name}" created successfully`);
      await loadCAList();
      await selectCA(name);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// ---- Sign certificate form ----
function showSignCertForm() {
  if (!currentCA) return;

  showModal(`
    <h2>Sign Certificate under "${escHtml(currentCA)}"</h2>
    <form id="signCertForm">
      <div class="form-group">
        <label for="certCommonName">Common Name *</label>
        <input type="text" id="certCommonName" placeholder="myserver.example.com" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="certOrg">Organization</label>
          <input type="text" id="certOrg" placeholder="My Company" />
        </div>
        <div class="form-group">
          <label for="certCountry">Country</label>
          <input type="text" id="certCountry" placeholder="US" maxlength="2" />
        </div>
      </div>
      <div class="form-group">
        <label for="dnsNames">DNS Names (comma-separated)</label>
        <input type="text" id="dnsNames" placeholder="example.com, www.example.com" />
      </div>
      <div class="form-group">
        <label for="ipAddresses">IP Addresses (comma-separated)</label>
        <input type="text" id="ipAddresses" placeholder="192.168.1.1, 10.0.0.1" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="eku">Extended Key Usage</label>
          <select id="eku">
            <option value="serverAuth">Server Auth</option>
            <option value="clientAuth">Client Auth</option>
          </select>
        </div>
        <div class="form-group">
          <label for="days">Validity (days)</label>
          <input type="number" id="days" value="364" min="1" max="3650" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn-primary">Sign Certificate</button>
      </div>
    </form>
  `);

  document.getElementById("signCertForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const commonName = document.getElementById("certCommonName").value.trim();

    if (!commonName) {
      showToast("Common Name is required", "error");
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
    };

    closeModal();

    try {
      showToast("Signing certificate...");
      await api.post(`/api/ca/${currentCA}/certs`, body);
      showToast(`Certificate "${commonName}" signed successfully`);
      await loadCertList(currentCA);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// ---- View management ----
function showView(view) {
  welcomeView.classList.add("hidden");
  caView.classList.add("hidden");

  if (view === "welcome") {
    welcomeView.classList.remove("hidden");
  } else if (view === "ca") {
    caView.classList.remove("hidden");
  }
}

// ---- Helpers ----
function escHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---- Event bindings ----
document.getElementById("newCaBtn").addEventListener("click", showNewCaForm);
document.getElementById("welcomeNewCaBtn").addEventListener("click", showNewCaForm);
document.getElementById("signCertBtn").addEventListener("click", showSignCertForm);

// ---- Init ----
async function init() {
  await loadCAList();
  // If there are CAs, auto-select the first one
  const items = caListEl.querySelectorAll(".ca-item");
  if (items.length > 0) {
    selectCA(items[0].dataset.name);
  }
}

init();
