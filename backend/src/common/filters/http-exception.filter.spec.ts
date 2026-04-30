import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import type { ErrorResponse } from '../interfaces/error-response.interface';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockGetResponse = jest.fn().mockReturnValue({
    status: mockStatus,
  });
  const mockGetRequest = jest.fn().mockReturnValue({
    url: '/api/test',
    method: 'GET',
  });
  const mockHttpArgumentsHost = jest.fn().mockReturnValue({
    getResponse: mockGetResponse,
    getRequest: mockGetRequest,
  });
  const mockArgumentsHost = {
    switchToHttp: mockHttpArgumentsHost,
    getArgByIndex: jest.fn(),
    getArgs: jest.fn(),
    getType: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should format a NotFoundException correctly', () => {
    const exception = new HttpException(
      'Product not found',
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Product not found',
        error: 'HttpException',
        path: '/api/test',
        method: 'GET',
      }),
    );
  });

  it('should format validation errors correctly', () => {
    const exception = new HttpException(
      {
        message: ['name must be a string', 'price must be a number'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(400);

    const response = mockJson.mock.calls[0][0] as ErrorResponse;
    expect(response.statusCode).toBe(400);
    expect(response.message).toBe('Validation failed');
    expect(response.details?.validationErrors).toBeDefined();
  });

  it('should include timestamp and error name', () => {
    const exception = new HttpException(
      'Test error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(exception, mockArgumentsHost);

    const response = mockJson.mock.calls[0][0] as ErrorResponse;
    expect(response.timestamp).toBeDefined();
    expect(response.error).toBe('HttpException');
  });
});
