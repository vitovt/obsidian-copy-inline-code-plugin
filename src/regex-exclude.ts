export type RegexFilters = [string, string][];

export function isRegexFilters(value: unknown): value is RegexFilters {
	return (
		Array.isArray(value) &&
		value.every(
			(filter) =>
				Array.isArray(filter) &&
				typeof filter[0] === "string" &&
				typeof filter[1] === "string"
		)
	);
}

export function shouldExclude(
	text: string,
	regexFilters: RegexFilters
): boolean {
	return regexFilters.some(([pattern, flags]) => {
		try {
			const regex = new RegExp(pattern, flags);
			return regex.test(text);
		} catch {
			return false;
		}
	});
}
