import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LiveReplay } from "./LiveReplay";
import { fetchSignedPublicRecordingUrl, fetchSignedRecordingUrl, type LiveEvent } from "@/lib/api/stream/lives";

vi.mock("@/lib/api/stream/lives", () => ({
  fetchSignedPublicRecordingUrl: vi.fn(),
  fetchSignedRecordingUrl: vi.fn(),
}));

const live = { id: "live-1", title: "Clase" } as LiveEvent;

describe("LiveReplay (R2)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks for the signed URL with the session when signed in", async () => {
    vi.mocked(fetchSignedRecordingUrl).mockResolvedValue({ url: "https://r2.test/a.mp4", expiresIn: 900 });
    const { container } = render(<LiveReplay live={live} token="tok-123456789" source="r2" signedIn />);
    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "https://r2.test/a.mp4"));
    expect(fetchSignedRecordingUrl).toHaveBeenCalledWith("live-1");
    expect(fetchSignedPublicRecordingUrl).not.toHaveBeenCalled();
  });

  it("asks for the anonymous URL by share token without a session", async () => {
    vi.mocked(fetchSignedPublicRecordingUrl).mockResolvedValue({ url: "https://r2.test/b.mp4", expiresIn: 900 });
    const { container } = render(<LiveReplay live={live} token="tok-123456789" source="r2" signedIn={false} />);
    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "https://r2.test/b.mp4"));
    expect(fetchSignedPublicRecordingUrl).toHaveBeenCalledWith("tok-123456789");
    expect(fetchSignedRecordingUrl).not.toHaveBeenCalled();
  });

  it("shows an error message when the URL cannot be obtained", async () => {
    vi.mocked(fetchSignedPublicRecordingUrl).mockResolvedValue(null);
    render(<LiveReplay live={live} token="tok-123456789" source="r2" signedIn={false} />);
    expect(await screen.findByText("No pudimos cargar la grabación")).toBeInTheDocument();
  });
});
