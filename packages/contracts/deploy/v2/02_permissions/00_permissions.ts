import DaoData from '../../../dao-initial-data.json';
import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {
  ADDRESS_ZERO,
  CREATE_PROPOSAL_TYPE_PERMISSION_ID,
  EXECUTE_PERMISSION_ID,
  MODIFY_PROPOSAL_TYPE_PERMISSION_ID,
  ROOT_PERMISSION_ID,
  UPDATE_ELECTION_PERIOD_PERMISSION_ID,
  UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
  UPDATE_MIN_HOUSE_AMOUNT_PERMISSION_ID,
  UPDATE_PROPOSAL_COSTS_PERMISSION_ID,
  UPGRADE_PLUGIN_PERMISSION_ID,
} from '../../../test/unit-testing/daofin-common';
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

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await hre.ethers.getSigners();
  const network = process.env.NETWORK_NAME
    ? process.env.NETWORK_NAME
    : hre.network.name;

  const deployments = readJsonFile();
  if (!deployments) return;
  const daoAddress = deployments[network].daoAddress;
  const daofinAddress = deployments[network].pluginAddress;
  if (!deployments) return;
  const daofin = (await ethers.getContractAt(
    'DaofinPlugin',
    daofinAddress
  )) as DaofinPlugin;

  const dao = (await ethers.getContractAt('DAO', daoAddress)) as DAO;

  const isRoot = await dao.hasPermission(
    dao.address,
    deployer.address,
    ROOT_PERMISSION_ID,
    new Uint8Array()
  );
  console.log(isRoot);
  const allPermissions = {
    admin: [
      UPDATE_MIN_HOUSE_AMOUNT_PERMISSION_ID,
      UPDATE_ELECTION_PERIOD_PERMISSION_ID,
      UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
      CREATE_PROPOSAL_TYPE_PERMISSION_ID,
      UPDATE_PROPOSAL_COSTS_PERMISSION_ID,
      MODIFY_PROPOSAL_TYPE_PERMISSION_ID,
      UPGRADE_PLUGIN_PERMISSION_ID,
    ],
    dao: [EXECUTE_PERMISSION_ID],
  };
  for (const per of allPermissions.admin) {
    const hasPermission = await dao.hasPermission(
      daofin.address,
      deployer.address,
      per,
      new Uint8Array()
    );
    if (hasPermission) continue;
    const res = await dao.grant(daofin.address, deployer.address, per);
    await res.wait();
    console.log(
      await dao.hasPermission(
        daofin.address,
        deployer.address,
        per,
        new Uint8Array()
      ),
      daofin.address,
      deployer.address,
      per
    );
  }
  for (const per of allPermissions.dao) {
    const hasPermission = await dao.hasPermission(
      dao.address,
      daofin.address,
      per,
      new Uint8Array()
    );
    if (hasPermission) continue;
    const res = await dao.grant(dao.address, daofin.address, per);
    await res.wait();
    console.log(
      await dao.hasPermission(
        dao.address,
        daofin.address,
        per,
        new Uint8Array()
      ),
      dao.address,
      daofin.address,
      per
    );
  }

  // console.log((await tx.wait()).transactionHash);

  // (await daofin.updateAllowedAmounts(parseEther('2'))).wait();
};

export default func;
func.tags = [];
