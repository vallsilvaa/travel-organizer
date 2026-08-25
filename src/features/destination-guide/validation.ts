const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type DestinationGuideInput = {
  content: string | null;
  source: string | null;
  reviewedAt: string | null;
};

export type DestinationGuideFieldErrors = Partial<Record<"content" | "source" | "reviewedAt", string>>;

export function validateDestinationGuideInput(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const reviewedAt = String(formData.get("reviewedAt") ?? "").trim();
  const errors: DestinationGuideFieldErrors = {};

  if (content.length > 5000) {
    errors.content = "O conteúdo deve ter no máximo 5000 caracteres.";
  }

  if (source.length > 300) {
    errors.source = "A fonte deve ter no máximo 300 caracteres.";
  }

  if (reviewedAt && (!datePattern.test(reviewedAt) || Number.isNaN(Date.parse(`${reviewedAt}T00:00:00Z`)))) {
    errors.reviewedAt = "Informe uma data de revisão válida.";
  }

  return {
    data: {
      content: content || null,
      source: source || null,
      reviewedAt: reviewedAt || null,
    } satisfies DestinationGuideInput,
    errors,
    success: Object.keys(errors).length === 0,
  };
}
