import * as fc from 'fast-check';

export const signArbitrary = fc.constantFrom('+', '-');
export const digitArbitrary = fc.constantFrom(...'0123456789');
export const characterArbitrary = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
);
export const numberStringArbitrary = fc
  .tuple(
    fc.array(digitArbitrary, { minLength: 0, maxLength: 10 }),
    fc.option(fc.array(digitArbitrary, { minLength: 1, maxLength: 10 })),
    fc.option(signArbitrary),
    fc.option(fc.array(digitArbitrary, { minLength: 1, maxLength: 10 }))
  )
  .map(([integer, decimal, exponentSign, exponent]) => {
    if (!integer.length && !decimal) {
      return '0';
    }

    return `${integer.join('')}${decimal ? `.${decimal.join('')}` : ''}${
      exponent ? `e${exponentSign ?? ''}${exponent.join('')}` : ''
    }`;
  });
export const piArbitrary = fc
  .tuple(fc.constantFrom('P', 'p'), fc.constantFrom('i', 'I'))
  .map(([p, i]) => `${p}${i}`);
export const eArbitrary = fc.constant('e');
export const builtinNumberArbitrary = fc.oneof(piArbitrary, eArbitrary);
export const anyNumberStringArbitrary = fc.oneof(
  numberStringArbitrary,
  builtinNumberArbitrary
);
export const operatorArbitrary = fc.constantFrom('+', '-', '*', '/', '^');
export const parenthesisArbitrary = fc.constantFrom('(', ')');
export const oneParamFunctionArbitrary = fc
  .constantFrom(
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'log',
    'sqrt',
    'abs',
    'floor',
    'ceil',
    'round'
  )
  .map((fn) =>
    fn
      .toLowerCase()
      .split('')
      .map(function (c) {
        return Math.random() < 0.5 ? c : c.toUpperCase();
      })
      .join('')
  );
