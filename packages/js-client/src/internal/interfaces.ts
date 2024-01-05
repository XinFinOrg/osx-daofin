import {
  AddJudiciaryStepValue,
  CommitteeVotingSettings,
  CreateProposalParams,
  JoinHouseStepValue,
  GlobalSettings,
  TallyDetails,
  UpdateOrJoinMasterNodeDelegateeStepValue,
  VoteOption,
  VoteStepValues,
} from '../types';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { InterfaceParams } from '@xinfin/osx-client-common';
import { ProposalMetadata } from '@xinfin/osx-client-common';
import { GasFeeEstimation } from '@xinfin/osx-client-common';
import { DaofinPlugin } from '@xinfin/osx-daofin-contracts-ethers';
import {
  CreateMultisigProposalParams,
  DaoDetails,
  ProposalCreationStepValue,
  ProposalQueryParams,
  VotingSettings,
} from '@xinfin/osx-sdk-client';

export interface IDaofinClientMethods {
  getGlobalSettings(): Promise<GlobalSettings>;
  getDaofin(): Promise<DaoDetails | null>;
  getVotingSettings: () => Promise<GlobalSettings>;
  createProposal: (
    params: CreateProposalParams
  ) => AsyncGenerator<ProposalCreationStepValue>;
  getElectionPeriods: () => Promise<DaofinPlugin.ElectionPeriodStruct[]>;
  pinMetadata: (params: ProposalMetadata) => Promise<string>;
  getProposal: (proposalId: string) => Promise<any | null>;
  getProposals: (params: any) => Promise<any[]>;
  voterToLockedAmount: (voterAddress: string) => Promise<BigNumberish>;
  isVotedOnProposal: (
    proposalId: string,
    voterAddress: string
  ) => Promise<boolean>;
  joinHouse: (amount: BigNumberish) => AsyncGenerator<JoinHouseStepValue>;
  addjudiciary: (member: string) => AsyncGenerator<AddJudiciaryStepValue>;
  isJudiciaryMember: (member: string) => Promise<boolean>;
  updateOrJoinMasterNodeDelegatee: (
    delegatee: string
  ) => AsyncGenerator<UpdateOrJoinMasterNodeDelegateeStepValue>;
  isMasterNodeDelegatee: (delegatee: string) => Promise<boolean>;
  isPeopleHouse: (member: string) => Promise<boolean>;
  isXDCValidatorCadidate: (member: string) => Promise<boolean>;
  vote: (
    proposalId: string,
    voteOption: VoteOption,
    earlyExecution: boolean
  ) => AsyncGenerator<VoteStepValues>;
  getProposalTallyDetails(
    proposalId: string,
    committee: string
  ): Promise<TallyDetails>;
  getCommitteesToVotingSettings(
    proposalId: string,
    committee: string
  ): Promise<CommitteeVotingSettings>;
  getTotalNumberOfMembersByCommittee(committee: string): Promise<BigNumberish>;
  getXDCTotalSupply(): Promise<BigNumberish>;
  getTotalNumberOfJudiciary(): Promise<BigNumberish>;
  getTotalNumberOfMN(): Promise<[BigNumberish, BigNumberish]>;
}
export interface IDaofinClientEncoding {}
export interface IDaofinClientDecoding {
  findInterface: (data: Uint8Array) => InterfaceParams | null;
}
export interface IDaofinClientEstimation {
  createProposal: (params: CreateProposalParams) => Promise<GasFeeEstimation>;
  updateOrJoinMasterNodeDelegatee: (
    delegatee: string
  ) => Promise<GasFeeEstimation>;
  joinHouse: (amount: BigNumberish) => Promise<GasFeeEstimation>;
  vote: (
    proposalId: string,
    voteOption: VoteOption,
    earlyExecution: boolean
  ) => Promise<GasFeeEstimation>;
}

export interface IDaofinClient {
  methods: IDaofinClientMethods;
  encoding: IDaofinClientEncoding;
  decoding: IDaofinClientDecoding;
  estimation: IDaofinClientEstimation;
}
