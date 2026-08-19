export type IconPosition = "left" | "right";

export function isIconPosition(value: unknown): value is IconPosition {
	return value === "left" || value === "right";
}
