import ptMessages from "./../messages/pt.json";

// Shared by test files that `vi.mock("next-intl")` / `vi.mock("next-intl/server")`
// so component tests don't need a real NextIntlClientProvider (or a request-scoped
// cookie) - they resolve straight from the real pt.json, so assertions on rendered
// copy stay meaningful instead of matching a hand-duplicated stub string.
type MessageTree = { [key: string]: string | MessageTree };

function resolve(tree: MessageTree, path: string): string {
  const value = path
    .split(".")
    .reduce<MessageTree | string | undefined>(
      (node, key) => (node && typeof node === "object" ? node[key] : undefined),
      tree,
    );

  if (typeof value !== "string") {
    throw new Error(`Missing test translation for "${path}"`);
  }

  return value;
}

export function createTranslator(namespace?: string) {
  return (key: string) => resolve(ptMessages as MessageTree, namespace ? `${namespace}.${key}` : key);
}

export { ptMessages };
