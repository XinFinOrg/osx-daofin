import {
  AddJudiciaryStepValue,
  CreateProposalParams,
  DepositStepValue,
  GlobalSettings,
} from '../types';
import { BigNumberish } from '@ethersproject/bignumber';
import { InterfaceParams } from '@xinfin/osx-client-common';
import { ProposalMetadata } from '@xinfin/osx-client-common';
import { GasFeeEstimation } from '@xinfin/osx-client-common';
import { DaofinPlugin } from '@xinfin/osx-daofin-contracts-ethers';
import {
  CreateMultisigProposalParams,
  DaoDetails,
  ProposalCreationStepValue,
  ProposalQueryParams,
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
  isUserDeposited: (voterAddress: string) => Promise<boolean>;
  voterToLockedAmount: (voterAddress: string) => Promise<BigNumberish>;
  isVotedOnProposal: (
    proposalId: string,
    voterAddress: string
  ) => Promise<boolean>;
  deposit: (amount: BigNumberish) => AsyncGenerator<DepositStepValue>;
  addjudiciary: (member: string) => AsyncGenerator<AddJudiciaryStepValue>;
  isJudiciaryMember: (member: string) => Promise<boolean>;
}
export interface IDaofinClientEncoding {}
export interface IDaofinClientDecoding {
  findInterface: (data: Uint8Array) => InterfaceParams | null;
}
export interface IDaofinClientEstimation {
  createProposal: (
    params: CreateMultisigProposalParams
  ) => Promise<GasFeeEstimation>;
}

export interface IDaofinClient {
  methods: IDaofinClientMethods;
  encoding: IDaofinClientEncoding;
  decoding: IDaofinClientDecoding;
  estimation: IDaofinClientEstimation;
}
