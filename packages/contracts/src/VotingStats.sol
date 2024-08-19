// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

interface IDAOFIN {
    struct TallyDatails {
        bytes32 name;
        uint256 abstain;
        uint256 yes;
        uint256 no;
    }
    struct CommitteeVotingSettings {
        bytes32 name;
        uint32 supportThreshold;
        uint32 minParticipation;
    }

    function getProposalTallyDetails(
        uint256 proposalId_,
        bytes32 committee_
    ) external view returns (TallyDatails memory);

    function getCommitteesList() external view returns (bytes32[] memory);

    function getTotalNumberOfMembersByCommittee(bytes32) external view returns (uint256);

    function getCommitteesToVotingSettings(
        uint256,
        bytes32
    ) external view returns (CommitteeVotingSettings memory);

    function joinHouse() external returns (bool);
}

contract VotingStats is Initializable {
    IDAOFIN public daofin;

    constructor(address daofin_) {
        daofin = IDAOFIN(daofin_);
    }

    function changeDAO(address daofin_) external {
        daofin = IDAOFIN(daofin_);
    }

    struct CommunityReturnType {
        bytes32 name;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 abstainVotes;
        uint256 totalVotes;
        uint256 currentQuorumNumber;
        uint256 currentPassrateNumber;
        uint256 requiredQuorumNumber;
        uint256 requiredPassrateNumber;
        uint256 totalNumberOfVoters;
        uint256 currentQuorumNumberRatio;
        uint256 currentPassrateRatio;
        uint256 requiredQuorumNumberRatio;
        uint256 currentPassrateNumberRatio;
        uint256 requiredPassrateNumberRatio;
        uint256 status;
    }

    function stats(
        uint256 proposalId,
        uint256 proposalTypeId
    ) external view returns (CommunityReturnType[] memory communities) {
        bytes32[] memory committees = daofin.getCommitteesList();

        communities = new CommunityReturnType[](3);
        for (uint256 i = 0; i < committees.length; ++i) {
            bytes32 committee_ = committees[i];
            communities[i].name = committee_;
            IDAOFIN.TallyDatails memory td_ = daofin.getProposalTallyDetails(
                proposalId,
                committee_
            );
            uint256 totalVotes = td_.yes + td_.no + td_.abstain;
            uint256 totalCommunity = daofin.getTotalNumberOfMembersByCommittee(committee_);

            IDAOFIN.CommitteeVotingSettings memory cvs_ = daofin.getCommitteesToVotingSettings(
                proposalTypeId,
                committee_
            );
            uint32 minParticipation = cvs_.minParticipation;
            uint256 appliedRatioToTotalCommunity = _applyRatioCeiled(
                totalCommunity,
                minParticipation
            );
            uint256 appliedRatioToTotalVotes = totalVotes;

            communities[i].yesVotes = td_.yes;
            communities[i].noVotes = td_.no;
            communities[i].abstainVotes = td_.abstain;

            communities[i].totalNumberOfVoters = totalCommunity;

            communities[i].totalVotes = totalVotes;
            communities[i].requiredQuorumNumber = appliedRatioToTotalCommunity;
            communities[i].currentQuorumNumber = appliedRatioToTotalVotes;
            communities[i].currentQuorumNumberRatio =
                (appliedRatioToTotalVotes * 100) /
                totalCommunity;
            communities[i].requiredQuorumNumberRatio =
                (appliedRatioToTotalCommunity * 100) /
                totalCommunity;

            totalVotes = td_.yes;

            uint32 passrate = cvs_.supportThreshold;
            appliedRatioToTotalCommunity = _applyRatioCeiled(totalCommunity, passrate);
            appliedRatioToTotalVotes = totalVotes;
            communities[i].requiredPassrateNumber = appliedRatioToTotalCommunity;
            communities[i].currentPassrateRatio = appliedRatioToTotalVotes;
            communities[i].currentPassrateNumberRatio =
                (appliedRatioToTotalVotes * 100) /
                totalCommunity;
            communities[i].requiredPassrateNumberRatio =
                (appliedRatioToTotalCommunity * 100) /
                totalCommunity;
        }
    }
}
