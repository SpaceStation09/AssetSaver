import { config as envConfig } from "dotenv";
import { resolve } from "path";
import { Wallet, ethers } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

envConfig({ path: resolve(__dirname, "..", "..", ".env") });
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? "";
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";

async function main(){
  const provider = new ethers.providers.AlchemyProvider("mainnet", ALCHEMY_API_KEY);
  const authSigner = new Wallet(PRIVATE_KEY);
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner
  );
}

main()
