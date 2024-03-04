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
  let Tony: SignerWithAddress;
  let Proposer: SignerWithAddress;
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
    Tony = signers[5];
    Proposer = signers[6];

    dao = await deployTestDao(Alice);

    DaofinPlugin = new DaofinPlugin__factory(Alice);

    const RatioTest = new RatioTest__factory(Alice);
    ratio = await RatioTest.deploy();

    xdcValidatorMock = await deployXDCValidator(Alice);

    await xdcValidatorMock.addCandidate(Bob.address);
    await xdcValidatorMock.addCandidate(Mike.address);

    MockTimestampOracle = new MockTimestampOracle__factory(Alice);
    mockTimestampOracle = await MockTimestampOracle.deploy();
  });
  let proposalId: BigNumber;
  let electionIndex = BigNumber.from('0');
  beforeEach(async () => {
    daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);
    const now = (await mockTimestampOracle.getUint64Timestamp()).toNumber(); //Math.floor(Date.now() / 1000);

    initializeParams = [
      dao.address,
      parseEther('1'),
      xdcValidatorMock.address,
      [
        createCommitteeVotingSettings(
          MasterNodeCommittee,
          '100000',
          '100000',
          '1'
        ),
        createCommitteeVotingSettings(PeoplesHouseCommittee, '0', '0', '1'),
        createCommitteeVotingSettings(
          JudiciaryCommittee,
          '100000',
          '100000',
          '1'
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
        BigNumber.from(now + 60 * 60 * 24 * 1),
        BigNumber.from(now + 60 * 60 * 24 * 3),
        BigNumber.from(now + 60 * 60 * 24 * 4),
        BigNumber.from(now + 60 * 60 * 24 * 6),
        BigNumber.from(now + 60 * 60 * 24 * 7),
        BigNumber.from(now + 60 * 60 * 24 * 9),
      ],
      [Bob.address],
      '1',
    ];

    (await daofinPlugin.initialize(...initializeParams)).wait();

    createPropsalParams = createProposalParams(
      '0x00',
      [],
      electionIndex,
      '0',
      '0',
      '0'
    );
    createPropsalParams[6] = {
      value: '1',
    };

    proposalId = await daofinPlugin.callStatic.createProposal(
      ...createPropsalParams
    );

    const proposalTx = await daofinPlugin.createProposal(
      ...createPropsalParams
    );
    await proposalTx.wait();

    await advanceTime(ethers, convertDaysToSeconds(2));

    await xdcValidatorMock.addCandidate(Mike.address);
    await daofinPlugin
      .connect(Mike)
      .updateOrJoinMasterNodeDelegatee(Beny.address);

    await daofinPlugin.connect(Alice).joinHouse({value: parseEther('1')});
  });
  describe('IsReachedMinimumParticipation', async () => {
    const juries = [Bob];
    const mns = [Mike];
    const mnDelegatees = [Beny];
    const house = [Alice];
    it('must be greater that equal to quorum', async () => {
      const isReached = await daofinPlugin.isMinParticipationReached(
        proposalId
      );

      expect(isReached).to.be.false;
      await daofinPlugin.connect(Bob).vote(proposalId, '1', false);
      await daofinPlugin.connect(Beny).vote(proposalId, '2', false);
      await daofinPlugin.connect(Alice).vote(proposalId, '3', false);

      const committes = await daofinPlugin.getCommitteesList();

      let totalVotes = BigNumber.from('0');
      for (const committee of committes) {
        const tallyDetails = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );
        totalVotes = totalVotes
          .add(tallyDetails.yes)
          .add(tallyDetails.no)
          .add(tallyDetails.abstain);

        const totalNumbers =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);
        const votingSettings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );
        const minParticipation = await ratio.applyRatioCeiled(
          totalNumbers,
          votingSettings.minParticipation
        );

        expect(totalVotes).to.gte(minParticipation);
        const isReached = await daofinPlugin.isMinParticipationReached(
          proposalId
        );
        expect(isReached).to.eq(totalVotes.gte(minParticipation));
      }
    });
  });
  describe('IsReachedPassRate', async () => {
    const juries = [Bob];
    const mns = [Mike];
    const mnDelegatees = [Beny];
    const house = [Alice];
    it('must be greater that equal to passrate', async () => {
      const isReached = await daofinPlugin.isThresholdReached(proposalId);
      console.log(isReached);

      expect(isReached).to.be.false;

      await daofinPlugin.connect(Bob).vote(proposalId, '2', false);
      await daofinPlugin.connect(Beny).vote(proposalId, '2', false);
      await daofinPlugin.connect(Alice).vote(proposalId, '2', false);

      const committes = await daofinPlugin.getCommitteesList();

      let totalVotes = BigNumber.from('0');
      for (const committee of committes) {
        const tallyDetails = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );

        totalVotes = totalVotes.add(tallyDetails.yes);

        const totalNumbers =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);
        const votingSettings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );
        const supportThreshold = await ratio.applyRatioCeiled(
          totalNumbers,
          votingSettings.supportThreshold
        );

        expect(totalVotes).to.gte(supportThreshold);
        const isReachedPostVote = await daofinPlugin.isThresholdReached(
          proposalId
        );
        expect(isReachedPostVote).to.eq(totalVotes.gte(supportThreshold));
      }
    });
  });

  describe('CanExecute', async () => {
    const juries = [Bob];
    const mns = [Mike];
    const mnDelegatees = [Beny];
    const house = [Alice];

    it('must be true', async () => {
      await daofinPlugin.connect(Bob).vote(proposalId, '2', false);
      await daofinPlugin.connect(Beny).vote(proposalId, '2', false);
      await daofinPlugin.connect(Alice).vote(proposalId, '2', false);

      const canExecute = await daofinPlugin.canExecute(proposalId);
      expect(canExecute).to.be.true;
    });
  });
});
