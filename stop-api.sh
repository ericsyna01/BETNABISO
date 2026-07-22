#!/bin/bash
# ./stop-api.sh — arrête l'API BETNABISO

DIR="$(cd "$(dirname "$0")" && pwd)"
HTTPD="/usr/local/opt/httpd/bin/httpd"
APACHE_CONF="$DIR/betnabiso-apache.conf"
APACHE_PID="/tmp/betnabiso-apache.pid"

export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

if [ -f "$APACHE_PID" ] && kill -0 "$(cat "$APACHE_PID")" 2>/dev/null; then
    "$HTTPD" -f "$APACHE_CONF" -k stop 2>/dev/null
    sleep 1
fi
rm -f "$APACHE_PID"
lsof -ti :8888 | xargs kill -9 2>/dev/null || true

echo "API arretee"
