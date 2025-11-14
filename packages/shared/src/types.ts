// Shared types
export type ApiResponse<T> = {
  data?: T;
  error?: string;
  success: boolean;
};

