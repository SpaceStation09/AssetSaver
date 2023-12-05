import { BigNumber, Contract, providers } from "ethers";
import { isAddress } from "ethers/lib/utils";

export class TransferETH {
  private _sender: string;
  private _recipient: string;
  private _provider: providers.BaseProvider;

  constructor(
    provider: providers.BaseProvider,
    sender: string,
    recipient: string
  ) {
    if (!isAddress(sender)) throw new Error("Bad Address");
    if (!isAddress(recipient)) throw new Error("Bad Address");

    this._sender = sender;
    this._recipient = recipient;
    this._provider = provider;
  }

  async description(): Promise<string> {
    return `Transfer native token balance: ${(
      await this._provider.getBalance(this._sender)
    ).toString()} from # ${this._sender} to # ${this._recipient}`;
  }

  async getSponsoredTransactions(): Promise<providers.TransactionRequest[]> {
    const balance = await this._provider.getBalance(this._sender);
    // if(balance.eq(0)){
    //   throw new Error(`No balance: ${this._sender} doesn't have remaining native token`);
    // }

    return [{
      to: this._recipient,
      value: balance
    }]
  }
}
