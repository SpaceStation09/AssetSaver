import { config as envConfig } from "dotenv";
import { resolve } from "path";
import { BigNumber, Wallet, ethers } from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleRawTransaction,
  FlashbotsBundleResolution,
  FlashbotsBundleTransaction,
} from "@flashbots/ethers-provider-bundle";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { checkSimulation, printTransactions } from "../utils";
require("log-timestamp");

envConfig({ path: resolve(__dirname, "..", "..", ".env") });
const ALCHEMY_API_KEY_GOERLI = process.env.ALCHEMY_API_KEY_GOERLI ?? "";
const PRIVATE_KEY_EXECUTOR = process.env.PRIVATE_KEY_EXECUTOR ?? "";
const PRIVATE_KEY_SPONSOR = process.env.PRIVATE_KEY_SPONSOR ?? "";
const RECIPIENT = process.env.RECIPIENT ?? "";

// TODO: use a gas price api to get more precise & appropriate value
const PRIORITY_GAS_PRICE = parseUnits("100", "gwei");
const BLOCKS_IN_FUTURE = 2;

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

async function main() {
  const authSigner = Wallet.createRandom();
  const sponsor = new Wallet(PRIVATE_KEY_SPONSOR);
  const executor = new Wallet(PRIVATE_KEY_EXECUTOR);

  const provider = new ethers.providers.AlchemyProvider(
    "goerli",
    ALCHEMY_API_KEY_GOERLI
  );
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    "https://relay-goerli.flashbots.net"
  );

  // TODO: Pretty output
  console.log("==============================================");
  console.log(
    `TASK: Transfer native token: from # ${executor.address} to # ${RECIPIENT}`
  );
  console.log(`Executor Account: ${executor.address}`);
  console.log(`Sponsor Account: ${sponsor.address}`);

  provider.on("block", async (blockNumber) => {
    const block = await provider.getBlock("latest");
    const targetBlockNumber = blockNumber + BLOCKS_IN_FUTURE;

    const balance = await provider.getBalance(executor.address);
    if (balance.gte(parseUnits("0.001", "gwei"))) {
      console.log(`Current block: # ${blockNumber}, situation satisfied.`);
      const sponsoredTx = {
        from: executor.address,
        to: RECIPIENT,
        value: balance,
      };
      const gasEstimated = await provider.estimateGas(sponsoredTx);
      const maxBaseFeeInFutureBlock =
        FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
          block.baseFeePerGas || BigNumber.from(0),
          BLOCKS_IN_FUTURE
        );
      const maxFeePerGas = PRIORITY_GAS_PRICE.add(maxBaseFeeInFutureBlock);

      const bundleTransactions:
        | FlashbotsBundleTransaction[]
        | FlashbotsBundleRawTransaction[] = [
        {
          transaction: {
            to: executor.address,
            type: 2,
            chainId: 5,
            maxFeePerGas: PRIORITY_GAS_PRICE.add(maxBaseFeeInFutureBlock),
            maxPriorityFeePerGas: PRIORITY_GAS_PRICE,
            gasLimit: 21000,
            value: gasEstimated.mul(maxFeePerGas),
          },
          signer: sponsor,
        },
        {
          transaction: {
            ...sponsoredTx,
            type: 2,
            chainId: 5,
            maxFeePerGas: PRIORITY_GAS_PRICE.add(maxBaseFeeInFutureBlock),
            maxPriorityFeePerGas: PRIORITY_GAS_PRICE,
            gasLimit: gasEstimated,
          },
          signer: executor,
        },
      ];

      const signedBundle = await flashbotsProvider.signBundle(
        bundleTransactions
      );
      await printTransactions(bundleTransactions, signedBundle);
      const simulatedGasPrice = await checkSimulation(
        flashbotsProvider,
        signedBundle
      );
      console.log(
        `Current block: # ${blockNumber},  Target block: # ${targetBlockNumber}, gasPrice: ${formatUnits(
          simulatedGasPrice,
          "gwei"
        )} gwei`
      );
      const bundleResponse = await flashbotsProvider.sendBundle(
        bundleTransactions,
        targetBlockNumber
      );

      if ("error" in bundleResponse) {
        throw new Error(bundleResponse.error.message);
      }

      const bundleResolution = await bundleResponse.wait();
      if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
        console.log(
          `Congrats, included in ${targetBlockNumber}`
        );
        process.exit(0);
      } else if (
        bundleResolution ===
        FlashbotsBundleResolution.BlockPassedWithoutInclusion
      ) {
        console.log(`Not included in ${targetBlockNumber}`);
      } else if (
        bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh
      ) {
        console.log("Nonce too high, bailing");
        process.exit(1);
      }
    } else {
      console.log(
        `Current block: # ${blockNumber}, searching for satisfied situation....`
      );
    }
  });
}

main();
