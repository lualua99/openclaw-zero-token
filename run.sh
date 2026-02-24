#!/bin/bash
# OpenClaw 一体化启动脚本
# 1. 编译  2. 配置向导  3. 启动 Gateway

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  1/3 编译 (pnpm build)"
echo "=========================================="
pnpm build

echo ""
echo "=========================================="
echo "  2/3 配置向导 (./onboard.sh)"
echo "  若已配置可 Ctrl+C 跳过，将自动继续启动"
echo "=========================================="
./onboard.sh || true

echo ""
echo "=========================================="
echo "  3/3 启动 Gateway (./server.sh)"
echo "=========================================="
./server.sh start
