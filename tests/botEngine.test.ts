import { BOT_DUMMY_RESPONSE, buildBotResponse } from "../lib/botEngine";
import { describe, expect, it } from "vitest";

describe("botEngine", () => {
  it("returns a fixed dummy response when no resolution is active", () => {
    expect(buildBotResponse(null)).toBe(BOT_DUMMY_RESPONSE);
  });

  it("prefixes the dummy response for question prompts", () => {
    expect(
      buildBotResponse({
        kind: "question",
        title: "質問カード",
        description: "理想の働き方は？",
        spaceId: 2,
      }),
    ).toContain("質問へのBot回答");
  });
});
