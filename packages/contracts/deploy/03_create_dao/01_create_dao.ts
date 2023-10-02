import {
  DAO_ENS_SUB_DOMAIN,
  METADATA,
  PLUGIN_REPO_ENS_NAME,
  PLUGIN_SETUP_CONTRACT_NAME,
  XdcValidator,
} from '../../plugin-settings';
import {getPluginInfo} from '../../utils/helpers';
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
import {deployments, ethers, network} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

export type DaofinPluginInstall = {
  globalSettings: {
    xdcValidator: string;
    amounts: BigNumberish[];
  };
  committeeSettings: any[];
  electionPeriods: BigNumberish[];
};
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await hre.ethers.getSigners();
  const network = process.env.NETWORK_NAME
    ? process.env.NETWORK_NAME
    : hre.network.name;

  const contextParams: ContextParams = {
    // @ts-ignore
    daoFactoryAddress: activeContractsList[network].DAOFactory,
    network: {
      name: network,
      chainId: hre.network.config.chainId ? hre.network.config.chainId : 0,
    },
    signer: deployer ?? undefined,
    // @ts-ignore
    web3Providers: hre.network.config.url,
    ipfsNodes: [
      {
        url: process.env.IPFS_URL as string,
        headers: {
          Authorization: `Basic ${Buffer.from(
            process.env.IPFS_API_KEY + ':' + process.env.IPFS_API_SECRET
          ).toString('base64')}`,
        },
      },
    ],
    // @ts-ignore
    ensRegistryAddress: activeContractsList[network].ENSRegistry,
    graphqlNodes: [{url: process.env.GRAPH_NODE_URL as string}],
  };

  const context = new Context(contextParams);
  const client = new Client(context);

  const installedPluginParams: DaofinPluginInstall = {
    globalSettings: {
      xdcValidator: XdcValidator,
      amounts: [parseEther('1').toString(), parseEther('2').toString()],
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
      BigNumber.from(Date.now().toString()),
      BigNumber.from((Date.now() + 60 * 1000 * 60).toString()),
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
      Math.floor(new Date().getTime() / 1000),
      Math.floor(new Date().getTime() / 1000) + 60 * 1000 * 60,
    ],
    [deployer.address],
  ];
  const metadata: DaoMetadata = {
    name: 'benytesting003-1-5',
    description: 'This is Hello description',
    avatar: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2634.png',
    links: [],
  };
  const pluginInfo = getPluginInfo(network);

  const createDaoParams: CreateDaoParams = {
    metadataUri: '0x00',
    ensSubdomain: DAO_ENS_SUB_DOMAIN, // my-org.dao.eth
    plugins: [
      {
        data: hexToBytes(
          defaultAbiCoder.encode(
            getNamedTypesFromMetadata(
              // @ts-ignore
              METADATA.build.pluginSetup.prepareInstallation.inputs
            ),
            params
          )
        ),
        id: pluginInfo[network].address,
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
