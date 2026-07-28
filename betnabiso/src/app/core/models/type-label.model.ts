export type TypeCategorie = 'intervention' | 'mission' | 'panne' | 'outil';

export interface TypeLabel {
  id: string;
  categorie: TypeCategorie;
  label: string;
  icone?: string;
  ordre: number;
  createdAt?: string;
}

// Sélection d'icônes Material courantes proposées dans l'admin, sans prétendre à l'exhaustivité.
export const TYPE_ICON_PRESETS: string[] = [
  'computer', 'search', 'settings', 'build', 'school', 'sync_alt', 'help',
  'directions_car', 'description', 'engineering', 'local_shipping', 'event',
  'assignment', 'wifi_off', 'security', 'inventory_2', 'print', 'qr_code_scanner',
  'point_of_sale', 'dns',
];
