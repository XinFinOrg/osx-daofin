import { DaofinPluginCore } from '../../core';
import { IDaofinClientEncoding } from '../interfaces';
import { defaultAbiCoder } from '@ethersproject/abi';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { Networkish, getNetwork } from '@ethersproject/providers';
import {
  ClientCore,
  LIVE_CONTRACTS,
  PluginInstallItem,
  SupportedNetwork,
  SupportedNetworksArray,
  getNamedTypesFromMetadata,
} from '@xinfin/osx-client-common';
import { MetadataAbiInput } from '@xinfin/osx-client-common';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
} from '@xinfin/osx-daofin-contracts-ethers';
import { daofinActiveContracts } from '@xinfin/osx-daofin-contracts-ethers';
import { hexToBytes } from '@xinfin/osx-sdk-common';

export const INSTALLATION_ABI: MetadataAbiInput[] = [
  {
    internalType: 'uint256[]',
    name: 'allowedAmounts_',
    type: 'uint256[]',
    description: '',
  },
  {
    internalType: 'address',
    name: 'xdcValidatorContract_',
    type: 'address',
    description: '',
  },
  {
    components: [
      {
        internalType: 'bytes32',
        name: 'name',
        type: 'bytes32',
        description: '',
      },
      {
        internalType: 'uint32',
        name: 'supportThreshold',
        type: 'uint32',
        description: '',
      },
      {
        internalType: 'uint32',
        name: 'minParticipation',
        type: 'uint32',
        description: '',
      },
      {
        internalType: 'uint64',
        name: 'minDuration',
        type: 'uint64',
        description: '',
      },
      {
        internalType: 'uint256',
        name: 'minVotingPower',
        type: 'uint256',
        description: '',
      },
    ],
    internalType: 'struct DaofinPlugin.CommitteeVotingSettings[]',
    name: 'detailedSettings_',
    type: 'tuple[]',
    description: '',
  },
  {
    components: [
      {
        internalType: 'uint64',
        name: 'startDate',
        type: 'uint64',
        description: '',
      },
      {
        internalType: 'uint64',
        name: 'endDate',
        type: 'uint64',
        description: '',
      },
    ],
    internalType: 'struct DaofinPlugin.ElectionPeriod[]',
    name: 'electionPeriod_',
    type: 'tuple[]',
    description: '',
  },
];
export class DaofinClientEncoding
  extends DaofinPluginCore
  implements IDaofinClientEncoding
{
  static getPluginInstallItem(
    params: any,
    network: Networkish
  ): PluginInstallItem {
    const networkName = network as SupportedNetwork;
    if (!SupportedNetworksArray.includes(networkName)) {
      throw new Error(networkName);
    }

    const hexBytes = defaultAbiCoder.encode(
      getNamedTypesFromMetadata(INSTALLATION_ABI),
      params
    );

    return {
      id: daofinActiveContracts[networkName].address,
      data: hexToBytes(hexBytes),
    };
  }
}
