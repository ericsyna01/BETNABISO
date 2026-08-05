export interface AgendaItem {
  id: string;
  userId: string;
  titre: string;
  note?: string;
  dateRappel: string;
  heure?: string;
  fait: boolean;
  createdAt: string;
}
