import { DaofinPluginCore } from '../../core';
import { CreateProposalParams } from '../../types';
import { IDaofinClientEstimation } from '../interfaces';
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
      const estimation =
        await this.getDaofinInstance().estimateGas.createProposal(
          toUtf8Bytes(metdata),
          actions,
          electionIndex,
          proposalType,
          allowFailureMap,
          voteOption
        );

      return this.web3.getApproximateGasFee(estimation.toBigInt());
    };
}
