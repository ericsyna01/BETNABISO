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
}

export function formatMinutesAgo(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const days  = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return hours > 0 ? `${days}j ${hours}h` : `${days}j`;
  return `${hours}h`;
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
