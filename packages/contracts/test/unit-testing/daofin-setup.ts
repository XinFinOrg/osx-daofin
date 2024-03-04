import {DaofinPluginSetupParams} from '../../plugin-settings';
import buildMetadata from '../../src/build-metadata.json';
import {
  DAO,
  DaofinPlugin,
  DaofinPluginSetup,
  DaofinPluginSetup__factory,
  DaofinPlugin__factory,
  XDCValidator,
} from '../../typechain';
import {deployTestDao} from '../helpers/test-dao';
import {deployXDCValidator} from '../helpers/test-xdc-validator';
import {getNamedTypesFromMetadata} from '../helpers/types';
import {createCommitteeVotingSettings} from '../helpers/utils';
import {
  ADDRESS_ONE,
  ADDRESS_ZERO,
  CREATE_PROPOSAL_TYPE_PERMISSION_ID,
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

const {PLUGIN_SETUP_CONTRACT_NAME} = DaofinPluginSetupParams;
describe(PLUGIN_SETUP_CONTRACT_NAME, function () {
  let signers: SignerWithAddress[];
  let daofinPluginSetup: DaofinPluginSetup;
  let DaofinPluginSetup: DaofinPluginSetup__factory;
  let dao: DAO;
  let initializeParams: Parameters<DaofinPlugin['initialize']>;
  let initData: string;
  let Alice: SignerWithAddress;
  let xdcValidatorMock: XDCValidator;

  before(async () => {
    signers = await ethers.getSigners();
    dao = await deployTestDao(signers[0]);
    let Alice = signers[0];
    DaofinPluginSetup = new DaofinPluginSetup__factory(Alice);
    daofinPluginSetup = await DaofinPluginSetup.deploy();
    xdcValidatorMock = await deployXDCValidator(Alice);
    initializeParams = [
      dao.address,
      parseEther('1'),
      xdcValidatorMock.address,
      [
        createCommitteeVotingSettings(
          MasterNodeCommittee,
          '0',
          '0',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          PeoplesHouseCommittee,
          '0',
          '0',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          JudiciaryCommittee,
          '0',
          '0',
          parseEther('1')
        ),
      ],
      [
        createCommitteeVotingSettings(
          MasterNodeCommittee,
          '0',
          '0',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          PeoplesHouseCommittee,
          '0',
          '0',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          JudiciaryCommittee,
          '0',
          '0',
          parseEther('1')
        ),
      ],
      [Math.floor(Date.now() / 1000)],
      [Alice.address],
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
        CREATE_PROPOSAL_TYPE_PERMISSION_ID,
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
        CREATE_PROPOSAL_TYPE_PERMISSION_ID,
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
