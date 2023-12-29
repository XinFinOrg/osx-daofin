import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {
  findEventTopicLog,
  addDeployedRepo as addCreatedRepo,
  getPluginRepoFactoryAddress,
} from '../../../utils/helpers';
import {
  PluginRepoFactory__factory,
  PluginRepoRegistry__factory,
  PluginRepo__factory,
} from '@xinfin/osx-ethers';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {PLUGIN_REPO_ENS_NAME} = DaofinPluginSetupParams;
  console.log(`\nDeploying the "${PLUGIN_REPO_ENS_NAME}" plugin repo`);

  const {network, ethers, deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);

  // Get the PluginRepoFactory address
  const pluginRepoFactoryAddr: string = getPluginRepoFactoryAddress(
    network.name
  );
  // const pluginRepoFactory = PluginRepoFactory__factory.connect(
  //   pluginRepoFactoryAddr,
  //   signer
  // );

  const pluginRepoFactory = await ethers.getContractAt(
    'PluginRepoFactory',
    pluginRepoFactoryAddr
  );

  // Create the PluginRepo
  const tx = await pluginRepoFactory.createPluginRepo(
    PLUGIN_REPO_ENS_NAME,
    deployer
  );

  const eventLog = await findEventTopicLog(
    tx,
    PluginRepoRegistry__factory.createInterface(),
    'PluginRepoRegistered'
  );
  if (!eventLog) {
    throw new Error('Failed to get PluginRepoRegistered event log');
  }

  const pluginRepo = PluginRepo__factory.connect(
    eventLog.args.pluginRepo,
    signer
  );

  const blockNumberOfDeployment = (await tx.wait()).blockNumber;

  console.log(
    `"${PLUGIN_REPO_ENS_NAME}" PluginRepo deployed at: ${pluginRepo.address} at block ${blockNumberOfDeployment}.`
  );

  // Store the information
  addCreatedRepo(
    network.name,
    PLUGIN_REPO_ENS_NAME,
    pluginRepo.address,
    [],
    blockNumberOfDeployment
  );
};

export default func;
func.tags = ['PluginRepo', 'Deployment'];
