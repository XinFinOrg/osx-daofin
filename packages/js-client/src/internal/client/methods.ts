import { DaofinPluginCore } from '../../core';
import {
  CreateProposalParams,
  DaofinDetails,
  GlobalSettings,
} from '../../types';
import { IDaofinClientMethods } from '../interfaces';
import { findLog } from '@xinfin/osx-client-common';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
} from '@xinfin/osx-daofin-contracts-ethers';
import {
  ProposalCreationStepValue,
  ProposalCreationSteps,
} from '@xinfin/osx-sdk-client';
import { encodeProposalId } from '@xinfin/osx-sdk-common';
import { ProposalCreationError } from '@xinfin/osx-sdk-common';

export class DaofinClientMethods
  extends DaofinPluginCore
  implements IDaofinClientMethods
{
  private daofinInstance: DaofinPlugin;
  setDaofinInstance(addressOrEns: string) {
    const signer = this.web3.getConnectedSigner();
    this.daofinInstance = DaofinPlugin__factory.connect(addressOrEns, signer);
    return this.daofinInstance;
  }
  getDaofinInstance(addressOrEns: string): DaofinPlugin {
    if (!this.daofinInstance) return this.setDaofinInstance(addressOrEns);
    return this.daofinInstance;
  }
  async getGlobalSettings(addressOrEns: string): Promise<GlobalSettings> {
    const daofin = this.getDaofinInstance(addressOrEns);
    const settings = await daofin.getGlobalSettings();
    if (!settings) return null;
    return {
      allowedAmounts: settings.allowedAmounts,
      xdcValidator: settings.xdcValidator,
      totalNumberOfMasterNodes: 0,
    };
  }
  getDaofin(daoAddressOrEns: string): Promise<DaofinDetails> {
    throw new Error('not implemented');
  }
  getVotingSettings(addressOrEns: string): Promise<GlobalSettings> {
    return this.getGlobalSettings(addressOrEns);
  }
  public async *createProposal(
    params: CreateProposalParams
  ): AsyncGenerator<ProposalCreationStepValue> {
    const { actions, allowFailureMap, electionIndex, metdata } = params;

    const tx = await this.getDaofinInstance(
      this.daofinInstance.address
    ).createProposal(metdata, actions, electionIndex, allowFailureMap);

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
  getElectionPeriods: (
    daoAddressOrEns: string
  ) => Promise<DaofinPlugin.ElectionPeriodStruct[]> = (daoAddressOrEns) => {
    return this.getDaofinInstance(daoAddressOrEns).getElectionPeriods();
  };
}
