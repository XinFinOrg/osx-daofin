import {DaofinPluginSetupParams} from '../../../plugin-settings';
import {
  DaofinPlugin,
  DaofinPlugin__factory,
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

    await xdcValidatorMock.addCandidate(Bob.address);
    await xdcValidatorMock.addCandidate(Mike.address);
  });

  beforeEach(async () => {
    daofinPlugin = await deployWithProxy<DaofinPlugin>(DaofinPlugin);
    const now = Math.floor(new Date().getTime() / 1000);

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
        BigNumber.from(now + 60 * 60 * 24 * 5),
      ],
      [Bob.address],
      parseEther('1'),
    ];
    await daofinPlugin.initialize(...initializeParams);
  });
  describe('Add Jury', async () => {
    it('Only DAO is allowed to change', async () => {
      const daoTreasury = Alice;
      await expect(
        daofinPlugin
          .connect(daoTreasury)
          .addJudiciaryMembers([John.address, Mike.address, Beny.address])
      ).reverted;

      await dao.grant(
        daofinPlugin.address,
        Alice.address,
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID
      );
      await expect(
        daofinPlugin
          .connect(daoTreasury)
          .addJudiciaryMembers([John.address, Mike.address, Beny.address])
      ).not.reverted;
    });

    it('must not accept zero address', async () => {
      const daoTreasury = Alice;

      await dao.grant(
        daofinPlugin.address,
        Alice.address,
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID
      );
      await expect(
        daofinPlugin
          .connect(daoTreasury)
          .addJudiciaryMembers([John.address, Mike.address, ADDRESS_ZERO])
      ).reverted;
    });

    it('must revert for duplicated address', async () => {
      const daoTreasury = Alice;

      await dao.grant(
        daofinPlugin.address,
        Alice.address,
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID
      );
      await expect(
        daofinPlugin
          .connect(daoTreasury)
          .addJudiciaryMembers([Bob.address, Mike.address])
      ).reverted;
    });
    it('must bump the counter', async () => {
      const daoTreasury = Alice;

      await dao.grant(
        daofinPlugin.address,
        Alice.address,
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID
      );

      const beforeJuryCount = await daofinPlugin._judiciaryCommitteeCount();

      const newMembers = [John.address, Mike.address, Beny.address];
      await daofinPlugin
        .connect(daoTreasury)
        .addJudiciaryMembers([John.address, Mike.address, Beny.address]);

      const afterJuryCount = await daofinPlugin._judiciaryCommitteeCount();

      expect(beforeJuryCount.add(newMembers.length)).eq(afterJuryCount);
    });

    it('must add to mapping', async () => {
      const daoTreasury = Alice;

      await dao.grant(
        daofinPlugin.address,
        Alice.address,
        UPDATE_JUDICIARY_MAPPING_PERMISSION_ID
      );

      const newMembers = [John.address, Mike.address, Beny.address];

      await daofinPlugin
        .connect(daoTreasury)
        .addJudiciaryMembers([John.address, Mike.address, Beny.address]);

      newMembers.forEach(async member => {
        const isMember = await daofinPlugin._judiciaryCommittee(member);
        expect(isMember).to.be.true;
      });
    });
  });
});
