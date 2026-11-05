/**
 * Small typo/plural tolerant matcher for the food search. Runs only as a fallback when the exact
 * (substring) search finds nothing, so "waffles", "waffle" and "waffele" all reach "Classic Waffle".
 */

export const normalizeText = (value) =>
    String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const squash = (value) => normalizeText(value).replace(/\s+/g, '');

/** waffles -> waffle, berries -> berry, sandwiches -> sandwich. Short words are left alone. */
export const stemWord = (word) => {
    const w = String(word || '');
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
    if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
};

/** Edit distance, giving up early once it must exceed `max`. */
export const editDistance = (a, b, max = 2) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
        const row = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
            if (row[j] < rowMin) rowMin = row[j];
        }
        if (rowMin > max) return max + 1;
        prev = row;
    }
    return prev[b.length];
};

const tolerance = (len) => (len <= 3 ? 0 : len <= 8 ? 1 : 2);

const wordMatches = (queryWord, candidateWord) => {
    const q = stemWord(queryWord);
    const c = stemWord(candidateWord);
    if (!q || !c) return false;
    if (c.includes(q)) return true;
    if (q.length >= 4 && c.length >= 4 && q.includes(c)) return true;
    const tol = tolerance(q.length);
    return tol > 0 && editDistance(q, c, tol) <= tol;
};

/** True when every word of the query matches some word of the candidate (or the squashed text contains it). */
export const fuzzyMatches = (query, candidate) => {
    const queryWords = normalizeText(query).split(' ').filter(Boolean);
    if (queryWords.length === 0) return false;

    const candidateText = normalizeText(candidate);
    if (!candidateText) return false;

    // "vadapav" vs "Vada Pav": ignore the spaces on both sides.
    const squashedQuery = squash(query);
    if (squashedQuery.length >= 3 && squash(candidate).includes(squashedQuery)) return true;

    const candidateWords = candidateText.split(' ');
    return queryWords.every((word) => candidateWords.some((cw) => wordMatches(word, cw)));
};
