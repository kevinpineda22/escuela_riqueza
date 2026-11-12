import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DownloadRecordingButton from "./DownloadRecordingButton";
import { requestRecordingDownloadUrl } from "@/lib/api/stream/lives";
import { toast } from "@/components/ui/toaster";

vi.mock("@/lib/api/stream/lives", () => ({ requestRecordingDownloadUrl: vi.fn() }));
vi.mock("@/components/ui/toaster", () => ({ toast: { error: vi.fn() } }));

const request = vi.mocked(requestRecordingDownloadUrl);

describe("DownloadRecordingButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the button and the WiFi hint", () => {
    render(<DownloadRecordingButton liveId="l1" />);
    expect(screen.getByRole("button", { name: /Descargar clase/ })).toBeInTheDocument();
    expect(screen.getByText(/descargarlo con WiFi/)).toBeInTheDocument();
  });

  it("requests the URL and clicks a temporary link to it", async () => {
    request.mockResolvedValue("https://r2.example/file.mp4?sig=1");
    const hrefs: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      hrefs.push(this.href);
    });
    render(<DownloadRecordingButton liveId="l1" />);
    await userEvent.click(screen.getByRole("button", { name: /Descargar clase/ }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith("l1");
    expect(hrefs[0]).toBe("https://r2.example/file.mp4?sig=1");
    click.mockRestore();
  });

  it("shows an error toast when no URL is returned", async () => {
    request.mockResolvedValue(null);
    render(<DownloadRecordingButton liveId="l1" />);
    await userEvent.click(screen.getByRole("button", { name: /Descargar clase/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
