import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
  XDCValidator,
} from '../../../typechain';
import {deployWithProxy} from '../../../utils/helpers';
import {deployTestDao} from '../../helpers/test-dao';
import {deployXDCValidator} from '../../helpers/test-xdc-validator';
import {
  advanceTime,
  convertDaysToSeconds,
  createCommitteeVotingSettings,
  createProposalParams,
} from '../../helpers/utils';
import {
  ADDRESS_ONE,
  ADDRESS_ZERO,
  CREATE_PROPOSAL_TYPE_PERMISSION_ID,
  JudiciaryCommittee,
  MODIFY_PROPOSAL_TYPE_PERMISSION_ID,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
  XdcValidator,
} from '../daofin-common';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {DAO, RatioTest, RatioTest__factory} from '@xinfin/osx-ethers';
import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {parseEther} from 'ethers/lib/utils';
import {ethers, network} from 'hardhat';

const {PLUGIN_CONTRACT_NAME} = DaofinPluginSetupParams;

describe(PLUGIN_CONTRACT_NAME, function () {
  let signers: SignerWithAddress[];
  let dao: DAO;
  let DaofinPlugin: DaofinPlugin__factory;
  let daofinPlugin: DaofinPlugin;
  let initializeParams: Parameters<DaofinPlugin['initialize']>;
  let createPropsalParams: Parameters<DaofinPlugin['createProposal']>;
  let Alice: SignerWithAddress;
  let Bob: SignerWithAddress;
  let Mike: SignerWithAddress;
  let John: SignerWithAddress;
  let Beny: SignerWithAddress;
  let xdcValidatorMock: XDCValidator;
  let ratio: RatioTest;
  before(async () => {
    signers = await ethers.getSigners();
    Alice = signers[0];
    Bob = signers[1];
    Mike = signers[2];
    John = signers[3];
    Beny = signers[4];

    dao = await deployTestDao(Alice);

    DaofinPlugin = new DaofinPlugin__factory(Alice);

    const RatioTest = new RatioTest__factory(Alice);
    ratio = await RatioTest.deploy();

    xdcValidatorMock = await deployXDCValidator(Alice);

    await xdcValidatorMock.addCandidate(Bob.address);
    await xdcValidatorMock.addCandidate(Mike.address);
  });

  beforeEach(async () => {
    daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);
    const now = Math.floor(new Date().getTime() / 1000);

    initializeParams = [
      dao.address,
      parseEther('1'),
      xdcValidatorMock.address,
      [
        createCommitteeVotingSettings(
          MasterNodeCommittee,
          '400000',
          '200000',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          PeoplesHouseCommittee,
          '900000',
          '400000',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          JudiciaryCommittee,
          '700000',
          '300000',
          parseEther('1')
        ),
      ],
      [
        createCommitteeVotingSettings(
          MasterNodeCommittee,
          '100000',
          '100000',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          PeoplesHouseCommittee,
          '100000',
          '100000',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          JudiciaryCommittee,
          '100000',
          '100000',
          parseEther('1')
        ),
      ],
      [
        BigNumber.from(now + 60 * 60 * 24 * 3),
        BigNumber.from(now + 60 * 60 * 24 * 5),
      ],
      [Bob.address],
      parseEther('1'),
    ];
    await daofinPlugin.initialize(...initializeParams);
    await dao.grant(
      daofinPlugin.address,
      Alice.address,
      CREATE_PROPOSAL_TYPE_PERMISSION_ID
    );
    await dao.grant(
      daofinPlugin.address,
      Alice.address,
      MODIFY_PROPOSAL_TYPE_PERMISSION_ID
    );
  });
  describe('Create ProposalType', async () => {
    it('proposal type count', async () => {
      const before = await daofinPlugin.proposalTypeCount();
      await expect(
        daofinPlugin.createProposalType([
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '100000',
            '100000',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '100000',
            '100000',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '100000',
            '100000',
            parseEther('1')
          ),
        ])
      ).to.not.reverted;
      const after = await daofinPlugin.proposalTypeCount();

      expect(before.add(1)).eq(after);
    });
    it('create Proposal Type', async () => {
      const before = await daofinPlugin.proposalTypeCount();
      await expect(
        daofinPlugin.createProposalType([
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '100000',
            '100000',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '100000',
            '100000',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '100000',
            '100000',
            parseEther('1')
          ),
        ])
      ).to.not.reverted;
      const after = await daofinPlugin.proposalTypeCount();

      expect(before.add(1)).eq(after);
    });
  });
  describe('Modify ProposalType', async () => {
    it('Modify Proposal Type', async () => {
      const before = await daofinPlugin.proposalTypeCount();
      const proposalType = '1';

      await expect(
        daofinPlugin.modifyProposalType(proposalType, [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '500000',
            '600000',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '700000',
            '900000',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '300000',
            '200000',
            parseEther('1')
          ),
        ])
      ).not.reverted;

      const after = await daofinPlugin.proposalTypeCount();
      expect(before).eq(after);

      const jurySettingsAfter =
        await daofinPlugin.getCommitteesToVotingSettings(
          proposalType,
          JudiciaryCommittee
        );
      expect(jurySettingsAfter.minParticipation).equal(300000);
      expect(jurySettingsAfter.supportThreshold).equal(200000);

      const mnSettingsAfter = await daofinPlugin.getCommitteesToVotingSettings(
        proposalType,
        MasterNodeCommittee
      );
      expect(mnSettingsAfter.minParticipation).equal(500000);
      expect(mnSettingsAfter.supportThreshold).equal(600000);

      const peopleSettingsAfter =
        await daofinPlugin.getCommitteesToVotingSettings(
          proposalType,
          PeoplesHouseCommittee
        );
      expect(peopleSettingsAfter.minParticipation).equal(700000);
      expect(peopleSettingsAfter.supportThreshold).equal(900000);
    });
  });
});
