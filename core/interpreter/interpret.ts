import { maybe, pipe, result } from '@natcore/typescript-utils/functional';
import { Token } from '../tokenizer/tokens';

type InterpreterContext = {
  readonly numbers: {
    readonly [key: string]: number;
  };
};

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
      reason: 'unknown_number';
      identifier: string;
    };

export const INTERPRETATION_ERROR_CODES = {
  division_by_zero: 'division_by_zero',
  exhaustive_check_failed: 'exhaustive_check_failed',
  unexpected_end_of_input: 'unexpected_end_of_input',
  unknown_number: 'unknown_number',
  unexpected_token: 'unexpected_token',
} as const;

type InterpretationResult = result.Result<number, InterpratationError>;
type TokenMarker = Readonly<{
  tokens: Token[];
  cursor: number;
}>;
type PartialInterpretationResult = result.Result<
  {
    value: number;
    next: TokenMarker;
  },
  InterpratationError
>;

export function interpret(
  tokens: Token[],
  context: InterpreterContext
): InterpretationResult {
  return result.flatMap(
    interpretExpression({ tokens, cursor: 0 }, context),
    ({ value, next: { cursor, tokens } }) => {
      return cursor < tokens.length
        ? result.from<InterpretationResult>().error({
            reason: INTERPRETATION_ERROR_CODES.unexpected_token,
            token: tokens[cursor],
          })
        : result.from<InterpretationResult>().ok(value);
    }
  );
}

function interpretExpression(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return interpretTerm(tokenMarker, context);
}

function interpretTerm(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return result.flatMap(
    interpretFactor(tokenMarker, context),
    ({ value, next }) => interpretTermTail(value, next, context)
  );
}

function interpretTermTail(
  leftValue: number,
  marker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return maybe.match(readTokenIf(marker, ['operator'], ['+', '-']), {
    some: ([operatorToken, next]) => {
      return result.flatMap(
        interpretFactor(next, context),
        ({ value: rightValue, next }) => {
          return operatorToken.value === '+'
            ? createPartialResultOK(leftValue + rightValue, next)
            : operatorToken.value === '-'
            ? createPartialResultOK(leftValue - rightValue, next)
            : exhaustiveResult(operatorToken);
        }
      );
    },
    none: () => createPartialResultOK(leftValue, marker),
  });
}

function interpretFactor(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return result.flatMap(
    interpretExponent(tokenMarker, context),
    ({ value, next }) => interpretFactorTail(value, next, context)
  );
}

function interpretFactorTail(
  leftValue: number,
  marker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return maybe.match(readTokenIf(marker, ['operator'], ['*', '/']), {
    some: ([operatorToken, next]) => {
      return result.flatMap(
        interpretExponent(next, context),
        ({ value: rightValue, next }) => {
          return operatorToken.value === '*'
            ? createPartialResultOK(leftValue * rightValue, next)
            : operatorToken.value === '/'
            ? rightValue === 0
              ? createPartialResultError({
                  reason: INTERPRETATION_ERROR_CODES.division_by_zero,
                })
              : createPartialResultOK(leftValue / rightValue, next)
            : exhaustiveResult(operatorToken);
        }
      );
    },
    none: () => createPartialResultOK(leftValue, marker),
  });
}

function interpretExponent(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return result.flatMap(
    interpretSigned(tokenMarker, context),
    ({ value, next }) => interpretExponentTail(value, next, context)
  );
}

function interpretExponentTail(
  leftValue: number,
  marker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return maybe.match(readTokenIf(marker, ['operator'], ['^']), {
    some: ([operatorToken, next]) => {
      return result.flatMap(
        interpretSigned(next, context),
        ({ value: rightValue, next }) => {
          return operatorToken.value === '^'
            ? createPartialResultOK(Math.pow(leftValue, rightValue), next)
            : exhaustiveResult(operatorToken.value);
        }
      );
    },
    none: () => createPartialResultOK(leftValue, marker),
  });
}

function interpretSigned(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return maybe.match(readTokenIf(tokenMarker, ['operator'], ['-', '+']), {
    some: ([operatorToken, next]) => {
      return result.flatMap(interpretUnit(next, context), ({ value, next }) => {
        return operatorToken.value === '-'
          ? createPartialResultOK(-value, next)
          : operatorToken.value === '+'
          ? createPartialResultOK(value, next)
          : exhaustiveResult(operatorToken);
      });
    },
    none: () => interpretUnit(tokenMarker, context),
  });
}

function interpretUnit(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return result.flatMap(
    readToken(tokenMarker, ['identifier', 'number', 'left_paren']),
    ([token, next]) => {
      switch (token.type) {
        case 'identifier':
          return maybe.match(lookvalue(context.numbers, token.value), {
            some: (value) => createPartialResultOK(value, next),
            none: () =>
              createPartialResultError({
                reason: INTERPRETATION_ERROR_CODES.unknown_number,
                identifier: token.value,
              }),
          });
        case 'number':
          return createPartialResultOK(token.value, next);
        case 'left_paren':
          return result.flatMap(
            interpretExpression(next, context),
            ({ value, next }) =>
              result.map(readToken(next, ['right_paren']), ([, next]) => ({
                value,
                next,
              }))
          );
        default:
          return exhaustiveResult(token);
      }
    }
  );
}

function getCurrentToken({ tokens, cursor }: TokenMarker): maybe.Maybe<Token> {
  return cursor >= tokens.length ? maybe.none() : maybe.some(tokens[cursor]);
}

type InferExpectedValue<TType extends Token['type']> = Extract<
  Token,
  { type: TType }
>['value'];

type ReadTokenResult<
  TExpectedTypes extends Token['type'],
  TExpectedValues extends Token['value']
> = result.Result<
  readonly [
    Extract<Token, { type: TExpectedTypes; value: TExpectedValues }>,
    TokenMarker
  ],
  InterpratationError
>;

function readTokenIf<
  TExpectedTypes extends Array<Token['type']>,
  TExpectedValues extends Array<
    Extract<Token, { type: TExpectedTypes[number] }>['value']
  >
>(
  tokenMarker: TokenMarker,
  matchTypes?: TExpectedTypes,
  matchValues?: TExpectedValues
): maybe.Maybe<
  result.Result_InferOK<
    ReadTokenResult<TExpectedTypes[number], TExpectedValues[number]>
  >
> {
  return maybe.flatMap(getCurrentToken(tokenMarker), (token) => {
    return (!matchTypes || matchTypes.includes(token.type)) &&
      (!matchValues || matchValues.includes(token.value as any))
      ? maybe.some([token, advanceCursor(tokenMarker)] as const as [
          Extract<
            Token,
            { type: TExpectedTypes[number]; value: TExpectedValues[number] }
          >,
          TokenMarker
        ])
      : maybe.none();
  });
}

function readToken<
  TExpectedTypes extends Array<Token['type']>,
  TExpectedValues extends Array<InferExpectedValue<TExpectedTypes[number]>>
>(
  tokenMarker: TokenMarker,
  matchTypes?: TExpectedTypes,
  matchValues?: TExpectedValues
): ReadTokenResult<TExpectedTypes[number], TExpectedValues[number]> {
  return maybe.match(readTokenIf(tokenMarker, matchTypes, matchValues as any), {
    some: (readResult) =>
      result
        .from<
          ReadTokenResult<TExpectedTypes[number], TExpectedValues[number]>
        >()
        .ok(readResult),
    none: () => {
      return pipe(
        getCurrentToken(tokenMarker),
        maybe.match({
          some: (token) =>
            result
              .from<
                ReadTokenResult<TExpectedTypes[number], TExpectedValues[number]>
              >()
              .error({
                reason: INTERPRETATION_ERROR_CODES.unexpected_token,
                token,
              }),
          none: () =>
            result
              .from<
                ReadTokenResult<TExpectedTypes[number], TExpectedValues[number]>
              >()
              .error({
                reason: INTERPRETATION_ERROR_CODES.unexpected_end_of_input,
              }),
        })
      );
    },
  });
}

function advanceCursor({ tokens, cursor }: TokenMarker): TokenMarker {
  return {
    tokens,
    cursor: cursor + 1,
  };
}

function lookvalue<T>(
  values: { [key: string]: T },
  key: string
): maybe.Maybe<T> {
  key = key.toLowerCase();
  return key in values ? maybe.some(values[key]) : maybe.none();
}

function exhaustiveResult(value: never): PartialInterpretationResult {
  return createPartialResultError({
    reason: INTERPRETATION_ERROR_CODES.exhaustive_check_failed,
    value,
  });
}

function createPartialResultOK(
  value: number,
  next: TokenMarker
): PartialInterpretationResult {
  return result.from<PartialInterpretationResult>().ok({ value, next });
}

function createPartialResultError(
  error: InterpratationError
): PartialInterpretationResult {
  return result.from<PartialInterpretationResult>().error(error);
}
