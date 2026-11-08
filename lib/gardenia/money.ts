export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function lineValue(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export function formatAed(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
  }).format(roundMoney(value));
}
