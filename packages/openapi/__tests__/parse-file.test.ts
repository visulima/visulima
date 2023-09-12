import { describe, expect, it, vi } from "vitest";

import parseFile, {ParseError} from '../src/parse-file';

describe('parseFile', () => {
    it('should parse a valid JSON file with allowed keys and return an array with one object containing the parsed OpenAPI specification and its location', () => {
      vi.mock('node:fs', () => {return {
        readFileSync: vi.fn(() => '{"openapi": "3.0.0","info": {"title": "Test API","version": "1.0.0"},"paths": {"/test": {"get": {"summary": "Test endpoint","responses": {"200": {"description": "OK"}}}}}}')
      }});

      const filePath = 'test.json';
      const commentsToOpenApi = vi.fn();
      const verbose = true;

      const result = parseFile(filePath, commentsToOpenApi, verbose);

      expect(result).toStrictEqual([{ loc: 0, spec: { info: { title: 'Test API', version: '1.0.0' }, openapi: '3.0.0', paths: { '/test': { get: { responses: { '200': { description: 'OK' } }, summary: 'Test endpoint' } } } } }]);
    });

    it('should return an empty array if a YAML file does not contain any allowed keys', () => {
      vi.mock('node:fs', () => {return {
        readFileSync: vi.fn(() => '\n')
      }});

      const filePath = 'test.yaml';
      const commentsToOpenApi = vi.fn();
      const verbose = true;

      const result = parseFile(filePath, commentsToOpenApi, verbose);

      expect(result).toStrictEqual([]);
    });

    it('should return an empty array if a JSON file does not contain any allowed keys', () => {
      vi.mock('node:fs', () => {return {
        readFileSync: vi.fn(() => '{"unexpectedKey": "value"}')
      }});

      const filePath = 'test.json';
      const commentsToOpenApi = vi.fn();
      const verbose = true;

      const result = parseFile(filePath, commentsToOpenApi, verbose);

      expect(result).toStrictEqual([]);
    });

    // Tests that the function throws a ParseError if a YAML file contains unexpected keys.
    it('should throw a ParseError if a YAML file contains unexpected keys', () => {
      // Mock the readFileSync function
      vi.mock('node:fs', () => ({
        readFileSync: vi.fn(() => 'openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0\ninvalidKey: value')
      }));

      const filePath = 'test.yaml';
      const commentsToOpenApi = vi.fn();
      const verbose = true;

      expect(() => {
        parseFile(filePath, commentsToOpenApi, verbose);
      }).toThrow(ParseError);
    });

    // Tests that the function throws an error with the file path if the commentsToOpenApi function throws an error.
    it('should throw an error with the file path if the commentsToOpenApi function throws an error', () => {
      // Mock the readFileSync function
      vi.mock('node:fs', () => ({
        readFileSync: vi.fn(() => 'file content')
      }));

      const filePath = 'test.txt';
      const commentsToOpenApi = vi.fn(() => {
        throw new Error('commentsToOpenApi error');
      });
      const verbose = true;

      expect(() => {
        parseFile(filePath, commentsToOpenApi, verbose);
      }).toThrowError('commentsToOpenApi error');
    });

    // Tests that the function can parse a valid YAML file with only allowed keys and additional keys and returns an array with one object containing the parsed OpenAPI specification and its location.
    it('should parse a valid YAML file with allowed keys and additional keys and return an array with one object containing the parsed OpenAPI specification and its location', () => {
      // Mock the readFileSync function
      vi.mock('node:fs', () => ({
        readFileSync: vi.fn(() => 'openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0\npaths:\n  /test:\n    get:\n      summary: Test endpoint\n      responses:\n        200:\n          description: OK\nadditionalKey: value')
      }));

      const filePath = 'test.yaml';
      const commentsToOpenApi = vi.fn();
      const verbose = true;

      const result = parseFile(filePath, commentsToOpenApi, verbose);

      expect(result).toEqual([{ loc: 0, spec: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' }, paths: { '/test': { get: { summary: 'Test endpoint', responses: { '200': { description: 'OK' } } } } }, additionalKey: 'value' } }]);
    });

    // Tests that the function can parse a valid JSON file with only allowed keys and additional keys and returns an array with one object containing the parsed OpenAPI specification and its location.
    it('should parse a valid JSON file with allowed keys and additional keys and return an array with one object containing the parsed OpenAPI specification and its location', () => {
      // Mock the readFileSync function
      vi.mock('node:fs', () => ({
        readFileSync: vi.fn(() => '{"openapi": "3.0.0","info": {"title": "Test API","version": "1.0.0"},"paths": {"/test": {"get": {"summary": "Test endpoint","responses": {"200": {"description": "OK"}}}}},"additionalKey": "value"}')
      }));

      const filePath = 'test.json';
      const commentsToOpenApi = vi.fn();
      const verbose = true;

      const result = parseFile(filePath, commentsToOpenApi, verbose);

      expect(result).toEqual([{ loc: 0, spec: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' }, paths: { '/test': { get: { summary: 'Test endpoint', responses: { '200': { description: 'OK' } } } } }, additionalKey: 'value' } }]);
    });

    // Tests that the function can parse a valid YAML file with only allowed keys and comments and returns an array with one object containing the parsed OpenAPI specification and its location.
    it('should parse a valid YAML file with allowed keys and comments and return an array with one object containing the parsed OpenAPI specification and its location', () => {
      // Mock the readFileSync function
      vi.mock('node:fs', () => ({
        readFileSync: vi.fn(() => '# Comment\nopenapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0\npaths:\n  /test:\n    get:\n      summary: Test endpoint\n      responses:\n        200:\n          description: OK')
      }));

      const filePath = 'test.yaml';
      const commentsToOpenApi = vi.fn();
      const verbose = true;

      const result = parseFile(filePath, commentsToOpenApi, verbose);

      expect(result).toEqual([{ loc: 0, spec: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' }, paths: { '/test': { get: { summary: 'Test endpoint', responses: { '200': { description: 'OK' } } } } } } }]);
    });
});
