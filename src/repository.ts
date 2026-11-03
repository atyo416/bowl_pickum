import type { State } from "./model";
import { seed } from "./seed";
export interface Repository {
  load(): State;
  save(state: State): void;
  reset(): State;
}
export class LocalRepository implements Repository {
  constructor(
    private storage: Storage,
    private key = "bowl-room:v1",
  ) {}
  load() {
    const raw = this.storage.getItem(this.key);
    if (!raw) return seed();
    try {
      const s = JSON.parse(raw);
      if (
        s.version !== 1 ||
        !Array.isArray(s.entries) ||
        !Array.isArray(s.games) ||
        !s.contest
      )
        throw Error();
      return s as State;
    } catch {
      throw Error(
        "Saved data is incompatible or damaged. Reset demonstration data to continue.",
      );
    }
  }
  save(s: State) {
    this.storage.setItem(this.key, JSON.stringify(s));
  }
  reset() {
    const s = seed();
    this.save(s);
    return s;
  }
}
