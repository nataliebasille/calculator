import { tokenize } from './tokenizer';
import fc from 'fast-check';
import { Token } from './tokens';
import {
  anyNumberStringArbitrary,
  builtinNumberArbitrary,
  characterArbitrary,
  digitArbitrary,
  eArbitrary,
  numberStringArbitrary,
  operatorArbitrary,
  parenthesisArbitrary,
  piArbitrary,
  signArbitrary,
} from '../+test_utils/arbitraries';

const identifierArbitrary = fc
  .tuple(
    fc.option(characterArbitrary),
    fc.array(fc.oneof(characterArbitrary, digitArbitrary), {
      minLength: 1,
      maxLength: 25,
    })
  )
  .map(([dollarSign, rest]) => `${dollarSign}${rest.join('')}`);

describe('tokenize', () => {
  test(`should tokenize arbitrary number strings correctly`, () => {
    fc.assert(
      fc.property(numberStringArbitrary, (numberString) => {
        expectResultsToBe(tokenize(numberString), 'ok', [
          {
            type: 'number',
            value: parseFloat(numberString),
          },
        ]);
      })
    );
  });

  test('tokenize arbitrary number that starts with a sign', () => {
    fc.assert(
      fc.property(
        fc.tuple(signArbitrary, numberStringArbitrary),
        ([sign, numberString]) => {
          expectResultsToBe(tokenize(`${sign}${numberString}`), 'ok', [
            {
              type: 'operator',
              value: sign as '+' | '-',
            },
            {
              type: 'number',
              value: parseFloat(numberString),
            },
          ]);
        }
      )
    );
  });

  test('should tokenize pi strings correctly', () => {
    fc.assert(
      fc.property(piArbitrary, (piString) => {
        expectResultsToBe(tokenize(piString), 'ok', [
          {
            type: 'builtin:number',
            value: 'pi',
          },
        ]);
      })
    );
  });

  test('should tokenize e strings correctly', () => {
    fc.assert(
      fc.property(eArbitrary, (eString) => {
        expectResultsToBe(tokenize(eString), 'ok', [
          {
            type: 'builtin:number',
            value: 'e',
          },
        ]);
      })
    );
  });

  test('should tokenize operator correctly', () => {
    fc.assert(
      fc.property(operatorArbitrary, (operator) => {
        expectResultsToBe(tokenize(operator), 'ok', [
          {
            type: 'operator',
            value: operator as '+' | '-' | '*' | '/' | '^',
          },
        ]);
      })
    );
  });

  test('should tokenize parenthesis correctly', () => {
    fc.assert(
      fc.property(parenthesisArbitrary, (parenthesis) => {
        expectResultsToBe(tokenize(parenthesis), 'ok', [
          parenthesis === '('
            ? {
                type: 'left_paren',
                value: parenthesis as '(',
              }
            : {
                type: 'right_paren',
                value: parenthesis as ')',
              },
        ]);
      })
    );
  });

  test('should tokenize identifier correctly', () => {
    fc.assert(
      fc.property(identifierArbitrary, (identifier) => {
        expectResultsToBe(tokenize(identifier), 'ok', [
          {
            type: 'identifier',
            value: identifier,
          },
        ]);
      })
    );
  });

  test('e followed by a number should be an identifier', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          eArbitrary,
          fc.array(digitArbitrary, { minLength: 1, maxLength: 5 })
        ),
        ([e, digits]) => {
          expectResultsToBe(tokenize(`${e}${digits.join('')}`), 'ok', [
            {
              type: 'identifier',
              value: `${e}${digits.join('')}`,
            },
          ]);
        }
      )
    );
  });

  test('tokenizes [number | identifier] {operator} [number | identifier]', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.oneof(anyNumberStringArbitrary, identifierArbitrary),
          operatorArbitrary,
          fc.oneof(
            numberStringArbitrary,
            builtinNumberArbitrary,
            identifierArbitrary
          ),
          fc.array(fc.constant(' '), { minLength: 0, maxLength: 10 }),
          fc.array(fc.constant(' '), { minLength: 0, maxLength: 10 })
        ),
        ([first, operator, second, firstWhitespace, secondWhitespace]) => {
          function createToken(value: string): Token {
            return value.toLowerCase() === 'pi' || value.toLowerCase() === 'e'
              ? {
                  type: 'builtin:number',
                  value: value.toLowerCase() as 'pi' | 'e',
                }
              : !isNaN(parseFloat(value))
              ? {
                  type: 'number',
                  value: parseFloat(value),
                }
              : {
                  type: 'identifier',
                  value: value,
                };
          }
          const leftToken = createToken(first);
          const rightToken = createToken(second);
          expectResultsToBe(
            tokenize(
              `${first}${firstWhitespace.join(
                ''
              )}${operator}${secondWhitespace.join('')}${second}`
            ),
            'ok',
            [
              leftToken,
              {
                type: 'operator',
                value: operator as '+' | '-' | '*' | '/' | '^',
              },
              rightToken,
            ]
          );
        }
      )
    );
  });
});

function expectResultsToBe(
  result: ReturnType<typeof tokenize>,
  type: 'ok',
  tokens: Token[]
): void;
function expectResultsToBe(
  result: ReturnType<typeof tokenize>,
  type: 'error',
  errorMessage: string
): void;
function expectResultsToBe(
  result: ReturnType<typeof tokenize>,
  type: 'ok' | 'error',
  resultValue: Token[] | string
) {
  expect(result).toEqual({
    type,
    value: resultValue,
  });
}
