import { config as envConfig } from "dotenv";
import { resolve } from "path";
import { BigNumber, Wallet, ethers } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleRawTransaction, FlashbotsBundleResolution, FlashbotsBundleTransaction } from "@flashbots/ethers-provider-bundle";
import { TransferETH } from "./Operations/TransferNativeToken";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { checkSimulation, printTransactions } from "./utils";
require("log-timestamp");

envConfig({ path: resolve(__dirname, "..", ".env") });
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? "";
const PRIVATE_KEY_EXECUTOR = process.env.PRIVATE_KEY_EXECUTOR ?? "";
const PRIVATE_KEY_SPONSOR = process.env.PRIVATE_KEY_SPONSOR ?? "";
const AUTH_SIGNER_PRIVATE_KEY = process.env.AUTH_SIGNER_PRIVATE_KEY ?? "";
const RECIPIENT = process.env.RECIPIENT ?? "";

if (PRIVATE_KEY_EXECUTOR === "") {
  console.warn(
    "Must provide PRIVATE_KEY_EXECUTOR environment variable, corresponding to Ethereum EOA with assets to be transferred"
  );
  process.exit(1);
}
if (PRIVATE_KEY_SPONSOR === "") {
  console.warn(
    "Must provide PRIVATE_KEY_SPONSOR environment variable, corresponding to an Ethereum EOA with ETH to pay miner"
  );
  process.exit(1);
}

if (PRIVATE_KEY_SPONSOR === "") {
  console.warn(
    "Must provide AUTH_SIGNER_PRIVATE_KEY environment variable. Please see https://docs.flashbots.net/flashbots-auction/quick-start"
  );
  process.exit(1);
}

async function main(){

}

main()
