#!/bin/bash

IP="192.168.100.137"

echo "============================================"
echo "  BETNABISO - Demarrage reseau local"
echo "============================================"
echo ""
echo "  Application : http://$IP:4200"
echo "  API         : http://$IP:8888"
echo ""
echo "  Les autres machines du reseau Wi-Fi"
echo "  peuvent ouvrir : http://$IP:4200"
echo ""
echo "  Ctrl+C pour tout arreter"
echo "============================================"
echo ""

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Demarrer l'API PHP en arriere-plan
cd "$ROOT_DIR/betnabiso-api"
php -S 0.0.0.0:8888 index.php &
PHP_PID=$!
echo "[API] Demarre (PID $PHP_PID)"

# Demarrer Angular
cd "$ROOT_DIR/betnabiso"
echo "[Angular] Demarrage..."
npx ng serve --host 0.0.0.0 --port 4200 &
NG_PID=$!
echo "[Angular] Demarre (PID $NG_PID)"

# Arreter les deux proprement avec Ctrl+C
trap "echo ''; echo 'Arret...'; kill $PHP_PID $NG_PID 2>/dev/null; exit" INT TERM

wait
