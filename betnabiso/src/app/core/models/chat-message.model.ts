export interface ChatAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  isImage: boolean;
}

export interface ChatMessage {
  id: string;
  fromId: string;
  fromNom: string;
  fromRole: string;
  toId: string;
  toNom: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  attachment?: ChatAttachment | null;
}

export interface GroupChat {
  id: string;
  name: string;
  createdById: string;
  createdByNom?: string;
  createdAt: string;
  members: string[];
}

export interface GroupMessage {
  id: string;
  groupId: string;
  fromId: string;
  fromNom: string;
  fromRole: string;
  content: string;
  createdAt: string;
  attachment?: ChatAttachment | null;
}
