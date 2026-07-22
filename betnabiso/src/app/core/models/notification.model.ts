export type NotifStatut = 'non_lue' | 'lue' | 'traitée';
export type NotifType = 'agent_modification' | 'deplacement_requis' | 'prise_en_charge' | 'intervention_assignee' | 'mission_assignee' | 'machine_offline' | 'signalement_panne' | 'planning_assigne';

export interface AgentNotif {
  id: string;
  type: NotifType;
  agentId?: string;
  agentNom?: string;
  technicienId?: string;
  interventionId?: string;
  requestedById?: string;
  requestedByNom?: string;
  requestedByRole?: string;
  message: string;
  statut: NotifStatut;
  createdAt: string;
  photoUrl?: string | null;
}
