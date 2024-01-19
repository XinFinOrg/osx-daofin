import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
  XDCValidator,
} from '../../../typechain';
import {deployWithProxy} from '../../../utils/helpers';
import {deployTestDao} from '../../helpers/test-dao';
import {deployXDCValidator} from '../../helpers/test-xdc-validator';
import {VoteOption} from '../../helpers/types';
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
  let Tony: SignerWithAddress;
  let Proposer: SignerWithAddress;
  let xdcValidatorMock: XDCValidator;
  let ratio: RatioTest;
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
  });

  beforeEach(async () => {});
  describe('Jury: vote()', async () => {
    let proposalId: BigNumber;
    beforeEach(async () => {
      daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);

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
        [Math.floor(new Date().getTime() / 1000) + 10],
        [Bob.address],
        '0',
      ];
      (await daofinPlugin.initialize(...initializeParams)).wait();
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '0',
        '0',
        '0',
        '0'
      );

      proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin.createProposal(
        ...createPropsalParams
      );
      await proposalTx.wait();
      await new Promise(res => setTimeout(d => res(d), 12000));
    });
    it('must not be reverted', async () => {
      const voter = Bob;

      expect(await daofinPlugin.connect(voter).vote(proposalId, '2', false)).not
        .to.be.reverted;
    });
    it('must be reverted', async () => {
      const voter = Bob;

      await expect(
        daofinPlugin.connect(voter).vote(proposalId.add(1), '2', false)
      ).reverted;
    });
    it('Jury: must record in tally details', async () => {
      const voter = Bob;

      const voteOption: VoteOption = VoteOption.Yes;
      const voteCommittee = JudiciaryCommittee;
      const tallyBefore = await daofinPlugin.getProposalTallyDetails(
        proposalId,
        voteCommittee
      );
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
    it('Jury: must record voter address', async () => {
      const voter = Bob;

      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      createPropsalParams[6] = {value: initializeParams[7].toString()};

      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin.createProposal(
        ...createPropsalParams
      );
      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;
      const voteCommittee = JudiciaryCommittee;
      const tallyBefore = await daofinPlugin.getProposalTallyDetails(
        proposalId,
        voteCommittee
      );
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
  describe('People: vote()', async () => {
    let proposalId: BigNumber;
    beforeEach(async () => {
      daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);

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
        [Math.floor(new Date().getTime() / 1000) + 10],
        [Bob.address],
        '0',
      ];
      (await daofinPlugin.initialize(...initializeParams)).wait();

      (
        await daofinPlugin.connect(Alice).joinHouse({
          value: parseEther('1'),
        })
      ).wait();
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );

      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);

      await proposalTx.wait();
      await new Promise(res => setTimeout(d => res(d), 12000));
    });
    it('People: must record in tally details', async () => {
      const voter = Alice;

      const voteOption: VoteOption = VoteOption.Yes;
      const voteCommittee = PeoplesHouseCommittee;
      const tallyBefore = await daofinPlugin.getProposalTallyDetails(
        proposalId,
        voteCommittee
      );

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
    it('People: must record voter address', async () => {
      const voter = Alice;

      const voteOption: VoteOption = VoteOption.Yes;

      const voteCommittee = PeoplesHouseCommittee;

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
  describe('MasterNode: vote()', async () => {
    let proposalId: BigNumber;
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
        [Math.floor(new Date().getTime() / 1000) + 10],
        [Bob.address],
        '0',
      ];
      (await daofinPlugin.initialize(...initializeParams)).wait();

      await xdcValidatorMock.addCandidate(Mike.address);
      await daofinPlugin
        .connect(Mike)
        .updateOrJoinMasterNodeDelegatee(John.address);
      //   await xdcValidatorMock.addCandidate(Beny.address);
      //   await daofinPlugin
      //     .connect(Beny)
      //     .updateOrJoinMasterNodeDelegatee(Tony.address);
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );

      proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );

      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);

      await proposalTx.wait();
      await new Promise(res => setTimeout(d => res(d), 12000));
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
