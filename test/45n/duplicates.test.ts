import { describe, expect, it } from "vitest";
import { dropSupersededAssignments, loadDisciplineInput } from "../../src/discipline/data";
import { computeDiscipline } from "../../src/discipline/engine";
import { COURSE } from "../../src/course";
import { createTestDb } from "../helpers/d1";

// Dữ liệu giả hoàn toàn. Khóa 45N-K02.
describe("[45n-hub] bài bị dh3g tạo lại và nộp bù bài ngày", () => {
  it("chỉ giữ bản bài còn được dh3g trả về gần nhất khi cùng tên và cùng hạn", () => {
    const rows = [
      { id: 936, title: "NHẬT KÍ NGÀY 20/11", type: "NORMAL", due_at: "2026-11-20T23:30:00", last_seen_at: "2026-11-19T23:10:06Z" },
      { id: 985, title: "Nhật kí ngày 20/11 ", type: "NORMAL", due_at: "2026-11-20T23:30:00", last_seen_at: "2026-11-23T00:40:06Z" },
      { id: 986, title: "NHẬT KÍ NGÀY 21/11", type: "NORMAL", due_at: "2026-11-21T23:30:00", last_seen_at: "2026-11-23T00:40:06Z" },
    ];
    const r = dropSupersededAssignments(rows);
    expect(r.kept.map((a) => a.id)).toEqual([985, 986]);
    expect([...r.droppedIds]).toEqual([936]);
  });

  it("bản cũ không còn tính lỗi oan; nộp bù bài ngày tính lỗi nhẹ", async () => {
    const { d1, raw } = createTestDb();
    const t = "2026-11-12T00:00:00Z";
    raw.exec(`
      INSERT INTO teams VALUES (1,'Nhóm 1-K2','${t}','${t}');
      INSERT INTO learners VALUES (1,'Học Viên Một','0911000001',NULL,2,1,'${t}','${t}'), (2,'Học Viên Hai','0911000002',NULL,2,1,'${t}','${t}');
      INSERT INTO assignments (id,title,type,due_at,first_seen_at,last_seen_at) VALUES
        (936,'NHẬT KÍ NGÀY 20/11','NORMAL','2026-11-20T23:30:00','${t}','2026-11-19T23:10:06Z'),
        (985,'NHẬT KÍ NGÀY 20/11','NORMAL','2026-11-20T23:30:00','${t}','2026-11-23T00:40:06Z');
      INSERT INTO submissions (learner_id,assignment_id,status,submitted_at,content_hash,first_seen_at,changed_at,last_seen_at) VALUES
        (1,936,'NOT_SUBMITTED',NULL,'h','${t}','${t}','${t}'), (2,936,'NOT_SUBMITTED',NULL,'h','${t}','${t}','${t}'),
        (1,985,'DONE','2026-11-20T20:00:00','h','${t}','${t}','${t}'), (2,985,'OVERDUE','2026-11-21T08:00:00','h','${t}','${t}','${t}');
    `);
    const input = await loadDisciplineInput(d1, new Date("2026-11-23T05:00:00Z"));
    expect(input.assignments.map((a) => a.id)).toEqual([985]);
    const res = computeDiscipline(input, COURSE.discipline);
    const one = res.find((x) => x.l.id === 1)!;
    const two = res.find((x) => x.l.id === 2)!;
    expect(one.nhe).toBe(0); // nộp đúng hạn, không bị bản cũ tính oan
    expect(two.nhe).toBe(1); // nộp bù sau hạn: lỗi nhẹ
    expect(two.bai[0]!.state).toBe("tre");
  });
});
