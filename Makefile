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
	@passes=0
	failures=0
	skips=0
	have_git=false
	have_gh=false
	have_node=false
	have_npm=false
	gh_authenticated=false
	version=''
	package_version=''
	lock_version=''
	lock_root_version=''
	min_app_version=''
	versions_min_app=''
	release_notes=''
	head_commit=''
	repository=''
	origin_uses_ssh=false
	pass() {
		passes=$$((passes + 1))
		printf '[OK]   %s\n' "$$1"
	}
	fail() {
		failures=$$((failures + 1))
		printf '[FAIL] %s\n' "$$1" >&2
	}
	skip() {
		skips=$$((skips + 1))
		printf '[SKIP] %s\n' "$$1"
	}

	printf 'Release readiness checks\n\n'

	required_files=(manifest.json styles.css package.json package-lock.json versions.json src/main.ts make_release.sh)
	for required_file in "$${required_files[@]}"; do
		if [[ -s "$$required_file" ]]; then
			pass "Required file $$required_file is present"
		else
			fail "Required file $$required_file is missing or empty"
		fi
	done

	for required_command in git gh node npm; do
		if command -v "$$required_command" >/dev/null 2>&1; then
			pass "Required command $$required_command is available"
			case "$$required_command" in
				git) have_git=true ;;
				gh) have_gh=true ;;
				node) have_node=true ;;
				npm) have_npm=true ;;
			esac
		else
			fail "Required command $$required_command is unavailable"
		fi
	done

	if $$have_node && [[ -s manifest.json ]]; then
		if version="$$(node -p "require('./manifest.json').version" 2>/dev/null)" && [[ -n "$$version" && "$$version" != 'undefined' ]]; then
			pass "Read plugin version $$version from manifest.json"
		else
			version=''
			fail 'Could not read the plugin version from manifest.json'
		fi
		if min_app_version="$$(node -p "require('./manifest.json').minAppVersion" 2>/dev/null)" && [[ -n "$$min_app_version" && "$$min_app_version" != 'undefined' ]]; then
			pass "Read minimum Obsidian version $$min_app_version"
		else
			min_app_version=''
			fail 'Could not read minAppVersion from manifest.json'
		fi
	else
		skip 'Manifest metadata checks require node and manifest.json'
	fi

	if $$have_node && [[ -s package.json ]]; then
		if package_version="$$(node -p "require('./package.json').version" 2>/dev/null)" && [[ -n "$$package_version" && "$$package_version" != 'undefined' ]]; then
			pass "Read package version $$package_version"
		else
			package_version=''
			fail 'Could not read the version from package.json'
		fi
	else
		skip 'package.json metadata check requires node and package.json'
	fi

	if $$have_node && [[ -s package-lock.json ]]; then
		if lock_version="$$(node -p "require('./package-lock.json').version" 2>/dev/null)" && [[ -n "$$lock_version" && "$$lock_version" != 'undefined' ]]; then
			pass "Read lockfile version $$lock_version"
		else
			lock_version=''
			fail 'Could not read the top-level version from package-lock.json'
		fi
		if lock_root_version="$$(node -p "require('./package-lock.json').packages[''].version" 2>/dev/null)" && [[ -n "$$lock_root_version" && "$$lock_root_version" != 'undefined' ]]; then
			pass "Read lockfile root package version $$lock_root_version"
		else
			lock_root_version=''
			fail 'Could not read the root package version from package-lock.json'
		fi
	else
		skip 'Lockfile metadata checks require node and package-lock.json'
	fi

	if [[ -n "$$version" && -n "$$package_version" && -n "$$lock_version" && -n "$$lock_root_version" ]]; then
		if [[ "$$package_version" == "$$version" && "$$lock_version" == "$$version" && "$$lock_root_version" == "$$version" ]]; then
			pass "Manifest, package, and lockfile versions all equal $$version"
		else
			fail "Version mismatch: manifest=$$version package=$$package_version lock=$$lock_version lock-root=$$lock_root_version"
		fi
	else
		skip 'Version alignment check requires all version metadata'
	fi

	if $$have_node && [[ -s versions.json && -n "$$version" ]]; then
		if versions_min_app="$$(node -p "require('./versions.json')['$$version'] || ''" 2>/dev/null)"; then
			if [[ -n "$$min_app_version" && "$$versions_min_app" == "$$min_app_version" ]]; then
				pass "versions.json maps $$version to minAppVersion $$min_app_version"
			else
				fail "versions.json maps $$version to '$$versions_min_app', expected '$$min_app_version'"
			fi
		else
			fail 'Could not read versions.json'
		fi
	else
		skip 'versions.json mapping check requires node, versions.json, and a plugin version'
	fi

	if [[ -n "$$version" ]]; then
		release_notes="release-notes/$$version.md"
		if [[ -s "$$release_notes" ]]; then
			pass "Release description $$release_notes is present"
		else
			fail "Release description $$release_notes is missing or empty"
		fi
	else
		skip 'Release description check requires a plugin version'
	fi

	if $$have_git; then
		if branch="$$(git branch --show-current 2>/dev/null)"; then
			if [[ "$$branch" == 'main' ]]; then
				pass 'Current branch is main'
			else
				fail "Releases must be made from main, not $${branch:-detached HEAD}"
			fi
		else
			fail 'Could not determine the current Git branch'
		fi

		if git_status="$$(git status --porcelain --untracked-files=all 2>/dev/null)"; then
			if [[ -z "$$git_status" ]]; then
				pass 'Git working tree is clean'
			else
				fail 'Git working tree is not clean'
				printf '%s\n' "$$git_status" >&2
			fi
		else
			fail 'Could not inspect the Git working tree'
		fi

		if head_commit="$$(git rev-parse HEAD 2>/dev/null)"; then
			pass "Read HEAD commit $$head_commit"
		else
			head_commit=''
			fail 'Could not resolve HEAD'
		fi

		if [[ -n "$$version" && -n "$$head_commit" ]]; then
			if tag_commit="$$(git rev-list -n 1 "$$version" 2>/dev/null)" && [[ "$$tag_commit" == "$$head_commit" ]]; then
				pass "Local tag $$version points to HEAD"
			else
				fail "Local tag $$version must point to HEAD $$head_commit"
			fi
		else
			skip 'Local tag check requires a plugin version and HEAD commit'
		fi

		if origin_url="$$(git remote get-url origin 2>/dev/null)"; then
			case "$$origin_url" in
				git@github.com:*)
					repository="$${origin_url#git@github.com:}"
					origin_uses_ssh=true
					;;
				ssh://git@github.com/*)
					repository="$${origin_url#ssh://git@github.com/}"
					origin_uses_ssh=true
					;;
				https://github.com/*) repository="$${origin_url#https://github.com/}" ;;
				http://github.com/*) repository="$${origin_url#http://github.com/}" ;;
				*) repository='' ;;
			esac
			repository="$${repository%.git}"
			if [[ "$$repository" =~ ^[^/]+/[^/]+$$ ]]; then
				pass "Origin identifies GitHub repository $$repository"
			else
				repository=''
				fail "Origin is not a supported GitHub repository URL: $$origin_url"
			fi
		else
			fail 'Could not read the origin remote URL'
		fi
	else
		skip 'Git repository checks require git'
	fi

	if $$have_gh; then
		if gh auth status --hostname github.com >/dev/null 2>&1; then
			gh_authenticated=true
			pass 'GitHub CLI is authenticated for github.com'
		else
			fail 'GitHub CLI is not authenticated for github.com'
		fi
	else
		skip 'GitHub authentication check requires gh'
	fi

	remote_refs_output=''
	remote_refs_query_ok=false
	if $$have_git && [[ -n "$$head_commit" ]]; then
		remote_refs=(refs/heads/main)
		if [[ -n "$$version" ]]; then
			remote_refs+=("refs/tags/$$version" "refs/tags/$$version^{}")
		fi
		if $$origin_uses_ssh; then
			if [[ -n "$$version" ]]; then
				printf '\n[AUTH] Git is contacting origin over SSH to verify that origin/main and remote tag %s point to HEAD. Your SSH key passphrase may now be requested.\n' "$$version" >&2
			else
				printf '\n[AUTH] Git is contacting origin over SSH to verify that origin/main points to HEAD. Your SSH key passphrase may now be requested.\n' >&2
			fi
		fi
		if remote_refs_output="$$(git ls-remote origin "$${remote_refs[@]}" 2>/dev/null)"; then
			remote_refs_query_ok=true
			remote_main="$$(awk -v ref='refs/heads/main' '$$2 == ref { print $$1; exit }' <<<"$$remote_refs_output")"
			if [[ "$$remote_main" == "$$head_commit" ]]; then
				pass 'origin/main points to HEAD'
			else
				fail "origin/main does not point to HEAD $$head_commit"
			fi
		else
			fail 'Could not query origin/main'
		fi
	else
		skip 'Remote main check requires git and a HEAD commit'
	fi

	if $$have_git && [[ -n "$$version" && -n "$$head_commit" ]]; then
		if ! $$remote_refs_query_ok; then
			fail "Could not query remote tag $$version"
		else
			remote_tag="$$(awk -v ref="refs/tags/$$version^{}" '$$2 == ref { print $$1; exit }' <<<"$$remote_refs_output")"
			if [[ -z "$$remote_tag" ]]; then
				remote_tag="$$(awk -v ref="refs/tags/$$version" '$$2 == ref { print $$1; exit }' <<<"$$remote_refs_output")"
			fi
			if [[ "$$remote_tag" == "$$head_commit" ]]; then
				pass "Remote tag $$version points to HEAD"
			else
				fail "Remote tag $$version does not point to HEAD $$head_commit"
			fi
		fi
	else
		skip 'Remote tag check requires git, a plugin version, and a HEAD commit'
	fi

	if $$have_gh && $$gh_authenticated && [[ -n "$$repository" && -n "$$version" ]]; then
		if gh release view "$$version" --repo "$$repository" >/dev/null 2>&1; then
			fail "GitHub release $$version already exists in $$repository"
		else
			pass "GitHub release $$version does not exist in $$repository"
		fi
	else
		skip 'Existing release check requires authenticated gh, a repository, and a plugin version'
	fi

	if $$have_npm; then
		printf '\n[RUN]  npm ci\n'
		if $(NPM) ci; then
			pass 'npm ci completed successfully'
		else
			fail 'npm ci failed'
		fi

		printf '\n[RUN]  npm run lint\n'
		if $(NPM) run lint; then
			pass 'Lint completed successfully'
		else
			fail 'Lint failed'
		fi

		printf '\n[RUN]  npm run build\n'
		if $(NPM) run build; then
			pass 'Production build completed successfully'
		else
			fail 'Production build failed'
		fi
	else
		skip 'Dependency installation, lint, and build require npm'
	fi

	for release_file in $(RELEASE_FILES); do
		if [[ -s "$$release_file" ]]; then
			pass "Release artifact $$release_file is present"
		else
			fail "Release artifact $$release_file is missing or empty"
		fi
	done

	printf '\nRelease description\n\n'
	if [[ -n "$$release_notes" && -s "$$release_notes" ]]; then
		cat "$$release_notes"
	else
		skip 'No release description is available to display'
	fi

	printf '\nSummary: %d passed, %d failed, %d skipped.\n' "$$passes" "$$failures" "$$skips"
	if ((failures > 0)); then
		printf '%s\n' 'Release readiness checks failed; no release was published.' >&2
		exit 1
	fi
	printf 'Release checks passed for %s (%s).\n' "$$version" "$$repository"

release: release-check
	@./make_release.sh

clean:
	@rm -f main.js
	rm -rf "$(LOCAL_BUILD_ROOT)"
	printf '%s\n' 'Removed generated build output.'

distclean: clean
	@rm -rf node_modules
	printf '%s\n' 'Removed node_modules.'
