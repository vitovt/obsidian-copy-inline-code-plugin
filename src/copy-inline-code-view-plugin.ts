import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { CopyWidget } from "./copy-code-widget";
import type { IconPosition } from "./icon-position";
import { RegexFilters, shouldExclude } from "./regex-exclude";

class CopyInlineCodeViewPlugin implements PluginValue {
	decorations: DecorationSet;
	showOnHover: boolean;
	filters: RegexFilters;
	iconName: string;
	useLegacyIcon: boolean;
	iconPosition: IconPosition;
	constructor(
		view: EditorView,
		showOnHover: boolean,
		filters: RegexFilters,
		iconName: string,
		useLegacyIcon: boolean,
		iconPosition: IconPosition
	) {
		this.showOnHover = showOnHover;
		this.filters = filters;
		this.iconName = iconName;
		this.useLegacyIcon = useLegacyIcon;
		this.iconPosition = iconPosition;

		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	destroy() {}

	buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();
		const showOnHover = this.showOnHover;
		const filters = this.filters;
		const iconName = this.iconName;
		const useLegacyIcon = this.useLegacyIcon;
		const iconPosition = this.iconPosition;

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					if (node.type.name.startsWith("inline-code")) {
						const codeText = view.state.doc.sliceString(
							node.from,
							node.to
						);
						if (shouldExclude(codeText, filters)) {
							return;
						}
						const widgetPosition =
							iconPosition === "left"
								? Math.max(0, node.from - 1)
								: node.to + 1;
						builder.add(
							widgetPosition,
							widgetPosition,
							Decoration.widget({
								widget: new CopyWidget(
									showOnHover,
									iconName,
									useLegacyIcon,
									iconPosition,
									codeText
								),
							})
						);
					}
				},
			});
		}

		return builder.finish();
	}
}

export const createCopyPlugin = (
	showOnHover: boolean,
	filters: RegexFilters,
	iconName: string,
	useLegacyIcon: boolean,
	iconPosition: IconPosition
) => {
	return ViewPlugin.define(
		(view: EditorView) =>
			new CopyInlineCodeViewPlugin(
				view,
				showOnHover,
				filters,
				iconName,
				useLegacyIcon,
				iconPosition
			),
		{
			decorations: (p) => p.decorations,
		}
	);
};
