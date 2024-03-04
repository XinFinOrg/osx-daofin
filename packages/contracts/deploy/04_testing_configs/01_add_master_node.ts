import DaoData from '../../dao-initial-data-internal-demo.json';
import {DaofinPluginSetupParams} from '../../plugin-settings';
import {XDCValidator__factory} from '../../typechain';
import {BigNumberish} from 'ethers';
import {ethers} from 'hardhat';
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
  console.log('Adding MasterNodes...');

  const [deployer] = await hre.ethers.getSigners();
  const network = process.env.NETWORK_NAME
    ? process.env.NETWORK_NAME
    : hre.network.name;

  const {METADATA, XDCMasterNodeTestingAddress} = DaofinPluginSetupParams;
  // @ts-ignore
  const daoParams = DaoData[network];

  if (network === 'apothem' || network === 'anvil') {
    const validatorContract = await ethers.getContractAt(
      'XDCValidator',
      daoParams['xdcValidatorAddress']
    );
    for (const address of daoParams['dummyMasterNodeAddresses']) {
      const isExist = await validatorContract.isCandidate(address);

      if (!isExist) {
        const tx = await validatorContract.addCandidate(address);
        console.log('XDCValidatorMock', `${address} : ${tx.hash}`);
        await tx.wait();
      } else {
        console.log(`${address}`);
      }
    }
  }
};

export default func;
func.tags = [];
