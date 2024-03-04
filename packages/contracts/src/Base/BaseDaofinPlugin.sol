// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {PluginUUPSUpgradeable} from "@xinfin/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {ProposalUpgradeable} from "@xinfin/osx/core/plugin/proposal/ProposalUpgradeable.sol";
import {IXDCValidator} from "../interfaces/IXdcValidator.sol";
import {IDAO} from "@xinfin/osx/core/dao/IDAO.sol";

error InValidCommittee();
error JudiciaryExist();
error JudiciaryNotExist();
error AddressIsZero();
error SameAddress();
error InValidAddress();
error IsNotCandidate();
error MustBeGreaterThanZero();
error InValidDate();
error VotingPeriodExpired();
error InValidVoter();
error InValidAmount();
error InValidBlockNumber();
error VotedAlready();
error NotReadyToExecute();
error UnexpectedFailure();
error InValidTime();
error CannotCreateProposalWithinElectionPeriod();

abstract contract BaseDaofinPlugin is
    Initializable,
    ERC165Upgradeable,
    PluginUUPSUpgradeable,
    ProposalUpgradeable
{
    enum VoteOption {
        None,
        Abstain,
        Yes,
        No
    }
    struct DaofinGlobalSettings {
        IXDCValidator xdcValidator;
        uint256 houseMinAmount;
    }
    struct CommitteeVotingSettings {
        bytes32 name;
        uint32 supportThreshold;
        uint32 minParticipation;
        uint256 minVotingPower;
    }
    struct VoteInfo {
        bool voted;
        VoteOption option;
    }
    struct TallyDatails {
        bytes32 name;
        uint256 abstain;
        uint256 yes;
        uint256 no;
    }
    struct Proposal {
        bool executed;
        address proposer;
        uint256 proposalTypeId;
        uint256 allowFailureMap;
        uint64 startDate;
        uint64 endDate;
        uint64 snapshotBlock;
        address[] voters;
        IDAO.Action[] actions;
        mapping(address => VoteInfo) voterToInfo;
        mapping(bytes32 => TallyDatails) committeeToTallyDetails;
    }
    struct ElectionPeriod {
        uint64 startDate;
        uint64 endDate;
    }
    struct HouseDeposit {
        uint256 amount;
        uint256 blockNumber;
        bool isActive;
        uint64 startOfCooldownPeriod;
        uint64 endOfCooldownPeriod;
    }
    struct MasterNodeDelegateeMappings {
        mapping(address => address) masterNodeToDelegatee;
        mapping(address => address) delegateeToMasterNode;
        uint256 lastModificationBlocknumber;
        uint256 numberOfJointMasterNodes;
    }
    bytes32 public constant MasterNodeCommittee = keccak256("MASTER_NODE_COMMITTEE");
    bytes32 public constant PeoplesHouseCommittee = keccak256("PEOPLES_HOUSE_COMMITTEE");
    bytes32 public constant JudiciaryCommittee = keccak256("JUDICIARY_COMMITTEE");

    bytes32 public constant UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION =
        keccak256("UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION");

    bytes32 public constant UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION =
        keccak256("UPDATE_COMMITTEE_VOTING_SETTINGS_PERMISSION");

    bytes32 public constant UPDATE_ELECTION_PERIOD_PERMISSION =
        keccak256("UPDATE_ELECTION_PERIOD_PERMISSION");

    bytes32 public constant UPDATE_COMMITTEES_LIST_PERMISSION =
        keccak256("UPDATE_COMMITTEES_LIST_PERMISSION");

    bytes32 public constant UPDATE_JUDICIARY_MAPPING_PERMISSION =
        keccak256("UPDATE_JUDICIARY_MAPPING_PERMISSION");

    bytes32 public constant CREATE_PROPOSAL_TYPE_PERMISSION =
        keccak256("CREATE_PROPOSAL_TYPE_PERMISSION");
    bytes32 public constant UPDATE_PROPOSAL_COSTS_PERMISSION =
        keccak256("UPDATE_PROPOSAL_COSTS_PERMISSION");

    event JudiciaryChanged(address _member, uint256 _action); // action: 0 = Add, 1 = Remove
    event ElectionPeriodUpdated(uint64 _start, uint64 _end);
    event Deposited(address _depositer, uint256 _amount);
    event VoteReceived(
        uint256 _proposalId,
        address _voter,
        bytes32 _committee,
        VoteOption _voteOption
    );
    event MasterNodeDelegateeUpdated(address _masterNode, address _delegatee);
    event ProposalTypeCreated(uint256 _proposalType, CommitteeVotingSettings[] _settings);
    event HouseMinAmountUpdated(uint256 _newAmount);
    event ProposalIdToProposalTypeIdAttached(uint256 _proposalId, uint256 _proposalTypeId);
    event ProposalCostsUpdated(uint256 _newValue);
    event ProposalCostsReceived(uint256 _proposalId, address _proposer, uint256 _cost);
    event HouseResignRequested(address _houseMember, uint256 _amount, uint64 _cooldown);
    event HouseResigned(address _houseMember, uint256 _amount);

    // TODO
    function supportsInterface(
        bytes4
    )
        public
        view
        virtual
        override(ERC165Upgradeable, PluginUUPSUpgradeable, ProposalUpgradeable)
        returns (bool)
    {
        return true;
    }
}
