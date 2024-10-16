import { BlockNumber, TransactionConfig, TransactionReceipt } from 'web3-core';
import { Block, Transaction } from 'web3-eth';
import { PagedResponse } from '../node-api.service';

export abstract class NodeAdapter {

  abstract init(endpoint: string): Promise<boolean>;
  abstract getBlockHeader(): Promise<number>
  abstract getBlock(blockId: BlockNumber): Promise<Block>;
  abstract getTxsByBlock(blockId: BlockNumber): Promise<Transaction[]>;
  abstract getTxByHash(hash: string): Promise<Transaction>;
  abstract getTxReceiptByHash(hash: string): Promise<TransactionReceipt>;
  abstract getTxCount(address: string): Promise<number>
  abstract getAccountBalance(address: string): Promise<string>;
  abstract getCode(address: string): Promise<string>;
  abstract queryLogs(address: string, data: any[], start: string, end: string): Promise<any[]>;
  abstract call(transactionConfig: TransactionConfig, returnType: string): Promise<any>;

  /**
   * Gets txs for account
   * @param address address to search for
   * @param [page] the requested page
   * @param [pageSize] amount of txs to return
   * @param [searchFromBlock] search from a specific block number. Defaults to latest block
   * @param [scopeSize] how many blocks deep into the chain to search. Defaults to full chain
   * @returns
   */
  abstract getTxsByAccount(
    address: string,
    page: number,
    pageSize: number,
    searchFromBlock?: number,
    scopeSize?: number): Promise<PagedResponse<Transaction>>;


  abstract hasMethodFromAbi(address: string, method: string, abi: any): Promise<boolean>;
}
