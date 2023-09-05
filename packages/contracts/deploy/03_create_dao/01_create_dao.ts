import {GasFeeEstimation} from '@xinfin/osx-client-common';
import {SupportedNetwork} from '@xinfin/osx-client-common';
import {
  MetadataAbiInput,
  getNamedTypesFromMetadata,
} from '@xinfin/osx-client-common';
import {activeContractsList} from '@xinfin/osx-ethers';
import {
  Client,
  Context,
  ContextParams,
  CreateDaoParams,
  DaoCreationSteps,
  DaoMetadata,
} from '@xinfin/osx-sdk-client';
import {PermissionIds} from '@xinfin/osx-sdk-client';
import {
  bytesToHex,
  decodeRatio,
  encodeRatio,
  hexToBytes,
} from '@xinfin/osx-sdk-common';
import {BigNumber, BigNumberish} from 'ethers';
import {defaultAbiCoder, parseEther} from 'ethers/lib/utils';
import {ethers, network} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

export type DaofinPluginInstall = {
  globalSettings: {
    xdcValidator: string;
    amounts: BigNumberish[];
  };
  committeeSettings: any[];
  electionPeriods: string[];
};
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
    internalType: 'uint64[]',
    name: 'electionPeriod_',
    type: 'uint64[]',
    description: '',
  },
  {
    internalType: 'address[]',
    name: 'judiciaries_',
    type: 'address[]',
    description: '',
  },
];
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await hre.ethers.getSigners();

  const network = hre.network.name as SupportedNetwork;
  const contextParams: ContextParams = {
    daoFactoryAddress: activeContractsList[network].daoFactory,
    network: {
      name: hre.network.name,
      chainId: hre.network.config.chainId ? hre.network.config.chainId : 0,
    },
    signer: deployer ?? undefined,
    web3Providers: hre.network.config.url,
    ipfsNodes: [
      {
        url: `https://ipfs.infura.io:5001/api/v0`,
        headers: {
          Authorization: `Basic ${Buffer.from(
            process.env.IPFS_API_KEY + ':' + process.env.IPFS_API_SECRET
          ).toString('base64')}`,
        },
      },
    ],
    ensRegistryAddress: activeContractsList[hre.network.name].ensRegistry,
    graphqlNodes: [
      {url: 'http://localhost:8000/subgraphs/name/xinfin-osx-apothem'},
    ],
  };

  const context = new Context(contextParams);
  const client = new Client(context);
  const a = JSON.stringify({name: 'beny'});
  console.log(a);

  const installedPluginParams: DaofinPluginInstall = {
    globalSettings: {
      xdcValidator: '0x33d5e357b66d41F059777E9086245a878697458f',
      amounts: [parseEther('1000').toString()],
    },
    committeeSettings: [
      [
        ethers.utils.solidityKeccak256(['string'], ['MasterNodeCommittee']),
        '1000',
        '10',
        '1000',
        '1000',
      ],
    ],
    electionPeriods: [
      Date.now().toString(),
      (Date.now() + 60 * 1000 * 60).toString(),
    ],
  };

  const {committeeSettings, electionPeriods, globalSettings} =
    installedPluginParams;
  const {amounts, xdcValidator} = globalSettings;
  const params = [
    amounts,
    xdcValidator,
    [
      [
        ethers.utils.solidityKeccak256(['string'], ['MasterNodeCommittee']),
        BigNumber.from('100'),
        BigNumber.from('100'),
        BigNumber.from('100'),
        BigNumber.from('100'),
      ],
    ],
    [
      BigNumber.from(Date.now().toString()),
      BigNumber.from((Date.now() + 60 * 1000 * 60).toString()),
    ],
    [deployer.address],
  ];
  const metadata: DaoMetadata = {
    name: 'benytesting003-1-5',
    description: 'This is Hello description',
    avatar: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2634.png',
    links: [],
  };
  // console.log(await client.ipfs.add(JSON.stringify(metadata)));

  // Through pinning the metadata in IPFS, we can get the IPFS URI. You can read more about it here: https://docs.ipfs.tech/how-to/pin-files/
  // const metadataUri = await client.methods.pinMetadata(metadata);

  const createDaoParams: CreateDaoParams = {
    metadataUri: '0x00',
    ensSubdomain: 'benytesting003-1-50', // my-org.dao.eth
    plugins: [
      {
        data: hexToBytes(
          defaultAbiCoder.encode(
            getNamedTypesFromMetadata(INSTALLATION_ABI),
            params
          )
        ),
        id: '0x4AB1FE1E980f58457fE3C7e8fC07d56b6C881062',
      },
    ], // plugin array cannot be empty or the transaction will fail. you need at least one governance mechanism to create your DAO.
  };

  // Estimate how much gas the transaction will cost.
  const estimatedGas: GasFeeEstimation = await client.estimation.createDao(
    createDaoParams
  );
  console.log({avg: estimatedGas.average, maximum: estimatedGas.max});

  // Create the DAO.
  const steps = client.methods.createDao(createDaoParams);
  for await (const step of steps) {
    try {
      switch (step.key) {
        case DaoCreationSteps.CREATING:
          console.log({txHash: step.txHash});
          break;
        case DaoCreationSteps.DONE:
          console.log({
            daoAddress: step.address,
            pluginAddresses: step.pluginAddresses,
          });
          break;
      }
    } catch (err) {
      console.error(err);
    }
  }
};

export default func;
func.tags = [];
