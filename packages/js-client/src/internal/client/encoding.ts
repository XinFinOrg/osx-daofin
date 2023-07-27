import { IDaofinClientEncoding } from '../interfaces';
import { defaultAbiCoder } from '@ethersproject/abi';
import { Networkish, getNetwork } from '@ethersproject/providers';
import {
  ClientCore,
  LIVE_CONTRACTS,
  PluginInstallItem,
  SupportedNetwork,
  SupportedNetworksArray,
  getNamedTypesFromMetadata,
} from '@xinfin/osx-client-common';
import { hexToBytes } from '@xinfin/osx-sdk-common';

export class DaofinClientEncoding
  extends ClientCore
  implements IDaofinClientEncoding
{
  static getPluginInstallItem(
    params: any,
    network: Networkish
  ): PluginInstallItem {
    const networkName = getNetwork(network).name as SupportedNetwork;
    if (!SupportedNetworksArray.includes(networkName)) {
      throw new Error(networkName);
    }
    const hexBytes = defaultAbiCoder.encode([], []);
    return {
      id: 'pluginRepo',
      data: hexToBytes(hexBytes),
    };
  }
}
