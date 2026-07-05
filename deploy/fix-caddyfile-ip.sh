#!/bin/sh
# Corrige Caddyfile para despliegue por IP (sin dominio).
# Ejecutar en la raiz del repo: sh deploy/fix-caddyfile-ip.sh

set -e
cd "$(dirname "$0")/.."

cat > deploy/Caddyfile << 'EOF'
:80 {
	handle /api/* {
		reverse_proxy api:4001
	}

	handle {
		reverse_proxy web:80
	}
}
EOF

echo "OK: deploy/Caddyfile actualizado."
echo "Reinicia Caddy:"
echo "  docker compose -f docker-compose.prod.yml restart caddy"
echo "  curl -I http://localhost:8080"
