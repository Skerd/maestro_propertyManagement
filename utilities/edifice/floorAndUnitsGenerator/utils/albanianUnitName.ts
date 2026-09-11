/**
 * After "APARTAMENTI <id>", vector PDFs (txtwrite) may inject huge spans before "KATI <floor>".
 */
const APARTAMENTI_KATI_SEARCH_WINDOW = 250_000;

/**
 * Formats Albanian-style unit token + floor (e.g. A02 + 4 → "A-02 Floor 4").
 */
export function formatAlbanianUnitDisplayName(unitToken: string, floorDigits: string): string {
    const u = unitToken.replace(/[,;.:_]+$/g, '').trim();
    if (/^A\d+$/i.test(u)) {
        return `A-${u.slice(1)} Floor ${floorDigits}`;
    }
    if (/^A-\d+$/i.test(u)) {
        return `${u} Floor ${floorDigits}`;
    }
    return `${u} Floor ${floorDigits}`;
}

/**
 * Pairs "APARTAMENTI <id>" with "KATI <floor>" on the page, in either order.
 * SPLIT brochures print `NJËSI BANIMI KATI 3 APARTAMENTI A06_`; others print
 * `APARTAMENTI A-13 KATI 2`.
 */
export function extractAlbanianApartmentNameFromText(text: string): string | null {
    if (!text?.trim()) {
        return null;
    }

    const unitId = '([A-Z]?[-]?\\d+)';
    const floorId = '(-?\\d+)';
    const collapsed = text.replace(/\s+/g, ' ');
    const tightPatterns: Array<{pattern: RegExp; unit: number; floor: number}> = [
        {pattern: new RegExp(`(?:NJ[ËE]SI\\s+BANIMI[_\\s]+)?APARTAMENTI\\s+${unitId}[_\\s]+KATI\\s+${floorId}`, 'i'), unit: 1, floor: 2},
        {pattern: new RegExp(`APARTAMENTI\\s+${unitId}[_\\s]+KATI\\s+${floorId}`, 'i'), unit: 1, floor: 2},
        {pattern: new RegExp(`(?:NJ[ËE]SI\\s+BANIMI[_\\s]+)?KATI\\s+${floorId}[_\\s]+APARTAMENTI\\s+${unitId}`, 'i'), unit: 2, floor: 1},
        {pattern: new RegExp(`KATI\\s+${floorId}[_\\s]+APARTAMENTI\\s+${unitId}`, 'i'), unit: 2, floor: 1},
    ];
    for (const {pattern, unit, floor} of tightPatterns) {
        const match = collapsed.match(pattern);
        if (match?.[unit] != null && match?.[floor] != null) {
            return formatAlbanianUnitDisplayName(match[unit], match[floor]);
        }
    }

    const apartRe = /APARTAMENTI\s+([^\s\r\n]+)/gi;
    let apartMatch: RegExpExecArray | null;
    while ((apartMatch = apartRe.exec(text)) !== null) {
        const unitTok = apartMatch[1];
        const afterLabel = apartMatch.index + apartMatch[0].length;
        const windowText = text.slice(afterLabel, afterLabel + APARTAMENTI_KATI_SEARCH_WINDOW);
        const katiAfter = windowText.match(/KATI\s+(-?\d+)/i);
        if (katiAfter?.[1] != null) {
            return formatAlbanianUnitDisplayName(unitTok, katiAfter[1]);
        }
        const beforeText = text.slice(Math.max(0, apartMatch.index - 400), apartMatch.index);
        const katiBefore = [...beforeText.matchAll(/KATI\s+(-?\d+)/gi)].pop();
        if (katiBefore?.[1] != null) {
            return formatAlbanianUnitDisplayName(unitTok, katiBefore[1]);
        }
    }

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    for (let i = 0; i < lines.length; i += 1) {
        const lineUnit = lines[i].match(/^APARTAMENTI\s+([^\s]+)\s*$/i);
        if (!lineUnit?.[1]) {
            continue;
        }
        for (let j = i + 1; j < Math.min(i + 12, lines.length); j += 1) {
            const kRow = lines[j].match(/KATI\s+(-?\d+)/i);
            if (kRow?.[1] != null) {
                return formatAlbanianUnitDisplayName(lineUnit[1], kRow[1]);
            }
        }
    }

    return null;
}
