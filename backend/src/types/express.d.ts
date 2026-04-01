import 'express';

// Extend Express Request type
declare module 'express' {
  export interface Request {
    ip?: string;
    connection?: {
      remoteAddress?: string;
    };
    headers?: Record<string, string | string[] | undefined>;
    user?: any;
  }
}

// Extend Response type
declare module 'express-serve-static-core' {
  export interface Response {
    setHeader(name: string, value: string | number | string[]): this;
    status(code: number): this;
  }
}
