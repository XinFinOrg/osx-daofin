// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract XDCValidator {
    mapping(address => bool) validators;
    uint256 public candidateCount;

    function addCandidate(address candidate) external {
        validators[candidate] = true;
        candidateCount++;
    }

    function removeCandidate(address candidate) external {
        delete validators[candidate];
        candidateCount--;
    }

    function isCandidate(address _candidate) external view returns (bool) {
        return validators[_candidate];
    }

    function getRealCandidates() external pure returns (uint256) {
        return 420;
    }

    function getCandidates() external view returns (uint256) {
        return candidateCount;
    }

    function reset() external {
        candidateCount = 0;
    }
}
