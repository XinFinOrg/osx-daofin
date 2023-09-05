import { DaofinPluginContext } from './context';
import { DaofinContextParams } from './types';
import { ClientCore } from '@xinfin/osx-client-common';

export class DaofinPluginCore extends ClientCore {
  public pluginAddress: string;
  public pluginRepoAddress: string;

  constructor(pluginContext: DaofinPluginContext) {
    super(pluginContext);
    this.pluginAddress = pluginContext.pluginAddress;
    this.pluginRepoAddress = pluginContext.pluginRepoAddress;
  }
}
