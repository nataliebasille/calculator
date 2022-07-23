import { Result, Maybe } from "../monads";
import { Token } from "../tokenizer";
import { tokenize } from "../tokenizer/tokenize";

class TokenContext {
  private currentIndex = 0;

  constructor(private tokens: Token[]) {}

  get current(): Token {
    return this.tokens[this.currentIndex];
  }

  read(): Maybe<Token> {
    return this.currentIndex >= this.tokens.length
      ? Maybe.none()
      : Maybe.some(this.tokens[this.currentIndex++]);
  }

  readIfTokenIs<T extends Token["type"][]>(
    ...types: T
  ): Maybe<Extract<Token, { type: T[number] }>> {
    if (this.currentIndex >= this.tokens.length) {
      return Maybe.none();
    }

    if (types.includes(this.tokens[this.currentIndex].type)) {
      return this.read() as Maybe<Extract<Token, { type: T[number] }>>;
    }

    return Maybe.none();
  }
}

export const evaluate = (expression: string): Result<number> => {
  return tokenize(expression).match({
    failure: tokenizerError,
    ok: (tokens) => {
      const context = new TokenContext(tokens);
      const result = processExpression(context);

      // eslint-disable-next-line no-compare-neg-zero
      return result.map((value) => (value === -0 ? 0 : value));
    },
  });
};

function processExpression(context: TokenContext): Result<number> {
  return processTerm(context);
}

function processTerm(context: TokenContext): Result<number> {
  return binaryApplyLeftToRightUntilTokenIsNotOneOf(
    context,
    processFactor,
    (operatorToken, leftValue, rightValue) => {
      return operatorToken.type === "plus"
        ? leftValue + rightValue
        : leftValue - rightValue;
    },
    "plus",
    "minus"
  );
}

function processFactor(context: TokenContext): Result<number> {
  return binaryApplyLeftToRightUntilTokenIsNotOneOf(
    context,
    processPower,
    (operatorToken, leftValue, rightValue) => {
      return operatorToken.type === "multiply"
        ? leftValue * rightValue
        : operatorToken.type === "divide"
        ? leftValue / rightValue
        : leftValue % rightValue;
    },
    "multiply",
    "divide",
    "modulo"
  );
}

function processPower(context: TokenContext): Result<number> {
  return binaryApplyRightToLeftUntilTokenNotOne(
    context,
    processUnit,
    (_, leftValue, rightValue) => {
      return leftValue ** rightValue;
    },
    "exponent"
  );
}

function processUnit(context: TokenContext): Result<number> {
  return context.read().match({
    none: unexpectedEndOfExpression,
    some: (token) => {
      return token.type === "number"
        ? Result.ok(token.value)
        : unexpectedToken(token);
    },
  });
}

function tokenizerError(error: string): Result<number> {
  return Result.failure(`Tokenizer error: ${error}`);
}

function unexpectedToken(token: Token): Result<number> {
  return Result.failure(`Unexpected token ${JSON.stringify(token)}`);
}

function unexpectedEndOfExpression(): Result<number> {
  return Result.failure(`Unexpected end of expression`);
}

function binaryApplyLeftToRightUntilTokenIsNotOneOf<T extends Token["type"][]>(
  context: TokenContext,
  action: (context: TokenContext) => Result<number>,
  nextValue: (
    token: Extract<Token, { type: T[number] }>,
    leftValue: number,
    rightValue: number
  ) => number,
  ...types: T
): Result<number> {
  return action(context).flatMap(readNext);

  function readNext(value: number): Result<number> {
    return context.readIfTokenIs(...types).match({
      none: () => Result.ok(value),
      some: (token) => {
        const rightResult = action(context);
        const result = rightResult.map((rightValue) =>
          nextValue(token, value, rightValue)
        );

        return result.flatMap(readNext);
      },
    });
  }
}

function binaryApplyRightToLeftUntilTokenNotOne<T extends Token["type"][]>(
  context: TokenContext,
  action: (context: TokenContext) => Result<number>,
  nextValue: (
    token: Extract<Token, { type: T[number] }>,
    leftValue: number,
    rightValue: number
  ) => number,
  ...types: T
): Result<number> {
  const leftResult = action(context);

  return context.readIfTokenIs(...types).match({
    none: () => leftResult,
    some: (token) => {
      const rightResult = binaryApplyRightToLeftUntilTokenNotOne(
        context,
        action,
        nextValue,
        ...types
      );

      return leftResult.flatMap((left) =>
        rightResult.map((rightValue) => nextValue(token, left, rightValue))
      );
    },
  });
}
