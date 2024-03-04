// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {IDAO} from "@xinfin/osx/core/dao/IDAO.sol";
import {IXDCValidator} from "./interfaces/IXdcValidator.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {_applyRatioCeiled, RATIO_BASE} from "@xinfin/osx/plugins/utils/Ratio.sol";
import "./Base/BaseDaofinPlugin.sol";

contract DaofinPlugin is BaseDaofinPlugin {
    using SafeCastUpgradeable for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    // A rate limiter on creation of proposal
    uint256 public lastProposalBlockNumber;

    // Global settings
    DaofinGlobalSettings private _daofinGlobalSettings;

    // proposalId => Proposal Struct
    mapping(uint256 => Proposal) public _proposals;

    // Charge proposer with a fixed amount
    uint256 public proposalCosts;
    /* 
        keccake256("<COMMITTEE_NAME>") => CommitteeVotingSettings
        NOTE: Specifies some settings for each defined committees separately
    */
    mapping(bytes32 => CommitteeVotingSettings) private _committeesToVotingSettings;

    /*
        voter => HouseDeposit
        NOTE: holds deposited amount to the Dao treasury contract
    */
    mapping(address => HouseDeposit) public _voterToLockedAmounts;

    /*
        Judiciary address => bool
        NOTE: holds a whitelist mapping
    */
    mapping(address => bool) public _judiciaryCommittee;

    /*
        NOTE: holds total number of Juries
    */
    uint256 public _judiciaryCommitteeCount;

    /* 
        NOTE: holds a master node delegatee whitelist mapping
    */
    MasterNodeDelegateeMappings public _masterNodeDelegatee;

    // The incremental ID for proposal types.
    CountersUpgradeable.Counter private proposalTypeCounter;

    /*
        proposalTypeID => committeeID => (VotingSettings struct)
        NOTE: holds proposal type id voting information per committee
    */
    mapping(uint256 => mapping(bytes32 => CommitteeVotingSettings))
        private _proposalTypesToCommiteesVotingSettings;

    // Holds a list of keccake256("<COMMITTEE_NAME>")
    bytes32[] public _committeesList;

    // Holds Election/voting Periods
    ElectionPeriod[] private _electionPeriods;

    // initialize function executes during the plugin setup
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
        if (xdcValidatorContract_ == address(0)) revert AddressIsZero();

        // Assign XDC Master Node contract address
        _settings.xdcValidator = IXDCValidator(xdcValidatorContract_);

        // Assign and check Election period
        for (uint256 i; i < electionPeriod_.length; ) {
            uint64 _startDate = electionPeriod_[i];
            uint64 _endDate = electionPeriod_[i + 1];

            _electionPeriods.push(ElectionPeriod(_startDate, _endDate));

            emit ElectionPeriodUpdated(_startDate, _endDate);
            unchecked {
                /* 
                    Receives election periods
                    in an array
                    [
                        startDate1,endDate1,
                        startDate2,endDate2,
                        ...
                    ]
                */
                i = i + 2;
            }
        }

        // Assign Proposal Creation costs
        proposalCosts = proposalCosts_;
        emit ProposalCostsUpdated(proposalCosts_);

        // push to committees' list
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

        // set up minimum house deposit amount
        _settings.houseMinAmount = allowedAmount_;

        // Assign memory to storage
        _daofinGlobalSettings = _settings;
    }

    function createProposal(
        bytes calldata _metadata,
        IDAO.Action[] calldata _actions,
        uint256 _electionPeriodIndex,
        uint256 _proposalType,
        uint256 _allowFailureMap,
        VoteOption _voteOption
    ) external payable returns (uint256 _proposalId) {
        // Cache msg.sender
        address proposer = _msgSender();

        // Checks the supplied XDC and Transfers to Treasury
        _checkProposalCostsAndTransfer();

        // Checks for out-bound proposal type ID
        require(proposalTypeCount() > _proposalType, "Daofin: invalid proposalType");

        // Submition of proposal must be before
        // the selected _electionPeriodIndex.
        // otherwise, it reverts
        (uint64 _startDate, uint64 _endDate) = _checkIfIsValidTimeToCreateProposal(
            _electionPeriodIndex
        );
        // Assign and Emits the important info of Proposal struct
        _proposalId = _createProposal(
            proposer,
            _metadata,
            _startDate,
            _endDate,
            _actions,
            _allowFailureMap
        );
        // Map proposal ID to PropsalType ID
        _proposals[_proposalId].proposalTypeId = _proposalType;
        emit ProposalIdToProposalTypeIdAttached(_proposalId, _proposalType);

        // Checks the proposer address
        // if a valid voter comes, stores vote info,
        // otherwise reverts.
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
        // It does not store any vote information
        // if the voteOption is NONE
        if (voteOption_ == VoteOption.None) return;

        // Checks if the voter belongs to any communities
        bytes32 committee = findCommitteeName(voter_);
        if (committee == bytes32(0)) revert InValidVoter();

        // Fetches voting settings for corresponding
        // proposalTypeId_ and committee
        CommitteeVotingSettings memory cvs = getCommitteesToVotingSettings(
            proposalTypeId_,
            committee
        );
        // Fetches Tally Details for corresponding
        // proposalTypeId_ and committee
        TallyDatails memory td = getProposalTallyDetails(proposalId_, committee);

        uint256 votingPower = cvs.minVotingPower;

        // Exception for House
        if (committee == PeoplesHouseCommittee) {
            if (_voterToLockedAmounts[voter_].amount >= getGlobalSettings().houseMinAmount) {
                votingPower = _voterToLockedAmounts[voter_].amount;
                votingPower = votingPower / (10 ** 18);
            } else {
                revert InValidAmount();
            }
        }
        if (voteOption_ == VoteOption.Yes) {
            td.yes += votingPower;
        } else if (voteOption_ == VoteOption.No) {
            td.no += votingPower;
        } else if (voteOption_ == VoteOption.Abstain) {
            td.abstain += votingPower;
        }

        // Assign memory to storage
        _proposals[proposalId_].committeeToTallyDetails[committee] = td;
        _proposals[proposalId_].voters.push(voter_);
        _proposals[proposalId_].voterToInfo[voter_] = VoteInfo(true, voteOption_);

        emit VoteReceived(proposalId_, voter_, committee, voteOption_);
    }

    function vote(uint256 _proposalId, VoteOption _voteOption, bool) external {
        // cache msg.sender
        address voter = _msgSender();

        // retrieve proposal Object
        (bool open, , , uint256 proposalTypeId) = getProposal(_proposalId);

        // check if is not open, revert()
        if (!open) revert InValidDate();

        // A voter must not vote on a proposal twice
        if (isVotedOnProposal(voter, _proposalId)) revert VotedAlready();

        _updateVote(proposalTypeId, _proposalId, voter, _voteOption);
    }

    function execute(uint256 _proposalId) external {
        if (!_canExecute(_proposalId)) revert NotReadyToExecute();
        _execute(_proposalId);
    }

    function _execute(uint256 _proposalId) private {
        Proposal storage _proposal = _proposals[_proposalId];

        // Makes a flag to me meant which is executed
        _proposal.executed = true;

        _executeProposal(dao(), _proposalId, _proposal.actions, _proposal.allowFailureMap);
    }

    function joinHouse() external payable returns (bool) {
        // cache msg.sender and msg.value
        address _member = _msgSender();
        uint256 _value = msg.value;

        if (getGlobalSettings().houseMinAmount > _value) {
            revert InValidAmount();
        }
        uint256 snapshotBlockNumber = getBlockSnapshot();

        // A Block delay to onboard members in house
        require(snapshotBlockNumber > _voterToLockedAmounts[_member].blockNumber, "Daofin:");

        // sender must not be part of MN Delegatees
        if (isMasterNodeDelegatee(_member)) revert InValidAddress();
        // sender must not be part of Juries
        if (isJudiciaryMember(_member)) revert InValidAddress();
        // sender must not be part of MN community
        if (getGlobalSettings().xdcValidator.isCandidate(_member)) revert InValidAddress();

        // A flag means the position gets activated
        _voterToLockedAmounts[_member].isActive = true;

        // Increase the balance in house
        _voterToLockedAmounts[_member].amount += _value;

        // store the last blocknumber to the above delay
        _voterToLockedAmounts[_member].blockNumber = snapshotBlockNumber;

        // transfers supplied assets to Treasury
        (bool success, ) = address(dao()).call{value: _value}("");
        if (!success) revert UnexpectedFailure();

        emit Deposited(_member, _value);
        return success;
    }

    function resignHouse() external {
        address _member = _msgSender();
        uint64 _now = block.timestamp.toUint64();

        // resign request must not be
        // in an active election period
        if (isWithinElectionPeriod()) revert InValidTime();

        HouseDeposit storage _hd = _voterToLockedAmounts[_member];

        if (_hd.amount <= 0) revert InValidAmount();
        if (_hd.blockNumber == 0) revert InValidBlockNumber();

        // set the flag to false
        _hd.isActive = false;

        // sets information to start the cooldown periods
        _hd.startOfCooldownPeriod = _now;
        _hd.endOfCooldownPeriod = _now + 7 days;

        emit HouseResignRequested(_member, _hd.amount, _hd.endOfCooldownPeriod);
    }

    function executeResignHouse() external {
        address _member = _msgSender();
        uint64 _now = block.timestamp.toUint64();

        HouseDeposit memory _hd = _voterToLockedAmounts[_member];

        // important checks
        if (_hd.amount == 0) revert InValidAmount();
        if (_hd.blockNumber == 0) revert InValidBlockNumber();

        // the flag must be false,
        // means the user has
        // already submitted its request
        if (_hd.isActive) revert InValidTime();
        if (_hd.endOfCooldownPeriod >= _now) revert InValidTime();

        // makes withdraw action
        IDAO.Action[] memory _actions = new IDAO.Action[](1);
        _actions[0] = IDAO.Action({to: _member, data: abi.encode(), value: _hd.amount});

        // delete storage for the house member
        delete _voterToLockedAmounts[_member];

        // executes and passes through treasury to withdraw the fund
        _executeProposal(dao(), 1000000, _actions, uint8(0));

        emit HouseResigned(_member, _hd.amount);
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
            if (committeeName == bytes32(0)) revert InValidCommittee();
            if (
                !(committeeName == MasterNodeCommittee ||
                    committeeName == PeoplesHouseCommittee ||
                    committeeName == JudiciaryCommittee)
            ) {
                revert InValidCommittee();
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

    function addJudiciaryMembers(
        address[] memory _members
    ) public auth(UPDATE_JUDICIARY_MAPPING_PERMISSION) {
        _addJudiciaryMember(_members);
    }

    function _addJudiciaryMember(address[] memory _members) private {
        for (uint256 i = 0; i < _members.length; i++) {
            if (isJudiciaryMember(_members[i])) revert JudiciaryExist();
            if (_members[i] == address(0)) revert AddressIsZero();
            _judiciaryCommitteeCount++;
            _judiciaryCommittee[_members[i]] = true;
            emit JudiciaryChanged(_members[i], 0);
        }
    }

    function removeJudiciaryMember(
        address _member
    ) external auth(UPDATE_JUDICIARY_MAPPING_PERMISSION) {
        _removeJudiciaryMember(_member);
    }

    function _removeJudiciaryMember(address _member) private {
        if (_member == address(0)) revert AddressIsZero();
        if (!isJudiciaryMember(_member)) revert JudiciaryNotExist();
        _judiciaryCommitteeCount--;
        delete _judiciaryCommittee[_member];
        emit JudiciaryChanged(_member, 1);
    }

    function updateElectionPeriod(
        ElectionPeriod[] calldata _periods
    ) public auth(UPDATE_ELECTION_PERIOD_PERMISSION) {
        for (uint256 i; i < _periods.length; i++) {
            uint64 _startDate = _periods[i].startDate;
            uint64 _endDate = _periods[i].endDate;
            if (_startDate > _endDate) revert InValidDate();
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

    function updateOrJoinMasterNodeDelegatee(address delegatee_) external {
        address masterNode = _msgSender();

        // supplied addresses must not be zero
        if (masterNode == address(0)) revert AddressIsZero();
        if (delegatee_ == address(0)) revert AddressIsZero();

        // can not whitelist same addresses
        if (masterNode == delegatee_) revert SameAddress();

        // register if it is a candidate
        if (!getGlobalSettings().xdcValidator.isCandidate(masterNode)) revert IsNotCandidate();

        // delegatee must not be a jury or house member
        if (isJudiciaryMember(delegatee_)) revert InValidAddress();
        if (isPeopleHouse(delegatee_)) revert InValidAddress();

        // Store in mapping and reverse mappings
        _updateMasterNodeDelegatee(masterNode, delegatee_);

        emit MasterNodeDelegateeUpdated(masterNode, delegatee_);
    }

    function _updateMasterNodeDelegatee(address masterNode_, address delegatee_) private {
        address _delegatee = _masterNodeDelegatee.masterNodeToDelegatee[masterNode_];
        address _masterNode = _masterNodeDelegatee.delegateeToMasterNode[delegatee_];

        // Duplicate record
        if (_delegatee == delegatee_ && _masterNode == masterNode_) revert InValidAddress();

        // Master Node registers at the first time
        if (_delegatee == address(0) && _masterNode == address(0)) {
            _masterNodeDelegatee.numberOfJointMasterNodes++;
        } else {
            // Master Node wants to change its delegatee
            if (isWithinElectionPeriod()) revert InValidTime();
        }

        // stores on reverse mappings for ease of accessibilities
        _masterNodeDelegatee.masterNodeToDelegatee[masterNode_] = delegatee_;
        _masterNodeDelegatee.delegateeToMasterNode[delegatee_] = masterNode_;
    }

    function updateProposalCosts(
        uint256 _newAmount
    ) external auth(UPDATE_PROPOSAL_COSTS_PERMISSION) {
        if (_newAmount <= 0) revert MustBeGreaterThanZero();
        if (proposalCosts == _newAmount) revert InValidAmount();

        proposalCosts = _newAmount;
        emit ProposalCostsUpdated(_newAmount);
    }

    function _checkIfIsValidTimeToCreateProposal(
        uint256 _electionIndex
    ) private view returns (uint64, uint64) {
        uint64 _startDate = _electionPeriods[_electionIndex].startDate;
        uint64 _endDate = _electionPeriods[_electionIndex].endDate;
        uint64 _now = block.timestamp.toUint64();

        // fetched dates must not be zero
        if (_startDate == 0 || _endDate == 0) revert InValidDate();

        // fetched _electionIndex
        // must be before start and end dates
        // otherwise it reverts
        if (_now < _startDate && _now < _endDate) return (_startDate, _endDate);

        revert CannotCreateProposalWithinElectionPeriod();
    }

    function _checkProposalCostsAndTransfer() private {
        require(msg.value == proposalCosts, "");
        (bool success, ) = address(dao()).call{value: msg.value}("");
        if (!success) revert UnexpectedFailure();
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
            _voterToLockedAmounts[voter_].isActive &&
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
        return _proposals[proposalId_].committeeToTallyDetails[committee_];
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
            uint256 totalVotes = proposal_.committeeToTallyDetails[committee].yes +
                proposal_.committeeToTallyDetails[committee].no +
                proposal_.committeeToTallyDetails[committee].abstain;

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
            uint256 totalVotes = proposal_.committeeToTallyDetails[committee].yes;

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

    function getGlobalSettings() public view returns (DaofinGlobalSettings memory) {
        return _daofinGlobalSettings;
    }

    function getCommitteesToVotingSettings(
        uint256 proposalTypeId_,
        bytes32 committee_
    ) public view returns (CommitteeVotingSettings memory) {
        return _proposalTypesToCommiteesVotingSettings[proposalTypeId_][committee_];
    }

    function isWithinElectionPeriod() public view returns (bool) {
        uint64 _now = block.timestamp.toUint64();

        for (uint i = 0; i < _electionPeriods.length; i++) {
            if (_electionPeriods[i].startDate < _now && _electionPeriods[i].endDate > _now) {
                return true;
            }
        }
        return false;
    }

    function getBlockSnapshot() public view returns (uint256 snapshotBlock) {
        unchecked {
            /* 
             The snapshot block must be mined
             already to protect the transaction
             against backrunning transactions
             causing census changes.
            */
            snapshotBlock = block.number - 1;
        }
    }

    receive() external payable {}
}
