import { describe, expect, it, vi } from "vitest";
import {
  createKakaoChannelUrl,
  DEFAULT_KAKAO_CHANNEL_PUBLIC_ID,
  ensureKakaoInitialized,
  openKakaoAddChannel,
  openKakaoChannelChat,
} from "../../lib/kakao-channel-sdk";

describe("kakao channel sdk helpers", () => {
  it("initializes kakao once when not yet initialized", () => {
    const init = vi.fn();
    const kakao = {
      isInitialized: vi.fn(() => false),
      init,
    };

    expect(ensureKakaoInitialized(kakao, " test-key ")).toBe(true);
    expect(kakao.isInitialized).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith("test-key");
  });

  it("does not reinitialize kakao after initialization", () => {
    const init = vi.fn();
    const kakao = {
      isInitialized: vi.fn(() => true),
      init,
    };

    expect(ensureKakaoInitialized(kakao, "test-key")).toBe(true);
    expect(init).not.toHaveBeenCalled();
  });

  it("opens channel chat with the supplied public id", () => {
    const chat = vi.fn();
    const kakao = {
      Channel: {
        chat,
      },
    };

    expect(openKakaoChannelChat(kakao, "_IjiZX")).toBe(true);
    expect(chat).toHaveBeenCalledWith({ channelPublicId: "_IjiZX" });
  });

  it("opens add channel bridge with the supplied public id", () => {
    const addChannel = vi.fn();
    const kakao = {
      Channel: {
        addChannel,
      },
    };

    expect(openKakaoAddChannel(kakao, "_IjiZX")).toBe(true);
    expect(addChannel).toHaveBeenCalledWith({ channelPublicId: "_IjiZX" });
  });

  it("fails safely when sdk members are missing", () => {
    expect(ensureKakaoInitialized(undefined, "test-key")).toBe(false);
    expect(ensureKakaoInitialized({ isInitialized: () => false }, "test-key")).toBe(false);
    expect(openKakaoChannelChat(undefined, "_IjiZX")).toBe(false);
    expect(openKakaoAddChannel({ Channel: {} }, "_IjiZX")).toBe(false);
  });

  it("builds pf.kakao fallback urls from the public id", () => {
    expect(createKakaoChannelUrl(DEFAULT_KAKAO_CHANNEL_PUBLIC_ID)).toBe("https://pf.kakao.com/_IjiZX");
  });
});
