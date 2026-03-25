#!/bin/bash
set -e

# HiClaw Log Search 安装脚本

INSTALL_DIR="${1:-/opt/log-search}"

echo "=== 安装 HiClaw Log Search ==="
echo "安装目录: $INSTALL_DIR"

# 创建目录
mkdir -p "$INSTALL_DIR"

# 复制文件
cp skill/server.js "$INSTALL_DIR/"
cp skill/index.html "$INSTALL_DIR/"

# 安装为 systemd 服务（可选）
if command -v systemctl &> /dev/null; then
    cat > /etc/systemd/system/hiclaw-log-search.service << SERVICE
[Unit]
Description=HiClaw Log Search API
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node $INSTALL_DIR/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE
    
    systemctl daemon-reload
    systemctl enable hiclaw-log-search
    systemctl start hiclaw-log-search
    echo "已安装为 systemd 服务"
fi

echo "=== 安装完成 ==="
echo "API: http://localhost:19996/log-search/api/"
echo "UI: 配置 nginx 后访问 /log-search/"
