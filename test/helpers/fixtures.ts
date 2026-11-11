// Dữ liệu GIẢ theo đúng cấu trúc báo cáo dh3g. Không có thông tin thật nào.
import type { Env } from "../../src/env";

export function submissionsReport(opts: { answer?: string; day?: string } = {}) {
  const day = opts.day ?? "2026-11-07";
  return {
    communityId: 44,
    communityName: "Cộng đồng thử",
    fromDate: day,
    toDate: day,
    generatedAt: `${day}T01:00:00Z`,
    assignments: [
      { id: 501, title: "Bài thử 1", type: "NORMAL", typeLabel: "Bài thường", dueDate: `${day}T16:59:00Z`, gracePeriodMinutes: 30, courseId: 9, courseName: "Khóa thử" },
    ],
    members: [
      {
        userId: 1001, fullName: "Học Viên A", phone: "0000000001", email: "a@example.invalid", cohort: 1, teamId: 7, teamName: "Đội Thử 1",
        submissions: [
          {
            assignmentId: 501, status: "DONE", statusLabel: "Đã nộp", rawStatus: "SUBMITTED", submissionId: 9001,
            submittedAt: `${day}T10:00:00Z`, editCount: 0, charCount: 12, mediaCount: 0,
            answers: [{ question: "Câu 1", type: "TEXT", answer: opts.answer ?? "Trả lời thử" }],
            feedbackCount: 1,
            feedbacks: [{ submissionId: 9001, reviewerId: 1002, reviewerName: "Học Viên B", grade: 8, comment: "Tốt", createdAt: `${day}T12:00:00Z` }],
          },
        ],
      },
      {
        userId: 1002, fullName: "Học Viên B", phone: "0000000002", email: "b@example.invalid", cohort: 1, teamId: 7, teamName: "Đội Thử 1",
        submissions: [{ assignmentId: 501, status: "NOT_SUBMITTED", statusLabel: "Chưa nộp" }],
      },
    ],
  };
}

export function attendanceReport() {
  return {
    communityId: 44,
    generatedAt: "2026-11-07T01:00:00Z",
    sessions: [{ id: 301, title: "Buổi thử", startTime: "2026-11-05T12:00:00Z", endTime: "2026-11-05T14:00:00Z", courseId: 9 }],
    members: [
      { userId: 1001, fullName: "Học Viên A", teamId: 7, teamName: "Đội Thử 1", attendances: [{ sessionId: 301, attended: true, attendedAt: "2026-11-05T12:01:00Z" }] },
      { userId: 1002, fullName: "Học Viên B", teamId: 7, teamName: "Đội Thử 1", attendances: [{ sessionId: 301, attended: false }] },
    ],
  };
}

export const FAKE_KEY = "KHOA-GIA-CHI-DUNG-TRONG-KIEM-THU";

export function testEnv(db: D1Database, extra: Partial<Env> = {}): Env {
  return {
    APP_NAME: "nskt-hub",
    DB: db,
    DH3G_API_KEY: FAKE_KEY,
    DH3G_BASE_URL: "https://dh3g.invalid",
    DH3G_COMMUNITY_ID: "44",
    SYNC_START_DATE: "2026-09-23",
    ...extra,
  };
}

/** dh3g giả: trả lời theo hàm handler, ghi lại các yêu cầu đã nhận. */
export function fakeDh3g(handler: (url: URL) => Response) {
  const calls: { url: URL; key: string | null }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, key: new Headers(init?.headers).get("X-API-KEY") });
    return handler(url);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
