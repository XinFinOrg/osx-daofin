// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PluginUUPSUpgradeable} from "@xinfin/osx/core/plugin/PluginUUPSUpgradeable.sol";
import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {ProposalUpgradeable} from "@xinfin/osx/core/plugin/proposal/ProposalUpgradeable.sol";
import {IProposal} from "@xinfin/osx/core/plugin/proposal/IProposal.sol";
import {Addresslist} from "@xinfin/osx/plugins/utils/Addresslist.sol";
import {IDAO} from "@xinfin/osx/core/dao/IDAO.sol";
import {IXDCValidator} from "./interfaces/IXdcValidator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {CheckpointsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CheckpointsUpgradeable.sol";
import "hardhat/console.sol";

contract DaofinPlugin is
    Initializable,
    ERC165Upgradeable,
    PluginUUPSUpgradeable,
    ProposalUpgradeable
{
    using SafeCastUpgradeable for uint256;

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

    event JudiciaryAdded(address _member);
    event ElectionPeriodUpdated(uint64 _start, uint64 _end);
    event Deposited(address _depositer, uint256 _amount);

    /// @notice The different voting modes available.
    /// @param Standard In standard mode, early execution is disabled.
    /// @param EarlyExecution In early execution mode, a proposal can be executed early before the end date if the vote outcome cannot mathematically change by more voters voting.
    enum VotingMode {
        Standard,
        EarlyExecution
    }
    enum VoteOption {
        None,
        Abstain,
        Yes,
        No
    }
    struct DaofinGlobalSettings {
        IXDCValidator xdcValidator;
        uint256[] allowedAmounts;
        // ElectionPeriod[] electionPeriods;
    }
    struct CommitteeVotingSettings {
        bytes32 name;
        uint32 supportThreshold;
        uint32 minParticipation;
        uint64 minDuration;
        uint256 minVotingPower;
    }

    struct VoteInfo {
        bool voted;
        VoteOption option;
    }
    enum GrantTiers {
        ONE,
        TWO,
        THREE
    }
    struct DepositInfo {
        address amount;
        uint64 snapshotBlock;
        bool isClaim; // TODO: where can we allow to switch this param?
    }
    /// @notice A container for the proposal vote tally.
    /// @param abstain The number of abstain votes casted.
    /// @param yes The number of yes votes casted.
    /// @param no The number of no votes casted.
    struct TallyDatails {
        bytes32 name;
        uint256 abstain;
        uint256 yes;
        uint256 no;
    }
    struct Proposal {
        bool executed;
        ProposalParameters parameters;
        address proposer;
        mapping(address => VoteInfo) voterToInfo;
        address[] voters;
        // mapping(bytes32 => TallyDatails) committeeToTally;
        IDAO.Action[] actions;
        uint256 allowFailureMap;
    }
    struct ProposalParameters {
        // GrantTiers _tier;
        // uint32 supportThreshold;
        uint64 startDate;
        uint64 endDate;
        uint64 snapshotBlock;
        // uint256 minVotingPower;
    }

    struct ElectionPeriod {
        uint64 startDate;
        uint64 endDate;
    }
    struct SnapshotAmount {
        uint256 amount;
        uint256 blockNumber;
    }
    modifier checkLastProposalBlockNumber() {
        require(getBlockSnapshot() > lastProposalBlockNumber, "Daofin: try later.");
        _;
    }
    // TODO: A rate limiter on creation of proposal like uint256 lastProposalTimestamp
    uint256 lastProposalBlockNumber;
    // Global settings
    DaofinGlobalSettings private _daofinGlobalSettings;

    // proposalId => Proposal Object
    mapping(uint256 => Proposal) private _proposals;

    /* 
        keccake256("<COMMITTEE_NAME>") => CommitteeVotingSettings
        NOTE: Specifies some settings for each defined committees separately
     */
    mapping(bytes32 => CommitteeVotingSettings) private _committeesToVotingSettings;

    /* 
        keccake256("<COMMITTEE_NAME>") => ProposalId => CommitteeVotingSettings
        NOTE: Holds tally numbers for each committee.
    */
    mapping(bytes32 => mapping(uint256 => TallyDatails)) private _committeesToTallyDetails;

    /*
        voter => governanceToken
        NOTE: holds deposited amount to the Dao treasury contract
    */
    mapping(address => SnapshotAmount) public _voterToLockedAmounts;

    //
    mapping(address => uint256[]) private _votersToPropsalIds;
    /* 
        Judiciary address => bool
        NOTE: holds a whitelist mapping
    */
    mapping(address => bool) public _judiciaryCommittee;

    // Holds a list of keccake256("<COMMITTEE_NAME>")
    bytes32[] public _committeesList;

    //
    ElectionPeriod[] private _electionPeriods;

    function deposit() external payable returns (bool) {
        address _voter = _msgSender();
        uint256 _value = msg.value;

        // uint256 snapshotBlock = getBlockSnapshot();

        bool isAllowed = isAllowedAmount(_voter, _value);
        if (!isAllowed) {
            revert("Daofin: invalid amount");
        }
        uint256 blockNumber = getBlockSnapshot();

        require(blockNumber > _voterToLockedAmounts[_voter].blockNumber);

        _voterToLockedAmounts[_voter].amount += _value;
        _voterToLockedAmounts[_voter].blockNumber = blockNumber;

        (bool success, ) = address(dao()).call{value: _value}("");
        require(success, "Daofin: failed");

        emit Deposited(_voter, _value);
        return success;
    }

    // TODO: Complete initialize method
    function initialize(
        IDAO _dao,
        uint256[] calldata allowedAmounts_,
        address xdcValidatorContract_,
        CommitteeVotingSettings[] memory detailedSettings_,
        uint64[] memory electionPeriod_,
        address[] calldata judiciaries_
    ) external initializer {
        __PluginUUPSUpgradeable_init(_dao);
        // // TODO: _updateVotingSetting(_votingSettings);

        // Create a daofinGlobalSettings local variable
        DaofinGlobalSettings memory _settings = getGlobalSettings();

        // A few validation
        // if (settings_.electionPeriods.length == 0) revert();
        if (xdcValidatorContract_ == address(0)) revert();

        // Assign XDC Master Node contract address
        _settings.xdcValidator = IXDCValidator(xdcValidatorContract_);

        // Assign and check Election period
        for (uint256 i; i < electionPeriod_.length; i++) {
            uint64 _startDate = electionPeriod_[i];
            uint64 _endDate = electionPeriod_[i] + 1 weeks;

            _electionPeriods.push(ElectionPeriod(_startDate, _endDate));

            emit ElectionPeriodUpdated(_startDate, _endDate);
        }
        // Assigning committees to the right variables
        for (uint256 i = 0; i < detailedSettings_.length; i++) {
            _committeesToVotingSettings[detailedSettings_[i].name] = detailedSettings_[i];
            _committeesList.push(detailedSettings_[i].name);
        }
        for (uint256 i = 0; i < judiciaries_.length; i++) {
            address judiciary = judiciaries_[i];
            if (judiciary == address(0)) revert();
            _judiciaryCommittee[judiciary] = true;
        }
        _settings.allowedAmounts = allowedAmounts_;
        _daofinGlobalSettings = _settings;
    }

    // TODO: Complete supportsInterface() method - ERC165
    function supportsInterface(
        bytes4 _interfaceId
    )
        public
        view
        virtual
        override(ERC165Upgradeable, PluginUUPSUpgradeable, ProposalUpgradeable)
        returns (bool)
    {}

    function getGlobalSettings() public view returns (DaofinGlobalSettings memory) {
        return _daofinGlobalSettings;
    }

    function getCommitteesToVotingSettings(
        bytes32 committee_
    ) public view returns (CommitteeVotingSettings memory) {
        return _committeesToVotingSettings[committee_];
    }

    function getBlockSnapshot() public view returns (uint256 snapshotBlock) {
        unchecked {
            snapshotBlock = block.number - 1; // The snapshot block must be mined already to protect the transaction against backrunning transactions causing census changes.
        }
    }

    function createProposal(
        bytes calldata _metadata,
        GrantTiers _tier,
        IDAO.Action[] calldata _actions,
        uint256 _electionPeriodIndex,
        uint256 _allowFailureMap
    ) external returns (uint256 _proposalId) {
        address proposer = _msgSender();

        uint256 snapshotBlock = getBlockSnapshot();
        require(snapshotBlock > lastProposalBlockNumber, "Daofin: try later.");
        lastProposalBlockNumber = snapshotBlock;

        // Validate proposal _startDate and _endDate
        DaofinGlobalSettings memory _settings = getGlobalSettings();

        uint64 _startDate = _electionPeriods[_electionPeriodIndex].startDate;
        uint64 _endDate = _electionPeriods[_electionPeriodIndex].endDate;

        if (block.timestamp.toUint64() > _endDate) revert("Daofin: election is ended");

        _proposalId = _createProposal(
            proposer,
            _metadata,
            _startDate,
            _endDate,
            _actions,
            _allowFailureMap
        );

        Proposal storage proposal_ = _proposals[_proposalId];

        // fill out the created proposalId with rest of needed fields
        proposal_.proposer = proposer;

        proposal_.parameters.startDate = _startDate;
        proposal_.parameters.endDate = _endDate;
        proposal_.parameters.snapshotBlock = snapshotBlock.toUint64();
        // proposal_.ope
        // proposal_.parameters._tier = _tier;

        // Reduce costs
        if (_allowFailureMap != 0) {
            proposal_.allowFailureMap = _allowFailureMap;
        }
        // Add actions to created proposal in a for loop
        for (uint256 i; i < _actions.length; ) {
            proposal_.actions.push(_actions[i]);
            unchecked {
                ++i;
            }
        }
        // Boom.. done.
    }

    function vote(
        uint256 _proposalId,
        bytes32 _committee,
        VoteInfo calldata _voteInfo,
        bool _tryEarlyExecution
    ) external {
        // cache msg.sender
        address voter = _msgSender();

        // retrieve proposal Object
        (
            bool open,
            bool executed,
            address proposer,
            address[] memory voters,
            ProposalParameters memory parameters,
            IDAO.Action[] memory actions,
            uint256 allowFailureMap
        ) = getProposal(_proposalId);
        // check if is not open, revert()
        if (!open) revert("Daofin: it is not open");

        // load _votingSettings
        DaofinGlobalSettings memory _settings = getGlobalSettings();

        // A voter must not vote on a proposal twice
        if (isVotedOnProposal(voter, _proposalId)) revert();

        // Check if the supplied amount is in the range of specified values - 0 is place holder
        if (!isAllowedAmount(voter, 0)) revert();

        // Check the voter is belongs to the right committee
        if (!_isValidCommiteeMember(_committee, voter)) revert();
        _votersToPropsalIds[voter].push(_proposalId);

        CommitteeVotingSettings memory cvs = _committeesToVotingSettings[_committee];
        // _updateVote();
        // TODO: minVotingPower must mul to YESs
        // if (_voteInfo.option == VoteOption.Yes) {
        //     _committeesToTallyDetails[_committee][_proposalId].yes =
        //         _committeesToTallyDetails[_committee][_proposalId].yes +
        //         cvs.minVotingPower;
        // } else if (_voteInfo.option == VoteOption.No) {
        //     _committeesToTallyDetails[_committee][_proposalId].no =
        //         _committeesToTallyDetails[_committee][_proposalId].no +
        //         cvs.minVotingPower;
        // } else if (_voteInfo.option == VoteOption.Abstain) {
        //     _committeesToTallyDetails[_committee][_proposalId].abstain =
        //         _committeesToTallyDetails[_committee][_proposalId].abstain +
        //         cvs.minVotingPower;
        // }
    }

    // function _updateVote(uint256 proposalId, _voteInfo) private {
    //     if (_voteInfo.option == VoteOption.Yes) {
    //         _committeesToTallyDetails[_committee][_proposalId].yes =
    //             _committeesToTallyDetails[_committee][_proposalId].yes +
    //             cvs.minVotingPower;
    //     } else if (_voteInfo.option == VoteOption.No) {
    //         _committeesToTallyDetails[_committee][_proposalId].no =
    //             _committeesToTallyDetails[_committee][_proposalId].no +
    //             cvs.minVotingPower;
    //     } else if (_voteInfo.option == VoteOption.Abstain) {
    //         _committeesToTallyDetails[_committee][_proposalId].abstain =
    //             _committeesToTallyDetails[_committee][_proposalId].abstain +
    //             cvs.minVotingPower;
    //     }
    // }

    function execute(uint256 _proposalId) external {
        Proposal storage _proposal = _proposals[_proposalId];
        if (!_canExecute(_proposalId)) revert();
        _proposal.executed = true;
        _executeProposal(dao(), _proposalId, _proposal.actions, _proposal.allowFailureMap);
    }

    function isVotedOnProposal(address _voter, uint256 _proposalId) public view returns (bool) {
        return _proposals[_proposalId].voterToInfo[_voter].voted;
    }

    function _isValidCommiteeMember(
        bytes32 _committee,
        address _voter
    ) private view returns (bool) {
        if (!_isValidCommitteeName(_committee)) return false;
        if (_committee == MasterNodeCommittee) {
            if (!IXDCValidator(_daofinGlobalSettings.xdcValidator).isCandidate(_voter))
                return false;
        } else if (_committee == JudiciaryCommittee) {
            if (!_judiciaryCommittee[_voter]) return false;
        }
        // voter is coming from People's House
        return true;
    }

    function isAllowedAmount(address voter, uint256 balance) private view returns (bool isValid) {
        if (balance == 0) isValid = false;
        uint256[] memory allowedAmounts = getGlobalSettings().allowedAmounts;
        uint256 _total = balance + _voterToLockedAmounts[voter].amount;
        for (uint256 i = 0; i < allowedAmounts.length; i++) {
            if (allowedAmounts[i] == _total) {
                isValid = true;
                break;
            }
        }
    }

    function _isValidCommitteeName(bytes32 _committee) private view returns (bool) {
        if (_committee == bytes32(0)) return false;
        for (uint i = 0; i < _committeesList.length; i++) {
            if (_committeesList[i] == _committee) return true;
        }
        return false;
    }

    function _isProposalOpen(
        ProposalParameters memory parameters,
        bool executed
    ) internal view virtual returns (bool) {
        uint64 currentTime = block.timestamp.toUint64();
        // DaofinGlobalSettings memory _settings = getGlobalSettings();
        return parameters.startDate <= currentTime && currentTime < parameters.endDate && !executed;
    }

    function getProposal(
        uint256 _proposalId
    )
        public
        view
        returns (
            bool open,
            bool executed,
            address proposer,
            address[] memory voters,
            ProposalParameters memory parameters,
            IDAO.Action[] memory actions,
            uint256 allowFailureMap
        )
    {
        open = _isProposalOpen(
            _proposals[_proposalId].parameters,
            _proposals[_proposalId].executed
        );
        return (
            open,
            _proposals[_proposalId].executed,
            _proposals[_proposalId].proposer,
            _proposals[_proposalId].voters,
            _proposals[_proposalId].parameters,
            _proposals[_proposalId].actions,
            _proposals[_proposalId].allowFailureMap
        );
    }

    function _canExecute(uint256 _proposalId) internal view returns (bool isValid) {
        isValid = false;

        (
            bool open,
            bool executed,
            address proposer,
            address[] memory voters,
            ProposalParameters memory parameters,
            IDAO.Action[] memory actions,
            uint256 allowFailureMap
        ) = getProposal(_proposalId);

        // Verify that the proposal has not been executed or expired.
        if (!open) {
            return isValid;
        }
        for (uint256 i = 0; i < _committeesList.length; i++) {
            bytes32 committee = _committeesList[i];
            TallyDatails memory _tallyDetails = _committeesToTallyDetails[committee][_proposalId];
            if (_tallyDetails.yes >= _committeesToVotingSettings[committee].minParticipation) {
                isValid = true;
            } else {
                isValid = false;
            }
        }

        return isValid;
    }

    function getElectionPeriods() public view returns (ElectionPeriod[] memory) {
        return _electionPeriods;
    }

    function isJudiciaryMember(address _member) public view returns (bool) {
        return _judiciaryCommittee[_member];
    }

    function addJudiciaryMember(
        address _member
    ) external auth(UPDATE_JUDICIARY_MAPPING_PERMISSION) {
        if (isJudiciaryMember(_member)) revert();
        _judiciaryCommittee[_member] = true;
        emit JudiciaryAdded(_member);
    }

    function updateElectionPeriod(
        ElectionPeriod[] calldata _periods
    ) public auth(UPDATE_ELECTION_PERIOD_PERMISSION) {
        for (uint256 i; i < _periods.length; i++) {
            uint64 _startDate = _periods[i].startDate;
            uint64 _endDate = _periods[i].startDate + 1 weeks;
            _electionPeriods.push(ElectionPeriod(_startDate, _endDate));
            emit ElectionPeriodUpdated(_startDate, _endDate);
        }
    }

    function updateAllowedAmounts(
        uint256[] calldata _allowedAmount
    ) external auth(UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION) {
        _daofinGlobalSettings.allowedAmounts = _allowedAmount;
    }

    function updateXDCValidatorAddress(
        address _systemContract
    ) external auth(UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION) {
        _daofinGlobalSettings.xdcValidator = IXDCValidator(_systemContract);
    }

    receive() external payable {}
}
