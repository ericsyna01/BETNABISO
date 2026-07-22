export interface Creneau {
  id: string;
  label: string;
  heureDebut: string; // HH:mm
  heureFin: string;   // HH:mm
  couleurTexte: string; // hex
  couleurFond: string;  // hex
  ordre: number;
  createdAt?: string;
}

export const CRENEAU_PALETTE: { texte: string; fond: string }[] = [
  { texte: '#1565c0', fond: '#e3f2fd' },
  { texte: '#e65100', fond: '#fff3e0' },
  { texte: '#2e7d32', fond: '#e8f5e9' },
  { texte: '#6a1b9a', fond: '#f3e5f5' },
  { texte: '#00838f', fond: '#e0f7fa' },
  { texte: '#ad1457', fond: '#fce4ec' },
  { texte: '#4527a0', fond: '#ede7f6' },
  { texte: '#37474f', fond: '#eceff1' },
];
