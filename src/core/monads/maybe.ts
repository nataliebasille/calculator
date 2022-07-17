type MaybeType<T> = { type: "some"; value: T } | { type: "none" };

export class Maybe<T> {
  private constructor(private maybe: MaybeType<T>) {}

  static some<T>(value: T): Maybe<T> {
    return new Maybe({ type: "some", value });
  }

  static none<T>(): Maybe<T> {
    return new Maybe({ type: "none" });
  }

  match<U>({ some, none }: { some: (value: T) => U; none: () => U }): U {
    return this.maybe.type === "some" ? some(this.maybe.value) : none();
  }

  map<U>(f: (value: T) => U): Maybe<U> {
    return this.maybe.type === "some"
      ? Maybe.some(f(this.maybe.value))
      : Maybe.none<U>();
  }

  flatMap<U>(f: (value: T) => Maybe<U>): Maybe<U> {
    return this.maybe.type === "some" ? f(this.maybe.value) : Maybe.none<U>();
  }
}
