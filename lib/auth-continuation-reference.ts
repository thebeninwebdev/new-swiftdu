const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function getSafeContinuationReference(value?: string | null) {
  return value && REFERENCE_PATTERN.test(value) ? value : null;
}

