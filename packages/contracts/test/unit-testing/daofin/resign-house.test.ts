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
  EXECUTE_PERMISSION_ID,
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
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
  });

  beforeEach(async () => {
    daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);

    initializeParams = [
      dao.address,
      parseEther('1'),
      xdcValidatorMock.address,
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
        Math.floor(new Date().getTime() / 1000) + 60 * 1000 * 60,
        Math.floor(new Date().getTime() / 1000) + 60 * 2000 * 60,
      ],
      [ADDRESS_ONE],
      parseEther('1'),
    ];
    await daofinPlugin.initialize(...initializeParams);
  });
  describe('Resign House', async () => {
    it('must not revert', async () => {
      const from = Alice;

      const value = parseEther('2');

      await daofinPlugin.joinHouse({value});

      await expect(daofinPlugin.resignHouse()).not.reverted;
    });
    it('request must be created', async () => {
      const from = Alice;

      const value = parseEther('2');

      await daofinPlugin.joinHouse({value});

      await daofinPlugin.resignHouse();

      const voterInfo = await daofinPlugin._voterToLockedAmounts(from.address);

      expect(voterInfo.isActive).to.be.false;
      expect(voterInfo.startOfCooldownPeriod).not.be.eq('0');
      expect(voterInfo.endOfCooldownPeriod).not.be.eq('0');
    });

    it('must execute proposal after cooldown', async () => {
      const from = Alice;

      const value = parseEther('2');

      await daofinPlugin.joinHouse({value});

      await daofinPlugin.connect(from).resignHouse();

      const days = 8;
      await advanceTime(ethers, convertDaysToSeconds(days));
      await dao.grant(dao.address, daofinPlugin.address, EXECUTE_PERMISSION_ID);

      await daofinPlugin.connect(from).executeResignHouse();
      const voterInfo = await daofinPlugin._voterToLockedAmounts(from.address);

      expect(voterInfo.isActive).to.be.false;
      expect(voterInfo.amount).to.be.eq(BigNumber.from(0));
      expect(voterInfo.startOfCooldownPeriod.toString()).be.eq('0');
      expect(voterInfo.endOfCooldownPeriod.toString()).be.eq('0');
    });
    it('amount must deducted on DAO', async () => {
      const from = Alice;

      const value = parseEther('2');

      await daofinPlugin.joinHouse({value});

      const daoBalanceBefore = await ethers
        .getDefaultProvider()
        .getBalance(dao.address);
      await daofinPlugin.connect(from).resignHouse();

      const days = 8;
      await advanceTime(ethers, convertDaysToSeconds(days));
      await dao.grant(dao.address, daofinPlugin.address, EXECUTE_PERMISSION_ID);

      await daofinPlugin.connect(from).executeResignHouse();

      const daoBalanceAfter = await ethers
        .getDefaultProvider()
        .getBalance(dao.address);
      expect(daoBalanceAfter).lessThanOrEqual(daoBalanceBefore);

      const voterInfo = await daofinPlugin._voterToLockedAmounts(from.address);

      expect(voterInfo.isActive).to.be.false;
      expect(voterInfo.amount).to.be.eq(BigNumber.from(0));
      expect(voterInfo.startOfCooldownPeriod.toString()).be.eq('0');
      expect(voterInfo.endOfCooldownPeriod.toString()).be.eq('0');

      await expect(daofinPlugin.connect(from).executeResignHouse()).to.be
        .reverted;
    });
    it('must delete states', async () => {
      const from = Alice;

      const value = parseEther('2');

      await daofinPlugin.joinHouse({value});

      await daofinPlugin.connect(from).resignHouse();

      const days = 8;
      await advanceTime(ethers, convertDaysToSeconds(days));
      await dao.grant(dao.address, daofinPlugin.address, EXECUTE_PERMISSION_ID);

      await daofinPlugin.connect(from).executeResignHouse();

      const voterInfo = await daofinPlugin._voterToLockedAmounts(from.address);

      expect(voterInfo.isActive).to.be.false;
      expect(voterInfo.amount).to.be.eq(BigNumber.from(0));
      expect(voterInfo.startOfCooldownPeriod.toString()).be.eq('0');
      expect(voterInfo.endOfCooldownPeriod.toString()).be.eq('0');
    });
    it('must not execute more that once', async () => {
      const from = Alice;

      const value = parseEther('2');

      await daofinPlugin.joinHouse({value});

      await daofinPlugin.connect(from).resignHouse();

      const days = 8;
      await advanceTime(ethers, convertDaysToSeconds(days));

      await dao.grant(dao.address, daofinPlugin.address, EXECUTE_PERMISSION_ID);

      await expect(daofinPlugin.connect(from).executeResignHouse()).to.not
        .reverted;
      await expect(daofinPlugin.connect(from).executeResignHouse()).to.reverted;
    });
  });
});
