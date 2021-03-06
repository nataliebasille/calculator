import * as fc from "fast-check";
import { Result } from "../monads";
import { tokenize } from "./tokenize";
import { Token } from "./tokens";

const postiveNumber = fc.float().filter((x) => x > 0 && x !== Infinity);
const negativeNumber = fc.float().filter((x) => x < 0 && x !== -Infinity);
const zero = fc.constant("0");
const negativeZero = fc.constant("-0");

const tokens = fc.oneof(
  fc.constant("("),
  fc.constant(")"),
  fc.constant("+"),
  fc.constant("-"),
  fc.constant("*"),
  fc.constant("/"),
  fc.constant("^"),
  fc.constant("%"),
  postiveNumber,
  negativeNumber,
  zero,
  negativeZero
);

describe(tokenize.name, () => {
  it("tokenizes (", () => {
    expect(tokenize("(")).toEqual(Result.ok([{ type: "left_paren" }]));
  });

  it("tokenizes )", () => {
    expect(tokenize(")")).toEqual(Result.ok([{ type: "right_paren" }]));
  });

  it("tokenizes +", () => {
    expect(tokenize("+")).toEqual(Result.ok([{ type: "plus" }]));
  });

  it("tokenizes -", () => {
    expect(tokenize("-")).toEqual(Result.ok([{ type: "minus" }]));
  });

  it("tokenizes *", () => {
    expect(tokenize("*")).toEqual(Result.ok([{ type: "multiply" }]));
  });

  it("tokenizes /", () => {
    expect(tokenize("/")).toEqual(Result.ok([{ type: "divide" }]));
  });

  it("tokenizes ^", () => {
    expect(tokenize("^")).toEqual(Result.ok([{ type: "exponent" }]));
  });

  it("tokenizes %", () => {
    expect(tokenize("%")).toEqual(Result.ok([{ type: "modulo" }]));
  });

  it("tokenizes positive numbers", () => {
    fc.assert(
      fc.property(postiveNumber, (value) => {
        expect(tokenize(`${value}`)).toEqual(
          Result.ok([{ type: "number", value }])
        );
      })
    );
  });

  it("tokenizes negative numbers", () => {
    fc.assert(
      fc.property(negativeNumber, (value) => {
        expect(tokenize(`${value}`)).toEqual(
          Result.ok([{ type: "number", value }])
        );
      })
    );
  });

  it("tokenizes -0 to type=number value=0", () => {
    expect(tokenize("-0")).toEqual(Result.ok([{ type: "number", value: 0 }]));
  });

  it("tokenizes 0 to type=number value=0", () => {
    expect(tokenize("0")).toEqual(Result.ok([{ type: "number", value: 0 }]));
  });

  it("it tokenizes multiple tokens separated by whitespace", () => {
    fc.assert(
      fc.property(
        fc.array(tokens, { minLength: 2, maxLength: 10 }),
        fc.array(fc.constant(" "), { minLength: 1 }),
        (tokens, whitespaces) => {
          expect(tokenize(tokens.join(whitespaces.join("")))).toEqual(
            tokens
              .map((token) =>
                tokenize(`${token}`).map((tokenized) => tokenized[0])
              )
              .reduce((acc, token) => {
                return acc.flatMap((all) =>
                  token.map((value) => all.concat(value))
                );
              }, Result.ok([] as Token[]))
          );
        }
      )
    );
  });
});
