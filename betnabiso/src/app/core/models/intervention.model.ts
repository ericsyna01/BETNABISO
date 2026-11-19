export type InterventionStatut = 'Assignée' | 'En cours' | 'Terminée' | 'Échec';
// Type paramétrable par un admin (voir TypeLabelService, catégorie 'intervention').
export type InterventionType = string;
export type InterventionPriorite = 'Haute' | 'Normale' | 'Basse';

export interface Intervention {
  id: string;
  agentId: string;
  agentNom: string;
  agentZone: string;
  technicienId: string;
  technicienNom: string;
  /* Champs d'affectation (remplis par le Support) */
  assignedById?: string;
  assignedByNom?: string;
  assignedAt?: string;
  priorite?: InterventionPriorite;
  datePlanifiee?: string;
  type: InterventionType;
  dateDebut: string;
  dateFin?: string;
  duree?: number;
  description: string;
  statut: InterventionStatut;
  observations?: string;
  pieceJointe?: string;
  /* Message vocal joint au signalement d'origine (voir self-service.php) */
  audioMessage?: string;
  deplacementRequis?: boolean;
  deplacementNote?: string;
  deplacementRequestedBy?: string;
  deplacementRequestedAt?: string;
  deplacementValide?: boolean;
  deplacementValideBy?: string;
  deplacementValideAt?: string;
  deplacementRefuse?: boolean;
  deplacementRefuseBy?: string;
  deplacementTermine?: boolean;
  chauffeurId?: string;
  chauffeurNom?: string;
  /* Traçabilité : intervention créée à partir d'un signalement libre-service (QR code) */
  viaSignalement?: boolean;
  signalementNotifId?: string;
  /* Intervention "En cours" bloquée en attente (agent injoignable, pièce...) :
     dernier mini-rapport en date ; l'historique complet est dans les suivis. */
  attenteMotif?: AttenteMotif | null;
  attenteNote?: string | null;
  attenteDepuis?: string | null;
  attenteMaj?: string | null;
}

export type AttenteMotif = 'agent' | 'materiel' | 'reseau' | 'tiers' | 'autre';

export const ATTENTE_MOTIFS: { value: AttenteMotif; label: string; short: string; icon: string }[] = [
  { value: 'agent',    label: "En attente de l'agent",          short: 'Attente agent',    icon: 'person_search' },
  { value: 'materiel', label: 'En attente de matériel / pièce', short: 'Attente matériel', icon: 'inventory_2' },
  { value: 'reseau',   label: 'Réseau ou électricité coupé',     short: 'Réseau / courant', icon: 'signal_wifi_off' },
  { value: 'tiers',    label: "En attente d'un tiers",           short: 'Attente tiers',    icon: 'support_agent' },
  { value: 'autre',    label: 'Autre raison',                    short: 'En attente',       icon: 'more_horiz' },
];

export interface InterventionSuivi {
  id: string;
  auteurId: string;
  auteurNom: string | null;
  type: 'attente' | 'reprise';
  motif: AttenteMotif | null;
  note: string | null;
  createdAt: string;
}

/** Au-delà de ce délai sans nouveau mini-rapport, l'attente est signalée comme à relancer. */
export const ATTENTE_RELANCE_HEURES = 24;

export interface ReassignmentLog {
  id: string;
  interventionId: string;
  agentNom: string;
  agentZone?: string;
  fromTechId?: string;
  fromTechNom?: string;
  toTechId?: string;
  toTechNom?: string;
  reassignedById?: string;
  reassignedByNom?: string;
  assignedAt?: string;
  reassignedAt: string;
  minutesBefore?: number | null;
}

export interface TechMonthlyStats {
  technicienId: string;
  technicienNom: string;
  total: number;
  terminees: number;
  echecs: number;
  enCours: number;
  dureeMoy: number | null;
}

export const PRIORITES: InterventionPriorite[] = ['Haute', 'Normale', 'Basse'];
