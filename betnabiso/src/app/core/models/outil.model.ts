export type OutilType = 'lien' | 'fichier';

export interface Outil {
  id: string;
  label: string;
  description?: string;
  categorie?: string;
  type: OutilType;
  url: string;
  fileName?: string;
  fileSize?: number;
  icone?: string;
  ordre: number;
  createdAt?: string;
}

export const OUTIL_ICON_PRESETS: string[] = [
  'download', 'build', 'construction', 'terminal', 'settings_applications',
  'desktop_windows', 'router', 'print', 'qr_code_scanner', 'security',
  'folder_zip', 'description',
];
