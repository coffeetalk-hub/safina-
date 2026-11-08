import { afterEach, describe, expect, it, vi } from "vitest";
import { emailSender } from "@/core/notifications";

const message = { to: "a@example.com", subject: "Hello", html: "<p>Hi</p>" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("email provider selection", () => {
  it("is null when nothing is configured, so production keeps mail queued", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_HOST", "");
    expect(await emailSender()).toBeNull();
  });

  it("sends through Resend over HTTPS when a key is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Safina <no-reply@example.com>");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await (await emailSender())!(message);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toEqual({ from: "Safina <no-reply@example.com>", to: ["a@example.com"], subject: "Hello", html: "<p>Hi</p>" });
  });

  it("reports a provider error so the message is retried", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("domain not verified", { status: 403 })));
    await expect((await emailSender())!(message)).rejects.toThrow(/403/);
  });
});
