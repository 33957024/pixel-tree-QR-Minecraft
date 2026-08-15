#!/usr/bin/env bash
# 像素树二维码服务启动脚本（Git Bash / macOS / Linux）
# 用法：./start.sh [端口]   例如 ./start.sh 8080
set -e

cd "$(dirname "$0")"

# 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未找到 Node.js，请先安装并加入 PATH：https://nodejs.org/"
  exit 1
fi

PORT="${1:-3000}"

# 首次运行时自动安装依赖
if [ ! -d node_modules ]; then
  echo "[1/2] 正在安装依赖..."
  npm install
fi

echo "[2/2] 正在启动像素树二维码服务..."
echo
echo "   界面: http://localhost:${PORT}/"
echo "   停止: 按 Ctrl+C"
echo

PORT="$PORT" node index.js serve

echo
echo "服务已停止。若上方有报错，请把内容发给我。"
