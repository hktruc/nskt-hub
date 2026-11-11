// Giả lập D1 bằng SQLite có sẵn trong Node, chỉ dùng cho kiểm thử.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Params = (string | number | null | Uint8Array)[];

class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private params: Params = []) {}
  bind(...params: Params) {
    return new Stmt(this.db, this.sql, params);
  }
  exec() {
    const st = this.db.prepare(this.sql);
    const returnsRows = /^\s*(SELECT|WITH)/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql);
    if (returnsRows) {
      return { success: true, results: st.all(...this.params) as Record<string, unknown>[], meta: { changes: 0 } };
    }
    const r = st.run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes) } };
  }
  async run() {
    return this.exec();
  }
  async all() {
    return this.exec();
  }
  async first<T>() {
    return (this.exec().results[0] ?? null) as T | null;
  }
}

export function createTestDb() {
  const db = new DatabaseSync(":memory:");
  const dir = join(import.meta.dirname, "../../migrations");
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(join(dir, f), "utf8"));
  const d1 = {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.exec());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { d1: d1 as unknown as D1Database, raw: db };
}
