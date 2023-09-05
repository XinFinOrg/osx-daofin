import { DaofinPluginCore } from '../../core';
import { DaofinDetails, GlobalSettings } from '../../types';
import { IDaofinClientMethods } from '../interfaces';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
} from '@xinfin/osx-daofin-contracts-ethers';

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
    console.log({ settings });

    if (!settings) return null;
    return {
      allowedAmounts: settings.allowedAmounts,
      xdcValidator: settings.xdcValidator,
    };
  }
  getDaofin(daoAddressOrEns: string): Promise<DaofinDetails> {
    throw new Error('not implemented');
  }
  getVotingSettings(addressOrEns: string): Promise<GlobalSettings> {
    return this.getGlobalSettings(addressOrEns);
  }
}
