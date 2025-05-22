export function convertDate(value: number) {
  // 32_503_680_000 is '1971-01-12T04:48:00.000Z' and 32_503_680_000_000 is '3000-01-01T00:00:00.000Z'
  if (value < 32_503_680_000) {
    return value * 1000
  }

  return value
}

export function isValidDate(date: number) {
  // 631_152_000_000 is '1990-01-01T00:00:00.000Z'
  return date < 9_999_999_999_999 && date > 631_152_000_000
}
