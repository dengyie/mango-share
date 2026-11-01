// Only match a standalone zero, not digits inside a price such as $10 or $0.99.
export function isFreeValue(value?: string): boolean {
  if (!value || /非[^，,；;。]*免费/.test(value)) return false;
  return /免费|无|(?:^|[^\d.])(?:[$€£¥]\s*)?0(?:\.0+)?(?![\d.])/i.test(value);
}

export function hasCashback(value?: string): boolean {
  if (!value || /无|未公开|待确认/.test(value)) return false;
  const rates = [...value.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
  return rates.length ? rates.some((match) => Number(match[1]) > 0) : true;
}
