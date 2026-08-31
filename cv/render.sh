#!/usr/bin/env bash
# Render cv/cv.html to the CV that the site serves.
#
# The PDF is a build artifact of cv.html — edit the HTML, run this, commit both.
# Chrome is the renderer because Chrome's print engine is what produced the
# original file (Producer: Skia/PDF), so the page breaks and metrics match.
#
# After rendering, bump the ?v= on the two download links in
# worker/public/index.html, or browsers keep serving the cached PDF.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/cv.html"
out="$here/../worker/public/Steven_Johnston_CV.pdf"
tmp="$(mktemp -d)/Steven_Johnston_CV.pdf"

chrome=""
for candidate in \
    "/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
    "${LOCALAPPDATA:-}/Google/Chrome/Application/chrome.exe" \
    "$(command -v google-chrome || true)" \
    "$(command -v chromium || true)"
do
    [ -n "$candidate" ] && [ -x "$candidate" ] && { chrome="$candidate"; break; }
done

if [ -z "$chrome" ]; then
    echo "error: no Chrome found. Install Chrome or set the path in this script." >&2
    exit 1
fi

# Chrome needs a Windows-style path for both the file:// URL and the output.
win_src="$(cygpath -w "$src" 2>/dev/null || echo "$src")"
win_out="$(cygpath -w "$tmp" 2>/dev/null || echo "$tmp")"
profile="$(mktemp -d)"

"$chrome" \
    --headless \
    --disable-gpu \
    --no-sandbox \
    --user-data-dir="$(cygpath -w "$profile" 2>/dev/null || echo "$profile")" \
    --no-pdf-header-footer \
    --print-to-pdf="$win_out" \
    --virtual-time-budget=10000 \
    "file:///${win_src//\\//}" 2>&1 | grep -vi "^\[" || true

rm -rf "$profile"

[ -s "$tmp" ] || { echo "error: no PDF was produced" >&2; exit 1; }

# The layout has only a few mm of slack on page 1: if the Technical Lead role
# no longer fits it moves wholesale to page 2 and the CV silently becomes three
# pages. Fail loudly instead of shipping that.
pages="$(python -c "
import re, sys
d = open(sys.argv[1], 'rb').read()
print(len(re.findall(rb'/Type\s*/Page[^s]', d)))
" "$tmp")"

if [ "$pages" != "2" ]; then
    echo "error: expected a 2-page CV, got $pages. Page 1 is nearly full —" >&2
    echo "       trim a line, or retune the spacing noted in cv.html." >&2
    echo "       The served PDF was left untouched." >&2
    rm -rf "$(dirname "$tmp")"
    exit 1
fi

# Only now replace the file the site serves, so a bad render can never ship.
mv -f "$tmp" "$out"
rm -rf "$(dirname "$tmp")"

echo "rendered -> $out ($(wc -c < "$out") bytes, $pages pages)"
