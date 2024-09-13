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

    function removeCandidate(address candidate) external {
        // Check if the candidate exists and belongs to the sender
        require(validatorsState[candidate].isCandidate, "Address is not a candidate");
        require(validatorsState[candidate].owner == msg.sender, "Not the owner of this candidate");

        // Remove candidate from the ownerToCandidate array
        address[] storage ownerCandidates = ownerToCandidate[msg.sender];
        for (uint256 i = 0; i < ownerCandidates.length; i++) {
            if (ownerCandidates[i] == candidate) {
                ownerCandidates[i] = ownerCandidates[ownerCandidates.length - 1]; // Move the last element into the place of the removed element
                ownerCandidates.pop(); // Remove the last element
                break;
            }
        }

        // If the owner has no more candidates, remove them from _owners
        if (ownerToCandidate[msg.sender].length == 0) {
            for (uint256 i = 0; i < _owners.length; i++) {
                if (_owners[i] == msg.sender) {
                    _owners[i] = _owners[_owners.length - 1]; // Move the last element into the place of the removed element
                    _owners.pop(); // Remove the last element
                    break;
                }
            }
        }

        // Remove candidate from candidates array
        for (uint256 i = 0; i < candidates.length; i++) {
            if (candidates[i] == candidate) {
                candidates[i] = candidates[candidates.length - 1]; // Move the last element into the place of the removed element
                candidates.pop(); // Remove the last element
                break;
            }
        }

        // Update candidate state
        validatorsState[candidate].isCandidate = false;
        validatorsState[candidate].owner = address(0); // Reset owner information

        // Decrease the candidate count
        _candidateCount--;
    }

    function remove(address candidate) external {
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
