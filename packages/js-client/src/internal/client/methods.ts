import { DaofinPluginContext } from '../../context';
import { DaofinPluginCore } from '../../core';
import {
  CreateProposalParams,
  DaofinDetails,
  DepositStepValue,
  DepositSteps,
  GlobalSettings,
  SubgraphProposalBase,
} from '../../types';
import { getPluginInstallationId, toProposalListItem } from '../../utils';
import { ProposalQuery, ProposalsQuery } from '../graphql-queries/proposals';
import { IDaofinClientMethods } from '../interfaces';
import { BigNumberish } from '@ethersproject/bignumber';
import { toUtf8Bytes } from '@ethersproject/strings';
import { EMPTY_PROPOSAL_METADATA_LINK } from '@xinfin/osx-client-common';
import { ProposalMetadata, findLog } from '@xinfin/osx-client-common';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
} from '@xinfin/osx-daofin-contracts-ethers';
import {
  ProposalCreationStepValue,
  ProposalCreationSteps,
} from '@xinfin/osx-sdk-client';
import { FailedDepositError } from '@xinfin/osx-sdk-common';
import { resolveIpfsCid } from '@xinfin/osx-sdk-common';
import { encodeProposalId } from '@xinfin/osx-sdk-common';
import { ProposalCreationError } from '@xinfin/osx-sdk-common';

export class DaofinClientMethods
  extends DaofinPluginCore
  implements IDaofinClientMethods
{
  constructor(context: DaofinPluginContext) {
    super(context);
  }
  private daofinInstance: DaofinPlugin;
  setDaofinInstance() {
    const signer = this.web3.getConnectedSigner();
    this.daofinInstance = DaofinPlugin__factory.connect(
      this.pluginAddress,
      signer
    );
    return this.daofinInstance;
  }
  getDaofinInstance(): DaofinPlugin {
    if (!this.daofinInstance) return this.setDaofinInstance();
    return this.daofinInstance;
  }
  async getGlobalSettings(): Promise<GlobalSettings> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    const settings = await daofin.getGlobalSettings();
    if (!settings) return null;
    return {
      allowedAmounts: settings.allowedAmounts,
      xdcValidator: settings.xdcValidator,
      totalNumberOfMasterNodes: 0,
    };
  }
  getDaofin(): Promise<DaofinDetails> {
    throw new Error('not implemented');
  }
  getVotingSettings(): Promise<GlobalSettings> {
    return this.getGlobalSettings();
  }
  public async *createProposal(
    params: CreateProposalParams
  ): AsyncGenerator<ProposalCreationStepValue> {
    const { actions, allowFailureMap, electionIndex, metdata } = params;

    const tx = await this.getDaofinInstance().createProposal(
      toUtf8Bytes(params.metdata),
      actions,
      electionIndex,
      allowFailureMap
    );

    yield {
      key: ProposalCreationSteps.CREATING,
      txHash: tx.hash,
    };
    const receipt = await tx.wait();
    const daofinInterface = DaofinPlugin__factory.createInterface();
    const log = findLog(receipt, daofinInterface, 'ProposalCreated');
    if (!log) {
      throw new ProposalCreationError();
    }
    const parsedLog = daofinInterface.parseLog(log);
    const proposalId = parsedLog.args['proposalId'];
    if (!proposalId) {
      throw new ProposalCreationError();
    }
    yield {
      key: ProposalCreationSteps.DONE,
      proposalId: encodeProposalId(
        this.daofinInstance.address,
        Number(proposalId)
      ),
    };
  }
  getElectionPeriods: () => Promise<DaofinPlugin.ElectionPeriodStruct[]> =
    () => {
      const daofin = DaofinPlugin__factory.connect(
        this.pluginAddress,
        this.web3.getProvider()
      );
      return daofin.getElectionPeriods();
    };
  pinMetadata: (params: ProposalMetadata) => Promise<string> = async (
    params
  ) => {
    try {
      const cid = await this.ipfs.add(JSON.stringify(params));
      await this.ipfs.pin(cid);
      return `ipfs://${cid}`;
    } catch (e) {
      throw new Error(e);
    }
  };
  getProposal: (proposalId: string) => Promise<any> = async (proposalId) => {
    const query = ProposalQuery;
    const name = 'ProposalQuery';
    type T = {
      plugin: SubgraphProposalBase;
    };
    const { plugin: proposal } = await this.graphql.request<T>({
      params: {
        proposalId,
      },
      query,
      name,
    });

    if (!proposal.metadata) {
      return toProposalListItem(proposal, EMPTY_PROPOSAL_METADATA_LINK);
    }
    const metadataCid = resolveIpfsCid(proposal.metadata);
    const metadataString = await this.ipfs.fetchString(metadataCid);
    const metadata = JSON.parse(metadataString) as ProposalMetadata;
    return toProposalListItem(proposal, metadata);
  };
  getProposals: (daoAddress: string) => Promise<any[]> = async (daoAddress) => {
    const query = ProposalsQuery;
    const name = 'ProposalsQuery';
    type T = {
      pluginProposals: SubgraphProposalBase[];
    };
    const { pluginProposals } = await this.graphql.request<T>({
      params: {
        pluginId: getPluginInstallationId(daoAddress, this.pluginAddress),
      },
      query,
      name,
    });
    return Promise.all(
      pluginProposals.map(async (proposal) => {
        if (!proposal.metadata) {
          return toProposalListItem(proposal, EMPTY_PROPOSAL_METADATA_LINK);
        }
        const metadataCid = resolveIpfsCid(proposal.metadata);
        const metadataString = await this.ipfs.fetchString(metadataCid);
        const metadata = JSON.parse(metadataString) as ProposalMetadata;
        return toProposalListItem(proposal, metadata);
      })
    );
  };
  isUserDeposited: (voterAddress: string) => Promise<boolean> = async (
    voterAddress
  ) => {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return daofin.isVoterDepositted(voterAddress);
  };
  isVotedOnProposal: (
    proposalId: string,
    voterAddress: string
  ) => Promise<boolean> = async (proposalId, voterAddress) => {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return daofin.isVotedOnProposal(proposalId, voterAddress);
  };
  voterToLockedAmount: (voterAddress: string) => Promise<BigNumberish> = async (
    voterAddress
  ) => {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    const isUserDeposited = await daofin._voterToLockedAmounts(voterAddress);
    if (!isUserDeposited) return null;
    return isUserDeposited.amount;
  };

  public async *deposit(
    depositAmount: BigNumberish
  ): AsyncGenerator<DepositStepValue> {
    const tx = await this.getDaofinInstance().deposit({
      value: depositAmount,
    });

    yield {
      key: DepositSteps.DEPOSITING,
      txHash: tx.hash,
    };
    const receipt = await tx.wait();

    const daofinInterface = DaofinPlugin__factory.createInterface();
    const log = findLog(receipt, daofinInterface, 'Deposited');
    if (!log) {
      throw new FailedDepositError();
    }
    const parsedLog = daofinInterface.parseLog(log);
    const depositer = parsedLog.args['_depositer'];
    const amount = parsedLog.args['_amount'];

    yield {
      key: DepositSteps.DONE,
      txHash: tx.hash,
      depositer,
      amount,
    };
  }
}
