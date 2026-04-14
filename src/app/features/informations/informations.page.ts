import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, finalize, of, timeout } from 'rxjs';
import { AuthService } from '../auth/auth.service';

type ResourceItem = {
  id: number;
  title: string;
  description: string | null;
  content: string | null;
};

@Component({
  selector: 'app-informations-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './informations.page.html',
  styleUrl: './informations.page.css'
})
export class InformationsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  readonly authService = inject(AuthService);

  readonly resources = signal<ResourceItem[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly isSaving = signal(false);
  readonly saveError = signal('');
  readonly saveSuccess = signal('');
  readonly editingId = signal<number | null>(null);

  readonly editForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    content: ['']
  });

  ngOnInit(): void {
    this.loadResources();
  }

  toggleResource(id: number): void {
    this.selectedId.update((currentId) => currentId === id ? null : id);
  }

  startEdit(resource: ResourceItem, event: Event): void {
    event.stopPropagation();

    if (!this.authService.isAdmin()) {
      return;
    }

    this.selectedId.set(resource.id);
    this.editingId.set(resource.id);
    this.saveError.set('');
    this.saveSuccess.set('');
    this.editForm.setValue({
      title: resource.title,
      description: resource.description ?? '',
      content: resource.content ?? ''
    });
  }

  cancelEdit(event?: Event): void {
    event?.stopPropagation();
    this.editingId.set(null);
    this.saveError.set('');
    this.saveSuccess.set('');
    this.editForm.reset({
      title: '',
      description: '',
      content: ''
    });
  }

  saveResource(resourceId: number, event: Event): void {
    event.stopPropagation();
    this.saveError.set('');
    this.saveSuccess.set('');

    if (!this.authService.isAdmin()) {
      this.saveError.set('Seuls les administrateurs peuvent modifier un article.');
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formValue = this.editForm.getRawValue();
    const payload: ResourceItem = {
      id: resourceId,
      title: formValue.title.trim(),
      description: formValue.description.trim() || null,
      content: formValue.content.trim() || null
    };

    this.http
      .put<ResourceItem>(`/api/resources/${resourceId}`, payload)
      .pipe(
        timeout({ first: 8000 }),
        finalize(() => {
          this.isSaving.set(false);
        })
      )
      .subscribe({
        next: (updatedResource) => {
          this.resources.update((currentResources) =>
            currentResources.map((resource) =>
              resource.id === resourceId ? { ...resource, ...updatedResource } : resource
            )
          );
          this.saveSuccess.set('Article mis a jour.');
          this.editingId.set(null);
        },
        error: (error: unknown) => {
          console.error('Resource update failed', error);
          this.saveError.set("La mise a jour de l'article a echoue.");
        }
      });
  }

  private loadResources(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.http
      .get<ResourceItem[]>('/api/resources/all')
      .pipe(
        timeout({ first: 8000 }),
        catchError((error) => {
          console.error('Resource load failed', error);
          this.hasError.set(true);
          return of([]);
        }),
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe((data) => {
        this.resources.set(data ?? []);
      });
  }
}
