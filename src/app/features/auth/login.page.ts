import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, RegisterRequest } from './auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  standalone: true,
  templateUrl: './login.page.html',
  styleUrl: './login.page.css'
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly mode = signal<'login' | 'register'>('login');

  readonly form = this.formBuilder.nonNullable.group({
    username: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  isLoginMode(): boolean {
    return this.mode() === 'login';
  }

  setMode(mode: 'login' | 'register'): void {
    if (this.mode() === mode) {
      return;
    }

    this.mode.set(mode);
    this.updateUsernameValidation(mode);
    this.submitted.set(false);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  submit(): void {
    this.submitted.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const payload = this.form.getRawValue();

    if (this.isLoginMode()) {
      this.authService
        .login({
          email: payload.email,
          password: payload.password
        })
        .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigateByUrl('/acceuil');
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(this.extractErrorMessage(error));
        }
        });
      return;
    }

    const registerPayload: RegisterRequest = {
      username: payload.username,
      email: payload.email,
      password: payload.password
    };

    this.authService.register(registerPayload).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set(
          'Compte cree. Vous pouvez maintenant vous connecter.'
        );
        this.mode.set('login');
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(this.extractErrorMessage(error));
      }
    });
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = this.getBackendMessage(error.error);
      if (backendMessage) {
        return backendMessage;
      }

      if (error.status === 0) {
        return "Impossible de joindre l'API d'authentification.";
      }
    }

    return this.isLoginMode()
      ? 'Connexion impossible avec ces identifiants.'
      : "Inscription impossible avec ces informations.";
  }

  private getBackendMessage(payload: unknown): string | null {
    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string' &&
      payload.message.trim()
    ) {
      return payload.message;
    }

    return null;
  }

  private updateUsernameValidation(mode: 'login' | 'register'): void {
    const usernameControl = this.form.controls.username;

    if (mode === 'register') {
      usernameControl.addValidators(Validators.required);
    } else {
      usernameControl.removeValidators(Validators.required);
    }

    usernameControl.updateValueAndValidity();
  }
}
