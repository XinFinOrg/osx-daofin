import DaoData from '../../../dao-initial-data.json';
import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {ADDRESS_ZERO} from '../../../test/unit-testing/daofin-common';
import {DaofinPlugin__factory} from '../../../typechain';
import {
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  getPluginInfo,
  readJsonFile,
  writeJsonFile,
} from '../../../utils/helpers';
import {uploadToIPFS} from '../../../utils/ipfs';
import {deploy} from '@openzeppelin/hardhat-upgrades/dist/utils';
import {DAO, DAO__factory, activeContractsList} from '@xinfin/osx-ethers';
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
      BigNumber.from(Math.floor(new Date().getTime() / 1000) + 60 * 60 * 24),
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

  const daoFactory = await ethers.getContractFactory('DAO');

  const daoInitParam = ['0x', deployer.address, deployer.address, '0x'];
  const daoDeployment = await upgrades.deployProxy(daoFactory, daoInitParam, {
    kind: 'uups',
    initializer: 'initialize',
    unsafeAllow: ['constructor'],
  });

  const daoReciept = await daoDeployment.deployed();

  console.log(daoReciept.address);

  const dao = (await ethers.getContractAt('DAO', daoReciept.address)) as DAO;

  console.log(await dao.getTrustedForwarder());

  const data = readJsonFile();
  if (!data) return;
  data[network].daoAddress = daoReciept.address;
  writeJsonFile(data);
};

export default func;
func.tags = [];
