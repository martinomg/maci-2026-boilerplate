import { describe, expect, it } from "vitest";
import { embedText, VECTOR_SIZE } from "./vector";

describe("embedText", () => {
  it("returns a deterministic normalized vector", () => {
    const first = embedText("Directus and Next.js");
    const second = embedText("Directus and Next.js");
    const magnitude = Math.sqrt(first.reduce((sum, value) => sum + value ** 2, 0));

    expect(first).toHaveLength(VECTOR_SIZE);
    expect(first).toEqual(second);
    expect(magnitude).toBeCloseTo(1, 8);
  });

  it("returns a zero vector for empty input", () => {
    expect(embedText("   ").every((value) => value === 0)).toBe(true);
  });
});

