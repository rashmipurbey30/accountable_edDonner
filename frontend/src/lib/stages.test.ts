import { expect, test } from "vitest";
import { STAGES, isOpen, stageName, usualProbability } from "./stages";

test("order, names, colors and usual probabilities", () => {
  expect(STAGES.map((s) => [s.key, s.name, s.probability, s.color])).toEqual([
    ["new", "New", 10, "#CDD8DB"],
    ["qualified", "Qualified", 25, "#0E7A9F"],
    ["proposal", "Proposal", 50, "#FFC145"],
    ["negotiation", "Negotiation", 75, "#F78C6B"],
    ["won", "Won", 100, "#06D6A0"],
    ["lost", "Lost", 0, "#D33259"],
  ]);
  expect(stageName("negotiation")).toBe("Negotiation");
  expect(usualProbability("proposal")).toBe(50);
});

test("open and closed stages", () => {
  expect(isOpen("won")).toBe(false);
  expect(isOpen("lost")).toBe(false);
  expect(isOpen("new")).toBe(true);
  expect(isOpen("negotiation")).toBe(true);
});
