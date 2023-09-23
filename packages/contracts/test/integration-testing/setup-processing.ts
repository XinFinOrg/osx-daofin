import {METADATA} from '../../plugin-settings';
import {
  DaofinPlugin,
  DaofinPluginSetup,
  DaofinPluginSetup__factory,
  DaofinPlugin__factory,
  PluginRepo,
} from '../../typechain';
import {PluginSetupRefStruct} from '../../typechain/@xinfin/osx/framework/plugin/setup/PluginSetupProcessor';
import {getPluginInfo, osxContracts} from '../../utils/helpers';
import {initializeFork} from '../helpers/fixture';
import {installPLugin, uninstallPLugin} from '../helpers/setup';
import {deployTestDao} from '../helpers/test-dao';
import {getNamedTypesFromMetadata} from '../helpers/types';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {
  DAO,
  PluginRepo__factory,
  PluginSetupProcessor,
  PluginSetupProcessor__factory,
} from '@xinfin/osx-ethers';
import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {ethers, network} from 'hardhat';

describe('PluginSetup Processing', function () {
  let signers: SignerWithAddress[];

  let psp: PluginSetupProcessor;
  let dao: DAO;
  let pluginRepo: PluginRepo;

  before(async () => {
    signers = await ethers.getSigners();

    const hardhatForkNetwork = process.env.NETWORK_NAME
      ? process.env.NETWORK_NAME
      : network.name;

    await initializeFork(
      hardhatForkNetwork,
      getPluginInfo(hardhatForkNetwork)[hardhatForkNetwork]['releases']['1'][
        'builds'
      ]['1']['blockNumberOfPublication']
    );

    // PSP
    psp = PluginSetupProcessor__factory.connect(
      osxContracts[hardhatForkNetwork]['PluginSetupProcessor'],
      signers[0]
    );

    // Deploy DAO.
    dao = await deployTestDao(signers[0]);

    await dao.grant(
      dao.address,
      psp.address,
      ethers.utils.id('ROOT_PERMISSION')
    );
    await dao.grant(
      psp.address,
      signers[0].address,
      ethers.utils.id('APPLY_INSTALLATION_PERMISSION')
    );
    await dao.grant(
      psp.address,
      signers[0].address,
      ethers.utils.id('APPLY_UNINSTALLATION_PERMISSION')
    );
    await dao.grant(
      psp.address,
      signers[0].address,
      ethers.utils.id('APPLY_UPDATE_PERMISSION')
    );

    pluginRepo = PluginRepo__factory.connect(
      getPluginInfo(hardhatForkNetwork)[hardhatForkNetwork].address,
      signers[0]
    );
  });

  context('Build 1', async () => {
    let setup: DaofinPluginSetup;
    let pluginSetupRef: PluginSetupRefStruct;
    let plugin: DaofinPlugin;

    before(async () => {
      // Deploy setups.
      setup = DaofinPluginSetup__factory.connect(
        (await pluginRepo['getLatestVersion(uint8)'](1)).pluginSetup,
        signers[0]
      );

      pluginSetupRef = {
        versionTag: {
          release: BigNumber.from(1),
          build: BigNumber.from(1),
        },
        pluginSetupRepo: pluginRepo.address,
      };
    });

    beforeEach(async () => {
      // Install build 1.

      const results = await installPLugin(
        psp,
        dao,
        pluginSetupRef,
        ethers.utils.defaultAbiCoder.encode(
          getNamedTypesFromMetadata(
            METADATA.build.pluginSetup.prepareInstallation.inputs
          ),
          []
        )
      );

      plugin = DaofinPlugin__factory.connect(
        results.preparedEvent.args.plugin,
        signers[0]
      );
    });

    it('installs & uninstalls', async () => {
      // Check implementation.
      expect(await plugin.implementation()).to.be.eq(
        await setup.implementation()
      );

      // Uninstall build 1.
      await uninstallPLugin(
        psp,
        dao,
        plugin,
        pluginSetupRef,
        ethers.utils.defaultAbiCoder.encode(
          getNamedTypesFromMetadata(
            METADATA.build.pluginSetup.prepareUnInstallation.inputs
          ),
          []
        ),
        []
      );
    });
  });
});
