import "@testing-library/jest-dom/vitest";

// jsdom não implementa matchMedia; o Kanban consulta prefers-reduced-motion.
window.matchMedia ??= (query: string) =>
  ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList;
