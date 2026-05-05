# Private CA Manager

⚠️ ALL CODES BY AI

**EN** | [中文](README_zh.md)

---

A web-based Private Root Certificate Authority manager built with Node.js and Express. Data is stored in SQLite with AES-256-GCM encrypted private keys. Supports both RSA-4096 and Ed25519, with first-run admin signup and session-based login.

## Features

- **Initial Admin Signup** — First visit creates the administrator account
- **Session-based Login** — Protected UI and API access with `express-session`
- **Root CA Generation** — Self-signed root CAs with RSA-4096 or Ed25519, valid for 10 years
- **Certificate Signing** — End-entity certificates with independently selectable key types, configurable SANs (DNS names & IP addresses)
- **Key Usage Control** — Server Auth or Client Auth extended key usage
- **PEM Download & Preview** — CA cert, signed certs, and private keys
- **SQLite Storage** — All data in `data/ca.db`, private keys encrypted with AES-256-GCM
- **Dark / Light Theme** — Toggle in the top-right corner, preference persisted
- **Chinese / English UI** — Language toggle in the top-right corner, preference persisted

## Requirements

- Node.js 18+

## Quick Start

```bash
git clone git@github.com:Aurorainic/private-cert-ui.git
cd private-cert-ui
git checkout dev
npm install
npm start
```

Starts on port 3000 by default. Open http://localhost:3000.

### Private Key Encryption

All private keys are AES-256-GCM encrypted before being written to the database. The master key is passed via environment variable:

```bash
# On first run without CA_MASTER_KEY, one is generated and printed — save it
CA_MASTER_KEY=<64-hex-chars> npm start

# Custom port
PORT=8080 CA_MASTER_KEY=<...> npm start
```

Without `CA_MASTER_KEY`, an ephemeral key is generated each run — the database file persists but private keys become unreadable after a restart.

## API Reference

### CAs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ca` | List all CAs |
| `POST` | `/api/ca` | Create a new CA |
| `GET` | `/api/ca/:name` | Get CA metadata |
| `GET` | `/api/ca/:name/cert.pem` | Download CA certificate PEM |

**POST /api/ca:**

```json
{
  "name": "my-root-ca",
  "keyType": "ed25519",
  "subject": {
    "commonName": "My Root CA",
    "organizationName": "My Company",
    "countryName": "US"
  }
}
```

`keyType` is `"rsa"` (default) or `"ed25519"`.

### Certificates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ca/:name/certs` | List certificates under a CA |
| `POST` | `/api/ca/:name/certs` | Sign a new certificate |
| `GET` | `/api/cert/:ca/:serial` | Get certificate metadata |
| `DELETE` | `/api/cert/:ca/:serial` | Delete a certificate |
| `GET` | `/api/cert/:ca/:serial/cert.pem` | Download certificate PEM |
| `GET` | `/api/cert/:ca/:serial/key.pem` | Download private key PEM |

**POST /api/ca/:name/certs:**

```json
{
  "subject": { "commonName": "myserver.example.com" },
  "dnsNames": ["myserver.example.com", "www.example.com"],
  "ipAddresses": ["192.168.1.1"],
  "eku": "serverAuth",
  "days": 364,
  "keyType": "ed25519"
}
```

## Project Structure

```
private-cert-ui/
├── src/
│   ├── db.js        # SQLite init, AES-256-GCM helpers, randomSerial
│   ├── ca.js        # initCA(subject, keyType)
│   ├── cert.js      # signCert(caKeyPem, caCertPem, caKeyType, subject, options)
│   ├── storage.js   # SQLite CRUD (saveCA / listCAs / loadCA / saveCert / …)
│   ├── validate.js  # Path parameter validation
│   └── index.js     # Express routes
├── public/
│   ├── i18n/zh.json
│   ├── i18n/en.json
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/
│   └── ca.db        # SQLite database (gitignored, created on first run)
└── package.json
```

## Security Notes

- Intended for **development and internal use only**. Do not expose to untrusted networks.
- Private keys are AES-256-GCM encrypted at rest, but the master key itself must be kept secure.
- **Authentication**: First visit requires admin signup. Subsequent access requires login with username/password. Sessions are httpOnly cookies with 8-hour max age.

## License

CC0 1.0 Universal
