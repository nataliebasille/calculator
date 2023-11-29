import { Token } from '../tokenizer/tokens';

export type InterpratationError =
  | {
      reason: 'unexpected_token';
      token: Token;
    }
  | {
      reason: 'unexpected_end_of_input';
    }
  | {
      reason: 'exhaustive_check_failed';
      value: unknown;
    }
  | {
      reason: 'division_by_zero';
    }
  | {
      reason: 'unknown_identifier';
      identifier: string;
    };

export const INTERPRETATION_ERROR_CODES = {
  division_by_zero: 'division_by_zero',
  exhaustive_check_failed: 'exhaustive_check_failed',
  unexpected_end_of_input: 'unexpected_end_of_input',
  unknown_identifier: 'unknown_identifier',
  unexpected_token: 'unexpected_token',
} as const;
