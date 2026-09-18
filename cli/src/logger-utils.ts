import * as path from "node:path";
import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import pinoPretty from "pino-pretty";
import pino from "pino";

export const createLogger = async (logPath: string): Promise<pino.Logger> => {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const pretty: pinoPretty.PrettyStream = pinoPretty({
    colorize: true,
    sync: true,
  });
  const level =
    process.env.DEBUG_LEVEL !== undefined &&
    process.env.DEBUG_LEVEL !== null &&
    process.env.DEBUG_LEVEL !== ""
      ? process.env.DEBUG_LEVEL
      : "info";
  return pino(
    { level, depthLimit: 20 },
    pino.multistream([
      { stream: pretty, level },
      { stream: createWriteStream(logPath), level },
    ]),
  );
};
