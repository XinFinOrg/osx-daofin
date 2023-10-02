import {bigIntToBytes32} from './bytes';
import {Address, BigInt} from '@graphprotocol/graph-ts';

export function getProposalId(
  plugin: Address,
  pluginProposalId: BigInt
): string {
  return plugin
    .toHexString()
    .concat('_')
    .concat(bigIntToBytes32(pluginProposalId));
}
export function getDepositId(daoAddress: Address, blockNumber: BigInt): string {
  return daoAddress
    .toHexString()
    .concat('_')
    .concat(bigIntToBytes32(blockNumber));
}
export function getJudiciaryId(
  daoAddress: Address,
  blockNumber: BigInt,
  timestamp: BigInt
): string {
  return daoAddress
    .toHexString()
    .concat('_')
    .concat(bigIntToBytes32(blockNumber))
    .concat(bigIntToBytes32(timestamp));
}
