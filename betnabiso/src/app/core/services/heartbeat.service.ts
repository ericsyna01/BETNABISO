import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MachineInfo {
  online: boolean;
  lastSeen: string;
  minutesAgo: number;
  ip: string;
  duplicateSuspected?: boolean;
  firstSeen?: string;
  onlineSince?: string | null;
}

export interface AgentMachineStatus {
  caisse:  MachineInfo | null;
  serveur: MachineInfo | null;
}

export interface MachineSummary {
  caisseOnline:        number;
  serveurOnline:       number;
  totalMonitored:      number;
  duplicatesSuspected: number;
  longOnlineAgents:    number;
}

export function formatMinutesAgo(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const days  = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return hours > 0 ? `${days}j ${hours}h` : `${days}j`;
  return `${hours}h`;
}

const HB_LONG_ONLINE_MS = 24 * 60 * 60 * 1000;

export function isLongOnline(m: MachineInfo | null | undefined): boolean {
  if (!m?.online || !m.onlineSince) return false;
  return Date.now() - new Date(m.onlineSince).getTime() >= HB_LONG_ONLINE_MS;
}

export function formatOnlineSince(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return formatMinutesAgo(Math.max(0, minutes));
}

const HB_LONG_OFFLINE_MIN = 24 * 60;

export function isLongOffline(m: MachineInfo | null | undefined): boolean {
  if (!m || m.online) return false;
  return m.minutesAgo >= HB_LONG_OFFLINE_MIN;
}

@Injectable({ providedIn: 'root' })
export class HeartbeatService {
  private http = inject(HttpClient);
  private api  = `${environment.apiUrl}/heartbeat`;

  async getStatus(agentId: string): Promise<AgentMachineStatus> {
    return firstValueFrom(
      this.http.get<AgentMachineStatus>(`${this.api}/${agentId}`)
    );
  }

  async getSummary(): Promise<MachineSummary> {
    return firstValueFrom(
      this.http.get<MachineSummary>(`${this.api}/summary`)
    );
  }

  async getAllStatuses(): Promise<Record<string, AgentMachineStatus>> {
    return firstValueFrom(
      this.http.get<Record<string, AgentMachineStatus>>(`${this.api}/all`)
    );
  }
}
