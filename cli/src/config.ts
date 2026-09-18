import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PreprodTestEnvironment,
  PreviewTestEnvironment,
  type TestEnvironment,
} from "@midnight-ntwrk/testkit-js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { Logger } from "pino";

export interface Config {
  readonly privateStateStoreName: string;
  readonly logDir: string;
  readonly zkConfigPath: string;
  getEnvironment(logger: Logger): TestEnvironment;
}

export const currentDir = path.dirname(fileURLToPath(import.meta.url));

export class PreviewRemoteConfig implements Config {
  privateStateStoreName = "shadowpoll-private-state";
  logDir = path.resolve(currentDir, "..", "logs", "preview-remote", `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, "..", "..", "contract", "src", "managed", "shadow_poll");

  getEnvironment(logger: Logger): TestEnvironment {
    setNetworkId("preview");
    return new PreviewTestEnvironment(logger);
  }
}

export class PreprodRemoteConfig implements Config {
  privateStateStoreName = "shadowpoll-private-state";
  logDir = path.resolve(currentDir, "..", "logs", "preprod-remote", `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, "..", "..", "contract", "src", "managed", "shadow_poll");

  getEnvironment(logger: Logger): TestEnvironment {
    setNetworkId("preprod");
    return new PreprodTestEnvironment(logger);
  }
}
