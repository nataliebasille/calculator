export type InterpreterContext = {
  readonly numbers: {
    readonly [key: string]: number;
  };
  readonly functions: {
    readonly [key: string]: (...args: number[]) => number;
  };
};
