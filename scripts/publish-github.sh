#!/bin/sh
# Explicitly run by the account owner. Never paste a GitHub token into chat.
set -eu
cd "$(dirname "$0")/.."
name="${1:-cube-lab}"
visibility="${2:-private}"
case "$name" in ''|*[!a-zA-Z0-9._-]*) echo 'Use a simple repository name, without an owner prefix.' >&2; exit 2;; esac
case "$visibility" in public|private) ;; *) echo 'Visibility must be public or private.' >&2; exit 2;; esac
command -v git >/dev/null 2>&1 || { echo 'Install Git first.' >&2; exit 1; }
command -v gh >/dev/null 2>&1 || { echo 'Install the official GitHub CLI first.' >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo 'Authenticate first: gh auth login' >&2; exit 1; }
if [ ! -d .git ]; then
 if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo 'This folder is inside another Git repository. Move it outside before publishing.' >&2; exit 1
 fi
 git init -b main
fi
if git remote get-url origin >/dev/null 2>&1; then
 echo 'An origin remote already exists. Refusing to replace it. Push manually after reviewing it.' >&2; exit 1
fi
git config user.name >/dev/null 2>&1 || { echo 'Configure your Git user.name before committing.' >&2; exit 1; }
git config user.email >/dev/null 2>&1 || { echo 'Configure your Git user.email before committing.' >&2; exit 1; }
printf 'Create %s repository "%s" in the currently authenticated GitHub account? [y/N] ' "$visibility" "$name"
read -r answer
case "$answer" in y|Y|yes|YES) ;; *) echo 'Cancelled.'; exit 0;; esac
git add .
if ! git diff --cached --quiet; then git commit -m 'Build Cube Lab: 3D, synchronized views, and formula tutor'; fi
gh repo create "$name" "--$visibility" --source=. --remote=origin --push
gh repo view --json url --jq '.url'
printf '\nRepository created. For Pages, enable Settings > Pages > GitHub Actions, then rerun the workflow.\n'
