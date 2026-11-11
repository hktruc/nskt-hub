import { describe, expect, it } from "vitest";
import { classify, findMedia, mediaOfAnswers } from "../src/domain/media";
import { isLearnerTeam, teamCode, teamLabel } from "../src/domain/teams";

describe("phát hiện video / ảnh / tệp", () => {
  it("phân loại theo dạng link thật gặp trong bài nộp", () => {
    expect(classify("https://youtu.be/abc123")).toBe("youtube");
    expect(classify("https://www.youtube.com/shorts/abc")).toBe("youtube");
    expect(classify("https://studio.youtube.com/video/abc/edit")).toBe("youtube");
    expect(classify("https://www.facebook.com/reel/123")).toBe("facebook");
    expect(classify("https://m.facebook.com/story.php?id=1")).toBe("facebook");
    expect(classify("https://fb.watch/xyz/")).toBe("facebook");
    expect(classify("https://vt.tiktok.com/ZS123/")).toBe("tiktok");
    expect(classify("https://s3.sunteco.app/images-stc/images/a.jpeg")).toBe("image");
    expect(classify("https://s3.sunteco.app/images-stc/images/a.PNG")).toBe("image");
    expect(classify("https://s3.sunteco.app/files/bai.pdf")).toBe("file");
    expect(classify("https://s3.sunteco.app/files/clip.mp4")).toBe("video-file");
    expect(classify("https://drive.google.com/file/d/1/view")).toBe("drive");
    expect(classify("https://static.xx.fbcdn.net/x")).toBe("image");
    expect(classify("https://canva.link/abc")).toBe("link");
  });

  it("tách link trong chữ, bỏ dấu câu cuối, không đếm trùng", () => {
    const items = findMedia("Video: https://youtu.be/A1, ảnh https://s3.sunteco.app/i/x.jpg. Lại https://youtu.be/A1");
    expect(items).toEqual([
      { kind: "youtube", url: "https://youtu.be/A1" },
      { kind: "image", url: "https://s3.sunteco.app/i/x.jpg" },
    ]);
  });

  it("chỉ đếm trong câu trả lời, không đếm link trong đề bài", () => {
    const json = JSON.stringify([
      { question: "[Ảnh] https://s3.sunteco.app/images/slide.jpeg Làm bài", type: "Tự luận", answer: "https://youtu.be/V1 https://fb.watch/V2" },
      { question: "Câu 2", type: "Tự luận", answer: "https://s3.sunteco.app/images/a.jpeg https://drive.google.com/x" },
      { question: "Câu 3", type: "Trắc nghiệm", answer: null },
    ]);
    const m = mediaOfAnswers(json);
    expect([m.videos, m.images, m.files]).toEqual([2, 1, 1]);
  });

  it("dữ liệu hỏng thì coi như không có gì", () => {
    expect(mediaOfAnswers("không phải json").items).toEqual([]);
    expect(mediaOfAnswers(null).videos).toBe(0);
  });
});

describe("mã đội", () => {
  it("đổi tên đội dh3g sang mã thôn", () => {
    expect(teamCode("🐟 Đội Cá Chép 01")).toBe("T01");
    expect(teamCode("🐟 Đội Cá Chép 12")).toBe("T12");
    expect(teamCode("Đội Ca Chep 7")).toBe("T07");
    expect(teamCode("BTC")).toBe("BTC");
    expect(teamCode(null)).toBe("");
    expect(isLearnerTeam("T05")).toBe(true);
    expect(isLearnerTeam("BTC")).toBe(false);
    expect(teamLabel("T05")).toBe("Đội 05");
  });
});
