# pixel-tree-qr 🎄

把任意链接「种」成一棵彩色叶片树（参考 [Chroma Tree](https://6cls.com/chroma-tree)）：二维码被渲染成一棵 **等距视角的立体树** —— 树冠由彩色叶片方块堆叠而成，中央有树干，地面铺着二维码本体。

输出有两种视图，与参考站一致：

| 视图 | 说明 | 是否可扫 |
| --- | --- | --- |
| **树（tree）** | 等距 3D 树：粉色/绿色/黄色/彩虹叶片树冠 + 树干 + 二维码地面 | 装饰视图 |
| **平面（flat）** | 高对比度方形二维码 | ✅ 可被手机扫出 |

> 二维码矩阵在两种视图中完全相同，只是绘制方式不同。树是「从侧面看」，平面是「从上往下看」——后者就是可扫描的那张。

## 原理：为什么能扫？

- 二维码矩阵照常生成（纠错等级 H），模块位置不变；
- 树视图把它**平铺在地面**当背景，再在暗色模块上方「长」出叶片；
- 平面视图用**暗色叶片 + 白底**，每个模块仍落在原始网格上，定位/时序/校正图形以实心绘制，扫描器可正常识别。

## 环境要求

- Node.js **>= 16**
- 绘图库 [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas)：node-canvas 的同 API 替代品，提供预编译 N-API 二进制，Windows / macOS / Linux 开箱即用，无需本地编译。

## 安装

```bash
npm install
```

## 纯浏览器版（单文件，无需服务端）

```bash
npm run build     # 生成 pixel-tree.html
```

生成一个**完全自包含**的 `pixel-tree.html`（内联了 qrcode-generator 与全部渲染逻辑），双击即可在浏览器打开，无需 Node.js / 服务端，可随意发给别人。渲染、树↔二维码动画、自定义配色、下载全部在浏览器端完成。

## 使用

### 命令行

```bash
node index.js "https://example.com"                      # 生成树（默认樱花粉）
node index.js "https://example.com" tree.png --theme=summer
node index.js "https://example.com" qr.png --flat        # 生成可扫描的平面二维码
```

主题：`cherry`（樱花粉，默认）/ `summer`（夏日绿）/ `ginkgo`（银杏黄）/ `rainbow`（渐变彩虹）。

### HTTP 服务 + 网页界面

```bash
npm start          # 或双击 start.bat / ./start.sh
```

启动后浏览器打开 **`http://localhost:3000/`**，即可看到一个网页界面：输入链接、选择树叶颜色、点击「查看二维码」让树**旋转放平**成俯视角度的可扫描二维码（带平滑过渡动画）、下载 PNG。渲染在浏览器端完成。

| 地址 | 说明 |
| --- | --- |
| `http://localhost:3000/` | 网页界面（输入框 + 主题 + 切换 + 下载） |
| `http://localhost:3000/?url=https://example.com` | 树视图图片（默认） |
| `http://localhost:3000/?url=...&mode=flat` | 可扫描的平面二维码 |
| `http://localhost:3000/?url=...&theme=summer` | 切换主题 |

### 可选参数

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `url` | 要编码的链接（必填） | — |
| `mode` | `tree` 或 `flat` | `tree` |
| `theme` | `cherry` / `summer` / `ginkgo` / `rainbow` | `cherry` |
| `errorCorrection` | `L` / `M` / `Q` / `H` | `H` |
| `scale` | 平面视图每模块像素 | `16` |
| `quietZone` | 平面视图静区宽度（模块） | `4` |

## 运行测试

```bash
npm test
```

验证两件事：① 树视图四种主题都能正常渲染；② 平面视图能被 `jsQR` 解码回原始 URL。

## 项目结构

```
.
├── index.js           # 入口：命令行 / 启动服务
├── start.bat          # Windows 双击启动脚本
├── start.sh           # Git Bash / macOS / Linux 启动脚本
├── package.json
├── public/
│   ├── index.html     # 网页界面（输入链接 / 选主题 / 树·二维码切换 / 下载）
│   ├── app.js         # 浏览器端渲染 + 等距→俯视过渡动画
│   └── vendor/qrcode.js  # qrcode-generator 浏览器版
├── src/
│   ├── generate.js    # 核心：二维码矩阵 → 树 / 平面 Canvas
│   └── server.js      # Express 接口 + 托管网页
├── test.js            # 渲染 + 解码验证
└── README.md
```

## 已知限制

- 超长 URL 超出 QR 容量会报错（`code length overflow`），请缩短链接。
- 树视图是立体装饰图，**扫描请用 `mode=flat`** 的那张（参考站的「查看二维码」按钮同理）。
