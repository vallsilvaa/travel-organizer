import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "@/i18n/test-mocks";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslator(namespace),
  useLocale: () => "pt",
}));

const mocks = vi.hoisted(() => ({
  createItineraryItem: vi.fn(),
  updateItineraryItem: vi.fn(),
  deleteItineraryItem: vi.fn(),
  markItineraryItemReviewed: vi.fn(),
}));

vi.mock("@/features/itinerary/actions", () => ({
  createItineraryItem: mocks.createItineraryItem,
  updateItineraryItem: mocks.updateItineraryItem,
  deleteItineraryItem: mocks.deleteItineraryItem,
  markItineraryItemReviewed: mocks.markItineraryItemReviewed,
}));

import { ItineraryItemCard, type ItineraryItem } from "./item-card";

afterEach(cleanup);

const t = createTranslator("trip");

const baseItem: ItineraryItem = {
  id: "11111111-1111-1111-1111-111111111111",
  item_date: "2026-09-20",
  start_time: "09:00",
  end_time: "11:00",
  title: "Visitar Museu do Louvre",
  location: "Rue de Rivoli",
  notes: "Comprar ingresso antecipado.",
  period: null,
  city: "Paris",
  approx_distance: "2 km do hotel",
  needs_review: false,
  updated_at: "2026-09-20T10:00:00Z",
  template_id: null,
};

function renderCard(overrides: Partial<React.ComponentProps<typeof ItineraryItemCard>> = {}) {
  return render(
    <ul>
      <ItineraryItemCard
        item={baseItem}
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
        isArchived={false}
        activitySuggestions={[]}
        whenLabel="20 de setembro de 2026 · 09:00–11:00"
        linkedReservations={[]}
        linkedTasks={[]}
        comments={[]}
        currentUserId="user-1"
        participantNames={new Map()}
        t={t}
        {...overrides}
      />
    </ul>,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Ações do item" }));
}

describe("ItineraryItemCard", () => {
  it("collapsed by default: shows only the title, the date/time line, and the comment field", () => {
    renderCard();

    expect(screen.getByText("Visitar Museu do Louvre")).toBeTruthy();
    expect(screen.getByText("20 de setembro de 2026 · 09:00–11:00")).toBeTruthy();
    expect(screen.getByText("Comentários")).toBeTruthy();

    expect(screen.queryByText(/Rue de Rivoli/)).toBeNull();
    expect(screen.queryByText("Comprar ingresso antecipado.")).toBeNull();
    expect(screen.queryByText(/2 km do hotel/)).toBeNull();
  });

  it("Ver expands the card to show address, city, distance, and notes", () => {
    renderCard();

    openMenu();
    fireEvent.click(screen.getByText("Ver item"));

    expect(screen.getByText("Rue de Rivoli · Paris")).toBeTruthy();
    expect(screen.getByText(/2 km do hotel/)).toBeTruthy();
    expect(screen.getByText("Comprar ingresso antecipado.")).toBeTruthy();
  });

  it("Ver shows linked reservations and prep tasks", () => {
    renderCard({
      linkedReservations: [{ id: "r1", title: "Hotel Lutetia" }],
      linkedTasks: [{ id: "tk1", title: "Levar passaporte", completed_at: null }],
    });

    openMenu();
    fireEvent.click(screen.getByText("Ver item"));

    expect(screen.getByText(/Reserva vinculada: Hotel Lutetia/)).toBeTruthy();
    expect(screen.getByText(/Tarefa vinculada: Levar passaporte/)).toBeTruthy();
  });

  it("renders a darker style and a Revisar badge when needsReview is true", () => {
    const { container } = renderCard({ item: { ...baseItem, needs_review: true } });

    expect(screen.getByText("Revisar")).toBeTruthy();
    expect(container.querySelector("li")?.className).toContain("border-amber-300");
  });

  it("does not show a needs-review style or badge by default", () => {
    const { container } = renderCard();

    expect(screen.queryByText("Revisar")).toBeNull();
    expect(container.querySelector("li")?.className).not.toContain("border-amber-300");
  });

  it("does not offer Marcar como revisado when needs_review is false", () => {
    renderCard();

    openMenu();

    expect(screen.queryByText("Marcar como revisado")).toBeNull();
  });

  it("offers Marcar como revisado when needs_review is true, and it flips needs_review without opening the edit form (R06)", () => {
    renderCard({ item: { ...baseItem, needs_review: true } });

    openMenu();
    fireEvent.click(screen.getByText("Marcar como revisado"));

    expect(mocks.markItineraryItemReviewed).toHaveBeenCalledOnce();
    const submittedFormData = mocks.markItineraryItemReviewed.mock.calls[0][0] as FormData;
    expect(submittedFormData.get("tripId")).toBe("27823996-ec50-4cc2-8506-a29d07b86f94");
    expect(submittedFormData.get("itemId")).toBe(baseItem.id);
    expect(screen.queryByLabelText("Título")).toBeNull();
  });

  it("hides the actions menu (and Ver/Editar/Excluir with it) for archived trips, unchanged", () => {
    renderCard({ isArchived: true });

    expect(screen.queryByRole("button", { name: "Ações do item" })).toBeNull();
  });

  it("Editar opens the edit form, showing the same fields as the details", () => {
    renderCard();

    openMenu();
    fireEvent.click(screen.getByText("Editar item"));

    expect((screen.getByLabelText("Título") as HTMLInputElement).value).toBe("Visitar Museu do Louvre");
  });
});
