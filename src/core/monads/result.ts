export type ResultType<T> =
  | { type: "ok"; value: T }
  | { type: "failure"; error: string };
export class Result<T> {
  private constructor(private result: ResultType<T>) {}

  static ok<T>(value: T): Result<T> {
    return new Result({ type: "ok", value });
  }

  static failure<T>(error: string): Result<T> {
    return new Result({ type: "failure", error });
  }

  map<U>(f: (value: T) => U): Result<U> {
    return this.result.type === "ok"
      ? Result.ok(f(this.result.value))
      : Result.failure(this.result.error);
  }

  flatMap<U>(f: (value: T) => Result<U>): Result<U> {
    return this.result.type === "ok"
      ? f(this.result.value)
      : Result.failure(this.result.error);
  }
}
