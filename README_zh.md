# Private CA Manager

⚠️ ALL CODES BY AI

[EN](README.md) | **中文**

---

基于 Nuxt 3 的私密根证书颁发机构 Web 管理器。数据存储在 SQLite，私钥 AES-256-GCM 加密，支持 RSA-4096 和 Ed25519 两种密钥类型。

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
npm install
npm run dev
```

默认监听 3000 端口，打开 http://localhost:3000 即可使用。

生产环境构建：

```bash
npm run build
npm run preview
```

### 私钥加密密钥

所有私钥在写入数据库前用 AES-256-GCM 加密。加密主密钥通过环境变量传入：

```bash
# 首次启动时若未设置，会自动生成并打印到控制台，请保存
CA_MASTER_KEY=<64位十六进制> npm run dev

# 自定义端口
PORT=8080 CA_MASTER_KEY=<...> npm run dev
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
| `GET` | `/api/cert/:ca/certs` | 列出 CA 下所有证书 |
| `POST` | `/api/cert/:ca/certs` | 签发新证书 |
| `GET` | `/api/cert/:ca/:serial` | 获取证书元数据 |
| `DELETE` | `/api/cert/:ca/:serial` | 删除证书 |
| `GET` | `/api/cert/:ca/:serial/cert.pem` | 下载证书 PEM |
| `GET` | `/api/cert/:ca/:serial/key.pem` | 下载私钥 PEM |

**POST /api/cert/:ca/certs**：

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
├── app.vue                 # 根组件
├── components/
│   ├── ca/                # CA 相关组件
│   ├── layout/            # 布局组件 (AppHeader)
│   └── ui/                # UI 组件 (Modal)
├── pages/
│   ├── index.vue          # /ca、/certs、/help 的布局
│   └── index/             # 标签页 (ca.vue, certs.vue, help.vue)
├── server/
│   ├── api/               # API 路由
│   │   ├── ca/            # CA 端点
│   │   └── cert/          # 证书端点
│   ├── lib/               # 服务器工具
│   │   ├── crypto.ts      # 证书签名逻辑
│   │   ├── db.ts          # SQLite 初始化 & 加密
│   │   └── storage.ts     # CRUD 操作
│   └── plugins/           # Nuxt 插件
├── stores/
│   ├── ca.ts              # CA 状态管理
│   └── cert.ts            # 证书状态管理
├── public/
│   └── locales/           # i18n 文件 (zh.json, en.json)
├── data/
│   └── ca.db              # SQLite 数据库（gitignored）
├── nuxt.config.ts         # Nuxt 配置
└── package.json
```

## 安全说明

- 本工具仅用于**开发与内部环境**，请勿暴露到不可信网络。
- 私钥以 AES-256-GCM 加密存储，但主密钥本身需要妥善保管。
- 本应用无身份验证功能——请确保在可信环境中运行，或按需添加身份验证。

## 许可

CC0 1.0 Universal