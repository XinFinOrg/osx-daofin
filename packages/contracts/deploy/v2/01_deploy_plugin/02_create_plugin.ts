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

  // @ts-ignore
  const daoFactoryAddress = activeContractsList[network].DAOFactory;
  // @ts-ignore
  const daoParams = DaoData[network];
  const avatarUri = `ipfs://${await uploadToIPFS(
    daoParams.metadata.avatar,
    false
  )}`;

  const metadataUri = `ipfs://${await uploadToIPFS(
    JSON.stringify({
      ...daoParams.metadata,
      avatar: avatarUri,
    }),
    false
  )}`;

  const pluginInfo = getPluginInfo(network);

  const params = [
    parseEther(daoParams.amounts),
    daoParams.xdcValidatorAddress,
    [
      [
        MasterNodeCommittee,
        daoParams.masterNodeVotingSettings.supportThreshold,
        daoParams.masterNodeVotingSettings.minParticipation,
      ],
      [
        PeoplesHouseCommittee,
        daoParams.peoplesHouseVotingSettings.supportThreshold,
        daoParams.peoplesHouseVotingSettings.minParticipation,
      ],
      [
        JudiciaryCommittee,
        daoParams.judiciaryVotingSettings.supportThreshold,
        daoParams.judiciaryVotingSettings.minParticipation,
      ],
    ],
    [
      [
        MasterNodeCommittee,
        daoParams.masterNodeVotingSettings.supportThreshold,
        daoParams.masterNodeVotingSettings.minParticipation,
      ],
      [
        PeoplesHouseCommittee,
        daoParams.peoplesHouseVotingSettings.supportThreshold,
        daoParams.peoplesHouseVotingSettings.minParticipation,
      ],
      [
        JudiciaryCommittee,
        daoParams.judiciaryVotingSettings.supportThreshold,
        daoParams.judiciaryVotingSettings.minParticipation,
      ],
    ],
    [
      // 1st
      BigNumber.from(Math.floor(new Date().getTime() / 1000) + 60 * 15),
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 5
      ),
      // 2nd
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 5
      ),
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 7
      ),
      // 3rd
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 7
      ),
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 9
      ),
      // 4th
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 9
      ),
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 11
      ),
      // 5th
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 13
      ),
      BigNumber.from(
        Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24 * 15
      ),
    ],
    daoParams.judiciaryList,
    parseEther('1'),
  ];
  console.log(deployer.address);
  const data = readJsonFile();
  if (!data) return;

  data[network].daoAddress;
  const daoAddress = data[network].daoAddress;
  console.log(`Using ${daoAddress}...`);

  let factory = data[network].factory;
  let daofinFactoryContract;
  if (!factory) {
    const daofinFactory = await ethers.getContractFactory(
      'DaofinPluginFactory'
    );
    let daofinFactoryAddress = await (await daofinFactory.deploy()).deployed();
    factory = daofinFactoryAddress.address;
    const data = readJsonFile();
    if (!data) return;
    data[network].factory = factory;
    writeJsonFile(data);
  }
  daofinFactoryContract = await ethers.getContractAt(
    'DaofinPluginFactory',
    factory
  );

  const staticCall = await daofinFactoryContract.callStatic.prepareInstallation(
    daoAddress,
    hexToBytes(encodePlugin(params, METADATA))
  );
  const tx = await daofinFactoryContract.prepareInstallation(
    daoAddress,
    hexToBytes(encodePlugin(params, METADATA))
  );
  const res = await tx.wait();
  console.log('Hash:', res.hash);

  const daofin = (await ethers.getContractAt(
    'DaofinPlugin',
    staticCall[1]
  )) as DaofinPlugin;

  const deployments = readJsonFile();
  if (!deployments) return;
  deployments[network].pluginAddress = staticCall[1];
  writeJsonFile(deployments);
  console.log(await daofin.getElectionPeriods());
};

export default func;
func.tags = [];
