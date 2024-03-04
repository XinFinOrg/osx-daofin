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
    const now = Math.floor(new Date().getTime() / 1000);

    initializeParams = [
      dao.address,
      parseEther('1'),
      XdcValidator,
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
        BigNumber.from(now + 60 * 60 * 24 * 3),
        BigNumber.from(now + 60 * 60 * 24 * 5),
        BigNumber.from(now + 60 * 60 * 24 * 6),
        BigNumber.from(now + 60 * 60 * 24 * 8),
      ],
      [ADDRESS_ONE],
      '1',
    ];
    await daofinPlugin.initialize(...initializeParams);
  });
  describe('create proposal', async () => {
    it('must not revert', async () => {
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '0',
        '0',
        '0',
        '0'
      );
      createPropsalParams[6] = {value: initializeParams[7].toString()};

      expect(await daofinPlugin.proposalCount()).to.be.eq(BigNumber.from('0'));
      expect(await daofinPlugin.proposalCount()).to.not.be.eq(
        BigNumber.from('1')
      );

      await daofinPlugin.createProposal('0x00', [], '0', '0', '0', '0', {
        value: '1',
      });

      expect(await daofinPlugin.proposalCount()).to.not.be.eq(
        BigNumber.from('0')
      );
      expect(await daofinPlugin.proposalCount()).to.be.eq(BigNumber.from('1'));
    });
    it('proposalType must be set', async () => {
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '1',
        '0',
        '0'
      );
      createPropsalParams[6] = {value: initializeParams[7].toString()};

      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      await expect(daofinPlugin.createProposal(...createPropsalParams)).to.not
        .reverted;
      expect(
        (await daofinPlugin.getProposal(proposalId)).proposalTypeId
      ).to.be.eq('1');
      expect(await daofinPlugin.proposalCount()).to.be.eq('1');
    });
    it('proposalCost must be charged', async () => {
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '1',
        '0',
        '0'
      );
      createPropsalParams[6] = {value: initializeParams[7].toString()};

      const daoBalanceBefore = await ethers.provider.getBalance(dao.address);

      await daofinPlugin.createProposal(...createPropsalParams);
      const daoBalanceAfter = await ethers.provider.getBalance(dao.address);

      expect(daoBalanceAfter).to.be.greaterThan(daoBalanceBefore);

      const isValid = daoBalanceAfter.eq(
        daoBalanceBefore.add(initializeParams[7].toString())
      );
      expect(isValid).to.be.true;
    });
    it('must not be within voting session', async () => {
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '0',
        '0',
        '0',
        '0'
      );
      await advanceTime(ethers, convertDaysToSeconds(4));
      await expect(daofinPlugin.createProposal(...createPropsalParams)).to.be
        .reverted;
    });
  });
});
