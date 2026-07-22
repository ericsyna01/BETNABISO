import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TechLocation {
  userId: string;
  userNom: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

const API = `${environment.apiUrl}/locations`;

@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);
  private watchId: number | null = null;

  startTracking(): void {
    if (!navigator.geolocation || this.watchId !== null) return;
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.push(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
    );
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async getAll(): Promise<TechLocation[]> {
    try {
      return await firstValueFrom(this.http.get<TechLocation[]>(API));
    } catch { return []; }
  }

  private async push(lat: number, lng: number): Promise<void> {
    try {
      await firstValueFrom(this.http.post(API, { lat, lng }));
    } catch { /* silent */ }
  }
}
