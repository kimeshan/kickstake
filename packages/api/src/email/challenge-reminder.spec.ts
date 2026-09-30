import { reminderHtml } from "./email";
import { fill, reminderCopy } from "./challenge-reminder-copy";

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
