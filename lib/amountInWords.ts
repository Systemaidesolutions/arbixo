// English peso amount in words, e.g. 1234.50 -> "One Thousand Two Hundred
// Thirty Four Pesos and 50/100".
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest < 20) {
    if (rest) parts.push(ONES[rest]);
  } else {
    const t = TENS[Math.floor(rest / 10)];
    const o = rest % 10;
    parts.push(o ? `${t} ${ONES[o]}` : t);
  }
  return parts.join(" ");
}

function toWords(n: number): string {
  if (n === 0) return "Zero";
  const groups: number[] = [];
  let x = Math.floor(n);
  while (x > 0) { groups.push(x % 1000); x = Math.floor(x / 1000); }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i]) parts.push(`${threeDigits(groups[i])}${SCALES[i] ? " " + SCALES[i] : ""}`);
  }
  return parts.join(" ");
}

export function pesosInWords(amount: number): string {
  const pesos = Math.floor(Math.abs(amount) + 1e-9);
  const centavos = Math.round((Math.abs(amount) - pesos) * 100);
  return `${toWords(pesos)} Pesos and ${String(centavos).padStart(2, "0")}/100`;
}
