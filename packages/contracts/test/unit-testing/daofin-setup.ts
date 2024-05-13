import {DaofinPluginSetupParams} from '../../plugin-settings';
import buildMetadata from '../../src/build-metadata.json';
import {
  DAO,
  DaofinPlugin,
  DaofinPluginSetup,
  DaofinPluginSetup__factory,
  XDCValidator,
} from '../../typechain';
import {deployTestDao} from '../helpers/test-dao';
import {getNamedTypesFromMetadata} from '../helpers/types';
import {createCommitteeVotingSettings} from '../helpers/utils';
import {
  ADDRESS_ZERO,
  CREATE_PROPOSAL_TYPE_PERMISSION_ID,
  EXECUTE_PERMISSION_ID,
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  UPDATE_MIN_HOUSE_AMOUNT_PERMISSION_ID,
  UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
  UPDATE_PROPOSAL_COSTS_PERMISSION_ID,
  abiCoder,
  UPDATE_ELECTION_PERIOD_PERMISSION_ID,
  MODIFY_PROPOSAL_TYPE_PERMISSION_ID,
} from './daofin-common';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {expect} from 'chai';
import {BigNumber, providers} from 'ethers';
import {parseEther} from 'ethers/lib/utils';
import {ethers} from 'hardhat';

const {PLUGIN_SETUP_CONTRACT_NAME} = DaofinPluginSetupParams;

describe(PLUGIN_SETUP_CONTRACT_NAME, function () {
  let signers: SignerWithAddress[];
  let daofinPluginSetup: DaofinPluginSetup;
  let DaofinPluginSetup: DaofinPluginSetup__factory;
  let dao: DAO;
  let initializeParams: Parameters<DaofinPlugin['initialize']>;
  let initData: string;

  before(async () => {
    signers = await ethers.getSigners();

    let Alice = signers[0];

    DaofinPluginSetup = new DaofinPluginSetup__factory(Alice);
    daofinPluginSetup = await DaofinPluginSetup.deploy();

    dao = await deployTestDao(Alice);

    const now = Math.floor(new Date().getTime() / 1000);
    initializeParams = [
      dao.address,
      parseEther('1'),
      ADDRESS_ZERO,
      [
        createCommitteeVotingSettings(MasterNodeCommittee, '0', '0', '1'),
        createCommitteeVotingSettings(PeoplesHouseCommittee, '0', '0', '1'),
        createCommitteeVotingSettings(JudiciaryCommittee, '0', '0', '1'),
      ],
      [
        createCommitteeVotingSettings(MasterNodeCommittee, '0', '0', '1'),
        createCommitteeVotingSettings(PeoplesHouseCommittee, '0', '0', '1'),
        createCommitteeVotingSettings(JudiciaryCommittee, '0', '0', '1'),
      ],
      [
        BigNumber.from(now + 60 * 60 * 24 * 3),
        BigNumber.from(now + 60 * 60 * 24 * 5),
      ],
      [Alice.address],
      '1',
    ];
  });

  describe('prepareInstallation', async () => {
    before(async () => {
      initData = abiCoder.encode(
        getNamedTypesFromMetadata(
          buildMetadata.pluginSetup.prepareInstallation.inputs
        ),
        initializeParams.slice(1)
      );
    });
    it('call prepareInstallation', async () => {
      expect(
        daofinPluginSetup.callStatic.prepareInstallation(dao.address, initData)
      ).not.reverted;
    });
    it('check prepareInstallation plugin address', async () => {
      const preparedData =
        await daofinPluginSetup.callStatic.prepareInstallation(
          dao.address,
          initData
        );

      expect(preparedData.plugin).to.be.properAddress;
    });
    it('check all prepareInstallation permissions', async () => {
      const preparedData =
        await daofinPluginSetup.callStatic.prepareInstallation(
          dao.address,
          initData
        );
      const allPermissions = [
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
        UPDATE_ELECTION_PERIOD_PERMISSION_ID,
        UPDATE_MIN_HOUSE_AMOUNT_PERMISSION_ID,
        EXECUTE_PERMISSION_ID,
        CREATE_PROPOSAL_TYPE_PERMISSION_ID,
        UPDATE_PROPOSAL_COSTS_PERMISSION_ID,
        MODIFY_PROPOSAL_TYPE_PERMISSION_ID,
      ];
      expect(preparedData.preparedSetupData.permissions.length).be.eq(
        allPermissions.length
      );
      for (const permission of preparedData.preparedSetupData.permissions) {
        if (allPermissions.includes(permission.permissionId)) {
          expect(permission.operation).be.eq(0);
          expect(permission.condition).be.eq(ADDRESS_ZERO);

          if (permission.permissionId === EXECUTE_PERMISSION_ID) {
            expect(permission.who).be.eq(preparedData.plugin);
            expect(permission.where).be.eq(dao.address);
          } else {
            expect(permission.where).be.eq(preparedData.plugin);
            expect(permission.who).be.eq(dao.address);
          }
        }
      }
    });
  });

  describe('prepareUninstallation', async () => {
    before(async () => {
      initData = abiCoder.encode(
        getNamedTypesFromMetadata(
          buildMetadata.pluginSetup.prepareInstallation.inputs
        ),
        initializeParams.slice(1)
      );
    });

    it('call prepareUninstallation', async () => {
      const preparedData =
        await daofinPluginSetup.callStatic.prepareInstallation(
          dao.address,
          initData
        );
      expect(
        daofinPluginSetup.callStatic.prepareUninstallation(dao.address, {
          currentHelpers: [],
          data: '0x0',
          plugin: preparedData.plugin,
        })
      ).not.reverted;
    });

    it('check all prepareUninstallation permissions must be Revoked', async () => {
      const preparedData =
        await daofinPluginSetup.callStatic.prepareInstallation(
          dao.address,
          initData
        );
      const allPermissions = [
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
        UPDATE_ELECTION_PERIOD_PERMISSION_ID,
        UPDATE_MIN_HOUSE_AMOUNT_PERMISSION_ID,
        EXECUTE_PERMISSION_ID,
        CREATE_PROPOSAL_TYPE_PERMISSION_ID,
        UPDATE_PROPOSAL_COSTS_PERMISSION_ID,
      ];

      expect(preparedData.preparedSetupData.permissions.length).be.eq(
        allPermissions.length
      );
      for (const permission of preparedData.preparedSetupData.permissions) {
        if (allPermissions.includes(permission.permissionId)) {
          expect(permission.operation).be.eq(0);
          expect(permission.condition).be.eq(ADDRESS_ZERO);

          if (permission.permissionId === EXECUTE_PERMISSION_ID) {
            expect(permission.who).be.eq(preparedData.plugin);
            expect(permission.where).be.eq(dao.address);
          } else {
            expect(permission.where).be.eq(preparedData.plugin);
            expect(permission.who).be.eq(dao.address);
          }
        }
      }
    });
  });
});
