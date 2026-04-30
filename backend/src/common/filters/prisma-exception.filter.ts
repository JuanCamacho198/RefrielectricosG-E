import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { ErrorResponse } from '../interfaces/error-response.interface';

// Import Prisma error types directly from the generated client
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientUnknownRequestError,
} from '@prisma/client/runtime/library';

@Catch(
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error occurred';
    let details: Record<string, any> | undefined;

    // Handle PrismaClientKnownRequestError (errors with specific error codes)
    if (exception instanceof PrismaClientKnownRequestError) {
      const error = this.handleKnownRequestError(exception);
      status = error.status;
      message = error.message;
      details = error.details;
    }
    // Handle PrismaClientValidationError (schema validation errors)
    else if (exception instanceof PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      details = {
        error: 'Validation error',
        hint: 'Please check the data format and required fields',
      };
    }
    // Handle PrismaClientRustPanicError (critical internal errors)
    else if (exception instanceof PrismaClientRustPanicError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'A critical database error occurred';
      details = {
        error: 'Internal database error',
        hint: 'Please contact support if this persists',
      };
    }
    // Handle PrismaClientInitializationError (connection errors)
    else if (exception instanceof PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection failed';
      details = {
        error: 'Database unavailable',
        hint: 'Please try again later',
      };
    }
    // Handle unknown Prisma errors
    else if (exception instanceof PrismaClientUnknownRequestError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected database error occurred';
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: exception.name || 'DatabaseError',
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(details && { details }),
      ...(!isProduction && { stack: exception.stack }),
    };

    // Log the error with full details
    this.logger.error(
      `${request.method} ${request.url} - Database Error: ${message}`,
      {
        code: exception.code,
        meta: exception.meta,
        stack: exception.stack,
      },
    );

    response.status(status).json(errorResponse);
  }

  private handleKnownRequestError(exception: PrismaClientKnownRequestError): {
    status: number;
    message: string;
    details?: Record<string, any>;
  } {
    const code = exception.code;
    const meta = exception.meta;

    switch (code) {
      // Unique constraint violation
      case 'P2002': {
        const target = (meta?.target as string[]) || [];
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${target.join(', ')} already exists`,
          details: {
            error: 'Unique constraint violation',
            fields: target,
          },
        };
      }

      // Foreign key constraint violation
      case 'P2003': {
        const field = (meta?.field_name as string) || 'field';
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Invalid reference: ${field} does not exist`,
          details: {
            error: 'Foreign key constraint violation',
            field,
          },
        };
      }

      // Record not found
      case 'P2025': {
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          details: {
            error: 'Record does not exist',
            cause: meta?.cause as string,
          },
        };
      }

      // Record to delete does not exist
      case 'P2016': {
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record to delete not found',
          details: {
            error: 'Record does not exist',
          },
        };
      }

      // Related record not found
      case 'P2018': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Required related record not found',
          details: {
            error: 'Missing related record',
          },
        };
      }

      // Invalid input value
      case 'P2006':
      case 'P2007': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid data format provided',
          details: {
            error: 'Invalid input',
          },
        };
      }

      // Query interpretation error
      case 'P2008':
      case 'P2009':
      case 'P2010':
      case 'P2012':
      case 'P2013':
      case 'P2014':
      case 'P2015': {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid query parameters',
          details: {
            error: 'Query error',
          },
        };
      }

      // Null constraint violation
      case 'P2011': {
        const target = (meta?.constraint as string) || 'field';
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Required field ${target} cannot be null`,
          details: {
            error: 'Null constraint violation',
            field: target,
          },
        };
      }

      // Transaction failed
      case 'P2028':
      case 'P2034': {
        return {
          status: HttpStatus.CONFLICT,
          message: 'Transaction failed, please try again',
          details: {
            error: 'Transaction error',
          },
        };
      }

      // Default for unknown Prisma error codes
      default: {
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred',
          details: {
            error: 'Database error',
            code,
          },
        };
      }
    }
  }
}
