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
  ADDRESS_TWO,
  ADDRESS_ZERO,
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  UPDATE_JUDICIARY_MAPPING_PERMISSION_ID,
  UPDATE_PROPOSAL_COSTS_PERMISSION_ID,
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
  let MockTimestampOracle: MockTimestampOracle__factory;
  let mockTimestampOracle: MockTimestampOracle;
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

    MockTimestampOracle = new MockTimestampOracle__factory(Alice);
    mockTimestampOracle = await MockTimestampOracle.deploy();
  });

  beforeEach(async () => {
    xdcValidatorMock = await deployXDCValidator(Alice);

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
        BigNumber.from(now + 60 * 60 * 24 * 12),
      ],
      [],
      '1',
    ];
    await daofinPlugin.initialize(...initializeParams);

    await daofinPlugin.joinHouse({value: parseEther('1')});
  });
  describe('Sync validator snapshot count', async () => {
    it('snapshot must be updated', async () => {
      const snapshotBefore = await daofinPlugin.masternodeCountSnapshot();

      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_ONE);
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_TWO);
      await xdcValidatorMock.connect(John).addCandidate(Bob.address);
      await xdcValidatorMock.connect(Mike).addCandidate(Alice.address);

      const syncStaticCall =
        await daofinPlugin.callStatic.syncXdcValidatorSnapshot();
      expect(syncStaticCall).be.true;
      await daofinPlugin.syncXdcValidatorSnapshot();

      const snapshotAfter = await daofinPlugin.masternodeCountSnapshot();
      expect(snapshotAfter).be.eq(BigNumber.from('4'));
    });
    it('must revert if its within voting period', async () => {
      await advanceTime(ethers, convertDaysToSeconds(4));
      const snapshotBefore = await daofinPlugin.masternodeCountSnapshot();

      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_ONE);
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_TWO);
      await xdcValidatorMock.connect(John).addCandidate(Bob.address);
      await xdcValidatorMock.connect(Mike).addCandidate(Alice.address);

      await expect(daofinPlugin.syncXdcValidatorSnapshot()).be.reverted;
    });
  });

  describe('Validator getWeight()', async () => {
    it('must return the exact size of candidates number of an owner', async () => {
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_ONE);
      expect(await daofinPlugin.getMnWeight(John.address)).be.eq(1);

      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_TWO);
      await xdcValidatorMock.connect(John).addCandidate(Bob.address);
      expect(await daofinPlugin.getMnWeight(John.address)).be.eq(3);

      expect(await daofinPlugin.getMnWeight(Mike.address)).be.eq(0);
      await xdcValidatorMock.connect(Mike).addCandidate(Alice.address);
      expect(await daofinPlugin.getMnWeight(Mike.address)).be.eq(1);
    });
  });

  describe('SyncXDCValidator', async () => {
    it('must delete the existing master node delegate', async () => {
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_ONE);

      await daofinPlugin
        .connect(John)
        .updateOrJoinMasterNodeDelegatee(Bob.address);

      await xdcValidatorMock.connect(John).removeCandidate(ADDRESS_ONE);

      expect(await daofinPlugin.isMasterNodeDelegatee(Bob.address)).be.true;
      await daofinPlugin.syncWithXdcValidator(John.address);
      expect(await daofinPlugin.isMasterNodeDelegatee(Bob.address)).be.false;
    });
    it('must adjust voting power', async () => {
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_ONE);

      await daofinPlugin
        .connect(John)
        .updateOrJoinMasterNodeDelegatee(Bob.address);

      const weightBefore = await daofinPlugin.mnToWeights(Bob.address);
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_TWO);

      await daofinPlugin.syncWithXdcValidator(John.address);

      expect(await daofinPlugin.isMasterNodeDelegatee(Bob.address)).be.true;

      const weightAfter = await daofinPlugin.mnToWeights(Bob.address);

      expect(weightAfter).be.eq(2);
    });
    it('must decrease voting power', async () => {
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_ONE);

      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_TWO);
      await daofinPlugin
        .connect(John)
        .updateOrJoinMasterNodeDelegatee(Bob.address);

      const weightBefore = await daofinPlugin.mnToWeights(Bob.address);
      expect(weightBefore).be.eq(2);
      await xdcValidatorMock.connect(John).removeCandidate(ADDRESS_TWO);
      await daofinPlugin.syncWithXdcValidator(John.address);

      expect(await daofinPlugin.isMasterNodeDelegatee(Bob.address)).be.true;

      const weightAfter = await daofinPlugin.mnToWeights(Bob.address);

      expect(weightAfter).be.eq(1);
    });
    it('no changes :)', async () => {
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_ONE);

      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_TWO);
      await daofinPlugin
        .connect(John)
        .updateOrJoinMasterNodeDelegatee(Bob.address);

      const weightBefore = await daofinPlugin.mnToWeights(Bob.address);
      expect(weightBefore).be.eq(2);
      await daofinPlugin.syncWithXdcValidator(John.address);

      expect(await daofinPlugin.isMasterNodeDelegatee(Bob.address)).be.true;

      const weightAfter = await daofinPlugin.mnToWeights(Bob.address);

      expect(weightAfter).be.eq(2);
    });

    it('must revert if its within voting period', async () => {
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_ONE);

      await daofinPlugin
        .connect(John)
        .updateOrJoinMasterNodeDelegatee(Bob.address);

      const weightBefore = await daofinPlugin.mnToWeights(Bob.address);
      expect(weightBefore).be.eq(1);
      await xdcValidatorMock.connect(John).addCandidate(ADDRESS_TWO);

      await advanceTime(ethers, convertDaysToSeconds(4));

      // no change happened, its reverted.
      await expect(daofinPlugin.syncWithXdcValidator(John.address)).be.reverted;

      expect(await daofinPlugin.isMasterNodeDelegatee(Bob.address)).be.true;

      const weightAfter = await daofinPlugin.mnToWeights(Bob.address);

      expect(weightAfter).be.eq(1);
    });
  });
});
