import {DaofinPlugin, DaofinPlugin__factory} from '../../typechain';
import {PromiseOrValue} from '../../typechain/common';
import {IDAO} from '@xinfin/osx-ethers';
import {BigNumber, BigNumberish, BytesLike} from 'ethers';

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
  voteOption: BigNumberish
): [
  BytesLike,
  IDAO.ActionStruct[],
  BigNumberish,
  BigNumberish,
  BigNumberish,
  BigNumberish
] {
  return [
    metadata,
    actions,
    allowFailureMap,
    electionPeriodIndex,
    proposalType,
    voteOption,
  ];
}
// The base value to encode real-valued ratios on the interval [0, 1] as integers on the interval 0 to 10^6.
const RATIO_BASE: BigNumberish = BigNumber.from(10).pow(6);

// Thrown if a ratio value exceeds the maximal value of 10^6.
class RatioOutOfBounds extends Error {
  constructor(limit: BigNumberish, actual: BigNumberish) {
    super(
      `Ratio out of bounds. Limit: ${limit.toString()}, Actual: ${actual.toString()}`
    );
  }
}

// Applies a ratio to a value and ceils the remainder.
export function applyRatioCeiled(
  _value: BigNumber,
  _ratio: BigNumber
): BigNumber {
  if (_ratio.gt(RATIO_BASE)) {
    throw new RatioOutOfBounds(RATIO_BASE, _ratio);
  }

  _value = _value.mul(_ratio);
  const remainder: BigNumber = _value.mod(RATIO_BASE);
  let result: BigNumber = _value.div(RATIO_BASE);

  // Check if ceiling is needed
  if (!remainder.isZero()) {
    result = result.add(BigNumber.from(1));
  }

  return result;
}
