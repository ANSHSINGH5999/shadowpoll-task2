import { runDeploy } from "../deploy.js";
import { PreprodRemoteConfig } from "../config.js";

const seed = process.argv[2];
const staticProofServerPort = process.env.PROOF_SERVER_PORT
  ? Number(process.env.PROOF_SERVER_PORT)
  : undefined;

await runDeploy(new PreprodRemoteConfig(), staticProofServerPort, seed);
