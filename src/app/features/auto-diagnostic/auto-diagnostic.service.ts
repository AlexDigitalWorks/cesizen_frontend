import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AutoDiagnosticChoiceDto {
  score: number;
  label: string;
}

export interface AutoDiagnosticQuestionDto {
  id: number;
  title: string;
  questionText: string;
  helperText: string | null;
  sortOrder: number;
  active: boolean;
  choices: AutoDiagnosticChoiceDto[];
}

export interface AutoDiagnosticAnswerRequestDto {
  questionId: number;
  selectedScore: number;
}

export interface AutoDiagnosticSubmitRequestDto {
  answers: AutoDiagnosticAnswerRequestDto[];
}

export interface AutoDiagnosticAnswerResultDto {
  questionId: number;
  selectedScore: number;
  answerLabel: string;
}

export interface AutoDiagnosticResultDto {
  id: number;
  totalScore: number;
  maxScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  submittedAt: string;
  answers: AutoDiagnosticAnswerResultDto[];
}

export interface AdminAutoDiagnosticQuestionDto {
  id: number;
  title: string;
  questionText: string;
  helperText: string | null;
  sortOrder: number;
  active: boolean;
  choices?: AutoDiagnosticChoiceDto[];
}

export interface AdminAutoDiagnosticQuestionPayloadDto {
  title: string;
  questionText: string;
  helperText: string | null;
  sortOrder: number;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AutoDiagnosticService {
  private readonly http = inject(HttpClient);

  getQuestions(): Observable<AutoDiagnosticQuestionDto[]> {
    return this.http.get<AutoDiagnosticQuestionDto[]>('/api/auto-diagnostic/questions');
  }

  submit(payload: AutoDiagnosticSubmitRequestDto): Observable<AutoDiagnosticResultDto> {
    return this.http.post<AutoDiagnosticResultDto>('/api/auto-diagnostic/submit', payload);
  }

  getAdminQuestions(): Observable<AdminAutoDiagnosticQuestionDto[]> {
    return this.http.get<AdminAutoDiagnosticQuestionDto[]>('/api/auto-diagnostic/admin/questions');
  }

  createAdminQuestion(
    payload: AdminAutoDiagnosticQuestionPayloadDto
  ): Observable<AdminAutoDiagnosticQuestionDto> {
    return this.http.post<AdminAutoDiagnosticQuestionDto>(
      '/api/auto-diagnostic/admin/questions',
      payload
    );
  }

  updateAdminQuestion(
    id: number,
    payload: AdminAutoDiagnosticQuestionPayloadDto
  ): Observable<AdminAutoDiagnosticQuestionDto> {
    return this.http.put<AdminAutoDiagnosticQuestionDto>(
      `/api/auto-diagnostic/admin/questions/${id}`,
      payload
    );
  }

  deleteAdminQuestion(id: number): Observable<void> {
    return this.http.delete<void>(`/api/auto-diagnostic/admin/questions/${id}`);
  }
}
