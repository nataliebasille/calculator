export type NumberToken = {
  type: 'number';
  value: number;
};

export type BuiltinNumberToken = {
  type: 'builtin:number';
  value: 'pi' | 'e';
};

export type OperatorToken<TOperator extends string> = TOperator extends string
  ? {
      type: 'operator';
      value: TOperator;
    }
  : never;

export type ParenthesisToken =
  | {
      type: 'left_paren';
      value: '(';
    }
  | {
      type: 'right_paren';
      value: ')';
    };

export type IdentifierToken = {
  type: 'identifier';
  value: string;
};

export type Token =
  | NumberToken
  | BuiltinNumberToken
  | OperatorToken<'+' | '-' | '*' | '/' | '^'>
  | ParenthesisToken
  | IdentifierToken;
