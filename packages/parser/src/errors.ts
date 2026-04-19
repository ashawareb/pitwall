import type { ZodIssue } from 'zod';

export interface ParseErrorOptions {
  lineNumber: number;
  filepath?: string;
  cause?: unknown;
}

export class ParseError extends Error {
  readonly lineNumber: number;
  readonly filepath?: string;

  constructor(message: string, options: ParseErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'ParseError';
    this.lineNumber = options.lineNumber;
    this.filepath = options.filepath;
  }
}

export interface SchemaErrorOptions {
  lineNumber: number;
  issues: ZodIssue[];
  filepath?: string;
}

export class SchemaError extends Error {
  readonly lineNumber: number;
  readonly issues: ZodIssue[];
  readonly filepath?: string;

  constructor(message: string, options: SchemaErrorOptions) {
    super(message);
    this.name = 'SchemaError';
    this.lineNumber = options.lineNumber;
    this.issues = options.issues;
    this.filepath = options.filepath;
  }
}
