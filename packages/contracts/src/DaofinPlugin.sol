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
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {_applyRatioCeiled, RATIO_BASE} from "@xinfin/osx/plugins/utils/Ratio.sol";

contract DaofinPlugin is
    Initializable,
    ERC165Upgradeable,
    PluginUUPSUpgradeable,
    ProposalUpgradeable
{
    using SafeCastUpgradeable for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;
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
        uint256 houseMinAmount;
        // ElectionPeriod[] _electionPeriods;
    }
    struct CommitteeVotingSettings {
        bytes32 name;
        uint32 supportThreshold;
        uint32 minParticipation;
        // uint64 minDuration;
        uint256 minVotingPower;
    }

    struct VoteInfo {
        bool voted;
        VoteOption option;
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
        address proposer;
        uint256 proposalTypeId;
        uint256 allowFailureMap;
        uint64 startDate;
        uint64 endDate;
        uint64 snapshotBlock;
        address[] voters;
        IDAO.Action[] actions;
        mapping(address => VoteInfo) voterToInfo;
        mapping(bytes32 => TallyDatails) committeeToTallyDatails;
    }

    struct ElectionPeriod {
        uint64 startDate;
        uint64 endDate;
    }
    struct SnapshotAmount {
        uint256 amount;
        uint256 blockNumber;
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

    // A rate limiter on creation of proposal
    uint256 lastProposalBlockNumber;

    // Global settings
    DaofinGlobalSettings private _daofinGlobalSettings;

    // proposalId => Proposal Object
    mapping(uint256 => Proposal) public _proposals;

    /* 
        keccake256("<COMMITTEE_NAME>") => CommitteeVotingSettings
        NOTE: Specifies some settings for each defined committees separately
    */
    mapping(bytes32 => CommitteeVotingSettings) private _committeesToVotingSettings;

    /*
        voter => SnapshotAmount
        NOTE: holds deposited amount to the Dao treasury contract
    */
    mapping(address => SnapshotAmount) public _voterToLockedAmounts;

    // /*
    //     A voter address => list of proposalIDs
    //     NOTE: holds a whitelist mapping
    // */
    // mapping(address => uint256[]) private _votersToProposalIds;
    /* 
        Judiciary address => bool
        NOTE: holds a whitelist mapping
    */
    mapping(address => bool) public _judiciaryCommittee;
    uint256 public _judiciaryCommitteeCount;
    /* 
        NOTE: holds a master node delegatee whitelist mapping
    */
    MasterNodeDelegateeMappings public _masterNodeDelegatee;

    // Holds a list of keccake256("<COMMITTEE_NAME>")
    bytes32[] public _committeesList;

    //
    ElectionPeriod[] private _electionPeriods;

    /// @notice The incremental ID for proposal types.
    CountersUpgradeable.Counter private proposalTypeCounter;

    mapping(uint256 => mapping(bytes32 => CommitteeVotingSettings))
        private _proposalTypesToCommiteesVotingSettings;

    uint256 public proposalCosts;

    function joinHouse() external payable returns (bool) {
        address _member = _msgSender();
        uint256 _value = msg.value;

        bool isAllowed = getGlobalSettings().houseMinAmount <= _value;
        if (!isAllowed) {
            revert("Daofin: invalid amount");
        }
        uint256 snapshotBlockNumber = getBlockSnapshot();

        require(snapshotBlockNumber > _voterToLockedAmounts[_member].blockNumber);

        if (isMasterNodeDelegatee(_member)) revert();
        if (isJudiciaryMember(_member)) revert();
        if (getGlobalSettings().xdcValidator.isCandidate(_member)) revert();

        _voterToLockedAmounts[_member].amount += _value;
        _voterToLockedAmounts[_member].blockNumber = snapshotBlockNumber;

        (bool success, ) = address(dao()).call{value: _value}("");
        require(success, "Daofin: failed");

        emit Deposited(_member, _value);
        return success;
    }

    // TODO: Complete initialize method
    function initialize(
        IDAO _dao,
        uint256 allowedAmount_,
        address xdcValidatorContract_,
        CommitteeVotingSettings[] memory grantSettings_,
        CommitteeVotingSettings[] memory generalSettings_,
        uint64[] memory electionPeriod_,
        address[] calldata judiciaries_,
        uint256 proposalCosts_
    ) external initializer {
        __PluginUUPSUpgradeable_init(_dao);

        // Create a daofinGlobalSettings local variable
        DaofinGlobalSettings memory _settings = getGlobalSettings();

        // A few validation
        if (xdcValidatorContract_ == address(0)) revert();

        // Assign XDC Master Node contract address
        _settings.xdcValidator = IXDCValidator(xdcValidatorContract_);

        // Assign and check Election period
        for (uint256 i; i < electionPeriod_.length; i++) {
            uint64 _startDate = electionPeriod_[i];
            uint64 _endDate = electionPeriod_[i] + 2 weeks;

            _electionPeriods.push(ElectionPeriod(_startDate, _endDate));

            emit ElectionPeriodUpdated(_startDate, _endDate);
        }

        proposalCosts = proposalCosts_;
        emit ProposalCostsUpdated(proposalCosts_);

        _committeesList.push(MasterNodeCommittee);
        _committeesList.push(PeoplesHouseCommittee);
        _committeesList.push(JudiciaryCommittee);
        // 0 = proposalType - Grants
        _createProposalType(grantSettings_);

        // 1 = proposalType - Creation of proposalType
        _createProposalType(generalSettings_);

        // 2 = proposalType - Changing voting settings
        _createProposalType(generalSettings_);

        // 3 = proposalType - ElectionPeriods
        _createProposalType(generalSettings_);

        // 4 = proposalType - Judiciary Replacement
        _createProposalType(generalSettings_);

        // 5 = proposalCosts - Proposal Costs
        _createProposalType(generalSettings_);

        _addJudiciaryMember(judiciaries_);

        _settings.houseMinAmount = allowedAmount_;
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
    {
        return true;
    }

    function getGlobalSettings() public view returns (DaofinGlobalSettings memory) {
        return _daofinGlobalSettings;
    }

    function getCommitteesToVotingSettings(
        uint256 proposalTypeId_,
        bytes32 committee_
    ) public view returns (CommitteeVotingSettings memory) {
        // return _committeesToVotingSettings[committee_];
        return _proposalTypesToCommiteesVotingSettings[proposalTypeId_][committee_];
    }

    function getBlockSnapshot() public view returns (uint256 snapshotBlock) {
        unchecked {
            snapshotBlock = block.number - 1; // The snapshot block must be mined already to protect the transaction against backrunning transactions causing census changes.
        }
    }

    function createProposal(
        bytes calldata _metadata,
        IDAO.Action[] calldata _actions,
        uint256 _electionPeriodIndex,
        uint256 _proposalType,
        uint256 _allowFailureMap,
        VoteOption _voteOption
    ) external payable returns (uint256 _proposalId) {
        address proposer = _msgSender();

        _checkProposalCostsAndTransfer();

        require(proposalTypeCount() > _proposalType);

        (uint64 _startDate, uint64 _endDate) = _checkElectionPeriod(_electionPeriodIndex);
        _proposalId = _createProposal(
            proposer,
            _metadata,
            _startDate,
            _endDate,
            _actions,
            _allowFailureMap
        );
        _proposals[_proposalId].proposalTypeId = _proposalType;
        emit ProposalIdToProposalTypeIdAttached(_proposalId, _proposalType);
        // Boom.. done.

        _updateVote(_proposalType, _proposalId, proposer, _voteOption);
    }

    function _createProposal(
        address _creator,
        bytes calldata _metadata,
        uint64 _startDate,
        uint64 _endDate,
        IDAO.Action[] calldata _actions,
        uint256 _allowFailureMap
    ) internal override returns (uint256 _proposalId) {
        _proposalId = super._createProposal(
            _creator,
            _metadata,
            _startDate,
            _endDate,
            _actions,
            _allowFailureMap
        );

        Proposal storage proposal_ = _proposals[_proposalId];

        // fill out the created proposalId with rest of needed fields
        proposal_.proposer = _creator;

        proposal_.startDate = _startDate;
        proposal_.endDate = _endDate;
        proposal_.snapshotBlock = getBlockSnapshot().toUint64();

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
    }

    function _updateVote(
        uint256 proposalTypeId_,
        uint256 proposalId_,
        address voter_,
        VoteOption voteOption_
    ) private {
        bytes32 committee = findCommitteeName(voter_);

        if (voteOption_ == VoteOption.None) return;

        if (committee == bytes32(0)) revert("Daofin: invalid voter");

        CommitteeVotingSettings memory cvs = getCommitteesToVotingSettings(
            proposalTypeId_,
            committee
        );
        TallyDatails memory td = getProposalTallyDetails(proposalId_, committee);

        if (committee == PeoplesHouseCommittee) {
            if (_voterToLockedAmounts[voter_].amount >= getGlobalSettings().houseMinAmount) {
                uint256 votingPower = _voterToLockedAmounts[voter_].amount;
                if (voteOption_ == VoteOption.Yes) {
                    td.yes += votingPower;
                } else if (voteOption_ == VoteOption.No) {
                    td.no += votingPower;
                } else if (voteOption_ == VoteOption.Abstain) {
                    td.abstain += votingPower;
                }
            } else {
                revert();
            }
        } else {
            if (voteOption_ == VoteOption.Yes) {
                td.yes += cvs.minVotingPower;
            } else if (voteOption_ == VoteOption.No) {
                td.no += cvs.minVotingPower;
            } else if (voteOption_ == VoteOption.Abstain) {
                td.abstain += cvs.minVotingPower;
            }
        }
        _proposals[proposalId_].committeeToTallyDatails[committee] = td;
        _proposals[proposalId_].voters.push(voter_);
        _proposals[proposalId_].voterToInfo[voter_] = VoteInfo(true, voteOption_);

        emit VoteReceived(proposalId_, voter_, committee, voteOption_);
    }

    function vote(uint256 _proposalId, VoteOption _voteOption, bool _tryEarlyExecution) external {
        // cache msg.sender
        address voter = _msgSender();

        // retrieve proposal Object
        (bool open, , , uint256 proposalTypeId) = getProposal(_proposalId);
        // check if is not open, revert()
        if (!open) revert("Daofin: it is not open");
        // if (proposer == voter) revert("Daofin: voter cannot vote on the proposal");

        // A voter must not vote on a proposal twice
        if (isVotedOnProposal(voter, _proposalId)) revert("Daofin: already voted");

        // Check if the supplied amount is in the range of specified values - 0 is place holder
        // if (!isAllowedAmount(voter, 0)) revert("Daofin: deposit first");

        _updateVote(proposalTypeId, _proposalId, voter, _voteOption);
    }

    function execute(uint256 _proposalId) external {
        _execute(_proposalId);
    }

    function _execute(uint256 _proposalId) private {
        Proposal storage _proposal = _proposals[_proposalId];
        if (!_canExecute(_proposalId)) revert();
        _proposal.executed = true;
        _executeProposal(dao(), _proposalId, _proposal.actions, _proposal.allowFailureMap);
    }

    function isVotedOnProposal(address _voter, uint256 _proposalId) public view returns (bool) {
        return _proposals[_proposalId].voterToInfo[_voter].voted;
    }

    function isAllowedAmount(uint256 balance) private view returns (bool) {
        if (balance == 0) return false;
        return getGlobalSettings().houseMinAmount >= balance;
    }

    function _isValidCommitteeName(bytes32 _committee) private view returns (bool) {
        if (_committee == bytes32(0)) return false;
        for (uint i = 0; i < _committeesList.length; i++) {
            if (_committeesList[i] == _committee) return true;
        }
        return false;
    }

    function _isProposalOpen(
        uint64 startDate,
        uint64 endDate,
        bool executed
    ) internal view virtual returns (bool) {
        uint64 currentTime = block.timestamp.toUint64();
        return startDate <= currentTime && currentTime < endDate && !executed;
    }

    function getProposal(
        uint256 _proposalId
    ) public view returns (bool open, bool executed, address proposer, uint256 proposalTypeId) {
        open = _isProposalOpen(
            _proposals[_proposalId].startDate,
            _proposals[_proposalId].endDate,
            _proposals[_proposalId].executed
        );
        return (
            open,
            _proposals[_proposalId].executed,
            _proposals[_proposalId].proposer,
            _proposals[_proposalId].proposalTypeId
        );
    }

    function _canExecute(uint256 _proposalId) private view returns (bool isValid) {
        (bool open, bool executed, , ) = getProposal(_proposalId);

        // Verify that the proposal has not been executed or expired.
        if (!open && executed) {
            return false;
        }
        if (!isMinParticipationReached(_proposalId)) return false;
        if (!isThresholdReached(_proposalId)) return false;

        return true;
    }

    function canExecute(uint256 _proposalId) external view returns (bool isValid) {
        return _canExecute(_proposalId);
    }

    function getElectionPeriods() public view returns (ElectionPeriod[] memory) {
        return _electionPeriods;
    }

    function getCommitteesList() public view returns (bytes32[] memory) {
        return _committeesList;
    }

    function isJudiciaryMember(address _member) public view returns (bool) {
        return _judiciaryCommittee[_member];
    }

    function _createProposalTypeId() internal returns (uint256 proposalTypeId) {
        proposalTypeId = proposalTypeCount();
        proposalTypeCounter.increment();

        // TODO: emit proper event
    }

    function createProposalType(
        CommitteeVotingSettings[] memory _committeesVotingSettings
    ) public auth(CREATE_PROPOSAL_TYPE_PERMISSION) returns (uint256 proposalTypeId) {
        return _createProposalType(_committeesVotingSettings);
    }

    function _createProposalType(
        CommitteeVotingSettings[] memory _committeesVotingSettings
    ) private returns (uint256 proposalTypeId) {
        proposalTypeId = _createProposalTypeId();

        require(_committeesVotingSettings.length > 0, "invalid settings length");

        // Assigning committees to the right variables
        for (uint256 i = 0; i < _committeesVotingSettings.length; i++) {
            bytes32 committeeName = _committeesVotingSettings[i].name;
            if (committeeName == bytes32(0)) revert("invalid committee name");
            if (
                !(committeeName == MasterNodeCommittee ||
                    committeeName == PeoplesHouseCommittee ||
                    committeeName == JudiciaryCommittee)
            ) {
                revert("Invalid Committee name");
            }
            _proposalTypesToCommiteesVotingSettings[proposalTypeId][
                committeeName
            ] = _committeesVotingSettings[i];
        }
        emit ProposalTypeCreated(proposalTypeId, _committeesVotingSettings);
    }

    function proposalTypeCount() public view returns (uint256) {
        return proposalTypeCounter.current();
    }

    // TODO: Add auth(UPDATE_JUDICIARY_MAPPING_PERMISSION) modifier
    function addJudiciaryMembers(
        address[] memory _members
    ) public auth(UPDATE_JUDICIARY_MAPPING_PERMISSION) {
        _addJudiciaryMember(_members);
    }

    function _addJudiciaryMember(address[] memory _members) private {
        for (uint256 i = 0; i < _members.length; i++) {
            if (isJudiciaryMember(_members[i])) revert();
            if (_members[i] == address(0)) revert();
            _judiciaryCommittee[_members[i]] = true;
            _judiciaryCommitteeCount++;
            emit JudiciaryChanged(_members[i], 0);
        }
    }

    function removeJudiciaryMember(
        address _member
    ) external auth(UPDATE_JUDICIARY_MAPPING_PERMISSION) {
        _removeJudiciaryMember(_member);
    }

    function _removeJudiciaryMember(address _member) private {
        if (_member == address(0)) revert();
        if (!isJudiciaryMember(_member)) revert();
        delete _judiciaryCommittee[_member];
        _judiciaryCommitteeCount--;
        emit JudiciaryChanged(_member, 1);
    }

    function updateElectionPeriod(
        ElectionPeriod[] calldata _periods
    ) public auth(UPDATE_ELECTION_PERIOD_PERMISSION) {
        for (uint256 i; i < _periods.length; i++) {
            uint64 _startDate = _periods[i].startDate;
            uint64 _endDate = _periods[i].startDate + _periods[i].endDate;
            _electionPeriods.push(ElectionPeriod(_startDate, _endDate));
            emit ElectionPeriodUpdated(_startDate, _endDate);
        }
    }

    function updateAllowedAmounts(
        uint256 _allowedAmount
    ) external auth(UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION) {
        _daofinGlobalSettings.houseMinAmount = _allowedAmount;
        emit HouseMinAmountUpdated(_allowedAmount);
    }

    function updateXDCValidatorAddress(
        address _systemContract
    ) external auth(UPDATE_DAO_FIN_VOTING_SETTINGS_PERMISSION) {
        _daofinGlobalSettings.xdcValidator = IXDCValidator(_systemContract);
        // TODO: Emit XDCValidatorAddressUpdated
    }

    function updateOrJoinMasterNodeDelegatee(address delegatee_) external {
        address masterNode = _msgSender();

        if (masterNode == address(0)) revert();
        if (delegatee_ == address(0)) revert();

        if (masterNode == delegatee_) revert();

        if (!getGlobalSettings().xdcValidator.isCandidate(masterNode)) revert();

        // Store in mapping and reverse mappings
        _updateMasterNodeDelegatee(masterNode, delegatee_);

        // TODO: Emit XDCValidatorAddressUpdated
        emit MasterNodeDelegateeUpdated(masterNode, delegatee_);
    }

    function _updateMasterNodeDelegatee(address masterNode_, address delegatee_) private {
        address _delegatee = _masterNodeDelegatee.masterNodeToDelegatee[masterNode_];
        address _masterNode = _masterNodeDelegatee.delegateeToMasterNode[delegatee_];

        if (_delegatee == address(0) && _masterNode == address(0)) {
            _masterNodeDelegatee.numberOfJointMasterNodes++;
        }

        _masterNodeDelegatee.masterNodeToDelegatee[masterNode_] = delegatee_;
        _masterNodeDelegatee.delegateeToMasterNode[delegatee_] = masterNode_;
    }

    function updateProposalCosts(
        uint256 _newValue
    ) external auth(UPDATE_PROPOSAL_COSTS_PERMISSION) {
        require(_newValue > 0);
        proposalCosts = _newValue;
        emit ProposalCostsUpdated(_newValue);
    }

    function _checkElectionPeriod(uint256 _electionIndex) private view returns (uint64, uint64) {
        uint64 _startDate = _electionPeriods[_electionIndex].startDate;
        uint64 _endDate = _electionPeriods[_electionIndex].endDate;

        require(_startDate != 0 || _endDate != 0);
        if (block.timestamp.toUint64() > _startDate) revert();

        return (_startDate, _endDate);
    }

    function _checkProposalCostsAndTransfer() private {
        require(msg.value == proposalCosts, "");
        (bool success, ) = address(dao()).call{value: msg.value}("");
        require(success, "Daofin: failed");
    }

    function isMasterNodeDelegatee(address delegatee_) public view returns (bool isValid) {
        if (delegatee_ == address(0)) return false;

        address masterNode = _masterNodeDelegatee.delegateeToMasterNode[delegatee_];
        if (masterNode == address(0)) return false;

        if (!getGlobalSettings().xdcValidator.isCandidate(masterNode)) return false;

        return true;
    }

    function isPeopleHouse(address voter_) public view returns (bool isValid) {
        bool isBelongToOtherCommittee = isMasterNodeDelegatee(voter_) || isJudiciaryMember(voter_);

        return
            !isBelongToOtherCommittee &&
            _voterToLockedAmounts[voter_].amount >= getGlobalSettings().houseMinAmount;
    }

    function findCommitteeName(address voter_) public view returns (bytes32) {
        if (voter_ == address(0)) return bytes32(0);

        if (isMasterNodeDelegatee(voter_)) {
            return MasterNodeCommittee;
        }
        if (isJudiciaryMember(voter_)) {
            return JudiciaryCommittee;
        }
        if (isPeopleHouse(voter_)) {
            return PeoplesHouseCommittee;
        }
        return bytes32(0);
    }

    function getProposalTallyDetails(
        uint256 proposalId_,
        bytes32 committee_
    ) public view returns (TallyDatails memory) {
        return _proposals[proposalId_].committeeToTallyDatails[committee_];
    }

    function getProposalVoterToInfo(
        uint256 proposalId_,
        address voter_
    ) public view returns (VoteInfo memory) {
        return _proposals[proposalId_].voterToInfo[voter_];
    }

    function isMinParticipationReached(uint256 _proposalId) public view returns (bool) {
        Proposal storage proposal_ = _proposals[_proposalId];

        bytes32[] memory committees = getCommitteesList();
        bool isValid = false;
        for (uint i = 0; i < committees.length; i++) {
            bytes32 committee = committees[i];
            uint256 totalVotes = proposal_.committeeToTallyDatails[committee].yes +
                proposal_.committeeToTallyDatails[committee].no +
                proposal_.committeeToTallyDatails[committee].abstain;

            uint256 minParticipation = getCommitteesToVotingSettings(
                proposal_.proposalTypeId,
                committee
            ).minParticipation;

            isValid =
                totalVotes >=
                _applyRatioCeiled(getTotalNumberOfMembersByCommittee(committee), minParticipation);

            if (!isValid) return false;
        }
        return true;
    }

    function isThresholdReached(uint256 _proposalId) public view returns (bool) {
        Proposal storage proposal_ = _proposals[_proposalId];

        bytes32[] memory committees = getCommitteesList();
        bool isValid = false;
        for (uint i = 0; i < committees.length; i++) {
            bytes32 committee = committees[i];
            uint256 totalVotes = proposal_.committeeToTallyDatails[committee].yes;

            uint256 supportThreshold = getCommitteesToVotingSettings(
                proposal_.proposalTypeId,
                committee
            ).supportThreshold;

            isValid =
                totalVotes >=
                _applyRatioCeiled(getTotalNumberOfMembersByCommittee(committee), supportThreshold);
            if (!isValid) return false;
        }
        return true;
    }

    function getTotalNumberOfMN() public view returns (uint256, uint256) {
        DaofinGlobalSettings memory _gs = getGlobalSettings();
        return (_gs.xdcValidator.candidateCount(), _masterNodeDelegatee.numberOfJointMasterNodes);
    }

    function getXDCTotalSupply() public pure returns (uint256) {
        return 37705012699 ether;
    }

    function getTotalNumberOfJudiciary() public view returns (uint256) {
        return _judiciaryCommitteeCount;
    }

    function getTotalNumberOfMembersByCommittee(bytes32 committee_) public view returns (uint256) {
        if (committee_ == MasterNodeCommittee) {
            (uint256 xdcValidator, ) = getTotalNumberOfMN();
            return xdcValidator;
        } else if (committee_ == JudiciaryCommittee) {
            return getTotalNumberOfJudiciary();
        } else if (committee_ == PeoplesHouseCommittee) {
            return getXDCTotalSupply();
        }
        return 0;
    }

    receive() external payable {}
}
