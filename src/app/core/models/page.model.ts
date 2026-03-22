/** Paginazione Spring Data (`Page<T>`) come restituita dal backend. */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}
