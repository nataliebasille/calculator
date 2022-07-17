export type Maybe<T> = { type: "some"; value: T } | { type: "none" };

export const some = <T>(value: T): Maybe<T> => ({ type: "some", value });
export const none = <T>(): Maybe<T> => ({ type: "none" });

export const map = <T, U>(f: (value: T) => U, maybe: Maybe<T>): Maybe<U> => {
  return maybe.type === "some" ? some(f(maybe.value)) : none();
};
