import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {
  DAO,
  DaofinPlugin,
  DaofinPlugin__factory,
  XDCValidator,
} from '../../../typechain';
import {ProposalCreatedEvent} from '../../../typechain/src/DaofinPlugin';
import {deployWithProxy} from '../../../utils/helpers';
import {deployTestDao} from '../../helpers/test-dao';
import {deployXDCValidator} from '../../helpers/test-xdc-validator';
import {PROPOSAL_EVENTS} from '../../helpers/types';
import {createCommitteeVotingSettings} from '../../helpers/utils';
import {
  ADDRESS_ONE,
  ADDRESS_ZERO,
  BYTES32_ZERO,
  JudiciaryCommittee,
  MasterNodeCommittee,
  PeoplesHouseCommittee,
  XdcValidator,
} from '../daofin-common';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {RatioTest, RatioTest__factory} from '@xinfin/osx-ethers';
import {ProposalCreationSteps} from '@xinfin/osx-sdk-client';
import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {formatEther, parseEther} from 'ethers/lib/utils';
import {ethers} from 'hardhat';

export type InitData = {number: BigNumber};
export const defaultInitData: InitData = {
  number: BigNumber.from(123),
};
const {PLUGIN_CONTRACT_NAME} = DaofinPluginSetupParams;
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
  });

  describe('initialize', async () => {
    it('reverts if trying to re-initialize', async () => {
      // const latestBlock = await ethers.provider.getBlock('latest');
      initializeParams = [
        dao.address,
        [parseEther('10')],
        XdcValidator,
        [
          createCommitteeVotingSettings(
            MasterNodeCommittee,
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
          createCommitteeVotingSettings(
            PeoplesHouseCommittee,
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
            JudiciaryCommittee,
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
        expect(startDate).to.be.eq(initializeParams[5][index]);
        expect(endDate).to.be.greaterThanOrEqual(initializeParams[5][index]);
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
      for await (const judiciary of initializeParams[6]) {
        const exist = await daofinPlugin.isJudiciaryMember(judiciary);
        expect(exist).to.be.true;
        expect(judiciary).be.not.eq(ADDRESS_ZERO);
        expect(judiciary).be.not.eq(XdcValidator);
      }
    });
  });
  //   beforeEach(async () => {
  //     initializeParams = [
  //       dao.address,
  //       [parseEther('10')],
  //       XdcValidator,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address, Mike.address, John.address],
  //     ];
  //   });
  //   it('must not revert', async () => {
  //     createPropsalParams = [
  //       '0x00',
  //       [
  //         {
  //           data: '0x00',
  //           to: ADDRESS_ZERO,
  //           value: 0,
  //         },
  //       ],
  //       0,
  //       0,
  //     ];

  //     await daofinPlugin.initialize(...initializeParams);

  //     expect(await daofinPlugin.proposalCount()).to.be.eq(0);
  //     expect(await daofinPlugin.proposalCount()).to.not.be.eq(1);
  //     expect(await daofinPlugin.createProposal(...createPropsalParams)).to.not
  //       .reverted;
  //     expect(await daofinPlugin.proposalCount()).to.not.be.eq(0);
  //     expect(await daofinPlugin.proposalCount()).to.be.eq(1);
  //   });
  //   it('creates unique proposal IDs for each proposal', async () => {
  //     await daofinPlugin.initialize(...initializeParams);

  //     const proposalId0 = await daofinPlugin.callStatic.createProposal(
  //       ...createPropsalParams
  //     );
  //     // create a new proposal for the proposalCounter to be incremented
  //     await expect(daofinPlugin.createProposal(...createPropsalParams)).not.to
  //       .be.reverted;
  //     await ethers.provider.send('evm_mine', []);
  //     const proposalId1 = await daofinPlugin.callStatic.createProposal(
  //       ...createPropsalParams
  //     );

  //     expect(proposalId0).to.equal(0); // To be removed when proposal ID is generated as a hash.
  //     expect(proposalId1).to.equal(1); // To be removed when proposal ID is generated as a hash.

  //     expect(proposalId0).to.not.equal(proposalId1);
  //   });
  //   it('emits the `ProposalCreated` event', async () => {
  //     await daofinPlugin.initialize(...initializeParams);

  //     createPropsalParams = ['0x00', [], 0, 0];

  //     const startDate = await initializeParams[4][0];
  //     const endDate = parseInt(startDate.toString()) + 60 * 60 * 24 * 7;

  //     await expect(daofinPlugin.createProposal(...createPropsalParams))
  //       .to.emit(daofinPlugin, PROPOSAL_EVENTS.PROPOSAL_CREATED)
  //       .withArgs(
  //         0,
  //         Alice.address,
  //         startDate.toString(),
  //         endDate.toString(),
  //         '0x00',
  //         [],
  //         0
  //       );
  //     await ethers.provider.send('evm_mine', []);
  //     await expect(daofinPlugin.createProposal(...createPropsalParams))
  //       .to.emit(daofinPlugin, PROPOSAL_EVENTS.PROPOSAL_CREATED)
  //       .withArgs(
  //         1,
  //         Alice.address,
  //         startDate.toString(),
  //         endDate.toString(),
  //         '0x00',
  //         createPropsalParams[1],
  //         0
  //       );
  //   });
  //   context('After Proposal Created:', async () => {
  //     beforeEach(async () => {
  //       await daofinPlugin.initialize(...initializeParams);
  //       const startDate = await initializeParams[4][0];
  //       const endDate = parseInt(startDate.toString()) + 60 * 60 * 24 * 7;
  //     });
  //     it('proposal should be set in _proposals:', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       await daofinPlugin.createProposal(...createPropsalParams);
  //       const proposal = await daofinPlugin.getProposal(proposalId);

  //       expect(proposal.open).be.eq(true);
  //       expect(proposal.executed).be.eq(false);
  //       expect(proposal.parameters.startDate.toString()).not.be.null;
  //     });
  //     it('proposal should have an open status', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       const tx = await daofinPlugin.createProposal(...createPropsalParams);
  //       const proposal = await daofinPlugin.getProposal(proposalId);
  //       expect(proposal.open).be.eq(true);
  //     });
  //     it('execution should be false in creation of proposal', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       const tx = await daofinPlugin.createProposal(...createPropsalParams);
  //       const proposal = await daofinPlugin.getProposal(proposalId);
  //       expect(proposal.executed).be.eq(false);
  //     });
  //     it('proposer should be tx sender(from)', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       const tx = await daofinPlugin.createProposal(...createPropsalParams);
  //       const proposal = await daofinPlugin.getProposal(proposalId);
  //       expect(proposal.proposer).be.eq(Alice.address);
  //       expect(proposal.proposer).not.be.eq(Bob.address);
  //     });
  //     it('proposer should not be part of any committees', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       expect(await daofinPlugin.createProposal(...createPropsalParams))
  //         .reverted;
  //     });
  //     it('actions should fill', async () => {
  //       createPropsalParams[1] = [
  //         {
  //           data: '0x00',
  //           to: Alice.address,
  //           value: 0,
  //         },
  //       ];
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       const tx = await daofinPlugin.createProposal(...createPropsalParams);
  //       const proposal = await daofinPlugin.getProposal(proposalId);

  //       expect(proposal.actions.length).be.eq(createPropsalParams[1].length);
  //     });
  //   });
  // });
  // describe('deposit', async () => {
  //   let committeesList: string[];
  //   before(async () => {
  //     initializeParams = [
  //       dao.address,
  //       [
  //         parseEther('1'),
  //         parseEther('2'),
  //         parseEther('3'),
  //         parseEther('4'),
  //         parseEther('5'),
  //         parseEther('10'),
  //         parseEther('100'),
  //       ],
  //       XdcValidator,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address, Mike.address, John.address],
  //     ];
  //   });

  //   it('Deposited event should be emitted', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     const value = parseEther('1');
  //     committeesList = await daofinPlugin.getCommitteesList();
  //     for (const committee of committeesList) {
  //       await expect(
  //         daofinPlugin.connect(Alice).deposit({
  //           value: value.toString(),
  //         })
  //       )
  //         .emit(daofinPlugin, 'Deposited')
  //         .withArgs(Alice.address, value);
  //     }
  //   });
  //   it('amount should transfer in dao treasury', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     const value = parseEther('1');
  //     const beforeTreasuryEthBalance = await ethers.provider.getBalance(
  //       dao.address
  //     );
  //     const beforeDaofinEthBalance = await ethers.provider.getBalance(
  //       daofinPlugin.address
  //     );
  //     await daofinPlugin.connect(Alice).deposit({
  //       value: value.toString(),
  //     });
  //     const afterTreasuryEthBalance = await ethers.provider.getBalance(
  //       dao.address
  //     );
  //     const afterDaofinEthBalance = await ethers.provider.getBalance(
  //       daofinPlugin.address
  //     );

  //     expect(afterTreasuryEthBalance.toString()).be.eq(
  //       beforeTreasuryEthBalance.add(value)
  //     );
  //     expect(beforeDaofinEthBalance.toString()).be.eq(
  //       afterDaofinEthBalance.toString()
  //     );
  //   });
  //   it('voterToLockedAmount must be set', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     const value = parseEther('1');
  //     const beforeBalance = await daofinPlugin._voterToLockedAmounts(
  //       Alice.address
  //     );
  //     await daofinPlugin.connect(Alice).deposit({
  //       value: value.toString(),
  //     });
  //     const afterBalance = await daofinPlugin._voterToLockedAmounts(
  //       Alice.address
  //     );

  //     expect(afterBalance.amount.toString()).be.eq(
  //       beforeBalance.amount.add(value).toString()
  //     );
  //   });
  //   it('check voterToLockedAmount - try multiple deposits', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     const value = parseEther('1');
  //     const numberOfTimes = 2;
  //     const beforeBalance = await daofinPlugin._voterToLockedAmounts(
  //       Alice.address
  //     );

  //     expect(beforeBalance.amount.toString()).be.eq('0');

  //     for (let i = 0; i < numberOfTimes; i++) {
  //       await daofinPlugin.connect(Alice).deposit({
  //         value: value.toString(),
  //       });
  //     }
  //     const afterBalance = await daofinPlugin._voterToLockedAmounts(
  //       Alice.address
  //     );

  //     expect(afterBalance.amount.toString()).be.eq(
  //       beforeBalance.amount.add(value.mul(numberOfTimes)).toString()
  //     );
  //   });
  //   it('check dao treasury - try multiple deposits', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     const value = parseEther('1');
  //     const numberOfTimes = 5;
  //     const beforeBalance = await ethers.provider.getBalance(dao.address);

  //     for (let i = 0; i < numberOfTimes; i++) {
  //       await daofinPlugin.connect(Alice).deposit({
  //         value: value.toString(),
  //       });
  //     }
  //     const afterBalance = await ethers.provider.getBalance(dao.address);

  //     expect(afterBalance.toString()).be.eq(
  //       beforeBalance.add(value.mul(numberOfTimes)).toString()
  //     );
  //     expect(afterBalance.toString()).be.not.eq('0');
  //     expect(afterBalance.toString()).be.not.eq(value.toString());
  //   });
  // });
  // describe('find committee', async () => {
  //   let JudiciaryCommittee: string,
  //     MasterNodeCommittee: string,
  //     PeoplesHouseCommittee: string;
  //   before(async () => {
  //     JudiciaryCommittee = await daofinPlugin.JudiciaryCommittee();
  //     MasterNodeCommittee = await daofinPlugin.MasterNodeCommittee();
  //     PeoplesHouseCommittee = await daofinPlugin.PeoplesHouseCommittee();

  //     initializeParams = [
  //       dao.address,
  //       [
  //         parseEther('1'),
  //         parseEther('2'),
  //         parseEther('3'),
  //         parseEther('4'),
  //         parseEther('5'),
  //         parseEther('10'),
  //         parseEther('100'),
  //       ],
  //       XdcValidator,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address],
  //     ];
  //   });

  //   it('should return a right name', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     await daofinPlugin
  //       .connect(Mike)
  //       .deposit({value: parseEther('1').toString()});

  //     expect(await daofinPlugin.findCommitteeName(Mike.address)).be.eq(
  //       PeoplesHouseCommittee
  //     );

  //     expect(await daofinPlugin.findCommitteeName(Bob.address)).eq(
  //       JudiciaryCommittee
  //     );

  //     expect(await daofinPlugin.findCommitteeName(John.address)).be.eq(
  //       BYTES32_ZERO
  //     );
  //   });

  //   it('should not return false for isPeoplesHouse', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     await daofinPlugin
  //       .connect(Mike)
  //       .deposit({value: parseEther('1').toString()});

  //     expect(await daofinPlugin.isPeopleHouse(Mike.address)).be.true;
  //   });
  // });

  // describe('Master Node delegatee', async () => {
  //   let JudiciaryCommittee: string,
  //     MasterNodeCommittee: string,
  //     PeoplesHouseCommittee: string;
  //   before(async () => {
  //     JudiciaryCommittee = await daofinPlugin.JudiciaryCommittee();
  //     MasterNodeCommittee = await daofinPlugin.MasterNodeCommittee();
  //     PeoplesHouseCommittee = await daofinPlugin.PeoplesHouseCommittee();

  //     xdcValidatorMock = await deployXDCValidator(Alice);

  //     initializeParams = [
  //       dao.address,
  //       [
  //         parseEther('1'),
  //         parseEther('2'),
  //         parseEther('3'),
  //         parseEther('4'),
  //         parseEther('5'),
  //         parseEther('10'),
  //         parseEther('100'),
  //       ],
  //       xdcValidatorMock.address,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address],
  //     ];
  //   });

  //   it('should not revert (updateOrJoinMasterNodeDelegatee)', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     await xdcValidatorMock.addCandidate(Mike.address);

  //     expect(
  //       await daofinPlugin
  //         .connect(Mike)
  //         .updateOrJoinMasterNodeDelegatee(John.address)
  //     ).not.reverted;
  //   });
  //   it('should be added to master node mapping', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     await xdcValidatorMock.addCandidate(Mike.address);
  //   });
  //   it('should not be the same or zero address', async () => {
  //     await daofinPlugin.initialize(...initializeParams);

  //     await xdcValidatorMock.addCandidate(Mike.address);

  //     await expect(
  //       daofinPlugin.connect(Mike).updateOrJoinMasterNodeDelegatee(Mike.address)
  //     ).to.reverted;

  //     await expect(
  //       daofinPlugin.connect(Mike).updateOrJoinMasterNodeDelegatee(ADDRESS_ZERO)
  //     ).to.reverted;

  //     await expect(
  //       daofinPlugin.connect(Mike).updateOrJoinMasterNodeDelegatee(Bob.address)
  //     ).to.not.reverted;
  //   });
  //   it('should be emitted', async () => {
  //     await daofinPlugin.initialize(...initializeParams);

  //     await xdcValidatorMock.addCandidate(Mike.address);

  //     await expect(
  //       daofinPlugin.connect(Mike).updateOrJoinMasterNodeDelegatee(John.address)
  //     )
  //       .to.emit(daofinPlugin, 'MasterNodeDelegateeUpdated')
  //       .withArgs(Mike.address, John.address);
  //   });
  // });

  // describe('vote', async () => {
  //   let JudiciaryCommittee: string,
  //     MasterNodeCommittee: string,
  //     PeoplesHouseCommittee: string;
  //   before(async () => {
  //     JudiciaryCommittee = await daofinPlugin.JudiciaryCommittee();
  //     MasterNodeCommittee = await daofinPlugin.MasterNodeCommittee();
  //     PeoplesHouseCommittee = await daofinPlugin.PeoplesHouseCommittee();

  //     xdcValidatorMock = await deployXDCValidator(Alice);

  //     initializeParams = [
  //       dao.address,
  //       [parseEther('10'), parseEther('20'), parseEther('30')],
  //       xdcValidatorMock.address,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 2,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 2,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 0,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address],
  //     ];
  //     createPropsalParams = [
  //       '0x00',
  //       [
  //         {
  //           data: '0x00',
  //           to: ADDRESS_ZERO,
  //           value: 0,
  //         },
  //       ],
  //       0,
  //       0,
  //     ];
  //   });
  //   it('voter should vote once on one proposal', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     const proposalId = await daofinPlugin.callStatic.createProposal(
  //       ...createPropsalParams
  //     );
  //     await daofinPlugin.createProposal(...createPropsalParams);

  //     await xdcValidatorMock.addCandidate(Bob.address);
  //     await expect(
  //       daofinPlugin.connect(Bob).vote(proposalId, '2', false)
  //     ).be.not.revertedWith('Daofin: already voted');
  //     const isVoted = await daofinPlugin.isVotedOnProposal(
  //       Bob.address,
  //       proposalId
  //     );
  //     expect(isVoted).be.true;
  //   });
  //   it('vote must be reverted with in valid voter', async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //     const proposalId = await daofinPlugin.callStatic.createProposal(
  //       ...createPropsalParams
  //     );
  //     await daofinPlugin.createProposal(...createPropsalParams);

  //     await expect(
  //       daofinPlugin.connect(John).vote(proposalId, '2', false)
  //     ).be.revertedWith('Daofin: invalid voter');
  //   });
  //   context('Master Node Committee', async () => {
  //     beforeEach(async () => {
  //       await daofinPlugin.initialize(...initializeParams);
  //       // xdcValidatorMock = await deployXDCValidator(Alice);
  //     });
  //     before(() => {
  //       initializeParams = [
  //         dao.address,
  //         [parseEther('10'), parseEther('20'), parseEther('30')],
  //         xdcValidatorMock.address,
  //         [
  //           {
  //             name: MasterNodeCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 2,
  //             supportThreshold: 1,
  //           },
  //           {
  //             name: JudiciaryCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 2,
  //             supportThreshold: 1,
  //           },
  //           {
  //             name: PeoplesHouseCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 0,
  //             supportThreshold: 1,
  //           },
  //         ],
  //         [Math.floor(Date.now() / 1000)],
  //         [Bob.address],
  //       ];
  //     });
  //     it('voter to info must change after vote()', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       await daofinPlugin.createProposal(...createPropsalParams);
  //       await xdcValidatorMock.addCandidate(Bob.address);

  //       await daofinPlugin.connect(Bob).vote(proposalId, '2', false);

  //       const voteInfo = await daofinPlugin.getProposalVoterToInfo(
  //         proposalId,
  //         Bob.address
  //       );
  //       expect(voteInfo.voted).be.true;
  //       expect(voteInfo.option).be.eq(2);
  //     });

  //     it('voter address must be added into voters array', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       await daofinPlugin.createProposal(...createPropsalParams);
  //       await xdcValidatorMock.addCandidate(Bob.address);

  //       await daofinPlugin.connect(Bob).vote(proposalId, '2', false);

  //       const proposal = await daofinPlugin.getProposal(proposalId);
  //       const findBob = proposal.voters.filter(voter => voter == Bob.address);
  //       expect(findBob.length).be.eq(1);
  //       expect(findBob.length).not.eq(0);
  //     });

  //     it('tally details must change afterwards', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       await daofinPlugin.createProposal(...createPropsalParams);

  //       await xdcValidatorMock.addCandidate(Mike.address);

  //       await daofinPlugin
  //         .connect(Mike)
  //         .updateOrJoinMasterNodeDelegatee(Bob.address);

  //       await daofinPlugin.connect(Bob).vote(proposalId, '2', false);
  //       const votingSettings = await daofinPlugin.getCommitteesToVotingSettings(
  //         MasterNodeCommittee
  //       );

  //       const tallyDetails = await daofinPlugin.getProposalTallyDetails(
  //         proposalId,
  //         MasterNodeCommittee
  //       );

  //       // voting power -> 2
  //       expect(tallyDetails.yes).be.eq(votingSettings.minVotingPower);
  //       expect(tallyDetails.no.toNumber()).be.eq(0);
  //       expect(tallyDetails.abstain.toNumber()).be.eq(0);
  //     });
  //   });
  //   context('Judiciary Committee', async () => {
  //     beforeEach(async () => {
  //       await daofinPlugin.initialize(...initializeParams);
  //     });
  //     before(() => {
  //       initializeParams = [
  //         dao.address,
  //         [parseEther('10'), parseEther('20'), parseEther('30')],
  //         xdcValidatorMock.address,
  //         [
  //           {
  //             name: MasterNodeCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 2,
  //             supportThreshold: 1,
  //           },
  //           {
  //             name: JudiciaryCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 2,
  //             supportThreshold: 1,
  //           },
  //           {
  //             name: PeoplesHouseCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 0,
  //             supportThreshold: 1,
  //           },
  //         ],
  //         [Math.floor(Date.now() / 1000)],
  //         [Bob.address],
  //       ];
  //     });
  //     it('Judicary can vote on proposal and must not be reverted', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       await daofinPlugin
  //         .connect(Alice)
  //         .createProposal(...createPropsalParams);

  //       await expect(daofinPlugin.connect(Bob).vote(proposalId, '2', false)).not
  //         .reverted;
  //     });
  //   });
  //   context('Peoples House Committee', async () => {
  //     beforeEach(async () => {
  //       await daofinPlugin.initialize(...initializeParams);
  //     });
  //     before(async () => {
  //       xdcValidatorMock = await deployXDCValidator(Alice);

  //       initializeParams = [
  //         dao.address,
  //         [parseEther('10'), parseEther('20'), parseEther('30')],
  //         xdcValidatorMock.address,
  //         [
  //           {
  //             name: MasterNodeCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 2,
  //             supportThreshold: 1,
  //           },
  //           {
  //             name: JudiciaryCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 2,
  //             supportThreshold: 1,
  //           },
  //           {
  //             name: PeoplesHouseCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 0,
  //             supportThreshold: 1,
  //           },
  //         ],
  //         [Math.floor(Date.now() / 1000)],
  //         [Bob.address],
  //       ];
  //     });
  //     it('a random address can vote on proposal by deposting and must not be reverted', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       await daofinPlugin
  //         .connect(Alice)
  //         .createProposal(...createPropsalParams);

  //       await daofinPlugin.connect(Mike).deposit({value: parseEther('10')});

  //       await expect(daofinPlugin.connect(Mike).vote(proposalId, '2', false))
  //         .not.reverted;
  //     });
  //     it('check tally details', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       await daofinPlugin
  //         .connect(Alice)
  //         .createProposal(...createPropsalParams);

  //       await daofinPlugin.connect(Mike).deposit({value: parseEther('10')});

  //       await daofinPlugin.connect(Mike).vote(proposalId, '2', false);

  //       const tallyDetailsAfter = await daofinPlugin.getProposalTallyDetails(
  //         proposalId,
  //         PeoplesHouseCommittee
  //       );
  //       const totalDeposit = await daofinPlugin._voterToLockedAmounts(
  //         Mike.address
  //       );
  //       expect(tallyDetailsAfter.yes).to.eq(totalDeposit.amount);
  //     });
  //   });
  //   context('After vote()', async () => {
  //     beforeEach(async () => {
  //       await daofinPlugin.initialize(...initializeParams);
  //     });
  //     before(async () => {
  //       xdcValidatorMock = await deployXDCValidator(Alice);

  //       initializeParams = [
  //         dao.address,
  //         [parseEther('10'), parseEther('20'), parseEther('30')],
  //         xdcValidatorMock.address,
  //         [
  //           {
  //             name: MasterNodeCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 2,
  //             supportThreshold: 1,
  //           },
  //           {
  //             name: JudiciaryCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 2,
  //             supportThreshold: 1,
  //           },
  //           {
  //             name: PeoplesHouseCommittee,
  //             minDuration: 1,
  //             minParticipation: 1,
  //             minVotingPower: 0,
  //             supportThreshold: 1,
  //           },
  //         ],
  //         [Math.floor(Date.now() / 1000)],
  //         [Bob.address],
  //       ];
  //     });
  //     it('must emit event after all the operations', async () => {
  //       const proposalId = await daofinPlugin.callStatic.createProposal(
  //         ...createPropsalParams
  //       );
  //       await daofinPlugin
  //         .connect(Alice)
  //         .createProposal(...createPropsalParams);

  //       await daofinPlugin.connect(Mike).deposit({value: parseEther('10')});

  //       expect(daofinPlugin.connect(Mike).vote(proposalId, '2', false))
  //         .to.emit(daofinPlugin, 'VoteReceived')
  //         .withArgs(
  //           proposalId,
  //           Mike.address,
  //           PeoplesHouseCommittee,
  //           BigNumber.from('2')
  //         );
  //     });
  //   });
  // });
  // describe('canExecute', async () => {
  //   before(async () => {
  //     initializeParams = [
  //       dao.address,
  //       [parseEther('10'), parseEther('20'), parseEther('30')],
  //       XdcValidator,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 2,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 2,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address],
  //     ];
  //     createPropsalParams = [
  //       '0x00',
  //       [
  //         {
  //           data: '0x00',
  //           to: ADDRESS_ZERO,
  //           value: 0,
  //         },
  //       ],
  //       0,
  //       0,
  //     ];
  //   });
  //   it('should return true', async () => {});
  // });
  // describe('Add Judiciary', async () => {
  //   before(async () => {
  //     initializeParams = [
  //       dao.address,
  //       [parseEther('10'), parseEther('20'), parseEther('30')],
  //       XdcValidator,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 2,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 2,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Alice.address],
  //     ];
  //   });
  //   beforeEach(async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //   });
  //   it('should add in the mapping', async () => {
  //     expect(daofinPlugin.addJudiciaryMember(Bob.address)).to.not.reverted;
  //   });
  //   it('should not add in the mapping', async () => {
  //     expect(daofinPlugin.connect(Bob.address).addJudiciaryMember(Mike.address))
  //       .to.reverted;
  //   });
  // });
  // describe('MasterNode Minimum Participation', async () => {
  //   beforeEach(async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //   });
  //   before(async () => {
  //     initializeParams = [
  //       dao.address,
  //       [parseEther('10'), parseEther('20'), parseEther('30')],
  //       xdcValidatorMock.address,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: '1000',
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address],
  //     ];
  //   });
  //   it('all votes must be greater or equal to minimum participations', async () => {
  //     const proposalId = await daofinPlugin.callStatic.createProposal(
  //       ...createPropsalParams
  //     );
  //     await daofinPlugin.createProposal(...createPropsalParams);

  //     await xdcValidatorMock.addCandidate(Mike.address);

  //     await daofinPlugin
  //       .connect(Mike)
  //       .updateOrJoinMasterNodeDelegatee(John.address);

  //     await daofinPlugin.connect(Bob).addJudiciaryMember(Beny.address);

  //     // Vote as MN Senate
  //     await daofinPlugin.connect(John).vote(proposalId, '2', false);

  //     // Vote as Judiciary

  //     await daofinPlugin.connect(Bob).vote(proposalId, '3', false);

  //     // Vote as Judiciary
  //     await daofinPlugin.connect(Beny).vote(proposalId, '1', false);

  //     const mnTally = await daofinPlugin.getProposalTallyDetails(
  //       proposalId,
  //       MasterNodeCommittee
  //     );

  //     const sumOfMnVotes = mnTally.yes.add(mnTally.no).add(mnTally.abstain);
  //     const totalMNs = await xdcValidatorMock.getRealCandidates();
  //     const masterNodeSettings =
  //       await daofinPlugin.getCommitteesToVotingSettings(MasterNodeCommittee);

  //     const minParticipations = await ratio.applyRatioCeiled(
  //       totalMNs,
  //       masterNodeSettings.minParticipation
  //     );

  //     expect(minParticipations.toNumber()).to.lessThanOrEqual(
  //       sumOfMnVotes.toNumber()
  //     );
  //   });
  // });
  // describe('Judiciay Minimum Participation', async () => {
  //   beforeEach(async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //   });
  //   before(async () => {
  //     initializeParams = [
  //       dao.address,
  //       [parseEther('10'), parseEther('20'), parseEther('30')],
  //       xdcValidatorMock.address,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: '1000',
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: '500000',
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: 1,
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address],
  //     ];
  //   });
  //   it('all votes must be greater or equal to minimum participations', async () => {
  //     const proposalId = await daofinPlugin.callStatic.createProposal(
  //       ...createPropsalParams
  //     );
  //     await daofinPlugin.createProposal(...createPropsalParams);

  //     await xdcValidatorMock.addCandidate(Mike.address);

  //     await daofinPlugin
  //       .connect(Mike)
  //       .updateOrJoinMasterNodeDelegatee(John.address);

  //     await daofinPlugin.connect(Bob).addJudiciaryMember(Beny.address);

  //     // Vote as MN Senate
  //     await daofinPlugin.connect(John).vote(proposalId, '2', false);

  //     // Vote as Judiciary

  //     await daofinPlugin.connect(Bob).vote(proposalId, '3', false);

  //     // Vote as Judiciary
  //     await daofinPlugin.connect(Beny).vote(proposalId, '1', false);

  //     const judiciariesTally = await daofinPlugin.getProposalTallyDetails(
  //       proposalId,
  //       JudiciaryCommittee
  //     );

  //     const sumOfMnVotes = judiciariesTally.yes
  //       .add(judiciariesTally.no)
  //       .add(judiciariesTally.abstain);
  //     const totalJudiciaries = await daofinPlugin.getTotalNumberOfJudiciary();
  //     const JudiciarySettings =
  //       await daofinPlugin.getCommitteesToVotingSettings(JudiciaryCommittee);

  //     const minParticipations = await ratio.applyRatioCeiled(
  //       totalJudiciaries,
  //       JudiciarySettings.minParticipation
  //     );

  //     expect(minParticipations.toNumber()).to.lessThanOrEqual(
  //       sumOfMnVotes.toNumber()
  //     );
  //   });
  // });
  // describe('People Minimum Participation', async () => {
  //   beforeEach(async () => {
  //     await daofinPlugin.initialize(...initializeParams);
  //   });
  //   before(async () => {
  //     xdcValidatorMock = await deployXDCValidator(Alice);
  //     initializeParams = [
  //       dao.address,
  //       [parseEther('10'), parseEther('20'), parseEther('30')],
  //       xdcValidatorMock.address,
  //       [
  //         {
  //           name: MasterNodeCommittee,
  //           minDuration: 1,
  //           minParticipation: '1000',
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: JudiciaryCommittee,
  //           minDuration: 1,
  //           minParticipation: '500000',
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //         {
  //           name: PeoplesHouseCommittee,
  //           minDuration: 1,
  //           minParticipation: '100',
  //           minVotingPower: 1,
  //           supportThreshold: 1,
  //         },
  //       ],
  //       [Math.floor(Date.now() / 1000)],
  //       [Bob.address],
  //     ];
  //   });
  //   it('all votes must be greater or equal to minimum participations', async () => {
  //     const proposalId = await daofinPlugin.callStatic.createProposal(
  //       ...createPropsalParams
  //     );
  //     await daofinPlugin.createProposal(...createPropsalParams);

  //     await daofinPlugin.connect(Beny).deposit({
  //       value: parseEther('10').toString(),
  //     });

  //     await daofinPlugin.connect(Mike).deposit({
  //       value: parseEther('10').toString(),
  //     });

  //     await daofinPlugin.connect(John).deposit({
  //       value: parseEther('10').toString(),
  //     });

  //     // Vote as People
  //     await daofinPlugin.connect(John).vote(proposalId, '2', false);

  //     // Vote as People
  //     await daofinPlugin.connect(Mike).vote(proposalId, '2', false);

  //     // Vote as Judiciary
  //     await daofinPlugin.connect(Bob).vote(proposalId, '3', false);

  //     // Vote as People
  //     await daofinPlugin.connect(Beny).vote(proposalId, '1', false);

  //     const peopleTally = await daofinPlugin.getProposalTallyDetails(
  //       proposalId,
  //       PeoplesHouseCommittee
  //     );

  //     const sumOfVotes = peopleTally.yes
  //       .add(peopleTally.no)
  //       .add(peopleTally.abstain);

  //     const totalSupply = await daofinPlugin.getXDCTotalSupply();

  //     const peopleSettings = await daofinPlugin.getCommitteesToVotingSettings(
  //       PeoplesHouseCommittee
  //     );

  //     const minParticipations = await ratio.applyRatioCeiled(
  //       totalSupply,
  //       peopleSettings.minParticipation
  //     );
  //     const isGte = sumOfVotes.gte(minParticipations);
  //     expect(isGte).to.be.true;
  //   });
  // });
});
