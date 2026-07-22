-- Migration: création de la table missions
-- Exécuter: psql -U mac betnabiso -f migrations/add_missions_table.sql

CREATE TABLE IF NOT EXISTS missions (
    id               CHAR(32)     PRIMARY KEY,
    titre            VARCHAR(255) NOT NULL,
    description      TEXT         DEFAULT NULL,
    type             VARCHAR(50)  NOT NULL DEFAULT 'Autre',
    priorite         VARCHAR(20)  NOT NULL DEFAULT 'Normale',
    "assignedToId"   CHAR(36)     NOT NULL,
    "assignedToNom"  VARCHAR(200) NOT NULL,
    "assignedById"   CHAR(36)     NOT NULL,
    "assignedByNom"  VARCHAR(200) NOT NULL,
    "dateMission"    DATE         NOT NULL,
    statut           VARCHAR(30)  NOT NULL DEFAULT 'assignée',
    notes            TEXT         DEFAULT NULL,
    "createdAt"      TIMESTAMP    NOT NULL DEFAULT NOW(),
    "completedAt"    TIMESTAMP    DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_missions_assigned ON missions("assignedToId");
CREATE INDEX IF NOT EXISTS idx_missions_statut   ON missions(statut);
