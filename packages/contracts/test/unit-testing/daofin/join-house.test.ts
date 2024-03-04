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
  createCommitteeVotingSettings,
  createProposalParams,
} from '../../helpers/utils';
import {
  ADDRESS_ONE,
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
import {ethers} from 'hardhat';

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
        Math.floor(new Date().getTime() / 1000),
        Math.floor(new Date().getTime() / 1000) + 60 * 1000 * 60,
      ],
      [ADDRESS_ONE],
      parseEther('1'),
    ];
    await daofinPlugin.initialize(...initializeParams);
  });
  describe('Join House', async () => {
    it('must not revert', async () => {
      const value = parseEther('2');
      await expect(daofinPlugin.joinHouse({value})).not.reverted;
    });
    it('_voterToLockedAmounts must be set', async () => {
      const from = Alice;
      const value = parseEther('2');

      const daoBalanceBefore = await ethers.provider.getBalance(dao.address);

      await daofinPlugin.joinHouse({value});

      const voterInfo = await daofinPlugin._voterToLockedAmounts(from.address);

      expect(voterInfo.amount).eq(value);
      expect(voterInfo.isActive).eq(true);

      const daoBalanceAfter = await ethers.provider.getBalance(dao.address);

      expect(daoBalanceAfter).eq(daoBalanceBefore.add(daoBalanceBefore));
    });
    it('increase amount(double call)', async () => {
      const from = Alice;
      const value = parseEther('2');

      for (let i = 0; i < 2; i++) {
        const daoBalanceBefore = await ethers.provider.getBalance(dao.address);

        const voterInfoBefore = await daofinPlugin._voterToLockedAmounts(
          from.address
        );
        await daofinPlugin.joinHouse({value});

        const voterInfoAfter = await daofinPlugin._voterToLockedAmounts(
          from.address
        );

        expect(voterInfoAfter.amount).eq(voterInfoBefore.amount.add(value));
        expect(voterInfoAfter.isActive).to.true;

        const daoBalanceAfter = await ethers.provider.getBalance(dao.address);

        expect(daoBalanceAfter).eq(daoBalanceBefore.add(value));
      }
    });
  });
});
