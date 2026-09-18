import { runDeploy } from "../deploy.js";
import { PreviewRemoteConfig } from "../config.js";

const seed = process.argv[2];
const staticProofServerPort = process.env.PROOF_SERVER_PORT
  ? Number(process.env.PROOF_SERVER_PORT)
  : undefined;

await runDeploy(new PreviewRemoteConfig(), staticProofServerPort, seed);
