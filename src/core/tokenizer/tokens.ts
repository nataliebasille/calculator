export type TOKEN_TYPE =
  | "left_paren"
  | "right_paren"
  | "plus"
  | "minus"
  | "multiply"
  | "divide"
  | "exponent"
  | "modulo"
  | "number"
  | "function";

type GenericToken<T extends TOKEN_TYPE, V = never> = [V] extends [never]
  ? { type: T }
  : { type: T } & V;

export type NumberToken = GenericToken<"number", { value: number }>;
export type LeftParenToken = GenericToken<"left_paren">;
export type RightParenToken = GenericToken<"right_paren">;
export type PlusToken = GenericToken<"plus">;
export type MinusToken = GenericToken<"minus">;
export type MultiplyToken = GenericToken<"multiply">;
export type DivideToken = GenericToken<"divide">;
export type ExponentToken = GenericToken<"exponent">;
export type ModuloToken = GenericToken<"modulo">;
export type FunctionToken = GenericToken<"function", { name: string }>;

export type Token =
  | NumberToken
  | LeftParenToken
  | RightParenToken
  | PlusToken
  | MinusToken
  | MultiplyToken
  | DivideToken
  | ExponentToken
  | ModuloToken
  | FunctionToken;
