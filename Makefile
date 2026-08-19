SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:
.DEFAULT_GOAL := help

NPM ?= npm
LOCAL_BUILD_ROOT ?= local-build
PLUGIN_ID := $(shell node -p "require('./manifest.json').id" 2>/dev/null || printf '%s' plugin)
LOCAL_BUILD_DIR := $(LOCAL_BUILD_ROOT)/$(PLUGIN_ID)
RELEASE_FILES := main.js manifest.json styles.css

.PHONY: help --help info setup ensure-deps lint build check dev localbuild release-check release clean distclean

help:
	@printf '%s\n' 'Usage: make <target>'
	printf '\n'
	printf '%-18s %s\n' 'help'          'Show this project help'
	printf '%-18s %s\n' 'info'          'Show plugin, version, branch, and tag information'
	printf '%-18s %s\n' 'setup'         'Install the exact locked dependencies with npm ci'
	printf '%-18s %s\n' 'lint'          'Lint TypeScript sources'
	printf '%-18s %s\n' 'build'         'Create the production main.js bundle'
	printf '%-18s %s\n' 'check'         'Run lint and production build checks'
	printf '%-18s %s\n' 'dev'           'Compile continuously in watch mode'
	printf '%-18s %s\n' 'localbuild'    'Create a copy-ready local-build/<plugin-id> directory'
	printf '%-18s %s\n' 'release-check' 'Validate release readiness without publishing'
	printf '%-18s %s\n' 'release'       'Validate and publish with make_release.sh'
	printf '%-18s %s\n' 'clean'         'Remove generated bundles and local-build output'
	printf '%-18s %s\n' 'distclean'     'Run clean and remove node_modules'

--help: help

info:
	@version="$$(node -p "require('./manifest.json').version")"
	branch="$$(git branch --show-current)"
	tags="$$(git tag --points-at HEAD | paste -sd, -)"
	printf 'Plugin:  %s\n' '$(PLUGIN_ID)'
	printf 'Version: %s\n' "$$version"
	printf 'Branch:  %s\n' "$$branch"
	printf 'Tags:    %s\n' "$${tags:-none}"

setup:
	@$(NPM) ci

ensure-deps:
	@if [[ ! -x node_modules/.bin/tsc || ! -x node_modules/.bin/eslint ]]; then
		printf '%s\n' 'Dependencies are missing; running npm ci...'
		$(NPM) ci
	fi

lint: ensure-deps
	@$(NPM) run lint

build: ensure-deps
	@$(NPM) run build

check: lint build

dev: ensure-deps
	@$(NPM) run dev

localbuild: check
	@rm -rf "$(LOCAL_BUILD_DIR)"
	mkdir -p "$(LOCAL_BUILD_DIR)"
	for release_file in $(RELEASE_FILES); do
		if [[ ! -s "$$release_file" ]]; then
			printf 'Error: required build artifact %s is missing or empty.\n' "$$release_file" >&2
			exit 1
		fi
	done
	cp $(RELEASE_FILES) "$(LOCAL_BUILD_DIR)/"
	printf 'Local test build: %s\n' "$(abspath $(LOCAL_BUILD_DIR))"

release-check:
	@required_files=(manifest.json styles.css package.json package-lock.json versions.json src/main.ts make_release.sh)
	for required_file in "$${required_files[@]}"; do
		if [[ ! -s "$$required_file" ]]; then
			printf 'Error: required file %s is missing or empty.\n' "$$required_file" >&2
			exit 1
		fi
	done

	for required_command in git gh node npm; do
		if ! command -v "$$required_command" >/dev/null 2>&1; then
			printf 'Error: required command %s is unavailable.\n' "$$required_command" >&2
			exit 1
		fi
	done

	version="$$(node -p "require('./manifest.json').version")"
	package_version="$$(node -p "require('./package.json').version")"
	lock_version="$$(node -p "require('./package-lock.json').version")"
	lock_root_version="$$(node -p "require('./package-lock.json').packages[''].version")"
	min_app_version="$$(node -p "require('./manifest.json').minAppVersion")"
	versions_min_app="$$(node -p "require('./versions.json')['$$version'] || ''")"
	release_notes="release-notes/$$version.md"

	if [[ "$${package_version}" != "$$version" || "$${lock_version}" != "$$version" || "$${lock_root_version}" != "$$version" ]]; then
		printf 'Error: manifest, package, and lockfile versions must all equal %s.\n' "$$version" >&2
		exit 1
	fi
	if [[ "$${versions_min_app}" != "$$min_app_version" ]]; then
		printf 'Error: versions.json does not map %s to minAppVersion %s.\n' "$$version" "$$min_app_version" >&2
		exit 1
	fi
	if [[ ! -s "$$release_notes" ]]; then
		printf 'Error: release description %s is missing or empty.\n' "$$release_notes" >&2
		exit 1
	fi

	branch="$$(git branch --show-current)"
	if [[ "$$branch" != "main" ]]; then
		printf 'Error: releases must be made from main, not %s.\n' "$${branch:-detached HEAD}" >&2
		exit 1
	fi
	if [[ -n "$$(git status --porcelain --untracked-files=all)" ]]; then
		printf '%s\n' 'Error: the Git working tree must be clean before release.' >&2
		git status --short >&2
		exit 1
	fi

	head_commit="$$(git rev-parse HEAD)"
	tag_commit="$$(git rev-list -n 1 "$$version" 2>/dev/null || true)"
	if [[ "$$tag_commit" != "$$head_commit" ]]; then
		printf 'Error: tag %s must point to HEAD %s.\n' "$$version" "$$head_commit" >&2
		exit 1
	fi

	origin_url="$$(git remote get-url origin 2>/dev/null || true)"
	case "$$origin_url" in
		git@github.com:*) repository="$${origin_url#git@github.com:}" ;;
		ssh://git@github.com/*) repository="$${origin_url#ssh://git@github.com/}" ;;
		https://github.com/*) repository="$${origin_url#https://github.com/}" ;;
		http://github.com/*) repository="$${origin_url#http://github.com/}" ;;
		*) printf 'Error: origin is not a supported GitHub URL: %s\n' "$$origin_url" >&2; exit 1 ;;
	esac
	repository="$${repository%.git}"
	if [[ ! "$$repository" =~ ^[^/]+/[^/]+$$ ]]; then
		printf 'Error: could not determine owner/repository from origin: %s\n' "$$origin_url" >&2
		exit 1
	fi

	gh auth status --hostname github.com >/dev/null
	remote_main="$$(git ls-remote origin refs/heads/main | awk 'NR == 1 { print $$1 }')"
	if [[ "$$remote_main" != "$$head_commit" ]]; then
		printf 'Error: origin/main does not point to HEAD. Push main before release.\n' >&2
		exit 1
	fi
	remote_tag="$$(git ls-remote origin "refs/tags/$$version^{}" | awk 'NR == 1 { print $$1 }')"
	if [[ -z "$$remote_tag" ]]; then
		remote_tag="$$(git ls-remote origin "refs/tags/$$version" | awk 'NR == 1 { print $$1 }')"
	fi
	if [[ "$$remote_tag" != "$$head_commit" ]]; then
		printf 'Error: remote tag %s does not point to HEAD. Push the tag before release.\n' "$$version" >&2
		exit 1
	fi
	if gh release view "$$version" --repo "$$repository" >/dev/null 2>&1; then
		printf 'Error: GitHub release %s already exists in %s.\n' "$$version" "$$repository" >&2
		exit 1
	fi

	$(NPM) ci
	$(NPM) run lint
	$(NPM) run build
	for release_file in $(RELEASE_FILES); do
		if [[ ! -s "$$release_file" ]]; then
			printf 'Error: release artifact %s is missing or empty.\n' "$$release_file" >&2
			exit 1
		fi
	done

	printf '\nRelease checks passed for %s (%s).\n' "$$version" "$$repository"
	printf 'Release description: %s\n\n' "$$release_notes"
	cat "$$release_notes"

release: release-check
	@./make_release.sh

clean:
	@rm -f main.js
	rm -rf "$(LOCAL_BUILD_ROOT)"
	printf '%s\n' 'Removed generated build output.'

distclean: clean
	@rm -rf node_modules
	printf '%s\n' 'Removed node_modules.'
