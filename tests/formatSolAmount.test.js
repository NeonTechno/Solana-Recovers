import assert from "node:assert/strict";
import test from "node:test";
import { formatSolAmount } from "../src/formatSolAmount.ts";

test("formats a Devnet SOL amount with four approximate decimals and grouping", () => {
  assert.deepEqual(formatSolAmount(1234.56789), {
    display: "1,234.5679",
    ariaLabel: "approximately 1,234.5679 SOL",
    approximate: true,
  });
});

test("formats a tiny SOL amount with zero-subscript and an expanded accessible label", () => {
  assert.deepEqual(formatSolAmount(0.00005835), {
    display: "0.0₄58",
    ariaLabel: "approximately 0.00005835 SOL",
    approximate: true,
  });
});

test("does not render a non-zero amount as zero when the fallback precision rounds it away", () => {
  assert.deepEqual(formatSolAmount(0.00004), {
    display: "<0.0001",
    ariaLabel: "less than 0.0001 SOL",
    approximate: true,
  });
});

test("exact zero and unavailable values have explicit accessible text", () => {
  assert.deepEqual(formatSolAmount(0), {
    display: "0",
    ariaLabel: "0 SOL",
    approximate: false,
  });
  assert.deepEqual(formatSolAmount(null), {
    display: "--",
    ariaLabel: "no data",
    approximate: false,
  });
  assert.equal(formatSolAmount(Number.NaN).display, "--");
});