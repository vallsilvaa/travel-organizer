import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-intl", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    useTranslations: (namespace?: string) => createTranslator(namespace),
    useLocale: () => "pt",
  };
});
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("@/i18n/test-mocks");
  return {
    getTranslations: async (namespace?: string) => createTranslator(namespace),
  };
});

import ProfilePage from "./page";

type QueryResult = { data: unknown; error?: unknown };

function queryBuilder(result: QueryResult) {
  const promise = Promise.resolve(result) as Promise<QueryResult> & {
    eq: () => typeof promise;
    limit: () => typeof promise;
    order: () => typeof promise;
    select: () => typeof promise;
    single: () => Promise<QueryResult>;
  };
  promise.select = () => promise;
  promise.eq = () => promise;
  promise.order = () => promise;
  promise.limit = () => promise;
  promise.single = () => Promise.resolve(result);
  return promise;
}

const profile = {
  first_name: "Valeria",
  last_name: "Silva",
  birth_date: "1990-05-20",
  task_reminders_enabled: true,
  collaboration_emails_enabled: true,
  is_organizer: false,
};

afterEach(cleanup);

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "traveler@example.com" } },
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return queryBuilder({ data: profile });
      }
      return queryBuilder({ data: [], error: null });
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });
  });

  it("redirects an unauthenticated visitor to sign in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(ProfilePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_REDIRECT:/auth/sign-in?error=authentication_required",
    );
  });

  it("pre-fills the personal data form from the profile row", async () => {
    render(await ProfilePage({ searchParams: Promise.resolve({}) }));

    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Valeria");
    expect((screen.getByLabelText("Sobrenome") as HTMLInputElement).value).toBe("Silva");
    expect((screen.getByLabelText("Data de nascimento") as HTMLInputElement).value).toBe("1990-05-20");
  });

  it("shows the email as read-only text, not an editable field", async () => {
    const { container } = render(await ProfilePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("traveler@example.com")).toBeTruthy();
    expect(container.querySelector('input[name="email"]')).toBeNull();
  });

  it("renders every profile form action as a submit control", async () => {
    render(await ProfilePage({ searchParams: Promise.resolve({}) }));

    const submitButtonNames = [/sair/i, /salvar dados/i, /atualizar senha/i];
    for (const name of submitButtonNames) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("type")).toBe("submit");
    }

    // Two independent preference forms (task reminders, collaboration
    // emails) share the same "Salvar preferência" label.
    const preferenceButtons = screen.getAllByRole("button", { name: /salvar preferência/i });
    expect(preferenceButtons).toHaveLength(2);
    for (const button of preferenceButtons) {
      expect(button.getAttribute("type")).toBe("submit");
    }
  });

  it("groups notification preferences into email and push sections", async () => {
    render(await ProfilePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Central de notificações")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "E-mail" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Push" })).toBeTruthy();
  });

  it("shows a profile error banner when redirected back with one", async () => {
    render(
      await ProfilePage({ searchParams: Promise.resolve({ profileError: "invalid_first_name" }) }),
    );

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
