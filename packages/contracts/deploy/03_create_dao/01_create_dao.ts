import DaoData from '../../dao-initial-data.json';
import {DaofinPluginSetupParams} from '../../plugin-settings';
import {ADDRESS_ZERO} from '../../test/unit-testing/daofin-common';
import {XDCValidator__factory} from '../../typechain';
import {
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  encodePlugin,
  getPluginInfo,
} from '../../utils/helpers';
import {uploadToIPFS} from '../../utils/ipfs';
import {
  DAOFactory,
  DAOFactory__factory,
  DAORegistry__factory,
  PluginRepo__factory,
  PluginSetupProcessor__factory,
  activeContractsList,
} from '@xinfin/osx-ethers';
import {PermissionIds} from '@xinfin/osx-sdk-client';
import {
  bytesToHex,
  decodeRatio,
  encodeRatio,
  hexToBytes,
} from '@xinfin/osx-sdk-common';
import {BigNumber, BigNumberish} from 'ethers';
import {id, parseEther, toUtf8Bytes} from 'ethers/lib/utils';
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
        daoParams.masterNodeVotingSettings.minVotingPower,
      ],
      [
        PeoplesHouseCommittee,
        daoParams.peoplesHouseVotingSettings.supportThreshold,
        daoParams.peoplesHouseVotingSettings.minParticipation,
        daoParams.peoplesHouseVotingSettings.minVotingPower,
      ],
      [
        JudiciaryCommittee,
        daoParams.judiciaryVotingSettings.supportThreshold,
        daoParams.judiciaryVotingSettings.minParticipation,
        daoParams.judiciaryVotingSettings.minVotingPower,
      ],
    ],
    [
      [
        MasterNodeCommittee,
        daoParams.masterNodeVotingSettings.supportThreshold,
        daoParams.masterNodeVotingSettings.minParticipation,
        daoParams.masterNodeVotingSettings.minVotingPower,
      ],
      [
        PeoplesHouseCommittee,
        daoParams.peoplesHouseVotingSettings.supportThreshold,
        daoParams.peoplesHouseVotingSettings.minParticipation,
        daoParams.peoplesHouseVotingSettings.minVotingPower,
      ],
      [
        JudiciaryCommittee,
        daoParams.judiciaryVotingSettings.supportThreshold,
        daoParams.judiciaryVotingSettings.minParticipation,
        daoParams.judiciaryVotingSettings.minVotingPower,
      ],
    ],
    [
      Math.floor(new Date().getTime() / 1000) + 60 * 1000 * 60,
      Math.floor(new Date().getTime() / 1000) + 60 * 1000 * 80,
    ],
    daoParams.judiciaryList,
    parseEther('1'),
  ];
  const plugins = [
    {
      data: hexToBytes(encodePlugin(params, METADATA)),
      id: pluginInfo[network].address,
    },
  ];
  console.log({
    key: 'Plugin',
    pluginRepoAddress: pluginInfo[network].address,
  });

  if (
    daoParams.daoEnsSubDomain &&
    !daoParams.daoEnsSubDomain.match(/^[a-z0-9\-]+$/)
  ) {
    throw new Error();
  }

  const daoFactoryInstance = DAOFactory__factory.connect(
    daoFactoryAddress,
    deployer
  );

  const pluginInstallationData: DAOFactory.PluginSettingsStruct[] = [];
  for (const plugin of plugins) {
    const repo = PluginRepo__factory.connect(plugin.id, deployer);

    const currentRelease = await repo.latestRelease();
    const latestVersion = await repo['getLatestVersion(uint8)'](currentRelease);
    pluginInstallationData.push({
      pluginSetupRef: {
        pluginSetupRepo: repo.address,
        versionTag: latestVersion.tag,
      },
      data: plugin.data,
    });
  }

  // check if at least one plugin requests EXECUTE_PERMISSION on the DAO
  // This check isn't 100% correct all the time
  // simulate the DAO creation to get an address
  const pluginSetupProcessorAddr =
    await daoFactoryInstance.pluginSetupProcessor();
  const pluginSetupProcessor = PluginSetupProcessor__factory.connect(
    pluginSetupProcessorAddr,
    deployer
  );
  let execPermissionFound = false;

  // using the DAO base because it reflects a newly created DAO the best
  const daoBaseAddr = await daoFactoryInstance.daoBase();
  // simulates each plugin installation seperately to get the requested permissions
  for (const installData of pluginInstallationData) {
    const pluginSetupProcessorResponse =
      await pluginSetupProcessor.callStatic.prepareInstallation(
        daoBaseAddr,
        installData
      );
    const found = pluginSetupProcessorResponse[1].permissions.find(
      permission =>
        permission.permissionId === PermissionIds.EXECUTE_PERMISSION_ID
    );

    if (found) {
      execPermissionFound = true;
      break;
    }
  }

  if (!execPermissionFound) {
    throw new Error();
  }

  const tx = await daoFactoryInstance.connect(deployer).createDao(
    {
      subdomain: daoParams.daoEnsSubDomain,
      metadata: toUtf8Bytes(metadataUri),
      daoURI: '',
      trustedForwarder: ADDRESS_ZERO,
    },
    pluginInstallationData
  );
  console.log({
    key: 'CREATING',
    txHash: tx.hash,
  });

  // start tx
  const receipt = await tx.wait();
  const daoFactoryInterface = DAORegistry__factory.createInterface();

  // find dao address using the dao registry address
  const log = receipt.logs?.find(
    e =>
      e.topics[0] ===
      id(daoFactoryInterface.getEvent('DAORegistered').format('sighash'))
  );

  if (!log) {
    throw new Error();
  }

  // Plugin logs
  const pspInterface = PluginSetupProcessor__factory.createInterface();
  const installedLogs = receipt.logs?.filter(
    e =>
      e.topics[0] ===
      id(pspInterface.getEvent('InstallationApplied').format('sighash'))
  );

  // DAO logs
  const parsedLog = daoFactoryInterface.parseLog(log);
  if (!parsedLog.args['dao']) {
    throw new Error();
  }
  console.log({
    key: 'DONE',
    address: parsedLog.args['dao'],
    pluginAddresses: installedLogs.map(
      log => pspInterface.parseLog(log).args[1]
    ),
  });
  console.log(network);

  if (network === 'apothem' || network === 'anvil') {
    const validatorContract = XDCValidator__factory.connect(
      XDCMasterNodeTestingAddress,
      deployer
    );

    for (let i = 0; i < daoParams.dummyMasterNodeAddresses.length; i++) {
      const address = daoParams.dummyMasterNodeAddresses[i];
      console.log({address});

      const isExist = await validatorContract.isCandidate(address);
      console.log('XDCValidatorMock', `${address} : ${isExist}`);

      if (isExist) return;
      const tx = await validatorContract.addCandidate(address);
      console.log('XDCValidatorMock', `${address} : ${tx.hash}`);

      await tx.wait();
    }
  }
};

export default func;
func.tags = [];
