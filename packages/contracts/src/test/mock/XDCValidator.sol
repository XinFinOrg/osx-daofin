// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract XDCValidator {
    struct ValidatorState {
        address owner;
        bool isCandidate;
    }
    mapping(address => ValidatorState) public validatorsState;
    mapping(address => address[]) ownerToCandidate;
    mapping(address => uint256) public ownerWeights;
    address[] public _owners;
    address[] public candidates;

    uint256 public _candidateCount;

    function addCandidate(address candidate) external {
        if (validatorsState[candidate].isCandidate) {
            revert();
        }
        if (ownerToCandidate[msg.sender].length == 0) {
            _owners.push(msg.sender);
        }
        validatorsState[candidate].isCandidate = true;
        validatorsState[candidate].owner = msg.sender;

        ownerToCandidate[msg.sender].push(candidate);

        candidates.push(candidate);
        _candidateCount++;
    }

    function getRealCandidates() external pure returns (uint256) {
        return 420;
    }

    function getCandidates() external view returns (address[] memory) {
        return candidates;
    }

    function owners(uint256 _index) external view returns (address) {
        return _owners[_index];
    }

    function getOwnerCount() external view returns (uint256) {
        return _owners.length;
    }

    function getCandidateOwner(address _candidate) public view returns (address) {
        return validatorsState[_candidate].owner;
    }

    function candidateCount() external view returns (uint256) {
        return _candidateCount;
    }

    function reset() external {
        _candidateCount = 0;
    }
}
