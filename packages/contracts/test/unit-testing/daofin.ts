import {PLUGIN_CONTRACT_NAME} from '../../plugin-settings';
import {DAO, DaofinPlugin, DaofinPlugin__factory} from '../../typechain';
import {ProposalCreatedEvent} from '../../typechain/src/DaofinPlugin';
import {deployWithProxy} from '../../utils/helpers';
import {deployTestDao} from '../helpers/test-dao';
import {PROPOSAL_EVENTS} from '../helpers/types';
import {
  ADDRESS_ONE,
  ADDRESS_ZERO,
  BYTES32_ZERO,
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  XdcValidator,
} from './daofin-common';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ProposalCreationSteps} from '@xinfin/osx-sdk-client';
import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {formatEther, parseEther} from 'ethers/lib/utils';
import {ethers} from 'hardhat';

export type InitData = {number: BigNumber};
export const defaultInitData: InitData = {
  number: BigNumber.from(123),
};

describe(PLUGIN_CONTRACT_NAME, function () {
  let signers: SignerWithAddress[];
  let dao: DAO;
  let DaofinPlugin: DaofinPlugin__factory;
  let daofinPlugin: DaofinPlugin;
  let defaultInput: InitData;
  let initializeParams: Parameters<DaofinPlugin['initialize']>;
  let createPropsalParams: Parameters<DaofinPlugin['createProposal']>;
  let Alice: SignerWithAddress;
  let Bob: SignerWithAddress;
  let Mike: SignerWithAddress;
  before(async () => {
    signers = await ethers.getSigners();
    Alice = signers[0];
    Bob = signers[1];
    Mike = signers[2];
    dao = await deployTestDao(Alice);

    DaofinPlugin = new DaofinPlugin__factory(Alice);
  });

  beforeEach(async () => {
    daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);
  });

  describe('initialize', async () => {
    it('reverts if trying to re-initialize', async () => {
      // const latestBlock = await ethers.provider.getBlock('latest');
      initializeParams = [
        dao.address,
        [parseEther('10')],
        XdcValidator,
        [
          {
            name: MasterNodeCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
          {
            name: JudiciaryCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
          {
            name: PeoplesHouseCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
        ],
        [Math.floor(Date.now() / 1000)],
        [ADDRESS_ONE],
      ];
      await daofinPlugin.initialize(...initializeParams);

      await expect(
        daofinPlugin.initialize(...initializeParams)
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
    it('xdc validator address must be set', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const globalSettings = await daofinPlugin.getGlobalSettings();
      expect(globalSettings.xdcValidator).to.equal(initializeParams[2]);
    });
    it('allowedAmounts must be set and be correct', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const globalSettings = await daofinPlugin.getGlobalSettings();

      expect(globalSettings.allowedAmounts.length).to.greaterThan(0);
      expect(globalSettings.allowedAmounts.length).to.lessThanOrEqual(5);

      globalSettings.allowedAmounts.forEach(amount => {
        const number = parseFloat(formatEther(amount));
        expect(number).not.be.NaN;
        expect(number).not.be.greaterThan(parseEther('1000'));
      });
    });
    it('election periods must be set', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const electionPeriods = await daofinPlugin.getElectionPeriods();

      expect(electionPeriods.length).to.greaterThan(0);
      expect(electionPeriods.length).to.lessThanOrEqual(5);

      electionPeriods.forEach(({startDate, endDate}, index) => {
        expect(startDate).to.be.eq(initializeParams[4][index]);
        expect(endDate).to.be.greaterThanOrEqual(initializeParams[4][index]);
      });
    });
    it('committee list must be set', async () => {
      await daofinPlugin.initialize(...initializeParams);

      const committeesList = await daofinPlugin.getCommitteesList();

      initializeParams[3].forEach(committee => {
        if (committee.name === committeesList[0]) {
          expect(committee.name).to.equal(committeesList[0]);
        }
        if (committee.name === committeesList[1]) {
          expect(committee.name).to.equal(committeesList[1]);
        }
        if (committee.name === committeesList[2]) {
          expect(committee.name).to.equal(committeesList[2]);
        } else {
          expect(committee.name).not.be.null;
        }
      });
    });

    it('committee settings must be set', async () => {
      await daofinPlugin.initialize(...initializeParams);

      const committeesList = await daofinPlugin.getCommitteesList();
      for (let i = 0; i < committeesList.length; i++) {
        const settings = await daofinPlugin.getCommitteesToVotingSettings(
          committeesList[i]
        );

        expect(settings.name).to.equal(initializeParams[3][i].name);

        expect(settings.minDuration)
          .to.greaterThan(0)
          .to.equal(initializeParams[3][i].minDuration);

        expect(settings.minParticipation)
          .to.greaterThan(0)
          .to.equal(initializeParams[3][i].minParticipation);

        expect(settings.minVotingPower)
          .to.greaterThan(0)
          .to.equal(initializeParams[3][i].minVotingPower);

        expect(settings.supportThreshold).to.equal(
          initializeParams[3][i].supportThreshold
        );
      }
    });
    it('judiciary members must be set', async () => {
      await daofinPlugin.initialize(...initializeParams);
      for await (const judiciary of initializeParams[5]) {
        const exist = await daofinPlugin._judiciaryCommittee(judiciary);
        expect(exist).to.be.true;
        expect(judiciary).be.not.eq(ADDRESS_ZERO);
        expect(judiciary).be.not.eq(XdcValidator);
      }
    });
  });

  describe('create proposal', async () => {
    let Alice: SignerWithAddress;
    let Bob: SignerWithAddress;
    before(async () => {
      Alice = signers[0];
      Bob = signers[1];
    });
    beforeEach(async () => {
      initializeParams = [
        dao.address,
        [parseEther('10')],
        XdcValidator,
        [
          {
            name: MasterNodeCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
          {
            name: JudiciaryCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
          {
            name: PeoplesHouseCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
        ],
        [Math.floor(Date.now() / 1000)],
        [ADDRESS_ONE],
      ];
    });
    it('must not revert', async () => {
      createPropsalParams = [
        '0x00',
        [
          {
            data: '0x00',
            to: ADDRESS_ZERO,
            value: 0,
          },
        ],
        0,
        0,
      ];

      await daofinPlugin.initialize(...initializeParams);

      expect(await daofinPlugin.proposalCount()).to.be.eq(0);
      expect(await daofinPlugin.proposalCount()).to.not.be.eq(1);
      expect(await daofinPlugin.createProposal(...createPropsalParams)).to.not
        .reverted;
      expect(await daofinPlugin.proposalCount()).to.not.be.eq(0);
      expect(await daofinPlugin.proposalCount()).to.be.eq(1);
    });
    it('creates unique proposal IDs for each proposal', async () => {
      await daofinPlugin.initialize(...initializeParams);

      const proposalId0 = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      // create a new proposal for the proposalCounter to be incremented
      await expect(daofinPlugin.createProposal(...createPropsalParams)).not.to
        .be.reverted;
      await ethers.provider.send('evm_mine', []);
      const proposalId1 = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );

      expect(proposalId0).to.equal(0); // To be removed when proposal ID is generated as a hash.
      expect(proposalId1).to.equal(1); // To be removed when proposal ID is generated as a hash.

      expect(proposalId0).to.not.equal(proposalId1);
    });
    it('emits the `ProposalCreated` event', async () => {
      await daofinPlugin.initialize(...initializeParams);

      createPropsalParams = ['0x00', [], 0, 0];

      const startDate = await initializeParams[4][0];
      const endDate = parseInt(startDate.toString()) + 60 * 60 * 24 * 7;

      await expect(daofinPlugin.createProposal(...createPropsalParams))
        .to.emit(daofinPlugin, PROPOSAL_EVENTS.PROPOSAL_CREATED)
        .withArgs(
          0,
          Alice.address,
          startDate.toString(),
          endDate.toString(),
          '0x00',
          [],
          0
        );
      await ethers.provider.send('evm_mine', []);
      await expect(daofinPlugin.createProposal(...createPropsalParams))
        .to.emit(daofinPlugin, PROPOSAL_EVENTS.PROPOSAL_CREATED)
        .withArgs(
          1,
          Alice.address,
          startDate.toString(),
          endDate.toString(),
          '0x00',
          createPropsalParams[1],
          0
        );
    });
    context('After Proposal Created:', async () => {
      beforeEach(async () => {
        await daofinPlugin.initialize(...initializeParams);
        const startDate = await initializeParams[4][0];
        const endDate = parseInt(startDate.toString()) + 60 * 60 * 24 * 7;
      });
      it('proposal should be set in _proposals:', async () => {
        const proposalId = await daofinPlugin.callStatic.createProposal(
          ...createPropsalParams
        );
        await daofinPlugin.createProposal(...createPropsalParams);
        const proposal = await daofinPlugin.getProposal(proposalId);

        expect(proposal.open).be.eq(true);
        expect(proposal.executed).be.eq(false);
        expect(proposal.parameters.startDate.toString()).not.be.null;
      });
      it('proposal should have an open status', async () => {
        const proposalId = await daofinPlugin.callStatic.createProposal(
          ...createPropsalParams
        );
        const tx = await daofinPlugin.createProposal(...createPropsalParams);
        const proposal = await daofinPlugin.getProposal(proposalId);
        expect(proposal.open).be.eq(true);
      });
      it('execution should be false in creation of proposal', async () => {
        const proposalId = await daofinPlugin.callStatic.createProposal(
          ...createPropsalParams
        );
        const tx = await daofinPlugin.createProposal(...createPropsalParams);
        const proposal = await daofinPlugin.getProposal(proposalId);
        expect(proposal.executed).be.eq(false);
      });
      it('proposer should be tx sender(from)', async () => {
        const proposalId = await daofinPlugin.callStatic.createProposal(
          ...createPropsalParams
        );
        const tx = await daofinPlugin.createProposal(...createPropsalParams);
        const proposal = await daofinPlugin.getProposal(proposalId);
        expect(proposal.proposer).be.eq(Alice.address);
        expect(proposal.proposer).not.be.eq(Bob.address);
      });
      it('actions should fill', async () => {
        createPropsalParams[1] = [
          {
            data: '0x00',
            to: Alice.address,
            value: 0,
          },
        ];
        const proposalId = await daofinPlugin.callStatic.createProposal(
          ...createPropsalParams
        );
        const tx = await daofinPlugin.createProposal(...createPropsalParams);
        const proposal = await daofinPlugin.getProposal(proposalId);

        expect(proposal.actions.length).be.eq(createPropsalParams[1].length);
      });
    });
  });
  describe('deposit', async () => {
    let committeesList: string[];
    before(async () => {
      initializeParams = [
        dao.address,
        [
          parseEther('1'),
          parseEther('2'),
          parseEther('3'),
          parseEther('4'),
          parseEther('5'),
          parseEther('10'),
          parseEther('100'),
        ],
        XdcValidator,
        [
          {
            name: MasterNodeCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
          {
            name: JudiciaryCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
          {
            name: PeoplesHouseCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
        ],
        [Math.floor(Date.now() / 1000)],
        [ADDRESS_ONE],
      ];
    });

    it('Deposited event should be emitted', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const value = parseEther('1');
      committeesList = await daofinPlugin.getCommitteesList();
      for (const committee of committeesList) {
        await expect(
          daofinPlugin.connect(Alice).deposit({
            value: value.toString(),
          })
        )
          .emit(daofinPlugin, 'Deposited')
          .withArgs(Alice.address, value);
      }
    });
    it('amount should transfer in dao treasury', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const value = parseEther('1');
      const beforeTreasuryEthBalance = await ethers.provider.getBalance(
        dao.address
      );
      const beforeDaofinEthBalance = await ethers.provider.getBalance(
        daofinPlugin.address
      );
      await daofinPlugin.connect(Alice).deposit({
        value: value.toString(),
      });
      const afterTreasuryEthBalance = await ethers.provider.getBalance(
        dao.address
      );
      const afterDaofinEthBalance = await ethers.provider.getBalance(
        daofinPlugin.address
      );

      expect(afterTreasuryEthBalance.toString()).be.eq(
        beforeTreasuryEthBalance.add(value)
      );
      expect(beforeDaofinEthBalance.toString()).be.eq(
        afterDaofinEthBalance.toString()
      );
    });
    it('voterToLockedAmount must be set', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const value = parseEther('1');
      const beforeBalance = await daofinPlugin._voterToLockedAmounts(
        Alice.address
      );
      await daofinPlugin.connect(Alice).deposit({
        value: value.toString(),
      });
      const afterBalance = await daofinPlugin._voterToLockedAmounts(
        Alice.address
      );

      expect(afterBalance.amount.toString()).be.eq(
        beforeBalance.amount.add(value).toString()
      );
    });
    it('check voterToLockedAmount - try multiple deposits', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const value = parseEther('1');
      const numberOfTimes = 2;
      const beforeBalance = await daofinPlugin._voterToLockedAmounts(
        Alice.address
      );

      expect(beforeBalance.amount.toString()).be.eq('0');

      for (let i = 0; i < numberOfTimes; i++) {
        await daofinPlugin.connect(Alice).deposit({
          value: value.toString(),
        });
      }
      const afterBalance = await daofinPlugin._voterToLockedAmounts(
        Alice.address
      );

      expect(afterBalance.amount.toString()).be.eq(
        beforeBalance.amount.add(value.mul(numberOfTimes)).toString()
      );
    });
    it('check dao treasury - try multiple deposits', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const value = parseEther('1');
      const numberOfTimes = 5;
      const beforeBalance = await ethers.provider.getBalance(dao.address);

      for (let i = 0; i < numberOfTimes; i++) {
        await daofinPlugin.connect(Alice).deposit({
          value: value.toString(),
        });
      }
      const afterBalance = await ethers.provider.getBalance(dao.address);

      expect(afterBalance.toString()).be.eq(
        beforeBalance.add(value.mul(numberOfTimes)).toString()
      );
      expect(afterBalance.toString()).be.not.eq('0');
      expect(afterBalance.toString()).be.not.eq(value.toString());
    });
  });
  describe('find committee', async () => {
    let JudiciaryCommittee: string,
      MasterNodeCommittee: string,
      PeoplesHouseCommittee: string;
    before(async () => {
      JudiciaryCommittee = await daofinPlugin.JudiciaryCommittee();
      MasterNodeCommittee = await daofinPlugin.MasterNodeCommittee();
      PeoplesHouseCommittee = await daofinPlugin.PeoplesHouseCommittee();

      initializeParams = [
        dao.address,
        [
          parseEther('1'),
          parseEther('2'),
          parseEther('3'),
          parseEther('4'),
          parseEther('5'),
          parseEther('10'),
          parseEther('100'),
        ],
        XdcValidator,
        [
          {
            name: MasterNodeCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
          {
            name: JudiciaryCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
          {
            name: PeoplesHouseCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
        ],
        [Math.floor(Date.now() / 1000)],
        [Bob.address],
      ];
    });

    it('should return a right name', async () => {
      await daofinPlugin.initialize(...initializeParams);
      await daofinPlugin
        .connect(Bob)
        .deposit({value: parseEther('1').toString()});

      expect(await daofinPlugin.findCommitteeName(ADDRESS_ONE)).be.eq(
        BYTES32_ZERO
      );

      expect(await daofinPlugin.findCommitteeName(Bob.address)).be.eq(
        JudiciaryCommittee
      );
      expect(await daofinPlugin.findCommitteeName(Bob.address)).not.be.eq(
        PeoplesHouseCommittee
      );
      expect(await daofinPlugin.findCommitteeName(Bob.address)).not.be.eq(
        MasterNodeCommittee
      );
    });
  });

  describe('vote', async () => {
    let JudiciaryCommittee: string,
      MasterNodeCommittee: string,
      PeoplesHouseCommittee: string;
    before(async () => {
      JudiciaryCommittee = await daofinPlugin.JudiciaryCommittee();
      MasterNodeCommittee = await daofinPlugin.MasterNodeCommittee();
      PeoplesHouseCommittee = await daofinPlugin.PeoplesHouseCommittee();
      initializeParams = [
        dao.address,
        [parseEther('10'), parseEther('20'), parseEther('30')],
        XdcValidator,
        [
          {
            name: MasterNodeCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 2,
            supportThreshold: 1,
          },
          {
            name: JudiciaryCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 2,
            supportThreshold: 1,
          },
          {
            name: PeoplesHouseCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
        ],
        [Math.floor(Date.now() / 1000)],
        [Bob.address],
      ];
      createPropsalParams = [
        '0x00',
        [
          {
            data: '0x00',
            to: ADDRESS_ZERO,
            value: 0,
          },
        ],
        0,
        0,
      ];
    });
    beforeEach(async () => {
      await daofinPlugin.initialize(...initializeParams);
    });
    it('vote must not vote without depositing', async () => {
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      await daofinPlugin.createProposal(...createPropsalParams);
      await expect(daofinPlugin.vote(proposalId, '2', false)).be.revertedWith(
        'Daofin: deposit first'
      );
    });
    it('voter should vote once on one proposal', async () => {
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      await daofinPlugin.createProposal(...createPropsalParams);
      await daofinPlugin
        .connect(Bob)
        .deposit({value: parseEther('10').toString()});
      await expect(
        daofinPlugin.connect(Bob).vote(proposalId, '2', false)
      ).be.not.revertedWith('Daofin: already voted');
      const isVoted = await daofinPlugin.isVotedOnProposal(
        Bob.address,
        proposalId
      );
      expect(isVoted).be.true;
    });
    it('voter connot vote twice on one proposal', async () => {
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      await daofinPlugin.createProposal(...createPropsalParams);
      await daofinPlugin
        .connect(Bob)
        .deposit({value: parseEther('10').toString()});

      await expect(
        daofinPlugin.connect(Bob).vote(proposalId, '2', false)
      ).be.not.revertedWith('Daofin: already voted');

      await expect(
        daofinPlugin.connect(Bob).vote(proposalId, '2', false)
      ).be.revertedWith('Daofin: already voted');
    });
    it('vote must come from a valid voter committee', async () => {
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      await daofinPlugin.createProposal(...createPropsalParams);

      const commiteesList = await daofinPlugin.getCommitteesList();
      for await (const committee of commiteesList) {
        await daofinPlugin
          .connect(Bob)
          .deposit({value: parseEther('10').toString()});
        await expect(
          daofinPlugin.connect(Bob).vote(proposalId, '2', false)
        ).be.not.revertedWith('Daofin: invalid voter');
      }
    });
    it('voter to info must change after vote()', async () => {
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      await daofinPlugin.createProposal(...createPropsalParams);
      await daofinPlugin
        .connect(Bob)
        .deposit({value: parseEther('10').toString()});

      await daofinPlugin.connect(Bob).vote(proposalId, '2', false);

      const voteInfo = await daofinPlugin.getProposalVoterToInfo(
        proposalId,
        Bob.address
      );
      expect(voteInfo.voted).be.true;
      expect(voteInfo.option).be.eq(2);
    });
    it('tally must change after vote()', async () => {
      const proposalId = await daofinPlugin.callStatic.createProposal(
        ...createPropsalParams
      );
      await daofinPlugin.createProposal(...createPropsalParams);
      await daofinPlugin
        .connect(Bob)
        .deposit({value: parseEther('10').toString()});

      const committee = await daofinPlugin.findCommitteeName(Bob.address);

      const tallyBefore = await daofinPlugin.getProposalTallyDetails(
        proposalId,
        committee
      );

      await daofinPlugin.connect(Bob).vote(proposalId, '2', false);

      const tally = await daofinPlugin.getProposalTallyDetails(
        proposalId,
        committee
      );
      expect(tally.yes.toString()).be.eq(
        tallyBefore.yes.add(tally.yes).toString()
      );
      expect(tally.no.toNumber()).be.eq(0);
      expect(tally.abstain.toNumber()).be.eq(0);
    });
  });
  describe('canExecute', async () => {
    before(async () => {
      initializeParams = [
        dao.address,
        [parseEther('10'), parseEther('20'), parseEther('30')],
        XdcValidator,
        [
          {
            name: MasterNodeCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 2,
            supportThreshold: 1,
          },
          {
            name: JudiciaryCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 2,
            supportThreshold: 1,
          },
          {
            name: PeoplesHouseCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
        ],
        [Math.floor(Date.now() / 1000)],
        [Bob.address],
      ];
      createPropsalParams = [
        '0x00',
        [
          {
            data: '0x00',
            to: ADDRESS_ZERO,
            value: 0,
          },
        ],
        0,
        0,
      ];
    });
    it('should return true', async () => {});
  });
  describe('Add Judiciary', async () => {
    before(async () => {
      initializeParams = [
        dao.address,
        [parseEther('10'), parseEther('20'), parseEther('30')],
        XdcValidator,
        [
          {
            name: MasterNodeCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 2,
            supportThreshold: 1,
          },
          {
            name: JudiciaryCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 2,
            supportThreshold: 1,
          },
          {
            name: PeoplesHouseCommittee,
            minDuration: 1,
            minParticipation: 1,
            minVotingPower: 1,
            supportThreshold: 1,
          },
        ],
        [Math.floor(Date.now() / 1000)],
        [Alice.address],
      ];
    });
    beforeEach(async () => {
      await daofinPlugin.initialize(...initializeParams);
    });
    it('should add in the mapping', async () => {
      expect(daofinPlugin.addJudiciaryMember(Bob.address)).to.not.reverted;
    });
    it('should not add in the mapping', async () => {
      expect(daofinPlugin.connect(Bob.address).addJudiciaryMember(Mike.address))
        .to.reverted;
    });
  });
});
