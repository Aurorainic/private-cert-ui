# Private CA Manager

⚠️ ALL CODES BY AI

[EN](README.md) | [中文](README_zh.md)

---

基于 Node.js + Express 的私密根证书颁发机构 Web 管理器。数据存储在 SQLite，私钥 AES-256-GCM 加密，支持 RSA-4096 和 Ed25519 两种密钥类型。

## 功能

- **根 CA 生成** — 自签名根 CA，可选 RSA-4096（10 年有效期）或 Ed25519
- **证书签发** — 终端证书，CA 密钥类型与叶证书密钥类型独立可选，支持 SAN（DNS 名称 & IP 地址）
- **密钥用途** — Server Auth / Client Auth 扩展密钥用途
- **PEM 下载** — CA 证书、已签证书、私钥均支持 PEM 下载与预览
- **SQLite 存储** — 所有数据存入 `data/ca.db`，私钥 AES-256-GCM 加密
- **深色/浅色主题** — 右上角一键切换，偏好持久化
- **中英文界面** — 右上角语言切换，偏好持久化

## 环境要求

- Node.js 18+

## 快速开始

```bash
git clone git@github.com:Aurorainic/private-cert-ui.git
cd private-cert-ui
git checkout dev
npm install
npm start
```

默认监听 3000 端口，打开 http://localhost:3000 即可使用。

### 私钥加密密钥

所有私钥在写入数据库前用 AES-256-GCM 加密。加密主密钥通过环境变量传入：

```bash
# 首次启动时若未设置，会自动生成并打印到控制台，请保存
CA_MASTER_KEY=<64位十六进制> npm start

# 自定义端口
PORT=8080 CA_MASTER_KEY=<...> npm start
```

未设置 `CA_MASTER_KEY` 时，每次启动生成临时密钥——数据库文件保留，但重启后私钥无法解密。

## API 参考

### CA

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/ca` | 列出所有 CA |
| `POST` | `/api/ca` | 创建新 CA |
| `GET` | `/api/ca/:name` | 获取 CA 元数据 |
| `GET` | `/api/ca/:name/cert.pem` | 下载 CA 证书 PEM |

**POST /api/ca**：

```json
{
  "name": "my-root-ca",
  "keyType": "ed25519",
  "subject": {
    "commonName": "My Root CA",
    "organizationName": "My Company",
    "countryName": "CN"
  }
}
```

`keyType` 可选 `"rsa"`（默认）或 `"ed25519"`。

### 证书

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/ca/:name/certs` | 列出 CA 下所有证书 |
| `POST` | `/api/ca/:name/certs` | 签发新证书 |
| `GET` | `/api/cert/:ca/:serial` | 获取证书元数据 |
| `DELETE` | `/api/cert/:ca/:serial` | 删除证书 |
| `GET` | `/api/cert/:ca/:serial/cert.pem` | 下载证书 PEM |
| `GET` | `/api/cert/:ca/:serial/key.pem` | 下载私钥 PEM |

**POST /api/ca/:name/certs**：

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

## 项目结构

```
private-cert-ui/
├── src/
│   ├── db.js        # SQLite 初始化、AES-256-GCM 加密工具、randomSerial
│   ├── ca.js        # initCA(subject, keyType)
│   ├── cert.js      # signCert(caKeyPem, caCertPem, caKeyType, subject, options)
│   ├── storage.js   # SQLite CRUD（saveCA / listCAs / loadCA / saveCert / …）
│   ├── validate.js  # 路径参数校验
│   └── index.js     # Express 路由
├── public/
│   ├── i18n/zh.json
│   ├── i18n/en.json
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/
│   └── ca.db        # SQLite 数据库（gitignored，首次运行自动创建）
└── package.json
```

## 安全说明

- 本工具仅用于**开发与内部环境**，请勿暴露到不可信网络。
- 私钥以 AES-256-GCM 加密存储，但主密钥本身需要妥善保管。
- 暂无登录认证，计划后续加入账密系统。

## 许可

CC0 1.0 Universal
