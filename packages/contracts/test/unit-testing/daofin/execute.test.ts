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
  applyRatioCeiled,
  createCommitteeVotingSettings,
  createProposalParams,
} from '../../helpers/utils';
import {
  ADDRESS_ONE,
  CREATE_PROPOSAL_TYPE_PERMISSION_ID,
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
import {formatEther, parseEther, zeroPad} from 'ethers/lib/utils';
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

  describe('isMinParticipationReached()', () => {
    beforeEach(async () => {
      daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);

      initializeParams = [
        dao.address,
        parseEther('1'),
        xdcValidatorMock.address,
        [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '0',
            '0',
            parseEther('1')
          ),
        ],
        [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '0',
            '0',
            parseEther('1')
          ),
        ],
        [Math.floor(Date.now() / 1000)],
        [Bob.address],
      ];
      (await daofinPlugin.initialize(...initializeParams)).wait();

      await xdcValidatorMock.addCandidate(Mike.address);
      await xdcValidatorMock.addCandidate(Beny.address);

      await daofinPlugin
        .connect(Mike)
        .updateOrJoinMasterNodeDelegatee(John.address);

      await daofinPlugin
        .connect(Beny)
        .updateOrJoinMasterNodeDelegatee(Tony.address);

      await daofinPlugin.joinHouse({value: parseEther('1')});
    });
    it('Judiciary Vote', async () => {
      before(async () => {
        initializeParams[3] = [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '100000',
            '100000',
            parseEther('1')
          ),
        ];
      });
      const voter = Bob;
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);
      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;

      await daofinPlugin.connect(voter).vote(proposalId, voteOption, false);

      const committeesList = await daofinPlugin.getCommitteesList();
      for (const committee of committeesList) {
        const settings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );
        const totalCommitteeNumber =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);

        const {yes, no, abstain} = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );

        const totalVotes = yes.add(no).add(abstain);

        const isReached = totalVotes.gte(
          applyRatioCeiled(
            totalCommitteeNumber,
            BigNumber.from(settings.minParticipation)
          )
        );

        expect(await daofinPlugin.isMinParticipationReached(proposalId)).to.eq(
          isReached
        );
      }
    });
    it('Master Node Senate Vote', async () => {
      const voter = Bob;
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);
      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;

      await daofinPlugin.connect(voter).vote(proposalId, voteOption, false);

      const committeesList = await daofinPlugin.getCommitteesList();
      for (const committee of committeesList) {
        const settings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );
        const totalCommitteeNumber =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);

        const {yes, no, abstain} = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );

        const totalVotes = yes.add(no).add(abstain);

        const isReached = totalVotes.gte(
          applyRatioCeiled(
            totalCommitteeNumber,
            BigNumber.from(settings.minParticipation)
          )
        );

        expect(await daofinPlugin.isMinParticipationReached(proposalId)).to.eq(
          isReached,
          committee
        );
      }
    });
    it('People Vote', async () => {
      const voter = Alice;
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);
      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.No;

      await daofinPlugin.connect(voter).vote(proposalId, voteOption, false);

      const committeesList = await daofinPlugin.getCommitteesList();
      for (const committee of committeesList) {
        const settings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );
        const totalCommitteeNumber =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);

        const {yes, no, abstain} = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );

        const totalVotes = yes.add(no).add(abstain);

        const isReached = totalVotes.gte(
          applyRatioCeiled(
            totalCommitteeNumber,
            BigNumber.from(settings.minParticipation)
          )
        );

        expect(await daofinPlugin.isMinParticipationReached(proposalId)).to.eq(
          isReached,
          committee
        );
      }
    });
  });
  describe('isThresholdReached()', () => {
    beforeEach(async () => {
      daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);

      initializeParams = [
        dao.address,
        parseEther('1'),
        xdcValidatorMock.address,
        [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '0',
            '0',
            parseEther('1')
          ),
        ],
        [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '100000',
            '100000',
            parseEther('1')
          ),
        ],
        [Math.floor(Date.now() / 1000)],
        [Bob.address],
      ];
      (await daofinPlugin.initialize(...initializeParams)).wait();

      await xdcValidatorMock.addCandidate(Mike.address);
      await xdcValidatorMock.addCandidate(Beny.address);

      await daofinPlugin
        .connect(Mike)
        .updateOrJoinMasterNodeDelegatee(John.address);

      await daofinPlugin
        .connect(Beny)
        .updateOrJoinMasterNodeDelegatee(Tony.address);

      await daofinPlugin.joinHouse({value: parseEther('1')});
    });
    afterEach(async () => {
      await xdcValidatorMock.reset();
    });
    it('Judiciary Vote', async () => {
      const voter = Bob;
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);
      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;

      await daofinPlugin.connect(voter).vote(proposalId, voteOption, false);

      const committeesList = await daofinPlugin.getCommitteesList();
      for (const committee of committeesList) {
        const settings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );
        const totalCommitteeNumber =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);

        const {yes, no, abstain} = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );

        const totalVotes = yes;

        const isReached = totalVotes.gte(
          applyRatioCeiled(
            totalCommitteeNumber,
            BigNumber.from(settings.minParticipation)
          )
        );

        expect(await daofinPlugin.isThresholdReached(proposalId)).to.eq(
          isReached
        );
      }
    });
    it('Master Node Vote', async () => {
      const voter = John;

      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);

      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;

      await daofinPlugin.connect(voter).vote(proposalId, voteOption, false);

      const committeesList = await daofinPlugin.getCommitteesList();
      for (const committee of committeesList) {
        const settings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );

        const totalCommitteeNumber =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);

        const {yes} = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );

        const totalVotes = yes;

        const isReached = totalVotes.gte(
          applyRatioCeiled(
            totalCommitteeNumber,
            BigNumber.from(settings.minParticipation)
          )
        );

        expect(await daofinPlugin.isThresholdReached(proposalId)).to.eq(
          isReached,
          committee
        );
      }
    });
    it('People Vote', async () => {
      const voter = Alice;

      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);

      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;

      await daofinPlugin.connect(voter).vote(proposalId, voteOption, false);

      const committeesList = await daofinPlugin.getCommitteesList();
      for (const committee of committeesList) {
        const settings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );

        const totalCommitteeNumber =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);

        const {yes} = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );

        const totalVotes = yes;

        const isReached = totalVotes.gte(
          applyRatioCeiled(
            totalCommitteeNumber,
            BigNumber.from(settings.minParticipation)
          )
        );

        expect(await daofinPlugin.isThresholdReached(proposalId)).to.eq(
          isReached,
          committee
        );
      }
    });
  });

  describe('CanExecute()', () => {
    beforeEach(async () => {
      daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);

      initializeParams = [
        dao.address,
        parseEther('1'),
        xdcValidatorMock.address,
        [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '500000',
            '500000',
            '1'
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
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
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '0',
            '0',
            parseEther('1')
          ),
        ],
        [Math.floor(Date.now() / 1000)],
        [Bob.address],
      ];
      (await daofinPlugin.initialize(...initializeParams)).wait();

      await xdcValidatorMock.addCandidate(Mike.address);
      await xdcValidatorMock.addCandidate(Beny.address);

      await daofinPlugin
        .connect(Mike)
        .updateOrJoinMasterNodeDelegatee(John.address);

      await daofinPlugin
        .connect(Beny)
        .updateOrJoinMasterNodeDelegatee(Tony.address);

      await daofinPlugin.joinHouse({value: parseEther('1')});
    });
    afterEach(async () => {
      await xdcValidatorMock.reset();
    });
    it('it must be able to execute', async () => {
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);
      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;
      // People
      await daofinPlugin.connect(Alice).vote(proposalId, voteOption, false);

      // Jury
      await daofinPlugin.connect(Bob).vote(proposalId, voteOption, false);

      // Mn
      //   await daofinPlugin.connect(John).vote(proposalId, voteOption, false);
      await daofinPlugin.connect(Tony).vote(proposalId, voteOption, false);

      const proposal = await daofinPlugin.getProposal(proposalId);

      expect(proposal.open).be.true;

      const committeesList = await daofinPlugin.getCommitteesList();

      for (const committee of committeesList) {
        const settings = await daofinPlugin.getCommitteesToVotingSettings(
          '0',
          committee
        );

        const totalCommitteeNumber =
          await daofinPlugin.getTotalNumberOfMembersByCommittee(committee);

        const {yes, no, abstain} = await daofinPlugin.getProposalTallyDetails(
          proposalId,
          committee
        );

        const totalVotes = yes.add(no).add(abstain);

        const yesVotes = yes;

        const isMinParticipationReached = totalVotes.gte(
          applyRatioCeiled(
            totalCommitteeNumber,
            BigNumber.from(settings.minParticipation)
          )
        );

        const isThresholdReached = yesVotes.gte(
          applyRatioCeiled(
            totalCommitteeNumber,
            BigNumber.from(settings.supportThreshold)
          )
        );

        expect(await daofinPlugin.isMinParticipationReached(proposalId)).to.eq(
          isMinParticipationReached
        );
        expect(await daofinPlugin.isThresholdReached(proposalId)).to.eq(
          isThresholdReached
        );
        expect(await daofinPlugin.canExecute(proposalId)).be.true;
      }
    });
    it('it must not be able to execute', async () => {
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);
      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;
      // People
      await daofinPlugin.connect(Alice).vote(proposalId, voteOption, false);

      // Jury
      await daofinPlugin.connect(Bob).vote(proposalId, voteOption, false);

      // No MNs

      const proposal = await daofinPlugin.getProposal(proposalId);

      expect(proposal.open).be.true;

      expect(await daofinPlugin.isMinParticipationReached(proposalId)).to.be
        .false;
      expect(await daofinPlugin.isThresholdReached(proposalId)).to.false;
      expect(await daofinPlugin.canExecute(proposalId)).be.false;
    });
  });
  describe('Execute()', () => {
    beforeEach(async () => {
      daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);

      initializeParams = [
        dao.address,
        parseEther('1'),
        xdcValidatorMock.address,
        [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
            '500000',
            '500000',
            '1'
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
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
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
            '0',
            '0',
            parseEther('1')
          ),
          createCommitteeVotingSettings(
            JudiciaryCommittee,
            '0',
            '0',
            parseEther('1')
          ),
        ],
        [Math.floor(Date.now() / 1000)],
        [Bob.address],
      ];
      (await daofinPlugin.initialize(...initializeParams)).wait();

      await xdcValidatorMock.addCandidate(Mike.address);
      await xdcValidatorMock.addCandidate(Beny.address);

      await daofinPlugin
        .connect(Mike)
        .updateOrJoinMasterNodeDelegatee(John.address);

      await daofinPlugin
        .connect(Beny)
        .updateOrJoinMasterNodeDelegatee(Tony.address);

      await daofinPlugin.joinHouse({value: parseEther('1')});
    });
    afterEach(async () => {
      await xdcValidatorMock.reset();
    });
    it('fire execute function', async () => {
      const txHash = await Alice.sendTransaction({
        to: dao.address,
        value: parseEther('10'),
      });

      await dao.grant(dao.address, daofinPlugin.address, EXECUTE_PERMISSION_ID);

      createPropsalParams = createProposalParams(
        '0x00',
        [
          {
            data: new Uint8Array(),
            value: BigInt(parseEther('1').toString()),
            to: Proposer.address,
          },
        ],
        '1',
        '0',
        '0',
        '0'
      );
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      const proposalTx = await daofinPlugin
        .connect(Proposer)
        .createProposal(...createPropsalParams);
      await proposalTx.wait();

      const voteOption: VoteOption = VoteOption.Yes;
      // People
      await daofinPlugin.connect(Alice).vote(proposalId, voteOption, false);

      // Jury
      await daofinPlugin.connect(Bob).vote(proposalId, voteOption, false);

      // MNs
      await daofinPlugin.connect(John).vote(proposalId, voteOption, false);
      await daofinPlugin.connect(Tony).vote(proposalId, voteOption, false);

      const proposal = await daofinPlugin.getProposal(proposalId);

      expect(proposal.open).be.true;

      expect(await daofinPlugin.canExecute(proposalId)).to.be.true;

      (await daofinPlugin.execute(proposalId)).wait();

      expect(proposal.executed).to.be.true;
    });
  });
});
