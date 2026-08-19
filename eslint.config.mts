import json from "@eslint/json";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
	globalIgnores([
		"node_modules",
		"local-build",
		"esbuild.config.mjs",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"package.json",
		"package-lock.json",
		"tsconfig.json",
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.mts", "manifest.json"],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		rules: {
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					brands: ["Lucide"],
				},
			],
		},
	},
	{
		files: ["manifest.json"],
		language: "json/json",
		plugins: {
			json,
			obsidianmd,
		},
		rules: {
			"no-irregular-whitespace": "off",
			"obsidianmd/validate-manifest": "warn",
		},
	}
);
