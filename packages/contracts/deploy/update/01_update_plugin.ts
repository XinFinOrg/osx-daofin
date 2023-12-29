import {DaofinPluginSetupParams} from '../../plugin-settings';
import {
  findEventTopicLog,
  addDeployedRepo as addCreatedRepo,
  getPluginRepoFactoryAddress,
} from '../../utils/helpers';
import {uploadToIPFS} from '../../utils/ipfs';
import {
  PluginRepoFactory__factory,
  PluginRepoRegistry__factory,
  PluginRepo__factory,
} from '@xinfin/osx-ethers';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {PLUGIN_REPO_ENS_NAME, PLUGIN_SETUP_CONTRACT_NAME, METADATA} =
    DaofinPluginSetupParams;
  console.log(`\nDeploying the "${PLUGIN_REPO_ENS_NAME}" plugin repo`);

  const {network, ethers, deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);

  await deploy(PLUGIN_SETUP_CONTRACT_NAME, {
    from: deployer,
    args: [],
    log: true,
  });

  const releaseCIDPath = await uploadToIPFS(JSON.stringify(METADATA.release));
  const buildCIDPath = await uploadToIPFS(JSON.stringify(METADATA.build));

  // Get the PluginRepoFactory address
  const pluginRepoFactoryAddr: string = getPluginRepoFactoryAddress(
    network.name
  );
  const pluginRepoFactory = PluginRepoRegistry__factory.connect(
    pluginRepoFactoryAddr,
    signer
  );
  //   pluginRepoFactory.

  const pluginRepo = PluginRepo__factory.connect(pluginRepoFactoryAddr, signer);
  //   pluginRepo['getLatestVersion(uint8)']()
};

export default func;
func.tags = ['Plugin', 'Deployment'];
