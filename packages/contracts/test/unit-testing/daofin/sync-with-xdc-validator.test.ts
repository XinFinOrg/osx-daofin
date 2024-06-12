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
  onlyJuryCommitteeVotingSettings,
} from '../../helpers/utils';
import {
  ADDRESS_ONE,
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

    xdcValidatorMock = await deployXDCValidator(Alice);
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
      onlyJuryCommitteeVotingSettings(),
      [
        BigNumber.from(now + 60 * 60 * 24 * 3),
        BigNumber.from(now + 60 * 60 * 24 * 5),
        BigNumber.from(now + 60 * 60 * 24 * 10),
        BigNumber.from(now + 60 * 60 * 24 * 12),
      ],
      [Bob.address],
      '1',
    ];
    await daofinPlugin.initialize(...initializeParams);

    await daofinPlugin.joinHouse({value: parseEther('1')});
  });
  describe('syncWithXdcValidator', async () => {
    it('must revert if the caller is not part of Jury', async () => {
      await xdcValidatorMock.addCandidate(John.address);
      await expect(
        daofinPlugin.connect(Mike).syncWithXdcValidator(John.address)
      ).reverted;
    });
    it('must revert if the xdc operator is part of xdcValidator', async () => {
      await xdcValidatorMock.addCandidate(John.address);
      await daofinPlugin
        .connect(John)
        .updateOrJoinMasterNodeDelegatee(Beny.address);
      await expect(daofinPlugin.connect(Bob).syncWithXdcValidator(John.address))
        .reverted;
    });
    it('must not revert if the xdc operator is not part of xdcValidator, is part of committee', async () => {
      await xdcValidatorMock.addCandidate(John.address);
      await daofinPlugin
        .connect(John)
        .updateOrJoinMasterNodeDelegatee(Beny.address);
      await xdcValidatorMock.removeCandidate(John.address);

      await expect(daofinPlugin.connect(Bob).syncWithXdcValidator(John.address))
        .not.reverted;
    });
  });
});
