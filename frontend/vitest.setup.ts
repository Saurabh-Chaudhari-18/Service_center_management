import "@testing-library/jest-dom";
import { vi, afterEach, beforeEach } from "vitest";

// ── next/navigation ──────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ── next/image ───────────────────────────────────────────────────────────────

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width?: number; height?: number }) => {
    // Return a plain object that React can render as <img>
    const { createElement } = require("react");
    return createElement("img", { src, alt, width, height });
  },
}));

// ── next/link ────────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ href, children, className, ...props }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    [k: string]: unknown;
  }) => {
    const { createElement } = require("react");
    return createElement("a", { href, className, ...props }, children);
  },
}));

// ── window.matchMedia ────────────────────────────────────────────────────────

function setupMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
setupMatchMedia();

// ── localStorage ─────────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, "localStorage", {
  writable: true,
  configurable: true,
  value: localStorageMock,
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  setupMatchMedia();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Suppress noisy React act() warnings that are expected in async tests
const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const msg = typeof args[0] === "string" ? args[0] : "";
  if (
    msg.includes("Warning: An update to") ||
    msg.includes("act(") ||
    msg.includes("not wrapped in act")
  ) {
    return;
  }
  originalError(...args);
};
