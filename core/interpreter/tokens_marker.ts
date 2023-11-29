import { maybe, pipe, result } from '@natcore/typescript-utils/functional';
import { Token } from '../tokenizer/tokens';
import {
  INTERPRETATION_ERROR_CODES,
  InterpratationError,
} from './interpreter_errors';
import { InterpreterContext } from './context';

export type TokenMarker = Readonly<{
  tokens: Token[];
  cursor: number;
}>;

export type ReadResult<T> = result.Result<
  readonly [T, TokenMarker],
  InterpratationError
>;

export function getCurrentToken({
  tokens,
  cursor,
}: TokenMarker): maybe.Maybe<Token> {
  return cursor >= tokens.length ? maybe.none() : maybe.some(tokens[cursor]);
}

type InferExpectedValue<TType extends Token['type']> = Extract<
  Token,
  { type: TType }
>['value'];

type ReadTokenResult<
  TExpectedTypes extends Token['type'],
  TExpectedValues extends Token['value']
> = ReadResult<
  Extract<Token, { type: TExpectedTypes; value: TExpectedValues }>
>;

export function readTokenIf<
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

export function readToken<
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

type ReadFunctionResult = ReadResult<(...args: number[]) => number>;

export function maybeReadFunction(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): maybe.Maybe<result.Result_InferOK<ReadFunctionResult>> {
  return maybe.flatMap(
    readTokenIf(tokenMarker, ['identifier']),
    ([token, next]) => {
      return maybe.map(lookupValue(context.functions, token.value), (fn) => [
        fn,
        next,
      ]);
    }
  );
}

export function readFunction(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): ReadFunctionResult {
  return maybe.match(maybeReadFunction(tokenMarker, context), {
    some: (readResult) => result.from<ReadFunctionResult>().ok(readResult),
    none: () => {
      return pipe(
        getCurrentToken(tokenMarker),
        maybe.match({
          some: (token) => {
            const error: InterpratationError =
              token.type === 'identifier'
                ? {
                    reason: INTERPRETATION_ERROR_CODES.unknown_identifier,
                    identifier: token.value,
                  }
                : {
                    reason: INTERPRETATION_ERROR_CODES.unexpected_token,
                    token,
                  };
            return result.from<ReadFunctionResult>().error(error);
          },
          none: () =>
            result.from<ReadFunctionResult>().error({
              reason: INTERPRETATION_ERROR_CODES.unexpected_end_of_input,
            }),
        })
      );
    },
  });
}

type ReadVariableResult = ReadResult<number>;

export function maybeReadVariable(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): maybe.Maybe<result.Result_InferOK<ReadVariableResult>> {
  return maybe.flatMap(
    readTokenIf(tokenMarker, ['identifier']),
    ([token, next]) => {
      return maybe.map(lookupValue(context.numbers, token.value), (value) => [
        value,
        next,
      ]);
    }
  );
}

export function readVariable(
  tokenMarker: TokenMarker,
  context: InterpreterContext
): ReadVariableResult {
  return maybe.match(maybeReadVariable(tokenMarker, context), {
    some: (readResult) => result.from<ReadVariableResult>().ok(readResult),
    none: () => {
      return pipe(
        getCurrentToken(tokenMarker),
        maybe.match({
          some: (token) => {
            const error: InterpratationError =
              token.type === 'identifier'
                ? {
                    reason: INTERPRETATION_ERROR_CODES.unknown_identifier,
                    identifier: token.value,
                  }
                : {
                    reason: INTERPRETATION_ERROR_CODES.unexpected_token,
                    token,
                  };
            return result.from<ReadVariableResult>().error(error);
          },
          none: () =>
            result.from<ReadVariableResult>().error({
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

function lookupValue<T>(
  values: { [key: string]: T },
  key: string
): maybe.Maybe<T> {
  key = key.toLowerCase();
  return key in values ? maybe.some(values[key]) : maybe.none();
}
