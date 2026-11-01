import type { Server as SocketIOServer, Socket } from "socket.io";
import {
  finalizeSpin,
  getGiveaway,
  serializeGiveaway,
  startSpin,
  updateGiveaway,
  verifyGiveawaySocketToken,
  type GiveawayPublicState,
} from "@/lib/giveaway";
import { RESULT_REVEAL_DELAY } from "@/lib/giveaway-wheel-math";

const ROOM = "giveaway:swiftdu-week-1";
const adminActions: Record<string, string> = {
  "giveaway:admin-start": "start",
  "giveaway:admin-finish": "finish",
  "giveaway:admin-set-mode": "set-mode",
  "giveaway:admin-set-prize": "set-prize",
  "giveaway:admin-remove-contestant": "remove",
  "giveaway:admin-restore-contestant": "restore",
  "giveaway:admin-reset": "reset",
  "giveaway:admin-update-contestants": "update-contestants",
};

let cachedState: GiveawayPublicState | null = null;
let cachePromise: Promise<GiveawayPublicState> | null = null;
let scheduledSpinId: string | null = null;

export function installGiveawaySocket(io: SocketIOServer) {
  io.of("/giveaway").use((socket, next) => {
    const token = verifyGiveawaySocketToken(socket.handshake.auth?.token);
    socket.data.isAdmin = Boolean(token?.isAdmin);
    socket.data.userId = token?.userId;
    next();
  });
  const namespace = io.of("/giveaway");

  const publishState = (state: GiveawayPublicState) => {
    cachedState = state;
    namespace.to(ROOM).emit("giveaway:state", state);
  };

  const scheduleSpinCompletion = (
    spin: NonNullable<GiveawayPublicState["spin"]>,
  ) => {
    if (scheduledSpinId === spin.id) return;
    scheduledSpinId = spin.id;
    const remaining = Math.max(
      0,
      spin.startedAt + spin.duration + RESULT_REVEAL_DELAY - Date.now(),
    );
    setTimeout(async () => {
      try {
        const current = await getGiveaway();
        if (current.spin?.id !== spin.id) return;
        publishState(await finalizeSpin(current));
      } catch (error) {
        console.error("Unable to finalize giveaway spin.", error);
      } finally {
        if (scheduledSpinId === spin.id) scheduledSpinId = null;
      }
    }, remaining);
  };

  const loadDurableState = async () => {
    const giveaway = await getGiveaway();
    const state =
      giveaway.spin &&
      Date.now() >=
        giveaway.spin.startedAt + giveaway.spin.duration + RESULT_REVEAL_DELAY
        ? await finalizeSpin(giveaway)
        : serializeGiveaway(giveaway);
    cachedState = state;
    if (state.spin) scheduleSpinCompletion(state.spin);
    return state;
  };

  const getCachedState = () => {
    if (cachedState) return Promise.resolve(cachedState);
    cachePromise ??= loadDurableState().finally(() => {
      cachePromise = null;
    });
    return cachePromise;
  };

  namespace.on("connection", async (socket: Socket) => {
    socket.join(ROOM);
    namespace
      .to(ROOM)
      .emit("giveaway:presence", namespace.adapter.rooms.get(ROOM)?.size ?? 1);
    socket.on("disconnect", () => {
      namespace
        .to(ROOM)
        .emit(
          "giveaway:presence",
          namespace.adapter.rooms.get(ROOM)?.size ?? 0,
        );
    });

    try {
      socket.emit("giveaway:state", await getCachedState());
    } catch {
      socket.emit("giveaway:error", {
        message: "Live giveaway state is temporarily unavailable.",
      });
    }

    socket.on(
      "giveaway:admin-spin",
      async (_payload: unknown, ack?: (result: unknown) => void) => {
        if (!socket.data.isAdmin)
          return ack?.({
            ok: false,
            error: "You are not authorized to control this giveaway.",
          });
        try {
          const result = await startSpin();
          namespace.to(ROOM).emit("giveaway:spin-started", result.spin);
          publishState(result.state);
          scheduleSpinCompletion(result.spin);
          ack?.({ ok: true });
        } catch (error) {
          ack?.({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to spin.",
          });
        }
      },
    );

    for (const [event, action] of Object.entries(adminActions))
      socket.on(
        event,
        async (payload: unknown, ack?: (result: unknown) => void) => {
          if (!socket.data.isAdmin)
            return ack?.({
              ok: false,
              error: "You are not authorized to control this giveaway.",
            });
          try {
            const nextState = await updateGiveaway(
              action,
              (payload && typeof payload === "object" ? payload : {}) as Record<
                string,
                unknown
              >,
            );
            publishState(nextState);
            ack?.({ ok: true, state: nextState });
          } catch (error) {
            ack?.({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to update giveaway.",
            });
          }
        },
      );
  });
}

export default installGiveawaySocket;
