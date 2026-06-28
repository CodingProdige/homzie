const testSubjectPrefixPattern = /^\s*(?:\[(?:test|testing)\]\s*)+/i;

export function cleanBroadcastSubject(value: string) {
  return value.replace(testSubjectPrefixPattern, "").trim();
}

export function liveBroadcastSubject(value: string) {
  return cleanBroadcastSubject(value) || "Homzie update";
}

export function testBroadcastSubject(value: string) {
  return `[Test] ${liveBroadcastSubject(value)}`;
}
