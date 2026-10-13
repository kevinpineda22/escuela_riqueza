import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as CommunityApi from "@/lib/api/community";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewPostDialog } from "./NewPostDialog";

const createPost = vi.fn();
vi.mock("@/lib/api/community", async (importOriginal) => ({
  ...(await importOriginal<typeof CommunityApi>()),
  createPost: (...args: unknown[]) => createPost(...args),
}));

// El uploader real sube a Supabase; acá solo importa que avise "subiendo".
let reportUploading: ((v: boolean) => void) | undefined;
vi.mock("./PostImageUploader", () => ({
  PostImageUploader: ({ onUploadingChange }: { onUploadingChange?: (v: boolean) => void }) => {
    reportUploading = onUploadingChange;
    return null;
  },
}));

function renderDialog() {
  const onCreated = vi.fn();
  const onOpenChange = vi.fn();
  render(<NewPostDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);
  return { onCreated, onOpenChange };
}

describe("NewPostDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportUploading = undefined;
  });

  it("valida en línea, junto al campo, y enfoca el primero con error", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    const title = screen.getByLabelText("Título");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("El título debe tener entre 3 y 200 caracteres.")).toBeInTheDocument();
    expect(document.activeElement).toBe(title);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("no publica mientras la imagen se sube", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Una pregunta" } });
    fireEvent.change(screen.getByLabelText("Contenido"), { target: { value: "Texto" } });
    reportUploading?.(true);
    const submit = await screen.findByRole("button", { name: "Subiendo imagen…" });
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("si publicar falla, el texto se conserva y se avisa en el diálogo", async () => {
    createPost.mockRejectedValueOnce(new Error("rls"));
    renderDialog();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Una pregunta" } });
    fireEvent.change(screen.getByLabelText("Contenido"), { target: { value: "Texto" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se pudo publicar"));
    expect(screen.getByLabelText("Título")).toHaveValue("Una pregunta");
  });

  it("la categoría se anuncia como opción seleccionada", () => {
    renderDialog();
    expect(screen.getByRole("radio", { name: /Pregunta/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Recurso/ }));
    expect(screen.getByRole("radio", { name: /Recurso/ })).toHaveAttribute("aria-checked", "true");
  });
});
