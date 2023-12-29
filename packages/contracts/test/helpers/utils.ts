import {DaofinPlugin, DaofinPlugin__factory} from '../../typechain';
import {PromiseOrValue} from '../../typechain/common';
import {IDAO} from '@xinfin/osx-ethers';
import {VotingSettings} from '@xinfin/osx-sdk-client';
import {BigNumberish, BytesLike} from 'ethers';

export function createCommitteeVotingSettings(
  name: PromiseOrValue<BytesLike>,
  qourum: BigNumberish,
  threshold: BigNumberish,
  votingPower: BigNumberish
): DaofinPlugin.CommitteeVotingSettingsStruct {
  return {
    name,
    minParticipation: qourum,
    supportThreshold: threshold,
    minVotingPower: votingPower,
  };
}

export function createProposalParams(
  metadata: BytesLike,
  actions: IDAO.ActionStruct[],
  electionPeriodIndex: BigNumberish,
  proposalType: BigNumberish,
  allowFailureMap: BigNumberish,
  voteOption: BigNumberish.
): [BytesLike, IDAO.ActionStruct[], BigNumberish, BigNumberish, BigNumberish, BigNumberish] {
  return [
    metadata,
    actions,
    allowFailureMap,
    electionPeriodIndex,
    proposalType,
    voteOption
  ];
}
