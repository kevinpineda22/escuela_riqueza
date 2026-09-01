import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModuleDetail } from "./ModuleDetail";
import type { Module, Lesson } from "@/lib/api/stream/content";

const mod: Module = {
  id: "m1",
  title: "Módulo 1",
  description: "desc",
  order_index: 0,
  allowed_plans: ["free"],
  is_published: true,
  created_at: "2026-01-01",
};

const makeLesson = (id: string, title: string, order: number): Lesson => ({
  id,
  module_id: "m1",
  title,
  description: null,
  order_index: order,
  stream_uid: null,
  allowed_plans: ["free"],
  is_published: true,
  created_at: "2026-01-01",
});

const lessons = [
  makeLesson("l1", "Primera", 0),
  makeLesson("l2", "Segunda", 1),
  makeLesson("l3", "Tercera", 2),
];

const noop = () => {};

const renderDetail = (props: Partial<React.ComponentProps<typeof ModuleDetail>> = {}) =>
  render(
    <ModuleDetail
      module={mod}
      lessons={lessons}
      onEditModule={noop}
      onTogglePublishModule={noop}
      onDeleteModule={noop}
      onCreateLesson={noop}
      onEditLesson={noop}
      onTogglePublishLesson={noop}
      onDeleteLesson={noop}
      onReorderLessons={noop}
      onCommitLessonOrder={noop}
      orderStatus="idle"
      {...props}
    />
  );

describe("ModuleDetail — reordenar lecciones", () => {
  it("muestra un handle de reordenamiento por lección", () => {
    renderDetail();
    expect(screen.getAllByRole("button", { name: /Reordenar "/ })).toHaveLength(3);
  });

  it("mueve una lección hacia abajo con la flecha del teclado y persiste el orden", async () => {
    const onReorderLessons = vi.fn();
    const onCommitLessonOrder = vi.fn();
    renderDetail({ onReorderLessons, onCommitLessonOrder });

    const handle = screen.getByRole("button", { name: /Reordenar "Primera"/ });
    handle.focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(onReorderLessons).toHaveBeenCalledTimes(1);
    expect(onReorderLessons.mock.calls[0][0].map((l: Lesson) => l.id)).toEqual(["l2", "l1", "l3"]);
    expect(onCommitLessonOrder).toHaveBeenCalledTimes(1);
  });

  it("no mueve más allá de los extremos", async () => {
    const onReorderLessons = vi.fn();
    renderDetail({ onReorderLessons });

    screen.getByRole("button", { name: /Reordenar "Primera"/ }).focus();
    await userEvent.keyboard("{ArrowUp}");

    screen.getByRole("button", { name: /Reordenar "Tercera"/ }).focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(onReorderLessons).not.toHaveBeenCalled();
  });

  it("oculta el handle cuando hay una sola lección", () => {
    renderDetail({ lessons: [lessons[0]] });
    expect(screen.getByRole("button", { name: /Reordenar "/ })).toBeDisabled();
  });

  it("refleja el estado de guardado del orden", () => {
    const { rerender } = renderDetail({ orderStatus: "saving" });
    expect(screen.getByText("Guardando orden…")).toBeInTheDocument();

    rerender(
      <ModuleDetail
        module={mod}
        lessons={lessons}
        onEditModule={noop}
        onTogglePublishModule={noop}
        onDeleteModule={noop}
        onCreateLesson={noop}
        onEditLesson={noop}
        onTogglePublishLesson={noop}
        onDeleteLesson={noop}
        onReorderLessons={noop}
        onCommitLessonOrder={noop}
        orderStatus="saved"
      />
    );
    expect(screen.getByText("Orden guardado")).toBeInTheDocument();
  });
});
