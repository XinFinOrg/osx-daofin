import DaoData from '../../../dao-initial-data.json';
import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {ADDRESS_ZERO} from '../../../test/unit-testing/daofin-common';
import {
  DaofinPlugin,
  DaofinPluginFactory,
  DaofinPluginFactory__factory,
  DaofinPlugin__factory,
} from '../../../typechain';
import {
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  encodePlugin,
  getPluginInfo,
  readJsonFile,
  writeJsonFile,
} from '../../../utils/helpers';
import {uploadToIPFS} from '../../../utils/ipfs';
import {makeForceImport} from '@openzeppelin/hardhat-upgrades/dist/force-import';
import {deploy} from '@openzeppelin/hardhat-upgrades/dist/utils';
import {DAO, DAO__factory, activeContractsList} from '@xinfin/osx-ethers';
import {hexToBytes} from '@xinfin/osx-sdk-common';
import {BigNumber, BigNumberish} from 'ethers';
import {id, parseEther, toUtf8Bytes} from 'ethers/lib/utils';
import {ethers, upgrades} from 'hardhat';
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

  const {METADATA, XDCMasterNodeTestingAddress} = DaofinPluginSetupParams;

  const data = readJsonFile();
  if (!data) return;

  const daoAddress = data[network].daoAddress;
  console.log(`Using ${daoAddress}...`);

  let factory = data[network].factory;
  let daofinFactoryContract;

  daofinFactoryContract = await ethers.getContractAt(
    'DaofinPluginFactory',
    factory
  );

  const pluginAddress = data[network].pluginAddress;

  const daofin = (await ethers.getContractAt(
    'DaofinPlugin',
    pluginAddress
  )) as DaofinPlugin;
  const oldImpl = await daofin.implementation();
  console.log({oldImpl});

  const f = (await ethers.getContractFactory(
    'DaofinPlugin'
  )) as DaofinPlugin__factory;
  console.log('old', daofin.address);

  const fDeploy = await f.deploy();
  const newImpl = await fDeploy.deployed();
  await (await daofin.upgradeTo(newImpl.address)).wait();

  console.log('new', daofin.address);
  const newImpl2 = await daofin.implementation();
  console.log({newImpl2});
  console.log(await daofin.EXECUTION_DELAY_BLOCK_END());
};

export default func;
func.tags = [];
