import { config as envConfig } from "dotenv";
import { resolve } from "path";
import { BigNumber, Wallet, ethers } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleRawTransaction, FlashbotsBundleResolution, FlashbotsBundleTransaction } from "@flashbots/ethers-provider-bundle";
import { TransferETH } from "./Operations/TransferNativeToken";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { checkSimulation, printTransactions } from "./utils";
require("log-timestamp");

envConfig({ path: resolve(__dirname, "..", "..", ".env") });
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? "";
const PRIVATE_KEY_EXECUTOR = process.env.PRIVATE_KEY_EXECUTOR ?? "";
const PRIVATE_KEY_SPONSOR = process.env.PRIVATE_KEY_SPONSOR ?? "";
const AUTH_SIGNER_PRIVATE_KEY = process.env.AUTH_SIGNER_PRIVATE_KEY ?? "";
const RECIPIENT = process.env.RECIPIENT ?? "";

// TODO: use a gas price api to get more precise & appropriate value
const PRIORITY_GAS_PRICE = parseUnits("31", "gwei");
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

async function main(){
  const authSigner = new Wallet(AUTH_SIGNER_PRIVATE_KEY);
  const sponsor = new Wallet(PRIVATE_KEY_SPONSOR);
  const executor = new Wallet(PRIVATE_KEY_EXECUTOR);

  const provider = new ethers.providers.AlchemyProvider(
    "goerli",
    ALCHEMY_API_KEY
  );
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    "https://relay-goerli.flashbots.net"
  );

  const block = await provider.getBlock("latest");

  const operation = new TransferETH(provider, executor.address, RECIPIENT);
  const sponsoredTxs = await operation.getSponsoredTransactions();
  const gasEstimated = await Promise.all(sponsoredTxs.map(tx => provider.estimateGas({...tx, from: tx.from == undefined ? executor.address : tx.from})))
  const gasEstimatedInTotal = gasEstimated.reduce((acc, cur) => acc.add(cur), BigNumber.from(0));

  const gasPrice = PRIORITY_GAS_PRICE.add(block.baseFeePerGas || 0);

  const bundleTransactions:
    | FlashbotsBundleTransaction[]
    | FlashbotsBundleRawTransaction[] = [
    {
      transaction: {
        to: executor.address,
        gasPrice: gasPrice,
        value: gasEstimatedInTotal.mul(gasPrice),
        gasLimit: 21000,
      },
      signer: sponsor,
    },
    ...sponsoredTxs.map((tx, txNumber) => {
      return {
        transaction: {
          ...tx,
          gasPrice: gasPrice,
          gasLimit: gasEstimated[txNumber],
        },
        signer: executor
      }
    })
  ];

  const signedBundle = await flashbotsProvider.signBundle(bundleTransactions);
  await printTransactions(bundleTransactions, signedBundle);
  const simulatedGasPrice = await checkSimulation(flashbotsProvider, signedBundle);

  console.log(await operation.description());

  console.log(`Executor Account: ${executor.address}`);
  console.log(`Sponsor Account: ${sponsor.address}`);
  console.log(`Simulated Gas Price: ${formatUnits(simulatedGasPrice, "gwei")} gwei`);
  console.log(`Gas Price: ${formatUnits(simulatedGasPrice, "gwei")} gwei`);
  console.log(`Gas Used: ${gasEstimatedInTotal.toString()}`);

  provider.on("block", async (blockNumber) => {
    const simulatedGasPrice = await checkSimulation(
      flashbotsProvider,
      signedBundle
    );
    const targetBlockNumber = blockNumber + BLOCKS_IN_FUTURE;
    console.log(`Current block: # ${blockNumber},  Target block: # ${targetBlockNumber}, gasPrice: ${formatUnits(simulatedGasPrice, "gwei")} gwei`);

    const bundleResponse = await flashbotsProvider.sendBundle(
      bundleTransactions,
      targetBlockNumber
    );
    if ("error" in bundleResponse) {
      throw new Error(bundleResponse.error.message);
    }

    const bundleResolution = await bundleResponse.wait();
    if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
      console.log(`Congrats, included in ${targetBlockNumber}`);
      process.exit(0);
    } else if (
      bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion
    ) {
      console.log(`Not included in ${targetBlockNumber}`);
    } else if (
      bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh
    ) {
      console.log("Nonce too high, bailing");
      process.exit(1);
    }
  })
}

main()
