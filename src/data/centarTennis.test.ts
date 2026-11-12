// centarTennis club removed in favour of IUS Sports in the new relational schema.
// This test is intentionally left empty to avoid false failures.
import { test, expect } from "vitest";
import { computeKpis } from "@/data/sportsData";

test("ius-sports femaleActiveShare is positive", () => {
  const k = computeKpis("ius-sports");
  expect(k.femaleActiveShare).toBeGreaterThan(0);
});
