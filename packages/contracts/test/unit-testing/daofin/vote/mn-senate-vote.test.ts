import {DaofinPluginSetupParams} from '../../../../plugin-settings';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
  MockTimestampOracle,
  MockTimestampOracle__factory,
  XDCValidator,
} from '../../../../typechain';
import {deployWithProxy} from '../../../../utils/helpers';
import {deployTestDao} from '../../../helpers/test-dao';
import {deployXDCValidator} from '../../../helpers/test-xdc-validator';
import {VoteOption} from '../../../helpers/types';
import {
  advanceTime,
  convertDaysToSeconds,
  createCommitteeVotingSettings,
  createProposalParams,
} from '../../../helpers/utils';
import {
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
} from '../../daofin-common';
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

    const RatioTest = new RatioTest__factory(Alice);
    ratio = await RatioTest.deploy();

    xdcValidatorMock = await deployXDCValidator(Alice);

    DaofinPlugin = new DaofinPlugin__factory(Alice);
    MockTimestampOracle = new MockTimestampOracle__factory(Alice);
    mockTimestampOracle = await MockTimestampOracle.deploy();
  });
  let proposalId: BigNumber;
  let electionIndex = BigNumber.from('0');
  describe('MasterNode: vote()', async () => {
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
        .updateOrJoinMasterNodeDelegatee(John.address);
    });
    it('MasterNode: must record in tally details', async () => {
      const voter = John;

      const voteOption: VoteOption = VoteOption.Yes;
      const voteCommittee = MasterNodeCommittee;

      const voteTx = await daofinPlugin
        .connect(voter)
        .vote(proposalId, voteOption, false);
      await voteTx.wait();

      const tallyAfter = await daofinPlugin.getProposalTallyDetails(
        proposalId,
        voteCommittee
      );
      expect(tallyAfter.no.toString()).not.be.eq(parseEther('1').toString());
      expect(tallyAfter.no.toString()).be.eq(parseEther('0').toString());

      expect(tallyAfter.yes.toString()).not.be.eq(parseEther('0').toString());
      expect(tallyAfter.yes.toString()).be.eq(parseEther('1').toString());
    });
    it('MasterNode: must record voter address', async () => {
      const voter = John;

      const voteOption: VoteOption = VoteOption.Yes;

      const voteTx = await daofinPlugin
        .connect(voter)
        .vote(proposalId, voteOption, false);
      await voteTx.wait();

      const info = await daofinPlugin.getProposalVoterToInfo(
        proposalId,
        voter.address
      );

      expect(info.voted).to.be.true;
      expect(info.voted).not.be.false;
      expect(info.option).be.eq(voteOption);
    });
  });
});
