import { Injectable } from '@angular/core';
import { NodeAdapter } from '../adapter.service';

import { isString, map, noop, orderBy } from 'lodash';

import { Web3Connector, Web3ConnectorType } from './web3.connector';

import Web3 from 'web3';
import { BlockNumber, Transaction, TransactionConfig, TransactionReceipt } from 'web3-core';
import { Block } from 'web3-eth';
import { PagedResponse } from '../../node-api.service';

export const DEFAULT_QUERY_SIZE = 100000; // max block range per request
@Injectable({
  providedIn: 'root'
})
export class Web3Adapter implements NodeAdapter{
  apiConnector?: Web3Connector;

  constructor() {}

  init(endpoint: string) {
    if(!endpoint) return Promise.reject();

    console.log('[Node Adapter:Web3] Initializing web3', endpoint);
    let connectorType: Web3ConnectorType = null;

    endpoint.startsWith('ws://') || endpoint.startsWith('wss://') ? connectorType = 'ws' : noop();
    endpoint.startsWith('http://') || endpoint.startsWith('https://') ? connectorType = 'http' : noop();
    try {
      this.apiConnector = new Web3Connector(endpoint, connectorType)
    } catch(error) {
      console.log('[Node Adapter:Web3] Error connecting to node', error);
      localStorage.removeItem('config');
      return Promise.reject();
    }

    return Promise.resolve(true);
  }

  getBlockHeader(): Promise<number> {
    if(!this.apiConnector) return Promise.reject();

    return this.apiConnector.getBlockNumber();
  }
  getBlock(blockId: BlockNumber): Promise<Block> {
    if(!this.apiConnector) return Promise.reject();

    return this.apiConnector.getBlock(blockId);
  }
  getTxsByBlock(blockId: string): Promise<Transaction[]> {
    if(!this.apiConnector) return Promise.reject();

    return this.apiConnector.getTxListByHeight(blockId);
  }
  getTxByHash(hash: string): Promise<Transaction> {
    if(!this.apiConnector) return Promise.reject();

    return this.apiConnector.getTransaction(hash);
  }

async getTxsByAccount(address: string, page: number, pageSize: number, searchFromBlock?: number, scopeSize?: number) {
    if(!this.apiConnector) return Promise.reject();
    if(!searchFromBlock) searchFromBlock = await this.getBlockHeader();
    if(!scopeSize) scopeSize = 0;

    let scope = searchFromBlock - scopeSize > 0 ? searchFromBlock - scopeSize : 0; // Will stop searching when this blockId is reached
    let startIndex = (page - 1) * pageSize;
    let endIndex = (startIndex + pageSize);
    let txFound: Transaction[] = [];

    let to = searchFromBlock;
    let from = to - DEFAULT_QUERY_SIZE;

    // console.log('scope', scope);
    // console.log('from', from);
    // console.log('to', to);

    // get the txs from node. requests will be divided in chuncks set by query size. Will stop when we reach the end of the chain, or when requested txs in page have been found.
    do {
      // don't search beyond scope
      if(from < scope) from = scope;
      if(to < scope) to = scope;

      console.log(`Fetching txs from block ${from} to ${to}`)
      const txInThisPage = await this.apiConnector.queryTxByAddr(
        address,
        Web3.utils.numberToHex(from),
        Web3.utils.numberToHex(to)
      )
      if  (txInThisPage.length) {
        txFound = txFound.concat(txInThisPage);
        console.log(`Found ${txFound.length} transactions`)
      }

      to = from - 1;
      from = from - DEFAULT_QUERY_SIZE;
    } while ( txFound.length < (endIndex) && to > scope );

    txFound = map(txFound, (tx) => {
      if(isString(tx.blockNumber)) {
        // convert blocknumber to int. sbch returns these as hexes, while Web3 Transaction expects them to be number
        tx.blockNumber = Web3.utils.hexToNumber(tx.blockNumber as any)

        return tx;
      }

      return tx;
    });

    txFound = orderBy(txFound, ['blockNumber'], ['desc']);

    const txResults = txFound.slice(startIndex, endIndex);

    return {
      results: txResults,
      page,
      pageSize,
      isEmpty: txResults.length === 0,
      total: to < scope ? txFound.length : undefined
    } as PagedResponse<Transaction>;
  }

  getTxCount(address: string) {
    if(!this.apiConnector) return Promise.reject();

    return this.apiConnector.getTransactionCount(address);
  }
  getAccountBalance(address: string): Promise<string> {
    if(!this.apiConnector) return Promise.reject();

    return this.apiConnector.getBalance(address);
  }

  getCode(address: string): Promise<string> {
    if(!this.apiConnector) return Promise.reject();

    return this.apiConnector.getCode(address);
  }
  getTxReceiptByHash(hash: string): Promise<TransactionReceipt> {
    if(!this.apiConnector) return Promise.reject();

    return this.apiConnector.getTransactionReceipt(hash)
  }
  async call(transactionConfig: TransactionConfig, returnType: string) {
    if(!this.apiConnector) return Promise.reject();

    let callReturn: {[key: string]: any} | undefined;

    await this.apiConnector.call(transactionConfig).then( (call) => {
      callReturn = this.apiConnector?.getWeb3()?.eth.abi.decodeParameter(returnType, call);
    });

    if(!callReturn) {
      return Promise.reject();
    }

    return Promise.resolve(callReturn);
  }

  queryLogs(address: string, data: any[], start: string, end: string) {
    if(!this.apiConnector) return Promise.reject();
    return this.apiConnector.queryLogs(address, data, start, end);
  }

  async hasMethodFromAbi(address: string, method: string, abi: any): Promise<boolean> {
    const myMethod = Web3.utils.sha3("symbol()");
    // const myMethod2 = Web3.utils.sha3("name()");
    const myMethod3 = Web3.utils.sha3("totalSupply()");

    // if(myMethod3) {
    //   this.call({ to: address, data: myMethod3}).then( call => {
    //     console.log('SUPPLY', this.apiConnector?.decodeParameter("uint256", call));
    //   });
    // }

    // if(myMethod2) {
    //   this.call({ to: address, data: myMethod2}).then( call => {
    //     console.log('NAME', abi.decodeParameter("string", call));
    //   });
    // }

    this.queryLogs(
      address,
      [
        Web3.utils.keccak256('Transfer(address,address,uint256)'),
        // web3.utils.sha3('Deposit(address,uint256)'),
        // web3.utils.sha3('Withdrawal(address,uint256)'),

      ],
      '0x0',
      'latest'
    ).then(result => {
      console.log('sbch', result)
      console.log( Web3.utils.stringToHex(result[0].topics[1] ));
    })

    // if (myMethod) {
    //   this.call({ to: address, data: myMethod}).then( call => {
    //     console.log('SYMBOL', web3.eth.decodeParameter("string", call));
    //     console.log(Web3.utils.keccak256('Transfer(address,address,uint256)'))
    //     console.log(Web3.utils.keccak256('transfer(address,uint256)'))



    //     // web3.eth.getPastLogs({
    //     //   fromBlock: '0x0',
    //     //   address: address,
    //     //   topics: [
    //     //     web3.utils.sha3('Transfer(address,address,uint256)')
    //     //   ]
    //     // }).then( result => {
    //     //   console.log('PAST LOGS', result);

    //     //   console.log( web3.utils.stringToHex(result[0].topics[1] ));
    //     // })

    //   })
    //   .catch(error => {
    //     console.log('NO METHOD', error)
    //   });
    // }

    return Promise.resolve(false);
  }
}
