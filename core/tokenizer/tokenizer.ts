import { maybe, pipe, result } from '@natcore/typescript-utils/functional';
import { Token } from './tokens';

type BaseTokenTester<TTestType> = {
  test: TTestType;
  createToken(value: string): Token;
};
type RegexTokenTester = BaseTokenTester<RegExp>;
type StringTokenTester = BaseTokenTester<string>;
type TokenTester = RegexTokenTester | StringTokenTester;

const tokenTesters: ReadonlyArray<TokenTester> = [
  {
    test: /(?:\d+(?:\.\d+)?|\.\d+)(?:(?<=\d)e[-+]?\d+)?/i,
    createToken(value: string) {
      return {
        type: 'number',
        value: parseFloat(value),
      };
    },
  },
  {
    test: /[-+*/^]/,
    createToken(value: string) {
      return {
        type: 'operator',
        value: value as '+' | '-' | '*' | '/' | '^',
      };
    },
  },
  {
    test: '(',
    createToken(value: '(') {
      return {
        type: 'left_paren',
        value: value,
      };
    },
  },
  {
    test: ')',
    createToken(value: ')') {
      return {
        type: 'right_paren',
        value: value,
      };
    },
  },
  {
    test: /\$[a-zA-Z0-9]*|[a-zA-Z][a-zA-Z0-9]*/,
    createToken(value: string) {
      return {
        type: 'identifier',
        value: value.toLowerCase(),
      };
    },
  },
];

export function tokenize(input: string): result.Result<Token[], string> {
  return tokenizeProcessor(input);
}

type TokenizeProcessorResult = result.Result<Token[], string>;

function tokenizeProcessor(
  input: string,
  cursor: number = 0,
  tokens: TokenizeProcessorResult = result
    .from<TokenizeProcessorResult>()
    .ok([])
): TokenizeProcessorResult {
  while (cursor < input.length && /\s/.test(input[cursor])) {
    cursor++;
  }

  return result.flatMap(tokens, (tokens) => {
    if (cursor >= input.length) {
      return result.from<TokenizeProcessorResult>().ok(tokens);
    }

    return pipe(
      tokenTesters.reduce(
        (result, tester) =>
          pipe(
            result,
            maybe.match({
              some: () => result,
              none: () =>
                pipe(
                  test(tester, input, cursor),
                  maybe.map((raw) => ({
                    raw,
                    token: tester.createToken(raw),
                  }))
                ),
            })
          ),
        maybe.none() as maybe.Maybe<{ raw: string; token: Token }>
      ),
      maybe.match({
        some: ({ raw, token }) =>
          tokenizeProcessor(
            input,
            cursor + raw.length,
            result
              .from<TokenizeProcessorResult>()
              .ok((tokens.push(token), tokens))
          ),
        none: () =>
          result
            .from<TokenizeProcessorResult>()
            .error(`Unexpected token: ${input[cursor]}`),
      })
    );
  });
}

function test(
  tester: TokenTester,
  input: string,
  cursor: number
): maybe.Maybe<string> {
  return isRegexTokenTester(tester)
    ? regexTest(tester, input, cursor)
    : isStringTokenTester(tester)
    ? stringTest(tester, input, cursor)
    : maybe.none();
}

function regexTest(test: RegexTokenTester, input: string, cursor: number) {
  const regex = new RegExp(test.test.source, test.test.flags + 'y');
  regex.lastIndex = cursor;
  const match = regex.exec(input);

  return match ? maybe.some(match[0]) : maybe.none<string>();
}

function stringTest(test: StringTokenTester, input: string, cursor: number) {
  const matches = input.startsWith(test.test, cursor);

  return matches ? maybe.some(test.test) : maybe.none<string>();
}

function isRegexTokenTester(tester: TokenTester): tester is RegexTokenTester {
  return tester.test instanceof RegExp;
}

function isStringTokenTester(tester: TokenTester): tester is StringTokenTester {
  return typeof tester.test === 'string';
}
