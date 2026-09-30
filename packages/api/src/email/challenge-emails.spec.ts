import { digestHtml, reminderHtml } from "./email";
import { fill, reminderCopy } from "./challenge-reminder-copy";
import { digestCopy } from "./challenge-digest-copy";

const input = {
  to: "p@example.com",
  locale: "en",
  name: '<script>alert("x")</script>',
  title: 'Family "Level" Up & Co <b>',
  weekNumber: 2,
  range: "28 Sep – 4 Oct",
  baseline: "150",
  deadline: "Mon, Oct 19, 12:00 PM GMT+2",
  url: "https://challenge.kickstake.app/challenges/abc",
};
const values = {
  title: input.title,
  n: input.weekNumber,
  range: input.range,
  name: input.name,
  baseline: input.baseline,
  deadline: input.deadline,
};

describe("reminder email", () => {
  it("escapes participant-supplied text — names and titles are data, not markup", () => {
    const html = reminderHtml(input, reminderCopy("en"), values);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Family &quot;Level&quot; Up &amp; Co &lt;b&gt;");
    expect(html).toContain(input.url);
  });

  it("uses the member's locale, and marks Arabic as right-to-left", () => {
    expect(reminderHtml({ ...input, locale: "ar" }, reminderCopy("ar"), values)).toContain('dir="rtl"');
    expect(reminderHtml(input, reminderCopy("en"), values)).not.toContain('dir="rtl"');
    expect(reminderCopy("es").cta).toBe("Anotar mis minutos");
    // Unknown locales fall back to English rather than showing placeholders.
    expect(reminderCopy("xx")).toEqual(reminderCopy("en"));
  });

  it("fills placeholders and leaves unknown ones alone", () => {
    expect(fill("Week {n} · {range}", { n: 2, range: "28 Sep" })).toBe("Week 2 · 28 Sep");
    expect(fill("Hi {nope}", {})).toBe("Hi {nope}");
  });
});

describe("digest email", () => {
  const rows = [
    { rank: 1, name: '<img src=x onerror="alert(1)">', minutes: "420", level: "L6", isMe: false },
    { rank: 2, name: "Kim", minutes: "230", level: "L2", isMe: true },
    { rank: null, name: "Lerato", minutes: null, level: null, isMe: false },
  ];
  const base = {
    to: "p@example.com",
    locale: "en",
    name: "Kim",
    title: "Family Level Up",
    weekNumber: 2,
    range: "28 Sep – 4 Oct",
    baseline: "150",
    groupMinutes: "650",
    atBaseline: 2,
    activeCount: 3,
    rows,
    you: rows[1],
    url: "https://challenge.kickstake.app/challenges/abc",
  };
  const values = {
    title: base.title,
    n: 2,
    range: base.range,
    name: base.name,
    baseline: base.baseline,
    groupMinutes: base.groupMinutes,
    done: 2,
    total: 3,
    rank: 2,
    minutes: "230",
  };

  it("escapes names from the leaderboard", () => {
    const html = digestHtml(base, digestCopy("en"), values);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("shows medals for the top three, a dash for people who haven't entered, and the unit", () => {
    const html = digestHtml(base, digestCopy("en"), values);
    expect(html).toContain("🥇");
    expect(html).toContain("🥈");
    expect(html).toContain("—"); // Lerato, no entry
    expect(html).toContain("min");
    // Arabic keeps its own unit and flips direction.
    const ar = digestHtml({ ...base, locale: "ar" }, digestCopy("ar"), values);
    expect(ar).toContain('dir="rtl"');
    expect(digestCopy("ar").minUnit).toBe("د");
  });
});
