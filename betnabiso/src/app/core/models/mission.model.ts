export type MissionStatut = 'assignée' | 'acceptée' | 'en_cours' | 'terminée' | 'refusée';
// Type paramétrable par un admin (voir TypeLabelService, catégorie 'mission').
export type MissionType   = string;

export interface Mission {
  id: string;
  titre: string;
  description: string;
  type: MissionType;
  priorite: 'Haute' | 'Normale' | 'Basse';
  assignedToId: string;
  assignedToNom: string;
  assignedToId2?: string;
  assignedToNom2?: string;
  /* Agent (point de vente) concerné par la mission, s'il y en a un */
  agentId?: string | null;
  agentNom?: string | null;
  assignedById: string;
  assignedByNom: string;
  dateMission: string;
  statut: MissionStatut;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}
