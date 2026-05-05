# Private CA Manager

⚠️ ALL CODES BY AI

[EN](README.md) | [中文](README_zh.md)

---

A web-based Private Root Certificate Authority manager built with Node.js, Express, and [node-forge](https://github.com/digitalbazaar/forge).

Create and manage your own private CA, sign TLS certificates with custom SANs, and download PEM files — all from a clean UI with theme and language switching.

## Features

- **Root CA Generation** — Create self-signed 4096-bit RSA root certificate authorities valid for 10 years
- **Certificate Signing** — Sign end-entity certificates with 2048-bit RSA keys, random serial numbers, and configurable SANs (DNS names & IP addresses)
- **Key Usage Control** — Choose between Server Auth (`serverAuth`) and Client Auth (`clientAuth`) extended key usage
- **PEM Download** — Download CA certificate, signed certificates, and private keys as PEM files
- **Persistent Storage** — All data stored on disk under `data/ca/` with JSON metadata
- **Dark / Light Theme** — Toggle UI theme with the top-right button
- **English / Chinese UI** — Switch languages with the globe button, managed via `public/i18n/`
- **Top Navigation** — CA Management, Certificate Management, and Help tabs
- **Certificate Preview** — View PEM contents in a modal and copy to clipboard
- **Field Help Tips** — Hoverable info icons explain form fields
- **Help Documentation** — Built-in help page explains CA, root CA, certificates, SAN, EKU, validity, and serial numbers

## Requirements

- Node.js 18+

## Quick Start

```bash
git clone git@github.com:Aurorainic/private-cert-ui.git
cd private-cert-ui
git checkout dev

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on port 3000 by default. Open http://localhost:3000 in your browser.

### Custom Port

```bash
PORT=8080 npm start
```

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
  "subject": {
    "commonName": "My Root CA",
    "organizationName": "My Company",
    "countryName": "US",
    "stateOrProvinceName": "California",
    "localityName": "San Francisco"
  }
}
```

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
  "subject": {
    "commonName": "myserver.example.com",
    "organizationName": "My Company"
  },
  "dnsNames": ["myserver.example.com", "www.example.com"],
  "ipAddresses": ["192.168.1.1"],
  "eku": "serverAuth",
  "days": 364
}
```

## Project Structure

```
private-cert-ui/
├── data/
│   └── ca/
│       └── <ca-name>/
│           ├── ca.pem           # CA certificate (PEM)
│           ├── ca-key.pem       # CA private key (PEM)
│           ├── meta.json        # CA metadata
│           └── certs/
│               └── <serial>/
│                   ├── cert.pem # Signed certificate (PEM)
│                   ├── key.pem  # Certificate private key (PEM)
│                   └── meta.json # Certificate metadata
├── public/
│   ├── i18n/
│   │   ├── zh.json              # Chinese translations
│   │   └── en.json              # English translations
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   ├── ca.js       # CA initialization & loading
│   ├── cert.js     # Certificate signing
│   ├── storage.js  # File persistence layer
│   ├── validate.js # Input validation helpers
│   └── index.js    # Express server & routes
├── package.json
└── README.md
```

## Security Notes

- This tool is intended for **development and internal use only**. Do not expose it to untrusted networks.
- CA private keys are stored on disk as PEM files. Secure the `data/` directory appropriately.
- Generated certificates use SHA-256 signatures.

## License

CC0 1.0 Universal
