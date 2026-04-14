import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  AdminAutoDiagnosticQuestionDto,
  AdminAutoDiagnosticQuestionPayloadDto,
  AutoDiagnosticQuestionDto,
  AutoDiagnosticResultDto,
  AutoDiagnosticService
} from './auto-diagnostic.service';

@Component({
  selector: 'app-auto-diagnostic-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './auto-diagnostic.page.html',
  styleUrl: './auto-diagnostic.page.css'
})
export class AutoDiagnosticPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly autoDiagnosticService = inject(AutoDiagnosticService);
  readonly authService = inject(AuthService);

  readonly questions = signal<AutoDiagnosticQuestionDto[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal('');

  readonly submitError = signal('');
  readonly submitSuccess = signal('');
  readonly isSubmitting = signal(false);
  readonly result = signal<AutoDiagnosticResultDto | null>(null);

  readonly adminQuestions = signal<AdminAutoDiagnosticQuestionDto[]>([]);
  readonly adminLoading = signal(false);
  readonly adminError = signal('');
  readonly adminSubmitError = signal('');
  readonly adminSubmitSuccess = signal('');
  readonly adminDeleteError = signal('');
  readonly isAdminSaving = signal(false);
  readonly editingAdminId = signal<number | null>(null);

  readonly diagnosticForm = new FormRecord<FormControl<number | null>>({});
  readonly adminQuestionForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required]],
    questionText: ['', [Validators.required]],
    helperText: [''],
    sortOrder: [1, [Validators.required, Validators.min(1)]],
    active: [true]
  });

  private readonly adminEffect = effect(() => {
    if (this.authService.isAdmin()) {
      this.loadAdminQuestions();
      return;
    }

    this.adminQuestions.set([]);
    this.adminError.set('');
    this.editingAdminId.set(null);
  });

  ngOnInit(): void {
    this.loadQuestions();
    this.resetAdminForm();
  }

  getAnswerControl(questionId: number): FormControl<number | null> {
    return this.diagnosticForm.controls[this.getQuestionControlName(questionId)];
  }

  selectChoice(questionId: number, score: number, event?: Event): void {
    event?.stopPropagation();
    this.getAnswerControl(questionId).setValue(score);
    this.getAnswerControl(questionId).markAsTouched();
  }

  submitDiagnostic(): void {
    this.submitError.set('');
    this.submitSuccess.set('');

    if (!this.authService.authenticated()) {
      this.submitError.set(
        "Connectez-vous pour envoyer votre auto-diagnostic. Vous pouvez toutefois consulter les questions."
      );
      return;
    }

    if (this.diagnosticForm.invalid) {
      this.diagnosticForm.markAllAsTouched();
      this.submitError.set('Veuillez répondre à toutes les questions avant de soumettre.');
      return;
    }

    const payload = {
      answers: this.questions().map((question) => ({
        questionId: question.id,
        selectedScore: this.getAnswerControl(question.id).value as number
      }))
    };

    this.isSubmitting.set(true);
    this.autoDiagnosticService
      .submit(payload)
      .pipe(
        timeout({ first: 8000 }),
        finalize(() => {
          this.isSubmitting.set(false);
        })
      )
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.submitSuccess.set('Votre auto-diagnostic a bien été enregistré.');
          this.submitError.set('');
        },
        error: (error: unknown) => {
          console.error('Auto diagnostic submit failed', error);
          this.submitError.set("L'envoi de l'auto-diagnostic a échoué.");
        }
      });
  }

  startAdminEdit(question: AdminAutoDiagnosticQuestionDto): void {
    this.editingAdminId.set(question.id);
    this.adminSubmitError.set('');
    this.adminSubmitSuccess.set('');
    this.adminQuestionForm.setValue({
      title: question.title,
      questionText: question.questionText,
      helperText: question.helperText ?? '',
      sortOrder: question.sortOrder,
      active: question.active
    });
  }

  resetAdminForm(): void {
    this.editingAdminId.set(null);
    this.adminSubmitError.set('');
    this.adminSubmitSuccess.set('');
    this.adminQuestionForm.reset({
      title: '',
      questionText: '',
      helperText: '',
      sortOrder: this.getNextSortOrder(),
      active: true
    });
  }

  saveAdminQuestion(): void {
    this.adminSubmitError.set('');
    this.adminSubmitSuccess.set('');

    if (!this.authService.isAdmin()) {
      this.adminSubmitError.set('Seuls les administrateurs peuvent gérer les questions.');
      return;
    }

    if (this.adminQuestionForm.invalid) {
      this.adminQuestionForm.markAllAsTouched();
      return;
    }

    this.isAdminSaving.set(true);
    const currentEditingId = this.editingAdminId();
    const formValue = this.adminQuestionForm.getRawValue();
    const payload: AdminAutoDiagnosticQuestionPayloadDto = {
      title: formValue.title.trim(),
      questionText: formValue.questionText.trim(),
      helperText: formValue.helperText.trim() || null,
      sortOrder: Number(formValue.sortOrder),
      active: formValue.active
    };

    const request$ = currentEditingId === null
      ? this.autoDiagnosticService.createAdminQuestion(payload)
      : this.autoDiagnosticService.updateAdminQuestion(currentEditingId, payload);

    request$
      .pipe(
        timeout({ first: 8000 }),
        finalize(() => {
          this.isAdminSaving.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.adminSubmitSuccess.set(
            currentEditingId === null ? 'Question créée.' : 'Question mise à jour.'
          );
          this.loadQuestions();
          this.loadAdminQuestions();
          this.resetAdminForm();
        },
        error: (error: unknown) => {
          console.error('Admin question save failed', error);
          this.adminSubmitError.set("L'enregistrement de la question a échoué.");
        }
      });
  }

  toggleAdminQuestionActive(question: AdminAutoDiagnosticQuestionDto): void {
    this.adminSubmitError.set('');
    this.adminSubmitSuccess.set('');
    this.isAdminSaving.set(true);

    const payload: AdminAutoDiagnosticQuestionPayloadDto = {
      title: question.title,
      questionText: question.questionText,
      helperText: question.helperText,
      sortOrder: question.sortOrder,
      active: !question.active
    };

    this.autoDiagnosticService
      .updateAdminQuestion(question.id, payload)
      .pipe(
        timeout({ first: 8000 }),
        finalize(() => {
          this.isAdminSaving.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.adminSubmitSuccess.set(
            payload.active ? 'Question réactivée.' : 'Question désactivée.'
          );
          this.loadQuestions();
          this.loadAdminQuestions();
        },
        error: (error: unknown) => {
          console.error('Admin question toggle failed', error);
          this.adminSubmitError.set("Le changement d'état a échoué.");
        }
      });
  }

  deleteAdminQuestion(questionId: number): void {
    this.adminDeleteError.set('');
    this.adminSubmitSuccess.set('');
    this.isAdminSaving.set(true);

    this.autoDiagnosticService
      .deleteAdminQuestion(questionId)
      .pipe(
        timeout({ first: 8000 }),
        finalize(() => {
          this.isAdminSaving.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.adminSubmitSuccess.set('Question supprimée.');
          if (this.editingAdminId() === questionId) {
            this.resetAdminForm();
          }
          this.loadQuestions();
          this.loadAdminQuestions();
        },
        error: (error: unknown) => {
          console.error('Admin question delete failed', error);
          this.adminDeleteError.set('La suppression de la question a échoué.');
        }
      });
  }

  severityLabel(severity: string | null | undefined): string {
    switch (severity) {
      case 'LOW':
        return 'Faible';
      case 'MEDIUM':
        return 'Modéré';
      case 'HIGH':
        return 'Élevé';
      default:
        return severity ?? 'Inconnu';
    }
  }

  severityMessage(severity: string | null | undefined): string {
    switch (severity) {
      case 'LOW':
        return 'Votre score semble bas. Continuez à surveiller votre équilibre personnel au quotidien.';
      case 'MEDIUM':
        return 'Votre score invite à une vigilance accrue. Prenez le temps d’identifier les facteurs qui pèsent le plus.';
      case 'HIGH':
        return 'Votre score est élevé. Il peut être utile d’en parler rapidement avec un professionnel ou une personne de confiance.';
      default:
        return 'Analyse disponible.';
    }
  }

  formatSubmittedAt(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  trackByQuestionId(question: AutoDiagnosticQuestionDto): number {
    return question.id;
  }

  trackByAdminQuestionId(question: AdminAutoDiagnosticQuestionDto): number {
    return question.id;
  }

  private loadQuestions(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.autoDiagnosticService
      .getQuestions()
      .pipe(
        timeout({ first: 8000 }),
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe({
        next: (questions) => {
          const sortedQuestions = [...questions].sort(
            (left, right) => left.sortOrder - right.sortOrder
          );
          this.questions.set(sortedQuestions);
          this.syncDiagnosticForm(sortedQuestions);
        },
        error: (error: unknown) => {
          console.error('Auto diagnostic questions load failed', error);
          this.loadError.set("Impossible de charger l'auto-diagnostic pour le moment.");
        }
      });
  }

  private loadAdminQuestions(): void {
    if (!this.authService.isAdmin()) {
      return;
    }

    this.adminLoading.set(true);
    this.adminError.set('');

    this.autoDiagnosticService
      .getAdminQuestions()
      .pipe(
        timeout({ first: 8000 }),
        finalize(() => {
          this.adminLoading.set(false);
        })
      )
      .subscribe({
        next: (questions) => {
          this.adminQuestions.set(
            [...questions].sort((left, right) => left.sortOrder - right.sortOrder)
          );

          if (this.editingAdminId() === null) {
            this.adminQuestionForm.patchValue({
              sortOrder: this.getNextSortOrder()
            });
          }
        },
        error: (error: unknown) => {
          console.error('Admin questions load failed', error);
          this.adminError.set("Impossible de charger la gestion admin des questions.");
        }
      });
  }

  private syncDiagnosticForm(questions: AutoDiagnosticQuestionDto[]): void {
    const expectedControlNames = new Set(
      questions.map((question) => this.getQuestionControlName(question.id))
    );

    for (const question of questions) {
      const controlName = this.getQuestionControlName(question.id);
      const existingControl = this.diagnosticForm.controls[controlName];
      if (existingControl) {
        existingControl.setValidators([Validators.required]);
        existingControl.updateValueAndValidity({ emitEvent: false });
        continue;
      }

      this.diagnosticForm.addControl(
        controlName,
        new FormControl<number | null>(null, {
          validators: [Validators.required]
        })
      );
    }

    for (const controlName of Object.keys(this.diagnosticForm.controls)) {
      if (!expectedControlNames.has(controlName)) {
        this.diagnosticForm.removeControl(controlName);
      }
    }
  }

  private getQuestionControlName(questionId: number): string {
    return `question_${questionId}`;
  }

  private getNextSortOrder(): number {
    const sortOrders = this.adminQuestions().map((question) => question.sortOrder);
    return sortOrders.length === 0 ? 1 : Math.max(...sortOrders) + 1;
  }
}
