export type AgentStatut = 'Actif' | 'Inactif' | 'Redéployé' | 'À redéployer';

export interface Agent {
  id: string;
  nomAgent: string;
  nomResponsable: string;
  identifiant: string;
  numero: string;
  localisation?: { lat: number; lng: number };
  anydesk: string;
  numeroCaisse: string;
  anydesk_serveur: string;
  teamCaisse: string;
  teamServeur: string;
  redeploiement?: string;
  redeploieVersId?: string;
  redeploieVersNom?: string;
  date: string;
  statut: AgentStatut;
  zone: string;
  feuillet?: string;
  publicToken?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export const ZONES = [
  'Médina', 'Parcelles', 'Pikine', 'Tivaouane Peul',
  'Plateau', 'Rufisque', 'Grand Dakar', 'Guédiawaye', 'Autre'
];
