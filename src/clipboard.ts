import { Notice } from "obsidian";

export function copyTextToClipboard(text: string): void {
	void navigator.clipboard.writeText(text).then(
		() => new Notice(`Copied '${text}' to clipboard!`),
		() => new Notice("Could not copy text to the clipboard.")
	);
}
