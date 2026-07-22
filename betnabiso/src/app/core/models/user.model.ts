export type UserRole = 'superadmin' | 'admin' | 'support' | 'technicien' | 'chauffeur';

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  username: string;
  password?: string;
  role: UserRole;
  roles?: UserRole[];
  zone?: string;
  actif: boolean;
  createdAt: string;
  lastLogin?: string;
  mustChangePassword?: boolean;
}

export interface AuthUser extends Omit<User, 'password'> {
  token: string;
}
