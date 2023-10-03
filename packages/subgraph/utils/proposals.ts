import {bigIntToBytes32} from './bytes';
import {Address, BigInt, Bytes} from '@graphprotocol/graph-ts';

export function getProposalId(
  plugin: Address,
  pluginProposalId: BigInt
): string {
  return plugin
    .toHexString()
    .concat('_')
    .concat(bigIntToBytes32(pluginProposalId));
}
export function getDepositId(
  depositor: Address,
  daoAddress: Address,
  blockNumber: BigInt
): string {
  return daoAddress
    .toHexString()
    .concat('_')
    .concat(depositor.toHexString())
    .concat('_')
    .concat(bigIntToBytes32(blockNumber));
}
export function getJudiciaryId(
  pluginId: string,
  member: Address,
  action: BigInt,
  blockNumber: BigInt
): string {
  return pluginId
    .concat('_')
    .concat(member.toHexString())
    .concat('_')
    .concat(bigIntToBytes32(action))
    .concat('_')
    .concat(bigIntToBytes32(blockNumber));
}
