// Le créneau est identifié par son label (paramétrable par un admin, voir CreneauService),
// donc un simple string plutôt qu'une union figée.
export type TypeCreneau = string;

export interface PlanningEntry {
  id: string;
  userId: string;
  userNom: string;
  userRole: string;
  date: string; // YYYY-MM-DD
  type: TypeCreneau;
  heureDebut: string; // HH:mm
  heureFin: string;   // HH:mm
  note?: string;
  createdAt?: string;
}
