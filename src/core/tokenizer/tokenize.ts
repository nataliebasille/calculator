import { Token } from "./tokens";

const tokenTests: {
  test: RegExp | string;
  createToken: (value: string) => Token;
}[] = [
  {
    test: /-?\d+\.?\d*(e[+-]?\d+)?/,
    createToken: (value: string) => ({
      type: "number",
      value: value === "-0" ? 0 : parseFloat(value),
    }),
  },
  { test: "(", createToken: () => ({ type: "left_paren" }) },
  { test: ")", createToken: () => ({ type: "right_paren" }) },
  { test: "+", createToken: () => ({ type: "plus" }) },
  { test: "-", createToken: () => ({ type: "minus" }) },
  { test: "*", createToken: () => ({ type: "multiply" }) },
  { test: "/", createToken: () => ({ type: "divide" }) },
  { test: "^", createToken: () => ({ type: "exponent" }) },
  { test: "%", createToken: () => ({ type: "modulo" }) },
  {
    test: /[a-zA-Z]+/,
    createToken: (value: string) => ({
      type: "function",
      name: value,
    }),
  },
];

export const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char === " ") {
      index++;
      continue;
    }

    for (const { test, createToken } of tokenTests) {
      if (typeof test === "string") {
        if (input.startsWith(test, index)) {
          tokens.push(createToken(test));
          index += test.length;
          break;
        }
      } else {
        const match = input
          .slice(index)
          .match(new RegExp(`^${test.toString().slice(1, -1)}`));

        if (match) {
          const [value] = match;
          tokens.push(createToken(value));
          index = index + value.length;
          break;
        }
      }
    }
  }

  return tokens;
};
