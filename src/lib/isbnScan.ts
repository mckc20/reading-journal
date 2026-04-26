export function normalizeScannedIsbn(value: string): string | null {
  const digits = value.replace(/\D/g, "");

  if (!/^(978|979)\d{10}$/.test(digits)) {
    return null;
  }

  return hasValidEan13Checksum(digits) ? digits : null;
}

function hasValidEan13Checksum(digits: string): boolean {
  const checkDigit = Number(digits[12]);
  const sum = digits
    .slice(0, 12)
    .split("")
    .reduce((total, digit, index) => {
      const multiplier = index % 2 === 0 ? 1 : 3;
      return total + Number(digit) * multiplier;
    }, 0);

  return (10 - (sum % 10)) % 10 === checkDigit;
}
