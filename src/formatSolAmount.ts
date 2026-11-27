export interface FormattedSolAmount {
  display: string;
  ariaLabel: string;
  approximate: boolean;
}

const FALLBACK_DECIMALS = 4;
const SUBSCRIPT_DIGITS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

function expandedDecimal(value: number): string {
  return value.toFixed(20).replace(/\.?0+$/, "");
}

function leadingFractionalZeros(value: number): number {
  const fraction = Math.abs(value).toFixed(20).split(".")[1] ?? "";
  let count = 0;
  while (fraction[count] === "0") count++;
  return count;
}

function formatSubscriptAmount(value: number, negative: boolean): string {
  const zeroCount = leadingFractionalZeros(value);
  const decimals = zeroCount + 2;
  const rounded = Math.abs(value).toFixed(decimals);
  const fraction = rounded.split(".")[1] ?? "";
  const roundedZeroCount = fraction.match(/^0*/)?.[0].length ?? 0;

  if (roundedZeroCount < 3) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: FALLBACK_DECIMALS,
      useGrouping: true,
    }).format(value);
  }

  const significantDigits = fraction.slice(roundedZeroCount, roundedZeroCount + 2);
  const subscript = String(roundedZeroCount)
    .split("")
    .map(digit => SUBSCRIPT_DIGITS[digit] ?? digit)
    .join("");
  return `${negative ? "-" : ""}0.0${subscript}${significantDigits}`;
}

export function formatSolAmount(value: number | null | undefined): FormattedSolAmount {
  if (value == null || !Number.isFinite(value)) {
    return { display: "--", ariaLabel: "no data", approximate: false };
  }

  if (Object.is(value, -0) || value === 0) {
    return { display: "0", ariaLabel: "0 SOL", approximate: false };
  }

  const negative = value < 0;
  const absolute = Math.abs(value);
  const rounded = Number(absolute.toFixed(FALLBACK_DECIMALS));

  if (rounded === 0) {
    const display = `${negative ? "-" : ""}<0.0001`;
    return {
      display,
      ariaLabel: `${negative ? "negative " : ""}less than 0.0001 SOL`,
      approximate: true,
    };
  }

  const zeroCount = leadingFractionalZeros(absolute);
  const display = zeroCount >= 3
    ? formatSubscriptAmount(value, negative)
    : new Intl.NumberFormat("en-US", {
        maximumFractionDigits: FALLBACK_DECIMALS,
        useGrouping: true,
      }).format(value);
  const ariaLabel = zeroCount >= 3
    ? `approximately ${expandedDecimal(value)} SOL`
    : `approximately ${display} SOL`;

  return {
    display,
    ariaLabel,
    approximate: true,
  };
}