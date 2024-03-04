import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
  MockTimestampOracle,
  MockTimestampOracle__factory,
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
  let MockTimestampOracle: MockTimestampOracle__factory;
  let mockTimestampOracle: MockTimestampOracle;
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
    MockTimestampOracle = new MockTimestampOracle__factory(Alice);
    mockTimestampOracle = await MockTimestampOracle.deploy();

    await xdcValidatorMock.addCandidate(Bob.address);
    await xdcValidatorMock.addCandidate(Mike.address);
  });

  beforeEach(async () => {
    daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);
    const now = (await mockTimestampOracle.getUint64Timestamp()).toNumber();

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
        BigNumber.from(now + 60 * 60 * 24 * 3),
        BigNumber.from(now + 60 * 60 * 24 * 5),
      ],
      [Alice.address],
      parseEther('1'),
    ];
    await daofinPlugin.initialize(...initializeParams);
  });
  describe('Join to Master Node Delegatee Sentate', async () => {
    it('must not revert', async () => {
      const delegatee = John.address;
      const masterNode = Bob;
      await expect(
        daofinPlugin
          .connect(masterNode)
          .updateOrJoinMasterNodeDelegatee(delegatee)
      ).not.reverted;
    });
    it('mapping must not accept same addresses twice', async () => {
      const masterNode = Bob;
      const delegatee = John.address;

      await daofinPlugin
        .connect(masterNode)
        .updateOrJoinMasterNodeDelegatee(delegatee);

      await expect(
        daofinPlugin
          .connect(masterNode)
          .updateOrJoinMasterNodeDelegatee(delegatee)
      ).reverted;
    });
    it('number must be increased', async () => {
      const masterNode = Bob;
      const delegatee = John.address;

      const beforeCount = (await daofinPlugin._masterNodeDelegatee())
        .numberOfJointMasterNodes;
      await daofinPlugin
        .connect(masterNode)
        .updateOrJoinMasterNodeDelegatee(delegatee);

      const afterCount = (await daofinPlugin._masterNodeDelegatee())
        .numberOfJointMasterNodes;
      expect(beforeCount.add(1)).be.eq(afterCount);
    });

    it('delegatee must not be zero address', async () => {
      const masterNode = Bob;
      const delegatee = ADDRESS_ZERO;

      await expect(
        daofinPlugin
          .connect(masterNode)
          .updateOrJoinMasterNodeDelegatee(delegatee)
      ).reverted;
    });

    it('master Node must not be a valid candidate', async () => {
      const masterNode = Beny;
      const delegatee = John.address;

      await expect(
        daofinPlugin
          .connect(masterNode)
          .updateOrJoinMasterNodeDelegatee(delegatee)
      ).reverted;
    });

    it('delegatee must not be part of Jury', async () => {
      const juryMember = Alice.address;
      const masterNode = Bob;
      const delegatee = juryMember;
      await expect(
        daofinPlugin
          .connect(masterNode)
          .updateOrJoinMasterNodeDelegatee(delegatee)
      ).reverted;
    });
    it('delegatee must not be part of People house', async () => {
      const peopleHouseMember = Beny;

      await daofinPlugin.connect(Beny).joinHouse({value: parseEther('1')});

      const masterNode = Bob;
      const delegatee = peopleHouseMember.address;
      await expect(
        daofinPlugin
          .connect(masterNode)
          .updateOrJoinMasterNodeDelegatee(delegatee)
      ).reverted;
    });

    it('master node must not change delegatee within election period', async () => {
      const masterNode = Bob;
      const delegatee = John.address;

      await daofinPlugin
        .connect(masterNode)
        .updateOrJoinMasterNodeDelegatee(delegatee);

      await advanceTime(ethers, convertDaysToSeconds(4));

      const newDelegatee = Beny.address;

      await expect(
        daofinPlugin
          .connect(masterNode)
          .updateOrJoinMasterNodeDelegatee(newDelegatee)
      ).be.reverted;
    });

    it('master node can change delegatee out of election periods', async () => {
      const masterNode = Bob;
      const delegatee = John.address;

      await daofinPlugin
        .connect(masterNode)
        .updateOrJoinMasterNodeDelegatee(delegatee);

      await advanceTime(ethers, convertDaysToSeconds(2));

      const newDelegatee = Beny.address;

      await expect(
        daofinPlugin
          .connect(masterNode)
          .updateOrJoinMasterNodeDelegatee(newDelegatee)
      ).not.reverted;
    });
  });
});
