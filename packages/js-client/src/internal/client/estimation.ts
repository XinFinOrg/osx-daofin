import { DaofinPluginCore } from '../../core';
import { CreateProposalParams, VoteOption } from '../../types';
import { IDaofinClientEstimation } from '../interfaces';
import { BigNumberish } from '@ethersproject/bignumber';
import { toUtf8Bytes } from '@ethersproject/strings';
import { ClientCore, GasFeeEstimation } from '@xinfin/osx-client-common';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
} from '@xinfin/osx-daofin-contracts-ethers';

export class DaofinClientEstimation
  extends DaofinPluginCore
  implements IDaofinClientEstimation
{
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
  createProposal: (params: CreateProposalParams) => Promise<GasFeeEstimation> =
    async ({
      actions,
      allowFailureMap,
      electionIndex,
      metdata,
      proposalType,
      voteOption,
    }) => {
      const costs = await this.getProposalCosts();
      const estimation =
        await this.getDaofinInstance().estimateGas.createProposal(
          toUtf8Bytes(metdata),
          actions,
          electionIndex,
          proposalType,
          allowFailureMap,
          voteOption,
          { value: costs }
        );

      return this.web3.getApproximateGasFee(estimation.toBigInt());
    };
  updateOrJoinMasterNodeDelegatee: (
    delegatee: string
  ) => Promise<GasFeeEstimation> = async (delegatee) => {
    const estimation =
      await this.getDaofinInstance().estimateGas.updateOrJoinMasterNodeDelegatee(
        delegatee
      );

    return this.web3.getApproximateGasFee(estimation.toBigInt());
  };
  joinHouse: (amount: BigNumberish) => Promise<GasFeeEstimation> = async (
    amount
  ) => {
    const estimation = await this.getDaofinInstance().estimateGas.joinHouse({
      value: amount,
    });

    return this.web3.getApproximateGasFee(estimation.toBigInt());
  };
  vote: (
    proposalId: string,
    voteOption: VoteOption,
    earlyExecution: boolean
  ) => Promise<GasFeeEstimation> = async (
    proposalId,
    voteOption,
    earlyExecution
  ) => {
    const estimation = await this.getDaofinInstance().estimateGas.vote(
      proposalId,
      voteOption,
      earlyExecution
    );

    return this.web3.getApproximateGasFee(estimation.toBigInt());
  };
  execute: (proposalId: string) => Promise<GasFeeEstimation> = async (
    proposalId
  ) => {
    const estimation = await this.getDaofinInstance().estimateGas.execute(
      proposalId
    );

    return this.web3.getApproximateGasFee(estimation.toBigInt());
  };
  async getProposalCosts(): Promise<BigNumberish> {
    const daofin = DaofinPlugin__factory.connect(
      this.pluginAddress,
      this.web3.getProvider()
    );
    return await daofin.proposalCosts();
  }
}
