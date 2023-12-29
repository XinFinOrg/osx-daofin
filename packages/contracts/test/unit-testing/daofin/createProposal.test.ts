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
import {
  createCommitteeVotingSettings,
  createProposalParams,
} from '../../helpers/utils';
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

    initializeParams = [
      dao.address,
      [parseEther('10')],
      XdcValidator,

      [
        createCommitteeVotingSettings(
          MasterNodeCommittee,
          '1000',
          '1000',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          JudiciaryCommittee,
          '1000',
          '1000',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          PeoplesHouseCommittee,
          '1000',
          '1000',
          parseEther('1')
        ),
      ],
      [
        createCommitteeVotingSettings(
          MasterNodeCommittee,
          '1000',
          '1000',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          JudiciaryCommittee,
          '1000',
          '1000',
          parseEther('1')
        ),
        createCommitteeVotingSettings(
          PeoplesHouseCommittee,
          '1000',
          '1000',
          parseEther('1')
        ),
      ],
      [Math.floor(Date.now() / 1000)],
      [Bob.address, Mike.address, John.address],
    ];

    await daofinPlugin.initialize(...initializeParams);
  });

  describe('create proposal', async () => {
    it('must not revert', async () => {
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '0'
      );

      expect(await daofinPlugin.proposalCount()).to.be.eq(0);
      expect(await daofinPlugin.proposalCount()).to.not.be.eq(1);
      expect(await daofinPlugin.createProposal(...createPropsalParams)).to.not
        .reverted;
      expect(await daofinPlugin.proposalCount()).to.not.be.eq(0);
      expect(await daofinPlugin.proposalCount()).to.be.eq(1);
    });
    it('creates unique proposal IDs for each proposal', async () => {
      createPropsalParams = createProposalParams('0x00', [], '1', '0', '0');

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
      createPropsalParams = createProposalParams(
        '0x00',
        [],
        '1',
        '0',
        '0',
        '1'
      );

      const startDate = initializeParams[5][0];
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
        const startDate = initializeParams[5][0];
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
      it('proposer should not be part of any committees', async () => {
        const proposalId = await daofinPlugin.callStatic.createProposal(
          ...createPropsalParams
        );
        expect(await daofinPlugin.createProposal(...createPropsalParams))
          .reverted;
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
});
