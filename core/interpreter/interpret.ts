import { maybe, pipe, result } from '@natcore/typescript-utils/functional';
import { Token } from '../tokenizer/tokens';
import {
  INTERPRETATION_ERROR_CODES,
  InterpratationError,
} from './interpreter_errors';
import {
  ReadResult,
  TokenMarker,
  getCurrentToken,
  maybeReadFunction,
  maybeReadVariable,
  readFunction,
  readToken,
  readTokenIf,
} from './tokens_marker';
import { InterpreterContext } from './context';

export type InterpretationResult = result.Result<number, InterpratationError>;

type PartialInterpretationResult = ReadResult<number>;

export function interpret(
  tokens: Token[],
  context: InterpreterContext
): InterpretationResult {
  return result.flatMap(
    interpretExpression({ tokens, cursor: 0 }, context),
    ([value, { cursor, tokens }]) => {
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
  return result.flatMap(interpretTerm(tokenMarker, context), ([value, next]) =>
    interpretPipe(value, next, context)
  );
}

function interpretPipe(
  leftValue: number,
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  const potentialPipe = readTokenIf(tokenMarker, ['pipe']);

  if (maybe.isSome(potentialPipe)) {
    const [, next] = potentialPipe.value;
    return result.flatMap(readFunction(next, context), ([fn, next]) => {
      return pipe(
        getCurrentToken(next),
        maybe.match({
          some: (token) => {
            if (token.type !== 'pipe') {
              return result.flatMap(
                interpretTerm(next, context),
                ([restValue, next]) => {
                  return interpretPipe(fn(leftValue, restValue), next, context);
                }
              );
            }

            return interpretPipe(fn(leftValue), next, context);
          },
          none: () => interpretPipe(fn(leftValue), next, context),
        })
      );
    });
  }

  return createPartialResultOK(leftValue, tokenMarker);
}

function interpretTerm(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return result.flatMap(
    interpretFactor(tokenMarker, context),
    ([value, next]) => interpretTermTail(value, next, context)
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
        ([rightValue, next]) => {
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
    ([value, next]) => interpretFactorTail(value, next, context)
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
        ([rightValue, next]) => {
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
    ([value, next]) => interpretExponentTail(value, next, context)
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
        ([rightValue, next]) => {
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
      return result.flatMap(
        interpretFunctionCall(next, context),
        ([value, next]) => {
          return operatorToken.value === '-'
            ? createPartialResultOK(-value, next)
            : operatorToken.value === '+'
            ? createPartialResultOK(value, next)
            : exhaustiveResult(operatorToken);
        }
      );
    },
    none: () => interpretFunctionCall(tokenMarker, context),
  });
}

function interpretFunctionCall(
  marker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  const potentialFunction = maybeReadFunction(marker, context);

  if (potentialFunction.type === 'some') {
    const {
      value: [func, next],
    } = potentialFunction;
    const potentialLeftParen = readTokenIf(next, ['left_paren']);

    if (potentialLeftParen.type === 'some') {
      const [, next] = potentialLeftParen.value;
      return result.flatMap(
        interpretFunctionCallArgumentChain(next, context),
        ({ values: args, next }) => {
          return result.flatMap(
            readToken(next, ['right_paren']),
            ([, next]) => {
              return createPartialResultOK(func(...args), next);
            }
          );
        }
      );
    }

    return result.flatMap(
      interpretFunctionCall(next, context),
      ([argument, next]) => {
        return createPartialResultOK(func(argument), next);
      }
    );
  }

  const potentialNumber = maybeReadVariable(marker, context);

  if (potentialNumber.type === 'some') {
    const [value, next] = potentialNumber.value;
    return createPartialResultOK(value, next);
  }

  const potentialIdentifier = readTokenIf(marker, ['identifier']);

  if (potentialIdentifier.type === 'some') {
    const [identifier] = potentialIdentifier.value;
    return createPartialResultError({
      reason: INTERPRETATION_ERROR_CODES.unknown_identifier,
      identifier: identifier.value,
    });
  }

  return interpretUnit(marker, context);
}

type FunctionCallArgumentChainResult = result.Result<
  { readonly values: number[]; readonly next: TokenMarker },
  InterpratationError
>;

function interpretFunctionCallArgumentChain(
  marker: TokenMarker,
  context: InterpreterContext
): FunctionCallArgumentChainResult {
  return result.flatMap(
    interpretExpression(marker, context),
    ([value, next]) => {
      const potentialComma = readTokenIf(next, ['comma']);

      if (potentialComma.type === 'some') {
        const [, next] = potentialComma.value;
        return result.flatMap(
          interpretFunctionCallArgumentChain(next, context),
          ({ values, next }) => {
            return result
              .from<FunctionCallArgumentChainResult>()
              .ok({ values: [value, ...values], next });
          }
        );
      }

      return result
        .from<FunctionCallArgumentChainResult>()
        .ok({ values: [value], next });
    }
  );
}

function interpretUnit(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): PartialInterpretationResult {
  return result.flatMap(
    readToken(tokenMarker, ['number', 'left_paren']),
    ([token, next]) => {
      switch (token.type) {
        case 'number':
          return createPartialResultOK(token.value, next);
        case 'left_paren':
          return result.flatMap(
            interpretExpression(next, context),
            ([value, next]) =>
              result.map(
                readToken(next, ['right_paren']),
                ([, next]) => [value, next] as const
              )
          );
        default:
          return exhaustiveResult(token);
      }
    }
  );
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
  return result.from<PartialInterpretationResult>().ok([value, next]);
}

function createPartialResultError(
  error: InterpratationError
): PartialInterpretationResult {
  return result.from<PartialInterpretationResult>().error(error);
}
