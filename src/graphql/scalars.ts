import { GraphQLScalarType, Kind, ValueNode } from 'graphql';

// Date scalar
export const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date scalar type (YYYY-MM-DD)',
  serialize(value: any): string {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Value is not a valid Date');
  },
  parseValue(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Value is not a valid Date string');
  },
  parseLiteral(ast: ValueNode): string {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    throw new Error('Value is not a valid Date string');
  },
});

// Signature scalar (base58 encoded string)
export const SignatureScalar = new GraphQLScalarType({
  name: 'Signature',
  description: 'Solana transaction signature (base58 encoded)',
  serialize(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Value is not a valid Signature');
  },
  parseValue(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Value is not a valid Signature string');
  },
  parseLiteral(ast: ValueNode): string {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    throw new Error('Value is not a valid Signature string');
  },
});

// ProgramID scalar (base58 encoded string)
export const ProgramIDScalar = new GraphQLScalarType({
  name: 'ProgramID',
  description: 'Solana program ID (base58 encoded)',
  serialize(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Value is not a valid ProgramID');
  },
  parseValue(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Value is not a valid ProgramID string');
  },
  parseLiteral(ast: ValueNode): string {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    throw new Error('Value is not a valid ProgramID string');
  },
});

// BigInt scalar for large numbers
export const BigIntScalar = new GraphQLScalarType({
  name: 'BigInt',
  description: 'Big integer scalar type',
  serialize(value: any): string {
    if (typeof value === 'number' || typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'string') {
      return value;
    }
    throw new Error('Value is not a valid BigInt');
  },
  parseValue(value: any): string {
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') {
      return value.toString();
    }
    throw new Error('Value is not a valid BigInt');
  },
  parseLiteral(ast: ValueNode): string {
    if (ast.kind === Kind.INT || ast.kind === Kind.STRING) {
      return ast.value;
    }
    throw new Error('Value is not a valid BigInt');
  },
});

