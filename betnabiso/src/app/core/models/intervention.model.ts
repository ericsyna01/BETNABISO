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
}

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
