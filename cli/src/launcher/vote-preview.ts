import { runVote } from "../vote.js";
import { PreviewRemoteConfig } from "../config.js";
import { type ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

const contractAddress = process.argv[2] as ContractAddress;
const voteYes = process.argv[3] === "yes";
const walletSeed = process.argv[4];
const staticProofServerPort = process.env.PROOF_SERVER_PORT
  ? Number(process.env.PROOF_SERVER_PORT)
  : undefined;

if (!contractAddress || !walletSeed) {
  // eslint-disable-next-line no-console
  console.error("Usage: vote-preview.ts <contractAddress> <yes|no> <walletSeed>");
  process.exit(1);
}

await runVote(new PreviewRemoteConfig(), contractAddress, voteYes, walletSeed, staticProofServerPort);
