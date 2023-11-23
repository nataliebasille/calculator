import { maybe, pipe, result } from '@natcore/typescript-utils/functional';
import { Token } from '../tokenizer/tokens';

type InterpreterContext = {
  readonly PI: number;
  readonly E: number;
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
      value: any;
    }
  | {
      reason: 'division_by_zero';
    };

export const INTERPRETATION_ERROR_CODES = {
  unexpected_token: 'unexpected_token',
  unexpected_end_of_input: 'unexpected_end_of_input',
  division_by_zero: 'division_by_zero',
  exhaustive_check_failed: 'exhaustive_check_failed',
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
  return pipe(
    interpretExpression({ tokens, cursor: 0 }, context),
    result.flatMap(({ value, next: { cursor, tokens } }) => {
      return cursor < tokens.length
        ? result.error({
            reason: INTERPRETATION_ERROR_CODES.unexpected_token,
            token: tokens[cursor],
          })
        : result.ok(value);
    })
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
  return pipe(
    interpretFactor(tokenMarker, context),
    result.flatMap(({ value, next }) => interpretTermTail(value, next, context))
  );
}

function interpretTermTail(
  leftValue: number,
  marker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return pipe(
    readTokenIf(marker, ['operator'], ['+', '-']),
    maybe.match({
      some: ([operatorToken, next]) => {
        return pipe(
          interpretFactor(next, context),
          result.flatMap(({ value: rightValue, next }) => {
            return operatorToken.value === '+'
              ? result.ok({ value: leftValue + rightValue, next })
              : operatorToken.value === '-'
              ? result.ok({ value: leftValue - rightValue, next })
              : exhaustiveResult(operatorToken);
          })
        );
      },
      none: () => result.ok({ value: leftValue, next: marker }),
    })
  );
}

function interpretFactor(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return pipe(
    interpretExponent(tokenMarker, context),
    result.flatMap(({ value, next }) =>
      interpretFactorTail(value, next, context)
    )
  );
}

function interpretFactorTail(
  leftValue: number,
  marker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return pipe(
    readTokenIf(marker, ['operator'], ['*', '/']),
    maybe.match({
      some: ([operatorToken, next]) => {
        return pipe(
          interpretExponent(next, context),
          result.flatMap(({ value: rightValue, next }) => {
            return operatorToken.value === '*'
              ? result.ok({ value: leftValue * rightValue, next })
              : operatorToken.value === '/'
              ? rightValue === 0
                ? result.error({
                    reason: INTERPRETATION_ERROR_CODES.division_by_zero,
                  })
                : result.ok({ value: leftValue / rightValue, next })
              : exhaustiveResult(operatorToken);
          })
        );
      },
      none: () => result.ok({ value: leftValue, next: marker }),
    })
  );
}

function interpretExponent(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return pipe(
    interpretSignedUnit(tokenMarker, context),
    result.flatMap(({ value, next }) =>
      interpretExponentTail(value, next, context)
    )
  );
}

function interpretExponentTail(
  leftValue: number,
  marker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return pipe(
    readTokenIf(marker, ['operator'], ['^']),
    maybe.match({
      some: ([operatorToken, next]) => {
        return pipe(
          interpretSignedUnit(next, context),
          result.flatMap(({ value: rightValue, next }) => {
            return operatorToken.value === '^'
              ? result.ok({ value: Math.pow(leftValue, rightValue), next })
              : exhaustiveResult(operatorToken.value);
          })
        );
      },
      none: () => result.ok({ value: leftValue, next: marker }),
    })
  );
}

function interpretSignedUnit(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return pipe(
    readTokenIf(tokenMarker, ['operator'], ['-', '+']),
    maybe.match({
      some: ([operatorToken, next]) => {
        return pipe(
          interpretUnit(next, context),
          result.flatMap(({ value, next }) => {
            return operatorToken.value === '-'
              ? result.ok({ value: -value, next })
              : operatorToken.value === '+'
              ? result.ok({ value: value, next })
              : exhaustiveResult(operatorToken);
          })
        );
      },
      none: () => interpretUnit(tokenMarker, context),
    })
  );
}

function interpretUnit(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return interpretNumber(tokenMarker, context);
}

function interpretNumber(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return pipe(
    readToken(tokenMarker, ['number', 'builtin:number', 'left_paren']),
    result.flatMap(([token, next]) => {
      switch (token.type) {
        case 'builtin:number':
          return token.value === 'e'
            ? result.ok({ value: context.E, next })
            : token.value === 'pi'
            ? result.ok({ value: context.PI, next })
            : exhaustiveResult(token.value);
        case 'number':
          return result.ok({ value: token.value, next });
        case 'left_paren':
          return pipe(
            interpretExpression(next, context),
            result.flatMap(({ value, next }) => {
              return pipe(
                readToken(next, ['right_paren']),
                result.flatMap(([token, next]) => {
                  return token.type === 'right_paren'
                    ? result.ok({ value, next })
                    : exhaustiveResult(token.type);
                })
              );
            })
          );
        default:
          return exhaustiveResult(token);
      }
    })
  );
}

function getCurrentToken({ tokens, cursor }: TokenMarker): maybe.Maybe<Token> {
  return cursor >= tokens.length ? maybe.none : maybe.some(tokens[cursor]);
}

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
  readonly [
    Extract<
      Token,
      { type: TExpectedTypes[number]; value: TExpectedValues[number] }
    >,
    TokenMarker
  ]
> {
  return pipe(
    getCurrentToken(tokenMarker),
    maybe.flatMap((token) => {
      return (!matchTypes || matchTypes.includes(token.type)) &&
        (!matchValues || matchValues.includes(token.value as any))
        ? maybe.some([token, advanceCursor(tokenMarker)] as const as [
            Extract<
              Token,
              { type: TExpectedTypes[number]; value: TExpectedValues[number] }
            >,
            TokenMarker
          ])
        : maybe.none;
    })
  );
}

function readToken<
  TExpectedTypes extends Array<Token['type']>,
  TExpectedValues extends Array<
    Extract<Token, { type: TExpectedTypes[number] }>['value']
  >
>(
  tokenMarker: TokenMarker,
  matchTypes?: TExpectedTypes,
  matchValues?: TExpectedValues
): result.Result<
  readonly [
    Extract<
      Token,
      { type: TExpectedTypes[number]; value: TExpectedValues[number] }
    >,
    TokenMarker
  ],
  InterpratationError
> {
  return pipe(
    readTokenIf(tokenMarker, matchTypes, matchValues as any),
    maybe.match({
      some: (readResult) =>
        result.ok(readResult) as result.Result<
          readonly [
            Extract<
              Token,
              { type: TExpectedTypes[number]; value: TExpectedValues[number] }
            >,
            TokenMarker
          ],
          InterpratationError
        >,
      none: () => {
        return pipe(
          getCurrentToken(tokenMarker),
          maybe.match({
            some: (token) =>
              result.error({
                reason: INTERPRETATION_ERROR_CODES.unexpected_token,
                token,
              }),
            none: () =>
              result.error({
                reason: INTERPRETATION_ERROR_CODES.unexpected_end_of_input,
              }) as result.Result<
                readonly [
                  Extract<
                    Token,
                    {
                      type: TExpectedTypes[number];
                      value: TExpectedValues[number];
                    }
                  >,
                  TokenMarker
                ],
                InterpratationError
              >,
          })
        );
      },
    })
  );
}

function advanceCursor({ tokens, cursor }: TokenMarker): TokenMarker {
  return {
    tokens,
    cursor: cursor + 1,
  };
}

function exhaustiveResult(value: never): PartialInterpretationResult {
  return result.error({
    reason: INTERPRETATION_ERROR_CODES.exhaustive_check_failed,
    value,
  });
}
