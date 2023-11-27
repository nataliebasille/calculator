export type NumberToken = {
  type: 'number';
  value: number;
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

export type CommaToken = {
  type: 'comma';
  value: ',';
};

export type Token =
  | NumberToken
  | OperatorToken<'+' | '-' | '*' | '/' | '^'>
  | ParenthesisToken
  | IdentifierToken
  | CommaToken;
