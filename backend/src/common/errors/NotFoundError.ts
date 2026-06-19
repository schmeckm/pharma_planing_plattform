import { AppError } from './AppError';

export class NotFoundError extends AppError {
  readonly resource: string;
  readonly identifier: string;

  constructor(resource: string, identifier: string) {
    super(`${resource} '${identifier}' not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    this.resource = resource;
    this.identifier = identifier;
  }
}
