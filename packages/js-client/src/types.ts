import { BigNumberish } from '@ethersproject/bignumber';
import { DaoAction } from '@xinfin/osx-client-common';
import { ContextState, OverriddenState } from '@xinfin/osx-client-common';
import { DaofinPlugin } from '@xinfin/osx-daofin-contracts-ethers';
import { Context, ContextParams, DaoDetails } from '@xinfin/osx-sdk-client';

export type DaofinContextState = {
  pluginAddress: string;
  pluginRepoAddress: string;
};
export type DaofinOverriddenState = OverriddenState & {
  [key in keyof DaofinContextState]: boolean;
};

export type DaofinContextParams = ContextParams & {
  pluginRepoAddress: string;
  pluginAddress: string;
};
export type GlobalSettings = DaofinPlugin.DaofinGlobalSettingsStruct & {};

export type DaofinDetails = DaoDetails & {
  globalSettings: GlobalSettings;
};
export type CreateProposalParams = {
  metdata: string;
  actions: DaoAction[];
  electionIndex: BigNumberish;
  allowFailureMap: BigNumberish;
};

export type SubgraphProposalBase = {
  id: string;
  dao: {
    id: string;
  };
  creator: string;
  metadata: string;
  startDate: string;
  endDate: string;
  executed: boolean;
  potentiallyExecutable: boolean;
};
export enum DepositSteps {
  DEPOSITING = 'DEPOSITING',
  DONE = 'DONE',
}
export type DepositStepValue =
  | {
      key: DepositSteps.DEPOSITING;
      txHash: string;
    }
  | {
      key: DepositSteps.DONE;
      txHash: string;
      depositer: string;
      amount: string;
    };
