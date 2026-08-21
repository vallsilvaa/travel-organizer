import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConfirmationCode } from "./confirmation-code";

afterEach(cleanup);

describe("ConfirmationCode", () => {
  it("masks the code by default and reveals it on request", () => {
    render(<ConfirmationCode code="ABCDEFGH" />);

    expect(screen.getByText("••••EFGH")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /mostrar/i }));

    expect(screen.getByText("ABCDEFGH")).toBeTruthy();
  });
});
