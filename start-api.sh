#!/bin/bash
# ./start-api.sh — démarre l'API BETNABISO via Apache + mod_php

DIR="$(cd "$(dirname "$0")" && pwd)"
HTTPD="/usr/local/opt/httpd/bin/httpd"
APACHE_CONF="$DIR/betnabiso-apache.conf"
APACHE_PID="/tmp/betnabiso-apache.pid"

# Requis sur macOS : évite le crash objc lors du fork() d'Apache
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

stop_existing() {
    if [ -f "$APACHE_PID" ] && kill -0 "$(cat "$APACHE_PID")" 2>/dev/null; then
        OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES "$HTTPD" -f "$APACHE_CONF" -k stop 2>/dev/null
        sleep 1
    fi
    rm -f "$APACHE_PID"
    lsof -ti :8888 | xargs kill -9 2>/dev/null || true
    sleep 1
}

echo "Arret des serveurs precedents..."
stop_existing

echo "Demarrage Apache + mod_php..."
"$HTTPD" -f "$APACHE_CONF" -k start 2>&1
sleep 2

if ! lsof -i :8888 | grep -q LISTEN; then
    echo "ERREUR: Apache n'a pas demarré. Consultez /tmp/betnabiso-apache-error.log"
    exit 1
fi

echo ""
echo "API BETNABISO demarree (Apache + mod_php)"
echo "  Local  : http://localhost:8888"
echo "  Reseau : http://192.168.100.137:8888"
echo "  Logs   : /tmp/betnabiso-apache-error.log"
echo "  Stop   : ./stop-api.sh"
