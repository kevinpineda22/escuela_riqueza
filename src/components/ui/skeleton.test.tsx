import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

describe("Skeleton primitives", () => {
  it("renders rect skeleton with rounded-xl by default", () => {
    const { container } = render(<Skeleton data-testid="sk" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("rounded-xl");
    expect(el).toHaveAttribute("aria-hidden");
  });

  it("circle variant uses rounded-full + aspect-square", () => {
    const { container } = render(<Skeleton variant="circle" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/rounded-full/);
    expect(el.className).toMatch(/aspect-square/);
  });

  it("text variant has h-4 fixed height", () => {
    const { container } = render(<Skeleton variant="text" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/h-4/);
  });

  it("SkeletonText renders N lines and shrinks the last one", () => {
    const { container } = render(<SkeletonText count={4} />);
    const lines = container.querySelectorAll("[aria-hidden]");
    expect(lines).toHaveLength(4);
    const last = lines[lines.length - 1] as HTMLElement;
    expect(last.className).toMatch(/w-2\/3/);
  });

  it("SkeletonCard composes media + 2 text lines + footer", () => {
    const { container } = render(<SkeletonCard data-testid="card" />);
    const skeletons = container.querySelectorAll("[aria-hidden]");
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it("forwards extra className", () => {
    render(<Skeleton className="my-extra-class" data-testid="sk" />);
    expect(screen.getByTestId("sk")).toHaveClass("my-extra-class");
  });
});
