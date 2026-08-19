import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommentForm } from "./comment-form";

afterEach(cleanup);

describe("CommentForm", () => {
  it("renders the submit button as a submit control", () => {
    render(
      <CommentForm
        itemId="8f3f147b-8684-4ff1-b5c7-6814e4f57f73"
        itemType="itinerary"
        tripId="27823996-ec50-4cc2-8506-a29d07b86f94"
      />,
    );

    const button = screen.getByRole("button", { name: /comentar/i });
    expect(button.getAttribute("type")).toBe("submit");
  });
});
