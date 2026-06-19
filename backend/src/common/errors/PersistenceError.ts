import { AppError } from './AppError';

export class PersistenceError extends AppError {
  constructor(message: string) {
    super(message, 500, 'PERSISTENCE_ERROR');
    this.name = 'PersistenceError';
  }
}
