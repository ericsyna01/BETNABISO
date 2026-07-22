#!/bin/bash
# Script de déploiement BETNABISO
# Usage: ./deploy.sh [frontend|api|all]
set -e

SSH_OPTS="-o StrictHostKeyChecking=no -o PubkeyAuthentication=no -o PreferredAuthentications=password"
export SSHPASS='CHANGE_ME'   # TODO: mot de passe SSH de l'hébergement BetNaBiso (celui de l'ancien client a été retiré)
SSH_AUTH_SOCK=""

REMOTE="CHANGE_ME@CHANGE_ME"          # TODO: utilisateur@domaine de l'hébergement BetNaBiso
REMOTE_ROOT="/CHANGE_ME"              # TODO: chemin racine sur le serveur
LOCAL_FRONT="/Users/mac/Desktop/bet na biso/BetNaBiso_Plateform/betnabiso/dist/betnabiso/browser/"
LOCAL_API="/Users/mac/Desktop/bet na biso/BetNaBiso_Plateform/betnabiso-api/"

MODE="${1:-all}"

if [[ "$MODE" == "frontend" || "$MODE" == "all" ]]; then
  echo "→ Déploiement Angular (sans toucher api/)..."
  SSH_AUTH_SOCK="" sshpass -e rsync -az --delete --exclude=api/ \
    -e "ssh $SSH_OPTS" \
    "$LOCAL_FRONT" "$REMOTE:$REMOTE_ROOT/"
  echo "✓ Frontend déployé"
fi

if [[ "$MODE" == "api" || "$MODE" == "all" ]]; then
  echo "→ Déploiement PHP API..."
  SSH_AUTH_SOCK="" sshpass -e rsync -az \
    -e "ssh $SSH_OPTS" \
    "$LOCAL_API" "$REMOTE:$REMOTE_ROOT/api/"
  # TODO: adapter cette correction DB_USER post-déploiement à l'hébergement BetNaBiso (celui de l'ancien client a été retiré)
  # SSH_AUTH_SOCK="" sshpass -e ssh $SSH_OPTS "$REMOTE" \
  #   "sed -i \"s/define('DB_USER', 'CHANGE_ME')/define('DB_USER', 'CHANGE_ME')/\" $REMOTE_ROOT/api/config.php 2>/dev/null; echo OK"
  echo "✓ API déployée"
fi

echo "→ Vérification API..."
RESP=$(SSH_AUTH_SOCK="" sshpass -e ssh $SSH_OPTS "$REMOTE" \
  "curl -s https://CHANGE_ME/api/auth -X POST -H 'Content-Type: application/json' -d '{}' 2>&1 | head -c 100")
if echo "$RESP" | grep -q '"error"'; then
  echo "✓ API répond correctement: $RESP"
else
  echo "⚠ Réponse inattendue: $RESP"
fi
