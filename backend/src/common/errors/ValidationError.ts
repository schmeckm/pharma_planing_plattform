import { AppError } from './AppError';

export class ValidationError extends AppError {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message, 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}
