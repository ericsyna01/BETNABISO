export interface MailSettings {
  host: string;
  port: number;
  ssl: boolean;
  username: string;
  password: string;
}

export interface MailPreview {
  uid: number;
  num: number;
  from: string;
  fromName: string;
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
}

export interface MailMessage extends MailPreview {
  to: string;
  body: string;
  isHtml: boolean;
}

export const MAIL_PROVIDERS = [
  { name: 'Gmail',           host: 'imap.gmail.com',            port: 993, ssl: true },
  { name: 'Outlook/Hotmail', host: 'outlook.office365.com',     port: 993, ssl: true },
  { name: 'Yahoo Mail',      host: 'imap.mail.yahoo.com',       port: 993, ssl: true },
  { name: 'OVH',             host: 'ssl0.ovh.net',              port: 993, ssl: true },
  { name: 'Infomaniak',      host: 'mail.infomaniak.com',       port: 993, ssl: true },
  { name: 'Autre (manuel)',  host: '',                          port: 993, ssl: true },
];
