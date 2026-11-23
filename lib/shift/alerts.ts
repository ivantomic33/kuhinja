/** Short timer-end feedback: sound, vibration, optional notification. */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Play a short two-tone beep without external assets. */
export async function playTimerEndSound(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1174.7, now + 0.12);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch {
    // Audio may be blocked; ignore.
  }
}

export function vibrateTimerEnd(): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 80, 200]);
    }
  } catch {
    // Unsupported or blocked.
  }
}

export async function notifyTimerEnd(
  title: string,
  body: string
): Promise<void> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body,
        silent: true,
        tag: "shift-timer-end",
      });
      window.setTimeout(() => notification.close(), 6000);
    }
  } catch {
    // Notification API may throw in insecure contexts.
  }
}

export async function signalTimerEnd(
  title: string,
  body: string
): Promise<void> {
  await Promise.all([
    playTimerEndSound(),
    Promise.resolve(vibrateTimerEnd()),
    notifyTimerEnd(title, body),
  ]);
}
