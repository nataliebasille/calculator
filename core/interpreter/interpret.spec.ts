import * as fc from 'fast-check';
import {
  INTERPRETATION_ERROR_CODES,
  InterpratationError,
  interpret,
} from './interpret';
import { tokenize } from '../tokenizer/tokenizer';
import { pipe, result } from '@natcore/typescript-utils/functional';
import {
  anyNumberStringArbitrary,
  builtinNumberArbitrary,
  numberStringArbitrary,
  oneParamFunctionArbitrary,
  signArbitrary,
} from '../+test_utils/arbitraries';
import * as builtins from '../builtin';

describe('interpret', () => {
  test('should interpret arbitrary number strings correctly', () => {
    fc.assert(
      fc.property(numberStringArbitrary, (numberString) => {
        runInterpretationTest(
          numberString,
          result.ok(parseFloat(numberString))
        );
      })
    );
  });

  test('should interpret built-in numbers correctly', () => {
    fc.assert(
      fc.property(builtinNumberArbitrary, (builtinNumber) => {
        runInterpretationTest(
          builtinNumber,
          result.ok(builtinNumber.toLowerCase() === 'pi' ? Math.PI : Math.E)
        );
      })
    );
  });

  test('should interpret arbitrary number that starts with a sign', () => {
    fc.assert(
      fc.property(
        fc.tuple(signArbitrary, numberStringArbitrary),
        ([sign, numberString]) => {
          runInterpretationTest(
            `${sign}${numberString}`,
            result.ok(
              sign === '-'
                ? -parseFloat(numberString)
                : parseFloat(numberString)
            )
          );
        }
      )
    );
  });

  it('should interpret built-in numbers that start with a sign', () => {
    fc.assert(
      fc.property(
        fc.tuple(signArbitrary, builtinNumberArbitrary),
        ([sign, builtinNumber]) => {
          const value = builtinNumber.toLowerCase() === 'pi' ? Math.PI : Math.E;
          runInterpretationTest(
            `${sign}${builtinNumber}`,
            result.ok(sign === '-' ? -value : value)
          );
        }
      )
    );
  });

  it('should evaluate expressions of [number] [+ OR -] [number]', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary),
          fc.constantFrom('+', '-'),
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary)
        ),
        ([left, operator, right]) => {
          const leftValue =
            left.toLowerCase() === 'pi'
              ? Math.PI
              : left === 'e'
              ? Math.E
              : parseFloat(left);
          const rightValue =
            right.toLowerCase() === 'pi'
              ? Math.PI
              : right === 'e'
              ? Math.E
              : parseFloat(right);

          runInterpretationTest(
            `${left} ${operator} ${right}`,
            result.ok(
              operator === '+' ? leftValue + rightValue : leftValue - rightValue
            )
          );
        }
      )
    );
  });

  it('should evaluate expressions of [number] [* OR /] [number]', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary),
          fc.constantFrom('*', '/'),
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary)
        ),
        ([left, operator, right]) => {
          const leftValue =
            left.toLowerCase() === 'pi'
              ? Math.PI
              : left === 'e'
              ? Math.E
              : parseFloat(left);
          const rightValue =
            right.toLowerCase() === 'pi'
              ? Math.PI
              : right === 'e'
              ? Math.E
              : parseFloat(right);

          runInterpretationTest(
            `${left} ${operator} ${right}`,
            operator === '/' && parseFloat(right) === 0
              ? result.error({
                  reason: INTERPRETATION_ERROR_CODES.division_by_zero,
                })
              : result.ok(
                  operator === '*'
                    ? leftValue * rightValue
                    : leftValue / rightValue
                )
          );
        }
      )
    );
  });

  it('[$1] + [$2] * [$3] equals [$1] + ([$2] * [$3])', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary),
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary),
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary)
        ),
        ([$1, $2, $3]) => {
          expectEqualResults(
            `${$1} + ${$2} * ${$3}`,
            `${$1} + (${$2} * ${$3})`
          );
        }
      )
    );
  });

  it('[$1] ^ [$2] * [$3] equals [$3] * ([$1] ^ [$2])', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary),
          fc
            .oneof(anyNumberStringArbitrary, builtinNumberArbitrary)
            .filter((s) => parseFloat(s) <= 1000),
          fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary)
        ),
        ([$1, $2, $3]) => {
          expectEqualResults(
            `${$1} ^ ${$2} * ${$3}`,
            `${$3} * (${$1} ^ ${$2})`
          );
        }
      )
    );
  });

  it('[$1] / 0 should be an error', () => {
    fc.assert(
      fc.property(
        fc.oneof(anyNumberStringArbitrary, builtinNumberArbitrary),
        ($1) => {
          runInterpretationTest(
            `${$1} / 0`,
            result.error({
              reason: INTERPRETATION_ERROR_CODES.division_by_zero,
            })
          );
        }
      )
    );
  });

  it('evaluate parentheses first', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.oneof(numberStringArbitrary),
          fc.oneof(numberStringArbitrary),
          fc.oneof(numberStringArbitrary).filter((s) => parseFloat(s) <= 1000)
        ),
        ([$1, $2, $3]) => {
          runInterpretationTest(
            `(${$1} + ${$2}) ^ (2 * ${$3})`,
            result.ok(
              Math.pow(parseFloat($1) + parseFloat($2), 2 * parseFloat($3))
            )
          );
        }
      )
    );
  });

  it('for 1 param functions: [fn] [number] equals [fn]([number])', () => {
    fc.assert(
      fc.property(
        fc.tuple(oneParamFunctionArbitrary, anyNumberStringArbitrary),
        ([fn, numberString]) => {
          const [left] = expectEqualResults(
            `${fn} ${numberString}`,
            `${fn}(${numberString})`
          );
          expect(left.type).toBe('ok');
        }
      )
    );
  });

  it('can handle multiple param functions', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom('min', 'max'),
          fc.array(anyNumberStringArbitrary, { minLength: 2, maxLength: 10 })
        ),
        ([fn, numbers]) => {
          runInterpretationTest(
            `${fn}(${numbers.join(', ')})`,
            result.ok(
              fn.toLowerCase() === 'min'
                ? Math.min(...numbers.map(getNumber))
                : Math.max(...numbers.map(getNumber))
            )
          );
        }
      )
    );
  });
});

function runInterpretationTest(
  input: string,
  expected: result.Result<number, InterpratationError>
) {
  const output = pipe(
    tokenize(input),
    result.flatMap((tokens) => interpret(tokens, builtins))
  );

  expect(output).toEqual(expected);
}

function expectEqualResults(input1: string, input2: string) {
  const output1 = pipe(
    tokenize(input1),
    result.flatMap((tokens) => interpret(tokens, builtins))
  );
  const output2 = pipe(
    tokenize(input2),
    result.flatMap((tokens) => interpret(tokens, builtins))
  );

  expect(output1).toEqual(output2);

  return [output1, output2];
}

function getNumber(value: string) {
  return value.toLowerCase() === 'pi'
    ? Math.PI
    : value.toLowerCase() === 'e'
    ? Math.E
    : parseFloat(value);
}
