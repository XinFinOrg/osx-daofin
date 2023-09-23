import {PLUGIN_SETUP_CONTRACT_NAME} from '../../plugin-settings';
import {
  DaofinPlugin,
  DaofinPluginSetup,
  DaofinPluginSetup__factory,
  PluginRepo,
} from '../../typechain';
import {getPluginInfo, osxContracts} from '../../utils/helpers';
import {toHex} from '../../utils/ipfs';
import {PluginRepoRegistry__factory} from '@aragon/osx-ethers';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {PluginRepoRegistry} from '@xinfin/osx-ethers';
import {PluginRepo__factory} from '@xinfin/osx-ethers';
import {expect} from 'chai';
import {deployments, ethers} from 'hardhat';

let signers: SignerWithAddress[];
let repoRegistry: PluginRepoRegistry;
let pluginRepo: PluginRepo;

async function deployAll() {
  await deployments.fixture([PLUGIN_SETUP_CONTRACT_NAME, 'Deployment']);
}

describe('PluginRepo Deployment', function () {
  const hardhatForkNetwork = process.env.NETWORK_NAME
    ? process.env.NETWORK_NAME
    : 'mainnet';
  before(async () => {
    signers = await ethers.getSigners();

    // Deploymen should be empty
    expect(await deployments.all()).to.be.empty;

    // Deploy all contracts
    await deployAll();

    // Print info
    console.log(
      JSON.stringify(
        getPluginInfo(hardhatForkNetwork)[hardhatForkNetwork],
        null,
        2
      )
    );

    // plugin repo registry
    repoRegistry = PluginRepoRegistry__factory.connect(
      osxContracts[hardhatForkNetwork]['PluginRepoRegistry'],
      signers[0]
    );

    pluginRepo = PluginRepo__factory.connect(
      getPluginInfo(hardhatForkNetwork)[hardhatForkNetwork].address,
      signers[0]
    );
  });

  it('creates the repo', async () => {
    expect(await repoRegistry.entries(pluginRepo.address)).to.be.true;
  });

  it('makes the deployer the repo maintainer', async () => {
    expect(
      await pluginRepo.isGranted(
        pluginRepo.address,
        signers[0].address,
        ethers.utils.id('ROOT_PERMISSION'),
        ethers.constants.AddressZero
      )
    ).to.be.true;

    expect(
      await pluginRepo.isGranted(
        pluginRepo.address,
        signers[0].address,
        ethers.utils.id('UPGRADE_REPO_PERMISSION'),
        ethers.constants.AddressZero
      )
    ).to.be.true;

    expect(
      await pluginRepo.isGranted(
        pluginRepo.address,
        signers[0].address,
        ethers.utils.id('MAINTAINER_PERMISSION'),
        ethers.constants.AddressZero
      )
    ).to.be.true;
  });

  context('PluginSetup Publication', async () => {
    let setup: DaofinPluginSetup;

    before(async () => {
      setup = DaofinPluginSetup__factory.connect(
        (await deployments.get('DaofinPluginSetup')).address,
        signers[0]
      );
    });
    it('registerd the setup', async () => {
      const results = await pluginRepo['getVersion((uint8,uint16))']({
        release: 1,
        build: 1,
      });
      expect(results.pluginSetup).to.equal(setup.address);
      expect(results.buildMetadata).to.equal(
        toHex('ipfs://QmY919VZ9gkeF6L169qQo89ucsUB9ScTaJVbGn8vMGGHxr')
      );
    });
  });
});
