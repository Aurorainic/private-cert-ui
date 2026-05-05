# ╔══════════════════════════════════╗
# ║         ALL CODE BY AI           ║
# ╚══════════════════════════════════╝

# Private CA Manager

基于 Node.js、Express 和 [node-forge](https://github.com/digitalbazaar/forge) 的私密根证书颁发机构 Web 管理器。

创建和管理自有根 CA，签发带自定义 SAN 的 TLS 证书，下载 PEM 文件。

## 功能

- **根 CA 生成** — 自签名 4096-bit RSA 根证书，有效期 10 年
- **证书签发** — 2048-bit RSA 终端证书，随机序列号，可配置 SAN（DNS 名称 & IP 地址）
- **密钥用途选择** — Server Auth / Client Auth 扩展密钥用途
- **PEM 下载** — CA 证书、已签证书、私钥均支持 PEM 下载
- **持久化存储** — 数据存储在 `data/ca/` 目录，JSON 元数据
- **深色/浅色主题** — 右上角 🌙/☀️ 一键切换
- **中英双语** — 右上角 🌐 一键切换，i18n 文件管理（`public/i18n/`）
- **顶部菜单导航** — CA 管理 / 证书管理 / 帮助 三个标签页
- **证书预览** — 弹窗显示 PEM 原文，📋 一键复制
- **字段帮助提示** — 签发表单每个字段旁 ℹ 图标，悬停显示详细解释
- **帮助文档** — 独立帮助页，讲解 CA、根 CA、数字证书、SAN、EKU 等核心概念

## 环境要求

- Node.js 18+

## 快速开始

```bash
git clone git@github.com:Aurorainic/private-cert-ui.git
cd private-cert-ui
git checkout dev

# 安装依赖
npm install

# 启动服务
npm start
```

默认监听 3000 端口。打开 http://localhost:3000 即可使用。

### 自定义端口

```bash
PORT=8080 npm start
```

## API 参考

### CA

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/ca` | 列出所有 CA |
| `POST` | `/api/ca` | 创建新 CA |
| `GET` | `/api/ca/:name` | 获取 CA 元数据 |
| `GET` | `/api/ca/:name/cert.pem` | 下载 CA 证书 PEM |

**POST /api/ca** 请求体：

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

### 证书

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/ca/:name/certs` | 列出 CA 下所有证书 |
| `POST` | `/api/ca/:name/certs` | 签发新证书 |
| `GET` | `/api/cert/:ca/:serial` | 获取证书元数据 |
| `DELETE` | `/api/cert/:ca/:serial` | 删除证书 |
| `GET` | `/api/cert/:ca/:serial/cert.pem` | 下载证书 PEM |
| `GET` | `/api/cert/:ca/:serial/key.pem` | 下载私钥 PEM |

**POST /api/ca/:name/certs** 请求体：

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

## 项目结构

```
private-cert-ui/
├── data/
│   └── ca/
│       └── <ca-name>/
│           ├── ca.pem           # CA 证书 (PEM)
│           ├── ca-key.pem       # CA 私钥 (PEM)
│           ├── meta.json        # CA 元数据
│           └── certs/
│               └── <serial>/
│                   ├── cert.pem # 已签证书 (PEM)
│                   ├── key.pem  # 证书私钥 (PEM)
│                   └── meta.json # 证书元数据
├── public/
│   ├── i18n/
│   │   ├── zh.json              # 中文翻译
│   │   └── en.json              # 英文翻译
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   ├── ca.js       # CA 初始化与加载
│   ├── cert.js     # 证书签发
│   ├── storage.js  # 文件持久化
│   ├── validate.js # 输入校验
│   └── index.js    # Express 服务与路由
├── package.json
├── README.md
└── README_zh.md
```

## 安全说明

- 本工具仅用于**开发与内部环境**。请勿暴露到不可信网络。
- CA 私钥以 PEM 明文存储在磁盘上。请妥善保护 `data/` 目录。
- 生成的证书使用 SHA-256 签名。

## 许可

CC0 1.0 Universal — 公有领域贡献。详见 [LICENSE](LICENSE)。
