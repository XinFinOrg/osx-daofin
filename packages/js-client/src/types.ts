import { BigNumberish } from '@ethersproject/bignumber';
import { DaoAction } from '@xinfin/osx-client-common';
import { ContextState, OverriddenState } from '@xinfin/osx-client-common';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
} from '@xinfin/osx-daofin-contracts-ethers';
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
  proposalType: BigNumberish;
  allowFailureMap: BigNumberish;
  voteOption: number;
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
export enum JoinHouseSteps {
  DEPOSITING = 'DEPOSITING',
  DONE = 'DONE',
}
export type JoinHouseStepValue =
  | {
      key: JoinHouseSteps.DEPOSITING;
      txHash: string;
    }
  | {
      key: JoinHouseSteps.DONE;
      txHash: string;
      depositer: string;
      amount: string;
    };
export enum AddJudiciarySteps {
  ADDING = 'ADDING',
  DONE = 'DONE',
}
export type AddJudiciaryStepValue =
  | {
      key: AddJudiciarySteps.ADDING;
      txHash: string;
    }
  | {
      key: AddJudiciarySteps.DONE;
      member: string;
    };

export enum UpdateOrJoinMasterNodeDelegateeSteps {
  WAITING = 'WAITING',
  DONE = 'DONE',
}
export type UpdateOrJoinMasterNodeDelegateeStepValue =
  | {
      key: UpdateOrJoinMasterNodeDelegateeSteps.WAITING;
      txHash: string;
    }
  | {
      key: UpdateOrJoinMasterNodeDelegateeSteps.DONE;
    };

export enum VoteSteps {
  WAITING = 'WAITING',
  DONE = 'DONE',
}
export type VoteStepValues =
  | {
      key: VoteSteps.WAITING;
      txHash: string;
    }
  | {
      key: VoteSteps.DONE;
    };

export enum ExecuteSteps {
  WAITING = 'WAITING',
  DONE = 'DONE',
}
export type ExecuteStepValues =
  | {
      key: ExecuteSteps.WAITING;
      txHash: string;
    }
  | {
      key: ExecuteSteps.DONE;
    };
export enum VoteOption {
  NONE,
  ABSTAIN,
  YES,
  NO,
}

export type TallyDetails = DaofinPlugin.TallyDatailsStruct;
export type CommitteeVotingSettings =
  DaofinPlugin.CommitteeVotingSettingsStruct;
