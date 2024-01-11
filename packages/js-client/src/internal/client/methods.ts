import { DaofinPluginContext } from '../../context';
import { DaofinPluginCore } from '../../core';
import {
  AddJudiciaryStepValue,
  AddJudiciarySteps,
  CommitteeVotingSettings,
  CreateProposalParams,
  DaofinDetails,
  JoinHouseStepValue,
  JoinHouseSteps,
  GlobalSettings,
  SubgraphProposalBase,
  UpdateOrJoinMasterNodeDelegateeStepValue,
  UpdateOrJoinMasterNodeDelegateeSteps,
  VoteOption,
  VoteStepValues,
  VoteSteps,
  ExecuteSteps,
  ExecuteStepValues,
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
  XDCValidator__factory,
} from '@xinfin/osx-daofin-contracts-ethers';
import {
  ProposalCreationStepValue,
  ProposalCreationSteps,
  VoteValues,
  VotingSettings,
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
      houseMinAmount: settings.houseMinAmount,
      xdcValidator: settings.xdcValidator,
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
    const {
      actions,
      allowFailureMap,
      electionIndex,
      metdata,
      proposalType,
      voteOption,
    } = params;

    const tx = await this.getDaofinInstance().createProposal(
      toUtf8Bytes(params.metdata),
      actions,
      electionIndex,
      proposalType,
      allowFailureMap,
      voteOption
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
  isPeopleHouse: (voterAddress: string) => Promise<boolean> = async (
    voterAddress
  ) => {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return daofin.isPeopleHouse(voterAddress);
  };
  isVotedOnProposal: (
    proposalId: string,
    voterAddress: string
  ) => Promise<boolean> = async (proposalId, voterAddress) => {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return daofin.isVotedOnProposal(voterAddress, proposalId);
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

  public async *joinHouse(
    depositAmount: BigNumberish
  ): AsyncGenerator<JoinHouseStepValue> {
    const tx = await this.getDaofinInstance().joinHouse({
      value: depositAmount,
    });

    yield {
      key: JoinHouseSteps.DEPOSITING,
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
      key: JoinHouseSteps.DONE,
      txHash: tx.hash,
      depositer,
      amount,
    };
  }
  public async *addjudiciary(
    member: string
  ): AsyncGenerator<AddJudiciaryStepValue> {
    const tx = await this.getDaofinInstance().addJudiciaryMembers([...member]);

    yield {
      key: AddJudiciarySteps.ADDING,
      txHash: tx.hash,
    };
    const receipt = await tx.wait();

    const daofinInterface = DaofinPlugin__factory.createInterface();
    const log = findLog(receipt, daofinInterface, 'JudiciaryChanged');
    if (!log) {
      throw new FailedDepositError();
    }
    const parsedLog = daofinInterface.parseLog(log);
    const _member = parsedLog.args['_member'];
    const _action = parsedLog.args['_action'];

    yield {
      key: AddJudiciarySteps.DONE,
      member: _member,
    };
  }
  isJudiciaryMember: (member: string) => Promise<boolean> = async (member) => {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    const isJudiciaryMember = await daofin.isJudiciaryMember(member);
    if (isJudiciaryMember === undefined) return null;
    return isJudiciaryMember;
  };
  public async *updateOrJoinMasterNodeDelegatee(
    delegatee: string
  ): AsyncGenerator<UpdateOrJoinMasterNodeDelegateeStepValue> {
    const tx = await this.getDaofinInstance().updateOrJoinMasterNodeDelegatee(
      delegatee
    );

    yield {
      key: UpdateOrJoinMasterNodeDelegateeSteps.WAITING,
      txHash: tx.hash,
    };
    await tx.wait();

    yield {
      key: UpdateOrJoinMasterNodeDelegateeSteps.DONE,
    };
  }
  isMasterNodeDelegatee: (delegatee: string) => Promise<boolean> = async (
    delegatee
  ) => {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    const isMasterNodeDelegatee = await daofin.isMasterNodeDelegatee(delegatee);
    if (isMasterNodeDelegatee === undefined) return null;
    return isMasterNodeDelegatee;
  };
  isXDCValidatorCadidate: (member: string) => Promise<boolean> = async (
    member
  ) => {
    const signer = this.web3.getConnectedSigner();
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    const settings = await this.getGlobalSettings();
    if (!settings) return null;

    const validatorContract = XDCValidator__factory.connect(
      await settings.xdcValidator,
      this.web3.getProvider()
    );
    const isCandidate = await validatorContract.isCandidate(member);
    if (isCandidate === undefined) return null;

    return isCandidate;
  };

  public async *vote(
    proposalId: string,
    voteOption: VoteOption,
    earlyExecution: boolean
  ): AsyncGenerator<VoteStepValues, any, unknown> {
    const tx = await this.getDaofinInstance().vote(
      proposalId,
      voteOption,
      earlyExecution
    );

    yield {
      key: VoteSteps.WAITING,
      txHash: tx.hash,
    };
    await tx.wait();

    yield {
      key: VoteSteps.DONE,
    };
  }
  async getProposalTallyDetails(
    proposalId: string,
    committee: string
  ): Promise<DaofinPlugin.TallyDatailsStruct> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );

    return await daofin.getProposalTallyDetails(proposalId, committee);
  }
  async getCommitteesToVotingSettings(
    proposalId: string,
    committee: string
  ): Promise<CommitteeVotingSettings> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    const proposal = await daofin.getProposal(proposalId);
    return await daofin.getCommitteesToVotingSettings(
      proposal.proposalTypeId,
      committee
    );
  }
  async getTotalNumberOfMembersByCommittee(
    committee: string
  ): Promise<BigNumberish> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );

    return await daofin.getTotalNumberOfMembersByCommittee(committee);
  }
  async getTotalNumberOfJudiciary(): Promise<BigNumberish> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );

    return await daofin.getTotalNumberOfJudiciary();
  }
  async getTotalNumberOfMN(): Promise<[BigNumberish, BigNumberish]> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return await daofin.getTotalNumberOfMN();
  }
  async getXDCTotalSupply(): Promise<BigNumberish> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return await daofin.getXDCTotalSupply();
  }
  async canExecute(proposalId: string): Promise<boolean> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return await daofin.canExecute(proposalId);
  }
  public async *execute(
    proposalId: string
  ): AsyncGenerator<ExecuteStepValues, any, unknown> {
    const tx = await this.getDaofinInstance().execute(proposalId);
    yield {
      key: ExecuteSteps.WAITING,
      txHash: tx.hash,
    };
    await tx.wait();

    yield {
      key: ExecuteSteps.DONE,
    };
  }
  async isMinParticipationReached(proposalId: string): Promise<boolean> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return await daofin.isMinParticipationReached(proposalId);
  }
  async isThresholdReached(proposalId: string): Promise<boolean> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return await daofin.isThresholdReached(proposalId);
  }
}
