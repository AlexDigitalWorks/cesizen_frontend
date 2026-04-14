import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  username: string;
}

export interface AuthResponse {
  token?: string;
  accessToken?: string;
  jwt?: string;
  role?: string;
  roles?: string[];
  authorities?: string[];
  isAdmin?: boolean;
  [key: string]: unknown;
}

const AUTH_STORAGE_KEY = 'cesizen.auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly session = signal<AuthResponse | null>(this.readStoredSession());
  readonly authenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.resolveIsAdmin(this.session()));

  constructor(private readonly http: HttpClient) {}

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', payload)
      .pipe(tap((response) => this.persistSession(response)));
  }

  register(payload: RegisterRequest): Observable<void> {
    return this.http.post<void>('/api/auth/register', payload);
  }

  logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.session.set(null);
  }

  getAccessToken(): string | null {
    const session = this.session();
    if (!session) {
      return null;
    }

    const rawToken = [session.accessToken, session.token, session.jwt].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    );

    return rawToken ?? null;
  }

  private persistSession(response: AuthResponse): void {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response));
    this.session.set(response);
  }

  private readStoredSession(): AuthResponse | null {
    const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawSession);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as AuthResponse)
        : null;
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  }

  private resolveIsAdmin(session: AuthResponse | null): boolean {
    if (!session) {
      return false;
    }

    if (session.isAdmin === true) {
      return true;
    }

    const directRoles = this.normalizeRoles([
      session.role,
      session.roles,
      session.authorities
    ]);

    if (this.containsAdminRole(directRoles)) {
      return true;
    }

    const tokenPayload = this.decodeJwtPayload(this.getAccessToken());
    if (!tokenPayload) {
      return false;
    }

    if (tokenPayload['isAdmin'] === true) {
      return true;
    }

    const tokenRoles = this.normalizeRoles([
      tokenPayload['role'],
      tokenPayload['roles'],
      tokenPayload['authorities'],
      tokenPayload['scope'],
      tokenPayload['scopes']
    ]);

    return this.containsAdminRole(tokenRoles);
  }

  private normalizeRoles(values: unknown[]): string[] {
    return values.flatMap((value) => {
      if (typeof value === 'string') {
        return value.split(/[,\s]+/).filter(Boolean);
      }

      if (Array.isArray(value)) {
        return value.filter((entry): entry is string => typeof entry === 'string');
      }

      return [];
    });
  }

  private containsAdminRole(roles: string[]): boolean {
    return roles.some((role) => {
      const normalizedRole = role.trim().toUpperCase();
      return normalizedRole === 'ADMIN' || normalizedRole === 'ROLE_ADMIN';
    });
  }

  private decodeJwtPayload(token: string | null): Record<string, unknown> | null {
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const json = atob(paddedBase64);
      const parsed = JSON.parse(json);

      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}
