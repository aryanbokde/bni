import { checkRateLimit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  test("23. under limit → returns true (not rate limited)", () => {
    const key = "test-under-limit-" + Date.now();
    expect(checkRateLimit(key, 3, 60000)).toBe(true);
    expect(checkRateLimit(key, 3, 60000)).toBe(true);
    expect(checkRateLimit(key, 3, 60000)).toBe(true);
  });

  test("24. over limit → returns false (rate limited)", () => {
    const key = "test-over-limit-" + Date.now();
    checkRateLimit(key, 2, 60000);
    checkRateLimit(key, 2, 60000);
    expect(checkRateLimit(key, 2, 60000)).toBe(false);
  });

  test("25. after window expires → counter resets", () => {
    const key = "test-window-expire-" + Date.now();

    // Fill up the limit with a 1ms window
    checkRateLimit(key, 1, 1);
    expect(checkRateLimit(key, 1, 1)).toBe(false);

    // Wait for window to expire
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy-wait 5ms
    }

    // Should be allowed again
    expect(checkRateLimit(key, 1, 1)).toBe(true);
  });
});
