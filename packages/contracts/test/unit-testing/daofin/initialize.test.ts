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
        [Math.floor(new Date().getTime() / 1000) + 60 * 1000 * 60],
        [ADDRESS_ONE],
        '10',
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

      const amount = globalSettings.houseMinAmount;
      const number = parseFloat(formatEther(amount));
      expect(number).not.be.NaN;
      expect(number).not.be.greaterThan(parseEther('1000'));
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
      const proposalTypeCount = await daofinPlugin.proposalTypeCount();

      for (
        let proposalType = 0;
        proposalType < proposalTypeCount.toNumber();
        proposalType++
      ) {
        for (let i = 0; i < committeesList.length; i++) {
          const settings = await daofinPlugin.getCommitteesToVotingSettings(
            proposalType,
            committeesList[i]
          );

          expect(settings.name).to.equal(initializeParams[4][i].name);

          expect(settings.minParticipation)
            .to.greaterThan(0)
            .to.equal(
              parseInt(initializeParams[4][i].minParticipation.toString())
            );

          expect(settings.minVotingPower)
            .to.greaterThan(0)
            .to.equal(initializeParams[3][i].minVotingPower.toString());

          expect(settings.supportThreshold)
            .to.greaterThan(0)
            .to.equal(
              parseInt(initializeParams[3][i].supportThreshold.toString())
            );
        }
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
    it('proposalCosts must be set and be correct', async () => {
      await daofinPlugin.initialize(...initializeParams);
      const proposalCosts = await daofinPlugin.proposalCosts();

      expect(proposalCosts.toString()).not.be.greaterThan(
        parseEther(initializeParams[7].toString())
      );
    });
  });
});
