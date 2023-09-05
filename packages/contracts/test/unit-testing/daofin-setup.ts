import {PLUGIN_SETUP_CONTRACT_NAME} from '../../plugin-settings';
import buildMetadata from '../../src/build-metadata.json';
import {
  DAO,
  DaofinPlugin,
  DaofinPluginSetup,
  DaofinPluginSetup__factory,
  DaofinPlugin__factory,
} from '../../typechain';
import {deployTestDao} from '../helpers/test-dao';
import {getNamedTypesFromMetadata} from '../helpers/types';
import {
  ADDRESS_ONE,
  ADDRESS_ZERO,
  EXECUTE_PERMISSION_ID,
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  UPDATE_COMMITTEES_LIST_PERMISSION_ID,
  UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION_ID,
  UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION_ID,
  UPDATE_ELECTION_PERIOD_PERMISSION_ID,
  UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
  XdcValidator,
  abiCoder,
} from './daofin-common';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {expect} from 'chai';
import {parseEther} from 'ethers/lib/utils';
import {ethers} from 'hardhat';

describe(PLUGIN_SETUP_CONTRACT_NAME, function () {
  let signers: SignerWithAddress[];
  let daofinPluginSetup: DaofinPluginSetup;
  let DaofinPluginSetup: DaofinPluginSetup__factory;
  let dao: DAO;
  let initializeParams: Parameters<DaofinPlugin['initialize']>;
  let initData: string;

  before(async () => {
    signers = await ethers.getSigners();
    dao = await deployTestDao(signers[0]);

    DaofinPluginSetup = new DaofinPluginSetup__factory(signers[0]);
    daofinPluginSetup = await DaofinPluginSetup.deploy();

    initializeParams = [
      dao.address,
      [parseEther('10000')],
      XdcValidator,
      [
        {
          name: MasterNodeCommittee,
          minDuration: 1,
          minParticipation: 1,
          minVotingPower: 1,
          supportThreshold: 1,
        },
        {
          name: JudiciaryCommittee,
          minDuration: 1,
          minParticipation: 1,
          minVotingPower: 1,
          supportThreshold: 1,
        },
        {
          name: PeoplesHouseCommittee,
          minDuration: 1,
          minParticipation: 1,
          minVotingPower: 1,
          supportThreshold: 1,
        },
      ],
      [Date.now()],
      [ADDRESS_ONE],
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
        UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION_ID,
        UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION_ID,
        UPDATE_ELECTION_PERIOD_PERMISSION_ID,
        UPDATE_COMMITTEES_LIST_PERMISSION_ID,
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
        EXECUTE_PERMISSION_ID,
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
        UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION_ID,
        UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION_ID,
        UPDATE_ELECTION_PERIOD_PERMISSION_ID,
        UPDATE_COMMITTEES_LIST_PERMISSION_ID,
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
        EXECUTE_PERMISSION_ID,
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
