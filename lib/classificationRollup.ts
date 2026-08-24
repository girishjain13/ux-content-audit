import type { PageClassification } from "./pageClassifier.js";

/**
 * Prefer deeper, more specific URLs as screenshot examples so many
 * templates/components don't all resolve to the homepage (which made
 * every Excel row show the same full-page shot).
 */
function pickDistinctiveUrls(urls: Iterable<string>): string[] {
  const list = [...urls];
  list.sort((a, b) => {
    const depth = (u: string) => {
      try {
        return new URL(u).pathname.split("/").filter(Boolean).length;
      } catch {
        return 0;
      }
    };
    const da = depth(a);
    const db = depth(b);
    if (db !== da) return db - da; // deeper first
    return a.localeCompare(b);
  });
  return list;
}

export type TemplateGroup = {
  name: string;
  layoutGrid: string;
  avgConfidence: number;
  pageCount: number;
  exampleUrl: string;
  sampleUrls: string[];
};

export type TemplateRollup = {
  uniqueTemplateCount: number;
  templatesWithReuse: number;
  oneOffCount: number;
  pagesAnalyzed: number;
  templates: TemplateGroup[];
};

export type ComponentGroup = {
  standardName: string;
  type: string;
  domSelector: string;
  detectedElements: string[];
  totalInstances: number;
  pageCount: number;
  pageCoveragePct: number;
  reusabilityScore: "High" | "Medium" | "Low";
  exampleUrl: string;
  sampleUrls: string[];
};

export type ComponentRollup = {
  uniqueComponentCount: number;
  pagesAnalyzed: number;
  components: ComponentGroup[];
};

/**
 * Groups pages by (template name + layout grid) — semantic-label
 * grouping now, not byte-identical structural hashing like the old
 * lib/templates.ts. Two pages both classified "Article Detail,
 * 1-column" count as the same template even if their exact markup
 * differs in minor ways, which is the intended, more human-meaningful
 * behavior this replacement was built for.
 */
export function rollUpTemplates(classifications: PageClassification[]): TemplateRollup {
  const groups = new Map<string, { urls: string[]; confidenceSum: number; layoutGrid: string; name: string }>();

  for (const c of classifications) {
    const key = `${c.template.name}::${c.template.layoutGrid}`;
    if (!groups.has(key)) groups.set(key, { urls: [], confidenceSum: 0, layoutGrid: c.template.layoutGrid, name: c.template.name });
    const g = groups.get(key)!;
    g.urls.push(c.url);
    g.confidenceSum += c.template.confidenceScore;
  }

  const templates: TemplateGroup[] = [...groups.values()]
    .map((g) => {
      // Prefer a non-homepage example so screenshots are distinctive per template
      const sorted = pickDistinctiveUrls(g.urls);
      return {
        name: g.name,
        layoutGrid: g.layoutGrid,
        avgConfidence: Math.round((g.confidenceSum / g.urls.length) * 100) / 100,
        pageCount: g.urls.length,
        exampleUrl: sorted[0],
        sampleUrls: sorted.slice(0, 10),
      };
    })
    .sort((a, b) => b.pageCount - a.pageCount);

  return {
    uniqueTemplateCount: templates.length,
    templatesWithReuse: templates.filter((t) => t.pageCount >= 2).length,
    oneOffCount: templates.filter((t) => t.pageCount === 1).length,
    pagesAnalyzed: classifications.length,
    templates: templates.slice(0, 40),
  };
}

/**
 * Groups by standardName across the whole site. reusabilityScore
 * reflects cross-page reuse (how many DISTINCT pages use this
 * component), not how many times it repeats within a single page —
 * a component appearing 20 times on one page but nowhere else is
 * still "Low" reusability in the sense that matters for a design
 * system (it's not actually shared across the site).
 */
export function rollUpComponents(classifications: PageClassification[]): ComponentRollup {
  const groups = new Map<
    string,
    { urls: Set<string>; totalInstances: number; type: string; domSelector: string; detectedElements: Set<string> }
  >();

  for (const c of classifications) {
    for (const comp of c.components) {
      if (!groups.has(comp.standardName)) {
        groups.set(comp.standardName, { urls: new Set(), totalInstances: 0, type: comp.type, domSelector: comp.domSelector, detectedElements: new Set() });
      }
      const g = groups.get(comp.standardName)!;
      g.urls.add(c.url);
      g.totalInstances += comp.instanceCount;
      for (const el of comp.detectedElements) g.detectedElements.add(el);
    }
  }

  const totalPages = classifications.length || 1;
  const components: ComponentGroup[] = [...groups.entries()]
    .map(([standardName, g]) => {
      const sorted = pickDistinctiveUrls(g.urls);
      const pageCount = g.urls.size;
      const reusabilityScore: ComponentGroup["reusabilityScore"] = pageCount >= 5 ? "High" : pageCount >= 2 ? "Medium" : "Low";
      return {
        standardName,
        type: g.type,
        domSelector: g.domSelector,
        detectedElements: [...g.detectedElements],
        totalInstances: g.totalInstances,
        pageCount,
        pageCoveragePct: Math.round((pageCount / totalPages) * 1000) / 10,
        reusabilityScore,
        exampleUrl: sorted[0],
        sampleUrls: sorted.slice(0, 10),
      };
    })
    .filter((c) => c.pageCount >= 2) // matches the old behavior: single-page-only isn't "reusable"
    .sort((a, b) => b.pageCount - a.pageCount);

  return {
    uniqueComponentCount: components.length,
    pagesAnalyzed: classifications.length,
    components: components.slice(0, 60),
  };
}
