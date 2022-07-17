import { evaluate } from "./evaluate";
import * as fc from "fast-check";
import { Result } from "../monads";

const numberArbitrary = fc
  .float()
  .filter(
    (x) =>
      1 / x !== -Infinity &&
      x !== Infinity &&
      x !== -Infinity &&
      !Number.isNaN(x)
  );

const plusArbitrary = fc.constant("+" as const);
const minusArbitrary = fc.constant("-" as const);
const multiplyArbitrary = fc.constant("*" as const);
const divideArbitrary = fc.constant("/" as const);
const moduloArbitrary = fc.constant("%" as const);
const exponentArbitrary = fc.constant("**" as const);

const termOperatorArbitrary = fc.oneof(plusArbitrary, minusArbitrary);
const factorOperatorArbitrary = fc.oneof(
  multiplyArbitrary,
  divideArbitrary,
  moduloArbitrary,
  exponentArbitrary
);
const anyOperator = fc.oneof(termOperatorArbitrary, factorOperatorArbitrary);

describe(evaluate.name, () => {
  it("returns the sum of two numbers", () => {
    fc.assert(
      fc.property(fc.tuple(numberArbitrary, numberArbitrary), ([a, b]) => {
        expect(evaluate(`${a} + ${b}`)).toEqual(
          Result.ok(getExpectedResult(a + b))
        );
      })
    );
  });

  it("returns the difference of two numbers", () => {
    fc.assert(
      fc.property(fc.tuple(numberArbitrary, numberArbitrary), ([a, b]) => {
        expect(evaluate(`${a} - ${b}`)).toEqual(
          Result.ok(getExpectedResult(a - b))
        );
      })
    );
  });

  it("returns the product of two numbers", () => {
    fc.assert(
      fc.property(fc.tuple(numberArbitrary, numberArbitrary), ([a, b]) => {
        expect(evaluate(`${a} * ${b}`)).toEqual(
          Result.ok(getExpectedResult(a * b))
        );
      })
    );
  });

  it("returns the quotient of two numbers", () => {
    fc.assert(
      fc.property(fc.tuple(numberArbitrary, numberArbitrary), ([a, b]) => {
        expect(evaluate(`${a} / ${b}`)).toEqual(
          Result.ok(getExpectedResult(a / b))
        );
      })
    );
  });

  it("returns the remainder of two numbers", () => {
    fc.assert(
      fc.property(fc.tuple(numberArbitrary, numberArbitrary), ([a, b]) => {
        expect(evaluate(`${a} % ${b}`)).toEqual(
          Result.ok(getExpectedResult(a % b))
        );
      })
    );
  });

  it("returns the power of two numbers", () => {
    fc.assert(
      fc.property(fc.tuple(numberArbitrary, numberArbitrary), ([a, b]) => {
        expect(evaluate(`${a} ^ ${b}`)).toEqual(
          Result.ok(getExpectedResult(a ** b))
        );
      })
    );
  });

  it("order of operation matches javascript", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          numberArbitrary,
          anyOperator,
          numberArbitrary,
          anyOperator,
          numberArbitrary
        ),
        ([x1, o1, x2, o2, x3]) => {
          expect(
            evaluate(
              `${x1} ${o1 === "**" ? "^" : o1} ${x2} ${
                o2 === "**" ? "^" : o2
              } ${x3}`
            )
          ).toEqual(
            Result.ok(
              getExpectedResult(eval(`(${x1}) ${o1} (${x2}) ${o2} (${x3})`))
            )
          );
        }
      )
    );
  });
});

function getExpectedResult(value: number) {
  return 1 / value === -Infinity ? 0 : value;
}
