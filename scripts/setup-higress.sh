#!/bin/bash
# Higress 路由配置脚本
# 在 hiclaw-manager 容器内运行

KUBE_API="https://localhost:18443"
NAMESPACE="higress-system"

# 创建 Service
curl -sk -X POST "$KUBE_API/api/v1/namespaces/$NAMESPACE/services" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "Service",
    "apiVersion": "v1",
    "metadata": {"name": "logs-api", "namespace": "'$NAMESPACE'"},
    "spec": {
      "ports": [{"name": "http", "protocol": "TCP", "port": 19996, "targetPort": 19996}],
      "type": "ClusterIP"
    }
  }'

curl -sk -X POST "$KUBE_API/api/v1/namespaces/$NAMESPACE/services" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "Service",
    "apiVersion": "v1",
    "metadata": {"name": "logs-frontend", "namespace": "'$NAMESPACE'"},
    "spec": {
      "ports": [{"name": "http", "protocol": "TCP", "port": 19997, "targetPort": 19997}],
      "type": "ClusterIP"
    }
  }'

# 创建 Endpoints
curl -sk -X POST "$KUBE_API/api/v1/namespaces/$NAMESPACE/endpoints" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "Endpoints",
    "apiVersion": "v1",
    "metadata": {"name": "logs-api", "namespace": "'$NAMESPACE'"},
    "subsets": [{
      "addresses": [{"ip": "127.0.0.1"}],
      "ports": [{"port": 19996, "name": "http", "protocol": "TCP"}]
    }]
  }'

curl -sk -X POST "$KUBE_API/api/v1/namespaces/$NAMESPACE/endpoints" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "Endpoints",
    "apiVersion": "v1",
    "metadata": {"name": "logs-frontend", "namespace": "'$NAMESPACE'"},
    "subsets": [{
      "addresses": [{"ip": "127.0.0.1"}],
      "ports": [{"port": 19997, "name": "http", "protocol": "TCP"}]
    }]
  }'

# 创建 Ingress
curl -sk -X POST "$KUBE_API/apis/networking.k8s.io/v1/namespaces/$NAMESPACE/ingresses" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "Ingress",
    "apiVersion": "networking.k8s.io/v1",
    "metadata": {"name": "log-search", "namespace": "'$NAMESPACE'"},
    "spec": {
      "ingressClassName": "higress",
      "rules": [{
        "http": {
          "paths": [{
            "path": "/log-search",
            "pathType": "Prefix",
            "backend": {"service": {"name": "logs-frontend", "port": {"number": 19997}}}
          }]
        }
      }]
    }
  }'

echo "Higress 配置完成"
echo "访问: http://<ip>:18080/log-search/"
